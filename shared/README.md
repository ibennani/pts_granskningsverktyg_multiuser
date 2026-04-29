# `shared/` – gemensamt lager

Kod här ska kunna köras **både i Node (server, tester)** och **i webbläsaren** utan adapter.

## Regler

- **Ingen** `window`, `document`, `navigator`, DOM-API eller CSS.
- **Ingen** `sessionStorage` / `localStorage`.
- **Inga** UI-komponenter eller strängar med HTML som renderas direkt.
- Håll modulerna **små** och **rena** (helst under 400 rader per fil, i linje med projektregler).

## Struktur

- `shared/audit/` – metriker (`audit_metrics`), nycklar för fältlås (`audit_part_keys`).
- `shared/constants/` – gemensamma konstanter (t.ex. max JSON-uppladdning).
- `shared/json/` – validering av importerad JSON-struktur.
- `shared/rulefile/` – nycklar för regelfilsdelar och lås (`rulefile_part_keys`).

Importer från `js/` kan ligga kvar som tunna facader som vidareexporterar från `shared/` så att befintliga sökvägar inte behöver ändras överallt på en gång.

Nya moduler läggs i lämplig undermapp och importeras med sökväg till `shared/...` från server respektive Vite-frontend.
