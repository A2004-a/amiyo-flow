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
    pub description: String,
    pub default_model: String,
    pub supported_models: Vec<String>,
    pub docs_url: String,
    pub endpoint: String,
    pub requires_custom_endpoint: bool,
    pub requires_key: bool,
}

pub fn list_supported_cloud_providers() -> Vec<CloudProviderMeta> {
    vec![
        CloudProviderMeta {
            id: "openai".to_string(),
            name: "OpenAI".to_string(),
            description: "Frontier multimodal, fast reasoning & official Whisper".to_string(),
            default_model: "gpt-4o-mini".to_string(),
            supported_models: vec![
                "gpt-4o".to_string(),
                "gpt-4o-mini".to_string(),
                "o1".to_string(),
                "o1-mini".to_string(),
                "o3-mini".to_string(),
                "gpt-4-turbo".to_string(),
                "gpt-4".to_string(),
                "gpt-3.5-turbo".to_string(),
                "whisper-1".to_string(),
            ],
            docs_url: "https://platform.openai.com/docs/models".to_string(),
            endpoint: "https://api.openai.com/v1/chat/completions".to_string(),
            requires_custom_endpoint: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "deepseek".to_string(),
            name: "DeepSeek".to_string(),
            description: "DeepSeek-V3 671B MoE and DeepSeek-R1 frontier reasoning".to_string(),
            default_model: "deepseek-chat".to_string(),
            supported_models: vec![
                "deepseek-chat".to_string(),
                "deepseek-reasoner".to_string(),
            ],
            docs_url: "https://platform.deepseek.com/docs".to_string(),
            endpoint: "https://api.deepseek.com/chat/completions".to_string(),
            requires_custom_endpoint: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "anthropic".to_string(),
            name: "Anthropic Claude".to_string(),
            description: "State-of-the-art intelligent formatting, coding & analysis".to_string(),
            default_model: "claude-3-5-haiku-20241022".to_string(),
            supported_models: vec![
                "claude-3-5-sonnet-20241022".to_string(),
                "claude-3-5-haiku-20241022".to_string(),
                "claude-3-opus-20240229".to_string(),
                "claude-3-sonnet-20240229".to_string(),
                "claude-3-haiku-20240307".to_string(),
            ],
            docs_url: "https://docs.anthropic.com/en/docs/about-claude/models".to_string(),
            endpoint: "https://api.anthropic.com/v1/messages".to_string(),
            requires_custom_endpoint: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "gemini".to_string(),
            name: "Google Gemini".to_string(),
            description: "Next-generation fast multimodal with up to 2M context".to_string(),
            default_model: "gemini-2.0-flash".to_string(),
            supported_models: vec![
                "gemini-2.0-flash".to_string(),
                "gemini-2.0-flash-lite".to_string(),
                "gemini-1.5-flash".to_string(),
                "gemini-1.5-flash-8b".to_string(),
                "gemini-1.5-pro".to_string(),
                "gemini-1.0-pro".to_string(),
            ],
            docs_url: "https://ai.google.dev/gemini-api/docs/models/gemini".to_string(),
            endpoint: "https://generativelanguage.googleapis.com/v1beta/models".to_string(),
            requires_custom_endpoint: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "groq".to_string(),
            name: "Groq Cloud".to_string(),
            description: "Ultra-low latency LPU inference with 250+ tokens/sec".to_string(),
            default_model: "llama-3.3-70b-versatile".to_string(),
            supported_models: vec![
                "llama-3.3-70b-versatile".to_string(),
                "llama-3.1-8b-instant".to_string(),
                "llama-3.2-1b-preview".to_string(),
                "llama-3.2-3b-preview".to_string(),
                "deepseek-r1-distill-llama-70b".to_string(),
                "mixtral-8x7b-32768".to_string(),
                "gemma2-9b-it".to_string(),
                "whisper-large-v3-turbo".to_string(),
                "whisper-large-v3".to_string(),
            ],
            docs_url: "https://console.groq.com/docs/models".to_string(),
            endpoint: "https://api.groq.com/openai/v1/chat/completions".to_string(),
            requires_custom_endpoint: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "openrouter".to_string(),
            name: "OpenRouter".to_string(),
            description: "Unified routing across 200+ frontier & open-source models".to_string(),
            default_model: "meta-llama/llama-3.3-70b-instruct".to_string(),
            supported_models: vec![
                "meta-llama/llama-3.3-70b-instruct".to_string(),
                "anthropic/claude-3.5-sonnet".to_string(),
                "anthropic/claude-3.5-haiku".to_string(),
                "deepseek/deepseek-r1".to_string(),
                "deepseek/deepseek-chat".to_string(),
                "openai/gpt-4o".to_string(),
                "openai/gpt-4o-mini".to_string(),
                "google/gemini-2.0-flash-001".to_string(),
                "mistralai/mistral-large-2411".to_string(),
                "qwen/qwen-2.5-72b-instruct".to_string(),
            ],
            docs_url: "https://openrouter.ai/models".to_string(),
            endpoint: "https://openrouter.ai/api/v1/chat/completions".to_string(),
            requires_custom_endpoint: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "mistral".to_string(),
            name: "Mistral AI".to_string(),
            description: "Enterprise multilingual, code reasoning, and vision".to_string(),
            default_model: "mistral-small-latest".to_string(),
            supported_models: vec![
                "mistral-large-latest".to_string(),
                "mistral-small-latest".to_string(),
                "codestral-latest".to_string(),
                "ministral-8b-latest".to_string(),
                "ministral-3b-latest".to_string(),
                "pixtral-large-latest".to_string(),
                "open-mistral-nemo".to_string(),
            ],
            docs_url: "https://docs.mistral.ai/getting-started/models/".to_string(),
            endpoint: "https://api.mistral.ai/v1/chat/completions".to_string(),
            requires_custom_endpoint: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "together".to_string(),
            name: "Together AI".to_string(),
            description: "Fast open-source model inference & fine-tuned hosting".to_string(),
            default_model: "meta-llama/Llama-3.3-70B-Instruct-Turbo".to_string(),
            supported_models: vec![
                "meta-llama/Llama-3.3-70B-Instruct-Turbo".to_string(),
                "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo".to_string(),
                "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo".to_string(),
                "deepseek-ai/DeepSeek-R1".to_string(),
                "deepseek-ai/DeepSeek-V3".to_string(),
                "Qwen/Qwen2.5-72B-Instruct-Turbo".to_string(),
                "mistralai/Mixtral-8x7B-Instruct-v0.1".to_string(),
            ],
            docs_url: "https://docs.together.ai/docs/inference-models".to_string(),
            endpoint: "https://api.together.xyz/v1/chat/completions".to_string(),
            requires_custom_endpoint: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "fireworks".to_string(),
            name: "Fireworks AI".to_string(),
            description: "Sub-second generative inference for enterprise LLMs".to_string(),
            default_model: "accounts/fireworks/models/llama-v3p3-70b-instruct".to_string(),
            supported_models: vec![
                "accounts/fireworks/models/llama-v3p3-70b-instruct".to_string(),
                "accounts/fireworks/models/llama-v3p1-8b-instruct".to_string(),
                "accounts/fireworks/models/llama-v3p1-70b-instruct".to_string(),
                "accounts/fireworks/models/deepseek-r1".to_string(),
                "accounts/fireworks/models/deepseek-v3".to_string(),
                "accounts/fireworks/models/qwen2p5-72b-instruct".to_string(),
            ],
            docs_url: "https://docs.fireworks.ai/models".to_string(),
            endpoint: "https://api.fireworks.ai/inference/v1/chat/completions".to_string(),
            requires_custom_endpoint: false,
            requires_key: true,
        },
        CloudProviderMeta {
            id: "custom".to_string(),
            name: "Custom OpenAI-Compatible API".to_string(),
            description: "Local or private gateway (vLLM, LM Studio, Ollama, LocalAI)".to_string(),
            default_model: "default".to_string(),
            supported_models: vec![
                "default".to_string(),
                "llama3".to_string(),
                "mistral".to_string(),
                "qwen2.5".to_string(),
                "deepseek-r1".to_string(),
                "custom".to_string(),
            ],
            docs_url: "https://github.com/vllm-project/vllm".to_string(),
            endpoint: "http://localhost:1234/v1/chat/completions".to_string(),
            requires_custom_endpoint: true,
            requires_key: false,
        },
    ]
}

// Internal structures for OpenAI-compatible completions
#[derive(Serialize)]
struct ChatCompletionMessage {
    role: String,
    content: String,
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

/// Strips internal model reasoning/scratchpad blocks (e.g. DeepSeek R1 <think>...</think> or Claude <thinking>...</thinking>)
pub fn strip_reasoning_tags(text: &str) -> String {
    let re_think = regex::Regex::new(r"(?s)<think>.*?</think>").unwrap();
    let cleaned = re_think.replace_all(text, "").to_string();
    let re_thinking = regex::Regex::new(r"(?s)<thinking>.*?</thinking>").unwrap();
    let cleaned = re_thinking.replace_all(&cleaned, "").to_string();
    cleaned.trim().to_string()
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
                Ok(strip_reasoning_tags(&text))
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

                Ok(strip_reasoning_tags(&text))
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

                let is_o_series = resolved_model.starts_with("o1") || resolved_model.starts_with("o3");
                let req_json = if is_o_series {
                    let mut mapped = Vec::new();
                    for m in messages {
                        mapped.push(ChatCompletionMessage {
                            role: if m.role == "system" { "user".to_string() } else { m.role },
                            content: m.content,
                        });
                    }
                    serde_json::json!({
                        "model": resolved_model,
                        "messages": mapped,
                        "max_completion_tokens": 1024
                    })
                } else {
                    serde_json::json!({
                        "model": resolved_model,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": 1024
                    })
                };

                let mut req_builder = client
                    .post(&endpoint)
                    .header("Authorization", format!("Bearer {}", clean_key))
                    .json(&req_json);

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

                Ok(strip_reasoning_tags(&text))
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

    /// Tests connection and authentication with the given provider and selected model
    pub async fn test_connection(
        provider_id: &str,
        api_key: &str,
        model: Option<&str>,
        custom_endpoint: Option<&str>,
    ) -> Result<String, String> {
        let test_model = model.unwrap_or("");
        let start = std::time::Instant::now();
        let _ = Self::complete(
            provider_id,
            api_key,
            test_model,
            "Respond with 'OK'",
            Some("You are an automated connectivity verification agent. Return ONLY 'OK'."),
            custom_endpoint,
            0.0,
        )
        .await?;
        let latency = start.elapsed().as_millis();
        let resolved_model = if test_model.is_empty() {
            Self::default_model(provider_id)
        } else {
            test_model.to_string()
        };
        Ok(format!("Connected to {} ({}) in {}ms", provider_id.to_uppercase(), resolved_model, latency))
    }

    /// Transcribes audio using cloud Whisper API (e.g. Groq Whisper Large V3 or OpenAI Whisper-1)
    pub async fn transcribe_audio(
        provider_id: &str,
        api_key: &str,
        wav_bytes: Vec<u8>,
        language: Option<&str>,
        prompt: Option<&str>,
    ) -> Result<String, String> {
        let clean_key = api_key.trim();
        if clean_key.is_empty() {
            return Err("Missing API key for cloud audio transcription".to_string());
        }

        let (url, model) = match provider_id.to_lowercase().as_str() {
            "groq" => (
                "https://api.groq.com/openai/v1/audio/transcriptions",
                "whisper-large-v3-turbo",
            ),
            "openai" => (
                "https://api.openai.com/v1/audio/transcriptions",
                "whisper-1",
            ),
            _ => (
                "https://api.groq.com/openai/v1/audio/transcriptions",
                "whisper-large-v3-turbo",
            ),
        };

        let client = Self::build_client(30)?;

        let part = reqwest::multipart::Part::bytes(wav_bytes)
            .file_name("dictation.wav")
            .mime_str("audio/wav")
            .map_err(|e| format!("Mime error: {}", e))?;

        let mut form = reqwest::multipart::Form::new()
            .part("file", part)
            .text("model", model.to_string())
            .text("response_format", "json".to_string());

        if let Some(lang) = language {
            if lang != "auto" && !lang.is_empty() {
                form = form.text("language", lang.to_string());
            }
        }
        if let Some(p) = prompt {
            if !p.is_empty() {
                form = form.text("prompt", p.to_string());
            }
        }

        let res = client
            .post(url)
            .bearer_auth(clean_key)
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("Audio transcription request failed: {}", e))?;

        if !res.status().is_success() {
            let status = res.status();
            let err_body = res.text().await.unwrap_or_default();
            return Err(format!("Cloud transcription failed ({}): {}", status, err_body));
        }

        #[derive(Deserialize)]
        struct TranscriptionResp {
            text: Option<String>,
        }

        let body: TranscriptionResp = res
            .json()
            .await
            .map_err(|e| format!("Failed to parse transcription response: {}", e))?;

        Ok(body.text.unwrap_or_default().trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_reasoning_tags() {
        let input = "<think>\nThinking about grammar...\nFixing comma.\n</think>Hello world, this is a test.";
        let cleaned = strip_reasoning_tags(input);
        assert_eq!(cleaned, "Hello world, this is a test.");

        let input_thinking = "<thinking>Analyze punctuation</thinking>Deployment succeeded.";
        let cleaned2 = strip_reasoning_tags(input_thinking);
        assert_eq!(cleaned2, "Deployment succeeded.");

        let regular = "Regular output without thinking tags.";
        assert_eq!(strip_reasoning_tags(regular), regular);
    }
}
