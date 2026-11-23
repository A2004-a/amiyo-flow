# AMIYO FLOW — SECURITY AUDIT REPORT

## 1. Executive Summary
AMIYO FLOW is designed with a **Privacy-First, Zero-Telemetry** architecture. The application does not contain tracking beacons, analytics SDKs, or background telemetry endpoints. All user audio and transcripts are stored strictly on the local machine within an isolated SQLite database, unless the user explicitly routes speech to a configured cloud AI provider.

## 2. Threat Modeling & Mitigations

### 2.1 API Key Exposure & Credential Security
- **Threat**: Extraction of user API keys (Groq, OpenAI, Anthropic, Gemini) via frontend inspection or process memory dump.
- **Mitigation**:
  - API keys are handled in the Rust backend and never logged or exposed to third-party scripts.
  - Keys are stored locally in the secure app configuration database.
  - Zero external reporting or telemetry libraries are bundled.

### 2.2 Microphone Privacy & Rogue Recording
- **Threat**: Covert recording without user awareness.
- **Mitigation**:
  - The audio stream is strictly opened when recording is active.
  - A persistent visual recording pill and tray indicator state clearly show active recording.
  - In-memory ring buffer is flushed immediately upon completion or cancellation.
  - Audio files are stored in RAM; no permanent WAV files are written to disk unless explicitly enabled in Meeting Mode.

### 2.3 Clipboard Hijacking & Data Leakage
- **Threat**: Accidental exposure or destruction of sensitive clipboard content (e.g., password copied previously).
- **Mitigation**:
  - Before simulated paste, existing clipboard contents are read and cached in memory.
  - After simulated `Ctrl + V`, original clipboard content is restored within 35ms.
  - User can configure "Do not use clipboard" mode (character-by-character Unicode injection) if working with strict clipboard managers.

### 2.4 SQL Injection & Local DB Tampering
- **Threat**: Malicious SQL injection via dictation text.
- **Mitigation**:
  - All SQLite database operations use `rusqlite` parameterized queries (`?1`, `?2`).
  - No raw string concatenation is used in SQL statement preparation.

### 2.5 Native OS Keychain & Zero Plaintext Secrets
- **Threat**: Extraction of user API keys from local configuration files or plaintext database inspection.
- **Mitigation**:
  - Raw API keys are stored strictly in the native OS secure credential store (`keyring` crate) using Windows Credential Manager on Windows and Keychain Services on macOS.
  - Zero API keys are stored in the SQLite database or configuration JSON files.
  - Keys returned to the frontend for display are masked (`••••••••`), and only boolean presence flags are surfaced to the UI.

### 2.6 Anti-Leak AI Fallback Prevention & Network Audit Ledger
- **Threat**: Silent external leakage of voice dictation or private text when local Ollama/whisper engines encounter errors or timeouts.
- **Mitigation**:
  - In `Local AI Mode`, all outbound HTTP requests to external cloud endpoints are hard-blocked at the routing layer (`router.rs`).
  - `allow_cloud_fallback: false` prevents the engine from silently uploading speech or text to cloud providers without explicit user consent.
  - A real-time `NetworkAuditor` maintains an in-memory ledger recording destination, request type, latency, and status without logging raw user text, passwords, or tokens.
  - Users can inspect and export the full network audit log anytime via the dedicated `Privacy Center`.
