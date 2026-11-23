use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, StreamConfig};
use hound::{WavSpec, WavWriter};
use parking_lot::Mutex;
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};

pub mod vad;

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct AudioDeviceInfo {
    pub name: String,
    pub is_default: bool,
}

pub struct AudioEngine {
    samples_buffer: Arc<Mutex<Vec<f32>>>,
    is_recording: Arc<AtomicBool>,
    is_paused: Arc<AtomicBool>,
    selected_device_name: Arc<Mutex<Option<String>>>,
    sample_rate: Arc<Mutex<u32>>,
    stop_signal_tx: Arc<Mutex<Option<Sender<()>>>>,
}

// Explicitly implement Send and Sync since all internal fields are Send + Sync
unsafe impl Send for AudioEngine {}
unsafe impl Sync for AudioEngine {}

impl AudioEngine {
    pub fn new() -> Self {
        Self {
            samples_buffer: Arc::new(Mutex::new(Vec::with_capacity(16000 * 30))),
            is_recording: Arc::new(AtomicBool::new(false)),
            is_paused: Arc::new(AtomicBool::new(false)),
            selected_device_name: Arc::new(Mutex::new(None)),
            sample_rate: Arc::new(Mutex::new(44100)),
            stop_signal_tx: Arc::new(Mutex::new(None)),
        }
    }

    pub fn list_devices(&self) -> Vec<AudioDeviceInfo> {
        let host = cpal::default_host();
        let default_device_name = host.default_input_device().and_then(|d| d.name().ok());
        let mut list = Vec::new();

        if let Ok(devices) = host.input_devices() {
            for d in devices {
                if let Ok(name) = d.name() {
                    let is_default = default_device_name.as_deref() == Some(&name);
                    list.push(AudioDeviceInfo { name, is_default });
                }
            }
        }
        list
    }

    pub fn set_device(&self, device_name: Option<String>) {
        let mut dev = self.selected_device_name.lock();
        *dev = device_name;
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::SeqCst)
    }

    pub fn is_paused(&self) -> bool {
        self.is_paused.load(Ordering::SeqCst)
    }

    pub fn pause(&self) {
        if self.is_recording() {
            self.is_paused.store(true, Ordering::SeqCst);
        }
    }

    pub fn resume(&self) {
        if self.is_recording() {
            self.is_paused.store(false, Ordering::SeqCst);
        }
    }

    pub fn cancel(&self) {
        self.is_recording.store(false, Ordering::SeqCst);
        self.is_paused.store(false, Ordering::SeqCst);
        if let Some(tx) = self.stop_signal_tx.lock().take() {
            let _ = tx.send(());
        }
        self.samples_buffer.lock().clear();
    }

    pub fn start_recording(&self, app_handle: AppHandle) -> Result<(), String> {
        if self.is_recording() {
            self.cancel();
        }

        let host = cpal::default_host();
        let target_device_name = self.selected_device_name.lock().clone();

        let device: Device = if let Some(ref name) = target_device_name {
            if let Ok(devices) = host.input_devices() {
                devices
                    .into_iter()
                    .find(|d| d.name().map(|n| n == *name).unwrap_or(false))
                    .or_else(|| host.default_input_device())
            } else {
                host.default_input_device()
            }
        } else {
            host.default_input_device()
        }
        .ok_or_else(|| "No audio input device found on the system".to_string())?;

        let supported_config = device
            .default_input_config()
            .map_err(|e| format!("Failed to get default input config: {}", e))?;

        let sample_format = supported_config.sample_format();
        let config: StreamConfig = supported_config.into();

        *self.sample_rate.lock() = config.sample_rate.0;

        self.samples_buffer.lock().clear();
        self.is_recording.store(true, Ordering::SeqCst);
        self.is_paused.store(false, Ordering::SeqCst);

        let (stop_tx, stop_rx) = channel::<()>();
        *self.stop_signal_tx.lock() = Some(stop_tx);

        let buffer_clone = Arc::clone(&self.samples_buffer);
        let is_recording_flag = Arc::clone(&self.is_recording);
        let is_paused_flag = Arc::clone(&self.is_paused);
        let channels = config.channels as usize;

        // Dedicated audio capture thread that owns cpal::Stream
        thread::spawn(move || {
            let err_fn = |err| {
                eprintln!("Audio input stream error: {}", err);
            };

            let emit_handle = app_handle.clone();
            let mut last_emit_instant = std::time::Instant::now();

            let stream_result = match sample_format {
                SampleFormat::F32 => device.build_input_stream(
                    &config,
                    move |data: &[f32], _: &_| {
                        if !is_recording_flag.load(Ordering::SeqCst) || is_paused_flag.load(Ordering::SeqCst) {
                            return;
                        }

                        let mut sum_sq = 0.0f32;
                        let mut count = 0;
                        let mut mono_samples = Vec::with_capacity(data.len() / channels);

                        for chunk in data.chunks(channels) {
                            let sample: f32 = chunk.iter().sum::<f32>() / (channels as f32);
                            mono_samples.push(sample);
                            sum_sq += sample * sample;
                            count += 1;
                        }

                        let rms = if count > 0 { (sum_sq / count as f32).sqrt() } else { 0.0 };
                        let level = (rms * 5.0).min(1.0);

                        if last_emit_instant.elapsed().as_millis() >= 33 {
                            let _ = emit_handle.emit("amiyo-audio-level", level);
                            last_emit_instant = std::time::Instant::now();
                        }

                        buffer_clone.lock().extend_from_slice(&mono_samples);
                    },
                    err_fn,
                    None,
                ),
                SampleFormat::I16 => device.build_input_stream(
                    &config,
                    move |data: &[i16], _: &_| {
                        if !is_recording_flag.load(Ordering::SeqCst) || is_paused_flag.load(Ordering::SeqCst) {
                            return;
                        }

                        let mut sum_sq = 0.0f32;
                        let mut count = 0;
                        let mut mono_samples = Vec::with_capacity(data.len() / channels);

                        for chunk in data.chunks(channels) {
                            let sample_i16: i32 = chunk.iter().map(|&s| s as i32).sum::<i32>() / (channels as i32);
                            let sample = (sample_i16 as f32) / 32768.0;
                            mono_samples.push(sample);
                            sum_sq += sample * sample;
                            count += 1;
                        }

                        let rms = if count > 0 { (sum_sq / count as f32).sqrt() } else { 0.0 };
                        let level = (rms * 5.0).min(1.0);

                        if last_emit_instant.elapsed().as_millis() >= 33 {
                            let _ = emit_handle.emit("amiyo-audio-level", level);
                            last_emit_instant = std::time::Instant::now();
                        }

                        buffer_clone.lock().extend_from_slice(&mono_samples);
                    },
                    err_fn,
                    None,
                ),
                _ => return,
            };

            if let Ok(stream) = stream_result {
                let _ = stream.play();
                // Block thread until stop signal is received
                let _ = stop_rx.recv();
                let _ = stream.pause();
                // stream is dropped here naturally inside its home thread!
            }
        });

        Ok(())
    }

    pub fn stop_recording(&self) -> Result<(Vec<u8>, usize), String> {
        if !self.is_recording() {
            return Err("Not currently recording".into());
        }

        self.is_recording.store(false, Ordering::SeqCst);
        self.is_paused.store(false, Ordering::SeqCst);

        // Send signal to audio thread to drop stream
        if let Some(tx) = self.stop_signal_tx.lock().take() {
            let _ = tx.send(());
        }

        let raw_samples = {
            let mut buf = self.samples_buffer.lock();
            let data = buf.clone();
            buf.clear();
            data
        };

        let (resampled, sample_count) = if raw_samples.is_empty() {
            (vec![0.0f32; 8000], 8000)
        } else {
            let input_rate = *self.sample_rate.lock();
            let target_rate = 16000;
            let r = resample_linear(&raw_samples, input_rate, target_rate);
            let c = r.len();
            (r, c)
        };

        let wav_bytes = encode_wav_16bit_mono(&resampled, 16000)
            .map_err(|e| format!("Failed to encode WAV buffer: {}", e))?;

        Ok((wav_bytes, sample_count))
    }
}

pub fn resample_linear(input: &[f32], source_rate: u32, target_rate: u32) -> Vec<f32> {
    if source_rate == target_rate || input.is_empty() {
        return input.to_vec();
    }

    let ratio = source_rate as f64 / target_rate as f64;
    let target_len = ((input.len() as f64) / ratio).round() as usize;
    let mut output = Vec::with_capacity(target_len);

    for i in 0..target_len {
        let src_idx = (i as f64) * ratio;
        let idx0 = src_idx.floor() as usize;
        let frac = (src_idx - (idx0 as f64)) as f32;

        if idx0 + 1 < input.len() {
            let s0 = input[idx0];
            let s1 = input[idx0 + 1];
            output.push(s0 + frac * (s1 - s0));
        } else if idx0 < input.len() {
            output.push(input[idx0]);
        } else {
            output.push(0.0);
        }
    }

    output
}

pub fn encode_wav_16bit_mono(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, hound::Error> {
    let spec = WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut cursor = Cursor::new(Vec::with_capacity(samples.len() * 2 + 44));
    {
        let mut writer = WavWriter::new(&mut cursor, spec)?;
        for &sample in samples {
            let clamped = sample.max(-1.0).min(1.0);
            let s_i16 = (clamped * 32767.0) as i16;
            writer.write_sample(s_i16)?;
        }
        writer.finalize()?;
    }

    Ok(cursor.into_inner())
}
