use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use crate::utils;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Degraded,
    Reconnecting,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStats {
    pub state: ConnectionState,
    pub transport: Option<String>,
    pub connected_at: Option<f64>,
    pub last_activity: f64,
    pub total_connections: u32,
    pub connection_attempts: u32,
    pub successful_connections: u32,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub messages_sent: u32,
    pub messages_received: u32,
    pub avg_latency_ms: f64,
    pub uptime_ms: f64,
    pub downtime_ms: f64,
    pub error_count: u32,
    pub retry_count: u32,
}

#[derive(Debug, Clone)]
pub struct ConnectionEvent {
    pub timestamp: f64,
    pub event_type: String,
    pub data: String,
}

pub struct ConnectionManager {
    state: ConnectionState,
    transport: Option<String>,
    connected_at: Option<f64>,
    last_activity: f64,
    stats: ConnectionStats,
    events: Vec<ConnectionEvent>,
    latencies: Vec<f64>,
    backoff_calculator: BackoffCalculator,
}

struct BackoffCalculator {
    base_delay_ms: f64,
    max_delay_ms: f64,
    multiplier: f64,
    current_delay: f64,
    attempt_count: u32,
}

impl BackoffCalculator {
    pub fn new() -> Self {
        BackoffCalculator {
            base_delay_ms: 1000.0,   // Start with 1 second
            max_delay_ms: 30000.0,   // Cap at 30 seconds
            multiplier: 2.0,         // Double each time
            current_delay: 1000.0,
            attempt_count: 0,
        }
    }

    pub fn next_delay(&mut self) -> f64 {
        self.attempt_count += 1;
        if self.attempt_count == 1 {
            return self.base_delay_ms;
        }

        self.current_delay = (self.current_delay * self.multiplier).min(self.max_delay_ms);
        
        // Add jitter (±25%) to prevent thundering herd
        let jitter = (js_sys::Math::random() - 0.5) * 0.5;
        self.current_delay * (1.0 + jitter)
    }

    pub fn reset(&mut self) {
        self.current_delay = self.base_delay_ms;
        self.attempt_count = 0;
    }

    pub fn get_attempt_count(&self) -> u32 {
        self.attempt_count
    }
}

impl ConnectionManager {
    pub fn new() -> Self {
        let now = utils::now_ms();
        
        ConnectionManager {
            state: ConnectionState::Disconnected,
            transport: None,
            connected_at: None,
            last_activity: now,
            stats: ConnectionStats {
                state: ConnectionState::Disconnected,
                transport: None,
                connected_at: None,
                last_activity: now,
                total_connections: 0,
                connection_attempts: 0,
                successful_connections: 0,
                bytes_sent: 0,
                bytes_received: 0,
                messages_sent: 0,
                messages_received: 0,
                avg_latency_ms: 0.0,
                uptime_ms: 0.0,
                downtime_ms: 0.0,
                error_count: 0,
                retry_count: 0,
            },
            events: Vec::new(),
            latencies: Vec::new(),
            backoff_calculator: BackoffCalculator::new(),
        }
    }

    /// Update connection state
    pub fn update_state(&mut self, state: &str, transport: &str) -> Result<(), JsValue> {
        let new_state = match state {
            "disconnected" => ConnectionState::Disconnected,
            "connecting" => ConnectionState::Connecting,
            "connected" => ConnectionState::Connected,
            "degraded" => ConnectionState::Degraded,
            "reconnecting" => ConnectionState::Reconnecting,
            "failed" => ConnectionState::Failed,
            _ => return Err(JsValue::from_str(&format!("Unknown state: {}", state))),
        };

        let now = utils::now_ms();
        
        // Handle state transitions
        match (&self.state, &new_state) {
            (_, ConnectionState::Connecting) => {
                self.stats.connection_attempts += 1;
                self.log_event("connecting", transport);
            },
            (_, ConnectionState::Connected) => {
                self.stats.successful_connections += 1;
                self.stats.total_connections += 1;
                self.connected_at = Some(now);
                self.backoff_calculator.reset();
                self.log_event("connected", transport);
            },
            (ConnectionState::Connected, ConnectionState::Disconnected) |
            (ConnectionState::Connected, ConnectionState::Failed) => {
                if let Some(connected_time) = self.connected_at {
                    self.stats.uptime_ms += now - connected_time;
                }
                self.connected_at = None;
                self.stats.error_count += 1;
                self.log_event("disconnected", "connection lost");
            },
            (_, ConnectionState::Reconnecting) => {
                self.stats.retry_count += 1;
                self.log_event("reconnecting", &format!("attempt #{}", self.stats.retry_count));
            },
            _ => {},
        }

        self.state = new_state.clone();
        self.transport = Some(transport.to_string());
        self.last_activity = now;
        
        // Update stats
        self.stats.state = new_state;
        self.stats.transport = Some(transport.to_string());
        self.stats.last_activity = now;

        Ok(())
    }

    /// Record message activity
    pub fn record_message_sent(&mut self, bytes: usize) {
        self.stats.messages_sent += 1;
        self.stats.bytes_sent += bytes as u64;
        self.last_activity = utils::now_ms();
        self.stats.last_activity = self.last_activity;
    }

    pub fn record_message_received(&mut self, bytes: usize) {
        self.stats.messages_received += 1;
        self.stats.bytes_received += bytes as u64;
        self.last_activity = utils::now_ms();
        self.stats.last_activity = self.last_activity;
    }

    /// Record latency measurement
    pub fn record_latency(&mut self, latency_ms: f64) {
        self.latencies.push(latency_ms);
        
        // Keep only recent latencies (last 100 measurements)
        if self.latencies.len() > 100 {
            self.latencies.drain(0..50);
        }

        // Recalculate average
        if !self.latencies.is_empty() {
            self.stats.avg_latency_ms = self.latencies.iter().sum::<f64>() / self.latencies.len() as f64;
        }
    }

    /// Get next backoff delay for reconnection
    pub fn get_next_backoff_delay(&mut self) -> f64 {
        self.backoff_calculator.next_delay()
    }

    /// Check if should attempt reconnection
    pub fn should_reconnect(&self) -> bool {
        match self.state {
            ConnectionState::Failed | ConnectionState::Disconnected => {
                self.backoff_calculator.get_attempt_count() < 10 // Max 10 retries
            },
            _ => false,
        }
    }

    /// Get connection statistics
    pub fn get_stats(&self) -> ConnectionStats {
        let mut stats = self.stats.clone();
        
        // Calculate current uptime if connected
        if let Some(connected_time) = self.connected_at {
            stats.uptime_ms += utils::now_ms() - connected_time;
        }
        
        stats.connected_at = self.connected_at;
        stats
    }

    /// Check if connection is healthy
    pub fn is_healthy(&self) -> bool {
        match self.state {
            ConnectionState::Connected => {
                let now = utils::now_ms();
                let time_since_activity = now - self.last_activity;
                time_since_activity < 60000.0 // Healthy if activity within last minute
            },
            _ => false,
        }
    }

    /// Get connection quality score (0-100)
    pub fn get_quality_score(&self) -> u8 {
        let mut score = 0u8;

        // Base score based on state
        score += match self.state {
            ConnectionState::Connected => 40,
            ConnectionState::Degraded => 20,
            ConnectionState::Connecting | ConnectionState::Reconnecting => 10,
            _ => 0,
        };

        // Latency score (30 points max)
        if !self.latencies.is_empty() {
            let avg_latency = self.stats.avg_latency_ms;
            score += if avg_latency < 100.0 {
                30
            } else if avg_latency < 500.0 {
                20
            } else if avg_latency < 1000.0 {
                10
            } else {
                5
            };
        }

        // Reliability score (30 points max)
        if self.stats.connection_attempts > 0 {
            let success_rate = self.stats.successful_connections as f64 / self.stats.connection_attempts as f64;
            score += (success_rate * 30.0) as u8;
        }

        score
    }

    /// Log a connection event
    fn log_event(&mut self, event_type: &str, data: &str) {
        let event = ConnectionEvent {
            timestamp: utils::now_ms(),
            event_type: event_type.to_string(),
            data: data.to_string(),
        };

        self.events.push(event);

        // Keep only recent events (last 50)
        if self.events.len() > 50 {
            self.events.drain(0..25);
        }
    }

    /// Get recent connection events
    pub fn get_recent_events(&self, limit: usize) -> Vec<ConnectionEvent> {
        let start = if self.events.len() > limit {
            self.events.len() - limit
        } else {
            0
        };
        self.events[start..].to_vec()
    }

    /// Export connection data for diagnostics
    pub fn export_diagnostics(&self) -> HashMap<String, String> {
        let mut diagnostics = HashMap::new();
        
        diagnostics.insert("state".to_string(), format!("{:?}", self.state));
        diagnostics.insert("transport".to_string(), self.transport.clone().unwrap_or_else(|| "none".to_string()));
        diagnostics.insert("quality_score".to_string(), self.get_quality_score().to_string());
        diagnostics.insert("avg_latency".to_string(), format!("{:.1}ms", self.stats.avg_latency_ms));
        diagnostics.insert("total_connections".to_string(), self.stats.total_connections.to_string());
        diagnostics.insert("success_rate".to_string(), {
            if self.stats.connection_attempts > 0 {
                format!("{:.1}%", 
                    (self.stats.successful_connections as f64 / self.stats.connection_attempts as f64) * 100.0)
            } else {
                "N/A".to_string()
            }
        });
        diagnostics.insert("uptime_minutes".to_string(), format!("{:.1}", self.stats.uptime_ms / 60000.0));
        diagnostics.insert("error_count".to_string(), self.stats.error_count.to_string());
        
        diagnostics
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connection_state_transitions() {
        let mut manager = ConnectionManager::new();
        
        manager.update_state("connecting", "websocket").unwrap();
        assert!(matches!(manager.state, ConnectionState::Connecting));
        
        manager.update_state("connected", "websocket").unwrap();
        assert!(matches!(manager.state, ConnectionState::Connected));
        assert_eq!(manager.stats.successful_connections, 1);
    }

    #[test]
    fn test_backoff_calculation() {
        let mut backoff = BackoffCalculator::new();
        
        let first = backoff.next_delay();
        let second = backoff.next_delay();
        let third = backoff.next_delay();
        
        assert!(second > first);
        assert!(third > second);
        assert!(third <= backoff.max_delay_ms * 1.25); // Account for jitter
    }

    #[test]
    fn test_quality_score() {
        let mut manager = ConnectionManager::new();
        
        // Initially disconnected
        assert_eq!(manager.get_quality_score(), 0);
        
        // Connected with good latency
        manager.update_state("connected", "websocket").unwrap();
        manager.record_latency(50.0);
        let score = manager.get_quality_score();
        assert!(score > 50);
    }
}