# Cursor Rules

- Kod får inte orsaka `console.error` i runtime.
- Playwright-testerna `noConsoleErrors` måste passera i Chromium och WebKit.
- Använd modern ES-modulsyntax (`import/export`) i all kod.
- Följ Vite-konventioner och håll fast porten 5173.
- **Byggtext-regel**: När `npm run build` körs ska texten "Byggt YYYY-MM-DD klockan HH:MM" visas diskret och centrerad under den yttersta diven. Texten ska använda svenska datum/tid-format och vara stylad med liten, grå text.
