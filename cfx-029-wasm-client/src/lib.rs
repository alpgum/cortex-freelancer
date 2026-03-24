mod utils;
mod message;
mod cache;
mod crypto;
mod connection;
mod processor;
mod queue;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// This is like the `extern` block in C.
#[wasm_bindgen]
extern "C" {
    // Bind console.log function from the browser
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);

    // Bind alert function
    fn alert(s: &str);
}

// Define a macro to make console.log usage easier
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

// Main WASM client interface
#[wasm_bindgen]
pub struct CortexWasmClient {
    cache: cache::MessageCache,
    crypto: crypto::CryptoManager,
    connection: connection::ConnectionManager,
    processor: processor::MessageProcessor,
    queue: queue::MessageQueue,
}

#[wasm_bindgen]
pub struct ClientConfig {
    encryption_key: Option<Vec<u8>>,
    compression_level: u8,
    cache_size_mb: u32,
    enable_encryption: bool,
    enable_compression: bool,
}

#[wasm_bindgen]
impl ClientConfig {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ClientConfig {
        ClientConfig {
            encryption_key: None,
            compression_level: 6,
            cache_size_mb: 50,
            enable_encryption: true,
            enable_compression: true,
        }
    }

    #[wasm_bindgen(setter)]
    pub fn set_compression_level(&mut self, level: u8) {
        self.compression_level = level.min(12); // LZ4 max compression level
    }

    #[wasm_bindgen(setter)]
    pub fn set_cache_size_mb(&mut self, size: u32) {
        self.cache_size_mb = size;
    }

    #[wasm_bindgen(setter)]
    pub fn set_enable_encryption(&mut self, enable: bool) {
        self.enable_encryption = enable;
    }

    #[wasm_bindgen(setter)]
    pub fn set_enable_compression(&mut self, enable: bool) {
        self.enable_compression = enable;
    }
}

#[wasm_bindgen]
impl CortexWasmClient {
    /// Create a new WASM client instance
    #[wasm_bindgen(constructor)]
    pub fn new(config: ClientConfig) -> Result<CortexWasmClient, JsValue> {
        utils::set_panic_hook();
        
        console_log!("🚀 Initializing Cortex WASM Client");

        let cache = cache::MessageCache::new(config.cache_size_mb * 1024 * 1024)?;
        let crypto = crypto::CryptoManager::new(config.enable_encryption)?;
        let connection = connection::ConnectionManager::new();
        let processor = processor::MessageProcessor::new(
            config.enable_compression, 
            config.compression_level
        )?;
        let queue = queue::MessageQueue::new()?;

        Ok(CortexWasmClient {
            cache,
            crypto,
            connection,
            processor,
            queue,
        })
    }

    /// Process an incoming message (parsing, validation, caching)
    #[wasm_bindgen]
    pub fn process_message(&mut self, raw_message: &str) -> Result<JsValue, JsValue> {
        let parsed = self.processor.parse_message(raw_message)?;
        
        // Cache the processed message
        if let Some(id) = parsed.get("id").and_then(|v| v.as_str()) {
            self.cache.store(id, raw_message)?;
        }

        // Convert to JS object
        Ok(serde_wasm_bindgen::to_value(&parsed)?)
    }

    /// Process a streaming response chunk (markdown, syntax highlighting)
    #[wasm_bindgen]
    pub fn process_chunk(&self, chunk: &str, message_type: &str) -> Result<String, JsValue> {
        self.processor.process_chunk(chunk, message_type)
    }

    /// Queue a message for offline sync
    #[wasm_bindgen]
    pub fn queue_message(&mut self, message: &str, priority: u8) -> Result<(), JsValue> {
        self.queue.add_message(message, priority)
    }

    /// Get queued messages for sync
    #[wasm_bindgen]
    pub fn get_queued_messages(&self) -> Result<JsValue, JsValue> {
        let messages = self.queue.get_all_messages()?;
        Ok(serde_wasm_bindgen::to_value(&messages)?)
    }

    /// Clear message queue after successful sync
    #[wasm_bindgen]
    pub fn clear_message_queue(&mut self) -> Result<(), JsValue> {
        self.queue.clear()
    }

    /// Get cached response by message hash
    #[wasm_bindgen]
    pub fn get_cached_response(&mut self, message_hash: &str) -> Result<JsValue, JsValue> {
        match self.cache.get(message_hash)? {
            Some(cached) => Ok(JsValue::from_str(&cached)),
            None => Ok(JsValue::NULL),
        }
    }

    /// Update connection state
    #[wasm_bindgen]
    pub fn update_connection_state(&mut self, state: &str, transport: &str) -> Result<(), JsValue> {
        self.connection.update_state(state, transport)
    }

    /// Get connection statistics
    #[wasm_bindgen]
    pub fn get_connection_stats(&self) -> Result<JsValue, JsValue> {
        let stats = self.connection.get_stats();
        Ok(serde_wasm_bindgen::to_value(&stats)?)
    }

    /// Compress data using LZ4
    #[wasm_bindgen]
    pub fn compress_data(&self, data: &str) -> Result<Vec<u8>, JsValue> {
        self.processor.compress_string(data)
    }

    /// Decompress LZ4 data
    #[wasm_bindgen]
    pub fn decompress_data(&self, compressed: &[u8]) -> Result<String, JsValue> {
        self.processor.decompress_to_string(compressed)
    }

    /// Encrypt sensitive data
    #[wasm_bindgen]
    pub fn encrypt_data(&self, data: &str) -> Result<Vec<u8>, JsValue> {
        self.crypto.encrypt(data)
    }

    /// Decrypt sensitive data
    #[wasm_bindgen]
    pub fn decrypt_data(&self, encrypted: &[u8]) -> Result<String, JsValue> {
        self.crypto.decrypt(encrypted)
    }

    /// Get cache statistics
    #[wasm_bindgen]
    pub fn get_cache_stats(&self) -> Result<JsValue, JsValue> {
        let stats = self.cache.get_stats();
        Ok(serde_wasm_bindgen::to_value(&stats)?)
    }

    /// Clear all caches
    #[wasm_bindgen]
    pub fn clear_caches(&mut self) -> Result<(), JsValue> {
        self.cache.clear()
    }
}

/// Initialize the WASM module (called once)
#[wasm_bindgen(start)]
pub fn main() {
    utils::set_panic_hook();
    console_log!("🦀 Cortex WASM Client loaded successfully");
}