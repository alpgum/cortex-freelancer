use wasm_bindgen::prelude::*;

// Set up panic hook for better error messages in the browser
pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // we will get better error messages if our code ever panics.
    //
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Generate a hash for message caching
pub fn hash_string(input: &str) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    input.hash(&mut hasher);
    hasher.finish()
}

/// Get current timestamp in milliseconds
pub fn now_ms() -> f64 {
    web_sys::window()
        .unwrap()
        .performance()
        .unwrap()
        .now()
}

/// Validate JSON string
pub fn is_valid_json(json_str: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(json_str).is_ok()
}

/// Generate a unique request ID
pub fn generate_request_id() -> String {
    format!("{}-{}", now_ms() as u64, (js_sys::Math::random() * 10000.0) as u32)
}

/// Log to console with timestamp
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[allow(dead_code)]
pub fn log_with_timestamp(message: &str) {
    let timestamp = js_sys::Date::new_0().to_iso_string();
    log(&format!("[{}] {}", timestamp.as_string().unwrap(), message));
}

/// Validate message structure
pub fn validate_message_structure(message: &serde_json::Value) -> Result<(), String> {
    // Check required fields
    if !message.is_object() {
        return Err("Message must be an object".to_string());
    }

    let obj = message.as_object().unwrap();

    // Check for required fields
    if !obj.contains_key("type") {
        return Err("Message missing 'type' field".to_string());
    }

    if !obj.contains_key("content") {
        return Err("Message missing 'content' field".to_string());
    }

    // Validate message type
    match obj.get("type").and_then(|v| v.as_str()) {
        Some("user") | Some("assistant") | Some("system") => {},
        Some(other) => return Err(format!("Invalid message type: {}", other)),
        None => return Err("Message type must be a string".to_string()),
    }

    Ok(())
}

/// Calculate memory usage of a string in bytes
pub fn memory_usage(s: &str) -> usize {
    std::mem::size_of_val(s) + s.len()
}