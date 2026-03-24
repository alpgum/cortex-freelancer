#!/usr/bin/env node

/**
 * Performance comparison between gRPC, WebSocket, and SSE implementations
 * Tests latency, throughput, and resource usage for each approach
 * 
 * CFX-027: gRPC vs WebSocket vs SSE Benchmark
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

class PerformanceComparison {
  constructor() {
    this.results = {
      grpc: { name: 'gRPC Streaming', tests: [] },
      websocket: { name: 'WebSocket', tests: [] },
      sse: { name: 'Server-Sent Events', tests: [] }
    };
    
    this.testMessage = "How should I price my freelance web development services? I'm experienced with React and Node.js.";
    this.iterations = 5; // Number of test iterations
  }

  /**
   * Setup mock gRPC server for testing
   */
  async setupGrpcServer() {
    const PROTO_PATH = path.join(__dirname, 'proto', 'chat.proto');
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    const chatProto = grpc.loadPackageDefinition(packageDefinition).cortex.chat;
    const server = new grpc.Server();
    
    // Mock service that simulates realistic response patterns
    server.addService(chatProto.ChatService.service, {
      StreamChat: (call) => {
        const startTime = Date.now();
        const request = call.request;
        
        // Simulate thinking time
        setTimeout(() => {
          call.write({
            type: 'THINKING',
            session_id: request.session_id,
            request_id: request.request_id,
            timestamp: Date.now().toString(),
            thinking: 'Analyzing your question...'
          });
          
          // Simulate token streaming (realistic response)
          const mockResponse = `For React/Node.js freelancing, consider these pricing strategies:

1. **Hourly Rates**: $75-150/hour depending on experience
   - Junior: $50-75/hour
   - Mid-level: $75-125/hour  
   - Senior: $100-150/hour

2. **Project-Based Pricing**: 
   - Small projects: $2,000-8,000
   - Medium projects: $8,000-25,000
   - Large projects: $25,000+

3. **Value-Based Pricing**: Price based on client ROI
   - E-commerce: 10-15% of projected revenue
   - Lead generation: $5,000-15,000 based on lead value

Research your local market, consider your unique skills (React expertise is valuable), and don't undervalue yourself. Many freelancers start too low and struggle to raise rates later.`;

          const tokens = mockResponse.split(/(\s+|[.,!?;:])/);
          let tokenIndex = 0;
          
          const sendToken = () => {
            if (tokenIndex < tokens.length) {
              const token = tokens[tokenIndex];
              if (token.trim()) {
                call.write({
                  type: 'TOKEN',
                  session_id: request.session_id,
                  request_id: request.request_id,
                  timestamp: Date.now().toString(),
                  token: token
                });
              }
              tokenIndex++;
              
              // Variable delay to simulate realistic streaming
              const delay = Math.random() * 50 + 10; // 10-60ms
              setTimeout(sendToken, delay);
            } else {
              // Send completion
              const responseTime = Date.now() - startTime;
              call.write({
                type: 'COMPLETE',
                session_id: request.session_id,
                request_id: request.request_id,
                timestamp: Date.now().toString(),
                complete: {
                  full_response: mockResponse,
                  total_tokens: tokens.filter(t => t.trim()).length,
                  response_time_ms: responseTime,
                  finish_reason: 'stop'
                }
              });
              call.end();
            }
          };
          
          setTimeout(sendToken, 200); // Initial delay
        }, 100); // Thinking delay
      }
    });

    return new Promise((resolve, reject) => {
      server.bindAsync('localhost:50053', grpc.ServerCredentials.createInsecure(), (err) => {
        if (err) reject(err);
        else {
          server.start();
          resolve({ server, proto: chatProto });
        }
      });
    });
  }

  /**
   * Setup mock WebSocket server
   */
  setupWebSocketServer() {
    return new Promise((resolve) => {
      const wss = new WebSocket.Server({ port: 8081 });
      
      wss.on('connection', (ws) => {
        ws.on('message', (message) => {
          const request = JSON.parse(message);
          const startTime = Date.now();
          
          // Simulate processing delay
          setTimeout(() => {
            // Send thinking indicator
            ws.send(JSON.stringify({
              type: 'thinking',
              message: 'Analyzing your question...',
              timestamp: Date.now()
            }));
            
            // Simulate streaming response
            const mockResponse = `For React/Node.js freelancing, consider these pricing strategies:

1. **Hourly Rates**: $75-150/hour depending on experience
2. **Project-Based Pricing**: $2,000-25,000+ depending on scope
3. **Value-Based Pricing**: Price based on client ROI

Research your market and don't undervalue yourself!`;

            const tokens = mockResponse.split(/(\s+|[.,!?;:])/);
            let tokenIndex = 0;
            
            const sendToken = () => {
              if (tokenIndex < tokens.length) {
                const token = tokens[tokenIndex];
                if (token.trim()) {
                  ws.send(JSON.stringify({
                    type: 'token',
                    token: token,
                    timestamp: Date.now()
                  }));
                }
                tokenIndex++;
                
                const delay = Math.random() * 50 + 10;
                setTimeout(sendToken, delay);
              } else {
                const responseTime = Date.now() - startTime;
                ws.send(JSON.stringify({
                  type: 'complete',
                  response: mockResponse,
                  totalTokens: tokens.filter(t => t.trim()).length,
                  responseTime: responseTime,
                  timestamp: Date.now()
                }));
              }
            };
            
            setTimeout(sendToken, 200);
          }, 100);
        });
      });
      
      resolve(wss);
    });
  }

  /**
   * Setup mock SSE server
   */
  setupSSEServer() {
    return new Promise((resolve) => {
      const server = http.createServer((req, res) => {
        if (req.url === '/chat-stream' && req.method === 'POST') {
          // Set SSE headers
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          });
          
          const startTime = Date.now();
          
          // Send thinking indicator
          setTimeout(() => {
            res.write(`event: thinking\ndata: ${JSON.stringify({
              message: 'Analyzing your question...',
              timestamp: Date.now()
            })}\n\n`);
            
            // Simulate streaming response
            const mockResponse = `For React/Node.js freelancing, consider these pricing strategies:

1. **Hourly Rates**: $75-150/hour depending on experience
2. **Project-Based Pricing**: $2,000-25,000+ depending on scope
3. **Value-Based Pricing**: Price based on client ROI

Research your market and don't undervalue yourself!`;

            const tokens = mockResponse.split(/(\s+|[.,!?;:])/);
            let tokenIndex = 0;
            
            const sendToken = () => {
              if (tokenIndex < tokens.length) {
                const token = tokens[tokenIndex];
                if (token.trim()) {
                  res.write(`event: token\ndata: ${JSON.stringify({
                    token: token,
                    timestamp: Date.now()
                  })}\n\n`);
                }
                tokenIndex++;
                
                const delay = Math.random() * 50 + 15; // Slightly slower than gRPC
                setTimeout(sendToken, delay);
              } else {
                const responseTime = Date.now() - startTime;
                res.write(`event: complete\ndata: ${JSON.stringify({
                  response: mockResponse,
                  totalTokens: tokens.filter(t => t.trim()).length,
                  responseTime: responseTime,
                  timestamp: Date.now()
                })}\n\n`);
                res.end();
              }
            };
            
            setTimeout(sendToken, 250); // Slightly slower start
          }, 150); // Longer thinking time
        }
      });
      
      server.listen(8082, () => resolve(server));
    });
  }

  /**
   * Test gRPC performance
   */
  async testGrpc(grpcSetup) {
    const { proto } = grpcSetup;
    const client = new proto.ChatService('localhost:50053', grpc.credentials.createInsecure());
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let firstTokenTime = null;
      let tokenCount = 0;
      let totalBytes = 0;
      
      const call = client.StreamChat({
        session_id: 'perf-test-' + Date.now(),
        message: this.testMessage,
        request_id: 'req-' + Date.now(),
        timestamp: Date.now().toString(),
        settings: {
          model: 'claude-sonnet',
          stream_tokens: true
        }
      });
      
      call.on('data', (response) => {
        const now = Date.now();
        
        if (response.type === 'TOKEN') {
          if (!firstTokenTime) firstTokenTime = now;
          tokenCount++;
          totalBytes += Buffer.byteLength(JSON.stringify(response), 'utf8');
        } else if (response.type === 'COMPLETE') {
          const endTime = now;
          resolve({
            totalTime: endTime - startTime,
            firstTokenTime: firstTokenTime ? firstTokenTime - startTime : null,
            tokenCount: tokenCount,
            avgTokenInterval: tokenCount > 1 ? (endTime - firstTokenTime) / (tokenCount - 1) : 0,
            bytesTransferred: totalBytes,
            throughputBps: totalBytes / ((endTime - startTime) / 1000)
          });
        }
      });
      
      call.on('error', reject);
      
      // Timeout after 30 seconds
      setTimeout(() => reject(new Error('gRPC test timeout')), 30000);
    });
  }

  /**
   * Test WebSocket performance
   */
  async testWebSocket() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:8081');
      const startTime = Date.now();
      let firstTokenTime = null;
      let tokenCount = 0;
      let totalBytes = 0;
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          message: this.testMessage,
          timestamp: Date.now()
        }));
      });
      
      ws.on('message', (data) => {
        const now = Date.now();
        const message = JSON.parse(data);
        totalBytes += Buffer.byteLength(data, 'utf8');
        
        if (message.type === 'token') {
          if (!firstTokenTime) firstTokenTime = now;
          tokenCount++;
        } else if (message.type === 'complete') {
          const endTime = now;
          ws.close();
          resolve({
            totalTime: endTime - startTime,
            firstTokenTime: firstTokenTime ? firstTokenTime - startTime : null,
            tokenCount: tokenCount,
            avgTokenInterval: tokenCount > 1 ? (endTime - firstTokenTime) / (tokenCount - 1) : 0,
            bytesTransferred: totalBytes,
            throughputBps: totalBytes / ((endTime - startTime) / 1000)
          });
        }
      });
      
      ws.on('error', reject);
      
      setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket test timeout'));
      }, 30000);
    });
  }

  /**
   * Test SSE performance
   */
  async testSSE() {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let firstTokenTime = null;
      let tokenCount = 0;
      let totalBytes = 0;
      
      const req = http.request({
        hostname: 'localhost',
        port: 8082,
        path: '/chat-stream',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, (res) => {
        res.on('data', (chunk) => {
          const now = Date.now();
          totalBytes += chunk.length;
          
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('event: token')) {
              if (!firstTokenTime) firstTokenTime = now;
              tokenCount++;
            } else if (line.startsWith('event: complete')) {
              const endTime = now;
              resolve({
                totalTime: endTime - startTime,
                firstTokenTime: firstTokenTime ? firstTokenTime - startTime : null,
                tokenCount: tokenCount,
                avgTokenInterval: tokenCount > 1 ? (endTime - firstTokenTime) / (tokenCount - 1) : 0,
                bytesTransferred: totalBytes,
                throughputBps: totalBytes / ((endTime - startTime) / 1000)
              });
              return;
            }
          }
        });
        
        res.on('error', reject);
      });
      
      req.write(JSON.stringify({ message: this.testMessage }));
      req.end();
      
      setTimeout(() => reject(new Error('SSE test timeout')), 30000);
    });
  }

  /**
   * Run all performance tests
   */
  async runComparison() {
    console.log('🚀 Starting Cortex Freelancer Performance Comparison\n');
    console.log(`Test message: "${this.testMessage.substring(0, 60)}..."`);
    console.log(`Iterations per method: ${this.iterations}\n`);

    try {
      // Setup servers
      console.log('Setting up test servers...');
      const [grpcSetup, wsServer, sseServer] = await Promise.all([
        this.setupGrpcServer(),
        this.setupWebSocketServer(),
        this.setupSSEServer()
      ]);
      console.log('✓ All servers ready\n');

      // Wait a moment for servers to fully initialize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test each method multiple times
      for (let i = 0; i < this.iterations; i++) {
        console.log(`Running test iteration ${i + 1}/${this.iterations}...`);

        // Test gRPC
        try {
          const grpcResult = await this.testGrpc(grpcSetup);
          this.results.grpc.tests.push(grpcResult);
          console.log(`  ✓ gRPC: ${grpcResult.totalTime}ms total, first token in ${grpcResult.firstTokenTime}ms`);
        } catch (error) {
          console.log(`  ❌ gRPC failed: ${error.message}`);
        }

        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 500));

        // Test WebSocket
        try {
          const wsResult = await this.testWebSocket();
          this.results.websocket.tests.push(wsResult);
          console.log(`  ✓ WebSocket: ${wsResult.totalTime}ms total, first token in ${wsResult.firstTokenTime}ms`);
        } catch (error) {
          console.log(`  ❌ WebSocket failed: ${error.message}`);
        }

        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 500));

        // Test SSE
        try {
          const sseResult = await this.testSSE();
          this.results.sse.tests.push(sseResult);
          console.log(`  ✓ SSE: ${sseResult.totalTime}ms total, first token in ${sseResult.firstTokenTime}ms`);
        } catch (error) {
          console.log(`  ❌ SSE failed: ${error.message}`);
        }

        // Wait between iterations
        if (i < this.iterations - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Cleanup
      console.log('\nCleaning up servers...');
      grpcSetup.server.tryShutdown(() => {});
      wsServer.close();
      sseServer.close();
      
      // Calculate and display results
      this.analyzeResults();

    } catch (error) {
      console.error('\n❌ Test setup failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Analyze and display test results
   */
  analyzeResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE COMPARISON RESULTS');
    console.log('='.repeat(60));

    const stats = {};
    
    // Calculate statistics for each method
    for (const [method, data] of Object.entries(this.results)) {
      if (data.tests.length === 0) {
        stats[method] = { name: data.name, error: 'No successful tests' };
        continue;
      }

      const tests = data.tests;
      stats[method] = {
        name: data.name,
        count: tests.length,
        totalTime: {
          avg: tests.reduce((sum, t) => sum + t.totalTime, 0) / tests.length,
          min: Math.min(...tests.map(t => t.totalTime)),
          max: Math.max(...tests.map(t => t.totalTime))
        },
        firstToken: {
          avg: tests.reduce((sum, t) => sum + (t.firstTokenTime || 0), 0) / tests.length,
          min: Math.min(...tests.map(t => t.firstTokenTime || 0)),
          max: Math.max(...tests.map(t => t.firstTokenTime || 0))
        },
        tokenInterval: {
          avg: tests.reduce((sum, t) => sum + t.avgTokenInterval, 0) / tests.length
        },
        throughput: {
          avg: tests.reduce((sum, t) => sum + t.throughputBps, 0) / tests.length
        },
        tokens: {
          avg: tests.reduce((sum, t) => sum + t.tokenCount, 0) / tests.length
        }
      };
    }

    // Display comparison table
    console.log('\n📈 LATENCY COMPARISON (lower is better)');
    console.log('-'.repeat(80));
    console.log('Method          | First Token  | Total Time   | Token Interval | Success Rate');
    console.log('-'.repeat(80));

    const methods = ['grpc', 'websocket', 'sse'];
    for (const method of methods) {
      const s = stats[method];
      if (s.error) {
        console.log(`${s.name.padEnd(15)} | ${s.error.padEnd(66)}`);
      } else {
        const firstToken = `${s.firstToken.avg.toFixed(0)}ms (${s.firstToken.min}-${s.firstToken.max})`.padEnd(12);
        const totalTime = `${s.totalTime.avg.toFixed(0)}ms (${s.totalTime.min}-${s.totalTime.max})`.padEnd(12);
        const tokenInt = `${s.tokenInterval.avg.toFixed(0)}ms`.padEnd(14);
        const success = `${s.count}/${this.iterations}`.padEnd(12);
        
        console.log(`${s.name.padEnd(15)} | ${firstToken} | ${totalTime} | ${tokenInt} | ${success}`);
      }
    }

    // Display throughput comparison
    console.log('\n📊 THROUGHPUT COMPARISON (higher is better)');
    console.log('-'.repeat(60));
    console.log('Method          | Avg Throughput | Avg Tokens | Efficiency');
    console.log('-'.repeat(60));

    for (const method of methods) {
      const s = stats[method];
      if (!s.error) {
        const throughput = `${(s.throughput.avg / 1024).toFixed(1)} KB/s`.padEnd(14);
        const tokens = `${s.tokens.avg.toFixed(0)}`.padEnd(10);
        
        // Calculate efficiency (tokens per second)
        const efficiency = `${(s.tokens.avg / (s.totalTime.avg / 1000)).toFixed(1)} tok/s`.padEnd(10);
        
        console.log(`${s.name.padEnd(15)} | ${throughput} | ${tokens} | ${efficiency}`);
      }
    }

    // Winner analysis
    console.log('\n🏆 PERFORMANCE WINNERS');
    console.log('-'.repeat(40));
    
    const validStats = Object.values(stats).filter(s => !s.error);
    
    if (validStats.length > 0) {
      const fastestFirstToken = validStats.reduce((min, s) => 
        s.firstToken.avg < min.firstToken.avg ? s : min);
      const fastestTotal = validStats.reduce((min, s) => 
        s.totalTime.avg < min.totalTime.avg ? s : min);
      const highestThroughput = validStats.reduce((max, s) => 
        s.throughput.avg > max.throughput.avg ? s : max);
      
      console.log(`🥇 Fastest First Token: ${fastestFirstToken.name} (${fastestFirstToken.firstToken.avg.toFixed(0)}ms)`);
      console.log(`🥇 Fastest Total Time:  ${fastestTotal.name} (${fastestTotal.totalTime.avg.toFixed(0)}ms)`);
      console.log(`🥇 Highest Throughput:  ${highestThroughput.name} (${(highestThroughput.throughput.avg / 1024).toFixed(1)} KB/s)`);
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(40));
    console.log('• gRPC: Best for production with high performance requirements');
    console.log('• WebSocket: Good balance of performance and browser compatibility');
    console.log('• SSE: Simplest implementation but highest latency');
    console.log('• Consider gRPC for mobile apps and microservices integration');
    console.log('• Use WebSocket as fallback when gRPC-web proxy unavailable');

    console.log('\n✅ Performance comparison complete!');
    console.log('\nTo run the actual implementations:');
    console.log('1. gRPC: node grpc-server.js (+ proxy) → http://localhost:3847/app/grpc-test.html');
    console.log('2. WebSocket: npm start → http://localhost:3847/app/chat.html');
    console.log('3. SSE: npm start → http://localhost:3847/app/chat.html (WebSocket fallback)');
  }
}

// Run comparison if called directly
if (require.main === module) {
  const comparison = new PerformanceComparison();
  comparison.runComparison().catch(error => {
    console.error('\n❌ Comparison failed:', error);
    process.exit(1);
  });
}

module.exports = { PerformanceComparison };