import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  
  // Matchar alla .spec.js filer i testDir (inklusive undermappar som inte ignoreras)
  // Detta fångar upp home.e2e.spec.js, noConsoleErrors.spec.js, etc.
  testMatch: ['*.spec.js', '**/*.e2e.spec.js'],
  
  // Ignorera enhetstester (ligger i unit/) och setup-filer så att Playwright inte försöker köra dem
  testIgnore: ['unit/**', 'setup-jest.js', '**/__mocks__/**'],
  
  projects: [
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
    // Tvinga cmd.exe att köra npm-kommandot för att undvika PowerShell-problem med teckenkodning
    command: 'cmd.exe /c "npm run dev:fixedport"',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
