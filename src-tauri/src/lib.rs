pub mod ai;
pub mod audio;
pub mod commands;
pub mod db;
pub mod input;
pub mod security;
pub mod stt;

use audio::AudioEngine;
use db::Database;
use parking_lot::Mutex;
use security::network_audit::NetworkAuditor;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Instant;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

pub struct AppState {
    pub db: Arc<Database>,
    pub audio: Arc<AudioEngine>,
    pub auditor: Arc<NetworkAuditor>,
    pub target_hwnd: Arc<Mutex<isize>>,
    pub target_app_name: Arc<Mutex<String>>,
    pub target_app_title: Arc<Mutex<String>>,
    pub recording_start: Arc<Mutex<Option<Instant>>>,
    pub is_processing: Arc<AtomicBool>,
}

pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let dictation_i = MenuItem::with_id(app, "toggle_dictation", "Start/Stop Dictation", true, None::<&str>)?;
    let dashboard_i = MenuItem::with_id(app, "dashboard", "Open Dashboard", true, None::<&str>)?;
    let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit AMIYO FLOW", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&dictation_i, &dashboard_i, &settings_i, &quit_i])?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle_dictation" => {
                let state = app.state::<AppState>();
                let is_rec = state.audio.is_recording();
                if is_rec {
                    let app_clone = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let state = app_clone.state::<AppState>();
                        let _ = commands::stop_recording_and_insert(app_clone.clone(), state).await;
                    });
                } else {
                    let app_clone = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let state = app_clone.state::<AppState>();
                        let _ = commands::start_recording(app_clone.clone(), state).await;
                    });
                }
            }
            "dashboard" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "settings" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    if w.is_visible().unwrap_or(false) {
                        let _ = w.hide();
                    } else {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("./data"));

            let db = Arc::new(Database::new(app_data_dir).expect("Failed to initialize SQLite database"));

            let state = AppState {
                db: Arc::clone(&db),
                audio: Arc::new(AudioEngine::new()),
                auditor: Arc::new(NetworkAuditor::new()),
                target_hwnd: Arc::new(Mutex::new(0)),
                target_app_name: Arc::new(Mutex::new("Active Application".to_string())),
                target_app_title: Arc::new(Mutex::new("".to_string())),
                recording_start: Arc::new(Mutex::new(None)),
                is_processing: Arc::new(AtomicBool::new(false)),
            };

            app.manage(state);

            let _ = setup_tray(app);

            let shortcut_str = db
                .get_setting("hotkey")
                .unwrap_or_else(|| "Control+Space".to_string());

            let last_shortcut_time = std::sync::Arc::new(parking_lot::Mutex::new(
                std::time::Instant::now() - std::time::Duration::from_secs(5)
            ));
            let last_shortcut_clone = last_shortcut_time.clone();

            let handle = app.handle().clone();
            let _ = app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app_handle, _shortcut, event| {
                        use tauri_plugin_global_shortcut::ShortcutState;
                        if event.state() == ShortcutState::Pressed {
                            let mut last = last_shortcut_clone.lock();
                            if last.elapsed() < std::time::Duration::from_millis(350) {
                                return;
                            }
                            *last = std::time::Instant::now();
                            drop(last);

                            let state = app_handle.state::<AppState>();
                            let is_rec = state.audio.is_recording();
                            let h = app_handle.clone();

                            if is_rec {
                                tauri::async_runtime::spawn(async move {
                                    let s = h.state::<AppState>();
                                    let _ = commands::stop_recording_and_insert(h.clone(), s).await;
                                });
                            } else {
                                tauri::async_runtime::spawn(async move {
                                    let s = h.state::<AppState>();
                                    let _ = commands::start_recording(h.clone(), s).await;
                                });
                            }
                        }
                    })
                    .build(),
            );

            if let Ok(shortcut) = shortcut_str.parse::<Shortcut>() {
                let _ = handle.global_shortcut().register(shortcut);
            }
            if shortcut_str != "Control+Space" {
                if let Ok(ctrl_space) = "Control+Space".parse::<Shortcut>() {
                    let _ = handle.global_shortcut().register(ctrl_space);
                }
            }

            if let Some(main_win) = app.get_webview_window("main") {
                let main_clone = main_win.clone();
                main_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = main_clone.hide();
                    }
                });
            }

            if let Some(pill_win) = app.get_webview_window("pill") {
                let pill_w = 440.0;
                let pill_h = 78.0;
                let _ = pill_win.set_size(tauri::Size::Logical(tauri::LogicalSize {
                    width: pill_w,
                    height: pill_h,
                }));
                if let Ok(Some(monitor)) = pill_win.primary_monitor() {
                    let screen_size = monitor.size();
                    let scale_factor = monitor.scale_factor();
                    let screen_w = screen_size.width as f64 / scale_factor;
                    let screen_h = screen_size.height as f64 / scale_factor;
                    let pos_x = (screen_w - pill_w) / 2.0;
                    let pos_y = (screen_h - pill_h - 70.0).max(10.0);
                    let _ = pill_win.set_position(tauri::Position::Logical(tauri::LogicalPosition {
                        x: pos_x,
                        y: pos_y,
                    }));
                }

                #[cfg(target_os = "windows")]
                if let Ok(hwnd) = pill_win.hwnd() {
                    use windows::Win32::UI::WindowsAndMessaging::{
                        GetWindowLongW, SetWindowLongW, GWL_EXSTYLE, WS_EX_NOACTIVATE, WS_EX_TOPMOST,
                    };
                    unsafe {
                        let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0 as _);
                        let ex_style = GetWindowLongW(win_hwnd, GWL_EXSTYLE);
                        let _ = SetWindowLongW(
                            win_hwnd,
                            GWL_EXSTYLE,
                            ex_style | (WS_EX_NOACTIVATE.0 as i32) | (WS_EX_TOPMOST.0 as i32),
                        );
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_audio_devices,
            commands::set_audio_device,
            commands::get_foreground_window,
            commands::get_recording_state,
            commands::start_recording,
            commands::pause_recording,
            commands::resume_recording,
            commands::cancel_recording,
            commands::stop_recording_and_insert,
            commands::test_insert_text,
            commands::transcribe_and_clean,
            commands::get_history,
            commands::delete_history_item,
            commands::clear_all_history,
            commands::get_dictionary,
            commands::add_dictionary_word,
            commands::delete_dictionary_word,
            commands::get_snippets,
            commands::add_snippet,
            commands::delete_snippet,
            commands::get_settings,
            commands::save_settings,
            commands::get_analytics,
            commands::get_meetings,
            commands::process_meeting_recording,
            commands::delete_meeting,
            commands::toggle_pill_window,
            commands::toggle_main_window,
            commands::window_minimize,
            commands::window_toggle_maximize,
            commands::window_close,
            commands::list_local_speech_models,
            commands::list_local_llm_models,
            commands::get_offline_system_status,
            commands::check_ollama_status,
            commands::list_ollama_models,
            commands::list_cloud_providers,
            commands::set_cloud_api_key,
            commands::delete_cloud_api_key,
            commands::has_cloud_api_key,
            commands::test_cloud_provider,
            commands::get_ai_router_config,
            commands::save_ai_router_config,
            commands::get_network_audit_events,
            commands::clear_network_audit_events,
            commands::hide_pill_window,
            commands::show_pill_window,
            commands::reset_pill_position,
            commands::download_speech_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running AMIYO FLOW application");
}
