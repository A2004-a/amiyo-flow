# AMIYO FLOW — IMPLEMENTATION PLAN

## Phase 1: Environment & Project Foundation
- Initialize Tauri 2 project with Vite, React 19, TypeScript, Tailwind CSS, Framer Motion, and Lucide icons.
- Configure Cargo.toml with high-performance native crates: `cpal` (audio capture), `hound` (WAV audio encoding), `rusqlite` (embedded storage), `reqwest` (cloud STT & AI streaming), `windows` (Win32 input insertion & window management), `serde` / `serde_json`.
- Implement dual window architecture: Main Window (10-page productivity workspace) + Floating Dictation Pill (non-intrusive floating widget).
- Set up System Tray with native context menu and background execution.

## Phase 2: Native Audio Capture & Streaming Engine
- Implement `cpal` audio stream in Rust with dynamic device enumeration.
- Resample / downmix audio to 16,000 Hz, 16-bit, single-channel (mono) PCM.
- Real-time RMS level calculation emitted via Tauri event (`amiyo-audio-level`) at ~30Hz for the floating visualizer.
- Voice Activity Detection (VAD) / silence gating and safe buffer flush on stop.

## Phase 3: Global Hotkey & Target Window Focus Tracking
- Register global hotkey (`Ctrl+Space` / `Alt+Space` / customizable) natively.
- On key press: immediately record the currently active foreground window (`GetForegroundWindow`) and target process information (`code.exe`, `chrome.exe`, `slack.exe`, etc.).
- Maintain dictation state machine: `Idle` -> `Recording` -> `Processing` -> `Inserting` -> `Completed` / `Failed`.

## Phase 4: Universal Text Insertion (Win32 & Clipboard Fallback)
- Re-focus the target HWND (`SetForegroundWindow`).
- Backup existing clipboard text.
- Populate clipboard with cleaned transcript.
- Dispatch simulated `Ctrl + V` via Win32 `SendInput`.
- Wait 35-50ms for the target application message loop to ingest the paste.
- Restore the original clipboard text.
- Fallback: Unicode `SendInput` (`KEYEVENTF_UNICODE`) for character-by-character injection or clipboard toast alert.

## Phase 5: Multi-Provider Speech-to-Text & AI Text Intelligence
- Cloud Whisper: Groq Whisper (`whisper-large-v3-turbo` with ultra-low latency), OpenAI Whisper (`whisper-1`), Deepgram.
- Local / offline fallback: Heuristic cleaner & local mock endpoint when offline or no API key.
- AI Text Intelligence:
  - Removal of filler words (um, uh, like, you know).
  - Punctuation & casing correction.
  - Removal of accidental repetitions and spoken self-corrections ("no wait...").
  - Target application context conditioning (e.g., format code when target is VS Code/Cursor).
  - Writing styles: Casual, Professional, Academic, Developer, AI Prompt, Raw.

## Phase 6: Personalization & Workspace Features
- Personal Dictionary (technical jargon, personal names, acronyms).
- Snippet expansion (e.g. `;sig` expands to email signature).
- Full SQLite persistence for history, analytics, dictionary, snippets, and settings.
- Meeting Assistant mode (extended audio chunking, structured summary, decisions, action items).

## Phase 7: UI / UX Polish & Component Architecture
- 10 pages: Dashboard, Live Dictation, History, Dictionary, Snippets, Writing Styles, Meeting Assistant, AI Providers, Analytics, Settings.
- Floating Dictation Widget with live pulsing waveform, draggable handle, status badge, and quick cancel/stop.
- High contrast, dark glassmorphism aesthetic inspired by Apple & Wispr Flow.

## Phase 8: Testing, Verification & Production Build
- Rust test suite (`cargo test`) for audio resampling, buffer conversion, dictionary lookup, and snippet expansion.
- Frontend test suite (Vitest + React Testing Library).
- End-to-end testing of window tracking, text insertion, and history saving.
- Windows release build generation (`tauri build`).
