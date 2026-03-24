# CFX-025: WebRTC Data Channel Transport

WebRTC peer-to-peer transport layer for Cortex Freelancer, enabling low-latency communication between browser clients and the Node.js server.

## Architecture

```
Browser Client ←→ Signaling Server ←→ Node.js Server
       ↓              (WebSocket)           ↓
   WebRTC Client  ════ Data Channel ════ WebRTC Transport
```

### Components

1. **Signaling Server** (`src/signaling-server.js`)
   - WebSocket-based SDP/ICE exchange
   - Session management and cleanup
   - Connection lifecycle tracking

2. **WebRTC Transport** (`src/transports/webrtc-transport.js`)
   - Server-side WebRTC peer using `node-datachannel`
   - Data channel abstraction layer
   - OpenClaw process integration

3. **WebRTC Client** (`public/js/webrtc-client.js`)
   - Browser WebRTC implementation
   - Transport interface compatibility
   - Automatic fallback support

4. **WebRTC Bridge** (`api/webrtc-bridge.js`)
   - Integration with OpenClaw spawning system
   - Message routing and error handling
   - Session management

## Installation

### Dependencies

```bash
npm install node-datachannel
```

### STUN/TURN Configuration

#### Free STUN Servers (Default)
- Google: `stun.l.google.com:19302`
- Twilio: `global.stun.twilio.com:3478`

#### TURN Servers (Optional)

For clients behind symmetric NAT or corporate firewalls:

```bash
# Environment variables
TURN_URL=turn:your-turn-server.com:3478
TURN_USERNAME=username
TURN_CREDENTIAL=password
```

#### TURN Server Options

**Self-hosted (coturn):**
```bash
# Install coturn
sudo apt install coturn

# Configure /etc/turnserver.conf
listening-port=3478
external-ip=YOUR_PUBLIC_IP
realm=cortex.example.com
user=cortex:password123
```

**Cloud TURN Providers:**
- Twilio Network Traversal Service
- Xirsys Global TURN
- Metered TURN API

## Transport Hierarchy

WebRTC is Tier 1 in the transport cascade:

1. **WebRTC P2P** ← Primary (lowest latency)
2. **WebSocket** ← Fallback #1
3. **Server-Sent Events** ← Fallback #2  
4. **HTTP Chunked** ← Fallback #3
5. **HTTP** ← Last resort

## Configuration

### Server Configuration

```javascript
// config.js additions
module.exports = {
  webrtc: {
    enabled: process.env.WEBRTC_ENABLED !== 'false',
    stunServers: [
      'stun:stun.l.google.com:19302',
      'stun:global.stun.twilio.com:3478'
    ],
    turnUrl: process.env.TURN_URL,
    turnUsername: process.env.TURN_USERNAME, 
    turnCredential: process.env.TURN_CREDENTIAL,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    maxSessions: 50,
    spawnTimeout: 180 * 1000 // 3 minutes
  }
};
```

### Client Configuration

```javascript
// Enable/disable WebRTC transport
localStorage.setItem('webrtc-enabled', 'true');

// Transport preference
localStorage.setItem('preferred-transport', 'webrtc');
```

## Testing

### Test Page
Visit `/webrtc-test` for interactive WebRTC testing:

- Connection establishment
- Message sending/receiving
- Transport statistics
- Error handling

### Health Endpoints

```bash
# Signaling server health
GET /api/webrtc/health

# Active WebRTC sessions  
GET /api/webrtc/sessions
```

### Example Health Response
```json
{
  "signaling": {
    "activeClients": 2,
    "pendingConnections": 1,
    "connections": [
      {
        "sessionId": "webrtc_1234567890",
        "state": "connected", 
        "hasServer": true,
        "hasClient": true,
        "ageMs": 45000
      }
    ]
  },
  "bridge": {
    "activeSessions": 1,
    "sessionsCreated": 5,
    "messagesProcessed": 127,
    "errorsTotal": 2
  }
}
```

## Performance

### Latency Comparison

| Transport | Typical Latency | Use Case |
|-----------|-----------------|----------|
| WebRTC    | 20-50ms        | Real-time chat |
| WebSocket | 50-100ms       | Interactive |
| SSE       | 100-200ms      | Streaming |
| HTTP      | 200-500ms      | Fallback |

### NAT Traversal Success Rates

- **Public Networks**: ~95% (STUN only)
- **Corporate Networks**: ~85% (STUN + TURN)
- **Symmetric NAT**: ~60% (requires TURN)

## Troubleshooting

### Common Issues

#### 1. Connection Timeout
```
Error: WebRTC connection timeout
```
**Solutions:**
- Check firewall settings (ports 3478, 5349)
- Configure TURN server for symmetric NAT
- Verify STUN servers are reachable

#### 2. ICE Gathering Failed  
```
Error: ICE gathering timeout
```
**Solutions:**
- Check network connectivity
- Verify STUN server configuration
- Try different STUN servers

#### 3. Data Channel Failed
```
Error: Data channel failed to open
```
**Solutions:**
- Check WebRTC browser support
- Verify signaling server connectivity
- Check server logs for errors

### Debug Logging

Enable detailed WebRTC logging:

```bash
# Server-side
DEBUG=webrtc* node server.js

# Client-side  
localStorage.setItem('webrtc-debug', 'true');
```

### Browser Compatibility

| Browser | WebRTC Support | Data Channels |
|---------|-----------------|---------------|
| Chrome  | ✅ Full        | ✅ Yes        |
| Firefox | ✅ Full        | ✅ Yes        |
| Safari  | ✅ Full        | ✅ Yes        |
| Edge    | ✅ Full        | ✅ Yes        |

### Fallback Behavior

WebRTC failures automatically fall back:

1. **Connection failure** → WebSocket
2. **Timeout** → WebSocket  
3. **Data channel error** → WebSocket
4. **Browser unsupported** → WebSocket

## Security Considerations

### Transport Security

- **Signaling**: WSS (WebSocket Secure)
- **Media**: DTLS-SRTP (automatic)
- **Data**: DTLS (automatic)

### Authentication

WebRTC inherits authentication from the signaling channel:

```javascript
// Session-based auth
signalingWs.send({
  type: 'register',
  role: 'client',
  sessionId: authenticatedSessionId,
  token: authToken // Optional
});
```

### Network Security

- WebRTC traffic is peer-to-peer (bypasses server)
- TURN credentials should be rotated regularly
- Monitor TURN server usage to prevent abuse

## Production Deployment

### Recommended Setup

```nginx
# Nginx configuration for signaling
location /signaling {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
}
```

### TURN Server Deployment

```yaml
# docker-compose.yml
version: '3'
services:
  coturn:
    image: coturn/coturn
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
    environment:
      - LISTENING_PORT=3478
      - EXTERNAL_IP=${PUBLIC_IP}
      - REALM=turn.example.com
      - USER=cortex:${TURN_PASSWORD}
```

### Monitoring

Track key WebRTC metrics:

- Connection success rate
- Time to connection
- Data channel errors
- TURN server usage
- NAT traversal failures

## Known Limitations

1. **node-datachannel dependency**: Requires native compilation
2. **TURN costs**: May require paid TURN service for production
3. **NAT traversal**: Not 100% successful in all networks
4. **Mobile networks**: Higher failure rates on cellular connections
5. **Corporate firewalls**: May block WebRTC entirely

## Future Enhancements

- [ ] Automatic TURN server discovery
- [ ] Connection quality monitoring
- [ ] Adaptive transport selection
- [ ] WebRTC statistics collection
- [ ] Mobile network optimization
- [ ] Enterprise firewall detection