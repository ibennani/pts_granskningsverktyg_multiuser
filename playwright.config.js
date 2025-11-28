import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/home.e2e.spec.js'],
  testIgnore: ['**/unit/**'],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
        locale: 'sv-SE',
      },
    },
    {
      name: 'Microsoft Edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
        locale: 'sv-SE',
      },
    },
  ],
  webServer: {
    command: 'npm run dev:fixedport',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
