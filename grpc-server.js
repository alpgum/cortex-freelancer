/**
 * Cortex Freelancer gRPC Streaming Server
 * 
 * High-performance streaming chat server using gRPC with token-by-token delivery.
 * Wraps OpenClaw/Anthropic API calls in bidirectional gRPC streams.
 * 
 * Features:
 * - Server-streaming RPC for token-by-token responses
 * - Bidirectional streaming for interactive conversations  
 * - Health checks and metrics
 * - Error handling with gRPC status codes
 * - Session management and connection tracking
 * 
 * CFX-027: gRPC Streaming Implementation
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const path = require('path');

// Load protocol buffer definition
const PROTO_PATH = path.join(__dirname, 'proto', 'chat.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const chatProto = grpc.loadPackageDefinition(packageDefinition).cortex.chat;

// Server state and metrics
const sessions = new Map();
const metrics = {
  totalConnections: 0,
  activeConnections: 0,
  totalRequests: 0,
  totalErrors: 0,
  avgResponseMs: 0,
  _responseTimes: [],
  startedAt: Date.now()
};

// Configuration
const config = {
  SPAWN_TIMEOUT_MS: parseInt(process.env.GRPC_SPAWN_TIMEOUT_MS || '120000'),
  KEEPALIVE_INTERVAL_MS: parseInt(process.env.GRPC_KEEPALIVE_MS || '15000'),
  MAX_HISTORY: parseInt(process.env.GRPC_MAX_HISTORY || '20'),
  SESSION_TIMEOUT_MS: parseInt(process.env.GRPC_SESSION_TIMEOUT_MS || '1800000'), // 30 min
  SERVER_PORT: parseInt(process.env.GRPC_PORT || '50051'),
  OPENCLAW_BINARY: process.env.OPENCLAW_BINARY || 'openclaw',
  MAX_CONCURRENT: parseInt(process.env.GRPC_MAX_CONCURRENT || '10')
};

// Track concurrent processing
let activeSessions = 0;

// gRPC error status codes
const Status = grpc.status;

/**
 * Health Check RPC
 */
function healthCheck(call, callback) {
  console.log('Health check requested');
  
  const response = {
    status: 'SERVING',
    timestamp: Date.now().toString(),
    version: '1.0.0',
    metrics: {
      active_connections: metrics.activeConnections,
      total_requests: metrics.totalRequests,
      avg_response_ms: metrics.avgResponseMs,
      error_count: metrics.totalErrors,
      uptime_ms: Date.now() - metrics.startedAt
    }
  };
  
  callback(null, response);
}

/**
 * Server-streaming chat RPC
 * Streams token-by-token responses from OpenClaw/Anthropic
 */
function streamChat(call) {
  const request = call.request;
  const sessionId = request.session_id || randomUUID();
  const requestId = request.request_id || randomUUID();
  const startTime = Date.now();
  
  console.log(`[${sessionId}] StreamChat request: ${request.message.substring(0, 100)}...`);
  
  metrics.totalRequests++;
  metrics.activeConnections++;
  
  // Check concurrency limits
  if (activeSessions >= config.MAX_CONCURRENT) {
    const error = {
      code: grpc.status.RESOURCE_EXHAUSTED,
      message: 'Server overloaded, try again later'
    };
    call.emit('error', error);
    return;
  }
  
  activeSessions++;
  
  // Track session
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      messages: [],
      startTime: Date.now(),
      lastActivity: Date.now(),
      totalTokens: 0
    });
  }
  
  const session = sessions.get(sessionId);
  session.lastActivity = Date.now();
  
  // Add user message to history
  session.messages.push({
    role: 'USER',
    content: request.message,
    timestamp: Date.now().toString(),
    message_id: randomUUID()
  });
  
  // Trim history if too long
  if (session.messages.length > config.MAX_HISTORY) {
    session.messages = session.messages.slice(-config.MAX_HISTORY);
  }
  
  // Send thinking indicator
  call.write({
    type: 'THINKING',
    session_id: sessionId,
    request_id: requestId,
    timestamp: Date.now().toString(),
    thinking: 'Processing your request...'
  });
  
  // Build OpenClaw command
  const history = session.messages.map(msg => 
    `${msg.role === 'USER' ? 'Human' : 'Assistant'}: ${msg.content}`
  ).join('\n\n');
  
  const systemPrompt = request.context?.system_prompt || 
    "You are Cortex, an AI freelance business manager. Help with proposals, rates, client communication, and strategy.";
  
  const fullPrompt = `${systemPrompt}\n\nConversation:\n${history}\n\nAssistant:`;
  
  // Spawn OpenClaw process
  const openclawArgs = [
    'ask',
    '--stream',
    '--model', request.settings?.model || 'claude-sonnet',
    fullPrompt
  ];
  
  console.log(`[${sessionId}] Spawning: ${config.OPENCLAW_BINARY} ${openclawArgs.slice(0, 3).join(' ')} [prompt]`);
  
  const child = spawn(config.OPENCLAW_BINARY, openclawArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });
  
  let responseBuffer = '';
  let tokenCount = 0;
  let keepaliveTimer;
  
  // Keepalive timer to prevent timeouts
  keepaliveTimer = setInterval(() => {
    if (!call.destroyed && !call.cancelled) {
      call.write({
        type: 'KEEPALIVE',
        session_id: sessionId,
        request_id: requestId,
        timestamp: Date.now().toString(),
        keepalive: 'processing'
      });
    }
  }, config.KEEPALIVE_INTERVAL_MS);
  
  // Handle OpenClaw stdout (streaming tokens)
  child.stdout.on('data', (data) => {
    const chunk = data.toString();
    responseBuffer += chunk;
    
    // Stream individual tokens
    const tokens = chunk.split(/(\s+)/);
    for (const token of tokens) {
      if (token.trim() && !call.destroyed && !call.cancelled) {
        tokenCount++;
        call.write({
          type: 'TOKEN',
          session_id: sessionId,
          request_id: requestId,
          timestamp: Date.now().toString(),
          token: token
        });
      }
    }
  });
  
  // Handle OpenClaw stderr (errors)
  child.stderr.on('data', (data) => {
    const error = data.toString();
    console.error(`[${sessionId}] OpenClaw error:`, error);
    
    if (!call.destroyed && !call.cancelled) {
      call.write({
        type: 'ERROR',
        session_id: sessionId,
        request_id: requestId,
        timestamp: Date.now().toString(),
        error: {
          code: 'OPENCLAW_ERROR',
          message: 'Processing error occurred',
          recoverable: true,
          retry_after_ms: 5000
        }
      });
    }
  });
  
  // Handle process completion
  child.on('close', (code) => {
    clearInterval(keepaliveTimer);
    activeSessions--;
    metrics.activeConnections--;
    
    const responseTime = Date.now() - startTime;
    metrics._responseTimes.push(responseTime);
    if (metrics._responseTimes.length > 100) {
      metrics._responseTimes = metrics._responseTimes.slice(-50);
    }
    metrics.avgResponseMs = metrics._responseTimes.reduce((a, b) => a + b, 0) / metrics._responseTimes.length;
    
    console.log(`[${sessionId}] Process completed with code ${code} (${responseTime}ms, ${tokenCount} tokens)`);
    
    if (code === 0 && responseBuffer.trim() && !call.destroyed && !call.cancelled) {
      // Add assistant response to session history
      session.messages.push({
        role: 'ASSISTANT',
        content: responseBuffer.trim(),
        timestamp: Date.now().toString(),
        message_id: randomUUID()
      });
      
      // Send completion marker
      call.write({
        type: 'COMPLETE',
        session_id: sessionId,
        request_id: requestId,
        timestamp: Date.now().toString(),
        complete: {
          full_response: responseBuffer.trim(),
          total_tokens: tokenCount,
          response_time_ms: responseTime,
          finish_reason: 'stop'
        }
      });
      
      // Send usage info
      call.write({
        type: 'USAGE',
        session_id: sessionId,
        request_id: requestId,
        timestamp: Date.now().toString(),
        usage: {
          input_tokens: Math.ceil(fullPrompt.length / 4), // Rough estimate
          output_tokens: tokenCount,
          total_tokens: Math.ceil(fullPrompt.length / 4) + tokenCount,
          model: request.settings?.model || 'claude-sonnet'
        }
      });
      
      call.end();
    } else {
      metrics.totalErrors++;
      
      if (!call.destroyed && !call.cancelled) {
        call.emit('error', {
          code: code === 124 ? Status.DEADLINE_EXCEEDED : Status.INTERNAL,
          message: `OpenClaw process failed with code ${code}`
        });
      }
    }
  });
  
  // Handle client disconnect
  call.on('cancelled', () => {
    console.log(`[${sessionId}] Client cancelled request`);
    clearInterval(keepaliveTimer);
    activeSessions--;
    metrics.activeConnections--;
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  });
  
  // Timeout handling
  setTimeout(() => {
    if (!child.killed && !call.destroyed) {
      console.log(`[${sessionId}] Request timeout, killing process`);
      child.kill('SIGTERM');
    }
  }, config.SPAWN_TIMEOUT_MS);
}

/**
 * Bidirectional streaming chat RPC
 * Full interactive conversation with per-message OpenClaw processing.
 * Each incoming client message is queued and processed sequentially,
 * streaming tokens back as they arrive.
 */
function interactiveChat(call) {
  const sessionId = randomUUID();
  console.log(`[${sessionId}] Interactive chat session started`);

  metrics.totalRequests++;
  metrics.activeConnections++;

  // Session state for conversation context
  const session = {
    id: sessionId,
    messages: [],
    startTime: Date.now(),
    lastActivity: Date.now(),
    totalTokens: 0
  };
  sessions.set(sessionId, session);

  // Queue incoming messages so they process one at a time
  const messageQueue = [];
  let processing = false;
  let clientEnded = false;

  function processNext() {
    if (processing || messageQueue.length === 0) {
      // If client ended and queue drained, close the stream
      if (clientEnded && messageQueue.length === 0 && !processing) {
        metrics.activeConnections--;
        call.end();
      }
      return;
    }

    processing = true;
    const request = messageQueue.shift();
    const requestId = request.request_id || randomUUID();
    const startTime = Date.now();

    console.log(`[${sessionId}] Processing interactive message: ${request.message.substring(0, 80)}...`);

    // Add user message to history
    session.messages.push({ role: 'USER', content: request.message, timestamp: Date.now().toString(), message_id: randomUUID() });
    if (session.messages.length > config.MAX_HISTORY) {
      session.messages = session.messages.slice(-config.MAX_HISTORY);
    }

    // Thinking indicator
    call.write({ type: 'THINKING', session_id: sessionId, request_id: requestId, timestamp: Date.now().toString(), thinking: 'Processing...' });

    const systemPrompt = request.context?.system_prompt ||
      "You are Cortex, an AI freelance business manager. Help with proposals, rates, client communication, and strategy.";
    const history = session.messages.map(m => `${m.role === 'USER' ? 'Human' : 'Assistant'}: ${m.content}`).join('\n\n');
    const fullPrompt = `${systemPrompt}\n\nConversation:\n${history}\n\nAssistant:`;

    const child = spawn(config.OPENCLAW_BINARY, ['ask', '--stream', '--model', request.settings?.model || 'claude-sonnet', fullPrompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let responseBuffer = '';
    let tokenCount = 0;

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      responseBuffer += chunk;
      const tokens = chunk.split(/(\s+)/);
      for (const token of tokens) {
        if (token.trim() && !call.destroyed && !call.cancelled) {
          tokenCount++;
          call.write({ type: 'TOKEN', session_id: sessionId, request_id: requestId, timestamp: Date.now().toString(), token });
        }
      }
    });

    child.stderr.on('data', (data) => {
      console.error(`[${sessionId}] OpenClaw error:`, data.toString());
      if (!call.destroyed && !call.cancelled) {
        call.write({ type: 'ERROR', session_id: sessionId, request_id: requestId, timestamp: Date.now().toString(), error: { code: 'OPENCLAW_ERROR', message: 'Processing error', recoverable: true, retry_after_ms: 5000 } });
      }
    });

    child.on('close', (code) => {
      const responseTime = Date.now() - startTime;
      session.totalTokens += tokenCount;

      if (code === 0 && responseBuffer.trim() && !call.destroyed && !call.cancelled) {
        session.messages.push({ role: 'ASSISTANT', content: responseBuffer.trim(), timestamp: Date.now().toString(), message_id: randomUUID() });
        call.write({ type: 'COMPLETE', session_id: sessionId, request_id: requestId, timestamp: Date.now().toString(), complete: { full_response: responseBuffer.trim(), total_tokens: tokenCount, response_time_ms: responseTime, finish_reason: 'stop' } });
        call.write({ type: 'USAGE', session_id: sessionId, request_id: requestId, timestamp: Date.now().toString(), usage: { input_tokens: Math.ceil(fullPrompt.length / 4), output_tokens: tokenCount, total_tokens: Math.ceil(fullPrompt.length / 4) + tokenCount, model: request.settings?.model || 'claude-sonnet' } });
      } else if (!call.destroyed && !call.cancelled) {
        metrics.totalErrors++;
        call.write({ type: 'ERROR', session_id: sessionId, request_id: requestId, timestamp: Date.now().toString(), error: { code: 'PROCESS_FAILED', message: `Process exited with code ${code}`, recoverable: false } });
      }

      processing = false;
      session.lastActivity = Date.now();
      processNext();
    });
  }

  call.on('data', (request) => {
    session.lastActivity = Date.now();
    messageQueue.push(request);
    processNext();
  });

  call.on('end', () => {
    console.log(`[${sessionId}] Client ended interactive stream`);
    clientEnded = true;
    processNext(); // Drain remaining queue then close
  });

  call.on('error', (error) => {
    console.error(`[${sessionId}] Interactive chat error:`, error);
    metrics.totalErrors++;
    metrics.activeConnections--;
  });

  call.on('cancelled', () => {
    console.log(`[${sessionId}] Interactive chat cancelled`);
    metrics.activeConnections--;
  });
}

/**
 * Get session metrics RPC
 */
function getSessionMetrics(call, callback) {
  const request = call.request;
  const session = sessions.get(request.session_id);
  
  if (!session) {
    callback({
      code: Status.NOT_FOUND,
      message: 'Session not found'
    });
    return;
  }
  
  const response = {
    session_id: request.session_id,
    message_count: session.messages.length,
    avg_response_ms: metrics.avgResponseMs,
    session_start_ms: session.startTime,
    last_activity_ms: session.lastActivity,
    total_usage: {
      total_tokens: session.totalTokens,
      model: 'claude-sonnet'
    }
  };
  
  callback(null, response);
}

/**
 * Session cleanup job
 */
function cleanupSessions() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > config.SESSION_TIMEOUT_MS) {
      sessions.delete(sessionId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired sessions. Active: ${sessions.size}`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupSessions, 5 * 60 * 1000);

/**
 * Start the gRPC server
 */
function startServer() {
  const server = new grpc.Server();
  
  // Register service implementation
  server.addService(chatProto.ChatService.service, {
    HealthCheck: healthCheck,
    StreamChat: streamChat,
    InteractiveChat: interactiveChat,
    GetSessionMetrics: getSessionMetrics
  });
  
  // Start server
  const bindAddress = `0.0.0.0:${config.SERVER_PORT}`;
  server.bindAsync(bindAddress, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error('Failed to start gRPC server:', err);
      process.exit(1);
    }
    
    console.log(`Cortex Freelancer gRPC server running on ${bindAddress}`);
    console.log('Configuration:', {
      port: config.SERVER_PORT,
      spawnTimeout: config.SPAWN_TIMEOUT_MS,
      keepaliveInterval: config.KEEPALIVE_INTERVAL_MS,
      maxConcurrent: config.MAX_CONCURRENT,
      openclawBinary: config.OPENCLAW_BINARY
    });
    
    server.start();
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Shutting down gRPC server...');
    server.tryShutdown((err) => {
      if (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
      console.log('gRPC server shut down gracefully');
      process.exit(0);
    });
  });
}

// Start server if run directly
if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  metrics,
  sessions,
  config
};