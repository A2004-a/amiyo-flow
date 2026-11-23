# AMIYO FLOW — Universal 100% On-Device AI Voice Typing Desktop Application

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11%20%7C%20macOS-informational.svg)](docs/ARCHITECTURE.md)
[![On-Device](https://img.shields.io/badge/Privacy-100%25%20On--Device%20%26%20Offline-emerald.svg)](docs/ARCHITECTURE.md)
[![Tests](https://img.shields.io/badge/Tests-42%2F42%20Passing-brightgreen.svg)](docs/QUALITY_REPORT.md)

**AMIYO FLOW** is a commercial-grade, universal desktop AI voice dictation and writing assistant engineered for **100% on-device, local execution**. Speak naturally into any application—Claude, Antigravity, ChatGPT, Google Chrome, VS Code, Slack, Microsoft Word, or Google Docs—and your speech is transcribed, refined, and injected directly into your active cursor with zero cloud dependence.

---

## Key Highlights

- **100% On-Device & Zero Cloud Leakage**: Core speech-to-text operates locally via `whisper.cpp` / acoustic decoders and text intelligence operates locally via `llama.cpp` / zero-RAM deterministic heuristic NLP. Operates seamlessly with the physical network adapter disconnected.
- **Universal External Text Injection**: Types directly into external applications via native Win32 `SendInput` Unicode packet dispatch with automatic `release_all_modifiers()` protection (clearing Alt, Ctrl, Shift, Win) and hardened clipboard fallback with pre/post clipboard preservation.
- **Dual-Window System**:
  - **Main Workspace Window** (1280×840): Full management suite for live dictation studio, dictionary, snippets, history, writing styles, meeting notes, AI router, and system settings.
  - **Floating HUD Pill Widget** (380×76): Lightweight, frameless, topmost widget with real-time 30Hz RMS audio waveform, drag-to-move handle (`GripVertical`), persistent `✕` close button, and <kbd>Escape</kbd> dismissal.
- **3-Way AI Router**: Seamlessly switch between **Local Only** (100% private, zero network), **Cloud AI** (10 providers: OpenAI, Claude, DeepSeek, Gemini, Groq, OpenRouter, Mistral, Together, Fireworks, Custom), and **Hybrid** mode with strict anti-leak safeguards (`allow_cloud_fallback: false`).
- **OS Secure Keyring**: Credentials stored directly in native Windows Credential Manager or macOS Keychain (`keyring = "2"`). Zero plaintext API keys in SQLite or frontend state.
- **Personalization Engine**: Custom dictionary with regex word-boundary replacement (`\bword\b`) and shorthand voice snippet macros (`;sig`, `;gh`, `;meet`).
- **Meeting Assistant**: Long-form meeting audio recording with automated local generation of executive summaries, key decisions, and numbered action items.

---

## Quick Start & Installation

### Windows 10 / 11 Installation
1. Download the verified installer:
   - **Standalone NSIS Setup**: `src-tauri/target/release/bundle/nsis/AMIYO FLOW_1.0.0_x64-setup.exe` (4.28 MiB)
   - **Direct Executable**: `src-tauri/target/release/amiyo-flow.exe` (16.9 MiB)
2. Run the installer or executable. The application boots cleanly, registers the global system tray icon, and minimizes to tray.

### Universal Voice Typing in Any App (Claude, Chrome, VS Code, Word)
1. **Place Cursor**: Click into the prompt box or text editor of any application outside AMIYO FLOW (e.g. Claude, Antigravity, ChatGPT, VS Code, Chrome).
2. **Press Hotkey**: Press the global hotkey (Default: <kbd>Alt+Space</kbd> or <kbd>Ctrl+Space</kbd>).
3. **Speak Naturally**: The floating HUD pill widget appears at the bottom-center of your screen showing the active target app and real-time audio waveform.
4. **Finish & Insert**: Press <kbd>Alt+Space</kbd> (or <kbd>Ctrl+Space</kbd>) again. AMIYO FLOW instantly cleans the spoken transcript, removes filler words, corrects grammar, and injects the formatted text directly into your cursor!

---

## Main Workspace Navigation

| Page | Description |
|---|---|
| **Dashboard** | System overview, active audio input, today's dictated words, typing time saved, and 4-second external injection probe. |
| **Live Dictation Studio** | Full interactive audio metering canvas, real-time waveform, raw vs. cleaned comparison diff, and active microphone switcher. |
| **History** | Searchable local database of all past dictations with duration, word counts, target applications, and 1-click clipboard export. |
| **Personal Dictionary** | Custom technical vocabulary, personal names, and phonetically misheard terms with automatic whole-word replacement. |
| **Snippets** | Shorthand macro triggers (e.g., `;sig` $\rightarrow$ full signature, `;gh` $\rightarrow$ GitHub repository) expanded automatically upon dictation. |
| **Writing Styles** | 6 specialized style presets: Casual, Professional, Academic, Developer (syntax `=>`, `{`, `;`), AI Prompt, and Raw verbatim. |
| **Meeting Assistant** | Long-form session recording with structured executive summaries, decisions, and action items. |
| **Local AI Models** | Local model catalog for `whisper.cpp` (`tiny.en`, `base.en`, `small.en`) and local Ollama auto-detection at `http://localhost:11434`. |
| **Cloud Providers** | Optional configuration for 10 cloud providers with OS Credential Manager security and live connection verification. |
| **AI Router** | Visual 3-way mode switcher (Local, Cloud, Hybrid) with per-task routing tables and strict anti-leak protection. |
| **Privacy Center** | Local network audit trail displaying destination, latency, and status with one-click audit and database purge. |
| **Analytics** | Aggregated daily, weekly, and monthly productivity statistics, word volume, and WPM differentials. |
| **Settings** | Microphone selection, global hotkey configuration, auto-insert toggles, clipboard delays, and history retention policies. |

---

## Technical Specifications

- **Frontend**: React 18/19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Zustand reactive state stores.
- **Native Backend**: Rust 2021, Tauri 2 (`tauri` v2, `tauri-plugin-global-shortcut`, `tauri-plugin-single-instance`, `tauri-plugin-notification`).
- **Audio Pipeline**: `cpal` native capture, linear software resampling to 16kHz 16-bit mono PCM, adaptive energy + spectral VAD.
- **Database**: SQLite 3 embedded directly via `rusqlite` with parameterized queries and ACID transactions.
- **Verification**: 42 / 42 automated tests passing (`cargo test` 29/29 + `vitest` 13/13).

---

## Project Documentation Suite

The project documentation has been consolidated into 4 essential, comprehensive files:
1. [AGENTS.md](AGENTS.md) — Permanent engineering rules, architectural contracts, and non-negotiable directives.
2. [README.md](README.md) — Complete user guide, navigation walkthrough, and quickstart documentation (this file).
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Deep system design, thread models, audio pipeline, VAD, 3-way AI router, and security audits.
4. [docs/QUALITY_REPORT.md](docs/QUALITY_REPORT.md) — Master feature registry (F001–F136), 42-test results log, bug tracker (BUG-001–BUG-025), and changelog.
