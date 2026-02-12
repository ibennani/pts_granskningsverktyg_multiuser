# Teknisk specifikation: Granskningsverktyget

**Version:** 2.1.0
**Datum:** 2025-01-27

## 1. Mål och syfte

Granskningsverktyget är en modern webbapplikation för digital tillsyn av webbsidor och digitala tjänster. Verktyget stöder hela processen från regelfilsuppladdning till slutlig rapportgenerering, med fokus på användarvänlighet, tillgänglighet och effektivitet.

### Huvudsyfte

Verktyget ska underlätta strukturerad granskning enligt definierade regler genom att:
- Validera och hantera JSON-baserade regelfiler
- Stödja definiering och hantering av stickprov
- Möjliggöra systematisk bedömning av krav
- Dokumentera observationer och kommentarer
- Generera rapporter i olika format (CSV, Excel, Word)
- Säkerställa tillgänglighet enligt WCAG 2.2 AA

### Tekniska mål

- **Prestanda**: Snabb laddning och responsiv användarupplevelse
- **Tillgänglighet**: Fullständig kompatibilitet med hjälpmedel
- **Säkerhet**: Säker hantering av känslig data
- **Skalbarhet**: Stöd för stora regelfiler och många stickprov
- **Underhållbarhet**: Modulär arkitektur för enkel utveckling

## 2. Teknisk arkitektur

### 2.1 Frontend-teknologier

**Kärnteknologier:**
- **HTML5**: Semantisk markup för tillgänglighet
- **CSS3**: Modern styling med CSS-variabler och flexbox/grid
- **JavaScript ES6+**: Modulär arkitektur med import/export
- **Vite**: Byggsystem och utvecklingsserver (port 5173)
- **Playwright**: E2E-testning
- **Jest**: Enhetstester

**Arkitekturprinciper:**
- **Modulär design**: Varje komponent är en ES6-modul
- **Komponentbaserat**: Återanvändbara UI-komponenter
- **State management**: Redux-liknande pattern med centraliserad state
- **Internationalisering**: Språkstöd via JSON-filer
- **Responsiv design**: CSS-variabler för tema och styling

### 2.2 Rendering och navigation

**Rendering:**
- **SPA (Single Page Application)**: All rendering sker på klientsidan
- **Hash-based routing**: URL-hash (#) för navigation mellan vyer
- **Dynamic imports**: Lazy loading av komponenter vid behov
- **Component lifecycle**: init(), render(), destroy() för alla komponenter

**Navigation:**
- **Hash routing**: `#view?param=value` för URL-struktur
- **State-driven**: Navigation baserad på applikationens state
- **Deep linking**: Direktlänkar till specifika vyer fungerar

## 3. Allmänna krav och principer

### 3.1 Datauthållighet

**Session Storage:**
- Pågående granskningsdata sparas i `sessionStorage` för att överleva sidomladdningar
- Automatisk sparning vid state-ändringar
- Fallback till `localStorage` för autosave

**Filbaserad sparning:**
- Användaren kan spara hela granskningstillståndet till JSON-fil
- Ladda tidigare sparade granskningar från fil
- Versionshantering för kompatibilitet mellan olika versioner

### 3.2 Användargränssnitt och design

**Responsiv design:**
- Fullt funktionell på skärmbredder från 320px till 1920px+
- Mobile-first approach med progressiv förbättring
- Flexibel layout som anpassar sig till olika skärmstorlekar

**Estetik:**
- Modernt, professionellt och användarvänligt gränssnitt
- Färgschema med god kontrast och läsbarhet
- Rundade hörn och tydligt sans-serif-typsnitt (Roboto)
- Konsekvent design genom hela applikationen

**Tema:**
- Stöd för ljust och mörkt tema
- Automatisk detektering av operativsystemsinställning
- Manuell växling via UI-kontroll
- Temainställning sparas i `localStorage`

### 3.3 Kodprinciper

**Namngivning:**
- `snake_case` för JavaScript-variabler och funktioner (projektets konvention)
- `PascalCase` för komponenter och klasser
- `UPPER_SNAKE_CASE` för konstanter
- Tydlig och beskrivande namngivning

**Arkitektur:**
- Event delegation för bättre prestanda
- Modulär kodstruktur med tydliga ansvarsområden
- Separation of concerns mellan UI, logik och data
- Återanvändbara komponenter och funktioner

### 3.4 Internationalisering

**Språkstöd:**
- All UI-text hanteras via översättningssystem
- Stöd för svenska (sv-SE) och engelska (en-GB)
- Språkväxling via UI-kontroll
- Språkval sparas i `localStorage`
- Automatisk detektering av webbläsarens språk

## 4. Kärnfunktionalitet och arbetsprocess

### 4.1 Start och initialisering
1.  **Startvy:**
    *   Alternativ att starta en ny granskning genom att ladda upp en json-baserad regelfil.
    *   Alternativ att ladda en tidigare sparad json-granskningsfil.
2.  **Validering av regelfil:**
    *   Uppladdad regelfil valideras mot ett definierat schema (se avsnitt 10).
    *   Tydliga felmeddelanden visas om filen är ogiltig.
3.  **Initiering av granskning:**
    *   Vid lyckad validering av en ny regelfil, initieras ett nytt granskningsobjekt.
    *   Regelfilens innehåll sparas som en del av granskningsobjektet.
    *   Applikationen navigerar till vyn för metadata-inmatning.
    *   Om en sparad granskningsfil laddas, återställs hela granskningstillståndet och användaren navigeras till granskningsöversikten.

### 4.2 Metadata-inmatning (status: `not_started`)
1.  **Formulär:** Användaren kan mata in metadata för granskningen. Fälten inkluderar (men är inte begränsade till):
    *   Ärendenummer (frivilligt).
    *   Aktör/Organisation som granskas (frivilligt).
    *   Länk till aktörens webbplats/tjänst (frivilligt, url-format).
    *   Ansvarig granskare (frivilligt).
    *   Intern kommentar (frivilligt, flerradig text).
2.  **Redigerbarhet:** Metadata är endast redigerbar så länge granskningen har status `not_started`.
3.  **Navigering:** Knapp för att fortsätta till stickprovshantering.

### 4.3 Initial stickprovshantering (status: `not_started`)
1.  **Vy:** En dedikerad vy för att hantera stickprov innan granskningen formellt startas.
2.  **Funktioner:**
    *   **Lägga till nytt stickprov:** Formulär för att ange:
        *   Typ av sida/vy (från en lista definierad i regelfilen).
        *   Beskrivning/Namn på stickprovet (obligatoriskt).
        *   Url (frivilligt, url-format).
        *   Innehållstyper (checkbox-lista, baserad på definitioner i regelfilen, minst en måste väljas).
    *   **Lista befintliga stickprov:** Tydlig visning av alla tillagda stickprov med deras detaljer.
    *   **Redigera stickprov:** Möjlighet att ändra informationen för ett befintligt stickprov.
    *   **Radera stickprov:** Möjlighet att ta bort ett stickprov. En bekräftelsedialog ska visas. Minst ett stickprov måste alltid finnas för att kunna starta granskningen. Om endast ett stickprov finns, ska raderingsalternativet inte vara tillgängligt/renderas för det stickprovet.
3.  **Navigering:** Knapp för att starta själva granskningen. Denna knapp ska endast vara aktiv om minst ett stickprov har lagts till.

### 4.4 Starta granskning
1.  **Åtgärd:** När användaren klickar på "Starta granskning" (från stickprovshanteringsvyn):
    *   Granskningens status ändras från `not_started` till `in_progress`.
    *   En starttid (tidsstämpel, iso 8601) registreras för granskningen.
    *   Metadata (från 4.2) blir skrivskyddad.
    *   Applikationen navigerar till granskningsöversikten.

### 4.5 Granskningsöversikt (status: `in_progress` eller `locked`)
1.  **Visad information:**
    *   Allmän granskningsinformation (metadata, regelfilens titel/version, starttid, ev. sluttid, aktuell status).
    *   En sammanfattning av den totala granskningsframstegen (t.ex. antal granskade krav / totalt antal relevanta krav för alla stickprov, kan visas med en progressbar).
    *   Rubrik som indikerar antalet tillagda stickprov (t.ex. "Tillagda stickprov: 3 st").
    *   En lista över alla aktuella stickprov (renderad av en återanvändbar stickprovslistkomponent). För varje stickprov visas:
        *   Beskrivning, sidtyp, url.
        *   Progress för det enskilda stickprovet (antal granskade krav / totalt relevanta krav, kan visas med en progressbar).
        *   Valda innehållstyper.
        *   Åtgärdsknappar (beroende på granskningsstatus):
            *   "Visa alla krav": Navigerar till kravlistvyn för stickprovet.
            *   "Granska nästa ohanterade" (eller "Granska"): Navigerar till det första ogranskade/delvis granskade kravet för stickprovet i kravgranskningsvyn. Om alla krav är hanterade, kan denna knapp antingen döljas eller ändra text/funktion till "Visa resultat" (navigerar till kravlistvyn).
            *   "Besök url" (om url finns).
2.  **Stickprovshantering under pågående granskning (status: `in_progress`):**
    *   **Lägg till nytt stickprov:** En knapp ska finnas tillgänglig (t.ex. bredvid rubriken för stickprovslistan) för att lägga till nya stickprov. Detta ska öppna ett formulär (återanvändning av formulärkomponenten från 4.3.2.a rekommenderas, eventuellt i en modal eller genom att expandera ett område i vyn).
    *   **Redigera stickprov:** För varje listat stickprov ska det finnas en redigeringsknapp som öppnar formuläret för att ändra stickprovets detaljer.
    *   **Radera stickprov:** För varje listat stickprov ska det finnas en raderingsknapp.
        *   En bekräftelsedialog ska visas innan radering. Fokus ska hanteras korrekt (flyttas till dialogen och tillbaka till relevant element när dialogen stängs).
        *   Radering ska endast vara möjlig om det finns fler än ett stickprov i granskningen. Om endast ett stickprov återstår, ska raderingsknappen inte vara tillgänglig/renderas för det stickprovet.
3.  **Åtgärder för hela granskningen:**
    *   "Spara granskning till fil" (alltid tillgänglig).
    *   Om status är `in_progress`: "Lås och avsluta granskningen".
    *   Om status är `locked`:
        *   "Lås upp granskning".
        *   "Exportera till csv".
        *   "Exportera till excel (xlsx)".

### 4.6 Kravlistvy (per stickprov)
1.  **Visning:** När användaren väljer att se kraven för ett specifikt stickprov.
2.  **Innehåll:**
    *   Information om det valda stickprovet (beskrivning, sidtyp, granskningsprogress för stickprovet).
    *   En lista över alla relevanta krav för stickprovet (baserat på dess valda innehållstyper).
    *   Kraven ska grupperas efter huvudkategori och underkategori (enligt regelfilen). Kategorier och krav inom kategorier ska sorteras alfabetiskt baserat på deras text.
    *   För varje krav visas:
        *   Titel (klickbar för att navigera till kravgranskningsvyn).
        *   Statusindikator (t.ex. Godkänt, Underkänt, Delvis granskad, Ej granskat).
        *   Antal hanterade kontrollpunkter (t.ex. "2/5 kontroller").
        *   Standardreferens (om sådan finns i regelfilen, klickbar om url finns).
3.  **Navigering:** Tillbaka till granskningsöversikten.

### 4.7 Kravgranskningsvy (per krav och stickprov)
1.  **Visning:** När användaren klickar på ett specifikt krav från kravlistvyn.
2.  **Innehåll:**
    *   Kravets titel och standardreferens (om den finns).
    *   Övergripande status för kravet för det aktuella stickprovet.
    *   Sektioner från regelfilen: Förväntad observation, Instruktioner, Tips, Undantag, Vanliga fel (om de finns).
    *   Kravets metadata (kategori, påverkan etc.).
    *   **Kontrollpunkter (`checks`):**
        *   Varje kontrollpunkt visas med sin `condition` (villkorstext).
        *   Interaktiva element för att sätta status för kontrollpunkten (om granskning ej `locked`):
            *   Alternativ 1: "Stämmer" (villkoret är uppfyllt och relevant). Ikon placeras till höger om texten.
            *   Alternativ 2: "Stämmer inte" (villkoret är inte uppfyllt). Ikon placeras till höger om texten.
        *   Beräknad status för kontrollpunkten visas.
        *   Om "Stämmer" är valt för kontrollpunkten, visas dess underliggande **godkännandekriterier (`passCriteria`):**
            *   Varje kriterium visas med sin text.
            *   Interaktiva element för att sätta status för varje kriterium (t.ex. "Godkänt", "Underkänt"). Statusen "Ej bedömt" ska också vara ett alternativ. Ikoner placeras till höger om texten.
        *   Om "Stämmer inte" är valt för kontrollpunkten, ska alla dess underliggande godkännandekriterier automatiskt betraktas som "Godkända" (eftersom villkoret för kontrollpunkten inte var uppfyllt), och dessa kriterier behöver då inte visas eller interageras med individuellt. En informationstext som förklarar detta bör visas.
    *   **Inmatningsfält (redigerbara om granskningen inte är `locked`):**
        *   Faktisk observation (flerradig text).
        *   Kommentar till granskare (intern, flerradig text).
        *   Kommentar till aktör (för export, flerradig text).
3.  **Statusberäkning:**
    *   Status för en kontrollpunkt beräknas baserat på den manuellt satta övergripande statusen ("Stämmer"/"Stämmer inte") och, om "Stämmer" är valt, statusen för dess godkännandekriterier (och logiken AND/OR om specificerad).
    *   Status för ett krav beräknas baserat på status för alla dess relevanta kontrollpunkter.
4.  **Navigering:**
    *   Tillbaka till kravlistvyn för det aktuella stickprovet.
    *   Knappar för "Föregående krav" och "Nästa krav" (inom samma stickprov, baserat på den sorterade listan). Ikoner till höger om texten.
    *   Knapp för "Nästa ohanterade krav" (inom samma stickprov). Ikon till höger om texten.
    *   Dessa navigeringsknappar ska endast renderas om de är funktionella (t.ex. "Föregående" visas inte för första kravet).

### 4.8 Låsa och låsa upp granskning
1.  **Låsning:** Från granskningsöversikten kan en `in_progress`-granskning låsas.
    *   Status ändras till `locked`.
    *   En sluttid (tidsstämpel, iso 8601) registreras.
    *   Inga fler ändringar i granskningsresultat, observationer, kommentarer eller stickprov är tillåtna. Alla inmatningsfält och statusändringsknappar blir skrivskyddade/inaktiva (eller renderas inte om de inte längre har funktion).
    *   Exportalternativ blir tillgängliga.
2.  **Upplåsning:** Från granskningsöversikten kan en `locked`-granskning låsas upp.
    *   Status ändras tillbaka till `in_progress`.
    *   Sluttiden nollställs.
    *   Granskningen blir återigen redigerbar (inklusive stickprovshantering).

### 4.9 Spara och ladda granskning (filbaserat)
1.  **Spara:** Användaren ska kunna spara ner hela det aktuella granskningstillståndet (inklusive regelfilsinnehåll, metadata, stickprov och alla resultat) som en json-fil till sin lokala dator. Filnamnet bör genereras dynamiskt för att inkludera t.ex. ärendenummer, aktör och datum.
2.  **Ladda:** Från startvyn ska användaren kunna ladda upp en tidigare sparad json-granskningsfil. Applikationen ska validera filens grundläggande struktur och sedan återställa hela granskningstillståndet.

### 4.10 Export av resultat (status: `locked`)
1.  **Tillgänglighet:** Exportfunktioner är endast tillgängliga när granskningen är `locked`.
2.  **Format:**
    *   **Csv:** En eller flera csv-filer som på ett strukturerat sätt presenterar resultaten. Detaljer om kolumner och filstruktur behöver specificeras närmare (t.ex. en rad per krav per stickprov, eller en mer sammanfattande).
    *   **Xlsx (excel):** En excel-fil med resultaten, potentiellt uppdelad på flera flikar (t.ex. en för allmän information, en för detaljerade resultat). Innehållet liknar csv men i ett mer användarvänligt format. Ska inkludera metadata, stickprovsinformation, krav, status, observationer och kommentarer.

## 5. Vystruktur (logisk indelning)

*   **Startvy (`upload`):** Ladda upp regelfil eller sparad granskning.
*   **Metadata-vy (`metadata`):** Ange/visa granskningsmetadata.
*   **Initial stickprovshanteringsvy (`sample_management`):** Lägg till/visa/redigera stickprov *innan* granskningen startas.
*   **Granskningsöversiktsvy (`audit_overview`):** Översikt av metadata, stickprovslista (med möjlighet till modifiering om granskning pågår), total progress, åtgärdsknappar (lås/export etc.).
*   **Kravlistvy (`requirement_list`):** Lista och gruppera krav för ett specifikt stickprov.
*   **Kravgranskningsvy (`requirement_audit`):** Granska ett enskilt krav för ett specifikt stickprov med alla dess detaljer och inmatningsfält.

## 6. Datahantering och lagring

### 6.1 Huvudsakligt granskningsobjekt (`current_audit`)
Detta är det centrala objektet som lagras (t.ex. i `sessionStorage` och vid export till fil). Det innehåller:
*   `saveFileVersion`: Applikationens interna versioneringsnummer för sparfilformatet.
*   `ruleFileContent`: Hela innehållet från den uppladdade json-regelfilen.
*   `auditMetadata`: Objekt med metadata (ärendenummer, aktör, etc.).
*   `auditStatus`: Sträng som indikerar granskningens nuvarande tillstånd (`not_started`, `in_progress`, `locked`).
*   `startTime`: Iso 8601 tidsstämpel för när granskningen startades.
*   `endTime`: Iso 8601 tidsstämpel för när granskningen låstes.
*   `samples`: En array av stickprovsobjekt.

### 6.2 Stickprovsobjekt (inom `samples`-arrayen)
Varje objekt representerar ett stickprov och innehåller:
*   `id`: Unikt id för stickprovet (t.ex. uuid).
*   `pageType`: Sträng (från regelfilens `pageTypes`).
*   `description`: Sträng (användarens namn på stickprovet).
*   `url`: Sträng (url till stickprovet).
*   `selectedContentTypes`: Array av strängar (id:n från regelfilens `contentTypes`).
*   `requirementResults`: Ett objekt där nycklarna är krav-id:n (från regelfilen) och värdena är resultatobjekt (se nedan) för det specifika kravet och detta stickprov.

### 6.3 Resultatobjekt (inom `requirementResults`)
Varje objekt representerar resultatet för ett enskilt krav på ett enskilt stickprov:
*   `status`: Sträng som indikerar kravets status för detta stickprov (`passed`, `failed`, `partially_audited`, `not_audited`).
*   `actualObservation`: Sträng (användarens observation).
*   `commentToAuditor`: Sträng (intern kommentar).
*   `commentToActor`: Sträng (kommentar för export).
*   `lastStatusUpdate`: Iso 8601 tidsstämpel för senaste ändring av detta resultat.
*   `checkResults`: Ett objekt där nycklarna är id:n för kontrollpunkter (`check.id` från regelfilen) och värdena är objekt som innehåller:
    *   `overallStatus`: Sträng (`passed`, `failed`, `not_audited`) – manuellt satt för kontrollpunkten.
    *   `status`: Sträng (beräknad status för kontrollpunkten).
    *   `passCriteria`: Ett objekt där nycklarna är id:n för godkännandekriterier (`passCriterion.id`) och värdena är objekt med:
        *   `status`: Sträng (`passed`, `failed`, `not_audited`).
        *   `observationDetail`: Sträng (användarens observation för detta godkännandekriterium).
        *   `timestamp`: Iso 8601 tidsstämpel för senaste ändring.
        *   `attachedMediaFilenames`: Array av strängar (filnamn för bifogade bilder eller videor, ett per rad i modalen).

### 6.4 Lagringsmekanismer
*   **Session storage:** För att automatiskt spara `current_audit`-objektet och behålla tillståndet vid sidomladdning.
*   **Local storage:** För användarpreferenser som valt tema och språk.
*   **Filnedladdning/-uppladdning:** För manuell export och import av hela `current_audit`-objektet som json.

## 7. Tillgänglighet (wcag 2.2 aa mål)

*   Applikationen ska sträva efter att uppfylla Web Content Accessibility Guidelines (wcag) 2.2 på nivå aa.
*   **Interaktiva element:** Knappar och andra kontroller ska inte använda html-attributet `disabled`. Icke-funktionella kontroller ska inte renderas alls. Om ett element måste visas men vara inaktivt av annan anledning, ska `aria-disabled="true"` och tydlig visuell styling användas.
*   **Tangentbordsnavigering:** Fullständig navigering och interaktion med applikationens alla funktioner ska vara möjlig enbart med tangentbord. Fokusordning ska vara logisk och förutsägbar. Fokusindikatorer ska vara tydliga.
*   **Färgkontrast:** Tillräcklig färgkontrast ska säkerställas för text och ui-komponenter enligt wcag aa-kraven, både i ljust och mörkt tema.
*   **Semantisk html:** Använd korrekt html-semantik för struktur och komponenter.
*   **Aria-attribut:** Använd aria-attribut där det behövs för att förbättra tillgängligheten för dynamiskt innehåll och anpassade kontroller (t.ex. `aria-live` för meddelanden, `aria-label` för ikoner utan synlig text, `aria-pressed` för växlingsknappar).
*   **Fokushantering:** Vid öppning/stängning av modaler/dialoger (t.ex. bekräftelse vid radering av stickprov) ska fokus hanteras korrekt (flyttas till dialogen, fångas inuti, och återställas när den stängs). Ikoner i knappar ska placeras till höger om texten (med undantag för globala navigeringsknappar som "Tillbaka").

## 8. Kodstruktur och moduler (exempel på nuvarande implementation)

*   `index.html`: Minimalt startdokument.
*   `css/style.css`: Globala stilar och css-variabler.
*   `css/components/`: Komponentspecifika css-filer.
*   `js/main.js`: Huvudlogik för applikationen, routing, initiering av vyer.
*   `js/state.js`: Hantering av applikationens tillstånd (`current_audit`).
*   `js/audit_logic.js`: Logik för att beräkna status för krav och kontrollpunkter.
*   `js/export_logic.js`: Logik för att exportera data till csv/xlsx.
*   `js/validation_logic.js`: Validering av regelfiler och sparade granskningsfiler.
*   `js/translation_logic.js`: Hantering av internationalisering.
*   `js/utils/helpers.js`: Allmänna hjälpfunktioner.
*   `js/i18n/`: Json-filer för språköversättningar (t.ex. `sv-SE.json`, `en-GB.json`).
*   `js/components/`: Återanvändbara ui-komponenter (t.ex. för vyer, formulär, listor). Varje komponent är en ES6-modul som exporterar ett objekt med `init({ root, deps })`, `render()`, och `destroy()` metoder. Komponenter använder INTE IIFE.

## 9. Internationalisering (i18n) – Detaljer

*   All ui-text ska hämtas via en översättningsfunktion (t.ex. `Translation.t("nyckel")`).
*   Platshållare i översättningssträngar (t.ex. `{count}`) ska stödjas.
*   Applikationen ska dynamiskt kunna uppdatera all text vid språkbyte utan att sidan behöver laddas om helt.
*   Språkval ska kunna sparas (t.ex. i `localStorage`) och återställas vid nästa besök.
*   Webbläsarens förvalda språk bör användas som initialt språk om möjligt, med fallback till ett standardspråk (t.ex. svenska).

## 10. Json regelfil – Schema och validering

Regelfilen är grunden för granskningen och måste följa ett definierat schema.
*   **Toppnivå:** Ett json-objekt med två obligatoriska nycklar: `metadata` (objekt) och `requirements` (objekt).
*   **`metadata` (objekt):**
    *   `title` (sträng, obligatorisk, ej tom): Titel på regelfilen/standarden.
    *   `version` (sträng, frivillig): Version av regelfilen.
    *   `pageTypes` (array av strängar, obligatorisk, ej tomma strängar): Lista över definierade sidtyper som kan väljas för stickprov (t.ex. "Startsida", "Produktsida", "Kontaktformulär").
    *   `contentTypes` (array av objekt, obligatorisk): Lista över innehållstyper som krav kan kopplas till. Varje objekt måste ha:
        *   `id` (sträng, obligatorisk, unikt, ej tom): Kort identifierare för innehållstypen.
        *   `text` (sträng, obligatorisk, ej tom): Beskrivande text för innehållstypen (t.ex. "Tabeller", "Formulär", "Video").
*   **`requirements` (objekt):**
    *   Varje nyckel i detta objekt är ett unikt krav-id (t.ex. `"wcag-1.1.1"`). Detta id används för att referera till kravet internt och i resultatdata.
    *   Värdet för varje nyckel är ett **kravobjekt** som innehåller:
        *   `id` (sträng, obligatorisk, måste matcha nyckeln i `requirements`-objektet, ej tom).
        *   `key` (sträng, obligatorisk, måste matcha nyckeln i `requirements`-objektet, ej tom). _Överväg att endast använda `id` och låta nyckeln i `requirements`-objektet vara detta `id` för att minska redundans._
        *   `title` (sträng, obligatorisk, ej tom): Kravets titel/rubrik.
        *   `expectedObservation` (sträng, obligatorisk): Beskrivning av vad som förväntas observeras.
        *   `instructions` (sträng eller array av strängar, frivillig): Granskningsinstruktioner.
        *   `tips` (sträng eller array av strängar, frivillig): Tips för granskaren.
        *   `exceptions` (sträng eller array av strängar, frivillig): Eventuella undantag för kravet.
        *   `commonErrors` (sträng eller array av strängar, frivillig): Vanliga fel relaterade till kravet.
        *   `contentType` (array av strängar, obligatorisk): Lista med id:n från `metadata.contentTypes` som detta krav är relevant för. Om arrayen är tom (`[]`), antas kravet vara relevant för **alla** stickprov.
        *   `metadata` (objekt, frivillig): Ytterligare metadata om kravet:
            *   `mainCategory` (objekt, frivillig): `{ "id": "unik-id-huvudkategori", "text": "Text för huvudkategori" }`
            *   `subCategory` (objekt, frivillig): `{ "id": "unik-id-underkategori", "text": "Text för underkategori" }`
            *   `impact` (objekt, frivillig): `{ "isCritical": true/false }` (anger om kravet har kritisk påverkan).
            *   `standardReference` (objekt, frivillig): `{ "text": "WCAG 2.1 Success Criterion 1.1.1", "url": "https://www.w3.org/TR/WCAG21/#non-text-content" }` (länk till relevant standard).
        *   `checks` (array av objekt, obligatorisk): Lista över kontrollpunkter för kravet. Varje **kontrollpunktsobjekt** innehåller:
            *   `id` (sträng, obligatorisk, unikt inom kravet, ej tom).
            *   `condition` (sträng, obligatorisk, ej tom): Villkoret som ska kontrolleras.
            *   `logic` (sträng, frivillig, antingen "AND" eller "OR"): Hur resultaten från `passCriteria` ska kombineras. Default är "AND".
            *   `passCriteria` (array av objekt, obligatorisk, kan vara tom): Lista över godkännandekriterier. Varje **godkännandekriterieobjekt** innehåller:
                *   `id` (sträng, obligatorisk, unikt inom kontrollpunkten, ej tom).
                *   `requirement` (sträng, obligatorisk, ej tom): Texten för kriteriet.
*   Validering av regelfilen ska ske vid uppladdning och ge tydliga felmeddelanden till användaren om schemat inte följs.

## 11. Potentiella framtida utökningar (ej del av nuvarande scope)
*   Mer avancerad sortering och filtrering av listor.
*   Drag-and-drop-funktionalitet.
*   Realtidssamarbete (skulle kräva en backend-lösning).
*   Mer avancerad och anpassningsbar rapportgenerering.
*   Integration med externa system.
*   Stöd för att bifoga filer till observationer.
*   Utökad testhantering och rapportering direkt i verktyget.