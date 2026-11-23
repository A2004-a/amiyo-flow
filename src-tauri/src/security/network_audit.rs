/// Privacy & Network Audit Log Engine
/// Tracks all outbound AI requests (metadata only).
/// Under NO circumstances are API keys, authorization headers, or private user text recorded.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkAuditEvent {
    pub id: String,
    pub timestamp: String,
    pub destination: String,
    pub is_local: bool,
    pub request_type: String,
    pub status: String,
    pub latency_ms: u64,
    pub approx_tokens: usize,
}

#[derive(Clone)]
pub struct NetworkAuditor {
    events: Arc<Mutex<Vec<NetworkAuditEvent>>>,
}

impl NetworkAuditor {
    pub fn new() -> Self {
        Self {
            events: Arc::new(Mutex::new(Vec::with_capacity(100))),
        }
    }

    pub fn record_event(
        &self,
        destination: &str,
        is_local: bool,
        request_type: &str,
        status: &str,
        latency_ms: u64,
        approx_tokens: usize,
    ) {
        let event = NetworkAuditEvent {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            destination: destination.to_string(),
            is_local,
            request_type: request_type.to_string(),
            status: status.to_string(),
            latency_ms,
            approx_tokens,
        };

        let mut lock = self.events.lock();
        if lock.len() >= 200 {
            lock.remove(0);
        }
        lock.push(event);
    }

    pub fn get_recent_events(&self, limit: usize) -> Vec<NetworkAuditEvent> {
        let lock = self.events.lock();
        lock.iter().rev().take(limit).cloned().collect()
    }

    pub fn clear_events(&self) {
        self.events.lock().clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_network_auditor_records_and_retrieves() {
        let auditor = NetworkAuditor::new();
        auditor.record_event("Ollama (127.0.0.1)", true, "Grammar Cleanup", "Success", 45, 28);
        auditor.record_event("OpenAI (api.openai.com)", false, "Advanced Style", "Success", 320, 42);

        let events = auditor.get_recent_events(10);
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].destination, "OpenAI (api.openai.com)");
        assert!(!events[0].is_local);
        assert_eq!(events[1].destination, "Ollama (127.0.0.1)");
        assert!(events[1].is_local);

        auditor.clear_events();
        assert_eq!(auditor.get_recent_events(10).len(), 0);
    }
}
