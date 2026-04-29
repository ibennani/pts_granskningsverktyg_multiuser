# `shared/` – gemensamt lager

Kod här ska kunna köras **både i Node (server, tester)** och **i webbläsaren** utan adapter.

## Regler

- **Ingen** `window`, `document`, `navigator`, DOM-API eller CSS.
- **Ingen** `sessionStorage` / `localStorage`.
- **Inga** UI-komponenter eller strängar med HTML som renderas direkt.
- Håll modulerna **små** och **rena** (helst under 400 rader per fil, i linje med projektregler).

## Struktur

- `shared/audit/` – t.ex. audit-metriker som server och klient delar.
- `shared/json/` – t.ex. validering av importerad JSON-struktur.

Nya moduler läggs i lämplig undermapp och importeras med sökväg till `shared/...` från server respektive Vite-frontend.
