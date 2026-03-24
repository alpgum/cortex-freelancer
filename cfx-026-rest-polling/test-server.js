#!/usr/bin/env node
/**
 * CFX-026: Test Server for REST Polling API
 * 
 * Standalone test server to validate the REST polling implementation.
 * Includes mock responses and test scenarios.
 */

const path = require('path');
const RestPollingServer = require('./server');
const QueueManager = require('./queue-manager');
const RateLimiter = require('./rate-limiter');

// Mock processor for testing (no external dependencies)
class MockProcessor {
  constructor() {
    this.responses = [
      "Based on your profile, I recommend setting your hourly rate to $85-95. Here's why:\n\n• Your experience level suggests mid-senior pricing\n• Market rates in your area support this range\n• This positions you competitively while maximizing revenue",
      
      "Here are 3 key strategies to improve your proposal win rate:\n\n1. **Personalize every proposal** - Reference specific client needs\n2. **Lead with value** - Start with how you'll solve their problem\n3. **Include relevant samples** - Show work similar to their project",
      
      "I've analyzed this job posting and here are the red flags to watch for:\n\n🚩 Unusually low budget for scope\n🚩 Vague requirements and deliverables\n🚩 Rush timeline without clear milestones\n\nRecommend: Request clarification before proposing",
      
      "Your portfolio needs these improvements:\n\n• Add 2-3 case studies with metrics\n• Include client testimonials\n• Organize by service type, not chronology\n• Add a clear value proposition statement",
      
      "Tax planning recommendations for freelancers:\n\n• Set aside 25-30% for taxes quarterly\n• Track ALL business expenses\n• Consider SEP-IRA for retirement savings\n• Consult a tax professional for deductions"
    ];
  }

  async processRequest(request) {
    // Simulate processing time
    const processingTime = 2000 + Math.random() * 3000;
    await this.sleep(processingTime);
    
    // Select a response based on message content
    let response;
    const message = request.message.toLowerCase();
    
    if (message.includes('rate') || message.includes('price')) {
      response = this.responses[0];
    } else if (message.includes('proposal')) {
      response = this.responses[1];
    } else if (message.includes('red flag') || message.includes('job')) {
      response = this.responses[2];
    } else if (message.includes('portfolio')) {
      response = this.responses[3];
    } else if (message.includes('tax')) {
      response = this.responses[4];
    } else {
      response = this.responses[Math.floor(Math.random() * this.responses.length)];
    }

    return {
      result: response,
      meta: {
        model: 'mock-cortex-v1',
        processingTimeMs: processingTime,
        messageLength: request.message.length
      }
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Test server with mock processor
 */
class TestServer extends RestPollingServer {
  initializeProcessor(options) {
    return new MockProcessor();
  }
}

// Configuration
const config = {
  port: process.env.PORT || 3026,
  rateLimit: {
    windowMs: 5 * 60 * 1000,
    maxRequests: 50 // More generous for testing
  },
  queue: {
    maxSize: 20,
    requestTTL: 5 * 60 * 1000,
    completedTTL: 2 * 60 * 1000
  }
};

// Create and start server
const server = new TestServer(config);

// Add test endpoints
server.app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-client.html'));
});

server.app.get('/test/stress', async (req, res) => {
  const requests = parseInt(req.query.requests) || 10;
  const concurrent = parseInt(req.query.concurrent) || 3;
  
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Transfer-Encoding': 'chunked'
  });
  
  res.write(`Starting stress test: ${requests} requests, ${concurrent} concurrent\\n\\n`);
  
  try {
    await runStressTest(requests, concurrent, (msg) => {
      res.write(msg + '\\n');
    });
    res.write('\\n✅ Stress test completed successfully!\\n');
  } catch (error) {
    res.write(`\\n❌ Stress test failed: ${error.message}\\n`);
  }
  
  res.end();
});

async function runStressTest(totalRequests, concurrentRequests, logFn) {
  const messages = [
    "What should my hourly rate be?",
    "How do I write better proposals?",
    "Is this job posting a red flag?",
    "Review my portfolio please",
    "Help with tax planning",
    "Client wants to renegotiate. Advice?",
    "How do I handle scope creep?",
    "Best practices for invoicing?",
    "Should I raise my rates?",
    "How to find better clients?"
  ];

  let completed = 0;
  let errors = 0;
  const startTime = Date.now();

  async function sendRequest(index) {
    const message = messages[index % messages.length];
    const reqStart = Date.now();
    
    try {
      // Submit request
      const submitResponse = await fetch(`http://localhost:${config.port}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[Test ${index + 1}] ${message}`,
          sessionId: `stress-test-${index}`
        })
      });
      
      if (!submitResponse.ok) {
        throw new Error(`Submit failed: ${submitResponse.status}`);
      }
      
      const { requestId } = await submitResponse.json();
      
      // Poll for completion
      while (true) {
        const statusResponse = await fetch(`http://localhost:${config.port}/api/chat/${requestId}`);
        const status = await statusResponse.json();
        
        if (status.status === 'complete') {
          const resultResponse = await fetch(`http://localhost:${config.port}/api/chat/${requestId}/result`);
          const result = await resultResponse.json();
          
          const duration = Date.now() - reqStart;
          logFn(`✅ Request ${index + 1}: ${duration}ms - ${result.result.length} chars`);
          completed++;
          break;
        } else if (status.status === 'error') {
          throw new Error(status.error);
        }
        
        await new Promise(resolve => setTimeout(resolve, status.pollInterval || 1000));
      }
    } catch (error) {
      const duration = Date.now() - reqStart;
      logFn(`❌ Request ${index + 1}: ${duration}ms - ${error.message}`);
      errors++;
    }
  }

  // Run requests in batches
  for (let i = 0; i < totalRequests; i += concurrentRequests) {
    const batch = [];
    for (let j = 0; j < concurrentRequests && i + j < totalRequests; j++) {
      batch.push(sendRequest(i + j));
    }
    
    await Promise.all(batch);
    logFn(`Batch ${Math.floor(i / concurrentRequests) + 1} completed`);
  }

  const totalTime = Date.now() - startTime;
  logFn(`\\nResults: ${completed} completed, ${errors} errors in ${totalTime}ms`);
  logFn(`Average: ${Math.round(totalTime / totalRequests)}ms per request`);
}

// Start server
server.listen();

console.log('\\n🚀 REST Polling Test Server Started');
console.log(`📊 Test Interface: http://localhost:${config.port}/test`);
console.log(`🔥 Stress Test: http://localhost:${config.port}/test/stress?requests=10&concurrent=3`);
console.log(`📈 Metrics: http://localhost:${config.port}/metrics`);
console.log(`❤️  Health Check: http://localhost:${config.port}/health\\n`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n👋 Test server shutting down...');
  process.exit(0);
});