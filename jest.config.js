export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup-jest.js'],
  moduleNameMapper: {
    '\\.(css)$': '<rootDir>/tests/styleMock.js',
  },
  testMatch: [
    '<rootDir>/tests/unit/**/*.spec.js',
    '<rootDir>/tests/unit/**/*.spec.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '.e2e.spec.js'],
  /** Tillåt transpilering av marked (ESM) så js/utils/markdown.js kan laddas i Jest. */
  transformIgnorePatterns: ['/node_modules/(?!(marked)/)'],
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
          },
          target: 'es2022',
        },
        module: {
          type: 'es6',
        },
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'js/logic/**/*.{js,ts}',
    'js/api/**/*.{js,ts}',
    'js/state/**/*.{js,ts}',
    '!js/**/*.spec.{js,ts}',
  ],
};
