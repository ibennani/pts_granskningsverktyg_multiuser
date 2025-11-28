export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup-jest.js'],
  testMatch: ['<rootDir>/tests/unit/**/*.spec.js'],
  transform: {},
};
