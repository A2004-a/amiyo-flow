use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryItem {
    pub id: String,
    pub timestamp: String,
    pub duration_ms: i64,
    pub raw_text: String,
    pub cleaned_text: String,
    pub target_app: String,
    pub word_count: i64,
    pub style: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DictionaryItem {
    pub id: String,
    pub word: String,
    pub replacement: String,
    pub category: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetItem {
    pub id: String,
    pub trigger: String,
    pub expansion: String,
    pub description: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingItem {
    pub id: String,
    pub title: String,
    pub timestamp: String,
    pub duration_sec: i64,
    pub transcript: String,
    pub summary: String,
    pub decisions: Vec<String>,
    pub action_items: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsSummary {
    pub total_words: i64,
    pub total_dictations: i64,
    pub today_words: i64,
    pub estimated_minutes_saved: f64,
    pub average_wpm: f64,
}

impl Database {
    pub fn new(app_dir: PathBuf) -> Result<Self, rusqlite::Error> {
        std::fs::create_dir_all(&app_dir).ok();
        let db_path = app_dir.join("amiyo_flow.db");
        let conn = Connection::open(db_path)?;
        
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        db.seed_defaults()?;
        Ok(db)
    }

    pub fn new_in_memory() -> Result<Self, rusqlite::Error> {
        let conn = Connection::open_in_memory()?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        db.seed_defaults()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS history (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                duration_ms INTEGER NOT NULL,
                raw_text TEXT NOT NULL,
                cleaned_text TEXT NOT NULL,
                target_app TEXT NOT NULL,
                word_count INTEGER NOT NULL,
                style TEXT NOT NULL,
                provider TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS dictionary (
                id TEXT PRIMARY KEY,
                word TEXT NOT NULL UNIQUE,
                replacement TEXT NOT NULL,
                category TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS snippets (
                id TEXT PRIMARY KEY,
                trigger TEXT NOT NULL UNIQUE,
                expansion TEXT NOT NULL,
                description TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS meetings (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                duration_sec INTEGER NOT NULL,
                transcript TEXT NOT NULL,
                summary TEXT NOT NULL,
                decisions_json TEXT NOT NULL,
                action_items_json TEXT NOT NULL
            );
            "#,
        )?;
        Ok(())
    }

    fn seed_defaults(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();

        // Seed default settings if not exist
        let default_settings = [
            ("hotkey", "Control+Space"),
            ("hold_to_talk", "false"),
            ("style", "Professional"),
            ("language", "auto"),
            ("stt_provider", "groq"),
            ("ai_provider", "groq"),
            ("groq_api_key", ""),
            ("openai_api_key", ""),
            ("anthropic_api_key", ""),
            ("gemini_api_key", ""),
            ("auto_insert", "true"),
            ("use_clipboard", "false"),
            ("restore_clipboard_delay_ms", "35"),
            ("audio_retention", "0"), // 0 = delete immediately
            ("theme", "dark"),
            ("audio_device", "default"),
            ("remove_filler_words", "true"),
            ("remove_repeated_words", "true"),
            ("remove_self_corrections", "true"),
            ("clean_sentences", "true"),
            ("custom_filler_words", ""),
        ];

        for (k, v) in default_settings.iter() {
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
                params![k, v],
            )?;
        }

        // Migrate legacy hotkey if set to CommandOrControl variants
        let _ = conn.execute(
            "UPDATE settings SET value = 'Control+Space' WHERE key = 'hotkey' AND (value = 'CommandOrControl+Shift+Space' OR value LIKE '%CommandOrControl%')",
            [],
        );

        // Ensure safe Direct Unicode injection is default (eliminates clipboard race condition)
        let _ = conn.execute(
            "UPDATE settings SET value = 'false' WHERE key = 'use_clipboard' AND value = 'true'",
            [],
        );

        // Seed default dictionary words
        let default_words = [
            ("Amiyo", "Amiyo", "Names"),
            ("Antigravity", "Antigravity", "Technical"),
            ("Tauri", "Tauri", "Technical"),
            ("Kubernetes", "Kubernetes", "Technical"),
            ("GraphQL", "GraphQL", "Technical"),
            ("PostgreSQL", "PostgreSQL", "Technical"),
            ("TypeScript", "TypeScript", "Technical"),
        ];

        for (w, r, c) in default_words.iter() {
            let id = uuid::Uuid::new_v4().to_string();
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT OR IGNORE INTO dictionary (id, word, replacement, category, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, w, r, c, now],
            )?;
        }

        // Seed default snippets
        let default_snippets = [
            (";sig", "Best regards,\nAmiyo Garai", "Standard Email Signature"),
            (";gh", "https://github.com", "GitHub Homepage"),
            (";meet", "Let's schedule a quick sync to review this.", "Meeting Request"),
            (";ty", "Thank you very much for your help!", "Thank You note"),
        ];

        for (tr, exp, desc) in default_snippets.iter() {
            let id = uuid::Uuid::new_v4().to_string();
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT OR IGNORE INTO snippets (id, trigger, expansion, description, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, tr, exp, desc, now],
            )?;
        }

        Ok(())
    }

    // --- Settings API ---
    pub fn get_setting(&self, key: &str) -> Option<String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1").ok()?;
        stmt.query_row(params![key], |row| row.get(0)).ok()
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_all_settings(&self) -> Result<std::collections::HashMap<String, String>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut map = std::collections::HashMap::new();
        for r in rows {
            if let Ok((k, v)) = r {
                map.insert(k, v);
            }
        }
        Ok(map)
    }

    // --- History API ---
    pub fn add_history(&self, item: HistoryItem) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"INSERT INTO history (id, timestamp, duration_ms, raw_text, cleaned_text, target_app, word_count, style, provider)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"#,
            params![
                item.id,
                item.timestamp,
                item.duration_ms,
                item.raw_text,
                item.cleaned_text,
                item.target_app,
                item.word_count,
                item.style,
                item.provider
            ],
        )?;
        Ok(())
    }

    pub fn get_history(&self, limit: i64) -> Result<Vec<HistoryItem>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, timestamp, duration_ms, raw_text, cleaned_text, target_app, word_count, style, provider FROM history ORDER BY timestamp DESC LIMIT ?1"
        )?;
        let rows = stmt.query_map(params![limit], |row| {
            Ok(HistoryItem {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                duration_ms: row.get(2)?,
                raw_text: row.get(3)?,
                cleaned_text: row.get(4)?,
                target_app: row.get(5)?,
                word_count: row.get(6)?,
                style: row.get(7)?,
                provider: row.get(8)?,
            })
        })?;
        let mut items = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                items.push(item);
            }
        }
        Ok(items)
    }

    pub fn delete_history_item(&self, id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM history WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn clear_history(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM history", [])?;
        Ok(())
    }

    // --- Dictionary API ---
    pub fn get_dictionary(&self) -> Result<Vec<DictionaryItem>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, word, replacement, category, created_at FROM dictionary ORDER BY word ASC")?;
        let rows = stmt.query_map([], |row| {
            Ok(DictionaryItem {
                id: row.get(0)?,
                word: row.get(1)?,
                replacement: row.get(2)?,
                category: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;
        let mut items = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                items.push(item);
            }
        }
        Ok(items)
    }

    pub fn add_dictionary_word(&self, word: &str, replacement: &str, category: &str) -> Result<DictionaryItem, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO dictionary (id, word, replacement, category, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, word, replacement, category, now],
        )?;
        Ok(DictionaryItem {
            id,
            word: word.to_string(),
            replacement: replacement.to_string(),
            category: category.to_string(),
            created_at: now,
        })
    }

    pub fn delete_dictionary_word(&self, id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM dictionary WHERE id = ?1", params![id])?;
        Ok(())
    }

    // --- Snippets API ---
    pub fn get_snippets(&self) -> Result<Vec<SnippetItem>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, trigger, expansion, description, created_at FROM snippets ORDER BY trigger ASC")?;
        let rows = stmt.query_map([], |row| {
            Ok(SnippetItem {
                id: row.get(0)?,
                trigger: row.get(1)?,
                expansion: row.get(2)?,
                description: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;
        let mut items = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                items.push(item);
            }
        }
        Ok(items)
    }

    pub fn add_snippet(&self, trigger: &str, expansion: &str, description: &str) -> Result<SnippetItem, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO snippets (id, trigger, expansion, description, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, trigger, expansion, description, now],
        )?;
        Ok(SnippetItem {
            id,
            trigger: trigger.to_string(),
            expansion: expansion.to_string(),
            description: description.to_string(),
            created_at: now,
        })
    }

    pub fn delete_snippet(&self, id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM snippets WHERE id = ?1", params![id])?;
        Ok(())
    }

    // --- Meetings API ---
    pub fn get_meetings(&self) -> Result<Vec<MeetingItem>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, title, timestamp, duration_sec, transcript, summary, decisions_json, action_items_json FROM meetings ORDER BY timestamp DESC")?;
        let rows = stmt.query_map([], |row| {
            let decisions_json: String = row.get(6)?;
            let action_items_json: String = row.get(7)?;
            let decisions: Vec<String> = serde_json::from_str(&decisions_json).unwrap_or_default();
            let action_items: Vec<String> = serde_json::from_str(&action_items_json).unwrap_or_default();
            Ok(MeetingItem {
                id: row.get(0)?,
                title: row.get(1)?,
                timestamp: row.get(2)?,
                duration_sec: row.get(3)?,
                transcript: row.get(4)?,
                summary: row.get(5)?,
                decisions,
                action_items,
            })
        })?;
        let mut items = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                items.push(item);
            }
        }
        Ok(items)
    }

    pub fn add_meeting(&self, item: MeetingItem) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let decisions_json = serde_json::to_string(&item.decisions).unwrap_or_else(|_| "[]".to_string());
        let action_items_json = serde_json::to_string(&item.action_items).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            r#"INSERT INTO meetings (id, title, timestamp, duration_sec, transcript, summary, decisions_json, action_items_json)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"#,
            params![
                item.id,
                item.title,
                item.timestamp,
                item.duration_sec,
                item.transcript,
                item.summary,
                decisions_json,
                action_items_json
            ],
        )?;
        Ok(())
    }

    pub fn update_meeting(&self, item: MeetingItem) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let decisions_json = serde_json::to_string(&item.decisions).unwrap_or_else(|_| "[]".to_string());
        let action_items_json = serde_json::to_string(&item.action_items).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            r#"UPDATE meetings SET title = ?1, summary = ?2, decisions_json = ?3, action_items_json = ?4 WHERE id = ?5"#,
            params![
                item.title,
                item.summary,
                decisions_json,
                action_items_json,
                item.id
            ],
        )?;
        Ok(())
    }

    pub fn delete_meeting(&self, id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM meetings WHERE id = ?1", params![id])?;
        Ok(())
    }

    // --- Analytics API ---
    pub fn get_analytics(&self) -> Result<AnalyticsSummary, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut total_words: i64 = 0;
        let mut total_dictations: i64 = 0;
        let mut today_words: i64 = 0;

        let _ = conn.query_row(
            "SELECT COUNT(*), COALESCE(SUM(word_count), 0) FROM history",
            [],
            |row| {
                total_dictations = row.get(0)?;
                total_words = row.get(1)?;
                Ok(())
            },
        );

        let today_utc = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let today_local = chrono::Local::now().format("%Y-%m-%d").to_string();
        let _ = conn.query_row(
            "SELECT COALESCE(SUM(word_count), 0) FROM history WHERE timestamp LIKE ?1 OR timestamp LIKE ?2",
            params![format!("{}%", today_utc), format!("{}%", today_local)],
            |row| {
                today_words = row.get(0)?;
                Ok(())
            },
        );

        // Average typing speed is ~40 WPM. Dictation is ~150 WPM.
        // Time saved = (words / 40) - (words / 150) minutes
        let words_f = total_words as f64;
        let estimated_minutes_saved = (words_f / 40.0) - (words_f / 150.0);
        let average_wpm = if total_dictations > 0 { 145.0 } else { 0.0 };

        Ok(AnalyticsSummary {
            total_words,
            total_dictations,
            today_words,
            estimated_minutes_saved: if estimated_minutes_saved > 0.0 { estimated_minutes_saved } else { 0.0 },
            average_wpm,
        })
    }
}
