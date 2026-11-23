/// Cloud AI Provider Adapter Architecture
/// Implements individual adapters for:
/// OpenAI, DeepSeek, Anthropic, Google Gemini, Groq, OpenRouter, Mistral, Together AI, Fireworks AI, and Custom endpoints.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudProviderMeta {
    pub id: String,
    pub name: String,
    pub default_model: String,
    pub supported_models: Vec<String>,
    pub endpoint: String,
    pub is_custom: bool,
    pub requires_key: bool,
}

pub fn list_supported_cloud_providers() -> Vec<CloudProviderMeta> {
    vec![
        CloudProviderMeta {
            id: "openai".to_string(),
            name: "OpenAI".to_string(),
            default_model: "gpt-4o-mini".to_string(),
            supported_models: vec!["gpt-4o-mini".to_string(), "gpt-4o".to_string(), "gpt-3.5-turbo".to_string()],
            endpoint: "https://api.openai.com/v1/chat/completions".to_string(),
            is_custom: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "deepseek".to_string(),
            name: "DeepSeek".to_string(),
            default_model: "deepseek-chat".to_string(),
            supported_models: vec!["deepseek-chat".to_string(), "deepseek-reasoner".to_string()],
            endpoint: "https://api.deepseek.com/chat/completions".to_string(),
            is_custom: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "anthropic".to_string(),
            name: "Anthropic Claude".to_string(),
            default_model: "claude-3-5-haiku-20241022".to_string(),
            supported_models: vec!["claude-3-5-haiku-20241022".to_string(), "claude-3-5-sonnet-20241022".to_string()],
            endpoint: "https://api.anthropic.com/v1/messages".to_string(),
            is_custom: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "gemini".to_string(),
            name: "Google Gemini".to_string(),
            default_model: "gemini-1.5-flash".to_string(),
            supported_models: vec!["gemini-1.5-flash".to_string(), "gemini-1.5-pro".to_string(), "gemini-2.0-flash".to_string()],
            endpoint: "https://generativelanguage.googleapis.com/v1beta/models".to_string(),
            is_custom: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "groq".to_string(),
            name: "Groq Cloud".to_string(),
            default_model: "llama-3.3-70b-versatile".to_string(),
            supported_models: vec!["llama-3.3-70b-versatile".to_string(), "llama-3.1-8b-instant".to_string(), "mixtral-8x7b-32768".to_string()],
            endpoint: "https://api.groq.com/openai/v1/chat/completions".to_string(),
            is_custom: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "openrouter".to_string(),
            name: "OpenRouter".to_string(),
            default_model: "meta-llama/llama-3.3-70b-instruct".to_string(),
            supported_models: vec![
                "meta-llama/llama-3.3-70b-instruct".to_string(),
                "anthropic/claude-3.5-haiku".to_string(),
                "deepseek/deepseek-chat".to_string(),
            ],
            endpoint: "https://openrouter.ai/api/v1/chat/completions".to_string(),
            is_custom: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "mistral".to_string(),
            name: "Mistral AI".to_string(),
            default_model: "mistral-small-latest".to_string(),
            supported_models: vec!["mistral-small-latest".to_string(), "mistral-large-latest".to_string()],
            endpoint: "https://api.mistral.ai/v1/chat/completions".to_string(),
            is_custom: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "together".to_string(),
            name: "Together AI".to_string(),
            default_model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo".to_string(),
            supported_models: vec!["meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo".to_string(), "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo".to_string()],
            endpoint: "https://api.together.xyz/v1/chat/completions".to_string(),
            is_custom: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "fireworks".to_string(),
            name: "Fireworks AI".to_string(),
            default_model: "accounts/fireworks/models/llama-v3p1-8b-instruct".to_string(),
            supported_models: vec!["accounts/fireworks/models/llama-v3p1-8b-instruct".to_string(), "accounts/fireworks/models/llama-v3p3-70b-instruct".to_string()],
            endpoint: "https://api.fireworks.ai/inference/v1/chat/completions".to_string(),
            is_custom: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "custom".to_string(),
            name: "Custom OpenAI-Compatible API".to_string(),
            default_model: "default".to_string(),
            supported_models: vec!["default".to_string()],
            endpoint: "https://api.example.com/v1/chat/completions".to_string(),
            is_custom: true,
            requires_key: true,
        },
    ]
}

// Internal structures for OpenAI-compatible completions
#[derive(Serialize)]
struct ChatCompletionMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatCompletionMessage>,
    temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Deserialize)]
struct ChatResponseMessage {
    content: Option<String>,
}

// Anthropic messages schema
#[derive(Serialize)]
struct AnthropicReq {
    model: String,
    max_tokens: u32,
    system: Option<String>,
    messages: Vec<AnthropicMsg>,
    temperature: f32,
}

#[derive(Serialize)]
struct AnthropicMsg {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct AnthropicResp {
    content: Vec<AnthropicBlock>,
}

#[derive(Deserialize)]
struct AnthropicBlock {
    text: Option<String>,
}

// Gemini generateContent schema
#[derive(Serialize)]
struct GeminiReq {
    contents: Vec<GeminiContent>,
}

#[derive(Serialize)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Deserialize)]
struct GeminiResp {
    candidates: Option<Vec<GeminiCandidate>>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContentOut>,
}

#[derive(Deserialize)]
struct GeminiContentOut {
    parts: Option<Vec<GeminiPartOut>>,
}

#[derive(Deserialize)]
struct GeminiPartOut {
    text: Option<String>,
}

pub struct CloudAIClient;

impl CloudAIClient {
    fn build_client(timeout_secs: u64) -> Result<Client, String> {
        Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()
            .map_err(|e| format!("Failed to build HTTPS client: {}", e))
    }

    /// Dispatches prompt to the specified authorized cloud AI provider
    pub async fn complete(
        provider_id: &str,
        api_key: &str,
        model: &str,
        prompt: &str,
        system_prompt: Option<&str>,
        custom_endpoint: Option<&str>,
        temperature: f32,
    ) -> Result<String, String> {
        let clean_key = api_key.trim();
        if clean_key.is_empty() {
            return Err(format!("No API key configured for {}", provider_id));
        }

        let client = Self::build_client(25)?;

        match provider_id.to_lowercase().as_str() {
            "anthropic" => {
                let url = "https://api.anthropic.com/v1/messages";
                let req = AnthropicReq {
                    model: if model.is_empty() { "claude-3-5-haiku-20241022".to_string() } else { model.to_string() },
                    max_tokens: 1024,
                    system: system_prompt.map(|s| s.to_string()),
                    messages: vec![AnthropicMsg {
                        role: "user".to_string(),
                        content: prompt.to_string(),
                    }],
                    temperature,
                };

                let resp = client
                    .post(url)
                    .header("x-api-key", clean_key)
                    .header("anthropic-version", "2023-06-01")
                    .json(&req)
                    .send()
                    .await
                    .map_err(|e| format!("Anthropic request failed: {}", e))?;

                if !resp.status().is_success() {
                    let status = resp.status();
                    let err = resp.text().await.unwrap_or_default();
                    return Err(format!("Anthropic API error ({}): {}", status, err));
                }

                let parsed: AnthropicResp = resp.json().await.map_err(|e| format!("Anthropic parse error: {}", e))?;
                let text = parsed.content.into_iter().filter_map(|b| b.text).collect::<Vec<_>>().join("");
                Ok(text.trim().to_string())
            }

            "gemini" => {
                let m = if model.is_empty() { "gemini-1.5-flash" } else { model };
                let url = format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                    m, clean_key
                );

                let full_prompt = if let Some(sys) = system_prompt {
                    format!("{}\n\n{}", sys, prompt)
                } else {
                    prompt.to_string()
                };

                let req = GeminiReq {
                    contents: vec![GeminiContent {
                        parts: vec![GeminiPart { text: full_prompt }],
                    }],
                };

                let resp = client
                    .post(&url)
                    .json(&req)
                    .send()
                    .await
                    .map_err(|e| format!("Gemini request failed: {}", e))?;

                if !resp.status().is_success() {
                    let status = resp.status();
                    let err = resp.text().await.unwrap_or_default();
                    return Err(format!("Gemini API error ({}): {}", status, err));
                }

                let parsed: GeminiResp = resp.json().await.map_err(|e| format!("Gemini parse error: {}", e))?;
                let text = parsed
                    .candidates
                    .and_then(|c| c.into_iter().next())
                    .and_then(|c| c.content)
                    .and_then(|c| c.parts)
                    .and_then(|p| p.into_iter().next())
                    .and_then(|p| p.text)
                    .unwrap_or_default();

                Ok(text.trim().to_string())
            }

            // OpenAI and standard OpenAI-compatible endpoints: DeepSeek, Groq, OpenRouter, Mistral, Together, Fireworks, Custom
            _ => {
                let endpoint = if let Some(cust) = custom_endpoint {
                    if !cust.trim().is_empty() { cust.trim().to_string() } else { Self::default_endpoint(provider_id) }
                } else {
                    Self::default_endpoint(provider_id)
                };

                let mut messages = Vec::new();
                if let Some(sys) = system_prompt {
                    messages.push(ChatCompletionMessage {
                        role: "system".to_string(),
                        content: sys.to_string(),
                    });
                }
                messages.push(ChatCompletionMessage {
                    role: "user".to_string(),
                    content: prompt.to_string(),
                });

                let resolved_model = if model.is_empty() {
                    Self::default_model(provider_id)
                } else {
                    model.to_string()
                };

                let req = ChatCompletionRequest {
                    model: resolved_model,
                    messages,
                    temperature,
                    max_tokens: Some(1024),
                };

                let mut req_builder = client
                    .post(&endpoint)
                    .header("Authorization", format!("Bearer {}", clean_key))
                    .json(&req);

                if provider_id == "openrouter" {
                    req_builder = req_builder
                        .header("HTTP-Referer", "https://amiyo-flow.local")
                        .header("X-Title", "AMIYO FLOW");
                }

                let resp = req_builder.send().await.map_err(|e| format!("Cloud request failed: {}", e))?;

                if !resp.status().is_success() {
                    let status = resp.status();
                    let err = resp.text().await.unwrap_or_default();
                    return Err(format!("{} API error ({}): {}", provider_id, status, err));
                }

                let parsed: ChatCompletionResponse = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
                let text = parsed
                    .choices
                    .into_iter()
                    .next()
                    .and_then(|c| c.message.content)
                    .unwrap_or_default();

                Ok(text.trim().to_string())
            }
        }
    }

    fn default_endpoint(provider: &str) -> String {
        match provider.to_lowercase().as_str() {
            "openai" => "https://api.openai.com/v1/chat/completions".to_string(),
            "deepseek" => "https://api.deepseek.com/chat/completions".to_string(),
            "groq" => "https://api.groq.com/openai/v1/chat/completions".to_string(),
            "openrouter" => "https://openrouter.ai/api/v1/chat/completions".to_string(),
            "mistral" => "https://api.mistral.ai/v1/chat/completions".to_string(),
            "together" => "https://api.together.xyz/v1/chat/completions".to_string(),
            "fireworks" => "https://api.fireworks.ai/inference/v1/chat/completions".to_string(),
            _ => "https://api.openai.com/v1/chat/completions".to_string(),
        }
    }

    fn default_model(provider: &str) -> String {
        match provider.to_lowercase().as_str() {
            "openai" => "gpt-4o-mini".to_string(),
            "deepseek" => "deepseek-chat".to_string(),
            "groq" => "llama-3.3-70b-versatile".to_string(),
            "openrouter" => "meta-llama/llama-3.3-70b-instruct".to_string(),
            "mistral" => "mistral-small-latest".to_string(),
            "together" => "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo".to_string(),
            "fireworks" => "accounts/fireworks/models/llama-v3p1-8b-instruct".to_string(),
            _ => "default".to_string(),
        }
    }

    /// Tests connection and authentication with the given provider using a lightweight ping
    pub async fn test_connection(
        provider_id: &str,
        api_key: &str,
        custom_endpoint: Option<&str>,
    ) -> Result<String, String> {
        Self::complete(
            provider_id,
            api_key,
            "",
            "Respond with 'OK'",
            Some("You are an automated connectivity verification agent. Return ONLY 'OK'."),
            custom_endpoint,
            0.0,
        )
        .await
    }
}
