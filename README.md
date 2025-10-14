# Testinstruktioner

Projektet använder nya lint-, enhetstest- och E2E-kommandon som körs mot den befintliga utvecklingsservern (ingen build eller extra server krävs).

## Kommandon

- `npm run lint`
- `npm run format:check`
- `npm test -- --ci`
- `E2E_BASE_URL=http://localhost:5173 npm run e2e:live`

Om din `npm run dev` kör på en annan port än 5173 anger du den i `E2E_BASE_URL`, till exempel:

```bash
E2E_BASE_URL=http://localhost:5174 npm run e2e:live
```

Playwright-konfigurationen (se `playwright.config.js`) använder `process.env.E2E_BASE_URL || 'http://localhost:5173'` som bas-URL och startar ingen egen webserver.
