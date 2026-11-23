# AMIYO FLOW — AUTOMATED REGRESSION TEST SUITE

## 1. Test Architecture & Execution Strategy

Every change, bug fix, or feature addition must execute the full regression suite before merging or release.

```powershell
# 1. Native Rust Regression Suite
cargo test --manifest-path src-tauri/Cargo.toml

# 2. Frontend & Store Regression Suite
npm test

# 3. Static Type & Lint Check
npm run build
```

---

## 2. Regression Test Matrix

| Suite | File | Focus Areas | Automated Assertions |
|---|---|---|---|
| **Audio Core** | `src-tauri/tests/unit_tests.rs` | 16kHz resampling, PCM float-to-int conversion, RIFF WAV header validation | 2 unit tests |
| **Local AI Engine** | `src-tauri/tests/unit_tests.rs` | Filler word removal, self-correction, duplicate elimination, regex boundary protection | 3 unit tests |
| **Personalization** | `src-tauri/tests/unit_tests.rs` | Dictionary token replacement, snippet expansion, special character safety | 2 unit tests |
| **Database ACID** | `src-tauri/tests/unit_tests.rs` | SQLite connection, table schema creation, default seeding, transaction commit/rollback | 1 unit test |
| **Frontend Stores** | `src/test/dictation.test.ts` | Dictation lifecycle state machine, audio RMS reactivity, settings persistence | 3 unit tests |
| **Workspace Store** | `src/test/dictation.test.ts` | Dictionary state updates, snippet expansion, meeting notes parsing | 3 unit tests |

---

## 3. Regression Safeguards
1. **Never Delete Passing Tests**: Passing unit tests must never be removed or weakened to mask regressions.
2. **Deterministic Outputs**: Heuristic cleanup tests verify exact string comparisons without stochastic variation.
3. **Memory Safety**: SQLite tests verify that database connections are dropped and locks released cleanly.
