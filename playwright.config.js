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
      name: 'Chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
        locale: 'sv-SE',
        extraHTTPHeaders: {
          'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        },
      },
    },
    {
      name: 'WebKit',
      use: {
        ...devices['Desktop Safari'],
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
        locale: 'sv-SE',
        extraHTTPHeaders: {
          'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        },
      },
    },
    {
      name: 'Microsoft Edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
        locale: 'sv-SE',
        // Sätt Accept-Language header till svenska Sverige
        // Detta säkerställer att webbläsaren kommunicerar att den föredrar svenska Sverige
        extraHTTPHeaders: {
          'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        },
        // Anpassa user agent för att ersätta engelsk locale med svensk
        // Edge user agent kan innehålla locale-information som behöver ändras
        userAgent: (() => {
          const baseUA = devices['Desktop Edge'].userAgent || '';
          
          // Ersätt eventuell engelsk locale (en-US, en-GB, en) med sv-SE
          let modifiedUA = baseUA
            .replace(/en-US/gi, 'sv-SE')
            .replace(/en-GB/gi, 'sv-SE')
            .replace(/; en\)/gi, '; sv-SE)')
            .replace(/; en-US\)/gi, '; sv-SE)')
            .replace(/; en-GB\)/gi, '; sv-SE)');
          
          // Om sv-SE inte redan finns i user agent-strängen, lägg till det
          if (!modifiedUA.includes('sv-SE')) {
            // Försök lägga till sv-SE i den sista parentesgruppen
            const lastParenMatch = modifiedUA.match(/(\([^)]+)\)$/);
            if (lastParenMatch) {
              modifiedUA = modifiedUA.replace(/(\([^)]+)\)$/, (m) => {
                return m.replace(')', '; sv-SE)');
              });
            } else {
              // Om inget matchar, lägg till i slutet
              modifiedUA = modifiedUA + ' (sv-SE)';
            }
          }
          
          return modifiedUA;
        })(),
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
