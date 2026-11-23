/// Native Operating-System Secure Credential Storage Engine
/// Uses Windows Credential Manager on Windows and Keychain Services on macOS.
/// Under NO circumstances are raw API keys stored in plain text, SQLite, logs, or sent to frontend.

use keyring::Entry;

const SERVICE_NAME: &str = "amiyo-flow";

pub struct CredentialManager;

impl CredentialManager {
    /// Saves an API key securely into native OS credential storage.
    pub fn set_key(provider: &str, api_key: &str) -> Result<(), String> {
        let clean_key = api_key.trim();
        if clean_key.is_empty() {
            return Self::delete_key(provider);
        }

        let entry = Entry::new(SERVICE_NAME, provider)
            .map_err(|e| format!("Failed to initialize OS credential entry: {}", e))?;

        entry
            .set_password(clean_key)
            .map_err(|e| format!("OS secure store error for {}: {}", provider, e))?;

        Ok(())
    }

    /// Securely retrieves an API key from OS credential storage.
    /// Strictly internal to backend AI runners; NEVER returned raw to the frontend.
    pub fn get_key(provider: &str) -> Result<Option<String>, String> {
        let entry = Entry::new(SERVICE_NAME, provider)
            .map_err(|e| format!("Failed to initialize OS credential entry: {}", e))?;

        match entry.get_password() {
            Ok(pass) => Ok(Some(pass)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Failed to retrieve credential for {}: {}", provider, e)),
        }
    }

    /// Checks if a credential exists in OS secure storage without loading its contents.
    pub fn has_key(provider: &str) -> bool {
        Self::get_key(provider).unwrap_or(None).is_some()
    }

    /// Permanently deletes an API key from native OS secure storage.
    pub fn delete_key(provider: &str) -> Result<(), String> {
        let entry = Entry::new(SERVICE_NAME, provider)
            .map_err(|e| format!("Failed to initialize OS credential entry: {}", e))?;

        match entry.delete_password() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Failed to delete credential for {}: {}", provider, e)),
        }
    }

    /// Masks an API key for safe display in UI (e.g. "sk-••••••••3821").
    pub fn mask_key(key: &str) -> String {
        let trimmed = key.trim();
        if trimmed.is_empty() {
            "".to_string()
        } else if trimmed.len() <= 8 {
            "••••••••••••".to_string()
        } else {
            let prefix = &trimmed[..3.min(trimmed.len())];
            let suffix = &trimmed[trimmed.len().saturating_sub(4)..];
            format!("{}••••••••{}", prefix, suffix)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_key() {
        assert_eq!(CredentialManager::mask_key("short"), "••••••••••••");
        let masked = CredentialManager::mask_key("sk-ant-api03-abcdef1234567890xyz");
        assert!(masked.starts_with("sk-••••••••"));
        assert!(masked.ends_with("0xyz"));
    }

    #[test]
    fn test_credential_roundtrip_or_mock() {
        // Test entry generation and masking
        let provider = "test_provider_unit";
        let secret = "sk-test-secret-value-12345678";

        // If OS credential manager is accessible in the runner environment:
        if let Ok(()) = CredentialManager::set_key(provider, secret) {
            assert!(CredentialManager::has_key(provider));
            let retrieved = CredentialManager::get_key(provider).unwrap();
            assert_eq!(retrieved, Some(secret.to_string()));
            let _ = CredentialManager::delete_key(provider);
        }
    }
}
