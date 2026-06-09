# Leffe – digital tillsyn

**Leffe** är webbapplikationen för strukturerad granskning av webbsidor och digitala tjänster enligt regelfiler, med export av resultat i flera format.

## Översikt

Leffe stöder hela kedjan från regelfiler och stickprov till låst granskning och rapport. Gränssnittet är tänkt att vara tillgängligt (WCAG 2.2 AA) och går att använda på svenska eller engelska.

### Huvudfunktioner

- **Regelfilshantering**: Ladda upp och validera JSON-baserade regelfiler (serverlagrat läge)
- **Stickprov**: Definiera och hantera stickprov för granskning
- **Strukturerad granskning**: Bedömning av krav enligt regelfilen
- **Dokumentation**: Observationer och kommentarer
- **Export**: CSV, Excel, Word (krav eller stickprov) och HTML
- **Språk**: Svenska, engelska och norsk bokmål (fler språkfiler kan läggas till i `js/i18n/`)
- **Responsiv layout**: Desktop och mindre skärmar

## Snabbstart

### Förutsättningar

- Node.js 18 eller senare
- Modern webbläsare
- **Docker** (rekommenderas): startar PostgreSQL och stödtjänster när du kör `npm run dev`

### Installation

1. Klona eller kopiera projektmappen och gå in i den.
2. `npm install`
3. `npm run dev` – startar Docker (om tillgängligt), backend på port 3000, Vite på port 5173, valfri ngrok-tunnel och byggstämpel-watcher enligt `package.json`.
4. Öppna `http://localhost:5173` (Vite proxar API under `/v2/api` till backend).

Utan Docker: starta bara frontend med `npm run dev:client` (backend/databas krävs för inloggning och serverlagrade granskningar).

### Produktionsbuild

```bash
npm run build
npm run preview
```

## Projektstruktur

```
├── css/                 # Stilar
├── docs/                # Dokumentation
├── js/                  # Frontend (komponenter, logik, state, export, sync)
├── shared/              # Gemensam klient/server-kod (inga DOM-beroenden)
├── server/              # Express-backend, API, migreringar
├── scripts/             # Deploy, dev-hjälp, healthcheck
├── tests/               # Playwright (E2E) och Jest (enhet)
├── dist/                # Byggd frontend (efter npm run build)
└── index.html
```

## Utveckling

### Vanliga kommandon (från `package.json`)

| Kommando | Beskrivning |
|----------|-------------|
| `npm run dev` | Full lokal miljö: Docker, backend, Vite (port 5173), valfri ngrok |
| `npm run dev:client` | Endast Vite |
| `npm run dev:db` | Startar Postgres via Docker (`-p sessionversion`) |
| `npm run dev:server` | Endast backend (`tsx server/index.js`) |
| `npm run dev:serverdb` | Docker + backend (nodemon via `nodemon.json`) + Vite |
| `npm run check:full` | Lint (JS+TS), typkontroll, tester och build |
| `npm run dev:stop` | Stoppar Docker-containrar (behåller volymer) |
| `npm run build` | Bygger frontend till `dist/` |
| `npm run preview` | Förhandsgranskning av bygge |
| `npm run lint` | ESLint (JavaScript) |
| `npm run lint:ts` | ESLint (TypeScript) |
| `npm run typecheck` | TypeScript utan emit (`tsc --noEmit`) |
| `npm run check` | Lint, importkontroller, TypeScript, Jest |
| `npm test` | Jest-enhetstester |
| `npm run test:e2e:smoke` | Playwright (Chromium) |
| `npm run test:e2e` | Playwright (alla konfigurerade webbläsare) |
| `npm run db:migrate` | Kör databasmigreringar |
| `npm run deploy:v2` | Deploy till konfigurerad server (se `docs/deploy-v2-workflow.md`) |
| `npm run diagnose:v2` | Fjärrdiagnostik av v2-miljön |

E2E-tester körs med Playwright, t.ex. `npx playwright test` (kräver att appen svarar på `E2E_BASE_URL` eller standard `http://localhost:5173`).

### Teknik

- **Vite** (dev port 5173), **Express**-backend, **PostgreSQL**
- **State**: central store i `js/state.js` (implementation i `js/state/index.ts`) med sparning i webbläsaren och synk mot server när backend används
- **Affärslogik**: `audit_logic.ts` och `validation_logic.ts` injiceras via `deps` till vykomponenter (inte `window`)
- **Formulärautospar**: `js/logic/autosave_service.js` (debounce 250 ms, endast `input`)
- **Fältutkast (drafts)**: `js/draft_manager.ts` (localStorage, bl.a. `data-draft-path`) – separat från central state
- **Export**: `js/export_logic.ts` (exponeras som `window.ExportLogic`) – använder npm-paket (t.ex. exceljs, docx), inte CDN
- **Vykomponenter**: registreras i `js/logic/view_components_index.js`; routing via `js/logic/view_render.js` och `js/logic/app_bootstrap.js`

## Dokumentation

Se mappen `docs/`, bland annat:

- [Snabbstart för nybörjare](docs/snabbstart_nyborjare.md)
- [Användarmanual](docs/anvandarmanual.md)
- [Teknisk specifikation](docs/teknisk_specifikation_v2.0.md)
- [Systemdokumentation](docs/systemdokumentation.md)
- [Installationsguide](docs/installationsguide.md)
- [Utvecklarguide](docs/utvecklarguide.md)
- [State och persistens](docs/state_and_persistence.md)
- [API-dokumentation](docs/api-dokumentation.md)
- [Komponentstandard](docs/component_standard.md)
- [Refaktoreringsplan](docs/refactoring-plan.md)
- [Deploy-workflow](docs/deploy-v2-workflow.md)
- [Admin och inloggning](docs/admin_anvandare_och_inloggning.md)

## Internationalisering

Språkfiler ligger i `js/i18n/`. Användaren byter språk i appen; valet sparas lokalt.

## Exportformat

Via `window.ExportLogic`: `export_to_csv`, `export_to_excel`, `export_to_word_criterias`, `export_to_word_samples`, `export_to_html`.

## Konfiguration

Miljövariabler för backend och bygge beskrivs i `docs/installationsguide.md` och serverns `README`/migreringar. Vite använder bland annat `base: '/v2/'` i `vite.config.mjs`.

---

**Senast uppdaterad**: 2026-06-09
