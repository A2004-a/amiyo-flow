use amiyo_flow_lib::ai::{apply_dictionary, apply_snippets, heuristic_cleanup, heuristic_cleanup_with_options};
use amiyo_flow_lib::audio::{encode_wav_16bit_mono, resample_linear};
use amiyo_flow_lib::db::{Database, DictionaryItem, HistoryItem, SnippetItem};

#[test]
fn test_audio_resampling_44100_to_16000() {
    let sample_count = 44100; // 1 second of 44.1kHz audio
    let input = vec![0.5f32; sample_count];
    let resampled = resample_linear(&input, 44100, 16000);

    // 16000 samples expected +/- 2 samples
    assert!(
        (resampled.len() as i32 - 16000).abs() <= 2,
        "Expected ~16000 samples, got {}",
        resampled.len()
    );
    for &sample in &resampled {
        assert!((sample - 0.5).abs() < 0.001);
    }
}

#[test]
fn test_wav_encoding_header() {
    let samples = vec![0.0f32, 0.5f32, -0.5f32, 1.0f32];
    let wav_bytes = encode_wav_16bit_mono(&samples, 16000).expect("Encoding failed");

    // Standard WAV header is 44 bytes + 4 samples * 2 bytes = 52 bytes
    assert_eq!(wav_bytes.len(), 52);
    assert_eq!(&wav_bytes[0..4], b"RIFF");
    assert_eq!(&wav_bytes[8..12], b"WAVE");
    assert_eq!(&wav_bytes[12..16], b"fmt ");
}

#[test]
fn test_filler_word_removal() {
    let raw = "um hello uh we need to basically deploy the release you know";
    let cleaned = heuristic_cleanup(raw);

    assert!(!cleaned.to_lowercase().contains("um"));
    assert!(!cleaned.to_lowercase().contains("uh"));
    assert!(!cleaned.to_lowercase().contains("basically"));
    assert!(!cleaned.to_lowercase().contains("you know"));
    assert!(cleaned.contains("Hello"));
    assert!(cleaned.ends_with('.'));
}

#[test]
fn test_spoken_self_correction() {
    let raw = "deploy the code on Friday no wait deploy on Monday";
    let cleaned = heuristic_cleanup(raw);

    assert!(cleaned.contains("Deploy on Monday"));
    assert!(!cleaned.contains("Friday"));
}

#[test]
fn test_accidental_duplicate_removal() {
    let raw = "this is the the code for the test";
    let cleaned = heuristic_cleanup(raw);

    assert!(!cleaned.contains("the the"));
    assert!(cleaned.contains("the code"));
}

#[test]
fn test_nu_na_and_regional_filler_removal() {
    let raw = "um hello nu na we should totally do this nu right now";
    let cleaned = heuristic_cleanup(raw);

    assert!(!cleaned.to_lowercase().contains("um"));
    assert!(!cleaned.to_lowercase().contains(" nu "));
    assert!(!cleaned.to_lowercase().contains(" na "));
    assert!(cleaned.contains("Hello we should totally do this right now"));
}

#[test]
fn test_repeated_phrase_removal() {
    let raw = "we can we can deploy the software in the in the morning";
    let cleaned = heuristic_cleanup(raw);

    assert!(!cleaned.contains("we can we can"));
    assert!(!cleaned.contains("in the in the"));
    assert!(cleaned.contains("We can deploy the software in the morning"));
}

#[test]
fn test_disfluency_options_toggle() {
    let raw = "um hello nu we can we can do it no wait tomorrow";

    // With all removals enabled:
    let all_cleaned = heuristic_cleanup_with_options(raw, true, true, true);
    assert!(!all_cleaned.to_lowercase().contains("um"));
    assert!(!all_cleaned.to_lowercase().contains("nu"));
    assert!(!all_cleaned.to_lowercase().contains("we can we can"));
    assert!(all_cleaned.to_lowercase().contains("tomorrow"));

    // With filler removal disabled:
    let keep_fillers = heuristic_cleanup_with_options("um hello nu we can do it", false, true, false);
    assert!(keep_fillers.to_lowercase().contains("um"));
    assert!(keep_fillers.to_lowercase().contains("nu"));

    // With repeat removal disabled:
    let keep_repeats = heuristic_cleanup_with_options("we can we can do it", true, false, false);
    assert!(keep_repeats.to_lowercase().contains("we can we can"));

    // With self-corrections disabled:
    let keep_corrections = heuristic_cleanup_with_options("start Friday no wait start Monday", true, true, false);
    assert!(keep_corrections.contains("Friday"));
}

#[test]
fn test_custom_filler_words_removal() {
    use amiyo_flow_lib::ai::heuristic_cleanup_with_custom;

    let raw = "so like literally we should push this yaar right now you know";
    let custom_fillers = vec!["like".to_string(), "literally".to_string(), "yaar".to_string()];

    let cleaned = heuristic_cleanup_with_custom(raw, true, true, true, &custom_fillers);
    assert!(!cleaned.to_lowercase().contains("like"));
    assert!(!cleaned.to_lowercase().contains("literally"));
    assert!(!cleaned.to_lowercase().contains("yaar"));
    assert!(!cleaned.to_lowercase().contains("you know"));
    assert!(cleaned.to_lowercase().contains("push this right now"));
}

#[test]
fn test_sentence_polish_and_grammar_cleanup() {
    use amiyo_flow_lib::ai::polish_sentence_structure;

    let raw = "we deployed the build. it works smoothly. dont worry i told them we cant fail. however we should test period";
    let polished = polish_sentence_structure(raw);

    assert!(polished.contains("We deployed the build."));
    assert!(polished.contains("It works smoothly."));
    assert!(polished.contains("Don't worry"));
    assert!(polished.contains("I told them"));
    assert!(polished.contains("can't fail."));
    assert!(polished.contains("However, we should"));
}

#[test]
fn test_mid_sentence_self_correction() {
    use amiyo_flow_lib::ai::heuristic_cleanup;

    // Mid-sentence value replacement
    let raw = "we need five no wait six servers for the new cluster period";
    let cleaned = heuristic_cleanup(raw);
    assert!(cleaned.contains("We need six servers"));
    assert!(!cleaned.contains("five"));

    // Date/Day replacement preserving preceding clause
    let raw2 = "schedule the meeting for Friday no wait Monday at 3 PM period";
    let cleaned2 = heuristic_cleanup(raw2);
    assert!(cleaned2.contains("Schedule the meeting for Monday at 3 PM"));
    assert!(!cleaned2.contains("Friday"));
}

#[test]
fn test_dictionary_replacement() {
    let raw = "I am testing amiyo with antigravity and taury framework";
    let dict = vec![
        DictionaryItem {
            id: "1".into(),
            word: "amiyo".into(),
            replacement: "Amiyo".into(),
            category: "Names".into(),
            created_at: "".into(),
        },
        DictionaryItem {
            id: "2".into(),
            word: "antigravity".into(),
            replacement: "Antigravity".into(),
            category: "Tech".into(),
            created_at: "".into(),
        },
        DictionaryItem {
            id: "3".into(),
            word: "taury".into(),
            replacement: "Tauri".into(),
            category: "Tech".into(),
            created_at: "".into(),
        },
    ];

    let result = apply_dictionary(raw, &dict);
    assert!(result.contains("Amiyo"));
    assert!(result.contains("Antigravity"));
    assert!(result.contains("Tauri"));
}

#[test]
fn test_snippet_expansion() {
    let raw = "Here is my signoff ;sig and repo ;gh";
    let snippets = vec![
        SnippetItem {
            id: "1".into(),
            trigger: ";sig".into(),
            expansion: "Best regards,\nAmiyo Garai".into(),
            description: "".into(),
            created_at: "".into(),
        },
        SnippetItem {
            id: "2".into(),
            trigger: ";gh".into(),
            expansion: "https://github.com/amiyo".into(),
            description: "".into(),
            created_at: "".into(),
        },
    ];

    let expanded = apply_snippets(raw, &snippets);
    assert!(expanded.contains("Best regards,\nAmiyo Garai"));
    assert!(expanded.contains("https://github.com/amiyo"));
    assert!(!expanded.contains(";sig"));
    assert!(!expanded.contains(";gh"));
}

#[test]
fn test_in_memory_database_crud() {
    let db = Database::new_in_memory().expect("Failed to create in-memory db");

    // 1. Settings test
    db.set_setting("hotkey", "Alt+Space").expect("Set setting failed");
    let val = db.get_setting("hotkey");
    assert_eq!(val, Some("Alt+Space".to_string()));

    // 2. History test
    let item = HistoryItem {
        id: "test-1".into(),
        timestamp: "2026-11-23T10:00:00Z".into(),
        duration_ms: 2500,
        raw_text: "hello world".into(),
        cleaned_text: "Hello world.".into(),
        target_app: "code.exe".into(),
        word_count: 2,
        style: "Professional".into(),
        provider: "groq".into(),
    };
    db.add_history(item).expect("Add history failed");

    let history = db.get_history(10).expect("Get history failed");
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].cleaned_text, "Hello world.");

    // 3. Analytics test
    let analytics = db.get_analytics().expect("Get analytics failed");
    assert_eq!(analytics.total_dictations, 1);
    assert_eq!(analytics.total_words, 2);
    assert!(analytics.estimated_minutes_saved >= 0.0);
}

#[test]
fn test_voice_activity_detection() {
    use amiyo_flow_lib::audio::vad::{VadConfig, VoiceActivityDetector};
    let mut vad = VoiceActivityDetector::new(VadConfig {
        silence_cutoff_ms: 100,
        ..Default::default()
    });

    // 10 calibration frames of silence
    let silence = vec![0i16; 480];
    for _ in 0..10 {
        let (is_speech, should_stop) = vad.process_frame(&silence);
        assert!(!is_speech);
        assert!(!should_stop);
    }

    // High energy alternating wave across 10 frames (300ms) to accumulate speech
    let mut speech = Vec::with_capacity(480);
    for i in 0..480 {
        speech.push(if i % 4 < 2 { 18000i16 } else { -18000i16 });
    }
    for _ in 0..10 {
        let (is_speech, _) = vad.process_frame(&speech);
        assert!(is_speech, "High energy wave should trigger speech classification");
    }

    // Continuous silence leading to auto-stop cutoff
    let mut stopped = false;
    for _ in 0..10 {
        let (_, auto_stop) = vad.process_frame(&silence);
        if auto_stop {
            stopped = true;
            break;
        }
    }
    assert!(stopped, "Auto stop cutoff should fire after speech ceases");
}

#[test]
fn test_audio_engine_vad_configuration() {
    use amiyo_flow_lib::audio::AudioEngine;
    use amiyo_flow_lib::audio::vad::VadConfig;

    let engine = AudioEngine::new();
    assert!(!engine.is_recording());
    assert!(!engine.is_paused());

    let vad_cfg = VadConfig {
        sample_rate: 16000,
        frame_size_ms: 30,
        energy_threshold_ratio: 2.5,
        zcr_speech_threshold: 0.08,
        silence_cutoff_ms: 1800,
    };

    assert_eq!(vad_cfg.silence_cutoff_ms, 1800);
    assert_eq!(vad_cfg.sample_rate, 16000);
}

#[test]
fn test_local_model_enumeration() {
    use amiyo_flow_lib::ai::list_local_llm_models;
    use amiyo_flow_lib::stt::list_local_speech_models;

    let speech_models = list_local_speech_models();
    assert!(!speech_models.is_empty(), "Should enumerate local speech models");
    assert!(speech_models.iter().any(|m| m.id == "tiny.en"));
    assert!(speech_models.iter().any(|m| m.id == "base.en"));

    let llm_models = list_local_llm_models();
    assert!(!llm_models.is_empty(), "Should enumerate local LLM models");
    assert!(llm_models.iter().any(|m| m.id == "heuristic-rule-engine"));
}

#[test]
fn test_credential_manager_masking() {
    use amiyo_flow_lib::security::CredentialManager;

    assert_eq!(CredentialManager::mask_key(""), "");
    assert_eq!(CredentialManager::mask_key("short"), "••••••••••••");
    let masked = CredentialManager::mask_key("sk-proj-1234567890abcdefghijklmnopqrstuvwxyz");
    assert!(masked.starts_with("sk-"));
    assert!(masked.ends_with("wxyz"));
    assert!(masked.contains("••••••••"));
}

#[test]
fn test_network_auditor_lifecycle() {
    use amiyo_flow_lib::security::network_audit::NetworkAuditor;

    let auditor = NetworkAuditor::new();
    assert_eq!(auditor.get_recent_events(10).len(), 0);

    auditor.record_event("Ollama (localhost)", true, "Grammar Cleanup", "Success", 35, 120);
    auditor.record_event("OpenAI (api.openai.com)", false, "Meeting Summarization", "Success", 420, 350);

    let events = auditor.get_recent_events(10);
    assert_eq!(events.len(), 2);
    // Most recent event comes first
    assert_eq!(events[0].destination, "OpenAI (api.openai.com)");
    assert!(!events[0].is_local);
    assert_eq!(events[1].destination, "Ollama (localhost)");
    assert!(events[1].is_local);

    auditor.clear_events();
    assert_eq!(auditor.get_recent_events(10).len(), 0);
}

#[test]
fn test_ai_router_defaults_and_mode_switching() {
    use amiyo_flow_lib::ai::router::{AiOperatingMode, AiRouter, AiRouterConfig};

    let default_config = AiRouterConfig::default();
    assert_eq!(default_config.mode, AiOperatingMode::Local);
    assert_eq!(default_config.default_local_model, "heuristic-rule-engine");
    assert!(!default_config.allow_cloud_fallback);

    // In Local Mode, route for "dictation" should select local Ollama/Heuristic
    let route = AiRouter::resolve_route(&default_config, "dictation");
    assert!(route.is_local);

    // In Cloud Mode, route should select configured cloud provider
    let mut cloud_config = AiRouterConfig::default();
    cloud_config.mode = AiOperatingMode::Cloud;
    cloud_config.default_cloud_provider = "anthropic".to_string();
    cloud_config.default_cloud_model = "claude-3-5-sonnet".to_string();

    let route = AiRouter::resolve_route(&cloud_config, "reasoning");
    assert!(!route.is_local);
    assert_eq!(route.provider_id, "anthropic");
    assert_eq!(route.model, "claude-3-5-sonnet");
}

#[test]
fn test_cloud_providers_catalog() {
    use amiyo_flow_lib::ai::providers::list_supported_cloud_providers;

    let providers = list_supported_cloud_providers();
    assert_eq!(providers.len(), 10, "Must support all 10 standard cloud providers");

    let ids: Vec<&str> = providers.iter().map(|p| p.id.as_str()).collect();
    assert!(ids.contains(&"openai"));
    assert!(ids.contains(&"deepseek"));
    assert!(ids.contains(&"anthropic"));
    assert!(ids.contains(&"gemini"));
    assert!(ids.contains(&"groq"));
    assert!(ids.contains(&"openrouter"));
    assert!(ids.contains(&"mistral"));
    assert!(ids.contains(&"together"));
    assert!(ids.contains(&"fireworks"));
    assert!(ids.contains(&"custom"));
}

#[test]
fn test_writing_styles_transformation() {
    use amiyo_flow_lib::ai::apply_style_formatting;

    let text = "define function arrow function curly brace return true semicolon close curly brace";
    let dev = apply_style_formatting(text, "Developer", "");
    assert!(dev.contains("=>"));
    assert!(dev.contains('{'));
    assert!(dev.contains(';'));
    assert!(dev.contains('}'));
    assert!(apply_style_formatting("x triple equals y", "Developer", "").contains("==="));
    assert!(apply_style_formatting("a not equals b", "Developer", "").contains("!="));

    let casual = apply_style_formatting("See you later.", "Casual", "");
    assert_eq!(casual, "See you later");

    let prompt = apply_style_formatting("Write a rust function", "AI Prompt", "");
    assert_eq!(prompt, "Write a rust function");

    let raw = apply_style_formatting("Raw text unchanged.", "Raw", "");
    assert_eq!(raw, "Raw text unchanged.");
}

#[tokio::test]
async fn test_meeting_assistant_structured_extraction() {
    use amiyo_flow_lib::ai::generate_meeting_summary;

    let transcript = "Amiyo suggested we implement on-device whisper transcription. Team agreed to deploy local models by Friday.";
    let meeting = generate_meeting_summary(transcript).await.expect("Failed to generate meeting");

    assert!(!meeting.summary.is_empty());
    assert!(!meeting.decisions.is_empty());
    assert!(!meeting.action_items.is_empty());
    assert_eq!(meeting.transcript, transcript);
}

#[test]
fn test_headless_python_detection_and_silent_command() {
    use amiyo_flow_lib::stt::{create_silent_command, find_python};

    // Verify create_silent_command builds cleanly
    let _cmd = create_silent_command("test_exe");

    // If python is discovered on Windows, verify it selects the headless pythonw.exe
    if let Some(py) = find_python() {
        let file_name = py.file_name().unwrap_or_default().to_string_lossy();
        if cfg!(windows) {
            // When pythonw.exe exists alongside python.exe, it MUST be selected to avoid console blinks
            if py.with_file_name("pythonw.exe").exists() {
                assert_eq!(
                    file_name, "pythonw.exe",
                    "Must select pythonw.exe for headless zero-blink execution"
                );
            }
        }
    }
}

#[test]
fn test_interrogative_question_and_currency_formatting() {
    use amiyo_flow_lib::ai::{heuristic_cleanup, is_interrogative_sentence};

    // 1. Interrogative Questions
    assert!(is_interrogative_sentence("what time is our next team meeting"));
    assert!(is_interrogative_sentence("can you review the pull request"));
    assert!(is_interrogative_sentence("could we check the logs"));
    assert!(is_interrogative_sentence("is this the latest release"));
    assert!(is_interrogative_sentence("how do we deploy the application"));
    assert!(!is_interrogative_sentence("what we need is more time"));
    assert!(!is_interrogative_sentence("how it works is simple"));

    let q1 = heuristic_cleanup("what time is our next team meeting");
    assert_eq!(q1, "What time is our next team meeting?");

    let q2 = heuristic_cleanup("what time is the meeting period");
    assert_eq!(q2, "What time is the meeting?");

    let q3 = heuristic_cleanup("can you review the pull request");
    assert_eq!(q3, "Can you review the pull request?");

    let not_q = heuristic_cleanup("what we need is more time");
    assert_eq!(not_q, "What we need is more time.");

    // 2. Currency, percentage, numbers, and quotes
    let curr1 = heuristic_cleanup("the price is 50 dollars for 10 percent discount");
    assert!(curr1.contains("$50"));
    assert!(curr1.contains("10%"));

    let curr2 = heuristic_cleanup("we need twenty percent off fifty dollars");
    assert!(curr2.contains("20%"));
    assert!(curr2.contains("$50"));

    let quote = heuristic_cleanup("open quote hello world close quote");
    assert!(quote.contains("\"hello world\""));

    let paren = heuristic_cleanup("open paren important note close paren");
    assert!(paren.contains("(important note)"));

    let num1 = heuristic_cleanup("check ticket number 5");
    assert!(num1.contains("#5"));

    let num2 = heuristic_cleanup("we are number one");
    assert!(num2.contains("#1"));

    // 3. Contraction & Run-Together Repairs
    let cont = heuristic_cleanup("he doesnt know they couldve won alot of games");
    assert!(cont.contains("doesn't"));
    assert!(cont.contains("could've"));
    assert!(cont.contains("a lot"));

    let run_together = heuristic_cleanup("nevermind they were infront of eachother");
    assert!(run_together.to_lowercase().contains("never mind"));
    assert!(run_together.contains("in front"));
    assert!(run_together.contains("each other"));
}

#[test]
fn test_spoken_edit_commands() {
    use amiyo_flow_lib::ai::{apply_spoken_edit_commands, heuristic_cleanup};

    // 1. Direct apply_spoken_edit_commands
    let c1 = apply_spoken_edit_commands("The meeting is on Friday change Friday to Saturday");
    assert_eq!(c1, "The meeting is on Saturday");

    let c2 = apply_spoken_edit_commands("We have 2 items and 2 users change all 2 to 4");
    assert_eq!(c2, "We have 4 items and 4 users");

    let c3 = apply_spoken_edit_commands("Meeting at three PM replace three PM with four PM");
    assert_eq!(c3, "Meeting at four PM");

    // Chained commands with "and"
    let c4 = apply_spoken_edit_commands("We have 2 bugs on Friday change Friday to Saturday and change all 2 to 4");
    assert_eq!(c4, "We have 4 bugs on Saturday");

    // 2. Verified end-to-end through heuristic_cleanup
    let cleaned = heuristic_cleanup("we have 2 bugs on Friday change Friday to Saturday and change all 2 to 4");
    assert_eq!(cleaned, "We have 4 bugs on Saturday.");

    let cleaned_single = heuristic_cleanup("the launch is on Friday change Friday to Saturday");
    assert_eq!(cleaned_single, "The launch is on Saturday.");
}

#[test]
fn test_pivot_backtrack_and_irritation_words() {
    use amiyo_flow_lib::ai::heuristic_cleanup;

    // 1. Pivot Phrase Backtrack (discards digression and rewinds to pivot phrase)
    let b1 = heuristic_cleanup("and i try to build chatgpt like application using rea no chatgpt like application");
    assert!(b1.contains("ChatGPT-like application") || b1.contains("ChatGPT like application"));
    assert!(!b1.to_lowercase().contains("using rea"));

    let b2 = heuristic_cleanup("we want to build a react native app for mobile no react native desktop app");
    assert!(b2.contains("react native desktop app"));
    assert!(!b2.contains("mobile"));

    // 2. Irritations & repeated words ("no no", "no no wait", "i mean")
    let irr1 = heuristic_cleanup("we need five no no wait six servers");
    assert!(irr1.contains("six servers"));
    assert!(!irr1.contains("five"));

    let irr2 = heuristic_cleanup("we deployed on saterday");
    assert!(irr2.contains("Saturday"));
}

#[test]
fn test_high_quality_voice_typing_improvements() {
    use amiyo_flow_lib::ai::heuristic_cleanup;

    // 1. Stutter comma removal from repeated words and phrases
    let st1 = heuristic_cleanup("we, we need to deploy");
    assert_eq!(st1, "We need to deploy.");

    let st2 = heuristic_cleanup("we can, we can deploy");
    assert_eq!(st2, "We can deploy.");

    // 2. Leading punctuation removal left by removed fillers
    let lp = heuristic_cleanup(", we can start");
    assert_eq!(lp, "We can start.");

    // 3. Spoken time formatting
    let t1 = heuristic_cleanup("the meeting is at five thirty PM");
    assert_eq!(t1, "The meeting is at 5:30 PM.");

    let t2 = heuristic_cleanup("let's meet at nine PM");
    assert_eq!(t2, "Let's meet at 9 PM.");

    // 4. Spoken math operations
    let m1 = heuristic_cleanup("what is 2 plus 2 equals 4");
    assert_eq!(m1, "What is 2 + 2 = 4?");

    // 5. Large numbers
    let num = heuristic_cleanup("we reached ten thousand users");
    assert_eq!(num, "We reached 10,000 users.");

    // 6. Developer & Tech terms normalization
    let dev = heuristic_cleanup("i built an api using typescript for github and tauri with rea");
    assert!(dev.contains("API"));
    assert!(dev.contains("TypeScript"));
    assert!(dev.contains("GitHub"));
    assert!(dev.contains("Tauri"));
    assert!(dev.contains("REA"));

    // 7. Start over backtrack
    let so = heuristic_cleanup("we broke the server wait let me start over deploy the latest release");
    assert_eq!(so, "Deploy the latest release.");
}

#[test]
fn test_phonetic_name_spelling_autocorrection_and_audio_noise_filter() {
    use amiyo_flow_lib::ai::heuristic_cleanup;
    use amiyo_flow_lib::audio::suppress_background_noise_and_filter;

    // 1. Phonetic name repair ("omiya", "omiyo", "amio", "a m i y o" -> "Amiyo")
    let n1 = heuristic_cleanup("hello omiya how are you");
    assert!(n1.contains("Amiyo"));

    let n2 = heuristic_cleanup("my name is spelled a m i y o");
    assert!(n2.contains("Amiyo"));

    let n3 = heuristic_cleanup("testing with amiyo flow application");
    assert!(n3.contains("AMIYO FLOW"));

    let n4 = heuristic_cleanup("testing with omiya flow application");
    assert!(n4.contains("AMIYO FLOW"));

    // 2. Hesitation particles "aa", "aah", "um aa"
    let f1 = heuristic_cleanup("um aa we should start the meeting");
    assert_eq!(f1, "We should start the meeting.");

    let f2 = heuristic_cleanup("aa the system is ready");
    assert_eq!(f2, "The system is ready.");

    // 3. Advanced speech autocorrection & typo repair
    let sp1 = heuristic_cleanup("check the wrong seplling and removwe the extra characters");
    assert!(sp1.contains("spelling"));
    assert!(sp1.contains("remove"));

    let sp2 = heuristic_cleanup("we definately recieved the document untill tommorow");
    assert!(sp2.contains("definitely"));
    assert!(sp2.contains("received"));
    assert!(sp2.contains("until"));
    assert!(sp2.contains("tomorrow"));

    // 4. Acoustic background noise suppression & 80Hz filter verification
    let sample_rate = 16000u32;
    let mut audio = Vec::with_capacity(16000);
    for i in 0..16000 {
        let t = i as f32 / sample_rate as f32;
        if i < 8000 {
            // Background 50Hz hum (amplitude 0.02)
            let hum = 0.02 * (2.0 * std::f32::consts::PI * 50.0 * t).sin();
            audio.push(hum);
        } else {
            // Speech tone 500Hz
            let speech = 0.40 * (2.0 * std::f32::consts::PI * 500.0 * t).sin();
            audio.push(speech);
        }
    }

    suppress_background_noise_and_filter(&mut audio, sample_rate);

    // Verify background quiet region has been attenuated
    let quiet_energy: f32 = audio[1000..7000].iter().map(|&s| s * s).sum::<f32>() / 6000.0;
    assert!(quiet_energy < 0.0003, "Background hum must be attenuated by high-pass & noise gate");

    // Verify speech region is preserved with healthy amplitude
    let speech_peak = audio[8000..16000].iter().map(|&s| s.abs()).fold(0.0f32, f32::max);
    assert!(speech_peak > 0.50, "Speech tone must be preserved and normalized");
}

#[test]
fn test_vad_conversational_silence_incomplete_clause_and_continuation_stitching() {
    use amiyo_flow_lib::ai::is_incomplete_sentence;
    use amiyo_flow_lib::audio::vad::{VadConfig, VoiceActivityDetector};

    // 1. Verify VAD default configuration has 2500ms (2.5s) conversational pause wait
    let vad_cfg = VadConfig::default();
    assert_eq!(vad_cfg.silence_cutoff_ms, 2500, "Default VAD silence cutoff must be 2.5s (2500ms)");

    // 2. Verify VAD speech accumulation safeguard (requires >= 300ms speech before auto-stop)
    let mut vad = VoiceActivityDetector::new(VadConfig {
        silence_cutoff_ms: 100,
        ..Default::default()
    });

    // Calibrate with 10 silence frames
    let silence = vec![0i16; 480];
    for _ in 0..10 {
        vad.process_frame(&silence);
    }

    // Only 2 frames of speech (60ms) should NOT trigger auto-stop even with subsequent silence
    let mut speech_frame = Vec::with_capacity(480);
    for i in 0..480 {
        let val = if i % 4 < 2 { 15000i16 } else { -15000i16 };
        speech_frame.push(val);
    }
    vad.process_frame(&speech_frame);
    vad.process_frame(&speech_frame);

    let mut early_stopped = false;
    for _ in 0..10 {
        let (_, stop) = vad.process_frame(&silence);
        if stop {
            early_stopped = true;
            break;
        }
    }
    assert!(!early_stopped, "A brief 60ms noise/grunt must NOT trigger auto-stop on silence");

    // 3. Verify incomplete sentence detection on connectors
    assert!(is_incomplete_sentence("i want to build chatgpt like application using rea and"));
    assert!(is_incomplete_sentence("we stopped because"));
    assert!(is_incomplete_sentence("deploy this to"));
    assert!(is_incomplete_sentence("check if"));
    assert!(!is_incomplete_sentence("deploy this to production"));
    assert!(!is_incomplete_sentence("everything is working smoothly"));

    // 4. Verify heuristic_cleanup does NOT append periods on incomplete sentences
    let incomplete_1 = heuristic_cleanup("i try to build chatgpt like application using rea and");
    assert!(!incomplete_1.ends_with('.'), "Incomplete sentence must not have trailing period: {}", incomplete_1);
    assert!(incomplete_1.ends_with("and"));

    // 5. Verify user prompt phrase: "and and start this this where is ends and"
    let cleaned_clause = heuristic_cleanup("and and start this this where is ends and");
    assert_eq!(cleaned_clause, "And start this where it ends and");
    assert!(!cleaned_clause.ends_with('.'));
    assert!(!cleaned_clause.contains("and and"));
    assert!(!cleaned_clause.contains("this this"));
    assert!(cleaned_clause.contains("where it ends"));

    // 6. Complete terminal sentence gets clean terminal punctuation
    let complete_sentence = heuristic_cleanup("deploy it to windows desktop");
    assert_eq!(complete_sentence, "Deploy it to Windows desktop.");
}

#[test]
fn test_chatgpt_interface_and_claude_phonetic_recognition() {
    use amiyo_flow_lib::ai::{apply_style_formatting, heuristic_cleanup};

    // 1. Verify phonetic mapping: "heck lot i want to build a chargey video like interface" -> "Hey Claude, I want to build a ChatGPT-like interface."
    let res = heuristic_cleanup("heck lot i want to build a chargey video like interface");
    assert!(res.contains("Hey Claude"));
    assert!(res.contains("ChatGPT-like interface"));

    // 2. Verify "i won't build" when spoken in context converts to "I want to build"
    let res2 = heuristic_cleanup("i won't build a chatgpt like application");
    assert!(res2.contains("I want to build a ChatGPT-like application"));

    // 3. Verify creator name variants in speech: "omyagurai", "ineira", "omegra"
    assert!(heuristic_cleanup("my name is omyagurai").contains("Amiyo Garai"));
    assert!(heuristic_cleanup("my name is ineira").contains("Amiyo Garai"));

    // 4. Verify AI Prompt style does NOT prefix "Instructions: "
    let prompt_styled = apply_style_formatting("I want to build a ChatGPT-like interface", "AI Prompt", "");
    assert_eq!(prompt_styled, "I want to build a ChatGPT-like interface");
    assert!(!prompt_styled.contains("Instructions:"));

    // 5. Verify "Hello, friends, cellocegivity. My name is Zumio Gari and what are you doing this time?"
    let hello_res = heuristic_cleanup("Hello, friends, cellocegivity. My name is Zumio Gari and what are you doing this time?");
    assert!(hello_res.contains("friends and ChatGPT") || hello_res.contains("friend and ChatGPT"));
    assert!(hello_res.contains("My name is Amiyo Garai"));
    assert!(hello_res.contains("what are you doing this time?"));

    // 6. Verify "hello friend and chatgpt" and "cello cegivity"
    assert!(heuristic_cleanup("hello friend and cellocegivity").contains("friend and ChatGPT"));
    assert!(heuristic_cleanup("hello friends, chatgpt").contains("Hello friends and ChatGPT"));
}

#[tokio::test]
async fn test_autonomous_voice_control_and_style_directives() {
    use amiyo_flow_lib::ai::{
        clean_transcript_with_options,
        extract_spoken_style_command,
        transform_to_business_style,
        engineer_structured_prompt_offline,
        transform_to_bullet_points,
        transform_to_email_format,
    };

    // 1. Spoken style command extraction
    let (prompt_style, prompt_content) = extract_spoken_style_command(
        "convert this into a proper prompt: build a chatgpt like application using react and tauri"
    );
    assert_eq!(prompt_style, Some("AI Prompt".to_string()));
    assert_eq!(prompt_content, "build a chatgpt like application using react and tauri");

    let (biz_style, biz_content) = extract_spoken_style_command(
        "in business style: can we maybe move the meeting to three PM if that works for you"
    );
    assert_eq!(biz_style, Some("Professional".to_string()));
    assert_eq!(biz_content, "can we maybe move the meeting to three PM if that works for you");

    let (bullets_style, bullets_content) = extract_spoken_style_command(
        "in bullet points: we need unit tests and release installer and documentation"
    );
    assert_eq!(bullets_style, Some("Bullet Points".to_string()));
    assert_eq!(bullets_content, "we need unit tests and release installer and documentation");

    let (email_style, email_content) = extract_spoken_style_command(
        "as an email: please review the pull request for the autonomous voice control feature"
    );
    assert_eq!(email_style, Some("Email".to_string()));
    assert_eq!(email_content, "please review the pull request for the autonomous voice control feature");

    let (none_style, none_content) = extract_spoken_style_command("ordinary spoken dictation");
    assert_eq!(none_style, None);
    assert_eq!(none_content, "ordinary spoken dictation");

    // 2. Business style transformation
    let biz_transformed = transform_to_business_style(
        "can we maybe move the meeting to 3:00 PM if that works for you"
    );
    assert!(biz_transformed.contains("Would it be possible to reschedule our meeting to 3:00 PM?"));
    assert!(biz_transformed.contains("Please let me know if that works for your schedule."));

    // 3. Offline structured prompt engineering
    let prompt_engineered = engineer_structured_prompt_offline(
        "build a chatgpt like application using react and tauri"
    );
    assert!(prompt_engineered.contains("Act as an expert software architect and full-stack engineer"));
    assert!(prompt_engineered.contains("Objective: build a chatgpt like application using react and tauri"));
    assert!(prompt_engineered.contains("Key Requirements:"));
    assert!(prompt_engineered.contains("Please structure the response with clear headings and bulleted explanations."));

    // 4. Bullet points formatting
    let bullets_transformed = transform_to_bullet_points("unit tests and release installer and documentation");
    assert!(bullets_transformed.contains("- Unit tests"));
    assert!(bullets_transformed.contains("- Release installer"));
    assert!(bullets_transformed.contains("- Documentation"));

    // 5. Email formatting
    let email_transformed = transform_to_email_format("please review the pull request for the autonomous voice control feature");
    assert!(email_transformed.contains("Subject: please review the pull request for"));
    assert!(email_transformed.contains("Hi team,"));
    assert!(email_transformed.contains("Best regards,\nAmiyo Garai"));

    // 6. Full end-to-end cleaning pipeline with spoken prompt directive overriding default style
    let cleaned_prompt = clean_transcript_with_options(
        "none",
        None,
        "convert this into a proper prompt: build a chatgpt like application using react and tauri",
        "Professional",
        "general",
        &[],
        &[],
        true,
        true,
        true,
    ).await.expect("Cleaning failed");

    assert!(cleaned_prompt.contains("Act as an expert software architect"));
    assert!(cleaned_prompt.contains("ChatGPT-like application"));
    assert!(cleaned_prompt.contains("Objective:"));

    // 7. Full end-to-end cleaning pipeline with spoken business style directive overriding default Casual style
    let cleaned_biz = clean_transcript_with_options(
        "none",
        None,
        "in business style: can we maybe move the meeting to 3:00 PM if that works for you",
        "Casual",
        "general",
        &[],
        &[],
        true,
        true,
        true,
    ).await.expect("Cleaning failed");

    assert!(cleaned_biz.contains("Would it be possible to reschedule our meeting to 3:00 PM?"));
    assert!(cleaned_biz.contains("Please let me know if that works for your schedule."));
}

#[test]
fn test_office_osu_word_to_win_and_irritate_words_removal() {
    use amiyo_flow_lib::ai::heuristic_cleanup;

    // 1. Verify "Take Claude" maps to "Hey Claude"
    let t1 = heuristic_cleanup("Take Claude, my name is Amiyo Garai");
    assert!(t1.contains("Hey Claude"));
    assert!(!t1.contains("Take Claude"));

    // 2. Verify "Microsoft OSU system" maps to "Microsoft Office system"
    let t2 = heuristic_cleanup("build a Microsoft OSU system");
    assert!(t2.contains("Microsoft Office system"));
    assert!(!t2.contains("OSU"));

    // 3. Verify indefinite article "a operating system" -> "an operating system"
    let t3 = heuristic_cleanup("build a operating system");
    assert!(t3.contains("an operating system"));

    // 4. Verify "by Windows 11" -> "for Windows 11"
    let t4 = heuristic_cleanup("build an operating system by Windows 11");
    assert!(t4.contains("for Windows 11"));

    // 5. Verify "like a mail, like win" -> "like Mail, like Word"
    let t5 = heuristic_cleanup("Microsoft Office system like a mail, like win, PowerPoint, Excel");
    assert!(t5.contains("like Mail, like Word"));
    assert!(!t5.contains("like win"));

    // 6. Verify "PowerPoint excel" -> "PowerPoint, Excel"
    let t6 = heuristic_cleanup("PowerPoint excel system");
    assert!(t6.contains("PowerPoint, Excel system"));

    // 7. Verify irritation hesitation removal: "what else is there, like what"
    let t7 = heuristic_cleanup("like Word, what else is there, like what PowerPoint, Excel");
    assert!(!t7.contains("what else is there"));
    assert!(!t7.contains("like what"));

    // 8. Full user test utterance
    let raw_input = "Take Claude, my name is Amiyo Garai and I try to build a operating system by Windows 11 and try to build like a file manager and systems and others, load, plug, closely and build a Microsoft OSU system like a mail, like win, what else is there, like what PowerPoint excel system";
    let cleaned = heuristic_cleanup(raw_input);

    assert!(cleaned.contains("Hey Claude"));
    assert!(cleaned.contains("my name is Amiyo Garai"));
    assert!(cleaned.contains("an operating system"));
    assert!(cleaned.contains("for Windows 11"));
    assert!(cleaned.contains("Microsoft Office system"));
    assert!(cleaned.contains("like Mail, like Word"));
    assert!(cleaned.contains("PowerPoint, Excel"));
    assert!(!cleaned.contains("OSU"));
    assert!(!cleaned.contains("Take Claude"));
    assert!(!cleaned.contains("like win"));
    assert!(!cleaned.contains("load, plug, closely"));
    assert!(!cleaned.contains("what else is there, like what"));
}

#[test]
fn test_expanded_irritation_words_and_developer_homophones() {
    use amiyo_flow_lib::ai::heuristic_cleanup;

    // 1. Verify indefinite article correction for tech terms
    let t1 = heuristic_cleanup("we need a API and a SDK for the project");
    assert!(t1.contains("an API and an SDK"));

    // 2. Verify developer homophones: pool request -> pull request, next js -> Next.js, dock er -> Docker
    let t2 = heuristic_cleanup("create a pool request with next js and dock er");
    assert!(t2.contains("pull request"));
    assert!(t2.contains("Next.js"));
    assert!(t2.contains("Docker"));

    // 3. Verify search-for-words irritation removal: how do you say, let me think, and stuff like that
    let t3 = heuristic_cleanup("we can build, how do you say, let me think we can build with Next.js and stuff like that");
    assert!(!t3.contains("how do you say"));
    assert!(!t3.contains("let me think"));
    assert!(!t3.contains("and stuff like that"));

    // 4. Verify stutter word deduplication: that that -> that, and and -> and
    let t4 = heuristic_cleanup("we know that that is true and and we can deploy");
    assert!(t4.contains("that is true and we can deploy"));
    assert!(!t4.contains("that that"));
    assert!(!t4.contains("and and"));

    // 5. Verify conjunction pause comma cleanup
    let t5 = heuristic_cleanup("we have Next.js and, we can deploy to Docker");
    assert!(t5.contains("and we can deploy"));
    assert!(!t5.contains("and, we"));

    // 6. Verify Gemini/ChatGPT acoustic phonetic recognition
    let t6 = heuristic_cleanup("Hello, friends, cellocegivity. My name is Zumio Gari and what are you doing this time?");
    assert!(t6.contains("friends and ChatGPT"));
    assert!(t6.contains("Amiyo Garai"));
    assert!(!t6.contains("cellocegivity"));
    assert!(!t6.contains("Zumio Gari"));
}





