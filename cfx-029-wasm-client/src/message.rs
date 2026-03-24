use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use crate::utils;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Message {
    pub id: String,
    pub r#type: MessageType,
    pub content: String,
    pub timestamp: f64,
    pub metadata: Option<MessageMetadata>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    User,
    Assistant,
    System,
    Error,
    Thinking,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MessageMetadata {
    pub request_id: Option<String>,
    pub model: Option<String>,
    pub tokens: Option<u32>,
    pub latency_ms: Option<f64>,
    pub transport: Option<String>,
    pub finish_reason: Option<String>,
    pub language: Option<String>,
}

impl Message {
    pub fn new(r#type: MessageType, content: String) -> Self {
        Message {
            id: utils::generate_request_id(),
            r#type,
            content,
            timestamp: utils::now_ms(),
            metadata: None,
        }
    }

    pub fn with_metadata(mut self, metadata: MessageMetadata) -> Self {
        self.metadata = Some(metadata);
        self
    }

    pub fn from_json(json_str: &str) -> Result<Self, JsValue> {
        serde_json::from_str(json_str)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse message JSON: {}", e)))
    }

    pub fn to_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(self)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize message: {}", e)))
    }

    /// Validate message content for safety
    pub fn validate(&self) -> Result<(), String> {
        // Check content length
        if self.content.len() > 1024 * 1024 {
            return Err("Message content too large (>1MB)".to_string());
        }

        // Check for malicious content patterns
        if self.content.contains("<script>") || 
           self.content.contains("javascript:") ||
           self.content.contains("data:text/html") {
            return Err("Message contains potentially unsafe content".to_string());
        }

        // Validate timestamp
        if self.timestamp <= 0.0 {
            return Err("Invalid timestamp".to_string());
        }

        Ok(())
    }

    /// Get a hash for caching purposes
    pub fn hash(&self) -> u64 {
        utils::hash_string(&format!("{}{}", self.r#type as u8, self.content))
    }

    /// Calculate approximate memory usage
    pub fn memory_size(&self) -> usize {
        std::mem::size_of::<Self>() + 
        self.id.len() + 
        self.content.len() +
        self.metadata.as_ref().map_or(0, |m| {
            m.request_id.as_ref().map_or(0, |s| s.len()) +
            m.model.as_ref().map_or(0, |s| s.len()) +
            m.transport.as_ref().map_or(0, |s| s.len()) +
            m.finish_reason.as_ref().map_or(0, |s| s.len()) +
            m.language.as_ref().map_or(0, |s| s.len()) +
            64 // rough estimate for numbers and option overhead
        })
    }
}

/// Specialized streaming chunk for real-time processing
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StreamChunk {
    pub token: String,
    pub buffer: String,
    pub request_id: String,
    pub timestamp: f64,
    pub r#type: ChunkType,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum ChunkType {
    Token,
    Thinking,
    Error,
    Complete,
}

impl StreamChunk {
    pub fn new(token: String, request_id: String, chunk_type: ChunkType) -> Self {
        StreamChunk {
            buffer: token.clone(),
            token,
            request_id,
            timestamp: utils::now_ms(),
            r#type: chunk_type,
        }
    }

    pub fn from_json(json_str: &str) -> Result<Self, JsValue> {
        serde_json::from_str(json_str)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse chunk JSON: {}", e)))
    }

    pub fn to_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(self)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize chunk: {}", e)))
    }
}

/// Queue message for offline storage
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct QueuedMessage {
    pub message: Message,
    pub priority: u8,
    pub attempts: u8,
    pub queued_at: f64,
    pub retry_after: Option<f64>,
}

impl QueuedMessage {
    pub fn new(message: Message, priority: u8) -> Self {
        QueuedMessage {
            message,
            priority,
            attempts: 0,
            queued_at: utils::now_ms(),
            retry_after: None,
        }
    }

    pub fn should_retry(&self, max_attempts: u8) -> bool {
        self.attempts < max_attempts && 
        self.retry_after.map_or(true, |retry_time| utils::now_ms() >= retry_time)
    }

    pub fn increment_attempt(&mut self, backoff_ms: f64) {
        self.attempts += 1;
        self.retry_after = Some(utils::now_ms() + backoff_ms);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_creation() {
        let msg = Message::new(MessageType::User, "Hello world".to_string());
        assert_eq!(msg.r#type as u8, MessageType::User as u8);
        assert_eq!(msg.content, "Hello world");
        assert!(msg.timestamp > 0.0);
    }

    #[test]
    fn test_message_validation() {
        let msg = Message::new(MessageType::User, "Safe content".to_string());
        assert!(msg.validate().is_ok());

        let unsafe_msg = Message::new(MessageType::User, "<script>alert('xss')</script>".to_string());
        assert!(unsafe_msg.validate().is_err());
    }
}