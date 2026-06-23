# Snyk- och beroendeskanning (P2)

Senast uppdaterad: 2026-06-23

## Status

| Skanning | Verktyg | Status |
|----------|---------|--------|
| SCA (npm) | Snyk MCP / CLI | **Ej körd i CI-agent** — MCP kräver `snyk_auth` i agentsession; CLI (`snyk`) saknas i PATH |
| SCA (npm) | `npm audit` | Se avsnitt nedan efter körning |
| SAST (kod) | `snyk_code_scan` | Väntar på auth — kör lokalt |
| Secrets | `snyk_secret_scan` | Väntar på auth — kör lokalt |

## Kör lokalt (setup redan klart hos utvecklare)

```bat
snyk test --dev
snyk code test
snyk test --all-projects
```

MCP i Cursor: `snyk_auth` → `snyk_trust` → tre scan-verktyg med `path` = projektroten.

## Findings (fylls i efter skanning)

| ID | Severity | Kategori | Paket/fil | Beskrivning | Åtgärd |
|----|----------|----------|-----------|-------------|--------|
| — | — | — | — | *Ingen skanning inarbetad ännu* | Kör tabell ovan och uppdatera |

## Redan åtgärdat i kodbasen (P2)

- **CSP:** `style-src 'unsafe-inline'` borttagen från API-serverns CSP (`server/index.js`) — API svarar med JSON, inte inline-stilar.
- **innerHTML:** `ErrorBoundaryComponent` byggd med `textContent` / DOM i stället för `innerHTML` för användartexter.

## Förväntade kategorier att granska

- **SCA:** `express`, `jsonwebtoken`, `marked`, `puppeteer`, `zod`
- **Code:** filuppladdning, path traversal, deserialisering
- **Secrets:** `.env`-mönster, webhook-URL:er (ska inte committas)
