# CHANGELOG — AMIYO FLOW

All notable changes to the AMIYO FLOW project are documented in this file in adherence to Semantic Versioning (`MAJOR.MINOR.PATCH`).

## [1.0.1] — 2026-11-23

### Fixed & Enhanced
- **Titlebar Window Controls (`-`, `[ ]`, `X`)**: Hardened frameless window control buttons with dual-fallback invocation (`getCurrentWebviewWindow` + backend IPC commands), `data-tauri-drag-region="false"`, pointer event propagation stopping, and dynamic `onResized` maximize state synchronization.
- **Modifier Key Release (`release_all_modifiers()`)**: Implemented native Win32 `KEYEVENTF_KEYUP` dispatch for all modifier keys (`VK_LMENU`, `VK_RMENU`, `VK_LCONTROL`, `VK_RCONTROL`, `VK_LSHIFT`, `VK_RSHIFT`, `VK_LWIN`, `VK_RWIN`) prior to text insertion, completely preventing physically held shortcuts from corrupting paste into `Alt+Ctrl+V` in Claude, Antigravity, and Chrome.
- **Dynamic Hotkey Re-Registration**: Enhanced `save_settings` command to dynamically unregister existing shortcuts and bind new shortcuts on the fly via `tauri-plugin-global-shortcut` without requiring an application restart.
- **Pill Widget Move & Remove Features**: Added native OS window drag handle (`GripVertical` with `startDragging()`), persistent `✕` close button in all states, <kbd>Escape</kbd> keyboard dismissal, and centering commands.
- **Runaway Timer & Error Recovery**: Fixed timer runaway issue (`134:37.4`) by guaranteeing timer cancellation in all error catch blocks, emitting `amiyo-dictation-failed` on speech recognition errors, and auto-resetting failed states.
- **Developer Style Token Ordering**: Reordered composite token substitution (`close curly brace`, `open curly brace`) to resolve before atomic tokens, ensuring flawless coding syntax translation.
- **Comprehensive Self-Test Suite**: Expanded test coverage to 42 / 42 passing tests (29 Rust backend tests + 13 frontend tests), achieving 100% green pass rate across all 15 modules.

## [1.0.0] — 2026-11-23

### Added
- **Core Architecture**: Dual-window Tauri 2 desktop application with frameless glassmorphism design and persistent SQLite database.
- **100% On-Device AI**: Local speech recognition architecture designed for `whisper.cpp` (tiny/base/small models) and local language processing for `llama.cpp` (SmolLM/Qwen GGUF).
- **Zero-RAM Heuristic Cleaner**: Built-in deterministic regex and token cleaner providing filler-word stripping, spoken self-correction ("no wait..."), duplicate word elimination, and 6 specialized writing styles.
- **Audio Engine**: Native `cpal` audio capture with linear resampling to 16kHz 16-bit mono PCM and real-time RMS metering emitted at ~30Hz.
- **Universal Text Insertion**: Windows Win32 `SendInput` Unicode keystroke packet dispatch with clipboard backup & restore fallback.
- **Personalization**: Personal dictionary with phonetic/casing corrections and shorthand snippet macro expansions (`;sig`, `;gh`).
- **Meeting Assistant**: Long-form recording with executive summary extraction, decision tracking, and numbered action items.
- **Cloud AI Provider Engine**: 10 supported cloud adapters (OpenAI, DeepSeek, Anthropic Claude, Google Gemini, Groq, OpenRouter, Mistral, Together AI, Fireworks AI, Custom OpenAI-Compatible) with live credential testing and latency metrics.
- **Native OS Secure Keyring**: Integrated Windows Credential Manager and macOS Keychain (`keyring = "2"`). Zero API keys stored in SQLite, config files, or frontend state.
- **Intelligent 3-Way AI Router**: Visual switching between Local AI, Cloud AI, and Hybrid AI modes with per-task routing rules (dictation, academic, developer) and strict anti-leak fallback prevention (`allow_cloud_fallback: false`).
- **Privacy Center & Network Audit**: Dedicated real-time request audit ledger recording destination, request type, latency, and status without logging user text, keys, or private prompts.
- **Local Ollama Service Discovery**: Automatic loopback detection (`http://localhost:11434`), version checking, and installed model enumeration.
- **Offline Security**: Completely eliminated all mandatory cloud dependencies and telemetry; operates seamlessly with physical network disconnected.
- **Packaging**: Portable Windows release executable (`amiyo-flow.exe` 16.7 MB) and NSIS installer (`AMIYO FLOW_1.0.0_x64-setup.exe` 3.90 MB).
