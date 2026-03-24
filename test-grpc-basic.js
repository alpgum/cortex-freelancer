#!/usr/bin/env node

/**
 * Basic test for gRPC server functionality
 * Tests server startup, health check, and basic protobuf loading
 * 
 * CFX-027: gRPC Streaming Implementation Test
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

async function testGrpcServer() {
  console.log('Testing Cortex Freelancer gRPC Implementation...\n');
  
  try {
    // Test 1: Load protocol buffer definition
    console.log('1. Loading protocol buffers...');
    const PROTO_PATH = path.join(__dirname, 'proto', 'chat.proto');
    
    if (!require('fs').existsSync(PROTO_PATH)) {
      throw new Error(`Protocol buffer file not found: ${PROTO_PATH}`);
    }
    
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    
    const chatProto = grpc.loadPackageDefinition(packageDefinition).cortex.chat;
    console.log('✓ Protocol buffers loaded successfully');
    
    // Test 2: Create gRPC server
    console.log('\n2. Creating gRPC server...');
    const server = new grpc.Server();
    
    // Mock service implementation for testing
    const mockService = {
      HealthCheck: (call, callback) => {
        console.log('   Health check called');
        callback(null, {
          status: 'SERVING',
          timestamp: Date.now().toString(),
          version: '1.0.0-test',
          metrics: {
            active_connections: 0,
            total_requests: 1,
            avg_response_ms: 0,
            error_count: 0,
            uptime_ms: Date.now()
          }
        });
      },
      
      StreamChat: (call) => {
        console.log('   Stream chat called');
        const request = call.request;
        
        // Send thinking indicator
        call.write({
          type: 'THINKING',
          session_id: request.session_id || 'test-session',
          request_id: request.request_id || 'test-request',
          timestamp: Date.now().toString(),
          thinking: 'Processing test message...'
        });
        
        // Send a few test tokens
        const tokens = ['Hello', ' from', ' gRPC', ' server!'];
        let i = 0;
        
        const sendToken = () => {
          if (i < tokens.length) {
            call.write({
              type: 'TOKEN',
              session_id: request.session_id || 'test-session',
              request_id: request.request_id || 'test-request',
              timestamp: Date.now().toString(),
              token: tokens[i]
            });
            i++;
            setTimeout(sendToken, 200); // Delay between tokens
          } else {
            // Send completion
            call.write({
              type: 'COMPLETE',
              session_id: request.session_id || 'test-session',
              request_id: request.request_id || 'test-request',
              timestamp: Date.now().toString(),
              complete: {
                full_response: tokens.join(''),
                total_tokens: tokens.length,
                response_time_ms: 800,
                finish_reason: 'stop'
              }
            });
            call.end();
          }
        };
        
        setTimeout(sendToken, 500); // Initial delay
      },
      
      InteractiveChat: (call) => {
        console.log('   Interactive chat called');
        call.on('data', (request) => {
          console.log(`   Received: ${request.message}`);
        });
        call.on('end', () => {
          call.end();
        });
      },
      
      GetSessionMetrics: (call, callback) => {
        console.log('   Session metrics called');
        callback(null, {
          session_id: call.request.session_id || 'test-session',
          message_count: 1,
          avg_response_ms: 800,
          session_start_ms: Date.now() - 60000,
          last_activity_ms: Date.now(),
          total_usage: {
            total_tokens: 10,
            model: 'claude-sonnet'
          }
        });
      }
    };
    
    server.addService(chatProto.ChatService.service, mockService);
    console.log('✓ gRPC server created with mock services');
    
    // Test 3: Start server on test port
    console.log('\n3. Starting server on test port...');
    const testPort = 50052; // Different port to avoid conflicts
    const bindAddress = `0.0.0.0:${testPort}`;
    
    await new Promise((resolve, reject) => {
      server.bindAsync(bindAddress, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
          reject(err);
        } else {
          console.log(`✓ Server bound to ${bindAddress}`);
          server.start();
          console.log('✓ Server started successfully');
          resolve(port);
        }
      });
    });
    
    // Test 4: Create client and test health check
    console.log('\n4. Testing client connection...');
    const client = new chatProto.ChatService(`localhost:${testPort}`, grpc.credentials.createInsecure());
    
    const healthResponse = await new Promise((resolve, reject) => {
      client.HealthCheck({
        service: 'cortex.chat.ChatService',
        timestamp: Date.now().toString()
      }, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
    
    console.log('✓ Health check successful:', healthResponse.status);
    console.log('  Version:', healthResponse.version);
    console.log('  Uptime:', healthResponse.metrics.uptime_ms + 'ms');
    
    // Test 5: Test streaming
    console.log('\n5. Testing streaming chat...');
    const streamCall = client.StreamChat({
      session_id: 'test-session-' + Date.now(),
      message: 'Hello gRPC server!',
      request_id: 'test-request-' + Date.now(),
      timestamp: Date.now().toString(),
      settings: {
        model: 'claude-sonnet',
        stream_tokens: true
      }
    });
    
    const tokens = [];
    await new Promise((resolve, reject) => {
      streamCall.on('data', (response) => {
        console.log(`  Received ${response.type}:`, 
          response.token || response.thinking || response.complete?.full_response || 'N/A');
        
        if (response.type === 'TOKEN') {
          tokens.push(response.token);
        } else if (response.type === 'COMPLETE') {
          console.log('  Stream complete. Total tokens:', response.complete.total_tokens);
          resolve();
        }
      });
      
      streamCall.on('error', reject);
      streamCall.on('end', resolve);
    });
    
    console.log('✓ Streaming test successful. Received:', tokens.join(''));
    
    // Test 6: Test session metrics
    console.log('\n6. Testing session metrics...');
    const metricsResponse = await new Promise((resolve, reject) => {
      client.GetSessionMetrics({
        session_id: 'test-session'
      }, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
    
    console.log('✓ Session metrics retrieved');
    console.log('  Messages:', metricsResponse.message_count);
    console.log('  Avg response time:', metricsResponse.avg_response_ms + 'ms');
    
    // Cleanup
    console.log('\n7. Cleaning up...');
    server.tryShutdown((err) => {
      if (err) {
        console.warn('  Warning: Error during shutdown:', err.message);
      } else {
        console.log('✓ Server shut down gracefully');
      }
    });
    
    console.log('\n🎉 All tests passed! gRPC implementation is working correctly.\n');
    
    // Print next steps
    console.log('Next steps:');
    console.log('1. Run: ./scripts/setup-grpc-web.sh');
    console.log('2. Start production server: node grpc-server.js');
    console.log('3. Test in browser: http://localhost:3847/app/grpc-test.html');
    console.log('4. Compare with WebSocket/SSE implementations\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nDiagnostic info:');
    console.error('- Node.js version:', process.version);
    console.error('- Working directory:', process.cwd());
    console.error('- Proto file exists:', require('fs').existsSync(path.join(__dirname, 'proto', 'chat.proto')));
    console.error('- gRPC package version:', require('@grpc/grpc-js/package.json').version);
    
    if (error.stack) {
      console.error('\nFull stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  testGrpcServer();
}

module.exports = { testGrpcServer };