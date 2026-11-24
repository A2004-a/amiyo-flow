/// Local Voice Activity Detection (VAD) Engine
/// Implements frame-based Short-Time Energy (STE) and Zero-Crossing Rate (ZCR)
/// with adaptive ambient noise tracking and silence duration detection.

#[derive(Debug, Clone)]
pub struct VadConfig {
    pub sample_rate: u32,
    pub frame_size_ms: usize,
    pub energy_threshold_ratio: f32,
    pub zcr_speech_threshold: f32,
    pub silence_cutoff_ms: u64,
}

impl Default for VadConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16000,
            frame_size_ms: 30, // 30ms frames (480 samples at 16kHz)
            energy_threshold_ratio: 2.5,
            zcr_speech_threshold: 0.08,
            silence_cutoff_ms: 2500, // 2.5s silence stops dictation (conversational 2 to 3s wait)
        }
    }
}

pub struct VoiceActivityDetector {
    config: VadConfig,
    noise_energy_floor: f32,
    calibrated_frames: usize,
    consecutive_silence_ms: u64,
    accumulated_speech_ms: u64,
    has_detected_speech: bool,
    speech_hangover_remaining_ms: u64,
}

impl VoiceActivityDetector {
    pub fn new(config: VadConfig) -> Self {
        Self {
            config,
            noise_energy_floor: 0.0001,
            calibrated_frames: 0,
            consecutive_silence_ms: 0,
            accumulated_speech_ms: 0,
            has_detected_speech: false,
            speech_hangover_remaining_ms: 0,
        }
    }

    /// Processes a chunk of 16-bit PCM audio samples.
    /// Returns (is_speech: bool, should_auto_stop: bool).
    pub fn process_frame(&mut self, samples: &[i16]) -> (bool, bool) {
        if samples.is_empty() {
            return (false, false);
        }

        // Convert to normalized floats [-1.0, 1.0]
        let mut sum_sq = 0.0f32;
        let mut zero_crossings = 0usize;

        for i in 0..samples.len() {
            let s = samples[i] as f32 / 32768.0;
            sum_sq += s * s;

            if i > 0 {
                let prev = samples[i - 1];
                let curr = samples[i];
                if (prev >= 0 && curr < 0) || (prev < 0 && curr >= 0) {
                    zero_crossings += 1;
                }
            }
        }

        let energy = sum_sq / (samples.len() as f32);
        let zcr = (zero_crossings as f32) / (samples.len() as f32);

        let frame_duration_ms = if self.config.sample_rate > 0 {
            ((samples.len() as f64 / self.config.sample_rate as f64) * 1000.0).round() as u64
        } else {
            30
        };

        // Ambient noise floor calibration during initial 10 frames (~300ms)
        if self.calibrated_frames < 10 {
            // If the user started speaking immediately upon pressing the hotkey,
            // protect the noise floor from being artificially inflated by vocal energy.
            let is_early_speech = energy >= 0.008 && (zcr >= 0.008 || energy >= 0.012);
            if is_early_speech {
                self.accumulated_speech_ms += frame_duration_ms;
                if self.accumulated_speech_ms >= 200 {
                    self.has_detected_speech = true;
                }
            } else {
                let clamped_energy = energy.min(0.005);
                self.noise_energy_floor = (self.noise_energy_floor * self.calibrated_frames as f32 + clamped_energy)
                    / ((self.calibrated_frames + 1) as f32);
            }
            self.calibrated_frames += 1;
            return (self.has_detected_speech, false);
        }

        let threshold = (self.noise_energy_floor * self.config.energy_threshold_ratio).max(0.0008);
        // Robust voice detection: when speech is already underway, be more forgiving with trailing vocal decrescendo
        // so soft trailing words (e.g. "which features we can") are never prematurely classified as silence.
        let effective_threshold = if self.has_detected_speech {
            (threshold * 0.75).max(0.0005)
        } else {
            threshold
        };
        let is_speech = energy > effective_threshold && (zcr >= 0.006 || energy > effective_threshold * 1.25);

        const SPEECH_HANGOVER_MS: u64 = 400; // 400ms speech hangover protects natural inter-word breathing pauses

        if is_speech {
            self.accumulated_speech_ms += frame_duration_ms;
            // Require at least 240ms of accumulated speech before auto-stop becomes eligible
            if self.accumulated_speech_ms >= 240 {
                self.has_detected_speech = true;
            }
            self.consecutive_silence_ms = 0;
            self.speech_hangover_remaining_ms = SPEECH_HANGOVER_MS;
        } else {
            if self.speech_hangover_remaining_ms > 0 {
                // Within speech hangover window: bridge breathing gap without accumulating silence
                self.speech_hangover_remaining_ms = self.speech_hangover_remaining_ms.saturating_sub(frame_duration_ms);
            } else {
                // Genuine sustained silence beyond hangover: accumulate towards cutoff
                self.consecutive_silence_ms += frame_duration_ms;
                // Adaptively drift noise floor slowly if silence persists, clamping energy spikes (e.g. keyboard clicks)
                self.noise_energy_floor = self.noise_energy_floor * 0.96 + energy.min(0.015) * 0.04;
            }
        }

        let should_auto_stop = self.has_detected_speech
            && self.consecutive_silence_ms >= self.config.silence_cutoff_ms;

        (is_speech, should_auto_stop)
    }

    pub fn reset(&mut self) {
        self.calibrated_frames = 0;
        self.consecutive_silence_ms = 0;
        self.accumulated_speech_ms = 0;
        self.has_detected_speech = false;
        self.speech_hangover_remaining_ms = 0;
        self.noise_energy_floor = 0.0001;
    }

    pub fn get_noise_floor(&self) -> f32 {
        self.noise_energy_floor
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vad_silence_detection() {
        let mut vad = VoiceActivityDetector::new(VadConfig::default());
        let silence_frame = vec![0i16; 480];

        // First 10 frames calibrate noise floor
        for _ in 0..15 {
            let (is_speech, auto_stop) = vad.process_frame(&silence_frame);
            assert!(!is_speech, "Silence frame should not be speech");
            assert!(!auto_stop, "Auto stop should not trigger without prior speech");
        }
    }

    #[test]
    fn test_vad_speech_and_cutoff() {
        let mut vad = VoiceActivityDetector::new(VadConfig {
            silence_cutoff_ms: 100, // 100ms for quick test
            ..Default::default()
        });

        // 1. Calibrate with silence
        let silence_frame = vec![0i16; 480];
        for _ in 0..10 {
            vad.process_frame(&silence_frame);
        }

        // 2. Synthesize speech frames (high energy alternating waveform across 10 frames = 300ms)
        let mut speech_frame = Vec::with_capacity(480);
        for i in 0..480 {
            let val = if i % 4 < 2 { 15000i16 } else { -15000i16 };
            speech_frame.push(val);
        }

        for _ in 0..10 {
            let (is_speech, _) = vad.process_frame(&speech_frame);
            assert!(is_speech, "High-energy alternating wave should be detected as speech");
        }

        // 3. Short pause within hangover (e.g. 5 frames * 30ms = 150ms < 400ms hangover)
        for _ in 0..5 {
            let (_, should_stop) = vad.process_frame(&silence_frame);
            assert!(!should_stop, "Speech hangover should prevent auto-stop during short breathing pause");
        }

        // 4. Followed by sustained silence exceeding hangover + cutoff (20 frames * 30ms = 600ms > 400ms + 100ms)
        let mut auto_stopped = false;
        for _ in 0..20 {
            let (_, should_stop) = vad.process_frame(&silence_frame);
            if should_stop {
                auto_stopped = true;
                break;
            }
        }

        assert!(auto_stopped, "VAD should trigger auto-stop after speech followed by sustained silence");
    }
}
