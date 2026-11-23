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
    let is_rec = state.audio.is_recording();
    let is_pau = state.audio.is_paused();
    let is_proc = state.is_processing.load(Ordering::SeqCst);
    let app_name = state.target_app_name.lock().clone();
    let app_title = state.target_app_title.lock().clone();
    let duration = state
        .recording_start
        .lock()
        .map(|s| s.elapsed().as_millis() as u64)
        .unwrap_or(0);

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
    let fg_info = input::get_foreground_window().unwrap_or(ForegroundWindowInfo {
        hwnd: 0,
        title: "Active Application".to_string(),
        process_name: "unknown.exe".to_string(),
    });

    *state.target_hwnd.lock() = fg_info.hwnd;
    *state.target_app_name.lock() = fg_info.process_name.clone();
    *state.target_app_title.lock() = fg_info.title.clone();
    *state.recording_start.lock() = Some(Instant::now());

    state.audio.start_recording(app_handle.clone())?;

    if let Some(pill_window) = app_handle.get_webview_window("pill") {
        let _ = pill_window.show();
    }

    let _ = app_handle.emit("amiyo-recording-started", &fg_info);

    Ok(fg_info)
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
            if let Some(pill_window) = app_handle.get_webview_window("pill") {
                let _ = pill_window.hide();
            }
            return Err(e);
        }
    };

    let target_hwnd = *state.target_hwnd.lock();
    let target_app = state.target_app_name.lock().clone();
    let target_title = state.target_app_title.lock().clone();

    let settings = state.db.get_all_settings().unwrap_or_default();
    let stt_provider = settings.get("stt_provider").cloned().unwrap_or_else(|| "groq".to_string());
    let ai_provider = settings.get("ai_provider").cloned().unwrap_or_else(|| "groq".to_string());
    let groq_key = settings.get("groq_api_key").cloned().unwrap_or_default();
    let openai_key = settings.get("openai_api_key").cloned().unwrap_or_default();
    let anthropic_key = settings.get("anthropic_api_key").cloned().unwrap_or_default();
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

    let stt_key = match stt_provider.as_str() {
        "groq" => &groq_key,
        "openai" => &openai_key,
        _ => &groq_key,
    };

    let raw_text = match stt::transcribe_audio(
        &stt_provider,
        stt_key,
        wav_bytes,
        Some(&language),
        Some(&dict_prompt),
    )
    .await
    {
        Ok(t) => t,
        Err(e) => {
            state.is_processing.store(false, Ordering::SeqCst);
            if let Some(pill_window) = app_handle.get_webview_window("pill") {
                let _ = pill_window.hide();
            }
            return Err(format!("Transcription failed: {}", e));
        }
    };

    let ai_key = match ai_provider.as_str() {
        "groq" => &groq_key,
        "openai" => &openai_key,
        "anthropic" => &anthropic_key,
        _ => &groq_key,
    };

    let cleaned_text = match ai::clean_transcript(
        &ai_provider,
        ai_key,
        &raw_text,
        &style,
        &format!("{} ({})", target_app, target_title),
        &dictionary,
        &snippets,
    )
    .await
    {
        Ok(t) => t,
        Err(_) => raw_text.clone(),
    };

    let word_count = cleaned_text.split_whitespace().count();

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
        provider: stt_provider.clone(),
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
    input::insert_text(fg, &text, use_clipboard, 35)
}

#[tauri::command]
pub async fn transcribe_and_clean(
    raw_text: String,
    style: String,
    target_app: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let settings = state.db.get_all_settings().unwrap_or_default();
    let ai_provider = settings.get("ai_provider").cloned().unwrap_or_else(|| "groq".to_string());
    let groq_key = settings.get("groq_api_key").cloned().unwrap_or_default();
    let openai_key = settings.get("openai_api_key").cloned().unwrap_or_default();
    let anthropic_key = settings.get("anthropic_api_key").cloned().unwrap_or_default();

    let ai_key = match ai_provider.as_str() {
        "groq" => &groq_key,
        "openai" => &openai_key,
        "anthropic" => &anthropic_key,
        _ => &groq_key,
    };

    let dict = state.db.get_dictionary().unwrap_or_default();
    let snips = state.db.get_snippets().unwrap_or_default();

    ai::clean_transcript(
        &ai_provider,
        ai_key,
        &raw_text,
        &style,
        &target_app,
        &dict,
        &snips,
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
pub fn save_settings(settings: HashMap<String, String>, state: State<'_, AppState>) -> Result<(), String> {
    for (k, v) in settings {
        state.db.set_setting(&k, &v).map_err(|e| e.to_string())?;
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

#[tauri::command]
pub async fn process_meeting_recording(
    title: String,
    transcript: String,
    duration_sec: i64,
    state: State<'_, AppState>,
) -> Result<MeetingItem, String> {
    let settings = state.db.get_all_settings().unwrap_or_default();
    let groq_key = settings.get("groq_api_key").cloned().unwrap_or_default();

    let (summary, decisions, action_items) = ai::generate_meeting_summary(&groq_key, &transcript).await?;

    let meeting = MeetingItem {
        id: uuid::Uuid::new_v4().to_string(),
        title,
        timestamp: chrono::Utc::now().to_rfc3339(),
        duration_sec,
        transcript,
        summary,
        decisions,
        action_items,
    };

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
