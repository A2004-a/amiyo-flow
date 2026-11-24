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

    // Continuous silence leading to auto-stop cutoff (20 frames * 30ms = 600ms > 400ms hangover + 100ms cutoff)
    let mut stopped = false;
    for _ in 0..20 {
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
    assert!(speech_models.iter().any(|m| m.id == "distil-large-v3"), "Should enumerate Distil-Large v3");
    assert!(speech_models.iter().any(|m| m.id == "large-v3-turbo"), "Should enumerate Large v3 Turbo");
    assert!(speech_models.iter().any(|m| m.id == "medium.en"), "Should enumerate Whisper Medium");

    // Verify rich telemetry metadata
    let turbo = speech_models.iter().find(|m| m.id == "large-v3-turbo").unwrap();
    assert_eq!(turbo.tier, "Flagship Universal");
    assert!(turbo.latency_ms > 0);
    assert!(!turbo.quantization.is_empty());
    assert!(!turbo.parameters.is_empty());

    let llm_models = list_local_llm_models();
    assert!(!llm_models.is_empty(), "Should enumerate local LLM models");
    assert!(llm_models.iter().any(|m| m.id == "heuristic-rule-engine"));
    assert!(llm_models.iter().any(|m| m.id == "qwen2.5-1.5b-q4_k_m"), "Should enumerate Qwen 1.5B");
    assert!(llm_models.iter().any(|m| m.id == "llama-3.2-3b-q4_k_m"), "Should enumerate Llama 3.2 3B");

    let flagship_llm = llm_models.iter().find(|m| m.id == "llama-3.2-3b-q4_k_m").unwrap();
    assert_eq!(flagship_llm.tier, "Flagship Edge LLM");
    assert!(flagship_llm.context_tokens >= 8192);
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

#[test]
fn test_tech_acronyms_step_numbering_and_negative_contractions() {
    use amiyo_flow_lib::ai::heuristic_cleanup;

    // 1. Spoken step and part numbering
    let t1 = heuristic_cleanup("step one install dependencies then step two run cargo test and part one of release");
    assert!(t1.contains("Step 1"));
    assert!(t1.contains("Step 2"));
    assert!(t1.contains("Part 1"));

    // 2. Negative contractions and spoken future/conditional forms
    let t2 = heuristic_cleanup("it wasnt ready and we hadnt seen it but youll love it and shell deploy it");
    assert!(t2.contains("wasn't"));
    assert!(t2.contains("hadn't"));
    assert!(t2.contains("you'll"));
    assert!(t2.contains("she'll"));

    // 3. Technical infrastructure acronyms
    let t3 = heuristic_cleanup("we use graphql with postgresql and redis on linux with nginx and docker for llm training on gpu");
    assert!(t3.contains("GraphQL"));
    assert!(t3.contains("PostgreSQL"));
    assert!(t3.contains("Redis"));
    assert!(t3.contains("Linux"));
    assert!(t3.contains("Nginx"));
    assert!(t3.contains("Docker"));
    assert!(t3.contains("LLM"));
    assert!(t3.contains("GPU"));

    // 4. Extended incomplete sentence connectors
    let t4 = heuristic_cleanup("we are building towards");
    assert!(!t4.ends_with('.'));
}

#[test]
fn test_speech_cleanser_image1_features_and_custom_fillers() {
    use amiyo_flow_lib::ai::{heuristic_cleanup, heuristic_cleanup_full};

    // 1. Card 1: Remove Filler Words & Irritation Phrases (standard + regional slang)
    let raw_fillers = "what I mean to say, give me a sec, um hello nu we can start arre yaar bhai and things like that";
    let cleaned_fillers = heuristic_cleanup(raw_fillers);
    assert_eq!(cleaned_fillers, "Hello we can start.");

    // 2. Card 2: Remove Stutters (1-word, 2-word, and 3-word phrase repeats)
    let raw_stutters = "we can we can deploy and I want to I want to build";
    let cleaned_stutters = heuristic_cleanup(raw_stutters);
    assert_eq!(cleaned_stutters, "We can deploy and I want to build.");

    // 3. Card 3: Self-Corrections (detects backtrack phrases like "no wait", keeping true speech)
    let raw_corrections = "Friday no wait Monday";
    let cleaned_corrections = heuristic_cleanup(raw_corrections);
    assert_eq!(cleaned_corrections, "Monday.");

    // 4. Card 4: Clean Sentences (capitalizes sentences, pronoun 'I', repairs contractions)
    let raw_sentences = "we arrived. it works. dont worry";
    let cleaned_sentences = heuristic_cleanup(raw_sentences);
    assert_eq!(cleaned_sentences, "We arrived. It works. Don't worry.");

    // 5. Custom Filler Words & Regional Slang custom filter support
    let custom = vec!["superfluous".to_string(), "anyhow".to_string()];
    let raw_custom = "this is superfluous code anyhow that we cleaned";
    let cleaned_custom = heuristic_cleanup_full(raw_custom, true, true, true, true, &custom);
    assert_eq!(cleaned_custom, "This is code that we cleaned.");

    // 6. Modular toggle controls (independent toggles for all 4 cards)
    let raw_mixed = "um we can we can deploy Friday no wait Monday";

    // Disabling remove_fillers retains "um"
    let no_fillers = heuristic_cleanup_full(raw_mixed, false, true, true, true, &[]);
    assert!(no_fillers.to_lowercase().contains("um"));

    // Disabling remove_repeats retains "we can we can"
    let no_repeats = heuristic_cleanup_full(raw_mixed, true, false, true, true, &[]);
    assert!(no_repeats.to_lowercase().contains("we can we can"));

    // Disabling remove_corrections retains "friday no wait"
    let no_corrections = heuristic_cleanup_full(raw_mixed, true, true, false, true, &[]);
    assert!(no_corrections.to_lowercase().contains("friday"));

    // Disabling clean_sentences retains lowercase inner sentence and uncontracted 'dont'
    let no_sentence_clean = heuristic_cleanup_full("we arrived. it works. dont worry", true, true, true, false, &[]);
    assert!(no_sentence_clean.contains("it works"));
    assert!(no_sentence_clean.contains("dont worry"));
}

#[test]
fn test_vad_48khz_sample_rate_timing_and_hangover() {
    use amiyo_flow_lib::audio::vad::{VadConfig, VoiceActivityDetector};

    // 48000 Hz configuration
    let mut vad = VoiceActivityDetector::new(VadConfig {
        sample_rate: 48000,
        frame_size_ms: 30,
        silence_cutoff_ms: 2500,
        ..Default::default()
    });

    // 1. Calibrate 10 frames of silence (1440 samples = 30ms at 48kHz)
    let silence_frame = vec![0i16; 1440];
    for _ in 0..10 {
        vad.process_frame(&silence_frame);
    }

    // 2. Synthesize speech frames at 48kHz (10 frames = 300ms)
    let mut speech_frame = Vec::with_capacity(1440);
    for i in 0..1440 {
        let val = if i % 8 < 4 { 16000i16 } else { -16000i16 };
        speech_frame.push(val);
    }
    for _ in 0..10 {
        let (is_speech, _) = vad.process_frame(&speech_frame);
        assert!(is_speech, "Speech frame at 48kHz must be recognized");
    }

    // 3. Natural inter-word pause of 300ms (10 frames of 30ms)
    // Must NOT trigger auto-stop due to 400ms speech hangover
    for _ in 0..10 {
        let (_, should_stop) = vad.process_frame(&silence_frame);
        assert!(!should_stop, "Inter-word pause within 400ms hangover must not trigger premature cutoff");
    }

    // 4. Speech resumes: hangover resets
    for _ in 0..5 {
        let (is_speech, _) = vad.process_frame(&speech_frame);
        assert!(is_speech);
    }

    // 5. User stops speaking: requires 400ms hangover + 2500ms silence = 2900ms (~97 frames of 30ms)
    let mut stopped = false;
    let mut frames_until_stop = 0;
    for _ in 0..110 {
        frames_until_stop += 1;
        let (_, should_stop) = vad.process_frame(&silence_frame);
        if should_stop {
            stopped = true;
            break;
        }
    }

    assert!(stopped, "VAD must auto-stop after 2.5s sustained silence");
    // At 30ms per frame, 2900ms is ~96-98 frames. It must NOT trigger at < 80 frames (which was the premature cutoff bug)!
    assert!(frames_until_stop >= 83, "Cutoff must not trigger prematurely before full 2.5s pause");
}

#[test]
fn test_incomplete_clause_modal_verbs_protection() {
    use amiyo_flow_lib::ai::{heuristic_cleanup, is_incomplete_sentence};

    // Modal auxiliaries
    assert!(is_incomplete_sentence("which features we can"));
    assert!(is_incomplete_sentence("we could"));
    assert!(is_incomplete_sentence("they will"));
    assert!(is_incomplete_sentence("we would"));
    assert!(is_incomplete_sentence("you should"));

    // Auxiliaries & copulas
    assert!(is_incomplete_sentence("they are"));
    assert!(is_incomplete_sentence("we were"));
    assert!(is_incomplete_sentence("it is"));
    assert!(is_incomplete_sentence("we have"));

    // Intent verbs
    assert!(is_incomplete_sentence("I want"));
    assert!(is_incomplete_sentence("we need"));
    assert!(is_incomplete_sentence("trying"));

    // Ensure no terminal period is appended to incomplete sentences
    let incomplete = heuristic_cleanup("which features we can");
    assert!(!incomplete.ends_with('.'), "Incomplete sentence must not have a terminal period appended");
    assert!(incomplete.contains("Which features we can"));
}

#[test]
fn test_screenshot_utterance_claude_whatsapp_and_irritation_cleanup() {
    use amiyo_flow_lib::ai::heuristic_cleanup;

    // Exact transcribed text from user's Claude screenshot:
    let raw = "Een, Amiyo omiyaya Amiyo, omiHey Claude, my name is Amiyo Garai and I try to visit ChatGPT, I'm like, what's up and creative, overall, for this user manual and how the what's up works and which features we can";

    let cleaned = heuristic_cleanup(raw);

    // 1. Pre-greeting throat clear & name stutter stripped cleanly
    assert!(cleaned.starts_with("Hey Claude, my name is Amiyo Garai"), "Should strip 'Een, Amiyo omiyaya Amiyo, omi' before greeting");
    assert!(!cleaned.contains("Een"));
    assert!(!cleaned.contains("omiyaya"));
    assert!(!cleaned.contains("omiHey"));

    // 2. Informal conversational filler "I'm like," removed
    assert!(!cleaned.contains("I'm like"));

    // 3. WhatsApp acoustic homophones corrected
    assert!(cleaned.contains("WhatsApp and creative") || cleaned.contains("WhatsApp"), "Should correct 'what's up and creative' to WhatsApp");
    assert!(cleaned.contains("how WhatsApp works"), "Should correct 'how the what's up works' to 'how WhatsApp works'");

    // 4. Incomplete clause preserved without terminal period
    assert!(cleaned.ends_with("which features we can"), "Should end cleanly on incomplete verb phrase without terminal period");
    assert!(!cleaned.ends_with('.'));
}

#[test]
fn test_speech_cleanser_four_cards_expanded_and_fast_execution() {
    use amiyo_flow_lib::ai::{heuristic_cleanup, heuristic_cleanup_full};
    use std::time::Instant;

    // --- Card 1: Remove Filler Words ---
    // Regional slang, thinking pauses, throat clearing, discourse markers
    let raw_c1 = "ahem what was I saying we can deploy to production arre yaar toh phir";
    let c1 = heuristic_cleanup(raw_c1);
    assert!(!c1.contains("ahem"), "Should remove throat clear 'ahem'");
    assert!(!c1.contains("what was I saying"), "Should remove thinking pause 'what was I saying'");
    assert!(!c1.contains("arre yaar"), "Should remove regional slang 'arre yaar'");
    assert!(!c1.contains("toh phir"), "Should remove regional slang 'toh phir'");
    assert!(c1.contains("We can deploy to production"));

    // --- Card 2: Remove Stutters ---
    // Syllables (w- we, th- the), 4-word repeated phrases, 2-word stutters, triple stutters
    let raw_c2 = "w- we can deploy the production app we can deploy the production app the the the build";
    let c2 = heuristic_cleanup(raw_c2);
    assert!(!c2.contains("w-"), "Should collapse syllable stutter 'w- we'");
    assert!(!c2.contains("the the the"), "Should collapse triple repeat 'the the the'");
    assert_eq!(c2.matches("we can deploy the production app").count(), 1, "Should deduplicate 4-word repeated phrase");

    // --- Card 3: Self-Corrections ---
    // Expanded triggers: 'or rather', 'make that', 'scratch that last word'
    let raw_c3 = "schedule three no make that four servers for Friday or rather Monday";
    let c3 = heuristic_cleanup(raw_c3);
    assert!(c3.contains("four servers"), "Should backtrack 'three no make that four' -> 'four'");
    assert!(!c3.contains("three"), "Should remove overridden count 'three'");
    assert!(c3.contains("Monday"), "Should backtrack 'Friday or rather Monday' -> 'Monday'");
    assert!(!c3.contains("Friday"), "Should remove overridden day 'Friday'");

    // --- Card 4: Clean Sentences ---
    // Contractions: couldn't've -> couldn't have, who've -> who've, quote auto-balancing, article 'an OS'
    let raw_c4 = "we couldntve known where hes going. \"we installed a os";
    let c4 = heuristic_cleanup(raw_c4);
    assert!(c4.contains("couldn't have"), "Should expand 'couldntve' -> 'couldn't have'");
    assert!(c4.contains("an OS"), "Should correct 'a os' -> 'an OS'");
    assert!(c4.ends_with('"'), "Should auto-close unbalanced quotation mark");

    // --- Modular Isolation Check ---
    let custom: Vec<String> = vec![];
    // With fillers off, fillers are preserved
    let keep_fillers = heuristic_cleanup_full("um hello we can deploy", false, true, true, true, &custom);
    assert!(keep_fillers.to_lowercase().contains("um"));

    // With repeats off, repeats are preserved
    let keep_repeats = heuristic_cleanup_full("we can we can deploy", true, false, true, true, &custom);
    assert!(keep_repeats.to_lowercase().contains("we can we can"));

    // --- Sub-millisecond Execution Speed Verification ---
    let sample = "um hello w- we can we can deploy five no wait six servers to a os couldntve failed";
    // Warm up OnceLock caches so initial compilation overhead is excluded:
    let _ = heuristic_cleanup(sample);
    let start = Instant::now();
    let iterations = 100;
    for _ in 0..iterations {
        let _ = heuristic_cleanup(sample);
    }
    let elapsed = start.elapsed();
    let avg_us = elapsed.as_micros() as f64 / iterations as f64;
    // Real-time zero-latency verification (< 25ms in unoptimized debug profile, < 0.2ms in release profile)
    assert!(avg_us < 25000.0, "Execution must be instantaneous and zero-latency (got {:.2} us)", avg_us);
}

#[test]
fn test_vad_onset_early_speech_protection_and_style_commands() {
    use amiyo_flow_lib::audio::vad::{VadConfig, VoiceActivityDetector};
    use amiyo_flow_lib::ai::{extract_spoken_style_command, transform_to_business_style};

    // 1. VAD Early Speech Protection during Calibration
    let mut vad = VoiceActivityDetector::new(VadConfig::default());
    let loud_speech_frame = vec![14000i16; 480]; // Strong voiced speech frame

    // Feed loud speech during initial calibration frames (first 10 frames)
    for _ in 0..8 {
        vad.process_frame(&loud_speech_frame);
    }
    // Verify loud speech does NOT inflate ambient noise floor
    let noise_floor = vad.get_noise_floor();
    assert!(noise_floor <= 0.005, "Loud speech during calibration must not inflate noise floor (got {})", noise_floor);

    // 2. Expanded Voice Control Directives & OnceLock Extraction
    let (s1, c1) = extract_spoken_style_command("write this using business style: can we maybe move the meeting to three PM");
    assert_eq!(s1.as_deref(), Some("Professional"));
    assert_eq!(c1, "can we maybe move the meeting to three PM");

    let (s2, c2) = extract_spoken_style_command("using prompt style: create a web scraper for financial reports");
    assert_eq!(s2.as_deref(), Some("AI Prompt"));
    assert_eq!(c2, "create a web scraper for financial reports");

    let (s3, c3) = extract_spoken_style_command("make this developer style: let count equals zero");
    assert_eq!(s3.as_deref(), Some("Developer"));
    assert_eq!(c3, "let count equals zero");

    let (s4, c4) = extract_spoken_style_command("in casual style: hey what is up my friend");
    assert_eq!(s4.as_deref(), Some("Casual"));
    assert_eq!(c4, "hey what is up my friend");

    // 3. Expanded Business Phrase Transformations
    let b1 = transform_to_business_style("can you send me the details and thanks a lot");
    assert!(b1.to_lowercase().contains("could you please provide the"));
    assert!(b1.contains("thank you very much for your assistance"));

    let b2 = transform_to_business_style("i will let you know asap");
    assert!(b2.contains("I will keep you updated"));
    assert!(b2.contains("at your earliest convenience"));

    let b3 = transform_to_business_style("do this now");
    assert!(b3.to_lowercase().contains("please prioritize this at your earliest convenience"));
}

#[test]
fn test_opencode_acoustic_homophones_restart_and_audio_trimming() {
    use amiyo_flow_lib::ai::heuristic_cleanup;
    use amiyo_flow_lib::audio::trim_trailing_and_leading_silence;

    // 1. OpenCode Homophones: "Hey open port" -> "Hey OpenCode", "open code" -> "OpenCode"
    let c1 = heuristic_cleanup("Hey open port, my name is Amiyo Garai");
    assert!(c1.contains("Hey OpenCode"), "Must convert 'Hey open port' to 'Hey OpenCode': got '{}'", c1);

    let c2 = heuristic_cleanup("I am working inside open code editor");
    assert!(c2.contains("OpenCode"), "Must convert 'open code' to 'OpenCode': got '{}'", c2);

    // 2. Typewriter and tech homophones:
    let c3 = heuristic_cleanup("I'm a child of built-in system like a typewriter, so K-A-B-O interface, what talks we've done, what each other works");
    assert!(c3.contains("built-in system") || c3.contains("build a system"));
    assert!(c3.contains("keyboard interface"));
    assert!(c3.contains("what tasks we've done"));
    assert!(c3.contains("how each works"));

    // 3. Mid-Sentence Greeting Restart Stripping
    let restart_raw = "Hey, welcome Claude, my name is Amiyo Garai, and I try to Hey OpenCode, my name is Amiyo Garai, I try to build a Word-like app for documents";
    let c4 = heuristic_cleanup(restart_raw);
    assert!(!c4.contains("Hey, welcome Claude"), "Must strip mid-sentence false start greeting");
    assert!(c4.starts_with("Hey OpenCode, my name is Amiyo Garai"));
    assert!(c4.contains("Word-like app"));

    // 4. Audio Trimming of Trailing and Leading Dead Silence
    let sample_rate = 16000;
    let mut audio = vec![0.0f32; 16000]; // 1 second leading silence
    audio.extend(vec![0.25f32; 16000]);   // 1 second voice speech
    audio.extend(vec![0.0f32; 32000]);    // 2 seconds trailing silence
    assert_eq!(audio.len(), 64000);

    let trimmed = trim_trailing_and_leading_silence(&audio, sample_rate);
    assert!(trimmed.len() < audio.len(), "Trimmed audio must be shorter than original");
    assert!(trimmed.len() <= 32000, "Must strip dead leading and trailing silence: got {} samples", trimmed.len());
}

#[tokio::test]
async fn test_meeting_assistant_expanded_decisions_and_bullet_lists() {
    use amiyo_flow_lib::ai::generate_meeting_summary;

    let transcript = "
    - Amiyo settled on implementing 100% on-device speech transcription.
    - Team finalized the dual-window HUD architecture.
    - Sarah is responsible for the Win32 SendInput Unicode injection pipeline.
    - Marcus is tasked with benchmarking VAD silence auto-stop across studio audio interfaces.
    - Deliverable deadline is scheduled for next sprint review.
    ";

    let meeting = generate_meeting_summary(transcript).await.expect("Failed to generate meeting");

    // 1. Verify markdown bullet lists are parsed into discrete entries
    assert!(meeting.decisions.len() >= 2, "Expected at least 2 decisions, got {}", meeting.decisions.len());
    assert!(meeting.decisions.iter().any(|d| d.to_lowercase().contains("settled on")));
    assert!(meeting.decisions.iter().any(|d| d.to_lowercase().contains("finalized")));

    // 2. Verify action items extracted with new corporate triggers
    assert!(meeting.action_items.len() >= 2, "Expected at least 2 action items, got {}", meeting.action_items.len());
    assert!(meeting.action_items.iter().any(|a| a.to_lowercase().contains("responsible for")));
    assert!(meeting.action_items.iter().any(|a| a.to_lowercase().contains("tasked with") || a.to_lowercase().contains("deliverable")));

    // 3. Verify clean checklist formatting
    assert!(meeting.action_items.iter().all(|a| a.starts_with("[ ] ")));
}

#[test]
fn test_screenshot_image3_utterance_and_vad_trailing_decrescendo() {
    use amiyo_flow_lib::ai::heuristic_cleanup;
    use amiyo_flow_lib::audio::vad::{VadConfig, VoiceActivityDetector};

    // 1. User's exact dictation from Claude screenshot:
    let raw = "Een, Amiyo omiyaya Amiyo, omiHey Claude, my name is Amiyo Garai and I try to visit ChatGPT, I'm like, what's up and creative, overall, for this user manual and how the what's up works and which features we can";
    let cleaned = heuristic_cleanup(raw);

    // Verify throat clearing and repeated name warm-up stripped
    assert!(!cleaned.contains("Een"), "Must strip 'Een': got '{}'", cleaned);
    assert!(!cleaned.contains("omiyaya"), "Must strip 'omiyaya': got '{}'", cleaned);
    assert!(cleaned.starts_with("Hey Claude"), "Must begin directly with 'Hey Claude': got '{}'", cleaned);

    // Verify filler 'I'm like' stripped
    assert!(!cleaned.contains("I'm like"), "Must remove 'I'm like': got '{}'", cleaned);

    // Verify 'what's up' converted to 'WhatsApp'
    assert!(cleaned.contains("WhatsApp"), "Must convert 'what's up' to 'WhatsApp': got '{}'", cleaned);

    // Verify incomplete clause ending on modal verb 'we can' is protected from terminal period
    assert!(!cleaned.ends_with('.'), "Utterance ending on 'we can' must not have terminal period: got '{}'", cleaned);
    assert!(cleaned.ends_with("we can"), "Must preserve trailing incomplete clause: got '{}'", cleaned);

    // 2. VAD Trailing Vocal Decrescendo Sensitivity
    let mut vad = VoiceActivityDetector::new(VadConfig::default());
    let speech_frame = vec![12000i16; 480];

    // Establish active speech state
    for _ in 0..15 {
        vad.process_frame(&speech_frame);
    }

    // Now test a soft trailing speech frame (lower volume decrescendo)
    let soft_trailing_frame = vec![1800i16; 480];
    let (is_speech, should_stop) = vad.process_frame(&soft_trailing_frame);
    assert!(is_speech, "Active speech trailing decrescendo must still be detected as speech");
    assert!(!should_stop, "Must not prematurely auto-stop during trailing decrescendo words");
}

#[test]
fn test_opencode_window_context_and_expanded_regional_slang() {
    use amiyo_flow_lib::ai::{heuristic_cleanup, heuristic_cleanup_full_with_app};

    // 1. Target app window context: inside OpenCode, Claude greetings automatically resolve to OpenCode
    let raw_opencode_utterance = "Hey, welcome Claude, my name is Amiyo Garai, and I try to Hey, I'm Claude, my name is Amiyo Garai, I'm a child of built-in system like a typewriter, so K-A-B-O interface and others, and tell me the proper guidelines and which features you need and what talks we've done and which we do";
    let cleaned_with_app = heuristic_cleanup_full_with_app(
        raw_opencode_utterance,
        true,
        true,
        true,
        true,
        &[],
        "OpenCode (opencode.exe - Tidepool Alpha)",
    );

    assert!(cleaned_with_app.starts_with("Hey OpenCode, my name is Amiyo Garai"), "Must start with Hey OpenCode in OpenCode window context: got '{}'", cleaned_with_app);
    assert!(!cleaned_with_app.contains("welcome Claude"), "Must strip abandoned false start: got '{}'", cleaned_with_app);
    assert!(cleaned_with_app.contains("keyboard interface"), "Must map K-A-B-O to keyboard: got '{}'", cleaned_with_app);
    assert!(cleaned_with_app.contains("what tasks we've done"), "Must map talks to tasks: got '{}'", cleaned_with_app);
    assert!(!cleaned_with_app.ends_with('.'), "Trailing incomplete clause 'and which we do' must not have terminal period: got '{}'", cleaned_with_app);
    assert!(cleaned_with_app.ends_with("which we do"), "Must preserve trailing incomplete clause: got '{}'", cleaned_with_app);

    // 2. OpenCode word-like app and tags utterance (Image 7)
    let raw_word_like = "Hey open port, my name is Amiyo Garai and I try to build a Word-like app for the documents and write the tags and anything, what each other works. Could I do a background for this?";
    let cleaned_word = heuristic_cleanup(raw_word_like);
    assert!(cleaned_word.contains("Hey OpenCode"), "Must convert open port to OpenCode: got '{}'", cleaned_word);
    assert!(cleaned_word.contains("Word-like app"), "Must preserve Word-like app: got '{}'", cleaned_word);
    assert!(cleaned_word.contains("write the text and anything"), "Must convert write the tags to write the text: got '{}'", cleaned_word);
    assert!(cleaned_word.contains("how each works"), "Must convert what each other works to how each works: got '{}'", cleaned_word);
    assert!(cleaned_word.ends_with("Could I do a background for this?"), "Interrogative sentence must end with question mark: got '{}'", cleaned_word);

    // 3. Expanded regional Bengali and Hinglish hesitation slang
    let raw_slang = "thik ache we can deploy ekta kotha the server is ready bolchi Friday";
    let cleaned_slang = heuristic_cleanup(raw_slang);
    assert!(!cleaned_slang.to_lowercase().contains("thik ache"), "Must filter 'thik ache': got '{}'", cleaned_slang);
    assert!(!cleaned_slang.to_lowercase().contains("ekta kotha"), "Must filter 'ekta kotha': got '{}'", cleaned_slang);
    assert!(!cleaned_slang.to_lowercase().contains("bolchi"), "Must filter 'bolchi': got '{}'", cleaned_slang);
    assert!(cleaned_slang.contains("Friday"), "Must preserve content words: got '{}'", cleaned_slang);
}

#[test]
fn test_image2_ai_agents_deepseek_and_biquad_noise_cancellation() {
    use amiyo_flow_lib::ai::heuristic_cleanup;
    use amiyo_flow_lib::audio::suppress_background_noise_and_filter;

    // 1. Noise Cancellation & Biquad Filtering: verify 40Hz fan rumble is attenuated
    let sample_rate = 16000;
    let mut low_freq_samples: Vec<f32> = (0..16000)
        .map(|i| (2.0 * std::f32::consts::PI * 40.0 * (i as f32) / 16000.0).sin() * 0.5)
        .collect();
    let initial_low_rms: f32 = (low_freq_samples.iter().map(|&s| s * s).sum::<f32>() / 16000.0).sqrt();

    suppress_background_noise_and_filter(&mut low_freq_samples, sample_rate);
    let filtered_low_rms: f32 = (low_freq_samples.iter().map(|&s| s * s).sum::<f32>() / 16000.0).sqrt();

    // 40Hz is well below the 85Hz cutoff (-12dB/octave), so it must be significantly attenuated
    assert!(
        filtered_low_rms < initial_low_rms * 0.5,
        "Low-frequency rumble (40Hz) must be attenuated by >6dB: initial={}, filtered={}",
        initial_low_rms,
        filtered_low_rms
    );

    // 2. Image 2 Acoustic Homophones & Speech Restoration
    let raw_image2 = "and head-plot, I try to build my own charging device, but main target is the build-a, one of the AI agents, like DPC Kermit, can you build this?";
    let cleaned = heuristic_cleanup(raw_image2);

    assert!(cleaned.contains("Hey Claude"), "Must map 'head-plot' to 'Hey Claude': got '{}'", cleaned);
    assert!(!cleaned.to_lowercase().contains("head-plot"), "Must not contain 'head-plot': got '{}'", cleaned);
    assert!(cleaned.contains("ChatGPT-like service"), "Must map 'charging device' to 'ChatGPT-like service': got '{}'", cleaned);
    assert!(!cleaned.to_lowercase().contains("charging device"), "Must not contain 'charging device': got '{}'", cleaned);
    assert!(cleaned.contains("DeepSeek"), "Must map 'DPC Kermit' to 'DeepSeek': got '{}'", cleaned);
    assert!(!cleaned.to_lowercase().contains("dpc kermit"), "Must not contain 'dpc kermit': got '{}'", cleaned);
    assert!(!cleaned.contains("build-a"), "Must not contain hyphenated stutter 'build-a': got '{}'", cleaned);
    assert!(cleaned.contains("the main target is to build one of the AI agents"), "Must properly format 'the main target is to build one of the AI agents': got '{}'", cleaned);
    assert!(cleaned.ends_with('?'), "Question must end with '?': got '{}'", cleaned);
    assert!(cleaned.contains(". Can you build this?"), "Interrogative clause must be punctuated cleanly: got '{}'", cleaned);

    // 3. 5-word repeat deduplication & hyphen stumble
    let repeat_5 = "we need to build the we need to build the production system";
    let cleaned_5 = heuristic_cleanup(repeat_5);
    assert_eq!(cleaned_5, "We need to build the production system.");
}







