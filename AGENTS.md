# AGENTS.md

Detta dokument beskriver hur AI-agenter (som Cursor Composer) kan användas för att utveckla och underhålla detta projekt.

## Översikt

Granskningsverktyget är ett modulbaserat projekt med tydlig struktur och konventioner. Denna guide hjälper AI-agenter att förstå projektets arkitektur och följa etablerade mönster.

## Projektstruktur

Projektet är organiserat enligt följande struktur:

- `js/` - Huvudkatalog för JavaScript-kod
  - `components/` - UI-komponenter
  - `features/` - Domänspecifika funktioner
  - `logic/` - Affärslogik och utilities
  - `utils/` - Hjälpfunktioner
  - `i18n/` - Översättningar
- `css/` - Stylesheets
- `tests/` - Testfiler
- `docs/` - Dokumentation

## Kodningskonventioner

### Namngivning
- Komponenter: PascalCase (`UploadViewComponent.js`)
- Funktioner och variabler: snake_case (`handle_export_word`, `export_to_word_criterias`)
- Filer: matchar komponent/funktionsnamn

### Modulstruktur
- Använd ES6-moduler
- Exportera med `export const ComponentName = { init({ root, deps }), render(), destroy() }` (INGEN IIFE)
- Importera relativt (`../utils/foo.js`)

### Indentering och formatering
- 4 mellanslag för indentering
- Använd semikolon
- Följ ESLint-regler

## Viktiga funktioner att känna till

### Export-funktionalitet
- Exponeras via `window.ExportLogic` (skapas i `js/export_logic.js`)
- Word-export (sorterat på krav): `window.ExportLogic.export_to_word_criterias()`
- Word-export (sorterat på stickprov): `window.ExportLogic.export_to_word_samples()`
- Excel-export: `window.ExportLogic.export_to_excel()`
- CSV-export: `window.ExportLogic.export_to_csv()`
- HTML-export: `window.ExportLogic.export_to_html()`

### State-hantering
- Central state i `js/state.js`
- Exporterar `getState`, `dispatch`, `subscribe`, `StoreActionTypes` från modulen
- För bakåtkompatibilitet exponeras även via `window.Store` och `window.StoreActionTypes`
- I komponenter: använd `deps.getState()` och `deps.dispatch()` (från deps-objektet)

### Översättningar
- Använd `deps.Translation.t()` eller `window.Translation.t()` för översättningar
- Översättningsfiler i `js/i18n/`

### Autospar
- Central autospar-service i `js/logic/autosave_service.js`
- Debounce 250 ms, sparar utan visuell omrendering, bevarar fokus/markering/scroll
- Se `docs/autosave_integration.md` för instruktion om hur nya vyer ansluts

## Vanliga uppgifter

### Lägga till en ny komponent
1. Skapa fil i `js/components/`
2. Följ modulmönstret: `export const ComponentName = { init({ root, deps }), render(), destroy() }` (INGEN IIFE)
3. CSS importeras via `Helpers.load_css_safely()` i `init()`
4. Importera och registrera i `js/main.js`

### Lägga till en ny översättning
1. Lägg till nyckel i `js/i18n/sv-SE.json` och `js/i18n/en-GB.json`
2. Använd `t('nyckel')` i koden

### Testa ändringar
- Kör `npm run test:e2e` för E2E-tester
- Kör `npm run lint` för att kontrollera kodkvalitet

## Kända begränsningar

### Word-export
- Använder Words inbyggda TOC-funktion vilket ger en varning vid öppning
- Användaren måste klicka "Ja" för att uppdatera fält
- Manuella interna länkar fungerar inte korrekt med docx-biblioteket

### Browser-kompatibilitet
- Kräver moderna webbläsare med ES6-stöd
- Testas främst i Chrome, Firefox och Edge

## Tips för AI-agenter

1. **Läs befintlig kod först** - Projektet har etablerade mönster som bör följas
2. **Använd semantisk sökning** - Använd `codebase_search` för att hitta relevant kod
3. **Följ projektets struktur** - Placera kod i rätt kataloger
4. **Testa ändringar** - Kör tester efter större ändringar
5. **Använd svenska** - Kommentarer och commit-meddelanden ska vara på svenska

## Ytterligare resurser

- Se `README.md` för allmän projektinformation
- Se `package.json` för beroenden och scripts
- Se `docs/` för detaljerad dokumentation
