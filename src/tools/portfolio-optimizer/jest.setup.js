// Jest setup file for portfolio optimizer tests

// Global test setup
beforeAll(() => {
  // Set timezone for consistent date testing
  process.env.TZ = 'UTC';
});

// Clean up after all tests
afterAll(() => {
  // Cleanup any test data directories that might have been created
  const fs = require('fs');
  const path = require('path');
  
  const testDataPaths = [
    path.join(process.cwd(), 'data', 'portfolios'),
    path.join(process.cwd(), 'data', 'analytics'),
    path.join(process.cwd(), 'data', 'ab-tests')
  ];
  
  testDataPaths.forEach(dirPath => {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      files.forEach(file => {
        if (file.startsWith('test-') || file.includes('test')) {
          try {
            fs.unlinkSync(path.join(dirPath, file));
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      });
    }
  });
});

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};