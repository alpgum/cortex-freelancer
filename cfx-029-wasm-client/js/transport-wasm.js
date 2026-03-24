/**
 * transport-wasm.js
 *
 * Thin integration layer that plugs the WASM client into the existing CortexTransport stack.
 *
 * Goals:
 * - Keep all transports (WebRTC/gRPC/socketio/sse/chunked/polling) in JS (existing code).
 * - Use WASM for: parsing/validation, caching, offline queue decisions, markdown/code processing.
 * - Minimal surface area: wrap send + stream event handlers.
 */

(function () {
  'use strict';

  function isWasmSupported() {
    return typeof WebAssembly !== 'undefined';
  }

  async function installCortexWasmLayer(options) {
    options = options || {};

    if (!isWasmSupported()) {
      console.warn('[wasm-layer] WebAssembly not supported; skipping');
      return { installed: false, reason: 'no-wasm' };
    }

    if (typeof WasmBridge === 'undefined') {
      console.warn('[wasm-layer] WasmBridge not loaded');
      return { installed: false, reason: 'missing-bridge' };
    }

    if (!window.CortexTransport) {
      console.warn('[wasm-layer] CortexTransport not found; layer can still run, but no transport hooks');
    }

    const bridge = new WasmBridge();

    // StorageAdapter is referenced by wasm-bridge.js; ensure it's loaded.
    if (typeof StorageAdapter === 'undefined') {
      console.warn('[wasm-layer] StorageAdapter not loaded; offline persistence may be disabled');
    }

    const init = await bridge.initialize(options.wasm || {});

    // Wrap transport sendMessage (if present)
    if (window.CortexTransport && typeof window.CortexTransport.sendMessage === 'function') {
      const originalSend = window.CortexTransport.sendMessage;

      window.CortexTransport.sendMessage = function sendMessagePatched(text, sendOptions) {
        try {
          // If transport isn't connected, queue offline.
          if (typeof window.CortexTransport.isConnected === 'function' && !window.CortexTransport.isConnected()) {
            const queued = JSON.stringify({
              type: 'user',
              content: text,
              id: `offline_${Date.now()}`,
              timestamp: Date.now(),
              metadata: { transport: 'offline' }
            });
            bridge.queueMessage(queued, 120).catch(() => {});
            console.log('[wasm-layer] queued message (offline)');
            return false;
          }

          // Pre-process outgoing message (format/validate/cache)
          const outgoing = JSON.stringify({
            type: 'user',
            content: text,
            id: `msg_${Date.now()}`,
            timestamp: Date.now(),
            metadata: { transport: window.CortexTransport.getTransportName ? window.CortexTransport.getTransportName() : null }
          });

          // This validates/parses; we don't need returned object now.
          bridge.processMessage(outgoing).catch(() => {});

          return originalSend.call(window.CortexTransport, text, sendOptions);
        } catch (e) {
          console.warn('[wasm-layer] send patch failed; falling back', e);
          return originalSend.call(window.CortexTransport, text, sendOptions);
        }
      };

      // Bridge connection state updates
      const originalConnect = window.CortexTransport.connect;
      window.CortexTransport.connect = function connectPatched(connectOptions) {
        bridge.updateConnectionState('connecting', (connectOptions && connectOptions.transport) || 'auto');
        return originalConnect.call(window.CortexTransport, connectOptions).then((res) => {
          bridge.updateConnectionState('connected', res && res.transport ? res.transport : 'auto');
          return res;
        }).catch((err) => {
          bridge.updateConnectionState('failed', 'auto');
          throw err;
        });
      };

      const originalDisconnect = window.CortexTransport.disconnect;
      window.CortexTransport.disconnect = function disconnectPatched() {
        bridge.updateConnectionState('disconnected', 'auto');
        return originalDisconnect.call(window.CortexTransport);
      };

      // Wrap stream events if possible
      if (typeof window.CortexTransport.on === 'function') {
        window.CortexTransport.on('stream-chunk', async function (d) {
          // Attempt to process chunk as markdown for UI speed.
          if (!d) return;
          const token = d.token || d.buffer || '';
          try {
            const processed = await bridge.processChunk(token, 'plain');
            bridge.emit('processed-chunk', { raw: d, processed });
          } catch (_) {}
        });

        window.CortexTransport.on('stream-end', async function (d) {
          if (!d) return;
          const text = d.response || '';
          try {
            const processed = await bridge.processChunk(text, 'markdown');
            bridge.emit('processed-response', { raw: d, processedHtml: processed });
          } catch (_) {}
        });
      }
    }

    // Offline flush helper
    async function flushOfflineQueue(sendFn) {
      const records = await bridge.storageAdapter?.getQueuedMessages?.() || [];
      for (const rec of records) {
        try {
          const parsed = JSON.parse(rec.message);
          await sendFn(parsed.content);
          await bridge.storageAdapter.deleteQueuedMessage(rec.id);
        } catch (e) {
          console.warn('[wasm-layer] flush failed for item', rec && rec.id, e);
          // keep it
        }
      }
    }

    window.CortexWasmLayer = {
      bridge,
      init,
      flushOfflineQueue,
      isWasmSupported,
    };

    console.log('[wasm-layer] installed; wasmEnabled=', bridge.isWasmEnabled());
    return { installed: true, wasmEnabled: bridge.isWasmEnabled() };
  }

  window.installCortexWasmLayer = installCortexWasmLayer;
})();
