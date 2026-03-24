use std::collections::{BinaryHeap, HashMap};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use crate::message::{Message, QueuedMessage};
use crate::utils;
use std::cmp::Ordering;

// Priority queue item wrapper for BinaryHeap
#[derive(Debug, Clone)]
struct PriorityQueueItem {
    message: QueuedMessage,
    priority: u8,
    queued_at: f64,
}

impl PartialEq for PriorityQueueItem {
    fn eq(&self, other: &Self) -> bool {
        self.priority == other.priority && self.queued_at == other.queued_at
    }
}

impl Eq for PriorityQueueItem {}

impl PartialOrd for PriorityQueueItem {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PriorityQueueItem {
    fn cmp(&self, other: &Self) -> Ordering {
        // Higher priority first, then earlier timestamp
        self.priority.cmp(&other.priority)
            .then_with(|| other.queued_at.partial_cmp(&self.queued_at).unwrap_or(Ordering::Equal))
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct QueueStats {
    pub total_messages: usize,
    pub high_priority: usize,
    pub normal_priority: usize,
    pub low_priority: usize,
    pub oldest_message_age_ms: Option<f64>,
    pub total_size_bytes: usize,
    pub failed_messages: usize,
    pub retry_messages: usize,
}

pub struct MessageQueue {
    queue: BinaryHeap<PriorityQueueItem>,
    failed_messages: HashMap<String, QueuedMessage>,
    max_size: usize,
    max_retry_attempts: u8,
    retry_backoff_base: f64,
}

impl MessageQueue {
    pub fn new() -> Result<Self, JsValue> {
        Ok(MessageQueue {
            queue: BinaryHeap::new(),
            failed_messages: HashMap::new(),
            max_size: 1000, // Maximum 1000 queued messages
            max_retry_attempts: 5,
            retry_backoff_base: 2000.0, // 2 second base backoff
        })
    }

    /// Add a message to the queue
    pub fn add_message(&mut self, message: &str, priority: u8) -> Result<(), JsValue> {
        // Parse the message
        let parsed_message = Message::from_json(message)?;
        
        // Validate the message
        parsed_message.validate()
            .map_err(|e| JsValue::from_str(&format!("Message validation failed: {}", e)))?;

        // Check queue size limits
        if self.queue.len() >= self.max_size {
            // Remove oldest low-priority message to make space
            self.evict_old_messages()?;
        }

        // Create queued message
        let queued = QueuedMessage::new(parsed_message, priority.min(255));
        let item = PriorityQueueItem {
            message: queued,
            priority,
            queued_at: utils::now_ms(),
        };

        self.queue.push(item);
        Ok(())
    }

    /// Get next message to send (highest priority, oldest first)
    pub fn get_next_message(&mut self) -> Option<QueuedMessage> {
        while let Some(item) = self.queue.pop() {
            // Check if message should be retried
            if item.message.should_retry(self.max_retry_attempts) {
                return Some(item.message);
            }
            // If max retries exceeded, move to failed queue
            self.failed_messages.insert(item.message.message.id.clone(), item.message);
        }
        None
    }

    /// Mark message as sent successfully
    pub fn mark_sent(&mut self, message_id: &str) -> Result<bool, JsValue> {
        // Message was sent successfully, no need to keep it
        // Remove from failed queue if it was there
        Ok(self.failed_messages.remove(message_id).is_some())
    }

    /// Mark message as failed and requeue for retry
    pub fn mark_failed(&mut self, message_id: &str, error: &str) -> Result<(), JsValue> {
        // Find the message and increment retry count
        let mut found = false;
        let mut items_to_requeue = Vec::new();

        // Check current queue
        let current_items: Vec<_> = self.queue.drain().collect();
        for mut item in current_items {
            if item.message.message.id == message_id {
                let backoff_delay = self.calculate_backoff_delay(item.message.attempts);
                item.message.increment_attempt(backoff_delay);
                found = true;
                
                if item.message.should_retry(self.max_retry_attempts) {
                    items_to_requeue.push(item);
                } else {
                    // Max retries exceeded, move to failed
                    self.failed_messages.insert(message_id.to_string(), item.message);
                }
            } else {
                items_to_requeue.push(item);
            }
        }

        // Requeue items
        for item in items_to_requeue {
            self.queue.push(item);
        }

        if !found {
            return Err(JsValue::from_str("Message not found in queue"));
        }

        Ok(())
    }

    /// Get all messages in queue (for inspection/debugging)
    pub fn get_all_messages(&self) -> Result<Vec<QueuedMessage>, JsValue> {
        let mut messages: Vec<_> = self.queue.iter().map(|item| item.message.clone()).collect();
        
        // Sort by priority and timestamp
        messages.sort_by(|a, b| {
            a.priority.cmp(&b.priority)
                .then_with(|| a.queued_at.partial_cmp(&b.queued_at).unwrap_or(Ordering::Equal))
        });

        Ok(messages)
    }

    /// Clear all messages from queue
    pub fn clear(&mut self) -> Result<(), JsValue> {
        self.queue.clear();
        self.failed_messages.clear();
        Ok(())
    }

    /// Get queue statistics
    pub fn get_stats(&self) -> QueueStats {
        let mut high_priority = 0;
        let mut normal_priority = 0;
        let mut low_priority = 0;
        let mut total_size = 0;
        let mut oldest_age: Option<f64> = None;

        let now = utils::now_ms();

        for item in &self.queue {
            total_size += item.message.message.memory_size();
            
            match item.priority {
                200..=255 => high_priority += 1,
                100..=199 => normal_priority += 1,
                _ => low_priority += 1,
            }

            let age = now - item.queued_at;
            oldest_age = Some(oldest_age.map_or(age, |current| current.max(age)));
        }

        QueueStats {
            total_messages: self.queue.len(),
            high_priority,
            normal_priority,
            low_priority,
            oldest_message_age_ms: oldest_age,
            total_size_bytes: total_size,
            failed_messages: self.failed_messages.len(),
            retry_messages: self.queue.iter().filter(|item| item.message.attempts > 0).count(),
        }
    }

    /// Remove expired messages (older than max age)
    pub fn cleanup_expired(&mut self, max_age_ms: f64) -> usize {
        let now = utils::now_ms();
        let mut removed_count = 0;
        let mut items_to_keep = Vec::new();

        // Filter out expired messages
        for item in self.queue.drain() {
            if now - item.queued_at <= max_age_ms {
                items_to_keep.push(item);
            } else {
                removed_count += 1;
            }
        }

        // Rebuild queue
        for item in items_to_keep {
            self.queue.push(item);
        }

        // Clean failed messages too
        let expired_failed: Vec<String> = self.failed_messages
            .iter()
            .filter(|(_, msg)| now - msg.queued_at > max_age_ms)
            .map(|(id, _)| id.clone())
            .collect();

        for id in expired_failed {
            self.failed_messages.remove(&id);
            removed_count += 1;
        }

        removed_count
    }

    /// Peek at next message without removing it
    pub fn peek_next(&self) -> Option<&QueuedMessage> {
        self.queue.peek().map(|item| &item.message)
    }

    /// Get messages by priority level
    pub fn get_messages_by_priority(&self, priority: u8) -> Vec<QueuedMessage> {
        self.queue
            .iter()
            .filter(|item| item.priority == priority)
            .map(|item| item.message.clone())
            .collect()
    }

    /// Get failed messages for manual retry
    pub fn get_failed_messages(&self) -> Vec<QueuedMessage> {
        self.failed_messages.values().cloned().collect()
    }

    /// Retry a specific failed message
    pub fn retry_failed_message(&mut self, message_id: &str) -> Result<bool, JsValue> {
        if let Some(mut message) = self.failed_messages.remove(message_id) {
            // Reset attempt count for manual retry
            message.attempts = 0;
            message.retry_after = None;
            
            let item = PriorityQueueItem {
                priority: message.priority,
                queued_at: utils::now_ms(),
                message,
            };
            
            self.queue.push(item);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Configure queue settings
    pub fn configure(&mut self, max_size: usize, max_retry_attempts: u8, retry_backoff_base: f64) {
        self.max_size = max_size;
        self.max_retry_attempts = max_retry_attempts;
        self.retry_backoff_base = retry_backoff_base;
    }

    /// Calculate exponential backoff delay
    fn calculate_backoff_delay(&self, attempt: u8) -> f64 {
        let multiplier = 2.0_f64.powi(attempt as i32);
        let delay = self.retry_backoff_base * multiplier;
        
        // Add jitter (±25%)
        let jitter = (js_sys::Math::random() - 0.5) * 0.5;
        delay * (1.0 + jitter)
    }

    /// Evict old low-priority messages to make space
    fn evict_old_messages(&mut self) -> Result<(), JsValue> {
        if self.queue.is_empty() {
            return Err(JsValue::from_str("Queue full and no messages to evict"));
        }

        let mut items: Vec<_> = self.queue.drain().collect();
        
        // Sort by priority (ascending) then by age (descending)
        items.sort_by(|a, b| {
            a.priority.cmp(&b.priority)
                .then_with(|| b.queued_at.partial_cmp(&a.queued_at).unwrap_or(Ordering::Equal))
        });

        // Remove the oldest low-priority message
        items.pop();

        // Rebuild queue
        for item in items {
            self.queue.push(item);
        }

        Ok(())
    }

    /// Check if queue is empty
    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }

    /// Get queue length
    pub fn len(&self) -> usize {
        self.queue.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::message::{Message, MessageType};

    fn create_test_message(content: &str) -> String {
        let msg = Message::new(MessageType::User, content.to_string());
        msg.to_json().unwrap()
    }

    #[test]
    fn test_queue_priority_ordering() {
        let mut queue = MessageQueue::new().unwrap();
        
        // Add messages with different priorities
        queue.add_message(&create_test_message("low"), 50).unwrap();
        queue.add_message(&create_test_message("high"), 200).unwrap();
        queue.add_message(&create_test_message("normal"), 100).unwrap();
        
        // Should get high priority first
        let first = queue.get_next_message().unwrap();
        assert_eq!(first.priority, 200);
        
        let second = queue.get_next_message().unwrap();
        assert_eq!(second.priority, 100);
        
        let third = queue.get_next_message().unwrap();
        assert_eq!(third.priority, 50);
    }

    #[test]
    fn test_retry_logic() {
        let mut queue = MessageQueue::new().unwrap();
        let msg = create_test_message("test retry");
        
        queue.add_message(&msg, 100).unwrap();
        let message = queue.get_next_message().unwrap();
        let id = message.message.id.clone();
        
        // Mark as failed
        queue.mark_failed(&id, "network error").unwrap();
        
        // Should be available for retry
        let retry_message = queue.get_next_message();
        assert!(retry_message.is_some());
        assert_eq!(retry_message.unwrap().attempts, 1);
    }

    #[test]
    fn test_queue_stats() {
        let mut queue = MessageQueue::new().unwrap();
        
        queue.add_message(&create_test_message("high"), 200).unwrap();
        queue.add_message(&create_test_message("normal"), 100).unwrap();
        queue.add_message(&create_test_message("low"), 50).unwrap();
        
        let stats = queue.get_stats();
        assert_eq!(stats.total_messages, 3);
        assert_eq!(stats.high_priority, 1);
        assert_eq!(stats.normal_priority, 1);
        assert_eq!(stats.low_priority, 1);
    }
}