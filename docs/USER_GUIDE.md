# AMIYO FLOW — USER GUIDE

Welcome to **AMIYO FLOW**, the next-generation cross-platform AI voice dictation desktop companion.

## 1. Quick Start

1. **Launch the Application**: Run `amiyo-flow.exe`. The application minimizes to the system tray and exposes a subtle floating dictation widget.
2. **Configure Your Microphone**: Open the Dashboard or Settings page and choose your primary audio input device.
3. **Configure Your AI Provider**:
   - Navigate to **AI Providers**.
   - Input your **Groq API Key** (recommended for ~300ms ultra-fast transcription and cleanup) or **OpenAI / Anthropic / Gemini Key**.
   - If no API key is provided, AMIYO FLOW automatically switches to the built-in offline heuristic cleanup engine.
4. **Choose Your Writing Style**:
   - Select from **Casual**, **Professional**, **Academic**, **Developer**, **AI Prompt**, or **Raw**.
5. **Dictate Universally**:
   - Place your cursor in **any application** (VS Code, Chrome, ChatGPT, Slack, Word, Google Docs).
   - Press the global shortcut (Default: `Ctrl + Space` or `Alt + Space`).
   - Speak naturally. Notice the live audio waveform and recording state in the floating widget.
   - Press the shortcut again (or release in Hold-to-Talk mode).
   - AMIYO FLOW transcribes, cleanses grammar/fillers, and **instantly inserts the polished text directly at your cursor**.

## 2. Main Workspace Pages

- **Dashboard**: System status, active microphone, today's word count, time saved, and quick dictation tester.
- **Live Dictation Studio**: Full-screen interactive dictation canvas with real-time waveform, raw vs. cleaned text diff viewer, and audio controls.
- **History**: Searchable, filterable archive of past dictations. Filter by target app, copy raw or cleaned text, re-clean with alternative styles, or export to Markdown/TXT.
- **Personal Dictionary**: Add custom vocabulary, technical terms (e.g. `Kubernetes`, `GraphQL`, `Tauri`), colleague names, and custom acronyms so the speech model never mishears them.
- **Snippets**: Define quick text triggers (e.g., `;sig` -> your full email signature, `;gh` -> GitHub repository link) that expand automatically upon dictation.
- **Writing Styles**: Customize AI system prompts for each style or create your own custom tone presets.
- **Meeting Assistant**: Record meetings, extract timestamped transcripts, and generate executive summaries with action items and decisions.
- **AI Providers**: Manage cloud STT and LLM providers (Groq, OpenAI, Anthropic, Gemini, Local Ollama).
- **Analytics**: Visualize words dictated over time, typing speed differential (WPM), and estimated hours saved.
- **Settings**: Audio input selector, global shortcut config, auto-insert toggle, clipboard restore delay, history retention, and system tray behavior.

## 3. Privacy Guarantee
AMIYO FLOW never uploads audio or transcripts to unauthorized third-party analytics. Audio is buffered in volatile memory and deleted immediately after processing.
