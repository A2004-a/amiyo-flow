# CHANGELOG — AMIYO FLOW

All notable changes to the AMIYO FLOW project are documented in this file in adherence to Semantic Versioning (`MAJOR.MINOR.PATCH`).

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
