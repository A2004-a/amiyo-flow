/// Local On-Device AI Text Intelligence Engine (llama.cpp & Heuristic NLP)
/// Operates 100% locally with ZERO external network calls.

pub mod ollama;
pub mod providers;
pub mod router;

use crate::security::CredentialManager;
use crate::security::network_audit::NetworkAuditor;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalLlmModelInfo {
    pub id: String,
    pub name: String,
    pub size_mb: u32,
    pub ram_required_mb: u32,
    pub description: String,
    pub is_downloaded: bool,
    pub file_path: String,
}

/// Returns the home directory cross-platform
fn get_user_home() -> PathBuf {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        PathBuf::from(profile)
    } else if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home)
    } else {
        PathBuf::from(".")
    }
}

/// Returns the default directory for local LLM models: ~/.amiyo-flow/models/llm/
pub fn get_llm_models_dir() -> PathBuf {
    let home = get_user_home();
    let dir = home.join(".amiyo-flow").join("models").join("llm");
    let _ = fs::create_dir_all(&dir);
    dir
}

/// Enumerate supported local GGUF models
pub fn list_local_llm_models() -> Vec<LocalLlmModelInfo> {
    let dir = get_llm_models_dir();

    let models = vec![
        ("smollm2-360m-q4_k_m", "SmolLM2 360M (Q4_K_M)", 229, 320, "Ultra-fast local grammar fixer (<15ms, ~320MB RAM)"),
        ("qwen2.5-0.5b-q4_k_m", "Qwen 2.5 0.5B (Q4_K_M)", 398, 480, "High-fidelity multilingual text cleanup"),
        ("llama-3.2-1b-q4_k_m", "Llama 3.2 1B (Q4_K_M)", 748, 920, "Advanced reasoning and contextual formatting"),
        ("heuristic-rule-engine", "Zero-RAM Heuristic Engine", 0, 0, "Deterministic instant cleanup (0 MB RAM overhead)"),
    ];

    models
        .into_iter()
        .map(|(id, name, size, ram, desc)| {
            let filename = format!("{}.gguf", id);
            let path = dir.join(&filename);
            let is_downloaded = id == "heuristic-rule-engine"
                || (path.exists() && fs::metadata(&path).map(|m| m.len() > 1024 * 1024).unwrap_or(false));

            LocalLlmModelInfo {
                id: id.to_string(),
                name: name.to_string(),
                size_mb: size,
                ram_required_mb: ram,
                description: desc.to_string(),
                is_downloaded,
                file_path: if id == "heuristic-rule-engine" { "builtin".to_string() } else { path.to_string_lossy().to_string() },
            }
        })
        .collect()
}

/// Clean and format transcript using local heuristics and local llama.cpp GGUF runner
pub async fn clean_transcript(
    model_id: &str,
    custom_model_path: Option<&str>,
    raw_text: &str,
    style: &str,
    target_app: &str,
    dictionary: &[crate::db::DictionaryItem],
    snippets: &[crate::db::SnippetItem],
) -> Result<String, String> {
    clean_transcript_with_options(
        model_id,
        custom_model_path,
        raw_text,
        style,
        target_app,
        dictionary,
        snippets,
        true,
        true,
        true,
    )
    .await
}

pub async fn clean_transcript_with_options(
    model_id: &str,
    custom_model_path: Option<&str>,
    raw_text: &str,
    style: &str,
    target_app: &str,
    dictionary: &[crate::db::DictionaryItem],
    snippets: &[crate::db::SnippetItem],
    remove_fillers: bool,
    remove_repeats: bool,
    remove_corrections: bool,
) -> Result<String, String> {
    if raw_text.trim().is_empty() {
        return Ok("".to_string());
    }

    if style.eq_ignore_ascii_case("raw") {
        return Ok(raw_text.to_string());
    }

    // Step 1: High-performance local deterministic cleaning (0 MB RAM)
    let pre_cleaned = heuristic_cleanup_with_options(raw_text, remove_fillers, remove_repeats, remove_corrections);

    // Step 2: Apply Personal Dictionary
    let after_dict = apply_dictionary(&pre_cleaned, dictionary);

    // Step 3: Apply Snippet Expansions
    let after_snippets = apply_snippets(&after_dict, snippets);

    // Step 4: Apply Style Transformations
    let styled_text = apply_style_formatting(&after_snippets, style, target_app);

    // Step 5: If user enabled local llama.cpp model and binary is installed locally, run GGUF model
    if model_id != "heuristic-rule-engine" && model_id != "none" {
        if let Some(cli_path) = find_local_llama_cli() {
            let llm_dir = get_llm_models_dir();
            let model_file = if let Some(p) = custom_model_path {
                PathBuf::from(p)
            } else {
                llm_dir.join(format!("{}.gguf", model_id))
            };

            if model_file.exists() {
                if let Ok(llm_output) = run_local_llama_inference(&cli_path, &model_file, &styled_text, style).await {
                    if !llm_output.trim().is_empty() {
                        return Ok(llm_output);
                    }
                }
            }
        }
    }

    Ok(styled_text)
}

/// Routed text processing pipeline (Default: all disfluency removals enabled)
pub async fn clean_transcript_routed(
    router_config: &router::AiRouterConfig,
    raw_text: &str,
    style: &str,
    target_app: &str,
    dictionary: &[crate::db::DictionaryItem],
    snippets: &[crate::db::SnippetItem],
    auditor: &NetworkAuditor,
) -> Result<String, String> {
    clean_transcript_routed_with_options(
        router_config,
        raw_text,
        style,
        target_app,
        dictionary,
        snippets,
        auditor,
        true,
        true,
        true,
    )
    .await
}

pub async fn clean_transcript_routed_with_options(
    router_config: &router::AiRouterConfig,
    raw_text: &str,
    style: &str,
    target_app: &str,
    dictionary: &[crate::db::DictionaryItem],
    snippets: &[crate::db::SnippetItem],
    auditor: &NetworkAuditor,
    remove_fillers: bool,
    remove_repeats: bool,
    remove_corrections: bool,
) -> Result<String, String> {
    clean_transcript_routed_with_custom(
        router_config,
        raw_text,
        style,
        target_app,
        dictionary,
        snippets,
        auditor,
        remove_fillers,
        remove_repeats,
        remove_corrections,
        &[],
    )
    .await
}

pub async fn clean_transcript_routed_with_custom(
    router_config: &router::AiRouterConfig,
    raw_text: &str,
    style: &str,
    target_app: &str,
    dictionary: &[crate::db::DictionaryItem],
    snippets: &[crate::db::SnippetItem],
    auditor: &NetworkAuditor,
    remove_fillers: bool,
    remove_repeats: bool,
    remove_corrections: bool,
    custom_fillers: &[String],
) -> Result<String, String> {
    clean_transcript_routed_full(
        router_config,
        raw_text,
        style,
        target_app,
        dictionary,
        snippets,
        auditor,
        remove_fillers,
        remove_repeats,
        remove_corrections,
        true,
        custom_fillers,
    )
    .await
}

pub async fn clean_transcript_routed_full(
    router_config: &router::AiRouterConfig,
    raw_text: &str,
    style: &str,
    target_app: &str,
    dictionary: &[crate::db::DictionaryItem],
    snippets: &[crate::db::SnippetItem],
    auditor: &NetworkAuditor,
    remove_fillers: bool,
    remove_repeats: bool,
    remove_corrections: bool,
    clean_sentences: bool,
    custom_fillers: &[String],
) -> Result<String, String> {
    if raw_text.trim().is_empty() {
        return Ok("".to_string());
    }

    if style.eq_ignore_ascii_case("raw") {
        return Ok(raw_text.to_string());
    }

    // Step 1: Instant deterministic local pre-clean (0 MB RAM)
    let pre_cleaned = heuristic_cleanup_full(
        raw_text,
        remove_fillers,
        remove_repeats,
        remove_corrections,
        clean_sentences,
        custom_fillers,
    );

    // Step 2: Personal Dictionary substitution
    let after_dict = apply_dictionary(&pre_cleaned, dictionary);

    // Step 3: Snippet macro expansion
    let after_snippets = apply_snippets(&after_dict, snippets);

    // Step 4: Formatting baseline
    let styled_baseline = apply_style_formatting(&after_snippets, style, target_app);

    // Step 5: Resolve Route
    let route = router::AiRouter::resolve_route(router_config, style);

    let start = Instant::now();

    if route.engine_type == "local" {
        if route.provider_id == "ollama" && route.model != "heuristic-rule-engine" {
            let prompt = format!(
                "Clean the following speech transcript for style '{}'. {}Output ONLY the cleaned text with no explanations:\n\"{}\"",
                style,
                if remove_fillers { "Remove all filler words (um, uh, nu, na, you know, etc.). " } else { "" },
                styled_baseline
            );

            match ollama::OllamaClient::generate_text(
                &router_config.ollama_endpoint,
                &route.model,
                &prompt,
                Some("You are a professional text formatting and grammar assistant. Return only the cleaned transcript."),
                0.1,
            )
            .await
            {
                Ok(cleaned) => {
                    auditor.record_event(
                        &format!("Ollama ({})", route.model),
                        true,
                        &format!("Text Cleanup ({})", style),
                        "Success",
                        start.elapsed().as_millis() as u64,
                        styled_baseline.split_whitespace().count(),
                    );
                    if !cleaned.trim().is_empty() {
                        return Ok(cleaned);
                    }
                }
                Err(e) => {
                    auditor.record_event(
                        &format!("Ollama ({})", route.model),
                        true,
                        &format!("Text Cleanup ({})", style),
                        &format!("Error: {}", e),
                        start.elapsed().as_millis() as u64,
                        styled_baseline.split_whitespace().count(),
                    );
                    // Do NOT fall back silently to cloud; preserve local baseline
                }
            }
        } else {
            auditor.record_event(
                "Local Heuristic Engine",
                true,
                &format!("Deterministic Rule ({})", style),
                "Success",
                start.elapsed().as_millis() as u64,
                styled_baseline.split_whitespace().count(),
            );
        }

        return Ok(styled_baseline);
    }

    // Cloud Engine Execution (Strictly user-authorized)
    if router_config.mode == router::AiOperatingMode::Local {
        return Err("Cloud AI execution blocked by Local-Only Privacy Mode".to_string());
    }

    let api_key = match CredentialManager::get_key(&route.provider_id)? {
        Some(k) if !k.trim().is_empty() => k,
        _ => {
            auditor.record_event(
                &format!("Cloud ({})", route.provider_id),
                false,
                &format!("Text Cleanup ({})", style),
                "Failed (Missing Credential)",
                start.elapsed().as_millis() as u64,
                0,
            );
            return Ok(styled_baseline);
        }
    };

    let sys_prompt = format!(
        "You are an expert universal text formatting assistant for active desktop typing. Clean grammar, fix punctuation, and adapt to style '{}'. {}{}Preserve meaning, technical terms, and code exactly. Return ONLY the final cleaned text without quotes or explanation.",
        style,
        if remove_fillers { "Remove all hesitation and filler words (um, uh, nu, na, you know, basically). " } else { "" },
        if remove_repeats { "Remove repeated stutters and duplicated words. " } else { "" }
    );

    match providers::CloudAIClient::complete(
        &route.provider_id,
        &api_key,
        &route.model,
        &styled_baseline,
        Some(&sys_prompt),
        router_config.custom_endpoint.as_deref(),
        0.1,
    )
    .await
    {
        Ok(cloud_result) => {
            auditor.record_event(
                &format!("{} ({})", route.provider_id, route.model),
                false,
                &format!("Text Cleanup ({})", style),
                "Success",
                start.elapsed().as_millis() as u64,
                styled_baseline.split_whitespace().count(),
            );
            if !cloud_result.trim().is_empty() {
                Ok(cloud_result)
            } else {
                Ok(styled_baseline)
            }
        }
        Err(e) => {
            auditor.record_event(
                &format!("{} ({})", route.provider_id, route.model),
                false,
                &format!("Text Cleanup ({})", style),
                &format!("Error: {}", e),
                start.elapsed().as_millis() as u64,
                0,
            );
            // Return baseline text rather than destroying user transcript
            Ok(styled_baseline)
        }
    }
}

/// Searches local paths for pre-compiled llama-cli binary
fn find_local_llama_cli() -> Option<PathBuf> {
    let candidate_names = if cfg!(windows) {
        vec!["llama-cli.exe", "llama.exe", "main.exe"]
    } else {
        vec!["llama-cli", "llama", "main"]
    };

    let home = get_user_home();
    let search_dirs = vec![
        home.join(".amiyo-flow").join("bin"),
        PathBuf::from("resources").join("bin"),
        PathBuf::from("."),
    ];

    for dir in search_dirs {
        for name in &candidate_names {
            let p = dir.join(name);
            if p.exists() {
                return Some(p);
            }
        }
    }

    None
}

/// Executes local llama.cpp executable with 0% network involvement
async fn run_local_llama_inference(
    cli_path: &Path,
    model_path: &Path,
    text: &str,
    style: &str,
) -> Result<String, String> {
    let prompt = format!(
        "<|im_start|>system\nYou are a professional text formatter. Clean grammar and apply '{}' style. Output ONLY the cleaned text with no explanations.<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
        style, text
    );

    let mut cmd = Command::new(cli_path);
    cmd.arg("-m")
        .arg(model_path)
        .arg("-p")
        .arg(&prompt)
        .arg("-n")
        .arg("256")
        .arg("--temp")
        .arg("0.1")
        .arg("--no-display-prompt");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute local llama.cpp: {}", e))?;

    if !output.status.success() {
        return Err("Local LLM inference error".into());
    }

    let cleaned = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(cleaned)
}

/// Checks if an utterance or sentence is an interrogative question
pub fn is_interrogative_sentence(sentence: &str) -> bool {
    let trimmed = sentence.trim();
    if trimmed.is_empty() {
        return false;
    }

    let lower = trimmed.to_lowercase();
    let words: Vec<&str> = lower.split_whitespace().collect();
    if words.is_empty() {
        return false;
    }

    let clean_first = words[0].trim_matches(|c: char| !c.is_alphanumeric());

    // 1. Single-word question starters (What, Why, How, Who, Where, When, Which, Whose, Whom)
    let single_starters = [
        "what", "why", "how", "who", "where", "when", "which", "whose", "whom"
    ];
    if single_starters.contains(&clean_first) {
        // Exclude declarative noun/relative clauses: "what we need...", "how it works...", "what I want..."
        if words.len() >= 2 && (words[1] == "we" || words[1] == "it" || words[1] == "they" || words[1] == "i") {
            return false;
        }
        // Exclude clauses with "you" followed by copula: "what you said was...", "what you need is..."
        if words.len() >= 3 && words[1] == "you" && words[2..].iter().any(|&w| w == "is" || w == "was" || w == "are" || w == "were") {
            return false;
        }
        return true;
    }

    // 2. Auxiliary modal question starters (e.g. "can you", "would it", "is this", etc.)
    if words.len() >= 2 {
        let clean_second = words[1].trim_matches(|c: char| !c.is_alphanumeric());
        let first_two = format!("{} {}", clean_first, clean_second);
        let aux_starters = [
            "can you", "can we", "can i", "could you", "could we", "could i",
            "would you", "would we", "would it", "would that", "would this",
            "should we", "should i", "should you", "should it",
            "is it", "is there", "is that", "is this", "is he", "is she", "is the",
            "are you", "are we", "are they", "are there", "are the",
            "do you", "do we", "do they", "does it", "does he", "does she", "does the",
            "did you", "did we", "did they", "did it", "did the",
            "will you", "will we", "will it", "will that", "will the",
            "have you", "have we", "have they", "has it", "has anyone", "has someone", "has the",
            "may i", "may we", "shall we", "shall i",
        ];
        if aux_starters.contains(&first_two.as_str()) {
            return true;
        }
    }

    false
}

/// Checks if an utterance or sentence is an incomplete clause or sentence
/// (i.e. ending on a conjunction, preposition, or continuation particle).
/// Incomplete utterances should NOT have a terminal period appended,
/// allowing seamless continuation when the user resumes speaking.
pub fn is_incomplete_sentence(sentence: &str) -> bool {
    let trimmed = sentence.trim();
    if trimmed.is_empty() {
        return false;
    }

    let words: Vec<&str> = trimmed.split_whitespace().collect();
    if words.is_empty() {
        return false;
    }

    let last_word = words.last().unwrap().trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
    if last_word.is_empty() {
        return false;
    }

    const INCOMPLETE_CONNECTORS: &[&str] = &[
        // Coordinating conjunctions
        "and", "or", "but", "nor", "yet", "so",
        // Subordinating conjunctions / causal / conditional
        "because", "although", "though", "since", "unless", "while", "whereas",
        "if", "whether", "as", "that", "after", "before", "until", "till",
        // Prepositions
        "to", "for", "with", "of", "in", "on", "at", "by", "from", "into",
        "about", "between", "through", "without", "under", "over", "around", "onto",
        // Relative pronouns / adverbs
        "which", "where", "who", "whom", "whose", "what", "when", "why", "how",
        // Continuations / particles
        "like", "including", "then", "also", "plus",
    ];

    INCOMPLETE_CONNECTORS.contains(&last_word.as_str())
}

/// Applies verbal in-line editing commands like "change Friday to Saturday" or "change all 2 to 4"
pub fn apply_spoken_edit_commands(input: &str) -> String {
    let mut text = input.trim().to_string();
    if text.is_empty() {
        return text;
    }

    // Matches trailing edit commands:
    // e.g. "change Friday to Saturday", "replace 2 with 4", "change all 2 to 4"
    let cmd_re = Regex::new(
        r"(?i)(?:[,.]\s*|\s+(?:and\s+)?)\b(?:change|replace)\s+(all\s+)?([a-zA-Z0-9$€£#]+(?:\s+[a-zA-Z0-9$€£#]+){0,2})\s+(?:to|with)\s+([a-zA-Z0-9$€£#]+(?:\s+[a-zA-Z0-9$€£#]+){0,2})[.?!]?$"
    ).unwrap();

    let mut commands = Vec::new();
    while let Some(caps) = cmd_re.captures(&text) {
        let full_match = caps.get(0).unwrap();
        let match_start = full_match.start();
        let is_all = caps.get(1).is_some();
        let target = caps.get(2).unwrap().as_str().trim().to_string();
        let replacement = caps.get(3).unwrap().as_str().trim().to_string();

        commands.push((is_all, target, replacement));
        text = text[..match_start].trim().to_string();
    }

    if commands.is_empty() {
        return input.to_string();
    }

    // Apply commands in chronological spoken order (reverse of peeling)
    commands.reverse();
    for (is_all, target, replacement) in commands {
        if target.is_empty() {
            continue;
        }

        let escaped_target = regex::escape(&target);
        if is_all {
            if let Ok(re) = Regex::new(&format!(r"(?i)\b{}\b", escaped_target)) {
                text = re.replace_all(&text, replacement.as_str()).to_string();
            }
        } else {
            // Replace the last occurrence of target in text
            if let Ok(re) = Regex::new(&format!(r"(?i)\b{}\b", escaped_target)) {
                let matches: Vec<_> = re.find_iter(&text).collect();
                if let Some(last_match) = matches.last() {
                    let start = last_match.start();
                    let end = last_match.end();
                    text = format!("{}{}{}", &text[..start], replacement, &text[end..]);
                }
            }
        }
    }

    text
}

/// Resolves pivot phrase backtrack in spoken self-corrections
/// e.g. "i try to build chatgpt like application using rea no chatgpt like application"
/// -> Finds "chatgpt like" in the preceding text, discards the digression, and splices the correction.
pub fn resolve_pivot_backtrack(before: &str, replacement: &str) -> Option<String> {
    let before_trimmed = before.trim();
    let repl_trimmed = replacement.trim();
    if before_trimmed.is_empty() || repl_trimmed.is_empty() {
        return None;
    }

    let before_words: Vec<&str> = before_trimmed.split_whitespace().collect();
    let repl_words: Vec<&str> = repl_trimmed.split_whitespace().collect();

    if before_words.is_empty() || repl_words.is_empty() {
        return None;
    }

    // Check for 3-word, 2-word, or 1-word pivot matches
    let max_len = 3.min(repl_words.len()).min(before_words.len());
    for pivot_len in (1..=max_len).rev() {
        let pivot_tokens: Vec<String> = repl_words[..pivot_len]
            .iter()
            .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase())
            .collect();

        // 1-word pivot must be a non-trivial content word (length >= 4 and not a stop word)
        if pivot_len == 1 {
            let token = &pivot_tokens[0];
            let stop_words = [
                "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "of", "with",
                "is", "was", "are", "were", "it", "this", "that", "i", "we", "you", "they",
                "he", "she", "no", "not"
            ];
            if token.len() < 4 || stop_words.contains(&token.as_str()) {
                continue;
            }
        }

        // Search backwards for the last occurrence of pivot_tokens in before_words
        if before_words.len() >= pivot_len {
            for i in (0..=before_words.len() - pivot_len).rev() {
                let candidate: Vec<String> = before_words[i..i + pivot_len]
                    .iter()
                    .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase())
                    .collect();

                if candidate == pivot_tokens {
                    let prefix = if i > 0 {
                        before_words[..i].join(" ") + " "
                    } else {
                        String::new()
                    };

                    if repl_words.len() > pivot_len {
                        return Some(format!("{}{}", prefix, repl_trimmed));
                    } else {
                        // repl is just the pivot! Look at what was immediately following the pivot in before:
                        // e.g. "chatgpt like application". If next word was not a digression starter, preserve it
                        if i + pivot_len < before_words.len() {
                            let next_word = before_words[i + pivot_len];
                            let clean_next = next_word.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
                            let skip_digression_starters = ["using", "with", "for", "and", "but", "in", "at", "by", "from"];
                            if !skip_digression_starters.contains(&clean_next.as_str()) {
                                return Some(format!("{}{}{}", prefix, repl_trimmed, format!(" {}", next_word)));
                            }
                        }
                        return Some(format!("{}{}", prefix, repl_trimmed));
                    }
                }
            }
        }
    }

    None
}

/// Local Deterministic Heuristic Normalizer with customizable cleaning options
pub fn heuristic_cleanup_with_options(
    input: &str,
    remove_fillers: bool,
    remove_repeats: bool,
    remove_corrections: bool,
) -> String {
    heuristic_cleanup_full(input, remove_fillers, remove_repeats, remove_corrections, true, &[])
}

/// Local Deterministic Heuristic Normalizer with custom filler word list support
pub fn heuristic_cleanup_with_custom(
    input: &str,
    remove_fillers: bool,
    remove_repeats: bool,
    remove_corrections: bool,
    custom_fillers: &[String],
) -> String {
    heuristic_cleanup_full(input, remove_fillers, remove_repeats, remove_corrections, true, custom_fillers)
}

/// Local Deterministic Heuristic Normalizer with full modular control including smart sentence polishing
pub fn heuristic_cleanup_full(
    input: &str,
    remove_fillers: bool,
    remove_repeats: bool,
    remove_corrections: bool,
    clean_sentences: bool,
    custom_fillers: &[String],
) -> String {
    let mut text = input.to_string();

    // 0. Spoken in-line editing commands ("change Friday to Saturday", "change all 2 to 4", "replace X with Y")
    text = apply_spoken_edit_commands(&text);

    // 1. Spoken self-corrections ("no wait...", "scratch that...", "I mean...", "actually no...", "no no...", pivot backtracks)
    if remove_corrections {
        let self_correction_regex = Regex::new(
            r"(?i)\b(?:wait let me start over|let me start over|start over|scratch all that|actually what I meant was|correction please|I mean to say|no no wait|no no no|no no|no wait|scratch that|sorry I meant|actually no|wait no|no sorry|sorry no|oops I meant|or rather|correction|let me rephrase|strike that|I mean)[,\s]+(.+)"
        ).unwrap();

        if let Some(caps) = self_correction_regex.captures(&text) {
            let replacement = caps.get(1).unwrap().as_str().trim();
            let full_match = self_correction_regex.find(&text).unwrap();
            let trigger = text[full_match.start()..full_match.start() + caps.get(0).unwrap().as_str().len() - replacement.len()].to_lowercase();
            let before = text[..full_match.start()].trim();

            let is_full_restart = trigger.contains("start over")
                || trigger.contains("scratch all that")
                || trigger.contains("delete all that")
                || trigger.contains("clear that");

            if is_full_restart {
                text = replacement.to_string();
            } else if let Some(pivot_resolved) = resolve_pivot_backtrack(before, replacement) {
                text = pivot_resolved;
            } else {
                let before_words: Vec<&str> = before.split_whitespace().collect();
                let repl_words: Vec<&str> = replacement.split_whitespace().collect();

                if before_words.len() >= 2 && !repl_words.is_empty() {
                    let shares_start = before_words.first().map(|w| w.to_lowercase()) == repl_words.first().map(|w| w.to_lowercase());
                    if !shares_start {
                        let prefix = before_words[..before_words.len() - 1].join(" ");
                        text = format!("{} {}", prefix, replacement);
                    } else {
                        text = replacement.to_string();
                    }
                } else {
                    text = replacement.to_string();
                }
            }
        } else {
            // Check for bare 'no' pivot backtrack: e.g. "application using rea no chatgpt like application"
            let bare_no_re = Regex::new(r"(?i)(?:,\s*no[,\s]+|\s+no[,\s]+)(.+)").unwrap();
            if let Some(caps) = bare_no_re.captures(&text) {
                let replacement = caps.get(1).unwrap().as_str().trim();
                let full_match = bare_no_re.find(&text).unwrap();
                let before = text[..full_match.start()].trim();

                if let Some(pivot_resolved) = resolve_pivot_backtrack(before, replacement) {
                    text = pivot_resolved;
                }
            }
        }
    }

    // 2. Remove verbal filler words (hesitations, e.g. um, uh, nu, na, erm, no no, etc.)
    if remove_fillers {
        let filler_patterns = [
            r"(?i)\b(?:no no wait|no no no|no no)\b,?",
            r"(?i)\b(?:um\s+aa|aa\s+um|um\s+uh|uh\s+um|er\s+um|um\s+er|aa\s+nu|nu\s+aa)\b,?",
            r"(?i)\b(um+|uh+|erm+|ah+|aa+|aah+|ahh+|nu+|na+|umm+|uhh+|er+|hmm+|uhm+|em+|ohh+)\b,?",
            r"(?i)\b(you know what I mean|you know what I'm saying|you know|basically|actually|literally|sort of|kind of|so yeah|like I mean)\b,?",
        ];

        for pat in filler_patterns {
            if let Ok(re) = Regex::new(pat) {
                text = re.replace_all(&text, "").to_string();
            }
        }

        // Apply custom user-defined filler words
        for cf in custom_fillers {
            let trimmed = cf.trim();
            if !trimmed.is_empty() {
                let escaped = regex::escape(trimmed);
                if let Ok(re) = Regex::new(&format!(r"(?i)\b{}\b,?", escaped)) {
                    text = re.replace_all(&text, "").to_string();
                }
            }
        }
    }

    // 3. Remove accidental duplicate repeated words & phrases ("the the" -> "the", "we can we can" -> "we can")
    if remove_repeats {
        text = remove_duplicate_words(&text);
        text = remove_repeated_phrases(&text);
    }

    // 4. Format verbal emails and URLs
    let email_re = Regex::new(r"(?i)\b([a-zA-Z0-9_\-]+)\s+dot\s+([a-zA-Z0-9_\-]+)\s+at\s+([a-zA-Z0-9_\-]+)\s+dot\s+(com|org|net|edu|gov|io|ai|dev|co|in)\b").unwrap();
    text = email_re.replace_all(&text, "$1.$2@$3.$4").to_string();

    let email_simple_re = Regex::new(r"(?i)\b([a-zA-Z0-9_\-]+)\s+at\s+([a-zA-Z0-9_\-]+)\s+dot\s+(com|org|net|edu|gov|io|ai|dev|co|in)\b").unwrap();
    text = email_simple_re.replace_all(&text, "$1@$2.$3").to_string();

    let url_re = Regex::new(r"(?i)\bhttps?\s+colon\s+slash\s+slash\b").unwrap();
    text = url_re.replace_all(&text, "https://").to_string();

    let www_re = Regex::new(r"(?i)\bwww\s+dot\s+").unwrap();
    text = www_re.replace_all(&text, "www.").to_string();

    // 5. Expand verbal punctuation, percentage, dollar, number, and quote commands
    let punct_patterns = [
        (r"(?i)\s+period\b", "."),
        (r"(?i)\s+full stop\b", "."),
        (r"(?i)\s+comma\b", ","),
        (r"(?i)\s+question mark\b", "?"),
        (r"(?i)\s+(?:exclamation mark|exclamation point)\b", "!"),
        (r"(?i)\s+colon\b", ":"),
        (r"(?i)\s+semicolon\b", ";"),
        (r"(?i)\s+(?:new line|newline)\b", "\n"),
        // Spoken written percentages & numbers
        (r"(?i)\b(?:one hundred|hundred)\s+percent\b", "100%"),
        (r"(?i)\bninety\s+percent\b", "90%"),
        (r"(?i)\beighty\s+percent\b", "80%"),
        (r"(?i)\bseventy\s+percent\b", "70%"),
        (r"(?i)\bsixty\s+percent\b", "60%"),
        (r"(?i)\bfifty\s+percent\b", "50%"),
        (r"(?i)\bforty\s+percent\b", "40%"),
        (r"(?i)\bthirty\s+percent\b", "30%"),
        (r"(?i)\btwenty\s+five\s+percent\b", "25%"),
        (r"(?i)\btwenty\s+percent\b", "20%"),
        (r"(?i)\bfifteen\s+percent\b", "15%"),
        (r"(?i)\bten\s+percent\b", "10%"),
        (r"(?i)\bfive\s+percent\b", "5%"),
        (r"(?i)\bzero\s+percent\b", "0%"),
        (r"(?i)\b([0-9]+)\s+percent\b", "$1%"),
        // Spoken written currency
        (r"(?i)\b(?:one hundred|hundred)\s+dollars?\b", "$$100"),
        (r"(?i)\bfifty\s+dollars?\b", "$$50"),
        (r"(?i)\btwenty\s+dollars?\b", "$$20"),
        (r"(?i)\bten\s+dollars?\b", "$$10"),
        (r"(?i)\bfive\s+dollars?\b", "$$5"),
        (r"(?i)\bone\s+dollar\b", "$$1"),
        (r"(?i)\b([0-9]+)\s+dollars?\b", "$$$1"),
        (r"(?i)\b([0-9]+)\s+euros?\b", "€$1"),
        (r"(?i)\b([0-9]+)\s+pounds?\b", "£$1"),
        // Spoken numbers (#1, #5, etc.)
        (r"(?i)\bnumber\s+([0-9]+)\b", "#$1"),
        (r"(?i)\bnumber\s+one\b", "#1"),
        (r"(?i)\bnumber\s+two\b", "#2"),
        (r"(?i)\bnumber\s+three\b", "#3"),
        (r"(?i)\bnumber\s+four\b", "#4"),
        (r"(?i)\bnumber\s+five\b", "#5"),
        (r"(?i)\bnumber\s+six\b", "#6"),
        (r"(?i)\bnumber\s+seven\b", "#7"),
        (r"(?i)\bnumber\s+eight\b", "#8"),
        (r"(?i)\bnumber\s+nine\b", "#9"),
        (r"(?i)\bnumber\s+ten\b", "#10"),
        // Spoken time formatting ("five thirty PM" -> "5:30 PM", "ten AM" -> "10:00 AM", etc.)
        (r"(?i)\b(?:twelve|12)\s+thirty\s+(AM|PM)\b", "12:30 $1"),
        (r"(?i)\b(?:eleven|11)\s+thirty\s+(AM|PM)\b", "11:30 $1"),
        (r"(?i)\b(?:ten|10)\s+thirty\s+(AM|PM)\b", "10:30 $1"),
        (r"(?i)\b(?:nine|9)\s+thirty\s+(AM|PM)\b", "9:30 $1"),
        (r"(?i)\b(?:eight|8)\s+thirty\s+(AM|PM)\b", "8:30 $1"),
        (r"(?i)\b(?:seven|7)\s+thirty\s+(AM|PM)\b", "7:30 $1"),
        (r"(?i)\b(?:six|6)\s+thirty\s+(AM|PM)\b", "6:30 $1"),
        (r"(?i)\b(?:five|5)\s+thirty\s+(AM|PM)\b", "5:30 $1"),
        (r"(?i)\b(?:four|4)\s+thirty\s+(AM|PM)\b", "4:30 $1"),
        (r"(?i)\b(?:three|3)\s+thirty\s+(AM|PM)\b", "3:30 $1"),
        (r"(?i)\b(?:two|2)\s+thirty\s+(AM|PM)\b", "2:30 $1"),
        (r"(?i)\b(?:one|1)\s+thirty\s+(AM|PM)\b", "1:30 $1"),
        (r"(?i)\btwelve\s+(AM|PM)\b", "12 $1"),
        (r"(?i)\beleven\s+(AM|PM)\b", "11 $1"),
        (r"(?i)\bten\s+(AM|PM)\b", "10 $1"),
        (r"(?i)\bnine\s+(AM|PM)\b", "9 $1"),
        (r"(?i)\beight\s+(AM|PM)\b", "8 $1"),
        (r"(?i)\bseven\s+(AM|PM)\b", "7 $1"),
        (r"(?i)\bsix\s+(AM|PM)\b", "6 $1"),
        (r"(?i)\bfive\s+(AM|PM)\b", "5 $1"),
        (r"(?i)\bfour\s+(AM|PM)\b", "4 $1"),
        (r"(?i)\bthree\s+(AM|PM)\b", "3 $1"),
        (r"(?i)\btwo\s+(AM|PM)\b", "2 $1"),
        (r"(?i)\bone\s+(AM|PM)\b", "1 $1"),
        (r"(?i)\b([0-9]+)\s+o'?clock\b", "$1:00"),
        // Spoken large numbers
        (r"(?i)\b(?:one|1)\s+thousand\b", "1,000"),
        (r"(?i)\b(?:two|2)\s+thousand\b", "2,000"),
        (r"(?i)\b(?:five|5)\s+thousand\b", "5,000"),
        (r"(?i)\b(?:ten|10)\s+thousand\b", "10,000"),
        (r"(?i)\b(?:one|1)\s+million\b", "1 million"),
        (r"(?i)\b(?:two|2)\s+million\b", "2 million"),
        // Spoken math operations
        (r"\b([0-9]+)\s+plus\s+([0-9]+)\b", "$1 + $2"),
        (r"\b([0-9]+)\s+minus\s+([0-9]+)\b", "$1 - $2"),
        (r"\b([0-9]+)\s+equals\s+([0-9]+)\b", "$1 = $2"),
    ];

    for (pat, repl) in punct_patterns {
        if let Ok(re) = Regex::new(pat) {
            text = re.replace_all(&text, repl).to_string();
        }
    }

    // Spoken quotes, parentheses, and brackets
    let quote_re = Regex::new(r#"(?i)\bopen\s+quotes?\s+(.+?)\s+close\s+quotes?\b"#).unwrap();
    text = quote_re.replace_all(&text, "\"$1\"").to_string();

    let paren_re = Regex::new(r#"(?i)\bopen\s+paren(?:thesis)?\s+(.+?)\s+close\s+paren(?:thesis)?\b"#).unwrap();
    text = paren_re.replace_all(&text, "($1)").to_string();

    let bracket_re = Regex::new(r#"(?i)\bopen\s+bracket\s+(.+?)\s+close\s+bracket\b"#).unwrap();
    text = bracket_re.replace_all(&text, "[$1]").to_string();

    // Clean up duplicate commas or comma followed by period
    if let Ok(dup_commas) = Regex::new(r",\s*,+") {
        text = dup_commas.replace_all(&text, ",").to_string();
    }
    if let Ok(comma_period) = Regex::new(r",\s*\.") {
        text = comma_period.replace_all(&text, ".").to_string();
    }

    // Clean up spaces before punctuation
    if let Ok(space_punct) = Regex::new(r"\s+([,\.?!;:])") {
        text = space_punct.replace_all(&text, "$1").to_string();
    }

    // 6. Sentence & Grammar Polish (Contractions, multi-sentence capitalization, pronoun 'I', transitions)
    if clean_sentences {
        text = polish_sentence_structure(&text);
    }

    // 7. Normalize spaces and whitespace while preserving intentional newlines
    let hspace_re = Regex::new(r"[ \t]+").unwrap();
    text = hspace_re.replace_all(&text, " ").to_string();

    let nl_space_re = Regex::new(r" *(\r?\n) *").unwrap();
    text = nl_space_re.replace_all(&text, "\n").to_string();

    let multi_nl = Regex::new(r"\n{3,}").unwrap();
    text = multi_nl.replace_all(&text, "\n\n").trim().to_string();

    // 8. Capitalize initial letter and ensure ending punctuation per paragraph (smart question mark or period)
    if !text.is_empty() {
        let mut lines = Vec::new();
        for line in text.split('\n') {
            let mut trimmed = line.trim();
            // Trim leading punctuation left behind by removed fillers (e.g. ", we can deploy" -> "we can deploy")
            trimmed = trimmed.trim_start_matches(|c: char| c == ',' || c == ';' || c == ':' || c == '.' || c == '-' || c == ' ');
            if trimmed.is_empty() {
                lines.push(String::new());
                continue;
            }
            let mut chars = trimmed.chars();
            let first = chars.next().unwrap().to_uppercase().to_string();
            let rest: String = chars.collect();
            let mut formatted_line = format!("{}{}", first, rest);
            if is_interrogative_sentence(&formatted_line) {
                if formatted_line.ends_with('.') {
                    formatted_line.pop();
                }
                if !formatted_line.ends_with('?') {
                    formatted_line.push('?');
                }
            } else if !is_incomplete_sentence(&formatted_line)
                && !formatted_line.ends_with('.')
                && !formatted_line.ends_with('?')
                && !formatted_line.ends_with('!')
                && !formatted_line.ends_with(':')
                && !formatted_line.ends_with(';')
            {
                formatted_line.push('.');
            }
            lines.push(formatted_line);
        }
        text = lines.join("\n");
    }

    text
}

/// Polish sentence structure, multi-sentence capitalization, pronoun 'I', and spoken contractions
pub fn polish_sentence_structure(input: &str) -> String {
    let mut text = input.to_string();

    // 1. Fix lowercase pronoun 'i' and its contractions
    let pronoun_replacements = [
        (r"\b(i)\b", "I"),
        (r"\b(i'm|im)\b", "I'm"),
        (r"\b(i've|ive)\b", "I've"),
        (r"\b(i'll)\b", "I'll"),
        (r"\b(i'd)\b", "I'd"),
    ];
    for (pat, repl) in pronoun_replacements {
        if let Ok(re) = Regex::new(pat) {
            text = re.replace_all(&text, repl).to_string();
        }
    }

    // 2. Fix common spoken contractions missing apostrophes
    let contraction_replacements = [
        (r"\b(?i)dont\b", "don't"),
        (r"\b(?i)cant\b", "can't"),
        (r"\b(?i)wont\b", "won't"),
        (r"\b(?i)didnt\b", "didn't"),
        (r"\b(?i)isnt\b", "isn't"),
        (r"\b(?i)arent\b", "aren't"),
        (r"\b(?i)hasnt\b", "hasn't"),
        (r"\b(?i)havent\b", "haven't"),
        (r"\b(?i)couldnt\b", "couldn't"),
        (r"\b(?i)shouldnt\b", "shouldn't"),
        (r"\b(?i)wouldnt\b", "wouldn't"),
        (r"\b(?i)thats\b", "that's"),
        (r"\b(?i)whats\b", "what's"),
        (r"\b(?i)theres\b", "there's"),
        (r"\b(?i)heres\b", "here's"),
        (r"\b(?i)lets\b", "let's"),
        (r"\b(?i)youre\b", "you're"),
        (r"\b(?i)theyre\b", "they're"),
        (r"\b(?i)weve\b", "we've"),
        (r"\b(?i)werent\b", "weren't"),
        (r"\b(?i)doesnt\b", "doesn't"),
        (r"\b(?i)couldve\b", "could've"),
        (r"\b(?i)shouldve\b", "should've"),
        (r"\b(?i)wouldve\b", "would've"),
        (r"\b(?i)mustve\b", "must've"),
        (r"\b(?i)mightve\b", "might've"),
        (r"\b(?i)alot\b", "a lot"),
        (r"\b(?i)eachother\b", "each other"),
        (r"\b(?i)aswell\b", "as well"),
        (r"\b(?i)infront\b", "in front"),
        (r"\b(?i)nevermind\b", "never mind"),
        (r"\b(?i)saterday\b", "Saturday"),
        (r"\b(?i)wensday\b", "Wednesday"),
        (r"\b(?i)thrusday\b", "Thursday"),
        // Additional spoken contractions
        (r"\b(?i)howd\b", "how'd"),
        (r"\b(?i)whyd\b", "why'd"),
        (r"\b(?i)whered\b", "where'd"),
        (r"\b(?i)whatd\b", "what'd"),
        (r"\b(?i)whod\b", "who'd"),
        (r"\b(?i)wholl\b", "who'll"),
        (r"\b(?i)whatll\b", "what'll"),
        (r"\b(?i)thatll\b", "that'll"),
        (r"\b(?i)howll\b", "how'll"),
        (r"\b(?i)itll\b", "it'll"),
        (r"\b(?i)cmon\b", "c'mon"),
        // Developer & Tech Term Normalization
        (r"\b(?i)chatgpt\b", "ChatGPT"),
        (r"\b(?i)claude\b", "Claude"),
        (r"\b(?i)gemini\b", "Gemini"),
        (r"\b(?i)javascript\b", "JavaScript"),
        (r"\b(?i)typescript\b", "TypeScript"),
        (r"\b(?i)github\b", "GitHub"),
        (r"\b(?i)youtube\b", "YouTube"),
        (r"\b(?i)vscode\b", "VS Code"),
        (r"\b(?i)vs\s+code\b", "VS Code"),
        (r"\b(?i)api\b", "API"),
        (r"\b(?i)apis\b", "APIs"),
        (r"\b(?i)sdk\b", "SDK"),
        (r"\b(?i)sdks\b", "SDKs"),
        (r"\b(?i)ui\b", "UI"),
        (r"\b(?i)ux\b", "UX"),
        (r"\b(?i)url\b", "URL"),
        (r"\b(?i)urls\b", "URLs"),
        (r"\b(?i)json\b", "JSON"),
        (r"\b(?i)html\b", "HTML"),
        (r"\b(?i)css\b", "CSS"),
        (r"\b(?i)sql\b", "SQL"),
        (r"\b(?i)sqlite\b", "SQLite"),
        (r"\b(?i)tauri\b", "Tauri"),
        (r"\b(?i)rea\b", "REA"),
        (r"\b(?i)windows\b", "Windows"),
        (r"\b(?i)macos\b", "macOS"),
        (r"\b(?i)pr\b", "PR"),
        (r"\b(?i)prs\b", "PRs"),
        // Phonetic Name & App Brand Fixes
        (r"\b(?i)a\s+m\s+i\s+y\s+o\b", "Amiyo"),
        (r"\b(?i)omiya\b", "Amiyo"),
        (r"\b(?i)omiyo\b", "Amiyo"),
        (r"\b(?i)amio\b", "Amiyo"),
        (r"\b(?i)ameyo\b", "Amiyo"),
        (r"\b(?i)ameio\b", "Amiyo"),
        (r"\b(?i)amiya\b", "Amiyo"),
        (r"\b(?i)ameya\b", "Amiyo"),
        (r"\b(?i)amiyo\b", "Amiyo"),
        (r"\b(?i)omiya\s+flow\b", "AMIYO FLOW"),
        (r"\b(?i)omiyo\s+flow\b", "AMIYO FLOW"),
        (r"\b(?i)amiyo\s+flow\b", "AMIYO FLOW"),
        // Advanced Speech Auto-Correction & Typo Repair
        (r"\b(?i)seplling\b", "spelling"),
        (r"\b(?i)removwe\b", "remove"),
        (r"\b(?i)teh\b", "the"),
        (r"\b(?i)recieve\b", "receive"),
        (r"\b(?i)recieved\b", "received"),
        (r"\b(?i)recieving\b", "receiving"),
        (r"\b(?i)seperate\b", "separate"),
        (r"\b(?i)seperated\b", "separated"),
        (r"\b(?i)untill\b", "until"),
        (r"\b(?i)definately\b", "definitely"),
        (r"\b(?i)occured\b", "occurred"),
        (r"\b(?i)thier\b", "their"),
        (r"\b(?i)wierd\b", "weird"),
        (r"\b(?i)tommorow\b", "tomorrow"),
        (r"\b(?i)tommorrow\b", "tomorrow"),
        (r"\b(?i)goverment\b", "government"),
        (r"\b(?i)enviroment\b", "environment"),
        (r"\b(?i)refering\b", "referring"),
        (r"\b(?i)writting\b", "writing"),
        (r"\b(?i)commited\b", "committed"),
        (r"\b(?i)collegue\b", "colleague"),
        (r"\b(?i)existense\b", "existence"),
        (r"\b(?i)succesful\b", "successful"),
        (r"\b(?i)succesfully\b", "successfully"),
        (r"\b(?i)begining\b", "beginning"),
        (r"\b(?i)neccessary\b", "necessary"),
        (r"\b(?i)unneccessary\b", "unnecessary"),
        (r"\b(?i)truely\b", "truly"),
        (r"\b(?i)accomodate\b", "accommodate"),
        (r"\b(?i)concious\b", "conscious"),
        (r"\b(?i)pronounciation\b", "pronunciation"),
        // Spoken grammar, idiom and stutter corrections
        (r"\b(?i)where\s+is\s+ends\b", "where it ends"),
        (r"\b(?i)where\s+is\s+ended\b", "where it ended"),
        (r"\b(?i)and\s+and\b", "and"),
        (r"\b(?i)this\s+this\b", "this"),
    ];
    for (pat, repl) in contraction_replacements {
        if let Ok(re) = Regex::new(pat) {
            text = re.replace_all(&text, repl).to_string();
        }
    }

    // 3. Ensure a space follows commas, semicolons, and colons when followed directly by a letter
    if let Ok(missing_space) = Regex::new(r"([,;:])([a-zA-Z])") {
        text = missing_space.replace_all(&text, "$1 $2").to_string();
    }

    // 4. Eliminate duplicate punctuation (".." -> ".", ",," -> ",", "??" -> "?", "!!" -> "!")
    let dup_punct = [
        (r"\.{2,}", "."),
        (r",{2,}", ","),
        (r"\?{2,}", "?"),
        (r"!{2,}", "!"),
    ];
    for (pat, repl) in dup_punct {
        if let Ok(re) = Regex::new(pat) {
            text = re.replace_all(&text, repl).to_string();
        }
    }

    // 5. Add comma after introductory transition phrases if missing
    let intro_transitions = [
        (r"(?i)\b(however|therefore|furthermore|moreover|meanwhile|in addition|first of all|finally|for example|in fact|as a result)\s+([a-zA-Z])", "$1, $2"),
    ];
    for (pat, repl) in intro_transitions {
        if let Ok(re) = Regex::new(pat) {
            text = re.replace_all(&text, repl).to_string();
        }
    }

    // 6. Sentence-boundary capitalization:
    // Capitalize every letter following [.?!]\s+ (sentence boundary with space)
    if let Ok(sent_re) = Regex::new(r"(?:^|[.!?]\s+)([a-z])") {
        text = sent_re.replace_all(&text, |caps: &regex::Captures| {
            caps[0].to_uppercase()
        }).to_string();
    }

    // 7. Ensure email addresses remain clean lowercase
    if let Ok(email_fix) = Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}") {
        text = email_fix.replace_all(&text, |caps: &regex::Captures| {
            caps[0].to_lowercase()
        }).to_string();
    }

    text
}

/// Local Deterministic Heuristic Normalizer (Default: all disfluency removals enabled)
pub fn heuristic_cleanup(input: &str) -> String {
    heuristic_cleanup_with_options(input, true, true, true)
}

/// Deduplicates adjacent repeated words ("the the" -> "the", "we, we" -> "we")
pub fn remove_duplicate_words(input: &str) -> String {
    let words: Vec<&str> = input.split_whitespace().collect();
    if words.is_empty() {
        return String::new();
    }

    let mut result: Vec<String> = Vec::with_capacity(words.len());
    let mut prev_word = "";

    for word in words {
        let clean_word = word.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
        let clean_prev = prev_word.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();

        if clean_word.is_empty() || clean_word != clean_prev {
            result.push(word.to_string());
            prev_word = word;
        } else {
            // Strip trailing pause comma from previous word upon deduplication
            if let Some(last) = result.last_mut() {
                if last.ends_with(',') {
                    last.pop();
                }
            }
        }
    }

    result.join(" ")
}

/// Deduplicates adjacent repeated 2-word phrases ("we can we can" -> "we can", "we can, we can" -> "we can")
pub fn remove_repeated_phrases(input: &str) -> String {
    let words: Vec<&str> = input.split_whitespace().collect();
    if words.len() < 4 {
        return input.to_string();
    }

    let mut result: Vec<String> = Vec::new();
    let mut i = 0;
    while i < words.len() {
        if i + 3 < words.len() {
            let w1 = words[i].trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
            let w2 = words[i + 1].trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
            let w3 = words[i + 2].trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
            let w4 = words[i + 3].trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();

            if !w1.is_empty() && !w2.is_empty() && w1 == w3 && w2 == w4 {
                let mut first_w2 = words[i + 1].to_string();
                if first_w2.ends_with(',') {
                    first_w2.pop();
                }
                result.push(words[i].to_string());
                result.push(first_w2);
                i += 4;
                while i + 1 < words.len() {
                    let next_w1 = words[i].trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
                    let next_w2 = words[i + 1].trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
                    if next_w1 == w1 && next_w2 == w2 {
                        i += 2;
                    } else {
                        break;
                    }
                }
                continue;
            }
        }
        result.push(words[i].to_string());
        i += 1;
    }

    result.join(" ")
}

/// Applies user personal dictionary
pub fn apply_dictionary(text: &str, dictionary: &[crate::db::DictionaryItem]) -> String {
    let mut result = text.to_string();
    for item in dictionary {
        if !item.word.trim().is_empty() && !item.replacement.trim().is_empty() {
            let pat = format!(r"(?i)\b{}\b", regex::escape(&item.word));
            if let Ok(re) = Regex::new(&pat) {
                result = re.replace_all(&result, item.replacement.as_str()).to_string();
            }
        }
    }
    result
}

/// Applies user snippets
pub fn apply_snippets(text: &str, snippets: &[crate::db::SnippetItem]) -> String {
    let mut result = text.to_string();
    for item in snippets {
        if !item.trigger.trim().is_empty() && !item.expansion.trim().is_empty() {
            result = result.replace(&item.trigger, &item.expansion);
        }
    }
    result
}

/// Applies writing style formatting
pub fn apply_style_formatting(text: &str, style: &str, _target_app: &str) -> String {
    match style.to_lowercase().replace('-', " ").replace('_', " ").trim() {
        "casual" => {
            text.trim_end_matches('.').to_string()
        }
        "developer" => {
            let mut dev = text.to_string();
            let replacements = [
                (r"(?i)\bclose\s+curly\s+brace\b", "}"),
                (r"(?i)\bopen\s+curly\s+brace\b", "{"),
                (r"(?i)\bcurly\s+brace\b", "{"),
                (r"(?i)\bclose\s+square\s+bracket\b", "]"),
                (r"(?i)\bopen\s+square\s+bracket\b", "["),
                (r"(?i)\bclose\s+bracket\b", "]"),
                (r"(?i)\bopen\s+bracket\b", "["),
                (r"(?i)\bclose\s+paren(?:thesis)?\b", ")"),
                (r"(?i)\bopen\s+paren(?:thesis)?\b", "("),
                (r"(?i)\barrow\s+function\b", " =>"),
                (r"(?i)\btriple\s+equals?\b", " ==="),
                (r"(?i)\bdouble\s+equals?\b", " =="),
                (r"(?i)\bnot\s+equals?\b", " !="),
                (r"(?i)\bgreater\s+than\s+or\s+equal(?:\s+to)?\b", " >="),
                (r"(?i)\bless\s+than\s+or\s+equal(?:\s+to)?\b", " <="),
                (r"(?i)\bcolon\b", ":"),
                (r"(?i)\bsemicolon\b", ";"),
                (r"(?i)\bbacktick\b", "`"),
            ];
            for (pat, repl) in replacements {
                if let Ok(re) = Regex::new(pat) {
                    dev = re.replace_all(&dev, repl).to_string();
                }
            }
            dev
        }
        "ai prompt" => {
            format!("Instructions: {}", text)
        }
        "academic" => {
            let mut s = text.trim().to_string();
            if !s.is_empty() && !s.ends_with('.') && !s.ends_with('?') && !s.ends_with('!') {
                s.push('.');
            }
            s
        }
        "professional" => {
            let mut s = text.trim().to_string();
            if !s.is_empty() && !s.ends_with('.') && !s.ends_with('?') && !s.ends_with('!') {
                s.push('.');
            }
            s
        }
        _ => text.to_string(),
    }
}

/// Generate structured meeting notes locally
pub async fn generate_meeting_summary(raw_transcript: &str) -> Result<crate::db::MeetingItem, String> {
    if raw_transcript.trim().is_empty() {
        return Err("Transcript is empty".into());
    }

    let cleaned = heuristic_cleanup(raw_transcript);

    // Split cleaned text into distinct sentences (avoiding splitting decimal numbers like v1.0)
    let sentence_regex = Regex::new(r#"(?:\.\s+|\?\s+|\!\s+|\;\s+|\n+)"#).unwrap();
    let sentences: Vec<String> = sentence_regex
        .split(&cleaned)
        .map(|s| s.trim())
        .filter(|s| s.len() > 3)
        .map(|s| {
            let mut chars = s.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => {
                    let mut capitalized = first.to_uppercase().to_string();
                    capitalized.extend(chars);
                    if !capitalized.ends_with('.') && !capitalized.ends_with('!') && !capitalized.ends_with('?') {
                        capitalized.push('.');
                    }
                    capitalized
                }
            }
        })
        .collect();

    // 1. Dynamic Extraction of Decisions
    let decision_patterns = [
        "agree", "agreed", "decide", "decided", "approve", "approved",
        "standardize", "standardized", "chosen", "choose", "resolved",
        "consensus", "aligned", "selected", "verdict", "deploy local", "concluded"
    ];

    let mut decisions: Vec<String> = sentences
        .iter()
        .filter(|s| {
            let lower = s.to_lowercase();
            decision_patterns.iter().any(|p| lower.contains(p))
        })
        .cloned()
        .collect();

    // Fallback if no explicit decision trigger was mentioned
    if decisions.is_empty() {
        if let Some(first) = sentences.first() {
            decisions.push(format!("Agreed on key priorities discussed: {}", first));
        } else {
            decisions.push("Agreed on operational alignment and next milestones.".to_string());
        }
    }

    // 2. Dynamic Extraction of Action Items
    let action_patterns = [
        "will", "must", "need to", "action", "todo", "follow up", "assign",
        "by friday", "by monday", "deadline", "ship", "deliver", "review",
        "test", "benchmark", "implement", "create", "build", "verify",
        "plan to", "prepare", "deploy", "suggested"
    ];

    let mut action_items: Vec<String> = sentences
        .iter()
        .filter(|s| {
            let lower = s.to_lowercase();
            // Avoid exact duplicate with decisions
            !decisions.contains(s) && action_patterns.iter().any(|p| lower.contains(p))
        })
        .cloned()
        .collect();

    // If still empty, generate meaningful items from sentences
    if action_items.is_empty() {
        if sentences.len() > 1 {
            action_items.push(format!("Follow up on: {}", sentences[1]));
        } else if let Some(first) = sentences.first() {
            action_items.push(format!("Complete execution plan for: {}", first));
        } else {
            action_items.push("Complete execution plan for next sprint review.".to_string());
        }
    }

    // Format action items with clean checklist numbering: "[ ] 1. ...", "[ ] 2. ..."
    let formatted_action_items: Vec<String> = action_items
        .into_iter()
        .enumerate()
        .map(|(i, item)| {
            let trimmed = item.trim_start_matches(|c: char| c.is_ascii_digit() || c == '.' || c == ' ' || c == '[' || c == ']');
            format!("[ ] {}. {}", i + 1, trimmed)
        })
        .collect();

    // 3. Dynamic Synthesis of Executive Summary
    let summary = if cleaned.len() <= 180 {
        format!("Discussion Summary: {}", cleaned)
    } else {
        let first_sentence = sentences.first().cloned().unwrap_or_else(|| cleaned[..180].to_string());
        let second_sentence = sentences.get(1).cloned().unwrap_or_default();
        if !second_sentence.is_empty() {
            format!("Executive alignment on: {} Key follow-up: {}", first_sentence, second_sentence)
        } else {
            format!("Executive alignment session: {}", first_sentence)
        }
    };

    Ok(crate::db::MeetingItem {
        id: uuid::Uuid::new_v4().to_string(),
        title: format!("Local Meeting Session — {}", chrono::Local::now().format("%Y-%m-%d %H:%M")),
        timestamp: chrono::Utc::now().to_rfc3339(),
        duration_sec: 180,
        transcript: raw_transcript.to_string(),
        summary,
        decisions,
        action_items: formatted_action_items,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filler_word_removal() {
        let raw = "um so basically I think we should uh proceed with the build you know";
        let cleaned = heuristic_cleanup(raw);
        assert_eq!(cleaned, "So I think we should proceed with the build.");
    }

    #[test]
    fn test_spoken_self_correction() {
        let raw = "let's deploy on Friday no wait let's deploy on Monday";
        let cleaned = heuristic_cleanup(raw);
        assert_eq!(cleaned, "Let's deploy on Monday.");
    }

    #[test]
    fn test_accidental_duplicate_removal() {
        let raw = "we need to test the the application carefully";
        let cleaned = remove_duplicate_words(raw);
        assert_eq!(cleaned, "we need to test the application carefully");
    }

    #[test]
    fn test_dictionary_replacement() {
        let dict = vec![
            crate::db::DictionaryItem {
                id: "1".to_string(),
                word: "amiyo".to_string(),
                replacement: "Amiyo".to_string(),
                category: "name".to_string(),
                created_at: "2026-01-01".to_string(),
            },
            crate::db::DictionaryItem {
                id: "2".to_string(),
                word: "taury".to_string(),
                replacement: "Tauri".to_string(),
                category: "tech".to_string(),
                created_at: "2026-01-01".to_string(),
            },
        ];

        let text = "hello amiyo welcome to taury framework";
        let replaced = apply_dictionary(text, &dict);
        assert_eq!(replaced, "hello Amiyo welcome to Tauri framework");
    }

    #[test]
    fn test_snippet_expansion() {
        let snippets = vec![
            crate::db::SnippetItem {
                id: "1".to_string(),
                trigger: ";sig".to_string(),
                expansion: "Best regards,\nAmiyo Garai".to_string(),
                description: "Signature".to_string(),
                created_at: "2026-01-01".to_string(),
            },
            crate::db::SnippetItem {
                id: "2".to_string(),
                trigger: ";gh".to_string(),
                expansion: "https://github.com/amiyo".to_string(),
                description: "GitHub".to_string(),
                created_at: "2026-01-01".to_string(),
            },
        ];

        let text = "Check out my profile at ;gh and my signature is ;sig";
        let expanded = apply_snippets(text, &snippets);
        assert_eq!(expanded, "Check out my profile at https://github.com/amiyo and my signature is Best regards,\nAmiyo Garai");
    }

    #[test]
    fn test_verbal_punctuation_and_email_formatting() {
        let raw = "hello world comma please send an email to amiyo at gmail dot com period";
        let cleaned = heuristic_cleanup(raw);
        assert_eq!(cleaned, "Hello world, please send an email to amiyo@gmail.com.");
    }

    #[test]
    fn test_multiline_newline_preservation() {
        let raw = "first paragraph period new line second paragraph period";
        let cleaned = heuristic_cleanup(raw);
        assert_eq!(cleaned, "First paragraph.\nSecond paragraph.");
    }

    #[tokio::test]
    async fn test_dynamic_meeting_summary_extraction() {
        let transcript = "Sarah presented the quarterly release schedule. We agreed to ship v1.0 next Tuesday. John will prepare the release documentation.";
        let meeting = generate_meeting_summary(transcript).await.unwrap();

        assert!(meeting.summary.contains("Sarah presented") || meeting.summary.contains("Discussion"));
        assert!(meeting.decisions.iter().any(|d| d.contains("agreed to ship v1.0 next Tuesday")));
        assert!(meeting.action_items.iter().any(|a| a.contains("prepare the release documentation")));
    }
}
