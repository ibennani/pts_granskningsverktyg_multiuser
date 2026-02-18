# Snabbstart för nybörjare

**Granskningsverktyget** är ett webbaserat verktyg för att granska webbsidors och digitala tjänsters tillgänglighet mot en regelfil. Du bedömer krav systematiskt, dokumenterar observationer och kan exportera rapporter i CSV, Excel, Word eller HTML.

Denna guide tar dig från start till att du har gått igenom dina första krav och exporterat en rapport.

---

## 1. Starta en granskning

### Öppna befintlig granskning
- På **startsidan** visas en tabell över alla granskningar
- Klicka på **aktörens namn** (eller diarienumret) för att öppna granskningen
- Du kommer till **granskningsöversikten**

### Starta ny granskning
1. Gå till **Admin** via sidomenyn
2. Klicka på **"Starta ny granskning"**
3. Välj en regelfil från listan (eller ladda upp en ny via knappen "Ladda upp")
4. Fyll i **metadata** (diarienummer, aktör, granskare m.m.) och klicka **"Fortsätt till stickprov"**
5. Lägg till minst ett **stickprov** – sidor eller vyer som ska granskas
6. Klicka **"Starta granskning"**
7. Du kommer till granskningsöversikten

---

## 2. Genomföra granskningen

### Välj stickprov och gå till krav
- I granskningsöversikten ser du alla stickprov
- **"Granska nästa"** – tar dig till det första ogranskade kravet för stickprovet
- **"Visa alla krav"** – visar hela kravlistan för stickprovet
- **"Besök"** – öppnar stickprovets webbadress i ny flik (användbart när du granskar)

### Bedöm krav
När du är i **kravgranskningsvyn**:

1. **Kontrollpunkter** – för varje villkor:
   - **"Stämmer"** – villkoret är uppfyllt
   - **"Stämmer inte"** – villkoret är inte uppfyllt (då behöver du inte bedöma godkännandekriterierna)

2. **Godkännandekriterier** – om du klickat "Stämmer":
   - **"Godkänt"** – kriteriet är uppfyllt
   - **"Underkänt"** – kriteriet är inte uppfyllt

3. **Dokumentera** – fyll i:
   - **Faktisk observation** – vad du faktiskt såg
   - **Kommentar till aktör** – ingår i den exporterade rapporten
   - **Kommentar till granskare** – endast för dig (följer inte med i exporten)

### Navigera mellan krav
- **"Föregående krav"** / **"Nästa krav"** – gå till föregående/nästa krav i listan
- **"Nästa ohanterade"** – hoppa till nästa krav som inte är fullständigt bedömt
- **"Tillbaka till kravlistan"** – återgå till listan över alla krav

---

## 3. Filtrering och sortering

### I kravlistan
- **Sökfält** – sök på titel, kategori eller referens
- **Filter** – kryssrutor för att visa/dölja krav efter status:
  - Ingen anmärkning, Underkänt, Delvis granskad, Ej granskat, Behöver hjälp, Uppdaterat krav
- **Sortera efter** – t.ex. Kategori, Status (problem först), Titel (A–Ö), Referens

### I kravgranskningsvyn
- **Sidopanelen** visar relaterade krav och stickprov – du kan filtrera och sortera där också
- **Inställningar** – välj om du vill granska "Sorterat per krav" eller "Sorterat per stickprov"

---

## 4. Avsluta och exportera

### Lås granskningen
1. Gå till **granskningsöversikten**
2. Klicka på **"Lås och avsluta granskningen"**
3. Statusen ändras till "Låst" – inga fler ändringar kan göras

### Exportera rapport
När granskningen är låst:
- **Exportera till CSV** – en eller flera textfiler
- **Exportera till Excel** – en Excel-fil (.xlsx)
- **Exportera till Word (krav)** – rapport sorterad på krav
- **Exportera till Word (stickprov)** – rapport sorterad på stickprov
- **Exportera till HTML** – rapport för webbvisning

### Behöver du ändra något?
- Klicka **"Lås upp granskning"** – statusen återgår till "Pågående" och du kan redigera igen

---

## 5. Viktigt att veta

- **Metadata** – kan redigeras när som helst via knappen **"Redigera"** i granskningsinfopanelens header (även under pågående granskning)
- **Ladda ner** – i startvyns tabell finns en knapp för att ladda ner granskningen som JSON-fil
- **Stickprov** – du kan lägga till, redigera och radera stickprov även när granskningen är pågående

---

## Mer hjälp

Se [Användarmanual](anvandarmanual.md) för komplett dokumentation.
