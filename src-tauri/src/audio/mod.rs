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

#[inline]
fn process_vad_samples(
    mono_samples: &[f32],
    vad: &mut vad::VoiceActivityDetector,
    sample_accum: &mut Vec<i16>,
    frame_samples: usize,
    has_emitted_auto_stop: &mut bool,
    emit_handle: &AppHandle,
) {
    if *has_emitted_auto_stop {
        return;
    }

    for &s in mono_samples {
        let s_i16 = (s * 32767.0).clamp(-32768.0, 32767.0) as i16;
        sample_accum.push(s_i16);
    }

    while sample_accum.len() >= frame_samples && !*has_emitted_auto_stop {
        let (_is_speech, should_auto_stop) = vad.process_frame(&sample_accum[..frame_samples]);
        sample_accum.drain(..frame_samples);

        if should_auto_stop {
            *has_emitted_auto_stop = true;
            let _ = emit_handle.emit("amiyo-vad-auto-stop", ());
            break;
        }
    }
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
        self.start_recording_with_vad(app_handle, None)
    }

    pub fn start_recording_with_vad(
        &self,
        app_handle: AppHandle,
        mut vad_config: Option<vad::VadConfig>,
    ) -> Result<(), String> {
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

        let (device, supported_config) = match device.default_input_config() {
            Ok(c) => (device, c),
            Err(e) => {
                // If custom device fails config, fallback to default input device
                if let Some(def_dev) = host.default_input_device() {
                    let conf = def_dev.default_input_config().map_err(|e2| {
                        format!("Failed to configure fallback audio input device: {}", e2)
                    })?;
                    (def_dev, conf)
                } else {
                    return Err(format!("Failed to get default input config: {}", e));
                }
            }
        };

        let sample_format = supported_config.sample_format();
        let config: StreamConfig = supported_config.into();

        *self.sample_rate.lock() = config.sample_rate.0;

        if let Some(ref mut vc) = vad_config {
            vc.sample_rate = config.sample_rate.0;
        }

        self.samples_buffer.lock().clear();
        self.is_recording.store(true, Ordering::SeqCst);
        self.is_paused.store(false, Ordering::SeqCst);

        let (stop_tx, stop_rx) = channel::<()>();
        *self.stop_signal_tx.lock() = Some(stop_tx);

        let (init_tx, init_rx) = channel::<Result<(), String>>();

        let buffer_clone = Arc::clone(&self.samples_buffer);
        let is_recording_flag = Arc::clone(&self.is_recording);
        let is_paused_flag = Arc::clone(&self.is_paused);
        let channels = config.channels as usize;
        let frame_samples = ((config.sample_rate.0 as usize * 30) / 1000).max(1);

        // Dedicated audio capture thread that owns cpal::Stream
        thread::spawn(move || {
            let err_fn = |err| {
                eprintln!("Audio input stream error: {}", err);
            };

            let emit_handle = app_handle.clone();
            let mut last_emit_instant = std::time::Instant::now();

            let (mut vad_f32, mut accum_f32, mut stop_f32) = (vad_config.clone().map(vad::VoiceActivityDetector::new), Vec::with_capacity(1600), false);
            let (mut vad_i16, mut accum_i16, mut stop_i16) = (vad_config.clone().map(vad::VoiceActivityDetector::new), Vec::with_capacity(1600), false);
            let (mut vad_i32, mut accum_i32, mut stop_i32) = (vad_config.clone().map(vad::VoiceActivityDetector::new), Vec::with_capacity(1600), false);
            let (mut vad_u16, mut accum_u16, mut stop_u16) = (vad_config.map(vad::VoiceActivityDetector::new), Vec::with_capacity(1600), false);

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

                        if let Some(ref mut vad) = vad_f32 {
                            process_vad_samples(&mono_samples, vad, &mut accum_f32, frame_samples, &mut stop_f32, &emit_handle);
                        }
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

                        if let Some(ref mut vad) = vad_i16 {
                            process_vad_samples(&mono_samples, vad, &mut accum_i16, frame_samples, &mut stop_i16, &emit_handle);
                        }
                    },
                    err_fn,
                    None,
                ),
                SampleFormat::I32 => device.build_input_stream(
                    &config,
                    move |data: &[i32], _: &_| {
                        if !is_recording_flag.load(Ordering::SeqCst) || is_paused_flag.load(Ordering::SeqCst) {
                            return;
                        }

                        let mut sum_sq = 0.0f32;
                        let mut count = 0;
                        let mut mono_samples = Vec::with_capacity(data.len() / channels);

                        for chunk in data.chunks(channels) {
                            let sample_i64: i64 = chunk.iter().map(|&s| s as i64).sum::<i64>() / (channels as i64);
                            let sample = (sample_i64 as f32) / 2147483648.0;
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

                        if let Some(ref mut vad) = vad_i32 {
                            process_vad_samples(&mono_samples, vad, &mut accum_i32, frame_samples, &mut stop_i32, &emit_handle);
                        }
                    },
                    err_fn,
                    None,
                ),
                SampleFormat::U16 => device.build_input_stream(
                    &config,
                    move |data: &[u16], _: &_| {
                        if !is_recording_flag.load(Ordering::SeqCst) || is_paused_flag.load(Ordering::SeqCst) {
                            return;
                        }

                        let mut sum_sq = 0.0f32;
                        let mut count = 0;
                        let mut mono_samples = Vec::with_capacity(data.len() / channels);

                        for chunk in data.chunks(channels) {
                            let sample_i32: i32 = chunk.iter().map(|&s| s as i32 - 32768).sum::<i32>() / (channels as i32);
                            let sample = (sample_i32 as f32) / 32768.0;
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

                        if let Some(ref mut vad) = vad_u16 {
                            process_vad_samples(&mono_samples, vad, &mut accum_u16, frame_samples, &mut stop_u16, &emit_handle);
                        }
                    },
                    err_fn,
                    None,
                ),
                _ => {
                    let _ = init_tx.send(Err(format!("Unsupported audio sample format: {:?}", sample_format)));
                    return;
                }
            };

            match stream_result {
                Ok(stream) => {
                    if let Err(e) = stream.play() {
                        let _ = init_tx.send(Err(format!("Failed to activate microphone stream: {}", e)));
                        return;
                    }
                    let _ = init_tx.send(Ok(()));
                    // Block thread until stop signal is received
                    let _ = stop_rx.recv();
                    let _ = stream.pause();
                    // stream is dropped here naturally inside its home thread!
                }
                Err(e) => {
                    let _ = init_tx.send(Err(format!("Failed to build audio stream: {}", e)));
                }
            }
        });

        match init_rx.recv_timeout(std::time::Duration::from_millis(1500)) {
            Ok(Ok(())) => Ok(()),
            Ok(Err(e)) => {
                self.is_recording.store(false, Ordering::SeqCst);
                Err(e)
            }
            Err(_) => {
                self.is_recording.store(false, Ordering::SeqCst);
                Err("Audio device initialization timed out".to_string())
            }
        }
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

        if raw_samples.is_empty() {
            return Ok((Vec::new(), 0));
        }

        let input_rate = *self.sample_rate.lock();
        let target_rate = 16000;
        let mut resampled = resample_linear(&raw_samples, input_rate, target_rate);

        // Acoustic background noise reduction & speech enhancement
        suppress_background_noise_and_filter(&mut resampled, target_rate);

        let sample_count = resampled.len();

        let wav_bytes = encode_wav_16bit_mono(&resampled, 16000)
            .map_err(|e| format!("Failed to encode WAV buffer: {}", e))?;

        Ok((wav_bytes, sample_count))
    }
}

/// Applies acoustic pre-processing to speech audio:
/// 1. DC offset removal & 80Hz high-pass filter (stripping AC hum, table bumps, PC fan rumble)
/// 2. Adaptive background noise gate & soft spectral expander (attenuating room noise during speech pauses)
/// 3. Peak normalization to -1 dBFS (~0.89 float) for maximum Whisper acoustic model recognition accuracy
pub fn suppress_background_noise_and_filter(samples: &mut [f32], sample_rate: u32) {
    if samples.is_empty() {
        return;
    }

    // 1. 80Hz High-Pass Filter (single-pole IIR)
    let fc = 80.0f32;
    let dt = 1.0f32 / (sample_rate as f32);
    let rc = 1.0f32 / (2.0f32 * std::f32::consts::PI * fc);
    let alpha = rc / (rc + dt);

    let mut prev_x = samples[0];
    let mut prev_y = 0.0f32;

    for s in samples.iter_mut() {
        let x = *s;
        let y = alpha * (prev_y + x - prev_x);
        prev_x = x;
        prev_y = y;
        *s = y;
    }

    // 2. Adaptive Noise Gate & Soft Expander
    let frame_size = (sample_rate as usize * 20) / 1000; // 20ms frames (320 samples at 16kHz)
    if frame_size > 0 && samples.len() >= frame_size * 2 {
        let mut frame_energies = Vec::new();
        for chunk in samples.chunks(frame_size) {
            let energy: f32 = chunk.iter().map(|&v| v * v).sum::<f32>() / (chunk.len() as f32);
            frame_energies.push(energy);
        }

        if !frame_energies.is_empty() {
            let mut sorted_energies = frame_energies.clone();
            sorted_energies.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

            // 20th percentile energy represents ambient background noise floor
            let p20_idx = (sorted_energies.len() * 20) / 100;
            let noise_floor = sorted_energies[p20_idx].max(0.00001);
            let speech_threshold = (noise_floor * 3.5).max(0.0005);

            for (i, chunk) in samples.chunks_mut(frame_size).enumerate() {
                let energy = frame_energies[i];
                if energy < speech_threshold {
                    // Attenuation factor smoothly scales between 0.20 (-14dB) and 1.0
                    let ratio = (energy / speech_threshold).clamp(0.0, 1.0);
                    let gain = 0.20 + 0.80 * (ratio * ratio);
                    for sample in chunk.iter_mut() {
                        *sample *= gain;
                    }
                }
            }
        }
    }

    // 3. Peak Normalization to -1 dBFS (~0.89)
    let max_peak = samples.iter().map(|&s| s.abs()).fold(0.0f32, f32::max);
    if max_peak > 0.01 && max_peak < 0.85 {
        let target_peak = 0.89f32;
        let gain = (target_peak / max_peak).min(4.0); // Limit maximum boost to +12dB
        for sample in samples.iter_mut() {
            *sample = (*sample * gain).clamp(-1.0, 1.0);
        }
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
