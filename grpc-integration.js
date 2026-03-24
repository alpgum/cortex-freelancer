/**
 * gRPC Integration for Cortex Freelancer
 * 
 * Integrates the gRPC streaming server with the existing Express server.
 * Provides unified startup, monitoring, and configuration management.
 * 
 * Usage:
 *   const { integrateGrpc } = require('./grpc-integration');
 *   integrateGrpc(expressApp, httpServer);
 * 
 * CFX-027: gRPC Streaming Integration
 */

const { startServer: startGrpcServer, metrics: grpcMetrics } = require('./grpc-server');
const path = require('path');

/**
 * Integrate gRPC server with existing Cortex Freelancer infrastructure
 */
function integrateGrpc(app, httpServer) {
  console.log('Integrating gRPC streaming support...');
  
  // Add gRPC health endpoint to Express app
  app.get('/api/grpc/health', (req, res) => {
    try {
      const health = {
        status: 'serving',
        grpc_metrics: grpcMetrics,
        server_port: process.env.GRPC_PORT || 50051,
        proxy_url: process.env.GRPC_PROXY_URL || 'http://localhost:8080',
        timestamp: Date.now(),
        version: '1.0.0'
      };
      
      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      });
    }
  });
  
  // Add gRPC metrics endpoint
  app.get('/api/grpc/metrics', (req, res) => {
    try {
      // Calculate additional metrics
      const now = Date.now();
      const uptimeMs = now - grpcMetrics.startedAt;
      const requestsPerSecond = grpcMetrics.totalRequests / (uptimeMs / 1000);
      
      const detailedMetrics = {
        ...grpcMetrics,
        uptime_ms: uptimeMs,
        uptime_human: formatUptime(uptimeMs),
        requests_per_second: requestsPerSecond.toFixed(2),
        error_rate: grpcMetrics.totalRequests > 0 ? 
          (grpcMetrics.totalErrors / grpcMetrics.totalRequests * 100).toFixed(2) + '%' : '0%',
        timestamp: now
      };
      
      res.json(detailedMetrics);
    } catch (error) {
      res.status(500).json({
        error: error.message,
        timestamp: Date.now()
      });
    }
  });
  
  // Add gRPC test page route
  app.get('/grpc-test', (req, res) => {
    const testPath = path.join(__dirname, 'app', 'grpc-test.html');
    res.sendFile(testPath);
  });
  
  // Add gRPC status to main status page
  app.get('/api/status', (req, res, next) => {
    // Store original res.json method
    const originalJson = res.json;
    
    // Override res.json to add gRPC status
    res.json = function(data) {
      if (data && typeof data === 'object') {
        data.grpc = {
          enabled: true,
          server_port: process.env.GRPC_PORT || 50051,
          proxy_url: process.env.GRPC_PROXY_URL || 'http://localhost:8080',
          active_connections: grpcMetrics.activeConnections,
          total_requests: grpcMetrics.totalRequests,
          avg_response_ms: grpcMetrics.avgResponseMs,
          status: grpcMetrics.totalErrors === 0 ? 'healthy' : 'degraded'
        };
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  });
  
  console.log('✓ gRPC endpoints integrated:');
  console.log('  • /api/grpc/health - Health check');
  console.log('  • /api/grpc/metrics - Detailed metrics');
  console.log('  • /grpc-test - Browser test interface');
  console.log('  • /api/status - Includes gRPC status');
  
  // Start gRPC server in separate process if not already running
  if (process.env.GRPC_AUTO_START !== 'false') {
    try {
      startGrpcServer();
      console.log('✓ gRPC server started automatically');
    } catch (error) {
      console.warn('⚠ gRPC server failed to start:', error.message);
      console.warn('  Start manually: node grpc-server.js');
    }
  } else {
    console.log('ℹ gRPC auto-start disabled (GRPC_AUTO_START=false)');
    console.log('  Start manually: node grpc-server.js');
  }
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Check if gRPC dependencies are available
 */
function checkGrpcDependencies() {
  try {
    require('@grpc/grpc-js');
    require('@grpc/proto-loader');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get gRPC configuration from environment
 */
function getGrpcConfig() {
  return {
    enabled: process.env.GRPC_ENABLED !== 'false',
    port: parseInt(process.env.GRPC_PORT || '50051'),
    proxyUrl: process.env.GRPC_PROXY_URL || 'http://localhost:8080',
    autoStart: process.env.GRPC_AUTO_START !== 'false',
    spawnTimeout: parseInt(process.env.GRPC_SPAWN_TIMEOUT_MS || '120000'),
    maxConcurrent: parseInt(process.env.GRPC_MAX_CONCURRENT || '10'),
    keepaliveInterval: parseInt(process.env.GRPC_KEEPALIVE_MS || '15000')
  };
}

/**
 * Setup gRPC with existing server (main integration point)
 */
function setupGrpcIntegration(app, httpServer) {
  if (!checkGrpcDependencies()) {
    console.warn('⚠ gRPC dependencies not found. Install with:');
    console.warn('  npm install @grpc/grpc-js @grpc/proto-loader grpc-web');
    return false;
  }
  
  const config = getGrpcConfig();
  
  if (!config.enabled) {
    console.log('ℹ gRPC integration disabled (GRPC_ENABLED=false)');
    return false;
  }
  
  console.log('Setting up gRPC integration...');
  console.log('gRPC Config:', config);
  
  try {
    integrateGrpc(app, httpServer);
    return true;
  } catch (error) {
    console.error('❌ Failed to integrate gRPC:', error.message);
    return false;
  }
}

module.exports = {
  integrateGrpc,
  setupGrpcIntegration,
  checkGrpcDependencies,
  getGrpcConfig,
  formatUptime
};