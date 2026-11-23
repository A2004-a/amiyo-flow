# AMIYO FLOW — PERMANENT ENGINEERING & ARCHITECTURAL RULES (AGENTS.md)

## 1. CORE MISSION & NON-NEGOTIABLE DIRECTIVES

AMIYO FLOW is a commercial-grade, universal AI voice typing desktop application engineered for **100% ON-DEVICE LOCAL EXECUTION**.

### STRICT RULES:
1. **Zero External AI Cloud APIs**:
   - Under no circumstances shall the application make calls to OpenAI, Claude, Gemini, Groq, Deepgram, or any remote speech-to-text / LLM service for normal dictation functionality.
   - Core speech recognition must run locally via `whisper.cpp` / local quantized models.
   - Core text intelligence must run locally via `llama.cpp` / local quantized GGUF models and local rule-based heuristic intelligence.
   - Core voice activity detection must run locally via local Silero VAD / adaptive energy-spectral VAD.
2. **Offline-First Resilience**:
   - The application must function with 100% feature completeness when the physical network adapter is disconnected.
   - Network calls are strictly restricted to explicit, user-initiated local model downloads (from official repositories such as Hugging Face / ggerganov) or application update checks.
   - Zero telemetry, zero analytics tracking, and zero hidden network requests.
3. **Universal OS Text Injection**:
   - The application must insert text into any active external window at the current cursor position outside its own window.
   - Windows: Win32 native `SendInput` Unicode dispatch with clipboard fallback and pre/post clipboard preservation.
   - macOS: Native Accessibility / CoreGraphics synthetic key event dispatch.
4. **Resource & Memory Budget**:
   - Target devices include 8 GB RAM machines (M1 MacBook Air, standard Windows 10/11 laptops).
   - CPU inference with SIMD / AVX2 on x64, Metal acceleration on Apple Silicon.
   - Lazy model loading, on-demand memory deallocation, and staged inference to prevent simultaneous OOM memory exhaustion.
5. **Integrity & Verification**:
   - Never claim a feature is working without automated or documented test evidence.
   - Maintain the feature registry (`docs/FEATURE_REGISTRY.md`) covering all 124 features (F001–F124).
   - Track every defect in `docs/BUG_TRACKER.md` with root cause, reproduction, and verified fix.
   - Never leave non-functional buttons, fake data, or unhandled errors.

---

## 2. REPOSITORY & DIRECTORY CONVENTIONS

```
amiyo-flow/
├── AGENTS.md                  # Permanent project rules and architectural contract
├── docs/                      # Complete technical and release documentation suite
│   ├── ARCHITECTURE.md        # Deep system design, thread models, IPC contracts
│   ├── FEATURE_REGISTRY.md    # Master registry for all 124 features (F001-F124)
│   ├── FEATURE_TEST_RESULTS.md# Comprehensive test evidence log
│   ├── BUG_TRACKER.md         # Structured bug tracker with reproduction & fixes
│   ├── REGRESSION_TESTS.md    # Automated regression test suite definition
│   ├── SECURITY_AUDIT.md      # Local security, keyless isolation, DB hardening
│   ├── PERFORMANCE_REPORT.md  # Benchmarks: CPU, memory, latency, model load
│   ├── OFFLINE_AUDIT.md       # Zero-network verification proofs & audit protocol
│   ├── PLATFORM_COMPATIBILITY.md # Windows 10/11 and macOS matrices
│   ├── IMPLEMENTATION_ROADMAP.md # Phase-by-phase implementation sequence
│   ├── RELEASE_CHECKLIST.md   # Production verification checklist
│   └── CHANGELOG.md           # Semantic version release notes
├── src-tauri/                 # Rust Native Desktop Backend
│   ├── src/
│   │   ├── main.rs            # Desktop entrypoint
│   │   ├── lib.rs             # Application setup, single-instance, tray, hotkey
│   │   ├── commands.rs        # All Tauri IPC command handlers
│   │   ├── audio/             # Native cpal capture, 16kHz resampling, VAD
│   │   ├── stt/               # Local whisper.cpp engine & model manager
│   │   ├── ai/                # Local llama.cpp engine & context-aware cleaner
│   │   ├── input/             # Win32 SendInput & macOS universal text injection
│   │   └── db/                # Local SQLite persistence (history, dict, snippets)
│   ├── tests/                 # Rust unit and integration test suites
│   ├── Cargo.toml             # Rust dependencies and compiler optimizations
│   └── tauri.conf.json        # Tauri 2 dual-window configuration
├── src/                       # React 18/19 + TypeScript + Tailwind Frontend
│   ├── components/            # Reusable UI widgets, titlebar, sidebar, visualizer
│   ├── pages/                 # 10 dedicated application screens
│   ├── stores/                # Zustand reactive state stores
│   ├── lib/                   # Tauri invoke wrappers and mock fallback
│   ├── test/                  # Vitest frontend unit tests
│   └── index.css              # Custom styling, dark mode, glassmorphism
```

---

## 3. FEATURE VERIFICATION PROTOCOL

For every feature $F_{xxx}$:
1. **INSPECT**: Read existing code, identify dependencies and potential regressions.
2. **ACCEPTANCE CRITERIA**: Establish strict measurable conditions.
3. **IMPLEMENT**: Author complete native and frontend implementation.
4. **STATIC AUDIT**: Run `cargo check`, `npm run build`, and ESLint.
5. **AUTOMATED TEST**: Execute unit tests (`cargo test`, `npm test`).
6. **BUG DETECTION & FIX**: Assign unique Bug ID, fix root cause, verify.
7. **VERIFY & DOCUMENT**: Update `FEATURE_REGISTRY.md`, `FEATURE_TEST_RESULTS.md`, and `CHANGELOG.md`.
