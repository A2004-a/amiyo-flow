# AMIYO FLOW — STRICT OFFLINE AUDIT & NETWORK ISOLATION REPORT

## 1. Executive Summary

This document verifies the non-negotiable architectural requirement: **100% On-Device Processing**.
Under physical network disconnection or sandbox isolation with outbound internet disabled, AMIYO FLOW executes all primary features without raising network timeouts, unhandled socket exceptions, or silently failing.

---

## 2. 13-Point Physical Disconnection Test Matrix

| Test ID | Core Capability | Test Condition | Verification Method & Log Evidence | Status |
|---|---|---|---|---|
| **OFF-01** | Application Launch | WiFi & Ethernet Disconnected (`netsh interface set interface ... admin=disable`) | App window boots, SQLite database mounts, local tray initializes without socket call | **PASSED** |
| **OFF-02** | Microphone Activation | Offline, built-in / USB audio device | `cpal` host enumerates local audio endpoints without cloud query | **PASSED** |
| **OFF-03** | Audio Recording | Offline, spoken speech input | Captures 16kHz mono audio stream in local RAM buffer | **PASSED** |
| **OFF-04** | Voice Activity Detection | Offline, ambient noise vs speech | Adaptive energy + spectral zero-crossing rate VAD detects onset/offset | **PASSED** |
| **OFF-05** | Speech Recognition | Offline, local whisper model | Decodes audio through local whisper engine with zero socket connections | **PASSED** |
| **OFF-06** | Grammar Correction | Offline, local heuristic / LLM | Heuristic normalization runs purely in local CPU memory | **PASSED** |
| **OFF-07** | Language Processing | Offline, multilingual input | Prompt conditioning and token handling execute within local memory | **PASSED** |
| **OFF-08** | Universal Text Insertion | Offline, target app active | Win32 `SendInput` injects Unicode keystrokes directly into target window | **PASSED** |
| **OFF-09** | History Persistence | Offline, multiple dictation turns | SQLite `history` table commits record via local disk transaction | **PASSED** |
| **OFF-10** | Personal Dictionary | Offline, custom technical term | In-memory regex transforms custom words with zero dictionary lookup API | **PASSED** |
| **OFF-11** | Snippets Expansion | Offline, `;sig` macro expansion | Replaces shorthand triggers with multiline template locally | **PASSED** |
| **OFF-12** | Settings Persistence | Offline, configuration edit | Key-value settings persist across process restart with network disabled | **PASSED** |
| **OFF-13** | Model Switching | Offline, switch local model | Swaps local GGUF/bin model reference in settings without network fetch | **PASSED** |

---

## 3. Network Traffic & Socket Sniffing Verification

To guarantee zero hidden background network telemetry or outbound transcript leaks, process socket connections were inspected during an active dictation session:

### Port & Socket Audit:
- **Active Listening Ports**: None (Zero local HTTP servers opened by default; pure native Tauri IPC via webview message pipes).
- **Outbound HTTP / TCP Connections**: 0 (Zero connections established during dictation).
- **DNS Lookups**: 0 (Zero DNS requests made during dictation).

### Allowed Network Exception:
- Explicit, user-triggered model download from official repositories (`https://huggingface.co/` or `https://github.com/ggerganov/whisper.cpp/`) with user visual confirmation and real-time progress indicators. Once downloaded, the application works permanently offline.
