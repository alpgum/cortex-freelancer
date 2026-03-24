/**
 * WASM Bridge - JavaScript<->WebAssembly Interface
 * 
 * Provides a high-level JavaScript API that bridges to the WASM module,
 * handles initialization, error recovery, and fallback to JavaScript implementations.
 */

class WasmBridge {
    constructor() {
        this.wasmModule = null;
        this.wasmClient = null;
        this.isInitialized = false;
        this.fallbackMode = false;
        this.storageAdapter = null;
        this.listeners = new Map();
        
        // Performance counters
        this.stats = {
            messagesProcessed: 0,
            compressionSavings: 0,
            encryptionOps: 0,
            wasmCallTime: 0,
            fallbackCallTime: 0,
            errors: 0
        };
    }

    /**
     * Initialize the WASM bridge
     */
    async initialize(config = {}) {
        try {
            console.log('🦀 Initializing WASM Bridge...');
            
            // Default configuration
            const defaultConfig = {
                compressionLevel: 6,
                cacheSizeMB: 50,
                enableEncryption: true,
                enableCompression: true,
                wasmPath: './pkg/cfx_029_wasm_client.js'
            };
            const finalConfig = { ...defaultConfig, ...config };

            // Load the WASM module
            const wasmModule = await import(finalConfig.wasmPath);
            await wasmModule.default(); // Initialize the WASM module
            
            this.wasmModule = wasmModule;

            // Create client configuration
            const clientConfig = new wasmModule.ClientConfig();
            clientConfig.set_compression_level(finalConfig.compressionLevel);
            clientConfig.set_cache_size_mb(finalConfig.cacheSizeMB);
            clientConfig.set_enable_encryption(finalConfig.enableEncryption);
            clientConfig.set_enable_compression(finalConfig.enableCompression);

            // Create the WASM client
            this.wasmClient = new wasmModule.CortexWasmClient(clientConfig);
            
            // Initialize storage adapter
            this.storageAdapter = new StorageAdapter();
            await this.storageAdapter.initialize();

            this.isInitialized = true;
            this.fallbackMode = false;
            
            console.log('✅ WASM Bridge initialized successfully');
            this.emit('initialized', { wasmEnabled: true });
            
            return { success: true, wasmEnabled: true };

        } catch (error) {
            console.warn('⚠️ WASM initialization failed, falling back to JavaScript:', error);
            this.fallbackMode = true;
            this.isInitialized = true;
            
            // Initialize fallback implementations
            this.initializeFallbacks();
            
            this.emit('initialized', { wasmEnabled: false, error: error.message });
            return { success: true, wasmEnabled: false, error: error.message };
        }
    }

    /**
     * Initialize JavaScript fallback implementations
     */
    initializeFallbacks() {
        // Simple fallback cache
        this.fallbackCache = new Map();
        
        // Simple fallback queue
        this.fallbackQueue = [];
        
        console.log('📦 JavaScript fallbacks initialized');
    }

    /**
     * Process a message (WASM or fallback)
     */
    async processMessage(rawMessage) {
        const startTime = performance.now();
        
        try {
            if (!this.isInitialized) {
                throw new Error('Bridge not initialized');
            }

            let result;
            if (this.fallbackMode) {
                result = this.processMessageFallback(rawMessage);
                this.stats.fallbackCallTime += performance.now() - startTime;
            } else {
                result = this.wasmClient.process_message(rawMessage);
                this.stats.wasmCallTime += performance.now() - startTime;
            }

            this.stats.messagesProcessed++;
            return result;

        } catch (error) {
            this.stats.errors++;
            console.error('Message processing failed:', error);
            
            // Try fallback if WASM failed
            if (!this.fallbackMode) {
                console.log('🔄 Retrying with JavaScript fallback');
                return this.processMessageFallback(rawMessage);
            }
            
            throw error;
        }
    }

    /**
     * Process a streaming chunk
     */
    async processChunk(chunk, messageType = 'plain') {
        try {
            if (this.fallbackMode) {
                return this.processChunkFallback(chunk, messageType);
            }
            
            return this.wasmClient.process_chunk(chunk, messageType);
            
        } catch (error) {
            console.warn('Chunk processing failed, using fallback:', error);
            return this.processChunkFallback(chunk, messageType);
        }
    }

    /**
     * Queue a message for offline sync
     */
    async queueMessage(message, priority = 100) {
        try {
            if (this.fallbackMode) {
                this.fallbackQueue.push({
                    message,
                    priority,
                    timestamp: Date.now()
                });
                await this.storageAdapter.saveQueuedMessage(message, priority);
                return;
            }
            
            this.wasmClient.queue_message(message, priority);
            
        } catch (error) {
            console.warn('Message queueing failed:', error);
            // Always save to storage as backup
            await this.storageAdapter.saveQueuedMessage(message, priority);
        }
    }

    /**
     * Get queued messages
     */
    async getQueuedMessages() {
        try {
            if (this.fallbackMode) {
                return this.fallbackQueue.slice();
            }
            
            return this.wasmClient.get_queued_messages();
            
        } catch (error) {
            console.warn('Failed to get queued messages from WASM, using storage:', error);
            return await this.storageAdapter.getQueuedMessages();
        }
    }

    /**
     * Clear message queue
     */
    async clearMessageQueue() {
        try {
            if (!this.fallbackMode) {
                this.wasmClient.clear_message_queue();
            }
            
            this.fallbackQueue.length = 0;
            await this.storageAdapter.clearQueuedMessages();
            
        } catch (error) {
            console.warn('Failed to clear queue:', error);
        }
    }

    /**
     * Compress data
     */
    async compressData(data) {
        try {
            if (this.fallbackMode) {
                return this.compressDataFallback(data);
            }
            
            const compressed = this.wasmClient.compress_data(data);
            this.stats.compressionSavings += Math.max(0, data.length - compressed.length);
            return compressed;
            
        } catch (error) {
            console.warn('Compression failed, returning original data:', error);
            return new TextEncoder().encode(data);
        }
    }

    /**
     * Decompress data
     */
    async decompressData(compressedData) {
        try {
            if (this.fallbackMode) {
                return this.decompressDataFallback(compressedData);
            }
            
            return this.wasmClient.decompress_data(compressedData);
            
        } catch (error) {
            console.warn('Decompression failed, returning as string:', error);
            return new TextDecoder().decode(compressedData);
        }
    }

    /**
     * Encrypt data
     */
    async encryptData(data) {
        try {
            if (this.fallbackMode) {
                return this.encryptDataFallback(data);
            }
            
            this.stats.encryptionOps++;
            return this.wasmClient.encrypt_data(data);
            
        } catch (error) {
            console.warn('Encryption failed, storing as plain text:', error);
            return new TextEncoder().encode(data);
        }
    }

    /**
     * Decrypt data
     */
    async decryptData(encryptedData) {
        try {
            if (this.fallbackMode) {
                return this.decryptDataFallback(encryptedData);
            }
            
            return this.wasmClient.decrypt_data(encryptedData);
            
        } catch (error) {
            console.warn('Decryption failed, returning as plain text:', error);
            return new TextDecoder().decode(encryptedData);
        }
    }

    /**
     * Get cached response
     */
    async getCachedResponse(messageHash) {
        try {
            if (this.fallbackMode) {
                return this.fallbackCache.get(messageHash) || null;
            }
            
            const result = this.wasmClient.get_cached_response(messageHash);
            return result === null ? null : result;
            
        } catch (error) {
            console.warn('Cache lookup failed:', error);
            return null;
        }
    }

    /**
     * Update connection state
     */
    updateConnectionState(state, transport) {
        try {
            if (!this.fallbackMode && this.wasmClient) {
                this.wasmClient.update_connection_state(state, transport);
            }
        } catch (error) {
            console.warn('Failed to update connection state in WASM:', error);
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        const baseStats = { ...this.stats };
        
        try {
            if (!this.fallbackMode && this.wasmClient) {
                const wasmStats = this.wasmClient.get_cache_stats();
                const connectionStats = this.wasmClient.get_connection_stats();
                return {
                    ...baseStats,
                    wasm: wasmStats,
                    connection: connectionStats,
                    mode: 'wasm'
                };
            }
        } catch (error) {
            console.warn('Failed to get WASM stats:', error);
        }
        
        return {
            ...baseStats,
            mode: 'fallback',
            fallbackCacheSize: this.fallbackCache?.size || 0,
            fallbackQueueSize: this.fallbackQueue?.length || 0
        };
    }

    /**
     * Event system
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Event listener error for ${event}:`, error);
                }
            });
        }
    }

    // Fallback implementations
    processMessageFallback(rawMessage) {
        try {
            const parsed = JSON.parse(rawMessage);
            
            // Basic validation
            if (!parsed.type || !parsed.content) {
                throw new Error('Invalid message structure');
            }
            
            // Store in cache if it has an ID
            if (parsed.id) {
                this.fallbackCache.set(parsed.id, rawMessage);
            }
            
            return parsed;
            
        } catch (error) {
            throw new Error(`JSON parsing failed: ${error.message}`);
        }
    }

    processChunkFallback(chunk, messageType) {
        // Simple processing - just return the chunk as-is
        // In a real implementation, you'd add markdown parsing, etc.
        return chunk;
    }

    compressDataFallback(data) {
        // Fallback: no compression, just encode
        return new TextEncoder().encode(data);
    }

    decompressDataFallback(data) {
        // Fallback: assume it's already plain text
        return new TextDecoder().decode(data);
    }

    encryptDataFallback(data) {
        // Fallback: no encryption, just encode
        console.warn('Encryption not available in fallback mode');
        return new TextEncoder().encode(data);
    }

    decryptDataFallback(data) {
        // Fallback: assume it's plain text
        console.warn('Decryption not available in fallback mode');
        return new TextDecoder().decode(data);
    }

    /**
     * Check if WASM is supported and enabled
     */
    isWasmEnabled() {
        return !this.fallbackMode && this.isInitialized;
    }

    /**
     * Get initialization status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            wasmEnabled: !this.fallbackMode,
            hasWasmModule: !!this.wasmModule,
            hasClient: !!this.wasmClient,
            hasStorageAdapter: !!this.storageAdapter
        };
    }
}

// Export for use
window.WasmBridge = WasmBridge;