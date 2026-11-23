/// Native Local Ollama Client Integration
/// Connects to local Ollama runtime (default: http://localhost:11434)
/// Provides local model discovery, status inspection, and prompt generation.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub const DEFAULT_OLLAMA_ENDPOINT: &str = "http://localhost:11434";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaStatus {
    pub is_running: bool,
    pub version: String,
    pub endpoint: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModelItem {
    pub name: String,
    pub size_bytes: u64,
    pub size_human: String,
    pub modified_at: String,
    pub parameter_size: Option<String>,
    pub quantization_level: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaVersionResponse {
    version: String,
}

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Option<Vec<OllamaTagModel>>,
}

#[derive(Debug, Deserialize)]
struct OllamaTagModel {
    name: String,
    size: u64,
    modified_at: String,
    details: Option<OllamaModelDetails>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelDetails {
    parameter_size: Option<String>,
    quantization_level: Option<String>,
}

#[derive(Debug, Serialize)]
struct OllamaGenerateRequest {
    model: String,
    prompt: String,
    system: Option<String>,
    stream: bool,
    options: Option<OllamaOptions>,
}

#[derive(Debug, Serialize)]
struct OllamaOptions {
    temperature: f32,
    num_ctx: u32,
}

#[derive(Debug, Deserialize)]
struct OllamaGenerateResponse {
    response: String,
    #[allow(dead_code)]
    done: bool,
}

pub struct OllamaClient;

impl OllamaClient {
    fn build_client(timeout_secs: u64) -> Result<Client, String> {
        Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))
    }

    /// Checks if local Ollama server is running and queries its version.
    pub async fn check_status(endpoint: &str) -> OllamaStatus {
        let clean_endpoint = if endpoint.trim().is_empty() {
            DEFAULT_OLLAMA_ENDPOINT
        } else {
            endpoint.trim().trim_end_matches('/')
        };

        let client = match Self::build_client(2) {
            Ok(c) => c,
            Err(e) => {
                return OllamaStatus {
                    is_running: false,
                    version: "Unavailable".to_string(),
                    endpoint: clean_endpoint.to_string(),
                    error: Some(e),
                }
            }
        };

        let url = format!("{}/api/version", clean_endpoint);
        match client.get(&url).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    let ver: OllamaVersionResponse = resp.json().await.unwrap_or(OllamaVersionResponse {
                        version: "Detected".to_string(),
                    });
                    OllamaStatus {
                        is_running: true,
                        version: ver.version,
                        endpoint: clean_endpoint.to_string(),
                        error: None,
                    }
                } else {
                    OllamaStatus {
                        is_running: false,
                        version: "Offline".to_string(),
                        endpoint: clean_endpoint.to_string(),
                        error: Some(format!("Ollama returned status {}", resp.status())),
                    }
                }
            }
            Err(e) => OllamaStatus {
                is_running: false,
                version: "Not Running".to_string(),
                endpoint: clean_endpoint.to_string(),
                error: Some(format!("Local connection failed (Ollama may be stopped): {}", e)),
            },
        }
    }

    /// Lists installed models in the local Ollama instance.
    pub async fn list_installed_models(endpoint: &str) -> Result<Vec<OllamaModelItem>, String> {
        let clean_endpoint = if endpoint.trim().is_empty() {
            DEFAULT_OLLAMA_ENDPOINT
        } else {
            endpoint.trim().trim_end_matches('/')
        };

        let client = Self::build_client(3)?;
        let url = format!("{}/api/tags", clean_endpoint);

        let resp = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to reach local Ollama: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Ollama tags returned status {}", resp.status()));
        }

        let parsed: OllamaTagsResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse Ollama model tags: {}", e))?;

        let models = parsed
            .models
            .unwrap_or_default()
            .into_iter()
            .map(|m| {
                let mb = (m.size as f64) / (1024.0 * 1024.0);
                let human = if mb >= 1024.0 {
                    format!("{:.1} GB", mb / 1024.0)
                } else {
                    format!("{:.0} MB", mb)
                };

                let (param_size, quant) = if let Some(d) = m.details {
                    (d.parameter_size, d.quantization_level)
                } else {
                    (None, None)
                };

                OllamaModelItem {
                    name: m.name,
                    size_bytes: m.size,
                    size_human: human,
                    modified_at: m.modified_at,
                    parameter_size: param_size,
                    quantization_level: quant,
                }
            })
            .collect();

        Ok(models)
    }

    /// Executes prompt completion on local Ollama server with timeout and clean error reporting.
    pub async fn generate_text(
        endpoint: &str,
        model: &str,
        prompt: &str,
        system_prompt: Option<&str>,
        temperature: f32,
    ) -> Result<String, String> {
        let clean_endpoint = if endpoint.trim().is_empty() {
            DEFAULT_OLLAMA_ENDPOINT
        } else {
            endpoint.trim().trim_end_matches('/')
        };

        let client = Self::build_client(25)?;
        let url = format!("{}/api/generate", clean_endpoint);

        let req = OllamaGenerateRequest {
            model: model.to_string(),
            prompt: prompt.to_string(),
            system: system_prompt.map(|s| s.to_string()),
            stream: false,
            options: Some(OllamaOptions {
                temperature,
                num_ctx: 2048,
            }),
        };

        let resp = client
            .post(&url)
            .json(&req)
            .send()
            .await
            .map_err(|e| format!("Ollama local generation error: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();
            return Err(format!("Ollama generation failed ({}): {}", status, err_body));
        }

        let parsed: OllamaGenerateResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse Ollama generation output: {}", e))?;

        Ok(parsed.response.trim().to_string())
    }
}
