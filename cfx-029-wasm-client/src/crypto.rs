use aes_gcm::{Aes256Gcm, Key, Nonce, AeadInPlace, KeyInit};
use wasm_bindgen::prelude::*;
use getrandom::getrandom;
use serde::{Deserialize, Serialize};

pub struct CryptoManager {
    cipher: Option<Aes256Gcm>,
    enabled: bool,
}

#[derive(Serialize, Deserialize)]
struct EncryptedData {
    nonce: Vec<u8>,
    data: Vec<u8>,
    tag: Vec<u8>,
}

impl CryptoManager {
    pub fn new(enabled: bool) -> Result<Self, JsValue> {
        let cipher = if enabled {
            // Generate a random key for this session
            // In production, this should be derived from user password or stored securely
            let mut key_bytes = [0u8; 32];
            getrandom(&mut key_bytes)
                .map_err(|e| JsValue::from_str(&format!("Random key generation failed: {:?}", e)))?;
            let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
            Some(Aes256Gcm::new(key))
        } else {
            None
        };

        Ok(CryptoManager {
            cipher,
            enabled,
        })
    }

    /// Initialize with a specific key (from user input or derived key)
    pub fn with_key(key_bytes: &[u8]) -> Result<Self, JsValue> {
        if key_bytes.len() != 32 {
            return Err(JsValue::from_str("Key must be exactly 32 bytes"));
        }

        let key = Key::<Aes256Gcm>::from_slice(key_bytes);
        let cipher = Aes256Gcm::new(key);

        Ok(CryptoManager {
            cipher: Some(cipher),
            enabled: true,
        })
    }

    /// Encrypt a string and return encrypted bytes
    pub fn encrypt(&self, plaintext: &str) -> Result<Vec<u8>, JsValue> {
        if !self.enabled {
            return Ok(plaintext.as_bytes().to_vec());
        }

        let cipher = self.cipher.as_ref()
            .ok_or_else(|| JsValue::from_str("Encryption not initialized"))?;

        // Generate random nonce
        let mut nonce_bytes = [0u8; 12];
        getrandom(&mut nonce_bytes)
            .map_err(|e| JsValue::from_str(&format!("Random nonce generation failed: {:?}", e)))?;
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Prepare data for in-place encryption
        let mut data = plaintext.as_bytes().to_vec();
        
        // Encrypt in place and get authentication tag
        let tag = cipher.encrypt_in_place_detached(nonce, b"", &mut data)
            .map_err(|e| JsValue::from_str(&format!("Encryption failed: {:?}", e)))?;

        // Package the encrypted data
        let encrypted = EncryptedData {
            nonce: nonce_bytes.to_vec(),
            data,
            tag: tag.to_vec(),
        };

        // Serialize to bytes
        serde_json::to_vec(&encrypted)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize encrypted data: {}", e)))
    }

    /// Decrypt bytes back to string
    pub fn decrypt(&self, encrypted_bytes: &[u8]) -> Result<String, JsValue> {
        if !self.enabled {
            return String::from_utf8(encrypted_bytes.to_vec())
                .map_err(|e| JsValue::from_str(&format!("Invalid UTF-8: {}", e)));
        }

        let cipher = self.cipher.as_ref()
            .ok_or_else(|| JsValue::from_str("Encryption not initialized"))?;

        // Deserialize the encrypted data structure
        let encrypted: EncryptedData = serde_json::from_slice(encrypted_bytes)
            .map_err(|e| JsValue::from_str(&format!("Failed to deserialize encrypted data: {}", e)))?;

        // Validate lengths
        if encrypted.nonce.len() != 12 {
            return Err(JsValue::from_str("Invalid nonce length"));
        }

        if encrypted.tag.len() != 16 {
            return Err(JsValue::from_str("Invalid tag length"));
        }

        let nonce = Nonce::from_slice(&encrypted.nonce);
        let mut data = encrypted.data;

        // Decrypt in place
        let tag = aes_gcm::Tag::from_slice(&encrypted.tag);
        cipher.decrypt_in_place_detached(nonce, b"", &mut data, tag)
            .map_err(|e| JsValue::from_str(&format!("Decryption failed: {:?}", e)))?;

        // Convert back to string
        String::from_utf8(data)
            .map_err(|e| JsValue::from_str(&format!("Invalid UTF-8 in decrypted data: {}", e)))
    }

    /// Check if encryption is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Generate a hash for data integrity checking
    pub fn hash_data(&self, data: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        data.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    /// Securely compare two strings (constant time to prevent timing attacks)
    pub fn secure_compare(&self, a: &str, b: &str) -> bool {
        if a.len() != b.len() {
            return false;
        }

        let a_bytes = a.as_bytes();
        let b_bytes = b.as_bytes();
        let mut result = 0u8;

        for i in 0..a_bytes.len() {
            result |= a_bytes[i] ^ b_bytes[i];
        }

        result == 0
    }
}

/// Generate a cryptographically secure random key
#[wasm_bindgen]
pub fn generate_encryption_key() -> Vec<u8> {
    let mut key = [0u8; 32];
    getrandom(&mut key).expect("getrandom failed");
    key.to_vec()
}

/// Hash a password using a simple but secure method (for demo purposes)
/// In production, use proper password hashing like Argon2
#[wasm_bindgen]
pub fn hash_password(password: &str, salt: &[u8]) -> Vec<u8> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    password.hash(&mut hasher);
    salt.hash(&mut hasher);
    
    // Simple key derivation - extend to 32 bytes
    let hash = hasher.finish();
    let mut key = [0u8; 32];
    for i in 0..4 {
        let bytes = (hash.wrapping_mul((i + 1) as u64)).to_le_bytes();
        key[i*8..(i+1)*8].copy_from_slice(&bytes);
    }
    key.to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_roundtrip() {
        let crypto = CryptoManager::new(true).unwrap();
        let plaintext = "Hello, secure world!";
        
        let encrypted = crypto.encrypt(plaintext).unwrap();
        let decrypted = crypto.decrypt(&encrypted).unwrap();
        
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_encryption_disabled() {
        let crypto = CryptoManager::new(false).unwrap();
        let plaintext = "Hello world";
        
        let result = crypto.encrypt(plaintext).unwrap();
        assert_eq!(result, plaintext.as_bytes().to_vec());
    }

    #[test]
    fn test_with_custom_key() {
        let key = generate_encryption_key();
        let crypto = CryptoManager::with_key(&key).unwrap();
        let plaintext = "Secret message";
        
        let encrypted = crypto.encrypt(plaintext).unwrap();
        let decrypted = crypto.decrypt(&encrypted).unwrap();
        
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_secure_compare() {
        let crypto = CryptoManager::new(false).unwrap();
        
        assert!(crypto.secure_compare("hello", "hello"));
        assert!(!crypto.secure_compare("hello", "world"));
        assert!(!crypto.secure_compare("hello", "hello!"));
    }
}