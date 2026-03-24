#!/usr/bin/env node
/**
 * Cortex Freelancer - Redis Queue System Startup Script
 * CFX-028 - Complete system initialization and demonstration
 */

const { CortexQueueSystem, createClient } = require('./src/redis-queue');
const { CortexFreelancerQueueIntegration } = require('./src/redis-queue/integration-example');

class QueueSystemStarter {
  constructor() {
    this.mode = process.argv[2] || 'integrated';
    this.port = parseInt(process.argv[3]) || 3848;
  }

  async start() {
    console.log('🚀 Starting Cortex Freelancer Redis Queue System');
    console.log('='.repeat(60));
    console.log(`Mode: ${this.mode}`);
    console.log(`Port: ${this.port}`);
    console.log('='.repeat(60));

    try {
      switch (this.mode) {
        case 'standalone':
          await this.startStandalone();
          break;
        case 'integrated':
          await this.startIntegrated();
          break;
        case 'demo':
          await this.runDemo();
          break;
        case 'test':
          await this.runTests();
          break;
        default:
          this.showUsage();
      }
    } catch (error) {
      console.error('❌ Startup failed:', error);
      process.exit(1);
    }
  }

  /**
   * Start standalone queue system
   */
  async startStandalone() {
    console.log('🏗️ Starting standalone queue system...');
    
    const system = new CortexQueueSystem();
    await system.start({ port: this.port });
    
    console.log(`✅ Queue system running on port ${this.port}`);
    console.log(`📊 Health: http://localhost:${this.port}/api/queue/health`);
    console.log(`📈 Stats: http://localhost:${this.port}/api/queue/stats`);
    
    await this.runBasicDemo(system);
  }

  /**
   * Start integrated system (queue + main app)
   */
  async startIntegrated() {
    console.log('🏗️ Starting integrated Cortex Freelancer system...');
    
    const integration = new CortexFreelancerQueueIntegration();
    await integration.start();
    
    console.log('✅ Integrated system running');
    console.log('📱 Main App: http://localhost:3847');
    console.log('⚙️ Queue API: http://localhost:3848');
  }

  /**
   * Run comprehensive demo
   */
  async runDemo() {
    console.log('🎬 Starting comprehensive demo...');
    
    const system = new CortexQueueSystem();
    await system.start({ port: this.port });
    
    await this.runComprehensiveDemo(system);
    
    console.log('Demo complete. Press Ctrl+C to exit.');
  }

  /**
   * Run test suite
   */
  async runTests() {
    console.log('🧪 Running test suite...');
    
    const TestSuite = require('./src/redis-queue/test-suite');
    const testSuite = new TestSuite();
    await testSuite.runAllTests();
  }

  /**
   * Run basic demonstration
   */
  async runBasicDemo(system) {
    console.log('\n🎯 Running basic demonstration...');
    
    // Create client
    const client = createClient({
      baseUrl: `http://localhost:${this.port}`,
      clientId: 'demo-client'
    });
    
    await client.initialize();
    
    try {
      // Demo 1: Basic job submission
      console.log('\n📤 Demo 1: Basic job submission');
      const result1 = await client.submitJob('openclaw_request', {
        prompt: 'Analyze the freelancing market trends',
        model: 'claude-3.5-sonnet'
      });
      console.log('✅ OpenClaw job completed:', result1.response);

      // Demo 2: Priority jobs
      console.log('\n⚡ Demo 2: Priority job submission');
      const urgentResult = await client.submitUrgentJob('urgent_analysis', {
        type: 'client_emergency',
        priority: 'critical'
      });
      console.log('✅ Urgent job completed:', urgentResult);

      // Demo 3: Background job
      console.log('\n🔄 Demo 3: Background job submission');
      const backgroundResult = await client.submitBackgroundJob('data_cleanup', {
        task: 'archive_old_proposals',
        daysOld: 90
      });
      console.log('✅ Background job completed:', backgroundResult);

      // Demo 4: Queue statistics
      console.log('\n📊 Demo 4: Queue statistics');
      const stats = await client.getQueueStats();
      console.log('Queue stats:', JSON.stringify(stats, null, 2));

    } catch (error) {
      console.error('Demo error:', error);
    } finally {
      client.disconnect();
    }
  }

  /**
   * Run comprehensive demonstration
   */
  async runComprehensiveDemo(system) {
    console.log('\n🎬 Comprehensive Demo Starting...');
    
    const client = createClient({
      baseUrl: `http://localhost:${this.port}`,
      clientId: 'comprehensive-demo'
    });
    
    await client.initialize();
    
    try {
      // Scenario 1: Freelancer onboarding
      console.log('\n🎯 Scenario 1: Freelancer Onboarding');
      const profileAnalysis = await client.submitJob('freelancer_analysis', {
        profileId: 'new_freelancer_123',
        analysisType: 'onboarding',
        skills: ['React', 'Node.js', 'MongoDB']
      });
      console.log('✅ Profile analysis:', profileAnalysis);

      // Scenario 2: Proposal generation
      console.log('\n📝 Scenario 2: Proposal Generation');
      const proposal = await client.submitJob('proposal_generation', {
        jobTitle: 'Senior Full-Stack Developer for SaaS Platform',
        jobDescription: 'Build a modern web application with React and Node.js',
        budget: 10000,
        requirements: ['React', 'Node.js', 'AWS', 'PostgreSQL']
      });
      console.log('✅ Proposal generated:', proposal);

      // Scenario 3: Client communication
      console.log('\n💬 Scenario 3: Client Communication');
      const communication = await client.submitJob('client_communication', {
        clientId: 'client_456',
        messageType: 'project_update',
        content: 'Weekly progress report and next steps'
      });
      console.log('✅ Communication sent:', communication);

      // Scenario 4: Batch processing
      console.log('\n📦 Scenario 4: Batch Job Processing');
      const batchJobs = [];
      for (let i = 1; i <= 5; i++) {
        batchJobs.push(
          client.submitJob('document_processing', {
            documentType: 'contract',
            documentId: `contract_${i}`,
            action: 'review'
          })
        );
      }
      
      const batchResults = await Promise.all(batchJobs);
      console.log(`✅ Batch processing complete: ${batchResults.length} documents processed`);

      // Scenario 5: Load test
      console.log('\n🚀 Scenario 5: Load Testing (20 concurrent jobs)');
      const loadJobs = [];
      for (let i = 1; i <= 20; i++) {
        loadJobs.push(
          client.submitJob('load_test', {
            id: i,
            task: 'performance_analysis',
            data: `test_data_${i}`
          })
        );
      }
      
      const startTime = Date.now();
      const loadResults = await Promise.all(loadJobs);
      const endTime = Date.now();
      
      console.log(`✅ Load test complete: ${loadResults.length} jobs in ${endTime - startTime}ms`);
      console.log(`Average: ${Math.round((endTime - startTime) / loadResults.length)}ms per job`);

    } catch (error) {
      console.error('Comprehensive demo error:', error);
    } finally {
      client.disconnect();
    }
  }

  /**
   * Show usage information
   */
  showUsage() {
    console.log(`
Usage: node start-queue-system.js [mode] [port]

Modes:
  standalone   - Start queue system only (default port: 3848)
  integrated   - Start full Cortex + queue system (ports: 3847, 3848)
  demo         - Run comprehensive demonstration
  test         - Run test suite

Examples:
  node start-queue-system.js standalone 3848
  node start-queue-system.js integrated
  node start-queue-system.js demo
  node start-queue-system.js test

Environment Variables:
  REDIS_HOST=localhost
  REDIS_PORT=6379
  QUEUE_WORKER_CONCURRENCY=4

Docker:
  docker compose -f docker/docker-compose-redis.yml up -d
`);
  }
}

// Auto-start if called directly
if (require.main === module) {
  const starter = new QueueSystemStarter();
  starter.start().catch(console.error);
} else {
  module.exports = QueueSystemStarter;
}