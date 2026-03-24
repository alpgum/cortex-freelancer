use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use crate::utils;

#[derive(Debug, Clone)]
pub struct CacheEntry {
    pub data: String,
    pub size: usize,
    pub created_at: f64,
    pub last_accessed: f64,
    pub access_count: u32,
}

impl CacheEntry {
    pub fn new(data: String) -> Self {
        let size = utils::memory_usage(&data);
        let now = utils::now_ms();
        
        CacheEntry {
            data,
            size,
            created_at: now,
            last_accessed: now,
            access_count: 1,
        }
    }

    pub fn access(&mut self) {
        self.last_accessed = utils::now_ms();
        self.access_count += 1;
    }
}

pub struct MessageCache {
    entries: HashMap<String, CacheEntry>,
    max_size: usize,
    current_size: usize,
    hits: u64,
    misses: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CacheStats {
    pub entries: usize,
    pub size_bytes: usize,
    pub max_size_bytes: usize,
    pub hit_rate: f64,
    pub total_requests: u64,
    pub avg_entry_size: f64,
    pub oldest_entry_age_ms: Option<f64>,
}

impl MessageCache {
    pub fn new(max_size: u32) -> Result<Self, JsValue> {
        Ok(MessageCache {
            entries: HashMap::new(),
            max_size: max_size as usize,
            current_size: 0,
            hits: 0,
            misses: 0,
        })
    }

    /// Store a message in the cache
    pub fn store(&mut self, key: &str, data: &str) -> Result<(), JsValue> {
        let entry = CacheEntry::new(data.to_string());
        let entry_size = entry.size;

        // Check if we need to evict entries
        if self.current_size + entry_size > self.max_size {
            self.evict_lru(entry_size);
        }

        // Update size tracking
        if let Some(old_entry) = self.entries.get(key) {
            self.current_size -= old_entry.size;
        }

        self.current_size += entry_size;
        self.entries.insert(key.to_string(), entry);

        Ok(())
    }

    /// Get a message from the cache
    pub fn get(&mut self, key: &str) -> Result<Option<String>, JsValue> {
        match self.entries.get_mut(key) {
            Some(entry) => {
                entry.access();
                self.hits += 1;
                Ok(Some(entry.data.clone()))
            },
            None => {
                self.misses += 1;
                Ok(None)
            }
        }
    }

    /// Remove a specific entry
    pub fn remove(&mut self, key: &str) -> Result<bool, JsValue> {
        match self.entries.remove(key) {
            Some(entry) => {
                self.current_size -= entry.size;
                Ok(true)
            },
            None => Ok(false)
        }
    }

    /// Clear all cache entries
    pub fn clear(&mut self) -> Result<(), JsValue> {
        self.entries.clear();
        self.current_size = 0;
        Ok(())
    }

    /// Evict least recently used entries to make space
    fn evict_lru(&mut self, needed_space: usize) {
        let mut entries_to_remove = Vec::new();
        let target_size = self.max_size - needed_space;

        // Collect entries sorted by last access time
        let mut sorted_entries: Vec<(&String, &CacheEntry)> = self.entries.iter().collect();
        sorted_entries.sort_by(|a, b| a.1.last_accessed.partial_cmp(&b.1.last_accessed).unwrap());

        // Remove oldest entries until we have enough space
        for (key, entry) in sorted_entries {
            if self.current_size <= target_size {
                break;
            }
            entries_to_remove.push(key.clone());
            self.current_size -= entry.size;
        }

        // Actually remove the entries
        for key in entries_to_remove {
            self.entries.remove(&key);
        }
    }

    /// Get cache statistics
    pub fn get_stats(&self) -> CacheStats {
        let total_requests = self.hits + self.misses;
        let hit_rate = if total_requests > 0 {
            self.hits as f64 / total_requests as f64
        } else {
            0.0
        };

        let avg_entry_size = if !self.entries.is_empty() {
            self.current_size as f64 / self.entries.len() as f64
        } else {
            0.0
        };

        let oldest_entry_age_ms = if !self.entries.is_empty() {
            let now = utils::now_ms();
            let oldest = self.entries.values()
                .min_by(|a, b| a.created_at.partial_cmp(&b.created_at).unwrap());
            oldest.map(|entry| now - entry.created_at)
        } else {
            None
        };

        CacheStats {
            entries: self.entries.len(),
            size_bytes: self.current_size,
            max_size_bytes: self.max_size,
            hit_rate,
            total_requests,
            avg_entry_size,
            oldest_entry_age_ms,
        }
    }

    /// Check if cache has reached capacity
    pub fn is_full(&self) -> bool {
        self.current_size >= self.max_size
    }

    /// Get all cached keys (for debugging)
    pub fn get_keys(&self) -> Vec<String> {
        self.entries.keys().cloned().collect()
    }

    /// Cleanup expired entries (based on age)
    pub fn cleanup_expired(&mut self, max_age_ms: f64) {
        let now = utils::now_ms();
        let mut expired_keys = Vec::new();

        for (key, entry) in &self.entries {
            if now - entry.created_at > max_age_ms {
                expired_keys.push(key.clone());
            }
        }

        for key in expired_keys {
            self.remove(&key).ok();
        }
    }

    /// Preemptively clean up least used entries
    pub fn optimize(&mut self) {
        // Remove entries that haven't been accessed recently
        let now = utils::now_ms();
        let threshold = now - 3600000.0; // 1 hour ago
        
        let mut stale_keys = Vec::new();
        for (key, entry) in &self.entries {
            if entry.last_accessed < threshold && entry.access_count < 3 {
                stale_keys.push(key.clone());
            }
        }

        for key in stale_keys {
            self.remove(&key).ok();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_basic_operations() {
        let mut cache = MessageCache::new(1000).unwrap();
        
        // Test store and get
        cache.store("key1", "value1").unwrap();
        assert_eq!(cache.get("key1").unwrap(), Some("value1".to_string()));
        
        // Test miss
        assert_eq!(cache.get("nonexistent").unwrap(), None);
        
        // Test removal
        assert!(cache.remove("key1").unwrap());
        assert_eq!(cache.get("key1").unwrap(), None);
    }

    #[test]
    fn test_cache_eviction() {
        let mut cache = MessageCache::new(100).unwrap(); // Small cache
        
        // Fill cache beyond capacity
        for i in 0..10 {
            cache.store(&format!("key{}", i), &"x".repeat(50)).unwrap();
        }
        
        // Should have evicted some entries
        assert!(cache.entries.len() <= 3); // Rough estimate based on size
    }
}