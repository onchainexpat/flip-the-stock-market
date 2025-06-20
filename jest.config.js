module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  setupFilesAfterEnv: [],
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  collectCoverage: false,
  bail: 1,
  maxWorkers: 1,
};
