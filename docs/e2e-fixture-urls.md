# Hash-URL:er och mock för MCP- och E2E-test

Referens när agenter navigerar med **user-accessibility-scanner** eller **user-playwright** MCP. Gissa inte routes — använd tabellen.

**Bas-URL (lokal dev):** `http://localhost:5173/v2/` (Vite `base: '/v2/'`).

**Hash-format:** `#vy?param=…` eller kompakt alias (t.ex. `#xa` = `audit_actions`). Båda fungerar; E2E använder oftast fullständiga vy-namn.

## Gemensam förberedelse

Kör **före** `browser_navigate` om vyn behöver det:

1. **Svenska:** `window.Translation.set_language('sv-SE')` (via `browser_evaluate` / Playwright evaluate).
2. **Session-dialog:** Klicka **"Nej, börja om från början"** om dialogen syns (mönster i `tests/home.e2e.spec.js`, `tests/a11y.skip-link.e2e.spec.js`).
3. **Inloggad användare (lätt):** `sessionStorage.setItem('gv_current_user_name', 'e2e-test-user')` — räcker för startsida utan API.
4. **API-mock:** Route `**/v2/api/**` — se referenstest i kolumnen **E2E-referens**.

## Dev-server

| Behov | Kommando |
|---|---|
| Enkel vy, sessionStorage räcker | `npm run dev:client` |
| Inloggning, admin, API, samarbete | `npm run dev` (backend på 3000) eller full API-mock i browser |

## Vyer (vanliga i test och MCP)

| Vy | Hash-URL (exempel) | Kompakt | Mock / state | E2E-referens |
|---|---|---|---|---|
| Startsida / Hantera granskningar | `#start` | — | sessionStorage-namn räcker ofta | `tests/home.e2e.spec.js` |
| Skiplänk (rot `/` eller `#start`) | `/v2/` eller `#start` | — | Svenska + stäng session-dialog | `tests/a11y.skip-link.e2e.spec.js` |
| Granskningsöversikt (lista) | `#audit` | — | sessionStorage eller API-mock | `tests/home.e2e.spec.js` |
| Metadata (ny/pågående granskning) | `#metadata` | `#md` | sessionStorage + regelfil i state, API-mock | `tests/e2e/save_and_reload.e2e.spec.js` |
| Stickprov | `#sample_management` | `#sm` | Granskning påbörjad i state | — |
| Granskningsöversikt (enskild) | `#audit_overview` | `#ov` | `auditId` i state/hash | `tests/e2e/audit_flow.e2e.spec.js` |
| Export | `#audit_actions` | `#xa` | sessionStorage + API-mock | `tests/e2e/export_report.e2e.spec.js` |
| Alla krav | `#all_requirements` | `#qr` | API-mock + pågående granskning | `tests/e2e/audit_flow.e2e.spec.js` |
| Kravgranskning | `#requirement_audit?sampleId=s1&requirementId=req1` | `#ra?s=…&r=…` | Full mock + stickprov/krav i state | `tests/e2e/audit_collab_locks.e2e.spec.js` |
| Kravlista (stickprov) | `#requirement_list?sampleId=…` | `#rl?s=…` | Granskning + stickprov | — |
| Regelfiler (admin) | `#audit_rules` | — | Admin + API eller inloggning | `tests/admin-upload.e2e.spec.js` |
| Redigera krav i regelfil | `#rulefile_edit_requirement?id=…` | `#rm?id=…` | Regelfil i state + API-mock | `tests/e2e/rulefile_collab_locks.e2e.spec.js` |
| Användarhantering | `#manage_users` | — | Admin-inloggning | `tests/e2e/login.e2e.spec.js` |
| Inloggning | `#login` | — | Backend eller mock `/auth/login` | `tests/e2e/login.e2e.spec.js` |

Parametrar kan förkortas i hash: `auditId` → `a`, `sampleId` → `s`, `requirementId` → `r` (se `js/logic/router_url_codec.js`).

## sessionStorage-nycklar (ofta)

| Nyckel | Syfte |
|---|---|
| `digitalTillsynAppCentralState` | Hel granskning (regelfil, stickprov, metadata) |
| `gv_auth_token` | JWT för API-anrop |
| `gv_current_user_name` | Visningsnamn utan full login |
| `gv_current_user_is_admin` | `'1'` / `'0'` |

Exempel på ifylld state: `tests/e2e/export_report.e2e.spec.js` (`page.addInitScript`).

## API-mock (minimal checklista)

Vid `**/v2/api/**`-mock, hantera minst det som referenstestet behöver:

- `GET …/health` → 200
- `POST …/auth/login` / `…/auth/refresh` → token
- `GET …/users/me` → namn, `is_admin`, `language_preference`
- Gransknings-/regel-endpoints som vyn anropar (kopiera från närmaste `tests/e2e/*.e2e.spec.js`)

## Underhåll

Uppdatera denna fil när nya vyer läggs till i `js/logic/view_components_index.js` eller hash-alias ändras i `router_url_codec.js`.

Kör **`npm run check:fixture-urls`** (ingår i `npm run check`) för att verifiera att tabellen stämmer med routern.
