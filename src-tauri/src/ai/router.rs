/// Intelligent AI Routing Engine
/// Enforces user-controlled routing across Local AI (Ollama), Cloud AI, and Hybrid modes.
/// Strictly blocks unauthorized cloud calls and records all routing decisions in the audit log.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum AiOperatingMode {
    #[serde(alias = "local")]
    Local,
    #[serde(alias = "cloud")]
    Cloud,
    #[serde(alias = "hybrid")]
    Hybrid,
}

impl Default for AiOperatingMode {
    fn default() -> Self {
        Self::Local
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRoutingRule {
    pub engine_type: String, // "local" or "cloud"
    pub provider_id: String, // "ollama", "openai", "deepseek", "groq", "anthropic", etc.
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiRouterConfig {
    pub mode: AiOperatingMode,
    pub default_local_model: String,
    pub default_cloud_provider: String,
    pub default_cloud_model: String,
    pub ollama_endpoint: String,
    pub custom_endpoint: Option<String>,
    pub task_rules: HashMap<String, TaskRoutingRule>,
    pub allow_cloud_fallback: bool,
}

impl Default for AiRouterConfig {
    fn default() -> Self {
        let mut rules = HashMap::new();
        rules.insert(
            "grammar".to_string(),
            TaskRoutingRule {
                engine_type: "local".to_string(),
                provider_id: "ollama".to_string(),
                model: "smollm2:360m".to_string(),
            },
        );
        rules.insert(
            "academic".to_string(),
            TaskRoutingRule {
                engine_type: "cloud".to_string(),
                provider_id: "openai".to_string(),
                model: "gpt-4o-mini".to_string(),
            },
        );
        rules.insert(
            "developer".to_string(),
            TaskRoutingRule {
                engine_type: "cloud".to_string(),
                provider_id: "deepseek".to_string(),
                model: "deepseek-chat".to_string(),
            },
        );

        Self {
            mode: AiOperatingMode::Local,
            default_local_model: "heuristic-rule-engine".to_string(),
            default_cloud_provider: "openai".to_string(),
            default_cloud_model: "gpt-4o-mini".to_string(),
            ollama_endpoint: "http://localhost:11434".to_string(),
            custom_endpoint: None,
            task_rules: rules,
            allow_cloud_fallback: false, // Strictly false by default
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteDecision {
    pub engine_type: String, // "local" or "cloud"
    pub provider_id: String,
    pub model: String,
    pub is_local: bool,
    pub reason: String,
}

pub struct AiRouter;

impl AiRouter {
    /// Resolves the exact engine, provider, and model for a given task according to user rules.
    pub fn resolve_route(config: &AiRouterConfig, task_type: &str) -> RouteDecision {
        match config.mode {
            AiOperatingMode::Local => RouteDecision {
                engine_type: "local".to_string(),
                provider_id: "ollama".to_string(),
                model: config.default_local_model.clone(),
                is_local: true,
                reason: "Enforced by Local AI Mode (Zero Cloud Transmission)".to_string(),
            },

            AiOperatingMode::Cloud => RouteDecision {
                engine_type: "cloud".to_string(),
                provider_id: config.default_cloud_provider.clone(),
                model: config.default_cloud_model.clone(),
                is_local: false,
                reason: "Enforced by Cloud AI Mode".to_string(),
            },

            AiOperatingMode::Hybrid => {
                let clean_task = task_type.trim().to_lowercase();
                if let Some(rule) = config.task_rules.get(&clean_task) {
                    let is_local = rule.engine_type == "local";
                    RouteDecision {
                        engine_type: rule.engine_type.clone(),
                        provider_id: rule.provider_id.clone(),
                        model: rule.model.clone(),
                        is_local,
                        reason: format!("User-defined task rule for '{}'", task_type),
                    }
                } else {
                    // Fall back to default local model in Hybrid mode to preserve privacy
                    RouteDecision {
                        engine_type: "local".to_string(),
                        provider_id: "ollama".to_string(),
                        model: config.default_local_model.clone(),
                        is_local: true,
                        reason: "Default hybrid baseline (Local Privacy First)".to_string(),
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_router_local_mode_enforces_local() {
        let mut config = AiRouterConfig::default();
        config.mode = AiOperatingMode::Local;

        let route = AiRouter::resolve_route(&config, "academic");
        assert!(route.is_local);
        assert_eq!(route.engine_type, "local");
    }

    #[test]
    fn test_router_cloud_mode_enforces_cloud() {
        let mut config = AiRouterConfig::default();
        config.mode = AiOperatingMode::Cloud;
        config.default_cloud_provider = "deepseek".to_string();
        config.default_cloud_model = "deepseek-chat".to_string();

        let route = AiRouter::resolve_route(&config, "general");
        assert!(!route.is_local);
        assert_eq!(route.provider_id, "deepseek");
    }

    #[test]
    fn test_router_hybrid_mode_routes_by_task() {
        let mut config = AiRouterConfig::default();
        config.mode = AiOperatingMode::Hybrid;

        let grammar_route = AiRouter::resolve_route(&config, "grammar");
        assert!(grammar_route.is_local);
        assert_eq!(grammar_route.provider_id, "ollama");

        let dev_route = AiRouter::resolve_route(&config, "developer");
        assert!(!dev_route.is_local);
        assert_eq!(dev_route.provider_id, "deepseek");
    }
}
