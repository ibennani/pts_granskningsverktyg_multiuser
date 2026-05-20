# AGENTS.md

Detta dokument beskriver hur AI-agenter (som Cursor Composer) kan användas för att utveckla och underhålla detta projekt.

## Översikt

**Leffe** (webbapplikationen för digital tillsyn) är ett modulbaserat projekt med tydlig struktur och konventioner. Denna guide hjälper AI-agenter att förstå projektets arkitektur och följa etablerade mönster.

## Projektstruktur

Projektet är organiserat enligt följande struktur:

- `js/` - Huvudkatalog för frontend (JavaScript och TypeScript)
  - `components/` - UI-komponenter
  - `export/` - Exportmoduler (CSV, Excel, Word, HTML)
  - `features/` - Domänspecifika funktioner
  - `logic/` - Affärslogik, routing, vyrendering
  - `state/` - Reducers och state-index
  - `sync/` - Serversynk (granskning, regelfil)
  - `utils/` - Hjälpfunktioner
  - `i18n/` - Översättningar
- `shared/` - Kod som delas mellan klient och server (inga DOM-beroenden)
- `server/` - Express-backend, API, autentisering, databas
- `css/` - Stylesheets
- `tests/` - Testfiler
- `docs/` - Dokumentation

## Kodningskonventioner

### Namngivning
- Komponenter: PascalCase (`AuditViewComponent.ts`)
- Funktioner och variabler: snake_case (`handle_export_word`, `export_to_word_criterias`)
- Filer: matchar komponent/funktionsnamn; källan kan vara `.ts` med `.js`-brygga för import

### Modulstruktur
- Använd ES6-moduler, importera relativt (`../utils/foo.js` eller `.ts` på server)
- **Nya vykomponenter:** föredra `export class XxxComponent { async init({ root, deps }), render(), destroy() }` (se `.cursor/rules/00-project-rules.mdc`)
- **Legacy:** vissa sektioner och hjälpkomponenter använder fortfarande `export const XxxComponent = { init, render, destroy }` (objektliteral, ingen IIFE)
- Vykomponenter registreras i `js/logic/view_components_index.js` (en instans per vy), inte direkt i `main.js`

### TypeScript-filer och import med `.js`-suffix
- Vid migrering **`.js` → `.ts`** ska importvägar ofta **behålla `.js`-ändelsen** (TypeScripts rekommendation mot utdatafiler). Källan ligger då som **`.ts`** på disk.
- **Vite** är konfigurerad med `resolve.extensionAlias` så att en begäran om `*.js` i dev/bygge **först** matchar motsvarande **`.ts` / `.tsx`**, sedan en riktig **`.js`**-fil. Det undviker **404 i webbläsaren** och tom startsida när bara `.ts` finns.
- **Node-backend** (utan Vite) tolkar inte detta automatiskt: importera där **`*.ts`** om filen bara finns som TypeScript, och kör servern med **`tsx`** (se `package.json` / `nodemon.json`).
- Efter konvertering: kör **`npm run dev`** eller **`npm run build`** och öppna appen en gång; vid tvekan kör **`npm run check`**.

### Indentering och formatering
- 4 mellanslag för indentering
- Använd semikolon
- Följ ESLint-regler

## Viktiga funktioner att känna till

### Export-funktionalitet
- Exponeras via `window.ExportLogic` (skapas i `js/export_logic.ts`; importeras ofta som `export_logic.js` enligt regeln ovan)
- Word-export (sorterat på krav): `window.ExportLogic.export_to_word_criterias()`
- Word-export (sorterat på stickprov): `window.ExportLogic.export_to_word_samples()`
- Excel-export: `window.ExportLogic.export_to_excel()`
- CSV-export: `window.ExportLogic.export_to_csv()`
- HTML-export: `window.ExportLogic.export_to_html()`
- **Underhåll:** `npm run extract:html-export` kör `scripts/extract_html_export.cjs`. Använd endast mot en **backup av full export_logic** (miljövariabel `EXPORT_LOGIC_SOURCE`), annars skrivs fasaden över i onödan.
- **Regression:** `npm run check:export-facades` (ingår i `npm run check`) varnar om `export_logic.ts` eller `audit_logic.ts` växer över satta radgränser.

### State-hantering
- Central state i `js/state.js` (implementation i `js/state/index.ts`, re-export via `js/state/index.js` och reducerfiler under `js/state/`)
- Exporterar bland annat `getState`, `dispatch`, `subscribe`, `StoreActionTypes`, `loadStateFromLocalStorageBackup`, `clearLocalStorageBackup`, `APP_STATE_KEY`
- **`window.Store` används inte** i nuvarande kodbas — importera från `state.js`
- I komponenter: använd `deps.getState()` och `deps.dispatch()` (från deps-objektet)
- **Persistens, backup och serversynk:** `docs/state_and_persistence.md`

### Översättningar
- Använd `deps.Translation.t()` eller `window.Translation.t()` för översättningar
- Översättningsfiler i `js/i18n/`

### Autospar
- Central autospar-service i `js/logic/autosave_service.js`
- Debounce 250 ms, sparar utan visuell omrendering, bevarar fokus/markering/scroll
- Se `docs/autosave_integration.md` för instruktion om hur nya vyer ansluts
- Fältutkast (drafts) hanteras separat i `js/draft_manager.ts` (inte samma som formulär-autospar)

## Vanliga uppgifter

### Lägga till en ny vykomponent
1. Skapa fil i `js/components/` (föredra `.ts` för ny kod)
2. Följ klassmönstret: `export class ComponentName { async init({ root, deps }), render(), destroy() }`
3. CSS laddas via `Helpers.load_css_safely()` i `init()`
4. Registrera instans i `js/logic/view_components_index.js` (`get_component_class`-switch)
5. Lägg till route/hash i `js/logic/router.js` om vyn behöver ny URL

### Lägga till en ny översättning
1. Lägg till nyckel i `js/i18n/sv-SE.json` och `js/i18n/en-GB.json`
2. Använd `t('nyckel')` i koden

### Testa ändringar
- Kör snabbsviten: `npm run check` (lint + TypeScript-typkontroll + enhetstester)
- Kör enhetstester: `npm test`
- Kör lint: `npm run lint`
- Kör TypeScript-lint (vid behov): `npm run lint:ts`
- Kör typkontroll: `npm run typecheck`
- Kör E2E (smoke, Chromium): `npm run test:e2e:smoke`
- Kör E2E (full svit): `npm run test:e2e`
- Kör “allt” inför release/PR: `npm run check:full`

## Kända begränsningar

### Word-export
- Använder Words inbyggda TOC-funktion vilket kan ge en varning vid öppning
- Användaren kan behöva bekräfta uppdatering av fält
- Manuella interna länkar kan bete sig annorlunda med docx-biblioteket

### Browser-kompatibilitet
- Kräver moderna webbläsare med ES6-stöd
- Testas främst i Chrome, Firefox och Edge

## Tips för AI-agenter

1. **Läs befintlig kod först** - Projektet har etablerade mönster som bör följas
2. **Använd semantisk sökning** - Hitta relevant kod utifrån beteende
3. **Följ projektets struktur** - Placera kod i rätt kataloger
4. **Testa ändringar** - Kör tester efter större ändringar
5. **Använd svenska** - Kommentarer och commit-meddelanden ska vara på svenska
6. **Klar-notis (Galaxy Watch)** - När en uppgift är klar: kör från projektroten `notify_done.cmd` (eller `scripts\nabu_notify.cmd`). Se `.cursor/rules/01-nabu-sista-steget.mdc`

## Ytterligare resurser

- Se `docs/snabbstart_nyborjare.md` för snabb introduktion för nya användare
- Se `README.md` för allmän projektinformation
- Se `docs/rulefile_editing_flow.md` för redigeringsflöde av regelfilsektioner
- Se `docs/metadata_flow.md` för hur granskningsmetadata lagras och uppdateras
- Se `docs/requirements_data_shape.md` för hur kravlista (objekt eller array) ska hanteras i kod och export
- Se `package.json` för beroenden och scripts
- Se `docs/` för detaljerad dokumentation
