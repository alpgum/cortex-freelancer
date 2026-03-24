use wasm_bindgen::prelude::*;
use serde_json::Value;
use pulldown_cmark::{Parser, Options, html};
use lz4_flex::{compress_prepend_size, decompress_size_prepended};

pub struct MessageProcessor {
    compression_enabled: bool,
    compression_level: u8,
    markdown_options: Options,
}

impl MessageProcessor {
    pub fn new(compression_enabled: bool, compression_level: u8) -> Result<Self, JsValue> {
        // Set up markdown options for security and performance
        let mut markdown_options = Options::empty();
        markdown_options.insert(Options::ENABLE_STRIKETHROUGH);
        markdown_options.insert(Options::ENABLE_TABLES);
        markdown_options.insert(Options::ENABLE_FOOTNOTES);
        markdown_options.insert(Options::ENABLE_TASKLISTS);
        // Note: Not enabling raw HTML for security

        Ok(MessageProcessor {
            compression_enabled,
            compression_level,
            markdown_options,
        })
    }

    /// Parse and validate a JSON message
    pub fn parse_message(&self, raw_message: &str) -> Result<Value, JsValue> {
        // First, validate JSON structure
        let parsed: Value = serde_json::from_str(raw_message)
            .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;

        // Validate message structure
        crate::utils::validate_message_structure(&parsed)
            .map_err(|e| JsValue::from_str(&e))?;

        // Additional security validations
        self.validate_content_security(&parsed)?;

        Ok(parsed)
    }

    /// Process a streaming chunk (markdown, highlighting, etc.)
    pub fn process_chunk(&self, chunk: &str, message_type: &str) -> Result<String, JsValue> {
        match message_type {
            "markdown" => self.render_markdown(chunk),
            "code" => self.highlight_code(chunk, None),
            "json" => self.format_json(chunk),
            "plain" => Ok(chunk.to_string()),
            _ => Ok(chunk.to_string()), // Default: pass through unchanged
        }
    }

    /// Render markdown to HTML
    pub fn render_markdown(&self, markdown: &str) -> Result<String, JsValue> {
        let parser = Parser::new_ext(markdown, self.markdown_options);
        let mut html_output = String::new();
        html::push_html(&mut html_output, parser);
        
        // Basic XSS protection - strip script tags
        let safe_html = self.sanitize_html(&html_output);
        Ok(safe_html)
    }

    /// Lightweight code highlighting for WASM: HTML-escape and wrap.
    ///
    /// Full syntax highlighting libraries (syntect/onig) are often not WASM-friendly.
    /// We keep this practical and fast: escape + add language class for JS/CSS to enhance.
    pub fn highlight_code(&self, code: &str, language: Option<&str>) -> Result<String, JsValue> {
        let escaped = self.escape_html(code);
        let lang_class = language.unwrap_or("plain");
        Ok(format!("<pre><code class=\"language-{}\">{}</code></pre>", lang_class, escaped))
    }

    /// Format JSON with proper indentation
    pub fn format_json(&self, json_str: &str) -> Result<String, JsValue> {
        let parsed: Value = serde_json::from_str(json_str)
            .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;
        
        serde_json::to_string_pretty(&parsed)
            .map_err(|e| JsValue::from_str(&format!("JSON formatting failed: {}", e)))
    }

    /// Compress a string using LZ4
    pub fn compress_string(&self, input: &str) -> Result<Vec<u8>, JsValue> {
        if !self.compression_enabled {
            return Ok(input.as_bytes().to_vec());
        }

        let compressed = compress_prepend_size(input.as_bytes());
        Ok(compressed)
    }

    /// Decompress LZ4 data to string
    pub fn decompress_to_string(&self, compressed: &[u8]) -> Result<String, JsValue> {
        if !self.compression_enabled {
            return String::from_utf8(compressed.to_vec())
                .map_err(|e| JsValue::from_str(&format!("Invalid UTF-8: {}", e)));
        }

        let decompressed = decompress_size_prepended(compressed)
            .map_err(|e| JsValue::from_str(&format!("Decompression failed: {:?}", e)))?;

        String::from_utf8(decompressed)
            .map_err(|e| JsValue::from_str(&format!("Invalid UTF-8 in decompressed data: {}", e)))
    }

    /// Calculate compression ratio
    pub fn compression_ratio(&self, original: &str) -> f64 {
        if !self.compression_enabled {
            return 1.0;
        }

        match self.compress_string(original) {
            Ok(compressed) => {
                let original_size = original.len() as f64;
                let compressed_size = compressed.len() as f64;
                if original_size > 0.0 {
                    compressed_size / original_size
                } else {
                    1.0
                }
            },
            Err(_) => 1.0,
        }
    }

    /// Validate content for security issues
    fn validate_content_security(&self, message: &Value) -> Result<(), JsValue> {
        // Recursively check all string values for dangerous content
        self.check_value_security(message)?;
        Ok(())
    }

    fn check_value_security(&self, value: &Value) -> Result<(), JsValue> {
        match value {
            Value::String(s) => self.check_string_security(s),
            Value::Array(arr) => {
                for item in arr {
                    self.check_value_security(item)?;
                }
                Ok(())
            },
            Value::Object(obj) => {
                for (_, val) in obj {
                    self.check_value_security(val)?;
                }
                Ok(())
            },
            _ => Ok(()),
        }
    }

    fn check_string_security(&self, s: &str) -> Result<(), JsValue> {
        // Check for common XSS patterns
        let dangerous_patterns = [
            "<script",
            "javascript:",
            "data:text/html",
            "vbscript:",
            "file://",
            "\\x",
            "&#x",
            "eval(",
            "Function(",
            "setTimeout(",
            "setInterval(",
        ];

        let lower_s = s.to_lowercase();
        for pattern in &dangerous_patterns {
            if lower_s.contains(pattern) {
                return Err(JsValue::from_str(&format!("Potentially dangerous content detected: {}", pattern)));
            }
        }

        // Check for excessively long strings (DoS protection)
        if s.len() > 1024 * 1024 {
            return Err(JsValue::from_str("Content too large"));
        }

        Ok(())
    }

    /// Basic HTML sanitization.
    ///
    /// Note: pulldown-cmark does not emit raw HTML unless explicitly enabled,
    /// but we still harden against embedded tags/attrs.
    fn sanitize_html(&self, html: &str) -> String {
        // Remove script tags and their content
        let script_regex = regex::Regex::new(r"(?is)<script[^>]*>.*?</script>").unwrap();
        let mut sanitized = script_regex.replace_all(html, "").to_string();

        // Remove inline event handlers like onclick=
        let on_attr = regex::Regex::new(r#"(?i)\son\w+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)"#).unwrap();
        sanitized = on_attr.replace_all(&sanitized, "").to_string();

        // Remove javascript: urls
        let js_url = regex::Regex::new(r"(?i)javascript:").unwrap();
        sanitized = js_url.replace_all(&sanitized, "").to_string();

        sanitized
    }

    /// Escape HTML for safe code rendering
    fn escape_html(&self, input: &str) -> String {
        input
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#39;")
    }

    /// Extract plain text from markdown (best-effort, fast)
    pub fn extract_text_from_markdown(&self, markdown: &str) -> String {
        let mut text = markdown.to_string();
        text = regex::Regex::new(r"```[\s\S]*?```").unwrap().replace_all(&text, "").to_string();
        text = regex::Regex::new(r"`[^`]+`").unwrap().replace_all(&text, "").to_string();
        text = regex::Regex::new(r"\[([^\]]+)\]\([^\)]+\)").unwrap().replace_all(&text, "$1").to_string();
        text = regex::Regex::new(r"(?m)^#+\s*").unwrap().replace_all(&text, "").to_string();
        text = regex::Regex::new(r"\*\*([^*]+)\*\*").unwrap().replace_all(&text, "$1").to_string();
        text = regex::Regex::new(r"\*([^*]+)\*").unwrap().replace_all(&text, "$1").to_string();
        text = regex::Regex::new(r"_([^_]+)_").unwrap().replace_all(&text, "$1").to_string();
        text.trim().to_string()
    }

    /// Check if content should be compressed
    pub fn should_compress(&self, content: &str) -> bool {
        self.compression_enabled && 
        content.len() > 100 && // Only compress if content is substantial
        self.compression_ratio(content) < 0.8 // Only if we get good compression
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_markdown_rendering() {
        let processor = MessageProcessor::new(false, 0).unwrap();
        let markdown = "# Hello\n\nThis is **bold** text.";
        let html = processor.render_markdown(markdown).unwrap();
        
        assert!(html.contains("<h1>"));
        assert!(html.contains("<strong>"));
        assert!(!html.contains("<script>")); // Should be sanitized
    }

    #[test]
    fn test_compression() {
        let processor = MessageProcessor::new(true, 6).unwrap();
        let text = "This is a test string that should compress well because it has repetitive content. ".repeat(10);
        
        let compressed = processor.compress_string(&text).unwrap();
        let decompressed = processor.decompress_to_string(&compressed).unwrap();
        
        assert_eq!(text, decompressed);
        assert!(compressed.len() < text.len());
    }

    #[test]
    fn test_security_validation() {
        let processor = MessageProcessor::new(false, 0).unwrap();
        let malicious_json = r#"{"type": "user", "content": "<script>alert('xss')</script>"}"#;
        
        assert!(processor.parse_message(malicious_json).is_err());
    }

    #[test]
    fn test_json_formatting() {
        let processor = MessageProcessor::new(false, 0).unwrap();
        let json = r#"{"name":"test","value":123}"#;
        let formatted = processor.format_json(json).unwrap();
        
        assert!(formatted.contains("  ")); // Should have indentation
        assert!(formatted.contains("\n")); // Should have newlines
    }
}