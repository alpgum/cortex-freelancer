/**
 * Integration Example - Cortex Freelancer with Redis Queue
 * CFX-028 - Shows how to integrate the queue system with the main application
 */

const express = require('express');
const { CortexQueueSystem, createClient } = require('./index');

class CortexFreelancerQueueIntegration {
  constructor() {
    this.app = express();
    this.queueSystem = null;
    this.queueClient = null;
    this.port = 3847; // Main Cortex port
  }

  /**
   * Initialize the integration
   */
  async initialize() {
    try {
      console.log('🔄 Initializing Cortex Freelancer with Redis Queue...');
      
      // Start queue system on separate port
      this.queueSystem = new CortexQueueSystem();
      await this.queueSystem.start({ port: 3848 });
      
      // Create queue client for main app
      this.queueClient = createClient({
        baseUrl: 'http://localhost:3848',
        clientId: 'cortex-main-app'
      });
      
      await this.queueClient.initialize();
      
      // Set up main app
      this.setupMainApp();
      
      console.log('✅ Integration initialized successfully');
    } catch (error) {
      console.error('❌ Integration initialization failed:', error);
      throw error;
    }
  }

  /**
   * Set up the main Cortex Freelancer application
   */
  setupMainApp() {
    // Middleware
    this.app.use(express.json());
    this.app.use(express.static('app'));

    // Serve main page
    this.app.get('/', (req, res) => {
      res.sendFile('index.html', { root: '.' });
    });

    // Queue-powered API endpoints
    this.setupQueueEndpoints();

    // Health check including queue status
    this.app.get('/api/health', async (req, res) => {
      try {
        const [queueHealth, queueStats] = await Promise.all([
          this.queueClient.getQueueStats().catch(() => ({ error: 'Queue unavailable' })),
          this.queueSystem.getStatus().catch(() => ({ error: 'Queue system unavailable' }))
        ]);

        res.json({
          status: 'healthy',
          timestamp: Date.now(),
          queue: {
            health: queueHealth,
            system: queueStats
          }
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    });
  }

  /**
   * Set up queue-powered API endpoints
   */
  setupQueueEndpoints() {
    // OpenClaw request via queue
    this.app.post('/api/openclaw/request', async (req, res) => {
      try {
        const { prompt, model, options } = req.body;
        
        if (!prompt) {
          return res.status(400).json({ error: 'Prompt is required' });
        }

        const result = await this.queueClient.submitJob('openclaw_request', {
          prompt,
          model: model || 'claude-3.5-sonnet',
          ...options
        }, {
          priority: 'urgent' // OpenClaw requests are high priority
        });

        res.json({
          success: true,
          result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Freelancer profile analysis
    this.app.post('/api/freelancer/analyze', async (req, res) => {
      try {
        const { profileId, analysisType } = req.body;
        
        const result = await this.queueClient.submitJob('freelancer_analysis', {
          profileId,
          analysisType: analysisType || 'comprehensive'
        });

        res.json({
          success: true,
          analysis: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Proposal generation
    this.app.post('/api/proposal/generate', async (req, res) => {
      try {
        const { jobTitle, jobDescription, budget, requirements } = req.body;
        
        const result = await this.queueClient.submitJob('proposal_generation', {
          jobTitle,
          jobDescription,
          budget,
          requirements
        });

        res.json({
          success: true,
          proposal: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Client communication
    this.app.post('/api/client/communicate', async (req, res) => {
      try {
        const { clientId, messageType, content } = req.body;
        
        const result = await this.queueClient.submitJob('client_communication', {
          clientId,
          messageType,
          content
        });

        res.json({
          success: true,
          communication: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Document processing
    this.app.post('/api/document/process', async (req, res) => {
      try {
        const { documentUrl, documentType } = req.body;
        
        const result = await this.queueClient.submitBackgroundJob('document_processing', {
          documentUrl,
          documentType
        });

        res.json({
          success: true,
          processing: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Queue management endpoints
    this.app.get('/api/queue/status', async (req, res) => {
      try {
        const stats = await this.queueClient.getQueueStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/queue/client-stats', (req, res) => {
      try {
        const clientStats = this.queueClient.getClientStats();
        res.json(clientStats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Start the main application
   */
  async start() {
    await this.initialize();
    
    this.server = this.app.listen(this.port, () => {
      console.log(`🚀 Cortex Freelancer running on port ${this.port}`);
      console.log(`📊 Queue system running on port 3848`);
      console.log(`🌐 Access: http://localhost:${this.port}`);
    });

    this.setupGracefulShutdown();
  }

  /**
   * Set up graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      try {
        // Close main server
        if (this.server) {
          this.server.close();
        }
        
        // Disconnect queue client
        if (this.queueClient) {
          this.queueClient.disconnect();
        }
        
        // Shutdown queue system
        if (this.queueSystem) {
          await this.queueSystem.shutdown();
        }
        
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Frontend integration example
const frontendIntegrationExample = `
// Frontend JavaScript for queue integration
class CortexQueueUI {
  constructor() {
    this.queueClient = new CortexQueueClient({
      baseUrl: window.location.origin,
      clientId: 'cortex-ui-' + Date.now()
    });
    this.initialize();
  }

  async initialize() {
    try {
      await this.queueClient.initialize();
      console.log('✅ Queue client connected');
      this.setupEventListeners();
    } catch (error) {
      console.error('❌ Queue client failed to connect:', error);
    }
  }

  setupEventListeners() {
    // OpenClaw request button
    document.getElementById('openclaw-btn')?.addEventListener('click', async () => {
      const prompt = document.getElementById('prompt-input').value;
      if (!prompt) return;

      this.setLoading(true);
      try {
        const response = await fetch('/api/openclaw/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });
        
        const result = await response.json();
        this.displayResult(result);
      } catch (error) {
        this.showError(error.message);
      } finally {
        this.setLoading(false);
      }
    });

    // Proposal generation
    document.getElementById('generate-proposal-btn')?.addEventListener('click', async () => {
      const jobTitle = document.getElementById('job-title').value;
      const budget = document.getElementById('budget').value;
      
      if (!jobTitle) return;

      try {
        const response = await fetch('/api/proposal/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobTitle, budget: parseInt(budget) })
        });
        
        const result = await response.json();
        this.displayProposal(result.proposal);
      } catch (error) {
        this.showError(error.message);
      }
    });
  }

  setLoading(isLoading) {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = isLoading);
    
    if (isLoading) {
      document.body.classList.add('loading');
    } else {
      document.body.classList.remove('loading');
    }
  }

  displayResult(result) {
    const output = document.getElementById('result-output');
    if (output) {
      output.innerHTML = \`
        <div class="result-card">
          <h3>✅ Job Completed</h3>
          <pre>\${JSON.stringify(result, null, 2)}</pre>
        </div>
      \`;
    }
  }

  displayProposal(proposal) {
    const output = document.getElementById('proposal-output');
    if (output && proposal) {
      output.innerHTML = \`
        <div class="proposal-card">
          <h3>📝 Generated Proposal</h3>
          <div class="proposal-content">\${proposal.proposal || 'Proposal generated successfully'}</div>
          <div class="proposal-sections">
            <strong>Sections:</strong> \${proposal.sections?.join(', ') || 'N/A'}
          </div>
          <div class="proposal-value">
            <strong>Estimated Value:</strong> $\${proposal.estimatedValue || 'TBD'}
          </div>
        </div>
      \`;
    }
  }

  showError(message) {
    const output = document.getElementById('error-output');
    if (output) {
      output.innerHTML = \`
        <div class="error-card">
          <h3>❌ Error</h3>
          <p>\${message}</p>
        </div>
      \`;
    }
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new CortexQueueUI();
});
`;

// CLI usage
if (require.main === module) {
  const integration = new CortexFreelancerQueueIntegration();
  integration.start().catch(console.error);
}

module.exports = { 
  CortexFreelancerQueueIntegration,
  frontendIntegrationExample
};`;

console.log('📝 Frontend integration example available in frontendIntegrationExample export');