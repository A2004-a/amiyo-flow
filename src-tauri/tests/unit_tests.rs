use amiyo_flow_lib::ai::{apply_dictionary, apply_snippets, heuristic_cleanup};
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

    // High energy alternating wave
    let mut speech = Vec::with_capacity(480);
    for i in 0..480 {
        speech.push(if i % 4 < 2 { 18000i16 } else { -18000i16 });
    }
    let (is_speech, _) = vad.process_frame(&speech);
    assert!(is_speech, "High energy wave should trigger speech classification");

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

    let casual = apply_style_formatting("See you later.", "Casual", "");
    assert_eq!(casual, "See you later");

    let prompt = apply_style_formatting("Write a rust function", "AI Prompt", "");
    assert!(prompt.starts_with("Instructions: "));

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
