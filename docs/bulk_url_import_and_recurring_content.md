# Bulkimport från URL-lista och återkommande innehåll

## Översikt

Verktyget kan skapa flera granskningsdelar från en URL-lista i ett deterministiskt flöde. Sidtyper och innehållstyper föreslås utifrån URL, sidtitel och sidrapport. Återkommande block (sidhuvud, meny, sidfot med mera) kan analyseras över flera sidrapporter och bli egna granskningsdelar efter granskarens bekräftelse.

Det manuella formuläret «Lägg till granskningsdel» är oförändrat.

## Bulkimport

1. Öppna **Granskningsdelar** och välj **Skapa från URL-lista**.
2. Välj **kategori en gång** (endast kategorier med URL).
3. Klistra in en URL per rad och välj **Hämta och analysera**.
4. Verktyget hämtar sidtitel och skärmdump via befintlig capture-kö, köar sidrapport och föreslår sidtyp och innehållstyper.
5. Bekräfta med **Skapa valda granskningsdelar**.

Misslyckade rader markeras som «Behöver åtgärdas» eller «Misslyckades»; lyckade rader sparas som vanliga granskningsdelar.

## Innehållstyper i sidrapport

Sidrapporten innehåller `analysis/content-types.json` med evidens från både regexp (HTML) och CSS-selector (renderad DOM). Regelfilens explicita `detectionPattern` och `detectionSelector` vinner över katalogvärden.

## Återkommande innehåll

Efter bulkimport av URL:er analyserar verktyget automatiskt återkommande block (sidhuvud, meny, sidfot med mera) när minst två sidrapporter är klara. Servern jämför blockkandidater från `analysis/phase1/page-blocks.json` med strukturfingeravtryck och skapar granskningsdelar i kategorin **Återkommande innehåll**. Innehållstyper sätts via samma sidrapportsanalys som för URL-granskningsdelar. Skärmdump klipps ut ur evidens-sidans sidrapport (`screenshot.png` + `boundingBox`) och sparas som bifogad media på granskningsdelen.

Meny analyseras med begränsad automatisk interaktion i `analysis/phase1/menu-navigation.json`. Cookie-banner använder initial consent-evidens utan extra klick.

## Pending under pågående granskning

Om granskningen redan pågår och en granskningsdel har granskade krav läggs nyligen identifierade innehållstyper i `pendingDetectedContentTypes` i stället för att skrivas över automatiskt. Granskaren kan lägga till eller ignorera förslagen.

## API

- `GET /api/audits/:auditId/snapshots/:captureId/analysis-summary`
- `POST /api/audits/:auditId/recurring-content/analyze`
- `POST /api/audits/:auditId/recurring-content/screenshot`
