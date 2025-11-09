/**
 * Jest configuration for Games Gallery tests
 * 
 * Install dependencies:
 *   npm install --save-dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
 */

module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'src/components/GamesGallery.jsx',
    '!**/node_modules/**',
  ],
};

