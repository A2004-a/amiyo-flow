# AMIYO FLOW — TEST PLAN

## 1. Testing Objectives
Verify that AMIYO FLOW operates reliably, accurately, and securely as a native universal voice typing desktop application under real-world conditions, satisfying all criteria across Modules A through L.

## 2. Testing Tiers

### Tier 1: Static Code Quality & Type Safety
- **TypeScript**: `tsc --noEmit` ensures strict type checking across all stores, components, and pages.
- **Rust**: `cargo clippy -- -D warnings` and `cargo check` to prevent unsafe memory operations or uncaught errors.
- **Formatting**: Strict rustfmt and prettier conventions.

### Tier 2: Unit Testing
- **Audio Processing**:
  - Resampling from 44.1kHz/48kHz to 16kHz mono.
  - WAV header formation with `hound`.
  - RMS calculation and silence gating.
- **AI Text Intelligence**:
  - Regex-based filler word removal ("um", "uh", "you know").
  - Spoken self-correction parsing.
  - Snippet expansion triggers (e.g. `;sig`, `;gh`).
  - Dictionary word injection into prompt.
- **SQLite Engine**:
  - Migration script execution.
  - Insertion and query of history records.
  - Word count and analytics aggregation.

### Tier 3: Native Integration & OS Testing
- **Foreground Window Tracking**:
  - Verifying `GetForegroundWindow` correctly identifies active external applications before dictation commences.
- **Simulated Text Insertion**:
  - Testing `SendInput` clipboard-based paste into Notepad, VS Code, Chrome, and Word.
  - Verifying clipboard contents are cleanly restored without data loss.
- **System Tray & Window Visibility**:
  - Testing minimize to tray, show from tray, and background execution.

### Tier 4: End-to-End User Experience & Stress Testing
- **Short Speech Test**: 1-3 word commands ("Hello world", "Git commit message").
- **Long Speech Test**: 2-5 minute continuous dictation with paragraph breaks.
- **Accented & Technical Speech**: Technical vocabulary ("Rust tokio async await", "Kubernetes pod ingress").
- **Offline & Error Resilience**: Network cutoffs during STT, invalid API keys, disconnected microphones.

## 3. Test Matrix by Application
| Application | Category | Insertion Method | Focus Retention | Result |
|-------------|----------|------------------|-----------------|--------|
| VS Code / Cursor | Code Editor | Win32 Paste | HWND Restore | Target Verified |
| Chrome / Edge / Firefox | Web Browser | Win32 Paste | HWND Restore | Target Verified |
| ChatGPT / Claude / Gemini | AI Web Apps | Win32 Paste | HWND Restore | Target Verified |
| Slack / Discord | Chat / Messaging | Win32 Paste | HWND Restore | Target Verified |
| Notion / Google Docs | Rich Text / Canvas | Win32 Paste | HWND Restore | Target Verified |
| Notepad / Word | Native Text Editor| Win32 Paste / Unicode | HWND Restore | Target Verified |
