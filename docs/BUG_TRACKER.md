# AMIYO FLOW — BUG TRACKER

## Tracking Standard
Every detected defect is assigned an ID, Severity, Description, Root Cause Analysis, Fix Strategy, and Verification Status.

| Bug ID | Severity | Module | Description | Root Cause | Fix Strategy | Status |
|--------|----------|--------|-------------|------------|--------------|--------|
| BUG-001 | High | Module F | Potential focus loss during long AI generation | User clicks away while LLM is generating text, causing paste into wrong window | Store immutable target HWND at hotkey press; verify HWND is still valid and re-focus immediately before SendInput | FIXED |
| BUG-002 | Medium | Module F | Clipboard pollution | Pasting overwrites user's previous clipboard data | Read and cache clipboard contents prior to paste, sleep 35ms, restore original clipboard | FIXED |
| BUG-003 | Medium | Module B | Sample rate mismatch on high-end USB microphones (96kHz/192kHz) | cpal stream failure when asking for strict 16kHz on unsupported hardware | Capture at device default sample rate and perform linear software resampling to 16kHz mono in Rust buffer | FIXED |
| BUG-004 | Low | Module G | Snippet trigger collisions | Triggering snippets inside normal words (e.g., `;sig` inside another word) | Use word boundary matching for snippet expansions | FIXED |
| BUG-005 | Low | Module A | Double launch on Windows | User clicks shortcut twice, creating multiple audio threads | Tauri Single Instance plugin prevents secondary process and brings primary window to front | FIXED |
| BUG-006 | Medium | Module E | Cross-platform model path resolution | `dirs` crate dependency omitted in Cargo.toml causing compile failure | Implemented zero-dependency cross-platform `get_user_home()` using OS environment variables | FIXED |
| BUG-007 | Low | Module K | Key masking on empty input | Empty string returned fixed masked dots rather than blank string | Added `trimmed.is_empty()` check returning empty string | FIXED |
| BUG-008 | Low | Module K | Audit event method naming inconsistency | `get_events` vs `get_recent_events` method call discrepancy | Unified on `get_recent_events(limit)` and `clear_events()` | FIXED |
| BUG-009 | High | Module J | Router schema and anti-leak enforcement | Inconsistent task rule structure risked silent fallback | Aligned `task_rules` map and enforced `allow_cloud_fallback: false` default | FIXED |
| BUG-010 | High | Module H | Window focus stealing on HUD pill popup | When floating pill was shown, Windows activated it by default, stripping focus from active text box | Added `WS_EX_NOACTIVATE` and `WS_EX_TOPMOST` native extended window styles in `lib.rs` | FIXED |
| BUG-011 | High | Module H | Cross-thread focus attachment failure on Windows 10/11 | `SetForegroundWindow` blocked by Windows OS lock when called from background app | Implemented `AttachThreadInput` across current thread, foreground thread, and target thread in `input/mod.rs` | FIXED |
| BUG-012 | Medium | Module H | Synthetic paste dropped by Chromium/Electron event loops | Keydown and keyup sent in the same millisecond packet | Added 15ms key delay and 50ms clipboard restoration safety buffer in `input/mod.rs` | FIXED |
| BUG-013 | High | Module J | `AiOperatingMode` serialization case mismatch | Rust `#[serde(rename_all = "lowercase")]` emitted `"local"` while TypeScript expected `'Local'` | Added `#[serde(rename_all = "PascalCase")]` and serde aliases in `router.rs`, plus `.toLowerCase()` in `AiRouter.tsx` | FIXED |
| BUG-014 | Medium | Module A | Sidebar navigation overflow on compact screens | 13 navigation items exceeded vertical viewport height on compact desktop screens | Added `overflow-y-auto min-h-0 flex-1` to the sidebar navigation container in `Sidebar.tsx` | FIXED |
| BUG-015 | Low | Module I | Cloud provider API key input missing Enter submission and visibility toggle | User had to click button with mouse and could not review typed key | Added Enter key listener and Eye/EyeOff show/hide password toggle in `CloudProviders.tsx` | FIXED |
