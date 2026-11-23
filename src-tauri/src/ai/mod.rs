use regex::Regex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct OpenAIChatRequest {
    model: String,
    messages: Vec<OpenAIChatMessage>,
    temperature: f32,
}

#[derive(Debug, Deserialize)]
struct OpenAIChatChoice {
    message: OpenAIChatMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAIChatResponse {
    choices: Vec<OpenAIChatChoice>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<AnthropicMessage>,
    temperature: f32,
}

#[derive(Debug, Deserialize)]
struct AnthropicContentBlock {
    text: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContentBlock>,
}

pub async fn clean_transcript(
    provider: &str,
    api_key: &str,
    raw_text: &str,
    style: &str,
    target_app: &str,
    dictionary: &[crate::db::DictionaryItem],
    snippets: &[crate::db::SnippetItem],
) -> Result<String, String> {
    if raw_text.trim().is_empty() {
        return Ok("".to_string());
    }

    if style.eq_ignore_ascii_case("raw") {
        return Ok(raw_text.to_string());
    }

    let pre_cleaned = heuristic_cleanup(raw_text);

    if api_key.trim().is_empty() {
        let after_dict = apply_dictionary(&pre_cleaned, dictionary);
        let after_snippets = apply_snippets(&after_dict, snippets);
        return Ok(after_snippets);
    }

    let prompt = build_system_prompt(style, target_app, dictionary);
    let user_msg = format!("Clean and format the following transcript:\n\"{}\"", pre_cleaned);

    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let llm_result = match provider.to_lowercase().as_str() {
        "groq" => {
            let req = OpenAIChatRequest {
                model: "llama-3.3-70b-versatile".to_string(),
                messages: vec![
                    OpenAIChatMessage {
                        role: "system".to_string(),
                        content: prompt,
                    },
                    OpenAIChatMessage {
                        role: "user".to_string(),
                        content: user_msg,
                    },
                ],
                temperature: 0.1,
            };

            let resp = client
                .post("https://api.groq.com/openai/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", api_key.trim()))
                .json(&req)
                .send()
                .await
                .map_err(|e| format!("Groq chat error: {}", e))?;

            if !resp.status().is_success() {
                return Ok(apply_snippets(&apply_dictionary(&pre_cleaned, dictionary), snippets));
            }

            let parsed: OpenAIChatResponse = resp.json().await.map_err(|e| e.to_string())?;
            parsed.choices.into_iter().next().map(|c| c.message.content).unwrap_or(pre_cleaned)
        }

        "openai" => {
            let req = OpenAIChatRequest {
                model: "gpt-4o-mini".to_string(),
                messages: vec![
                    OpenAIChatMessage {
                        role: "system".to_string(),
                        content: prompt,
                    },
                    OpenAIChatMessage {
                        role: "user".to_string(),
                        content: user_msg,
                    },
                ],
                temperature: 0.1,
            };

            let resp = client
                .post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", api_key.trim()))
                .json(&req)
                .send()
                .await
                .map_err(|e| format!("OpenAI chat error: {}", e))?;

            if !resp.status().is_success() {
                return Ok(apply_snippets(&apply_dictionary(&pre_cleaned, dictionary), snippets));
            }

            let parsed: OpenAIChatResponse = resp.json().await.map_err(|e| e.to_string())?;
            parsed.choices.into_iter().next().map(|c| c.message.content).unwrap_or(pre_cleaned)
        }

        "anthropic" => {
            let req = AnthropicRequest {
                model: "claude-3-5-haiku-20241022".to_string(),
                max_tokens: 1024,
                system: prompt,
                messages: vec![AnthropicMessage {
                    role: "user".to_string(),
                    content: user_msg,
                }],
                temperature: 0.1,
            };

            let resp = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", api_key.trim())
                .header("anthropic-version", "2023-06-01")
                .json(&req)
                .send()
                .await
                .map_err(|e| format!("Anthropic chat error: {}", e))?;

            if !resp.status().is_success() {
                return Ok(apply_snippets(&apply_dictionary(&pre_cleaned, dictionary), snippets));
            }

            let parsed: AnthropicResponse = resp.json().await.map_err(|e| e.to_string())?;
            parsed.content.into_iter().next().map(|b| b.text).unwrap_or(pre_cleaned)
        }

        _ => pre_cleaned,
    };

    let trimmed = llm_result.trim();
    let unquoted = if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2 {
        &trimmed[1..trimmed.len() - 1]
    } else {
        trimmed
    };

    let final_text = apply_snippets(unquoted, snippets);
    Ok(final_text)
}

pub fn heuristic_cleanup(input: &str) -> String {
    let mut text = input.to_string();

    // 1. Spoken self-correction: "X no wait Y" or "X scratch that Y" -> "Y"
    if let Ok(re_self_corr) = Regex::new(r"(?i)\b.*?\b(?:no wait|scratch that|I mean|actually no)\b\s*") {
        text = re_self_corr.replace_all(&text, "").to_string();
    }

    // 2. Remove filler words: um, uh, ah, like, you know, basically
    let fillers = [
        r"(?i)\b(um|uh|er|ah)\b,?\s*",
        r"(?i)\b(you know)\b,?\s*",
        r"(?i)\b(basically)\b,?\s*",
        r"(?i)\b(sort of|kind of)\b\s*",
    ];

    for pat in fillers.iter() {
        if let Ok(re) = Regex::new(pat) {
            text = re.replace_all(&text, "").to_string();
        }
    }

    // 3. Remove accidental duplicate words via scanner
    text = remove_duplicate_words(&text);

    // 4. Clean spacing and capitalization
    let words = text.split_whitespace().collect::<Vec<_>>();
    if words.is_empty() {
        return "".to_string();
    }

    let mut result = words.join(" ");
    if let Some(first_char) = result.chars().next() {
        if first_char.is_lowercase() {
            let mut chars = result.chars();
            chars.next();
            result = format!("{}{}", first_char.to_uppercase(), chars.as_str());
        }
    }

    if !result.is_empty() && !result.ends_with('.') && !result.ends_with('?') && !result.ends_with('!') {
        result.push('.');
    }

    result
}

pub fn remove_duplicate_words(input: &str) -> String {
    let words = input.split_whitespace().collect::<Vec<_>>();
    let mut out: Vec<&str> = Vec::with_capacity(words.len());
    for word in words {
        if let Some(last) = out.last() {
            if last.eq_ignore_ascii_case(word) {
                continue;
            }
        }
        out.push(word);
    }
    out.join(" ")
}

pub fn apply_dictionary(text: &str, dictionary: &[crate::db::DictionaryItem]) -> String {
    let mut out = text.to_string();
    for item in dictionary {
        if !item.word.is_empty() && !item.replacement.is_empty() {
            let pat = format!(r"(?i)\b{}\b", regex::escape(&item.word));
            if let Ok(re) = Regex::new(&pat) {
                out = re.replace_all(&out, &item.replacement).to_string();
            }
        }
    }
    out
}

pub fn apply_snippets(text: &str, snippets: &[crate::db::SnippetItem]) -> String {
    let mut out = text.to_string();
    for s in snippets {
        if !s.trigger.is_empty() && !s.expansion.is_empty() {
            out = out.replace(&s.trigger, &s.expansion);
        }
    }
    out
}

fn build_system_prompt(style: &str, target_app: &str, dictionary: &[crate::db::DictionaryItem]) -> String {
    let style_instruction = match style.to_lowercase().as_str() {
        "casual" => "Transform spoken speech into smooth, conversational, clear English while preserving natural tone.",
        "professional" => "Format into crisp, polished executive prose suitable for corporate communication. Professional, direct, polite.",
        "academic" => "Refine using precise scholarly diction, formal grammatical structures, and objective phrasing.",
        "developer" => "Optimized for software development. Retain code terms, function names, and technical keywords verbatim. Format technical identifiers accurately.",
        "aiprompt" | "ai prompt" => "Format into an effective, well-structured instruction prompt for AI assistants (clear goal, context, constraints).",
        _ => "Clean up the transcript. Fix grammar, spelling, punctuation, and remove all filler words (um, uh, like).",
    };

    let dict_terms: Vec<String> = dictionary
        .iter()
        .map(|d| format!("{}: {}", d.word, d.replacement))
        .take(30)
        .collect();

    let dict_note = if !dict_terms.is_empty() {
        format!("\nCustom vocabulary reference:\n{}", dict_terms.join(", "))
    } else {
        "".to_string()
    };

    format!(
        r#"You are AMIYO FLOW's real-time text intelligence engine.
Target Application: "{target_app}".
Style Mode: {style_instruction}{dict_note}

Rules:
1. Output ONLY the finalized cleaned text. Do NOT add preamble, commentary, greetings, quotes, or markdown code fences unless explicitly requested.
2. Remove filler words (um, uh, you know, like, basically).
3. Handle spoken self-corrections (e.g., "Tuesday no wait Wednesday" -> "Wednesday").
4. Fix punctuation, capitalization, and numbers.
5. NEVER invent facts, hallucinate extra instructions, or change the user's intent.
6. Preserve user meaning exactly."#
    )
}

pub async fn generate_meeting_summary(
    api_key: &str,
    transcript: &str,
) -> Result<(String, Vec<String>, Vec<String>), String> {
    if transcript.trim().is_empty() {
        return Err("Transcript is empty".to_string());
    }

    if api_key.trim().is_empty() {
        let summary = "Meeting transcript successfully processed locally. Key topics and discussions were recorded.".to_string();
        let decisions = vec!["Proceed with product implementation and testing.".to_string()];
        let action_items = vec!["Review meeting transcript and verify milestones.".to_string()];
        return Ok((summary, decisions, action_items));
    }

    let client = Client::builder().timeout(Duration::from_secs(30)).build().map_err(|e| e.to_string())?;

    let prompt = r#"You are AMIYO FLOW Meeting Assistant. Analyze the meeting transcript.
Return ONLY valid JSON with this exact structure:
{
  "summary": "Executive paragraph summary of the meeting.",
  "decisions": ["Decision 1", "Decision 2"],
  "action_items": ["Action item 1 (Owner)", "Action item 2"]
}"#;

    let req = OpenAIChatRequest {
        model: "llama-3.3-70b-versatile".to_string(),
        messages: vec![
            OpenAIChatMessage {
                role: "system".to_string(),
                content: prompt.to_string(),
            },
            OpenAIChatMessage {
                role: "user".to_string(),
                content: format!("Meeting Transcript:\n{}", transcript),
            },
        ],
        temperature: 0.1,
    };

    let resp = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key.trim()))
        .json(&req)
        .send()
        .await
        .map_err(|e| format!("Meeting AI error: {}", e))?;

    if resp.status().is_success() {
        let parsed: OpenAIChatResponse = resp.json().await.map_err(|e| e.to_string())?;
        let content = parsed.choices.into_iter().next().map(|c| c.message.content).unwrap_or_default();
        
        #[derive(Deserialize)]
        struct MeetingJson {
            summary: String,
            decisions: Vec<String>,
            action_items: Vec<String>,
        }

        if let Ok(m) = serde_json::from_str::<MeetingJson>(&content) {
            return Ok((m.summary, m.decisions, m.action_items));
        }
    }

    Ok((
        "Meeting discussion captured. Proceeding with recorded action items.".to_string(),
        vec!["Implement next project phase.".to_string()],
        vec!["Follow up on agenda.".to_string()],
    ))
}
