# Installationsguide – Leffe

**Version:** 1.1  
**Datum:** 2026-03-27

## Innehållsförteckning

1. [Systemkrav](#1-systemkrav)
2. [Installation för utveckling](#2-installation-för-utveckling)
3. [Installation för produktion](#3-installation-för-produktion)
4. [Konfiguration](#4-konfiguration)
5. [Verifiering av installation](#5-verifiering-av-installation)
6. [Felsökning](#6-felsökning)
7. [Uppdateringar](#7-uppdateringar)

## 1. Systemkrav

### Minimi-krav

- **Node.js**: Version 18.0.0 eller senare
- **NPM**: Följer med Node.js
- **Webbläsare**: Chrome 90+, Firefox 88+, Edge 90+, Safari 14+ (macOS)
- **Operativsystem**: Windows 10/11, macOS 10.15+, Linux
- **Docker** (rekommenderas för lokal utveckling): används av `npm run dev` för PostgreSQL m.m.

### Rekommenderade specifikationer

- **RAM**: Minst 4 GB (8 GB rekommenderat)
- **Diskutrymme**: Minst 500 MB för utveckling
- **Internetanslutning**: För npm och eventuell deploy

### Utvecklingsmiljö

- **Kodredigerare**: VS Code eller liknande
- **Git**: För versionshantering
- **HTTP-server**: Vite (utveckling) eller Nginx/annan proxy (produktion)

## 2. Installation för utveckling

### Steg 1: Förberedelser

1. **Kontrollera Node.js-version**
   ```bash
   node --version
   npm --version
   ```

2. **Kontrollera Git** (valfritt)
   ```bash
   git --version
   ```

### Steg 2: Ladda ner projektet

**Alternativ A: Klona från Git**
```bash
git clone <repository-url>
cd <projektmapp>
```

**Alternativ B: ZIP** – extrahera och öppna terminal i projektmappen.

### Steg 3: Installera beroenden

```bash
cd <projektmapp>
npm install
```

### Steg 4: Verifiera installation (minimalt)

```bash
npm run lint
```

(Valfritt) Kör enhetstester: `npm test`.

### Steg 5: Starta utvecklingsmiljö

```bash
npm run dev
```

Detta startar (enligt `package.json`): Docker med `docker compose -p sessionversion`, backend (nodemon, port 3000), Vite (port 5173) med proxy `/v2/api` och `/v2/ws` mot backend, samt hjälpprocesser som kan vara konfigurerade i samma script.

**Endast frontend (utan databas/backend):**
```bash
npm run dev:client
```

WebSocket för realtidssynk går via Vites proxy (`/v2/ws` → backend). För inloggning och serverlagrade granskningar behövs backend och databas.

### Steg 6: Öppna i webbläsare

Navigera till `http://localhost:5173`.

## 3. Installation för produktion

### Steg 1: Bygg applikationen

```bash
npm run build
```

### Steg 2: Webbserver och backend

Produktion beskrivs i `docs/deploy-v2-server-setup.md` och `docs/deploy-v2-workflow.md`: Express-backend, PostgreSQL (Docker), Nginx som reverse proxy mot `/v2/api` och statiska filer under `/v2/`.

## 4. Konfiguration

### Miljövariabler

Skapa `.env` i projektets rot (se även `server/` och deploy-dokumentation). Exempel på variabler som kan förekomma:

```bash
NODE_ENV=development
# Valfritt – titel i bygget om ni läser in den i byggpipeline:
# VITE_APP_TITLE=Leffe
```

Faktiska nycklar för backend (databas, JWT, CORS m.m.) dokumenteras i serverns kod och i `docs/deploy-v2-workflow.md`.

### Byggkonfiguration

- **Vite**: `vite.config.mjs` (bland annat `base: '/v2/'`, dev-proxy mot port 3000)
- **Playwright**: `playwright.config.js` – `E2E_BASE_URL` eller standard `http://localhost:5173`
- **ESLint**: `eslint.config.js`

## 5. Verifiering av installation

### Utvecklingsmiljö

1. `npm run dev` – inga uppenbara fel i terminalen.
2. Öppna `http://localhost:5173` – startvy laddas (efter inloggning om server krävs).
3. `npm run lint` ska gå igenom.
4. E2E (kräver att appen svarar på baseURL):
   ```bash
   npx playwright test
   ```

### Produktionsmiljö

1. `npm run build` utan fel.
2. `ls dist/` – byggda filer finns.
3. `npm run preview` – förhandsgranska på standardport (ofta 4173).

## 6. Felsökning

### Vanliga problem

**Node.js-version för låg** – uppgradera till Node 18+.

**NPM-installation misslyckas** – `npm cache clean --force`, kontrollera nätverk/proxy.

**Port 5173 upptagen** – `npm run dev:client -- --port 5174` eller avsluta process som använder porten.

**Moduler laddas inte** – använd HTTP(S), inte `file://`.

**Tester misslyckas** – `npm install`, säkerställ att dev-server körs för Playwright, kör `npx playwright test` med rätt `E2E_BASE_URL`.

### Debugging

```bash
PWDEBUG=1 npx playwright test
npm run dev -- --debug
```

## 7. Uppdateringar

```bash
git pull
npm install
npm run build
```

---

**Support:** Se [README.md](../README.md) och övriga filer under `docs/`.
