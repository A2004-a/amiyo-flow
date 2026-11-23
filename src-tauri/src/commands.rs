use crate::ai;
use crate::audio;
use crate::db::{AnalyticsSummary, DictionaryItem, HistoryItem, MeetingItem, SnippetItem};
use crate::input::{self, ForegroundWindowInfo};
use crate::stt;
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RecordingStateResponse {
    pub is_recording: bool,
    pub is_paused: bool,
    pub is_processing: bool,
    pub target_app: String,
    pub target_title: String,
    pub duration_ms: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DictationResult {
    pub success: bool,
    pub raw_text: String,
    pub cleaned_text: String,
    pub duration_ms: u64,
    pub word_count: usize,
    pub target_app: String,
    pub error: Option<String>,
}

#[tauri::command]
pub fn get_audio_devices(state: State<'_, AppState>) -> Vec<audio::AudioDeviceInfo> {
    state.audio.list_devices()
}

#[tauri::command]
pub fn set_audio_device(device_name: Option<String>, state: State<'_, AppState>) {
    state.audio.set_device(device_name);
}

#[tauri::command]
pub fn get_foreground_window() -> Option<ForegroundWindowInfo> {
    input::get_foreground_window()
}

#[tauri::command]
pub fn get_recording_state(state: State<'_, AppState>) -> RecordingStateResponse {
    let mut is_rec = state.audio.is_recording();
    let is_pau = state.audio.is_paused();
    let is_proc = state.is_processing.load(Ordering::SeqCst);
    let app_name = state.target_app_name.lock().clone();
    let app_title = state.target_app_title.lock().clone();
    let mut duration = state
        .recording_start
        .lock()
        .map(|s| s.elapsed().as_millis() as u64)
        .unwrap_or(0);

    // Auto-recover from stale/zombie recordings (> 10 minutes without completion)
    if is_rec && duration > 600_000 {
        state.audio.cancel();
        *state.recording_start.lock() = None;
        is_rec = false;
        duration = 0;
    }

    RecordingStateResponse {
        is_recording: is_rec,
        is_paused: is_pau,
        is_processing: is_proc,
        target_app: app_name,
        target_title: app_title,
        duration_ms: duration,
    }
}

#[tauri::command]
pub async fn start_recording(app_handle: AppHandle, state: State<'_, AppState>) -> Result<ForegroundWindowInfo, String> {
    // If previous recording is still marked active, clear it first
    if state.audio.is_recording() {
        state.audio.cancel();
        *state.recording_start.lock() = None;
    }

    if let Some(fg) = input::get_foreground_window() {
        let is_amiyo = fg.process_name.to_lowercase().contains("amiyo") 
            || fg.title.to_lowercase().contains("amiyo")
            || fg.title.to_lowercase().contains("pill");

        if !is_amiyo && fg.hwnd != 0 {
            *state.target_hwnd.lock() = fg.hwnd;
            *state.target_app_name.lock() = fg.process_name;
            *state.target_app_title.lock() = fg.title;
        }
    }
    *state.recording_start.lock() = Some(Instant::now());

    if let Err(e) = state.audio.start_recording(app_handle.clone()) {
        let _ = app_handle.emit("amiyo-dictation-failed", &e);
        let pill_h = app_handle.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
            if let Some(pill_window) = pill_h.get_webview_window("pill") {
                let _ = pill_window.hide();
            }
        });
        return Err(e);
    }

    if let Some(pill_window) = app_handle.get_webview_window("pill") {
        let pill_w = 440.0;
        let pill_h = 78.0;
        let _ = pill_window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: pill_w,
            height: pill_h,
        }));
        if let Ok(Some(monitor)) = pill_window.primary_monitor() {
            let screen_size = monitor.size();
            let scale_factor = monitor.scale_factor();
            let screen_w = screen_size.width as f64 / scale_factor;
            let screen_h = screen_size.height as f64 / scale_factor;
            let pos_x = (screen_w - pill_w) / 2.0;
            let pos_y = (screen_h - pill_h - 70.0).max(10.0);
            let _ = pill_window.set_position(tauri::Position::Logical(tauri::LogicalPosition {
                x: pos_x,
                y: pos_y,
            }));
        }
        let _ = pill_window.show();
    }

    let active_info = ForegroundWindowInfo {
        hwnd: *state.target_hwnd.lock(),
        process_name: state.target_app_name.lock().clone(),
        title: state.target_app_title.lock().clone(),
    };

    let _ = app_handle.emit("amiyo-recording-started", &active_info);

    Ok(active_info)
}

#[tauri::command]
pub fn pause_recording(app_handle: AppHandle, state: State<'_, AppState>) {
    state.audio.pause();
    let _ = app_handle.emit("amiyo-recording-paused", ());
}

#[tauri::command]
pub fn resume_recording(app_handle: AppHandle, state: State<'_, AppState>) {
    state.audio.resume();
    let _ = app_handle.emit("amiyo-recording-resumed", ());
}

#[tauri::command]
pub fn cancel_recording(app_handle: AppHandle, state: State<'_, AppState>) {
    state.audio.cancel();
    *state.recording_start.lock() = None;
    state.is_processing.store(false, Ordering::SeqCst);

    if let Some(pill_window) = app_handle.get_webview_window("pill") {
        let _ = pill_window.hide();
    }

    let _ = app_handle.emit("amiyo-recording-cancelled", ());
}

#[tauri::command]
pub async fn stop_recording_and_insert(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<DictationResult, String> {
    let duration_ms = state
        .recording_start
        .lock()
        .map(|s| s.elapsed().as_millis() as u64)
        .unwrap_or(0);
    *state.recording_start.lock() = None;

    state.is_processing.store(true, Ordering::SeqCst);
    let _ = app_handle.emit("amiyo-processing-started", ());

    let (wav_bytes, _samples) = match state.audio.stop_recording() {
        Ok(res) => res,
        Err(e) => {
            state.is_processing.store(false, Ordering::SeqCst);
            if e == "Not currently recording" {
                if let Some(pill_window) = app_handle.get_webview_window("pill") {
                    let _ = pill_window.hide();
                }
                return Ok(DictationResult {
                    success: true,
                    raw_text: String::new(),
                    cleaned_text: String::new(),
                    duration_ms: 0,
                    word_count: 0,
                    target_app: state.target_app_name.lock().clone(),
                    error: None,
                });
            }
            let _ = app_handle.emit("amiyo-dictation-failed", &e);
            let pill_h = app_handle.clone();
            tokio::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
                if let Some(pill_window) = pill_h.get_webview_window("pill") {
                    let _ = pill_window.hide();
                }
            });
            return Err(e);
        }
    };

    // If audio buffer was empty or shorter than 50ms of audio, finish cleanly without error
    if wav_bytes.is_empty() || _samples < 800 {
        state.is_processing.store(false, Ordering::SeqCst);
        if let Some(pill_window) = app_handle.get_webview_window("pill") {
            let _ = pill_window.hide();
        }
        let res = DictationResult {
            success: true,
            raw_text: String::new(),
            cleaned_text: String::new(),
            duration_ms,
            word_count: 0,
            target_app: state.target_app_name.lock().clone(),
            error: None,
        };
        let _ = app_handle.emit("amiyo-dictation-completed", &res);
        return Ok(res);
    }

    let mut target_hwnd = *state.target_hwnd.lock();
    let mut target_app = state.target_app_name.lock().clone();
    let mut target_title = state.target_app_title.lock().clone();

    // Check if user is currently focused on an external application right now (e.g. Claude, Antigravity, etc.)
    if let Some(fg) = input::get_foreground_window() {
        let is_amiyo = fg.process_name.to_lowercase().contains("amiyo") 
            || fg.title.to_lowercase().contains("amiyo")
            || fg.title.to_lowercase().contains("pill");
        if !is_amiyo && fg.hwnd != 0 {
            target_hwnd = fg.hwnd;
            target_app = fg.process_name;
            target_title = fg.title;
        }
    }

    let settings = state.db.get_all_settings().unwrap_or_default();
    let local_stt_model = settings.get("local_stt_model").cloned().unwrap_or_else(|| "base.en".to_string());
    let _local_llm_model = settings.get("local_llm_model").cloned().unwrap_or_else(|| "heuristic-rule-engine".to_string());
    let custom_stt_path = settings.get("custom_stt_path").cloned();
    let _custom_llm_path = settings.get("custom_llm_path").cloned();
    let style = settings.get("style").cloned().unwrap_or_else(|| "Professional".to_string());
    let language = settings.get("language").cloned().unwrap_or_else(|| "auto".to_string());
    let auto_insert = settings.get("auto_insert").map(|v| v == "true").unwrap_or(true);
    let use_clipboard = settings.get("use_clipboard").map(|v| v == "true").unwrap_or(true);
    let restore_delay_ms: u64 = settings
        .get("restore_clipboard_delay_ms")
        .and_then(|v| v.parse().ok())
        .unwrap_or(35);

    let dictionary = state.db.get_dictionary().unwrap_or_default();
    let snippets = state.db.get_snippets().unwrap_or_default();

    let dict_prompt = dictionary
        .iter()
        .map(|d| d.word.as_str())
        .collect::<Vec<_>>()
        .join(", ");

    let router_config = if let Some(json_str) = state.db.get_setting("ai_router_config") {
        serde_json::from_str::<ai::router::AiRouterConfig>(&json_str).unwrap_or_default()
    } else {
        ai::router::AiRouterConfig::default()
    };

    // Check if Cloud/Hybrid mode is enabled and a cloud speech provider is configured
    let mut cloud_transcription: Option<String> = None;
    if router_config.mode != ai::router::AiOperatingMode::Local {
        let provider_id = if crate::security::CredentialManager::has_key("groq") {
            "groq"
        } else if crate::security::CredentialManager::has_key("openai") {
            "openai"
        } else {
            ""
        };

        if !provider_id.is_empty() {
            if let Ok(Some(key)) = crate::security::CredentialManager::get_key(provider_id) {
                if !key.trim().is_empty() {
                    let start = Instant::now();
                    match ai::providers::CloudAIClient::transcribe_audio(
                        provider_id,
                        &key,
                        wav_bytes.clone(),
                        Some(&language),
                        Some(&dict_prompt),
                    ).await {
                        Ok(t) if !t.is_empty() => {
                            state.auditor.record_event(
                                &format!("Cloud Whisper ({})", provider_id),
                                false,
                                "Speech Recognition",
                                "Success",
                                start.elapsed().as_millis() as u64,
                                t.split_whitespace().count(),
                            );
                            cloud_transcription = Some(t);
                        }
                        Err(e) => {
                            state.auditor.record_event(
                                &format!("Cloud Whisper ({})", provider_id),
                                false,
                                "Speech Recognition",
                                &format!("Fallback to local: {}", e),
                                start.elapsed().as_millis() as u64,
                                0,
                            );
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    let raw_text = if let Some(ct) = cloud_transcription {
        ct
    } else {
        match stt::transcribe_audio(
            &local_stt_model,
            custom_stt_path.as_deref(),
            wav_bytes,
            Some(&language),
            Some(&dict_prompt),
        )
        .await
        {
            Ok(t) => t,
            Err(e) => {
                state.is_processing.store(false, Ordering::SeqCst);
                let _ = app_handle.emit("amiyo-dictation-failed", &e);
                let pill_h = app_handle.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
                    if let Some(pill_window) = pill_h.get_webview_window("pill") {
                        let _ = pill_window.hide();
                    }
                });
                return Err(format!("Local transcription failed: {}", e));
            }
        }
    };

    let cleaned_text = match ai::clean_transcript_routed(
        &router_config,
        &raw_text,
        &style,
        &format!("{} ({})", target_app, target_title),
        &dictionary,
        &snippets,
        &state.auditor,
    )
    .await
    {
        Ok(t) => t,
        Err(_) => raw_text.clone(),
    };

    let word_count = cleaned_text.split_whitespace().count();

    // First hide the pill window so Windows returns focus directly to the target application
    if let Some(pill) = app_handle.get_webview_window("pill") {
        let _ = pill.hide();
    }

    let mut insertion_error = None;
    if auto_insert && !cleaned_text.is_empty() {
        let _ = app_handle.emit("amiyo-inserting-text", &cleaned_text);
        if let Err(e) = input::insert_text(target_hwnd, &cleaned_text, use_clipboard, restore_delay_ms) {
            eprintln!("Direct text insertion error: {}", e);
            insertion_error = Some(e);
        }
    }

    let hist_item = HistoryItem {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        duration_ms: duration_ms as i64,
        raw_text: raw_text.clone(),
        cleaned_text: cleaned_text.clone(),
        target_app: target_app.clone(),
        word_count: word_count as i64,
        style: style.clone(),
        provider: local_stt_model.clone(),
    };
    let _ = state.db.add_history(hist_item);

    state.is_processing.store(false, Ordering::SeqCst);

    let res = DictationResult {
        success: insertion_error.is_none(),
        raw_text,
        cleaned_text,
        duration_ms,
        word_count,
        target_app,
        error: insertion_error,
    };

    let _ = app_handle.emit("amiyo-dictation-completed", &res);

    let pill_handle = app_handle.clone();
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;
        if let Some(pill) = pill_handle.get_webview_window("pill") {
            let _ = pill.hide();
        }
    });

    Ok(res)
}

#[tauri::command]
pub fn test_insert_text(text: String, use_clipboard: bool) -> Result<(), String> {
    let fg = input::get_foreground_window().map(|f| f.hwnd).unwrap_or(0);
    input::insert_text(fg, &text, use_clipboard, 350)
}

#[tauri::command]
pub async fn transcribe_and_clean(
    raw_text: String,
    style: String,
    target_app: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let router_config = if let Some(json_str) = state.db.get_setting("ai_router_config") {
        serde_json::from_str::<ai::router::AiRouterConfig>(&json_str).unwrap_or_default()
    } else {
        ai::router::AiRouterConfig::default()
    };

    let dict = state.db.get_dictionary().unwrap_or_default();
    let snips = state.db.get_snippets().unwrap_or_default();

    ai::clean_transcript_routed(
        &router_config,
        &raw_text,
        &style,
        &target_app,
        &dict,
        &snips,
        &state.auditor,
    )
    .await
}

#[tauri::command]
pub fn get_history(limit: Option<i64>, state: State<'_, AppState>) -> Result<Vec<HistoryItem>, String> {
    state.db.get_history(limit.unwrap_or(100)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_history_item(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_history_item(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_all_history(state: State<'_, AppState>) -> Result<(), String> {
    state.db.clear_history().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_dictionary(state: State<'_, AppState>) -> Result<Vec<DictionaryItem>, String> {
    state.db.get_dictionary().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_dictionary_word(word: String, replacement: String, category: String, state: State<'_, AppState>) -> Result<DictionaryItem, String> {
    state.db.add_dictionary_word(&word, &replacement, &category).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_dictionary_word(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_dictionary_word(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_snippets(state: State<'_, AppState>) -> Result<Vec<SnippetItem>, String> {
    state.db.get_snippets().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_snippet(trigger: String, expansion: String, description: String, state: State<'_, AppState>) -> Result<SnippetItem, String> {
    state.db.add_snippet(&trigger, &expansion, &description).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_snippet(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_snippet(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<HashMap<String, String>, String> {
    state.db.get_all_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(app_handle: AppHandle, settings: HashMap<String, String>, state: State<'_, AppState>) -> Result<(), String> {
    for (k, v) in &settings {
        state.db.set_setting(k, v).map_err(|e| e.to_string())?;
    }
    if let Some(new_hotkey) = settings.get("hotkey") {
        use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
        let _ = app_handle.global_shortcut().unregister_all();
        if let Ok(shortcut) = new_hotkey.parse::<Shortcut>() {
            let _ = app_handle.global_shortcut().register(shortcut);
        }
        if new_hotkey != "Control+Space" {
            if let Ok(ctrl_space) = "Control+Space".parse::<Shortcut>() {
                let _ = app_handle.global_shortcut().register(ctrl_space);
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_analytics(state: State<'_, AppState>) -> Result<AnalyticsSummary, String> {
    state.db.get_analytics().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_meetings(state: State<'_, AppState>) -> Result<Vec<MeetingItem>, String> {
    state.db.get_meetings().map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OfflineSystemStatus {
    pub is_offline_ready: bool,
    pub active_stt_engine: String,
    pub active_llm_engine: String,
    pub vad_enabled: bool,
    pub memory_allocated_mb: u32,
    pub cpu_threads: usize,
    pub metal_or_cuda_available: bool,
}

#[tauri::command]
pub fn list_local_speech_models() -> Vec<stt::LocalSpeechModelInfo> {
    stt::list_local_speech_models()
}

#[tauri::command]
pub fn list_local_llm_models() -> Vec<ai::LocalLlmModelInfo> {
    ai::list_local_llm_models()
}

#[tauri::command]
pub fn get_offline_system_status(state: State<'_, AppState>) -> OfflineSystemStatus {
    let settings = state.db.get_all_settings().unwrap_or_default();
    let stt = settings.get("local_stt_model").cloned().unwrap_or_else(|| "base.en".to_string());
    let llm = settings.get("local_llm_model").cloned().unwrap_or_else(|| "heuristic-rule-engine".to_string());

    OfflineSystemStatus {
        is_offline_ready: true,
        active_stt_engine: format!("whisper.cpp ({})", stt),
        active_llm_engine: if llm == "heuristic-rule-engine" {
            "Zero-RAM Local Rule Engine".to_string()
        } else {
            format!("llama.cpp ({})", llm)
        },
        vad_enabled: true,
        memory_allocated_mb: if llm == "heuristic-rule-engine" { 145 } else { 480 },
        cpu_threads: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4),
        metal_or_cuda_available: cfg!(target_os = "macos"),
    }
}

#[tauri::command]
pub async fn process_meeting_recording(
    title: String,
    transcript: String,
    duration_sec: i64,
    state: State<'_, AppState>,
) -> Result<MeetingItem, String> {
    let mut meeting = ai::generate_meeting_summary(&transcript).await?;
    meeting.title = title;
    meeting.duration_sec = duration_sec;

    state.db.add_meeting(meeting.clone()).map_err(|e| e.to_string())?;
    Ok(meeting)
}

#[tauri::command]
pub fn delete_meeting(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_meeting(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_pill_window(app_handle: AppHandle) {
    if let Some(pill) = app_handle.get_webview_window("pill") {
        if pill.is_visible().unwrap_or(false) {
            let _ = pill.hide();
        } else {
            let _ = pill.show();
        }
    }
}

#[tauri::command]
pub fn toggle_main_window(app_handle: AppHandle) {
    if let Some(main) = app_handle.get_webview_window("main") {
        if main.is_visible().unwrap_or(false) {
            let _ = main.hide();
        } else {
            let _ = main.show();
            let _ = main.set_focus();
        }
    }
}

#[tauri::command]
pub fn window_minimize(app_handle: AppHandle) {
    if let Some(main) = app_handle.get_webview_window("main") {
        let _ = main.minimize();
    }
}

#[tauri::command]
pub fn window_toggle_maximize(app_handle: AppHandle) -> bool {
    if let Some(main) = app_handle.get_webview_window("main") {
        if let Ok(is_max) = main.is_maximized() {
            if is_max {
                let _ = main.unmaximize();
                return false;
            } else {
                let _ = main.maximize();
                return true;
            }
        }
    }
    false
}

#[tauri::command]
pub fn window_close(app_handle: AppHandle) {
    if let Some(main) = app_handle.get_webview_window("main") {
        let _ = main.hide();
    }
}

#[tauri::command]
pub async fn check_ollama_status(endpoint: Option<String>) -> ai::ollama::OllamaStatus {
    let ep = endpoint.unwrap_or_else(|| "http://localhost:11434".to_string());
    ai::ollama::OllamaClient::check_status(&ep).await
}

#[tauri::command]
pub async fn list_ollama_models(endpoint: Option<String>) -> Result<Vec<ai::ollama::OllamaModelItem>, String> {
    let ep = endpoint.unwrap_or_else(|| "http://localhost:11434".to_string());
    ai::ollama::OllamaClient::list_installed_models(&ep).await
}

#[tauri::command]
pub fn list_cloud_providers() -> Vec<ai::providers::CloudProviderMeta> {
    ai::providers::list_supported_cloud_providers()
}

#[tauri::command]
pub fn set_cloud_api_key(provider_id: String, api_key: String) -> Result<(), String> {
    crate::security::CredentialManager::set_key(&provider_id, &api_key)
}

#[tauri::command]
pub fn delete_cloud_api_key(provider_id: String) -> Result<(), String> {
    crate::security::CredentialManager::delete_key(&provider_id)
}

#[tauri::command]
pub fn has_cloud_api_key(provider_id: String) -> bool {
    crate::security::CredentialManager::has_key(&provider_id)
}

#[tauri::command]
pub async fn test_cloud_provider(
    provider_id: String,
    custom_endpoint: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let api_key = match crate::security::CredentialManager::get_key(&provider_id)? {
        Some(k) if !k.trim().is_empty() => k,
        _ => return Err("No API key configured for this provider in OS secure keychain".to_string()),
    };

    let start = Instant::now();
    let res = ai::providers::CloudAIClient::test_connection(&provider_id, &api_key, custom_endpoint.as_deref()).await;
    let latency = start.elapsed().as_millis() as u64;

    match &res {
        Ok(_) => {
            state.auditor.record_event(
                &format!("Cloud ({})", provider_id),
                false,
                "API Key Connection Test",
                "Success",
                latency,
                0,
            );
        }
        Err(err) => {
            state.auditor.record_event(
                &format!("Cloud ({})", provider_id),
                false,
                "API Key Connection Test",
                &format!("Error: {}", err),
                latency,
                0,
            );
        }
    }

    res
}

#[tauri::command]
pub fn get_ai_router_config(state: State<'_, AppState>) -> Result<ai::router::AiRouterConfig, String> {
    if let Some(json_str) = state.db.get_setting("ai_router_config") {
        if let Ok(cfg) = serde_json::from_str::<ai::router::AiRouterConfig>(&json_str) {
            return Ok(cfg);
        }
    }
    Ok(ai::router::AiRouterConfig::default())
}

#[tauri::command]
pub fn save_ai_router_config(config: ai::router::AiRouterConfig, state: State<'_, AppState>) -> Result<(), String> {
    let json_str = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    state.db.set_setting("ai_router_config", &json_str).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_network_audit_events(limit: Option<usize>, state: State<'_, AppState>) -> Vec<crate::security::network_audit::NetworkAuditEvent> {
    state.auditor.get_recent_events(limit.unwrap_or(100))
}

#[tauri::command]
pub fn clear_network_audit_events(state: State<'_, AppState>) {
    state.auditor.clear_events();
}

#[tauri::command]
pub fn hide_pill_window(app_handle: AppHandle, state: State<'_, AppState>) {
    state.audio.cancel();
    *state.recording_start.lock() = None;
    state.is_processing.store(false, Ordering::SeqCst);
    if let Some(pill) = app_handle.get_webview_window("pill") {
        let _ = pill.hide();
    }
    let _ = app_handle.emit("amiyo-recording-cancelled", ());
}

#[tauri::command]
pub fn show_pill_window(app_handle: AppHandle) {
    if let Some(pill) = app_handle.get_webview_window("pill") {
        let _ = pill.show();
    }
}

#[tauri::command]
pub fn reset_pill_position(app_handle: AppHandle) {
    if let Some(pill_window) = app_handle.get_webview_window("pill") {
        let pill_w = 440.0;
        let pill_h = 78.0;
        let _ = pill_window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: pill_w,
            height: pill_h,
        }));
        if let Ok(Some(monitor)) = pill_window.primary_monitor() {
            let screen_size = monitor.size();
            let scale_factor = monitor.scale_factor();
            let screen_w = screen_size.width as f64 / scale_factor;
            let screen_h = screen_size.height as f64 / scale_factor;
            let pos_x = (screen_w - pill_w) / 2.0;
            let pos_y = (screen_h - pill_h - 70.0).max(10.0);
            let _ = pill_window.set_position(tauri::Position::Logical(tauri::LogicalPosition {
                x: pos_x,
                y: pos_y,
            }));
        }
    }
}

#[tauri::command]
pub async fn download_speech_model(model_id: String) -> Result<String, String> {
    stt::download_speech_model(&model_id).await
}
