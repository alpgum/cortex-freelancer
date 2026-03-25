#!/usr/bin/env node
/**
 * Portfolio Optimizer - OpenClaw Skill Module
 * 
 * Integrates the Portfolio Showcase Optimization System with OpenClaw
 * Provides simple JavaScript interface for skill usage
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');

const execAsync = util.promisify(exec);

class PortfolioOptimizerSkill {
  constructor() {
    this.toolPath = path.join(__dirname, 'index.ts');
    this.dataDir = path.join(process.cwd(), 'data');
    this.portfoliosDir = path.join(this.dataDir, 'portfolios');
    this.analyticsDir = path.join(this.dataDir, 'analytics');
    this.testsDir = path.join(this.dataDir, 'ab-tests');
    
    // Ensure data directories exist
    this.ensureDirectories();
  }

  /**
   * Analyze a portfolio and get optimization suggestions
   * @param {string} portfolioId - Portfolio ID to analyze
   * @param {string} format - Output format ('json' or 'text')
   * @returns {Promise<Object|string>} Analysis results
   */
  async analyzePortfolio(portfolioId, format = 'json') {
    try {
      const { stdout } = await this.runCommand(['analyze', portfolioId, '--format', format]);
      
      if (format === 'json') {
        return JSON.parse(stdout);
      }
      return stdout;
    } catch (error) {
      throw new Error(`Portfolio analysis failed: ${error.message}`);
    }
  }

  /**
   * Generate case study showcases for projects
   * @param {string} portfolioId - Portfolio ID
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated showcases
   */
  async generateShowcase(portfolioId, options = {}) {
    const args = ['generate-showcase', portfolioId];
    
    if (options.projectId) {
      args.push('--project', options.projectId);
    }
    
    if (options.template) {
      args.push('--template', options.template);
    }

    try {
      const { stdout } = await this.runCommand(args);
      return { success: true, showcase: stdout.trim() };
    } catch (error) {
      throw new Error(`Showcase generation failed: ${error.message}`);
    }
  }

  /**
   * Optimize portfolio for SEO
   * @param {string} portfolioId - Portfolio ID
   * @param {Array<string>} keywords - Target keywords
   * @returns {Promise<Object>} SEO optimization results
   */
  async optimizeSEO(portfolioId, keywords = []) {
    const args = ['optimize-seo', portfolioId];
    
    if (keywords.length > 0) {
      args.push('--keywords', keywords.join(','));
    }

    try {
      const { stdout } = await this.runCommand(args);
      return { 
        success: true, 
        report: stdout.trim(),
        optimizedPortfolioId: keywords.length > 0 ? `${portfolioId}_seo_optimized` : null
      };
    } catch (error) {
      throw new Error(`SEO optimization failed: ${error.message}`);
    }
  }

  /**
   * Format portfolio for specific platform
   * @param {string} portfolioId - Portfolio ID
   * @param {string} platform - Target platform (upwork, fiverr, linkedin, etc.)
   * @returns {Promise<Object>} Formatted portfolio result
   */
  async formatForPlatform(portfolioId, platform) {
    try {
      const { stdout } = await this.runCommand(['format-platform', portfolioId, platform]);
      return { 
        success: true, 
        message: stdout.trim(),
        formattedPortfolioId: `${portfolioId}_${platform}`
      };
    } catch (error) {
      throw new Error(`Platform formatting failed: ${error.message}`);
    }
  }

  /**
   * Track portfolio view
   * @param {string} portfolioId - Portfolio ID
   * @param {string} projectId - Project ID
   * @param {string} platform - Platform name
   * @returns {Promise<Object>} Tracking result
   */
  async trackView(portfolioId, projectId, platform) {
    try {
      const { stdout } = await this.runCommand(['track-view', portfolioId, projectId, platform]);
      return { success: true, message: stdout.trim() };
    } catch (error) {
      throw new Error(`View tracking failed: ${error.message}`);
    }
  }

  /**
   * Track portfolio conversion
   * @param {string} portfolioId - Portfolio ID
   * @param {string} projectId - Project ID
   * @param {string} platform - Platform name
   * @returns {Promise<Object>} Tracking result
   */
  async trackConversion(portfolioId, projectId, platform) {
    try {
      const { stdout } = await this.runCommand(['track-conversion', portfolioId, projectId, platform]);
      return { success: true, message: stdout.trim() };
    } catch (error) {
      throw new Error(`Conversion tracking failed: ${error.message}`);
    }
  }

  /**
   * Generate analytics report
   * @param {string} portfolioId - Portfolio ID
   * @param {string} format - Output format ('json' or 'text')
   * @returns {Promise<Object>} Analytics report
   */
  async getAnalyticsReport(portfolioId, format = 'json') {
    try {
      const { stdout } = await this.runCommand(['analytics-report', portfolioId, '--format', format]);
      
      if (format === 'json') {
        return JSON.parse(stdout);
      }
      return { success: true, report: stdout.trim() };
    } catch (error) {
      throw new Error(`Analytics report generation failed: ${error.message}`);
    }
  }

  /**
   * Create A/B test
   * @param {string} portfolioId - Portfolio ID
   * @param {string} testName - Test name
   * @param {Array} variantAChanges - Variant A changes
   * @param {Array} variantBChanges - Variant B changes
   * @returns {Promise<Object>} Test creation result
   */
  async createABTest(portfolioId, testName, variantAChanges, variantBChanges) {
    const args = [
      'create-test', 
      portfolioId, 
      testName,
      '--variant-a', JSON.stringify(variantAChanges),
      '--variant-b', JSON.stringify(variantBChanges)
    ];

    try {
      const { stdout } = await this.runCommand(args);
      const match = stdout.match(/A\/B test created with ID: ([^\s]+)/);
      const testId = match ? match[1] : null;
      
      return { 
        success: true, 
        testId,
        message: stdout.trim() 
      };
    } catch (error) {
      throw new Error(`A/B test creation failed: ${error.message}`);
    }
  }

  /**
   * Get A/B test results
   * @param {string} testId - Test ID
   * @returns {Promise<Object>} Test results
   */
  async getTestResults(testId) {
    try {
      const { stdout } = await this.runCommand(['test-results', testId]);
      return { success: true, results: stdout.trim() };
    } catch (error) {
      throw new Error(`Test results retrieval failed: ${error.message}`);
    }
  }

  /**
   * Create sample portfolio for testing
   * @param {string} portfolioName - Portfolio name
   * @returns {Promise<Object>} Sample creation result
   */
  async createSamplePortfolio(portfolioName) {
    try {
      const { stdout } = await this.runCommand(['create-sample', portfolioName]);
      const match = stdout.match(/Sample portfolio created with ID: ([^\s]+)/);
      const portfolioId = match ? match[1] : null;
      
      return { 
        success: true, 
        portfolioId,
        message: stdout.trim() 
      };
    } catch (error) {
      throw new Error(`Sample portfolio creation failed: ${error.message}`);
    }
  }

  /**
   * Get portfolio data
   * @param {string} portfolioId - Portfolio ID
   * @returns {Promise<Object>} Portfolio data
   */
  async getPortfolio(portfolioId) {
    const portfolioPath = path.join(this.portfoliosDir, `${portfolioId}.json`);
    
    if (!fs.existsSync(portfolioPath)) {
      throw new Error(`Portfolio not found: ${portfolioId}`);
    }
    
    try {
      const data = fs.readFileSync(portfolioPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to read portfolio: ${error.message}`);
    }
  }

  /**
   * List all available portfolios
   * @returns {Promise<Array>} List of portfolio IDs
   */
  async listPortfolios() {
    if (!fs.existsSync(this.portfoliosDir)) {
      return [];
    }
    
    try {
      const files = fs.readdirSync(this.portfoliosDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      throw new Error(`Failed to list portfolios: ${error.message}`);
    }
  }

  /**
   * Get comprehensive portfolio insights
   * @param {string} portfolioId - Portfolio ID
   * @returns {Promise<Object>} Complete portfolio analysis
   */
  async getPortfolioInsights(portfolioId) {
    try {
      const [portfolio, analysis, analytics] = await Promise.all([
        this.getPortfolio(portfolioId),
        this.analyzePortfolio(portfolioId, 'json'),
        this.getAnalyticsReport(portfolioId, 'json').catch(() => null) // Analytics might not exist
      ]);

      return {
        portfolio,
        analysis,
        analytics: analytics || { message: 'No analytics data available' },
        insights: {
          projectCount: portfolio.projects.length,
          totalViews: portfolio.metadata.totalViews,
          conversionRate: portfolio.metadata.conversionRate,
          platforms: portfolio.metadata.platforms,
          lastUpdated: portfolio.metadata.lastUpdated
        }
      };
    } catch (error) {
      throw new Error(`Failed to get portfolio insights: ${error.message}`);
    }
  }

  /**
   * Batch optimize multiple portfolios
   * @param {Array<string>} portfolioIds - Array of portfolio IDs
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Batch optimization results
   */
  async batchOptimize(portfolioIds, options = {}) {
    const results = {};
    
    for (const portfolioId of portfolioIds) {
      try {
        const analysis = await this.analyzePortfolio(portfolioId, 'json');
        
        if (options.seo && options.keywords) {
          await this.optimizeSEO(portfolioId, options.keywords);
        }
        
        if (options.platforms) {
          for (const platform of options.platforms) {
            await this.formatForPlatform(portfolioId, platform);
          }
        }
        
        results[portfolioId] = { success: true, analysis };
      } catch (error) {
        results[portfolioId] = { success: false, error: error.message };
      }
    }
    
    return results;
  }

  /**
   * Run CLI command
   * @private
   */
  async runCommand(args) {
    const command = `npx ts-node ${this.toolPath} ${args.join(' ')}`;
    return await execAsync(command, { cwd: __dirname });
  }

  /**
   * Ensure required directories exist
   * @private
   */
  ensureDirectories() {
    const dirs = [this.dataDir, this.portfoliosDir, this.analyticsDir, this.testsDir];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
}

// Export for OpenClaw skill usage
module.exports = {
  PortfolioOptimizerSkill,
  
  // Convenience functions for direct skill usage
  analyze: async (portfolioId, format = 'json') => {
    const optimizer = new PortfolioOptimizerSkill();
    return await optimizer.analyzePortfolio(portfolioId, format);
  },
  
  generateShowcase: async (portfolioId, options = {}) => {
    const optimizer = new PortfolioOptimizerSkill();
    return await optimizer.generateShowcase(portfolioId, options);
  },
  
  optimizeSEO: async (portfolioId, keywords = []) => {
    const optimizer = new PortfolioOptimizerSkill();
    return await optimizer.optimizeSEO(portfolioId, keywords);
  },
  
  formatForPlatform: async (portfolioId, platform) => {
    const optimizer = new PortfolioOptimizerSkill();
    return await optimizer.formatForPlatform(portfolioId, platform);
  },
  
  trackView: async (portfolioId, projectId, platform) => {
    const optimizer = new PortfolioOptimizerSkill();
    return await optimizer.trackView(portfolioId, projectId, platform);
  },
  
  trackConversion: async (portfolioId, projectId, platform) => {
    const optimizer = new PortfolioOptimizerSkill();
    return await optimizer.trackConversion(portfolioId, projectId, platform);
  },
  
  getInsights: async (portfolioId) => {
    const optimizer = new PortfolioOptimizerSkill();
    return await optimizer.getPortfolioInsights(portfolioId);
  },
  
  createSample: async (portfolioName) => {
    const optimizer = new PortfolioOptimizerSkill();
    return await optimizer.createSamplePortfolio(portfolioName);
  }
};

// CLI execution if run directly
if (require.main === module) {
  const skill = new PortfolioOptimizerSkill();
  
  // Simple CLI interface
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  switch (command) {
    case 'analyze':
      if (!args[0]) {
        console.error('Usage: node skill.js analyze <portfolio-id> [format]');
        process.exit(1);
      }
      skill.analyzePortfolio(args[0], args[1] || 'text')
        .then(result => console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result))
        .catch(error => console.error('Error:', error.message));
      break;
      
    case 'create-sample':
      skill.createSamplePortfolio(args[0] || 'Sample Portfolio')
        .then(result => console.log(JSON.stringify(result, null, 2)))
        .catch(error => console.error('Error:', error.message));
      break;
      
    case 'list':
      skill.listPortfolios()
        .then(portfolios => {
          console.log('Available portfolios:');
          portfolios.forEach(id => console.log(`- ${id}`));
        })
        .catch(error => console.error('Error:', error.message));
      break;
      
    case 'insights':
      if (!args[0]) {
        console.error('Usage: node skill.js insights <portfolio-id>');
        process.exit(1);
      }
      skill.getPortfolioInsights(args[0])
        .then(insights => console.log(JSON.stringify(insights, null, 2)))
        .catch(error => console.error('Error:', error.message));
      break;
      
    default:
      console.log(`
Portfolio Optimizer Skill

Usage:
  node skill.js analyze <portfolio-id> [format]     - Analyze portfolio
  node skill.js create-sample [name]                - Create sample portfolio
  node skill.js list                                - List all portfolios
  node skill.js insights <portfolio-id>             - Get comprehensive insights

For full CLI functionality, use the TypeScript version:
  npx ts-node index.ts --help
      `);
  }
}