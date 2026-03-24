# CFX-026 Setup Instructions

## Installation

### 1. Copy Files to Main Project

```bash
# Copy the API endpoint
cp api-rest-chat.js ../api/

# Copy client integration
cp client.js ../app/js/rest-polling-client.js
cp integration.js ../app/js/rest-polling-integration.js
```

### 2. Update HTML Templates

Add the client scripts to your main HTML templates (before chat-dispatcher.js):

```html
<!-- REST Polling Transport (Final Fallback) -->
<script src="/app/js/rest-polling-client.js"></script>
<script src="/app/js/rest-polling-integration.js"></script>
<script src="/app/js/chat-dispatcher.js"></script>
```

### 3. Configure Server Routes

In your main `server.js` or routing configuration, add:

```javascript
// REST Polling API (final fallback transport)
app.use('/api/rest-chat', require('./api/api-rest-chat'));
```

### 4. Update Transport Chain

The integration file automatically patches `chat-dispatcher.js` to add REST polling as the final fallback:

**New Transport Chain:**
1. WebSocket (real-time)
2. Server-Sent Events (streaming)
3. HTTP Chunked Transfer (streaming)
4. Long Polling (efficient HTTP)
5. **REST Polling** ← New addition
6. Basic HTTP (last resort)

## Testing

### 1. Test Server (Development)

```bash
# Install dependencies
npm install

# Start test server
npm start

# Visit test interface
open http://localhost:3026/test
```

### 2. Integration Testing

```javascript
// Test REST polling availability
console.log('REST Polling Available:', window.CortexChatDispatcher.isRestPollingAvailable());

// Get connection mode
console.log('Connection Mode:', window.CortexChatDispatcher.getConnectionMode());

// Send test message
window.CortexChatDispatcher.send('Test message', {
  onProgress: (status) => console.log('Progress:', status),
  onDone: (reply) => console.log('Response:', reply)
});
```

### 3. Stress Testing

```bash
# Run stress test
curl "http://localhost:3026/test/stress?requests=20&concurrent=5"
```

## Configuration

### Environment Variables

```bash
# For Anthropic SDK mode (Railway/Cloud)
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# For OpenClaw CLI mode (Local)
# No additional env vars needed - uses local openclaw gateway
```

### Rate Limiting

Default configuration:
- **15 requests per 5 minutes** per IP
- **50 concurrent requests** max
- **10 minute TTL** for active requests
- **5 minute TTL** for completed requests

Adjust in `api-rest-chat.js`:
```javascript
const RATE_MAX = 15;                    // Requests per window
const RATE_WINDOW_MS = 5 * 60 * 1000;   // Window duration
const MAX_QUEUE_SIZE = 50;               // Max concurrent
```

## Monitoring

### Metrics Endpoint

```bash
GET /metrics
```

Returns:
```json
{
  "queue": {
    "size": 3,
    "queueLength": 1,
    "status": {
      "queued": 1,
      "processing": 1,
      "complete": 1
    }
  },
  "uptime": 12345
}
```

### Health Check

```bash
GET /health
```

### Debug Tools

```javascript
// Get active requests
window.CortexChatDispatcher.getActiveRestRequests()

// Access transport directly
window.CortexChatDispatcher._restPolling

// Force reconnect (resets failure states)
window.CortexChatDispatcher.reconnect()
```

## Architecture

### Request Lifecycle

1. **Submit** → POST `/api/rest-chat` → Returns `requestId`
2. **Poll Status** → GET `/api/rest-chat/:id` → Returns status/progress
3. **Get Result** → GET `/api/rest-chat/:id/result` → Returns final response
4. **Cancel** (optional) → DELETE `/api/rest-chat/:id`

### Status States

- `queued` - Waiting in processing queue
- `processing` - AI generating response  
- `complete` - Response ready for retrieval
- `error` - Failed with error details
- `cancelled` - Manually cancelled
- `expired` - Timed out

### Error Codes

- `E400` - Bad request (validation)
- `E404` - Request not found/expired
- `E408` - Request timeout
- `E409` - Invalid state transition
- `E429` - Rate limit exceeded
- `E503` - Service unavailable/busy
- `E500` - Internal server error

## Production Considerations

### Security

- Rate limiting per IP address
- Request size limits (4KB messages)
- TTL-based request expiration
- CORS headers configured
- Input validation and sanitization

### Performance

- Single-threaded processing (no race conditions)
- Adaptive polling intervals
- Memory-efficient request storage
- Automatic cleanup of expired data
- Battery-aware polling on mobile

### Reliability  

- Graceful process cancellation
- Timeout handling for AI requests
- Fallback error messages
- Structured error responses
- Connection state management

## Troubleshooting

### Common Issues

1. **"REST polling unavailable"**
   - Check browser compatibility (needs fetch, Promise, AbortController)
   - Verify integration.js loaded after client.js

2. **"Rate limit exceeded"**
   - Wait 5 minutes or adjust rate limits
   - Check for multiple tabs/connections

3. **"Request timed out"**
   - OpenClaw CLI not responding (check local gateway)
   - Anthropic API issues (check API key)

4. **"Server is busy"**
   - Too many concurrent requests
   - Increase MAX_QUEUE_SIZE if needed

### Debug Steps

1. Check browser console for errors
2. Verify API endpoint responds: `GET /health`
3. Test basic submission: `POST /api/rest-chat`
4. Monitor metrics: `GET /metrics`
5. Check server logs for processing errors

### Performance Tuning

```javascript
// Adjust client polling intervals
const restClient = new CortexRestPolling({
  minInterval: 500,   // Faster initial polling
  maxInterval: 5000,  // Slower for long requests
  timeout: 30000      // Overall request timeout
});
```

## Integration Checklist

- [ ] Copy `api-rest-chat.js` to `/api/` directory
- [ ] Copy client files to `/app/js/` directory  
- [ ] Add script tags to HTML templates
- [ ] Configure server routing
- [ ] Test in browser console
- [ ] Verify fallback chain works
- [ ] Run stress tests
- [ ] Monitor metrics in production
- [ ] Set up error alerting