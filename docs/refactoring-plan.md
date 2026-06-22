# Refaktoreringsplan – struktur, kvalitet, underhållbarhet

**Syfte:** Denna plan styr stegvis refaktorering utan att bygga nya features. Varje steg ska vara litet, verifierbart och bakåtkompatibelt i möjligaste mån.

**Repo:** `ibennani/pts_granskningsverktyg_frontend_only` (lokal kopia: detta arbetskatalogsträd).

---

## Målbild

- **Mindre filer** – ingen modul ska ansvara för “allt”; vid ~300–400 rader bör delning övervägas innan merge.
- **Tydligare ansvar per modul** – en fil = ett domän-/teknikansvar (inte “misc”).
- **Mindre duplicering** – samma regel ska finnas på ett ställe (helst `shared/` om både klient och server behöver den).
- **Färre slask-utils** – undvik att lägga ny kod i `helpers.js`; lägg den i avgränsad modul.
- **Tunnare routes** – HTTP-flöde och validering i route; SQL och domän i repositories/services.
- **Tunnare reducers** – `auditReducer` ska delegera till små rena handlers.
- **Tydlig gräns frontend / server / shared** – server ska på sikt inte importera från `js/` när koden är gemensam; den ska ligga i `shared/`.
- **Bättre JS → TS-migrering** – små moduler, rena funktioner, undvik `@ts-nocheck` i ny kod; ta bort `@ts-nocheck` i `auditReducer` först när filen är hanterbar.

---

## Principer (obligatoriska)

1. **En sak i taget** – ett micro-steg per arbetsenhet; inte flera riskabla flyttar i samma commit om det går att undvika.
2. **Små, säkra ändringar** – flytta kod före du ändrar beteende; extrahera rena funktioner först.
3. **Ingen onödig funktionsändring** – refaktor syftar till struktur, inte nya beteenden.
4. **Behåll publika API:er** – använd facader (`helpers.js`, `server_sync.js`) tills imports är migrerade.
5. **Verifiera efter varje steg** – inget nästa steg förrän aktuellt steg är grönt (se checklista).
6. **Undvik nya globala `window`-beroenden** – befintliga `window.__GV_*` isoleras bakom adapter där möjligt; ändra inte nycklar i första taget.
7. **Ingen ny kod i `helpers.js`** om det kan ligga i mer specifik modul (undantag med stark motivering i commit/PR-text).
8. **Delning efter ansvar** – inte “utils-del 2”, utan t.ex. `sync_payload_mapper`, `audit_metrics`, `user_repository`.

---

## Checklista per steg (innan nästa todo)

Varje avslutat micro-steg ska ha:

| Kontroll | När |
|----------|-----|
| `npm run lint` | nästan alltid |
| `npm run typecheck` | vid kod-/importändringar |
| `npm test` | vid kodändring som kan påverka logik |
| `npm run build` | vid kodändring som påverkar bundle eller TS-vägar |
| `npm run check:full` | vid större refaktor eller inför merge/release |
| Manuell smoke | vid rendering, routing, state, sync, notiser |

**Stoppregel:** Om lint/typecheck/test/build fallerar – **stanna**, analysera, fixa, verifiera om – **gå inte vidare**.

**Kort sammanfattning efter steg:** vad som ändrats, varför, hur det verifierades (1–5 meningar).

---

## Ordning för arbetet (översikt)

| Block | Fokus |
|-------|--------|
| TODO 0 | Denna plan + process |
| TODO 1 | Dela `js/utils/helpers.js` i smala moduler + facade |
| TODO 2 | Centralisera `count_stuck_in_samples` (t.ex. `shared/audit/`) |
| TODO 3 | Dela `js/logic/server_sync.js` → `js/sync/*` |
| TODO 4 | Dela `js/logic/view_render.js` → `js/view/*` |
| TODO 5 | Dela notiser → `js/notifications/*` |
| TODO 6 | Dela `js/state/auditReducer.ts` → handlers under `js/state/audit/` |
| TODO 7 | Tunna server-routes; repositories för users/rules/audits |
| TODO 8 | Flytta gemensam logik till `shared/`; uppdatera imports |
| TODO 9 | Adapter för `window.__GV_*` / runtime flags |
| TODO 10 | `CONTRIBUTING.md` + `docs/architecture.md` – strukturregler |

---

## Micro-todos (granulärt)

### TODO 0 – Plan (klar när denna fil finns och lint är grön)

- [x] Skapa `docs/refactoring-plan.md` med målbild, principer, checklista, ordning, problemfiler, micro-lista.
- [x] `npm run lint` (dokumentation ska inte kräva build/test).

### TODO 1 – `helpers.js` slutar växa

**Mål:** Små moduler + `helpers.js` som bakåtkompatibel re-export tills imports migrerats.

**Föreslagen modulindelning (exempel):**

- `js/utils/uuid.js` – `generate_uuid_v4`
- `js/user/current_user.js` – `get_current_user_name`
- `js/utils/assets.js` – `get_app_base`, `resolve_asset_href`, `load_css*`
- `js/utils/date_format.js` – ISO → lokal datum/tid/relativ tid
- `js/utils/html_escape.js` – `escape_html`
- `js/utils/sanitize.js` – `sanitize_*`, `safe_set_inner_html`
- `js/dom/create_element.js` – `create_element`
- `js/ui/icons.js` – `get_icon_svg`, `get_external_link_icon_html`

**Micro-steg (en i taget):**

1. Skapa tomma filer + exports som delegerar till befintlig implementation *eller* flytta en funktion + re-export i `helpers.js`.
2. Kör lint → typecheck → test → build.
3. Upprepa för nästa funktionsgrupp.
4. Migrera imports i **små batchar** (t.ex. en feature i tagen); verifiera efter varje batch.
5. När inget längre behöver `helpers` för den gruppen: dokumentera i commit att direktimport föredras.
6. Ta bort felaktigt `'use-strict';` i `helpers.js` när filen ändå öppnas (ES-moduler är redan strict); helst **inget** strict-direktiv.

### TODO 2 – Audit-metric: `count_stuck_in_samples`

**Mål:** En ren funktion, ingen DOM, inget `window`, inga serverdeps.

- Skapa t.ex. `shared/audit/audit_metrics.js` (eller `js/domain/audit/audit_metrics.js` om shared inte används än).
- Ersätt duplicering i `server/routes/audits.js` och `js/logic/server_sync.js`.
- Lägg till enhetstest om strukturen tillåter.
- Verifiera: lint, typecheck, test, build.

### TODO 3 – `server_sync.js` → `js/sync/`

**Slutmål:** `server_sync.js` exporterar bara tunn publik yta och delegerar:

- `schedule_sync_to_server`
- `sync_to_server_now`
- `flush_sync_to_server`
- `schedule_sync_rulefile_to_server`
- `flush_sync_rulefile_to_server`
- `enqueue_rulefile_part_patch`

**Micro-steg:**

| Steg | Innehåll | Ny modul (förslag) |
|------|----------|---------------------|
| 3A | `normalize_status_for_server`, `state_to_patch`, `state_to_import` | `js/sync/sync_payload_mapper.js` |
| 3B | BroadcastChannel | `js/sync/sync_broadcast.js` |
| 3C | `window.__gv_rulefile_part_patch_queue__` → adapter | `js/sync/rulefile_patch_queue.js` |
| 3D | Regelfil-sync | `js/sync/rulefile_sync_service.js` |
| 3E | Granskning-sync | `js/sync/audit_sync_service.js` |
| 3F | Ev. debounce/kö/fel offline | `js/sync/sync_scheduler.js`, `js/sync/sync_error_handler.js` (namn efter faktisk kod) |

Efter varje delsteg: lint, typecheck, test, build. Slut: **manuell smoke** (ändra granskning, autospar/sync).

### TODO 4 – `view_render.js` → `js/view/`

**Micro-steg:**

| Steg | Innehåll | Modul |
|------|----------|--------|
| 4A | Vy-alias, publicerad regelfil-redirect, login `on_login` | `js/view/resolve_view_request.js` |
| 4B | `#app-main-view-root`, content host, tömning, skip target | `js/view/view_dom_host.js` |
| 4C | destroy/init/async render | `js/view/view_lifecycle.js` |
| 4D | error boundary, fallback | `js/view/view_error_handler.js` |

Ev. senare: `view_focus_restore.js`, `view_component_deps.js` om det fortfarande är tungt.

Verifiera: lint, typecheck, test, build + smoke (login, start, regelfil, granskning, hash/back/forward).

### TODO 5 – `NotificationComponent`

**Micro-steg:**

- 5A – `notification_state.js` (fingerprint/dedupe)
- 5B – `notification_renderer.js` (DOM för meddelande/åtgärd/stäng)
- 5C – `notification_portal.js` (placering i `#app-main-view-content`)

Publik API oförändrat: `show_global_message*`, `clear_*`, `append_global_message_areas_to`, `cleanup`.

### TODO 6 – `auditReducer.ts`

**Micro-steg:**

- 6A – `remove_stale_requirement_result_aliases` → `auditResultAliases.ts`
- 6B – sample-actions → `sampleHandlers.ts`
- 6C – `UPDATE_METADATA` → `metadataHandlers.ts`
- 6D – `SET_AUDIT_STATUS` → `auditStatusHandlers.ts`
- 6E – init/load/remote → `remoteStateHandlers.ts` (eller uppdelat per grupp)

**Regel:** Ta inte bort `// @ts-nocheck` förrän reducer/hanterare är små nog; inför typer stegvis per handler.

### TODO 7 – Server routes

- 7A – Admin contacts → `server/services/admin_contacts_service.js` eller repo-lager
- 7B – `user_repository.js` (gradvis flytt från `users.js`)
- 7C – `rule_repository.js`
- 7D – `audit_repository.js`

Ingen stor beteendeförändring; `asyncHandler` i separat steg om det införs.

### TODO 8 – `shared/`

- Skapa `shared/` med strikta regler: ingen `window`/`document`/CSS/komponenter; ingen `sessionStorage`/`localStorage`; måste fungera i Node och browser.
- Flytta små DOM-fria moduler **en i taget**; uppdatera server + frontend imports.

### TODO 9 – Runtime flags / globals

- `js/app/runtime_flags.js`, `js/app/browser_globals.js` – read/write wrappers för `__GV_DEBUG_*`, `__gv_current_view_*`, `__GV_CURRENT_USER_NAME__`, ev. `Helpers`/`Translation` via befintliga accessors om de finns.
- Migrera **en konsument i taget**; behåll gamla nycklar internt tills allt är flyttat.

### TODO 10 – Dokumentation av struktur

- Uppdatera/skapa `CONTRIBUTING.md` och `docs/architecture.md` med samma regler som denna plan (helpers, routes, SQL i repos, shared-gränser, adapters, filstorlek, TS).

---

## Mest problematiska filer (bedömning)

| Fil | Ca. rader | Problem |
|-----|-----------|---------|
| `js/utils/helpers.js` | ~490 | Blandar uuid, användare, assets/CSS, sanitize, DOM, ikoner; risk för “slask”. Felaktigt `'use-strict';`. |
| `js/logic/server_sync.js` | ~440 | Debounce, kö, audit/rulefile sync, konflikt, offline, BroadcastChannel, payload, notiser – för många ansvar. |
| `js/logic/view_render.js` | ~320 | Orchestration + layout + globals + flush + lifecycle – ska bli tunn orchestrator. |
| `js/state/auditReducer.ts` | ~530 | Stor switch, `// @ts-nocheck`, mycket inline. |
| `server/routes/audits.js` | ~880 | Tjock route + SQL/domän; importerar från `js/` (lagerbrott). Duplicerad `count_stuck_in_samples`. |
| `server/routes/rules.js` | ~660 | Tjock route-fil. |

*(Radantal är ungefärliga; uppdateras vid behov efter `wc`.)*

---

## Slutkontroll (när alla todos är klara)

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run check:full
```

**Manuell smoke:** start → login → startsida → regelfilslista → regelfil → ev. textändring → autospar → granskningslista → granskning → metadata → kravresultat → notiser → hash/navigation → export/import om möjligt.

**Leverans:** lista ändrade filer, strukturella förbättringar, kvarvarande skuld, rekommenderade nästa steg för TS-migrering.

---

## Regel: en ändring i taget + verifiering

Varje **micro-steg** ska kunna beskrivas i en mening (“Flyttade X till Y, facade kvar i Z”). Om svaret blir “och dessutom …” – dela upp i två steg.
