use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForegroundWindowInfo {
    pub hwnd: isize,
    pub title: String,
    pub process_name: String,
}

#[cfg(target_os = "windows")]
pub mod win_impl {
    use super::ForegroundWindowInfo;
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::thread::sleep;
    use std::time::Duration;
    use windows::Win32::Foundation::{HANDLE, HWND, LPARAM, WPARAM};
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, GetClipboardData, IsClipboardFormatAvailable,
        OpenClipboard, SetClipboardData,
    };
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
    use windows::Win32::System::ProcessStatus::GetModuleBaseNameW;
    use windows::Win32::System::Threading::{
        AttachThreadInput, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW,
        PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
        KEYEVENTF_UNICODE, VIRTUAL_KEY, VK_CONTROL, VK_RETURN, VK_SHIFT,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId, IsWindow,
        SendMessageW, SetForegroundWindow, WM_CANCELMODE,
    };

    const CF_UNICODETEXT: u32 = 13;

    pub fn get_foreground_window() -> Option<ForegroundWindowInfo> {
        unsafe {
            let mut hwnd = GetForegroundWindow();
            if hwnd.0 == (0 as _) {
                for _ in 0..3 {
                    sleep(Duration::from_millis(15));
                    hwnd = GetForegroundWindow();
                    if hwnd.0 != (0 as _) {
                        break;
                    }
                }
            }
            if hwnd.0 == (0 as _) {
                return None;
            }

            // Window title
            let mut title_buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut title_buf);
            let title = if len > 0 {
                OsString::from_wide(&title_buf[..len as usize])
                    .to_string_lossy()
                    .into_owned()
            } else {
                "Unknown Window".to_string()
            };

            // Process name
            let mut process_id = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut process_id));

            let process_name = if process_id != 0 {
                if let Ok(process_handle) =
                    OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id)
                {
                    let mut proc_buf = [0u16; 512];
                    let mut size = proc_buf.len() as u32;
                    let success = QueryFullProcessImageNameW(
                        process_handle,
                        PROCESS_NAME_FORMAT(0),
                        windows::core::PWSTR(proc_buf.as_mut_ptr()),
                        &mut size,
                    );

                    let p_name = if success.is_ok() && size > 0 {
                        let full_path = OsString::from_wide(&proc_buf[..size as usize])
                            .to_string_lossy()
                            .into_owned();
                        std::path::Path::new(&full_path)
                            .file_name()
                            .and_then(|f| f.to_str())
                            .map(|s| s.to_string())
                    } else {
                        let mut base_buf = [0u16; 260];
                        let b_len = GetModuleBaseNameW(process_handle, None, &mut base_buf);
                        if b_len > 0 {
                            Some(
                                OsString::from_wide(&base_buf[..b_len as usize])
                                    .to_string_lossy()
                                    .into_owned(),
                            )
                        } else {
                            None
                        }
                    };

                    let _ = windows::Win32::Foundation::CloseHandle(process_handle);
                    p_name.unwrap_or_else(|| "app.exe".to_string())
                } else {
                    "app.exe".to_string()
                }
            } else {
                "app.exe".to_string()
            };

            Some(ForegroundWindowInfo {
                hwnd: hwnd.0 as isize,
                title,
                process_name,
            })
        }
    }

    pub fn activate_window(hwnd_val: isize) -> bool {
        unsafe {
            let hwnd = HWND(hwnd_val as *mut _);
            if !IsWindow(hwnd).as_bool() {
                return false;
            }

            let foreground_hwnd = GetForegroundWindow();
            if foreground_hwnd == hwnd {
                let _ = SendMessageW(hwnd, WM_CANCELMODE, WPARAM(0), LPARAM(0));
                return true;
            }

            // Cancel any active system/context menu that could trap keystrokes (e.g. from Alt+Space)
            let _ = SendMessageW(hwnd, WM_CANCELMODE, WPARAM(0), LPARAM(0));
            if foreground_hwnd.0 != (0 as _) {
                let _ = SendMessageW(foreground_hwnd, WM_CANCELMODE, WPARAM(0), LPARAM(0));
            }

            // Bypass Windows foreground lock timeout restriction via synthetic Alt pulse
            let alt_tap = [
                INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: VIRTUAL_KEY(0x12), // VK_MENU
                            wScan: 0,
                            dwFlags: windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0),
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                },
                INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: VIRTUAL_KEY(0x12),
                            wScan: 0,
                            dwFlags: KEYEVENTF_KEYUP,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                },
            ];
            SendInput(&alt_tap, std::mem::size_of::<INPUT>() as i32);

            let mut foreground_pid = 0u32;
            let foreground_thread = GetWindowThreadProcessId(foreground_hwnd, Some(&mut foreground_pid));
            let mut target_pid = 0u32;
            let target_thread = GetWindowThreadProcessId(hwnd, Some(&mut target_pid));
            let current_thread = GetCurrentThreadId();

            if foreground_thread != 0 && current_thread != foreground_thread {
                let _ = AttachThreadInput(current_thread, foreground_thread, true);
            }
            if target_thread != 0 && current_thread != target_thread {
                let _ = AttachThreadInput(current_thread, target_thread, true);
            }

            let _ = BringWindowToTop(hwnd);
            let res = SetForegroundWindow(hwnd);
            let _ = SendMessageW(hwnd, WM_CANCELMODE, WPARAM(0), LPARAM(0));

            if target_thread != 0 && current_thread != target_thread {
                let _ = AttachThreadInput(current_thread, target_thread, false);
            }
            if foreground_thread != 0 && current_thread != foreground_thread {
                let _ = AttachThreadInput(current_thread, foreground_thread, false);
            }

            sleep(Duration::from_millis(35));
            res.as_bool()
        }
    }

    pub fn get_clipboard_text() -> Option<String> {
        unsafe {
            if OpenClipboard(HWND(0 as _)).is_err() {
                return None;
            }

            let result = if IsClipboardFormatAvailable(CF_UNICODETEXT).is_ok() {
                let handle = GetClipboardData(CF_UNICODETEXT);
                if let Ok(h_global) = handle {
                    let ptr = GlobalLock(windows::Win32::Foundation::HGLOBAL(h_global.0 as _)) as *const u16;
                    if !ptr.is_null() {
                        let mut len = 0;
                        while *ptr.add(len) != 0 {
                            len += 1;
                        }
                        let slice = std::slice::from_raw_parts(ptr, len);
                        let text = OsString::from_wide(slice).to_string_lossy().into_owned();
                        let _ = GlobalUnlock(windows::Win32::Foundation::HGLOBAL(h_global.0 as _));
                        Some(text)
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            };

            let _ = CloseClipboard();
            result
        }
    }

    pub fn set_clipboard_text(text: &str) -> bool {
        unsafe {
            let mut opened = false;
            for _ in 0..10 {
                if OpenClipboard(HWND(0 as _)).is_ok() {
                    opened = true;
                    break;
                }
                sleep(Duration::from_millis(10));
            }
            if !opened {
                return false;
            }

            let _ = EmptyClipboard();

            let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
            let size = wide.len() * std::mem::size_of::<u16>();

            let h_global = GlobalAlloc(GMEM_MOVEABLE, size);

            if let Ok(handle) = h_global {
                let ptr = GlobalLock(handle) as *mut u16;
                if !ptr.is_null() {
                    std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
                    let _ = GlobalUnlock(handle);
                    let _ = SetClipboardData(
                        CF_UNICODETEXT,
                        HANDLE(handle.0 as *mut _),
                    );
                }
            }

            let _ = CloseClipboard();
            true
        }
    }

    pub fn release_all_modifiers() {
        unsafe {
            use windows::Win32::UI::Input::KeyboardAndMouse::{
                VK_LMENU, VK_RMENU, VK_MENU, VK_LCONTROL, VK_RCONTROL, VK_CONTROL,
                VK_LSHIFT, VK_RSHIFT, VK_SHIFT, VK_LWIN, VK_RWIN,
            };

            let modifiers = [
                VK_LMENU, VK_RMENU, VK_MENU,
                VK_LCONTROL, VK_RCONTROL, VK_CONTROL,
                VK_LSHIFT, VK_RSHIFT, VK_SHIFT,
                VK_LWIN, VK_RWIN,
            ];

            let mut inputs = Vec::with_capacity(modifiers.len());
            for vk in modifiers {
                inputs.push(INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: vk,
                            wScan: 0,
                            dwFlags: KEYEVENTF_KEYUP,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                });
            }
            SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
            sleep(Duration::from_millis(20));
        }
    }

    pub fn simulate_ctrl_v() {
        unsafe {
            release_all_modifiers();

            let v_key = VIRTUAL_KEY(0x56); // 'V'
            let ctrl_key = VK_CONTROL;

            let key_down = [
                INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: ctrl_key,
                            wScan: 0,
                            dwFlags: windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0),
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                },
                INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: v_key,
                            wScan: 0,
                            dwFlags: windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0),
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                },
            ];
            SendInput(&key_down, std::mem::size_of::<INPUT>() as i32);

            // Give Windows & Chromium/Electron event queue 25ms to register key-down
            sleep(Duration::from_millis(25));

            let key_up = [
                INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: v_key,
                            wScan: 0,
                            dwFlags: KEYEVENTF_KEYUP,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                },
                INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: ctrl_key,
                            wScan: 0,
                            dwFlags: KEYEVENTF_KEYUP,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                },
            ];
            SendInput(&key_up, std::mem::size_of::<INPUT>() as i32);
        }
    }

    pub fn send_unicode_text(text: &str) {
        unsafe {
            let mut inputs = Vec::new();
            for c in text.chars() {
                if c == '\r' {
                    continue;
                }
                if c == '\n' {
                    // Send Shift+Return to prevent instant form/prompt submission in chat apps (Claude, ChatGPT, Slack, Discord)
                    inputs.push(INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: INPUT_0 {
                            ki: KEYBDINPUT {
                                wVk: VK_SHIFT,
                                wScan: 0,
                                dwFlags: windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0),
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    });
                    inputs.push(INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: INPUT_0 {
                            ki: KEYBDINPUT {
                                wVk: VK_RETURN,
                                wScan: 0,
                                dwFlags: windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0),
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    });
                    inputs.push(INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: INPUT_0 {
                            ki: KEYBDINPUT {
                                wVk: VK_RETURN,
                                wScan: 0,
                                dwFlags: KEYEVENTF_KEYUP,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    });
                    inputs.push(INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: INPUT_0 {
                            ki: KEYBDINPUT {
                                wVk: VK_SHIFT,
                                wScan: 0,
                                dwFlags: KEYEVENTF_KEYUP,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    });
                    continue;
                }

                let mut buf = [0u16; 2];
                let encoded = c.encode_utf16(&mut buf);
                for &u16_code in encoded.iter() {
                    inputs.push(INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: INPUT_0 {
                            ki: KEYBDINPUT {
                                wVk: VIRTUAL_KEY(0),
                                wScan: u16_code,
                                dwFlags: KEYEVENTF_UNICODE,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    });
                    inputs.push(INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: INPUT_0 {
                            ki: KEYBDINPUT {
                                wVk: VIRTUAL_KEY(0),
                                wScan: u16_code,
                                dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    });
                }
            }

            if !inputs.is_empty() {
                // Dispatch inputs in 64-event chunks with tiny yields to protect Chromium/Electron message queues
                for chunk in inputs.chunks(64) {
                    SendInput(chunk, std::mem::size_of::<INPUT>() as i32);
                    if inputs.len() > 64 {
                        sleep(Duration::from_millis(2));
                    }
                }
            }
        }
    }

    pub fn is_legacy_console_window(hwnd_val: isize) -> bool {
        unsafe {
            let hwnd = HWND(hwnd_val as *mut _);
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid != 0 {
                if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                    let mut proc_buf = [0u16; 260];
                    let mut size = proc_buf.len() as u32;
                    let success = QueryFullProcessImageNameW(
                        handle,
                        PROCESS_NAME_FORMAT(0),
                        windows::core::PWSTR(proc_buf.as_mut_ptr()),
                        &mut size,
                    );
                    let _ = windows::Win32::Foundation::CloseHandle(handle);
                    if success.is_ok() && size > 0 {
                        let full = OsString::from_wide(&proc_buf[..size as usize]).to_string_lossy().to_lowercase();
                        return full.contains("cmd.exe") || full.contains("conhost.exe");
                    }
                }
            }
            false
        }
    }

    pub fn insert_text(target_hwnd: isize, text: &str, use_clipboard: bool, restore_delay_ms: u64) -> Result<(), String> {
        if text.trim().is_empty() {
            return Ok(());
        }

        // Release any held modifier keys from hotkey (Alt, Ctrl, Shift, Win)
        release_all_modifiers();

        if target_hwnd != 0 {
            activate_window(target_hwnd);
            sleep(Duration::from_millis(60));
        }

        // Release modifiers again after window activation just in case
        release_all_modifiers();

        let is_console = is_legacy_console_window(target_hwnd);

        // Win32 native SendInput Unicode dispatch (AGENTS.md Rule 3)
        // By default or for standard text (<800 chars), inject directly into target cursor.
        // This NEVER touches, clears, or modifies the user's OS clipboard, eliminating race conditions.
        if !use_clipboard || is_console || text.len() <= 800 {
            send_unicode_text(text);
            return Ok(());
        }

        // Fallback for massive text blocks (>800 chars) when clipboard paste is explicitly chosen
        let old_clipboard = get_clipboard_text();
        let set_ok = set_clipboard_text(text);
        if set_ok {
            sleep(Duration::from_millis(50));
            simulate_ctrl_v();
            // Allow target application (Chromium/Electron/Claude) sufficient time to read clipboard before restoring
            sleep(Duration::from_millis(restore_delay_ms.max(1200)));

            if let Some(ref prev) = old_clipboard {
                set_clipboard_text(prev);
            }
        } else {
            // Seamlessly fall back to direct SendInput Unicode injection
            send_unicode_text(text);
        }

        Ok(())
    }
}

pub fn get_foreground_window() -> Option<ForegroundWindowInfo> {
    #[cfg(target_os = "windows")]
    {
        win_impl::get_foreground_window()
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

pub fn insert_text(target_hwnd: isize, text: &str, use_clipboard: bool, restore_delay_ms: u64) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        win_impl::insert_text(target_hwnd, text, use_clipboard, restore_delay_ms)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Text insertion currently implemented natively for Windows".to_string())
    }
}
