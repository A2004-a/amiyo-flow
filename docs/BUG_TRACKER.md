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
