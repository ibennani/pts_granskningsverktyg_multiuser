# Installationsguide - Granskningsverktyget

**Version:** 1.0  
**Datum:** 2025-01-27

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
- **NPM**: Version 8.0.0 eller senare (följer med Node.js)
- **Webbläsare**: 
  - Chrome 90+ (rekommenderat)
  - Firefox 88+
  - Edge 90+
  - Safari 14+ (macOS)
- **Operativsystem**:
  - Windows 10/11
  - macOS 10.15+
  - Linux (Ubuntu 20.04+, CentOS 8+)

### Rekommenderade specifikationer

- **RAM**: Minst 4 GB (8 GB rekommenderat)
- **Diskutrymme**: Minst 500 MB för utveckling
- **Internetanslutning**: För att ladda ner beroenden

### Utvecklingsmiljö

- **Kodredigerare**: VS Code (rekommenderat), WebStorm, eller liknande
- **Git**: Version 2.30+ för versionshantering
- **HTTP-server**: Inbyggd i Vite (utveckling) eller extern server (produktion)

## 2. Installation för utveckling

### Steg 1: Förberedelser

1. **Kontrollera Node.js-version**
   ```bash
   node --version
   npm --version
   ```
   
   Om versionen är för låg, ladda ner och installera senaste LTS-versionen från [nodejs.org](https://nodejs.org/).

2. **Kontrollera Git** (valfritt för utveckling)
   ```bash
   git --version
   ```

### Steg 2: Ladda ner projektet

**Alternativ A: Klona från Git**
```bash
git clone <repository-url>
cd granskningsverktyget
```

**Alternativ B: Ladda ner ZIP**
1. Ladda ner projektet som ZIP-fil
2. Extrahera till önskad mapp
3. Öppna terminal/kommandorad i projektmappen

### Steg 3: Installera beroenden

```bash
# Navigera till projektmappen
cd granskningsverktyget

# Installera alla beroenden
npm install
```

**Förväntad utdata:**
```
added 1234 packages, and audited 1234 packages in 45s
found 0 vulnerabilities
```

### Steg 4: Verifiera installation

```bash
# Kontrollera att alla kommandon fungerar
npm run lint
npm run format:check
npm run validate:imports
npm run validate:components
npm run validate:css
```

### Steg 5: Starta utvecklingsserver

```bash
# Starta utvecklingsserver
npm run dev
```

**Förväntad utdata:**
```
  VITE v7.1.7  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Steg 6: Öppna i webbläsare

1. Öppna webbläsare
2. Navigera till `http://localhost:5173`
3. Verifiera att applikationen laddas korrekt

## 3. Installation för produktion

### Steg 1: Bygg applikationen

```bash
# Bygg för produktion
npm run build
```

**Förväntad utdata:**
```
✓ built in 2.34s
✓ 45 modules transformed.
✓ 1234 assets generated.
```

### Steg 2: Välj webbserver

**Alternativ A: Enkel HTTP-server (rekommenderat för test)**

```bash
# Installera globalt
npm install -g http-server

# Starta server
http-server dist -p 8080
```

**Alternativ B: Nginx**

1. Kopiera innehållet i `dist/` till webbserverns root-mapp
2. Konfigurera Nginx för att servera statiska filer
3. Aktivera gzip-komprimering för bättre prestanda

**Alternativ C: Apache**

1. Kopiera innehållet i `dist/` till webbserverns root-mapp
2. Konfigurera Apache för att servera statiska filer
3. Aktivera mod_rewrite för SPA-routing

### Steg 3: Konfigurera webbserver

**Nginx-konfiguration (exempel):**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    # Hantera SPA-routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip-komprimering
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

**Apache-konfiguration (exempel):**
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /path/to/dist
    
    # Hantera SPA-routing
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</VirtualHost>
```

## 4. Konfiguration

### Miljövariabler

Skapa en `.env`-fil i projektets root-mapp:

```bash
# Utveckling
NODE_ENV=development
VITE_APP_TITLE=Granskningsverktyget
VITE_APP_VERSION=2.1.0

# Produktion
NODE_ENV=production
VITE_APP_TITLE=Granskningsverktyget
VITE_APP_VERSION=2.1.0
```

### Byggkonfiguration

**Vite-konfiguration** (`vite.config.mjs`):
```javascript
export default {
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser'
  },
  server: {
    port: 5173,
    strictPort: true
  }
}
```

**Playwright-konfiguration** (`playwright.config.js`):
```javascript
export default {
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173'
  }
}
```

## 5. Verifiering av installation

### Utvecklingsmiljö

1. **Kontrollera att servern startar**
   ```bash
   npm run dev
   # Kontrollera att inga fel visas
   ```

2. **Kontrollera att applikationen laddas**
   - Öppna `http://localhost:5173`
   - Verifiera att startvyn visas
   - Kontrollera att inga konsolfel finns

3. **Kör tester**
   ```bash
   npm run test:e2e
   # Alla tester ska passera
   ```

### Produktionsmiljö

1. **Kontrollera byggprocessen**
   ```bash
   npm run build
   # Inga fel ska visas
   ```

2. **Kontrollera att filer genereras**
   ```bash
   ls -la dist/
   # Kontrollera att alla filer finns
   ```

3. **Testa produktionsbuild**
   ```bash
   npm run preview
   # Öppna http://localhost:4173
   ```

## 6. Felsökning

### Vanliga problem

**Problem: Node.js-version för låg**
```
Error: Node.js version 18.0.0 or higher is required
```
**Lösning:** Uppdatera Node.js till senaste LTS-version.

**Problem: NPM-installation misslyckas**
```
npm ERR! network timeout
```
**Lösning:** 
```bash
npm cache clean --force
npm install --registry https://registry.npmjs.org/
```

**Problem: Port redan används**
```
Error: Port 5173 is already in use
```
**Lösning:** 
```bash
# Använd annan port
npm run dev -- --port 5174

# Eller döda processen som använder porten
lsof -ti:5173 | xargs kill -9
```

**Problem: Moduler laddas inte**
```
Failed to resolve module specifier
```
**Lösning:** Kontrollera att du använder en HTTP-server, inte `file://`-protokollet.

**Problem: Tester misslyckas**
```
Error: Cannot find module
```
**Lösning:** 
```bash
npm install
npm run test:e2e
```

### Debugging

**Aktivera debug-läge:**
```bash
# Playwright debug
PWDEBUG=1 npm run test:e2e:debug

# Vite debug
npm run dev -- --debug
```

**Kontrollera loggar:**
```bash
# NPM-loggar
npm run dev 2>&1 | tee dev.log

# Byggloggar
npm run build 2>&1 | tee build.log
```

## 7. Uppdateringar

### Uppdatera beroenden

```bash
# Kontrollera utdaterade paket
npm outdated

# Uppdatera alla paket
npm update

# Uppdatera specifika paket
npm install package-name@latest
```

### Uppdatera projektet

```bash
# Hämta senaste ändringar
git pull origin main

# Installera nya beroenden
npm install

# Bygg om projektet
npm run build
```

### Versionshantering

**Kontrollera versioner:**
```bash
# Node.js
node --version

# NPM
npm --version

# Projektversion
npm run version
```

**Uppdatera Node.js:**
1. Ladda ner senaste LTS-version från [nodejs.org](https://nodejs.org/)
2. Installera enligt instruktioner för ditt operativsystem
3. Verifiera installation: `node --version`

## Ytterligare resurser

- [Node.js dokumentation](https://nodejs.org/docs/)
- [NPM dokumentation](https://docs.npmjs.com/)
- [Vite dokumentation](https://vitejs.dev/guide/)
- [Playwright dokumentation](https://playwright.dev/docs/intro)

---

**Support:** För ytterligare hjälp, se [README.md](../README.md) eller skapa en issue i repository.
