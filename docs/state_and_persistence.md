# Tillstånd och persistens i klienten

## Översikt

Granskningsdata (regelfil, metadata, stickprov, observationer med mera) lever i ett **centralt applikationstillstånd** som uppdateras via `dispatch()` och speglas till **webbläsarens lagring** så att arbetet överlever sidomladdning inom samma flik. Vid **inloggad drift** synkas ändringar mot **servern** (debouncad PATCH/import). Detta dokument beskriver *var* data sparas, *när* backup skapas och hur **cold start** med localStorage-backup samverkar med servern. Formulärs**autospar** i enskilda vyer är ett separat lager (se `docs/autosave_integration.md`).

## 1. Källfiler och modulgränser

| Del | Plats |
|-----|--------|
| Publik API (re-export) | `js/state.js` → `js/state/index.js` |
| Startvärden och versionskonstant | `js/state/initialState.js` (`APP_STATE_VERSION`) |
| Action-typer | `js/state/actionTypes.js` (exporteras som `StoreActionTypes`) |
| Reducers | `auditReducer.ts`, `rulefileReducer.js`, `uiReducer.js`, `userReducer.js` |
| Appstart, sessionStorage-koll, backup-merge | `js/logic/app_bootstrap.js`, `js/logic/session_boot_merge.js` |
| Synk mot server | `js/sync/audit_sync_service.js`, `js/sync/rulefile_sync_service.js` (körs från `index.js` via `schedule_sync_*`) |

## 2. Webbläsarens nycklar

| Nyckel | Lagring | Innehåll |
|--------|---------|----------|
| `digitalTillsynAppCentralState` | `sessionStorage` | Hela serialiserade appstate efter varje lyckad `dispatch` som ändrar state. Försvinner när fliken stängs. |
| `digitalTillsynAppStateBackup` | `localStorage` | Objekt `{ state, restorePosition }` när sparat state bedöms **återställningsbart** (`has_restorable_state`). Används vid cold start om sessionStorage var tom. |
| `gv_current_user_name` | `sessionStorage` | Visningsnamn för inloggad användare (parallellt till token-hantering). |
| Utkast till fält | `localStorage` | Hanteras av **draft manager**, inte av centrala `dispatch` (se `js/draft_manager.js`). |

Konstanten **`APP_STATE_KEY`** exporteras från `state.js` och används t.ex. i bootstrap för att avgöra om det fanns data i session innan `initState()`.

## 3. Versionsfält och migrering

- **`saveFileVersion`** i sparat state ska matcha samma **huvudversion** som `APP_STATE_VERSION` i `initialState.js` (jämförelse sker med `startsWith` på första semver-delarna).
- Om inläst blob från `sessionStorage` **inte** uppfyller detta rensas nyckeln och appen startar med **default state**.
- Vid merge från backup eller remote sätts ofta `saveFileVersion` till aktuell `APP_STATE_VERSION` efter sammanslagning.

När du ändrar sparformat: uppdatera `APP_STATE_VERSION` medvetet och dokumentera vad som ska hända för äldre filer (export/import, serverpatch).

## 4. Livscykel: från start till sparning

1. **Före `initState()`** läser bootstrap om `sessionStorage` redan innehöll `APP_STATE_KEY` (`had_session_storage`).
2. **`initState()`** läser `sessionStorage`, mergar med `initial_state`, kör vid behov `AuditLogic.updateIncrementalDeficiencyIds` och skriver tillbaka till session.
3. **Cold start utan session:** om `loadStateFromLocalStorageBackup()` returnerar giltig backup körs **`apply_session_boot_merge_from_backup`** (inloggad direkt, eller efter lyckad inloggning om användaren var utloggad). Logiken jämför **versionsnummer** mot servern när `auditId` finns; annars laddas lokalt state som fil.
4. **Varje `dispatch`** som ger nytt state-objekt: serialisera till `sessionStorage`; om `has_restorable_state` — uppdatera **localStorage-backup** inklusive valfri `restorePosition` (hash-vy + fokusinfo) från app-hook.
5. **Fel vid sparning** (t.ex. kvot): varning till användare via notifiering; inget kraschande kast från lagret.

## 5. När synkas till servern?

Efter lyckad sparning till session anropas **`schedule_sync_to_server`** så när dess debounce löpt ut körs PATCH eller import (se `audit_sync_service.js`). Följande **utesluter** synk i `index.js` (för att undvika loopar, tappad staging-data eller irrelevant trafik):

- Intern metadata med `skip_server_sync: true`
- `same_user_tab_broadcast` (fält synk mellan egna flikar)
- `STAGE_SAMPLE_CHANGES`, `CLEAR_STAGED_SAMPLE_CHANGES`, `SET_SAMPLE_EDIT_DRAFT`, `CLEAR_SAMPLE_EDIT_DRAFT`
- `REPLACE_STATE_FROM_REMOTE`, `REPLACE_RULEFILE_FROM_REMOTE`, `SET_REMOTE_AUDIT_ID`
- Status **`not_started`** (ingen pågående granskning att spara)

Regelfilsredigering: vid `UPDATE_RULEFILE_CONTENT` i status `rulefile_editing` med `ruleSetId` körs **`schedule_sync_rulefile_to_server`**.

## 6. Publik API från `js/state.js`

Importera från `./state.js` (eller alias enligt projektets Vite-inställningar):

| Export | Syfte |
|--------|--------|
| `getState()` | Djup kopia av aktuellt state; vid serialiseringsfel returneras säkert fallback-state. |
| `dispatch(action)` | Promise; köar actions om reducer redan kör. Ogiltig action avvisas utan att mutera state. |
| `subscribe(listener)` | Notifiering efter ändring; returnerar avprenumerationsfunktion. |
| `initState()` | Laddar från session och normaliserar brist-ID. |
| `StoreActionTypes` | Konstantobjekt för alla action-typer. |
| `StoreInitialState` | Referens till `initial_state` (för tester/diagnostik). |
| `loadStateFromLocalStorageBackup()` | Läser backup; returnerar `{ state, restorePosition }` eller `null`. |
| `clearLocalStorageBackup()` | Tar bort backup-nyckeln. |
| `updateBackupRestorePosition(pos)` | Uppdaterar endast `restorePosition` i befintlig backup. |
| `APP_STATE_KEY` | Strängkonstant för sessionStorage-nyckel. |

**OBS:** `window.Store` sätts **inte** i nuvarande kodbas; använd ES-modulimport i ny kod. Äldre dokumentation som nämner `window.Store.clearAutosavedState` eller `forceSaveStateToLocalStorage` är föråldrad.

## 7. Relation till formulär-autospar

- **Centralt state:** sparas direkt vid `dispatch` (ingen debounce i state-lagret).
- **Formulär:** använder `AutosaveService` med **250 ms** debounce på `input`, trimmar först vid manuell sparning eller när vyn lämnas; anrop till `dispatch` kan använda `skip_render` i payload för att undvika visuella hopp. Se `docs/autosave_integration.md`.

## 8. Felsökning för utvecklare

1. **Data försvinner när fliken stängs** — förväntat för ren `sessionStorage`; användaren ska exportera eller arbeta mot server där granskning har `auditId`.
2. **Gammal data efter omstart** — kontrollera `digitalTillsynAppStateBackup` i **Application → Local Storage** och boot-merge-loggen i konsolen.
3. **Synk sker inte** — kontrollera `auditStatus`, token, `navigator.onLine`, och att action-typen inte finns på exklusionslistan ovan.
4. **Korrupt JSON i session** — nyckeln rensas vid parse-fel; användaren får blank start om backup saknas eller är ogiltig.

## 9. Närliggande dokument

- `docs/systemdokumentation.md` — arkitekturöversikt.
- `docs/requirements_data_shape.md` — form av `requirements` i regelfil och validering av sparad fil.
- `docs/metadata_flow.md` — metadatafält och reducer-koppling.
- `docs/api-dokumentation.md` — API-översikt (uppdaterad state-sektion).
