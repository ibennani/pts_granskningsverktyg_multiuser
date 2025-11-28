export default {
  // Testmiljö som simulerar en webbläsare (DOM)
  testEnvironment: 'jsdom',
  
  // Filer som körs innan varje testfil (bra för mocks och global setup)
  setupFilesAfterEnv: ['<rootDir>/tests/setup-jest.js'],
  
  // Sökväg till alla enhetstester. 
  // Vi separerar dessa strikt från E2E-tester för att undvika konflikter.
  testMatch: ['<rootDir>/tests/unit/**/*.spec.js'],
  
  // Ignorera E2E-tester explicit om testMatch inte räcker
  testPathIgnorePatterns: ['/node_modules/', '.e2e.spec.js'],

  // Eftersom vi använder "type": "module" i package.json och kör Node med --experimental-vm-modules
  // behöver vi oftast ingen transform för standard JS.
  transform: {},
};
