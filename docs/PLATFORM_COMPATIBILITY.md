# AMIYO FLOW — PLATFORM COMPATIBILITY

## 1. Operating System Support Matrix

| OS Platform | Architecture | Supported | Text Insertion Method | Hotkey Integration | Status |
|-------------|--------------|-----------|------------------------|--------------------|--------|
| Windows 11 | x64, ARM64 | Yes | Win32 SendInput + HWND Focus | Native Global Hotkey | VERIFIED |
| Windows 10 | x64 | Yes | Win32 SendInput + HWND Focus | Native Global Hotkey | VERIFIED |
| macOS Sonoma (14+) | Apple Silicon / Intel | Yes | CGEvent / AppleScript Accessibility | Carbon / Cocoa Global Shortcut | IMPLEMENTED (Requires Mac hardware for live test) |
| macOS Ventura (13+) | Apple Silicon / Intel | Yes | CGEvent / AppleScript Accessibility | Carbon / Cocoa Global Shortcut | IMPLEMENTED (Requires Mac hardware for live test) |
| Linux (X11 / Wayland) | x64 | Planned | xdotool / wtype / clipboard | X11 / Wayland Portal | ROADMAP |

## 2. Target Application Compatibility Matrix (Windows)

| Target Application | Supported | Method | Verified Behavior |
|--------------------|-----------|--------|-------------------|
| ChatGPT Web (Chrome, Edge, Firefox) | Yes | Win32 Clipboard Paste | Inserts cleanly into prompt text area without losing focus |
| Claude.ai Web | Yes | Win32 Clipboard Paste | Full multiline support and formatting |
| Google Gemini Web | Yes | Win32 Clipboard Paste | Text inserted directly into query box |
| Google Docs | Yes | Win32 Clipboard Paste | Appears at document cursor, preserves indentation |
| Gmail | Yes | Win32 Clipboard Paste | Inserts into compose body & subject line |
| Microsoft Word | Yes | Win32 Clipboard Paste | Native Word document insertion, formatting preserved |
| Notion Desktop & Web | Yes | Win32 Clipboard Paste | Inserts into current paragraph or block |
| Slack Desktop | Yes | Win32 Clipboard Paste | Inserts into message box without premature sending |
| WhatsApp Desktop | Yes | Win32 Clipboard Paste | Inserts into chat input field |
| Visual Studio Code | Yes | Win32 Clipboard Paste | Code-aware insertion into editor & terminal |
| Cursor AI | Yes | Win32 Clipboard Paste | Inserts into editor and Cursor AI chat input |
| Antigravity IDE | Yes | Win32 Clipboard Paste | Inserts into code buffers and agent prompts |
| Notepad / Wordpad | Yes | Win32 Clipboard / Unicode | Fast, perfect character fidelity |
