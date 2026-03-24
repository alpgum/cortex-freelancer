# Tests / Smoke checks

This package is primarily browser-oriented (wasm-pack `--target web`).

## Build smoke

```bash
npm run build:wasm:dev
```

## Browser smoke

```bash
npm run dev
# open http://localhost:5173/demo.html
```

Then click:
- **Init WASM Layer**
- **Process Markdown (WASM)**
- **Encrypt+Decrypt**
- **Compress+Decompress**

Expected:
- No console errors
- Markdown renders into HTML
- Encrypt/decrypt roundtrips
- Compress/decompress roundtrips

## Transport integration smoke

If you load this in the main Cortex Freelancer app where `window.CortexTransport` exists,
include these scripts (in order):

```html
<script src="/cfx-029-wasm-client/js/storage-adapter.js"></script>
<script src="/cfx-029-wasm-client/js/wasm-bridge.js"></script>
<script src="/cfx-029-wasm-client/js/transport-wasm.js"></script>
<script>
  installCortexWasmLayer({ wasm: { wasmPath: '/cfx-029-wasm-client/pkg/cfx_029_wasm_client.js' } });
</script>
```

Then verify:
- messages are queued when offline
- when back online, `flushOfflineQueue` can replay queued items
