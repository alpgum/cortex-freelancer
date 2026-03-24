# Cortex Freelancer → OpenClaw Bridge MVP Roadmap

## 🎯 Hedef
End user Cortex Freelancer web UI'da chat → Alp'in lokal OpenClaw'ı ile gerçek konuşma → response web'de gösterilsin
**MVP Sınır:** 1 concurrent user, Alp'in makinasındaki OpenClaw

---

## 🏗️ Technical Architecture

```
[User Web UI] → [Cortex API] → [Bridge Tunnel] → [Alp Local OpenClaw] → Response Pipeline
```

### Current Status
- ✅ Chat UI exists: `/app/chat.html`
- ✅ API endpoint skeleton: `/api/chat.js` 
- ❌ Bridge connection: Cortex → Alp OpenClaw yok
- ❌ Real OpenClaw integration: demo mode'da

---

## 📋 Development Phases

### Phase 1: Local OpenClaw API Setup (30 min)
**Goal:** Alp'in OpenClaw'ından HTTP API endpoint expose etmek

#### Tasks:
- [x] **BRIDGE-001:** OpenClaw'a HTTP API endpoint ekle ✅ 2026-03-24
  - `/api/chat` endpoint (POST)
  - Request: `{message, sessionId, userId}`
  - Response: `{response, sessionId, timestamp, meta}`
  - Port: 8081 (configurable via OPENCLAW_PORT env)
  - File: `~/workspace/api/chat.js` (Express server)

- [ ] **BRIDGE-002:** Network accessibility
  - Local test: `localhost:8080/api/chat`
  - Cloudflare Tunnel setup (external access için)
  - ngrok fallback option

- [ ] **BRIDGE-003:** Session management
  - Session isolation per user
  - Session timeout (30 min idle)
  - Memory persistence between messages

**Deliverable:** `curl -X POST localhost:8080/api/chat -d '{"message":"hello"}' → OpenClaw response`

---

### Phase 2: Cortex → OpenClaw Bridge (45 min)
**Goal:** Cortex Freelancer API'sından Alp'in OpenClaw'ına message routing

#### Tasks:
- [x] **BRIDGE-004:** Cortex `/api/chat.js` update
  - Remove Anthropic direct call
  - Add OpenClaw proxy logic
  - Environment variable: `OPENCLAW_BRIDGE_URL`

- [ ] **BRIDGE-005:** Request/Response transformation
  - Cortex format → OpenClaw format mapping
  - Error handling: OpenClaw down, network timeout
  - Response streaming support (if needed)

- [ ] **BRIDGE-006:** Rate limiting & queuing
  - 1 concurrent user enforcement
  - Queue system: eğer OpenClaw busy, wait in line
  - User feedback: "OpenClaw is thinking..." states

**Deliverable:** Cortex web UI → Alp OpenClaw → response in chat

---

### Phase 3: Production Stability (30 min)
**Goal:** Reliable end-user experience

#### Tasks:
- [ ] **BRIDGE-007:** Connection monitoring
  - Health check: Cortex → OpenClaw ping every 60s
  - Auto-retry logic: 3 attempts with backoff
  - Fallback message: "AI assistant temporarily unavailable"

- [ ] **BRIDGE-008:** Session persistence
  - User session tracking: localStorage + server-side session
  - Conversation history sync
  - Resume conversation after reconnect

- [ ] **BRIDGE-009:** User experience polish
  - Typing indicators: "Lucas is typing..."
  - Message timestamps
  - Error messages user-friendly
  - "Powered by OpenClaw" attribution

**Deliverable:** Production-ready chat experience

---

### Phase 4: Scaling Preparation (Optional)
**Goal:** Multiple user support için foundation

#### Tasks:
- [ ] **BRIDGE-010:** Multi-session architecture
  - Session routing: user → dedicated OpenClaw session
  - Load balancing prep (multiple OpenClaw instances)
  - Session affinity (same user → same session)

- [ ] **BRIDGE-011:** Analytics & monitoring
  - Message count, response time tracking
  - User satisfaction feedback
  - OpenClaw performance metrics

**Deliverable:** Multi-user ready architecture

---

## 🛠️ Implementation Details

### OpenClaw API Endpoint (Phase 1)
```javascript
// ~/workspace/api/chat.js
const express = require('express');
const { spawn } = require('child_process');

app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default', userId } = req.body;
  
  // Spawn OpenClaw CLI with message
  const process = spawn('openclaw', ['send', sessionId, message]);
  
  // Collect response
  let response = '';
  process.stdout.on('data', (data) => response += data);
  
  process.on('close', () => {
    res.json({ response, sessionId, timestamp: Date.now() });
  });
});
```

### Cortex Bridge Integration (Phase 2)
```javascript
// cortex-freelancer/api/chat.js
const OPENCLAW_URL = process.env.OPENCLAW_BRIDGE_URL || 'http://localhost:8080';

export default async function handler(req, res) {
  try {
    const response = await fetch(`${OPENCLAW_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.json({ error: 'AI assistant unavailable' });
  }
}
```

### Network Setup
```bash
# Option 1: Cloudflare Tunnel (recommended)
cloudflared tunnel --url localhost:8080

# Option 2: ngrok (fallback)
ngrok http 8080

# Environment variable in Vercel
OPENCLAW_BRIDGE_URL=https://xyz.trycloudflare.com
```

---

## 📊 Success Metrics

### MVP Success Criteria:
- [ ] User types message in Cortex → sees response from Alp's OpenClaw
- [ ] Response time < 10 seconds (95th percentile)
- [ ] Conversation maintains context (multi-turn chat)
- [ ] Error rate < 5% (network/OpenClaw failures)
- [ ] 1 concurrent user works smoothly

### Testing Scenarios:
1. **Basic Chat:** "Hello" → OpenClaw greeting response
2. **Context Test:** "My name is John" → "What's my name?" → "John"
3. **Freelancer Query:** "How do I price my services?" → relevant advice
4. **Error Recovery:** OpenClaw restart during chat → graceful reconnect
5. **Session Persistence:** Close browser → reopen → conversation continues

---

## ⏱️ Timeline

- **Phase 1:** 30 minutes (OpenClaw API setup)
- **Phase 2:** 45 minutes (Bridge integration)
- **Phase 3:** 30 minutes (Stability polish)
- **Total MVP:** ~2 hours

**Sprint Execution:** 3 ACP sessions paralel çalıştırılabilir

---

## 🔧 Development Environment

### Requirements:
- Alp'in MacBook: OpenClaw + Node.js + internet connection
- Cortex Freelancer: Vercel deployment access
- Network: Static IP or tunnel service

### Setup Commands:
```bash
# 1. OpenClaw API server
cd ~/workspace && node api/chat.js

# 2. Tunnel setup
cloudflared tunnel --url localhost:8080

# 3. Cortex environment variable
vercel env add OPENCLAW_BRIDGE_URL production

# 4. Deploy
vercel --prod
```

---

## 🚀 Go-Live Checklist

- [ ] OpenClaw API responding on localhost:8080
- [ ] Tunnel active with public URL
- [ ] Cortex OPENCLAW_BRIDGE_URL configured
- [ ] Cortex `/app/chat.html` accessible
- [ ] End-to-end test: user message → OpenClaw → response
- [ ] Error handling works: OpenClaw down → fallback message
- [ ] Session persistence working

**Ready for sprint mode execution?**