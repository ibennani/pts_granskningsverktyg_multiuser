# Användarmanual: Leffe

**Version:** 2.1.0
**Datum:** 2026-03-27

## Välkommen!

Denna manual hjälper dig att använda **Leffe** – ett webbaserat verktyg för digital tillsyn. Verktyget är designat för att underlätta processen med att granska webbsidor och digitala tjänster mot en given uppsättning regler (en regelfil).

### Vad är Leffe?

Leffe är en modern webbapplikation som stöder hela processen från regelfilsuppladdning till slutlig rapportgenerering. Verktyget är designat för att vara användarvänligt, tillgängligt och effektivt för granskare som arbetar med digital tillsyn.

### Huvudfunktioner

- **Regelfilshantering**: Ladda upp och validera JSON-baserade regelfiler
- **Granskningsdelshantering**: Definiera och hantera granskningsdel för granskning
- **Strukturerad granskning**: Systematisk bedömning av krav enligt regelfilen
- **Dokumentation**: Observera och kommentera brister och förbättringsområden
- **Export**: Generera rapporter i CSV, Excel och Word-format
- **Språkstöd**: Svenska och engelska
- **Responsiv design**: Fungerar på desktop och mobil

## Innehållsförteckning

1.  [Systemkrav](#1-systemkrav)
2.  [Komma igång](#2-komma-igång)
    *   [Starta en ny granskning](#21-starta-en-ny-granskning)
    *   [Ladda en tidigare sparad granskning](#22-ladda-en-tidigare-sparad-granskning)
3.  [Mata in metadata](#3-mata-in-metadata)
4.  [Hantera granskningsdel (innan granskning startas)](#4-hantera-granskningsdel-innan-granskning-startas)
    *   [Lägga till ett ny granskningsdel](#41-lägga-till-ett-nytt-granskningsdel)
    *   [Visa och redigera granskningsdel](#42-visa-och-redigera-granskningsdel)
    *   [Radera en granskningsdel](#43-radera-ett-granskningsdel)
5.  [Starta granskningen](#5-starta-granskningen)
6.  [Granskningsöversikten](#6-granskningsöversikten)
    *   [Granskningsinformation](#61-granskningsinformation)
    *   [Granskningsdelslista och progress](#62-granskningsdelslista-och-progress)
    *   [Hantera granskningsdel under pågående granskning](#63-hantera-granskningsdel-under-pågående-granskning)
    *   [Globala åtgärder för granskningen](#64-globala-åtgärder-för-granskningen)
7.  [Granska krav](#7-granska-krav)
    *   [Kravlistvyn](#71-kravlistvyn)
    *   [Kravgranskningsvyn](#72-kravgranskningsvyn)
        *   [Bedöma kontrollpunkter](#721-bedöma-kontrollpunkter)
        *   [Bedöma godkännandekriterier](#722-bedöma-godkännandekriterier)
        *   [Dokumentera observationer och kommentarer](#723-dokumentera-observationer-och-kommentarer)
        *   [Navigera mellan krav](#724-navigera-mellan-krav)
8.  [Låsa och låsa upp granskningen](#8-låsa-och-låsa-upp-granskningen)
9.  [Spara och ladda granskning till/från fil](#9-spara-och-ladda-granskning-tillfrån-fil)
10. [Exportera resultat](#10-exportera-resultat)
11. [Byta språk och tema](#11-byta-språk-och-tema)
12. [Felsökning och tips](#12-felsökning-och-tips)

---

## 1. Systemkrav

### Minimi-krav

För att använda Leffe behöver du:

*   **Webbläsare**: En modern webbläsare med stöd för ES6-moduler
  - Google Chrome 90+ (rekommenderat)
  - Mozilla Firefox 88+
  - Microsoft Edge 90+
  - Safari 14+ (macOS)
*   **JavaScript**: Måste vara aktiverat i din webbläsare
*   **Internetanslutning**: För att ladda ner verktyget (endast första gången)
*   **Regelfil**: En regelfil i JSON-format (om du startar en ny granskning)

### Rekommenderade specifikationer

*   **Skärmupplösning**: Minst 1024x768 pixlar (1920x1080 rekommenderat)
*   **RAM**: Minst 4 GB (8 GB rekommenderat)
*   **Diskutrymme**: Minst 100 MB för temporära filer

### Tillgänglighet

Verktyget stöder:
*   **Tangentbordsnavigering**: Alla funktioner kan användas med tangentbord
*   **Skärmläsare**: Kompatibelt med skärmläsare som NVDA, JAWS och VoiceOver
*   **Färgkontrast**: Hög kontrast för bättre läsbarhet
*   **Zoom**: Stöder webbläsarens zoom-funktioner

Applikationen körs helt i din webbläsare och kräver ingen installation av programvara.

## 2. Komma igång

När du öppnar applikationen möts du av startvyn. Om applikationen är ansluten till en server visas en tabell över alla granskningar. Annars visas information om att servern inte är tillgänglig.

### 2.1 Öppna en befintlig granskning
När servern är tillgänglig visas en tabell med kolumnerna Diarienummer, Aktörens namn, Status, Progress, Bristindex, Granskare och Ladda ner:
1.  Klicka på aktörens namn (eller diarienumret om aktörens namn saknas) för att öppna granskningen.
2.  Du navigeras till granskningsöversikten.
3.  Kolumnen **"Ladda ner"** innehåller en knapp för att ladda ner granskningen som JSON-fil till din dator. Saknad data i tabellen visas som "—".

### 2.2 Starta en ny granskning
1.  Gå till **Admin** via sidomenyn.
2.  Klicka på **"Starta ny granskning"** och välj en regelfil från listan (eller ladda upp en ny regelfil först via knappen "Ladda upp").
3.  Om regelfilen är giltig skapas en ny granskning och du navigeras till vyn för att mata in metadata.
4.  Om filen är ogiltig visas ett felmeddelande.

### 2.3 Ladda upp en sparad granskning
Om du har en sparad granskning som JSON-fil:
1.  Gå till **Admin** via sidomenyn.
2.  Klicka på **"Ladda upp"** och välj den sparade granskningsfilen (`.json`).
3.  Om filen är giltig importeras granskningen och du kan öppna den från startvyns lista.

## 3. Mata in metadata

Efter att du har laddat en ny regelfil kommer du till vyn för metadata. Här kan du ange allmän information om granskningen.
Följande fält finns (alla är frivilliga):
*   **Ärendenummer:** Ett internt ärendenummer för granskningen.
*   **Aktör:** Namnet på den organisation eller webbplats som granskas.
*   **Länk till aktör:** Webbplatsadressen (url) till det som granskas.
*   **Ansvarig granskare:** Namnet på den som utför granskningen.
*   **Intern kommentar:** Ett fält för dina egna anteckningar om granskningen. Denna kommentar inkluderas inte i exporterade rapporter till aktören.

När du är klar, klicka på **"Fortsätt till granskningsdel"**.
**Notera:** Metadata kan redigeras när som helst – både innan granskningen startats och under pågående granskning. På granskningsöversikten finns en knapp **"Redigera"** i granskningsinfopanelens header som öppnar metadataformuläret.

## 4. Hantera granskningsdel (innan granskning startas)

I denna vy definierar du de specifika sidor, vyer eller komponenter (granskningsdel) som ska ingå i din granskning.

### 4.1 Lägga till ett ny granskningsdel
1.  Om formuläret för att lägga till granskningsdel inte visas direkt, klicka på knappen **"Lägg till ny granskningsdel"**.
2.  Fyll i formuläret:
    *   **Typ av sida:** Välj från listan (t.ex. "Startsida", "Artikel"). Listan baseras på din uppladdade regelfil. Detta är ett obligatoriskt fält. När du väljer en sidtyp kan fältet "Beskrivning" fyllas i automatiskt, men du kan ändra det.
    *   **Beskrivning (granskningsdelens namn):** Ge granskningsdelen ett tydligt och unikt namn (t.ex. "Kontaktsida med formulär"). Detta är ett obligatoriskt fält.
    *   **Url:** Ange den fullständiga webbadressen till granskningsdelen (om relevant).
    *   **Innehållstyper:** Kryssa i de typer av innehåll som finns på eller är relevanta för denna granskningsdel (t.ex. "Tabeller", "Video", "Formulär"). Minst en innehållstyp måste väljas. De krav som granskas för granskningsdelen baseras på dessa val.
3.  Klicka på **"Spara granskningsdelen"**. Granskningsdelen läggs då till i listan "Tillagda granskningsdel".

### 4.2 Visa och redigera granskningsdel
*   Alla tillagda granskningsdel visas i en lista. För varje granskningsdel ser du dess namn, typ, url och valda innehållstyper.
*   För att redigera en granskningsdel, klicka på knappen **"Redigera granskningsdel"** (ofta en penna-ikon) för den aktuella granskningsdelen. Formuläret visas då ifyllt med granskningsdelens nuvarande information. Gör dina ändringar och klicka på **"Spara ändringar"**.
*   Om du vill se listan igen medan formuläret är öppet, klicka på **"Visa befintliga granskningsdel"**.

### 4.3 Radera en granskningsdel
*   För att radera en granskningsdel, klicka på knappen **"Radera granskningsdel"** (ofta en soptunna-ikon) för den aktuella granskningsdelen.
*   Du kommer att få en bekräftelsefråga. Klicka "OK" för att radera, eller "Avbryt".
*   **Notera:** Du kan inte radera den sista granskningsdelen. En granskning måste ha minst en granskningsdel för att kunna startas. Om endast en granskningsdel finns, kommer raderingsknappen inte att visas.

## 5. Starta granskningen

När du har lagt till alla önskade granskningsdel och är nöjd med metadata:
1.  Från vyn "Hantera granskningsdel", klicka på knappen **"Starta granskning"**.
    *   Denna knapp är endast aktiv om du har lagt till minst en granskningsdel.
2.  Granskningens status ändras nu till "Pågående".
3.  Du navigeras till **granskningsöversikten**. Metadata kan fortfarande redigeras via knappen "Redigera" i granskningsinfopanelens header.

## 6. Granskningsöversikten

Detta är din centrala vy när en granskning är pågående eller har avslutats (låsts).

### 6.1 Granskningsinformation
Högst upp visas allmän information om granskningen, såsom ärendenummer, aktör, ansvarig granskare, regelfilens titel och version, samt starttid och aktuell status för granskningen. Du ser även en progressbar som visar den totala framstegen för alla granskningsdelar. Knappen **"Redigera"** i panelens header öppnar metadataformuläret så att du kan ändra ärendenummer, aktör, granskare m.m. även under pågående granskning.

### 6.2 Granskningsdelslista och progress
*   Rubriken **"Tillagda granskningsdel: X st"** visar hur många granskningsdel som ingår i granskningen.
*   Under rubriken listas alla dina granskningsdel. För varje granskningsdel visas:
    *   Namn/Beskrivning.
    *   Typ av sida.
    *   Url (om angiven, klickbar för att öppna i ny flik).
    *   Antal granskade krav / totalt antal relevanta krav för just det granskningsdelen, samt en progressbar.
    *   Valda innehållstyper.
    *   **Knappar per granskningsdel:**
        *   **"Redigera granskningsdel"**: (Endast om granskningen är "Pågående") Låter dig ändra granskningsdelens detaljer.
        *   **"Radera granskningsdel"**: (Endast om granskningen är "Pågående" och det finns fler än en granskningsdel) Låter dig ta bort granskningsdelen. En bekräftelsedialog visas.
        *   **"Visa alla krav"**: Tar dig till en lista över alla krav som är relevanta för denna granskningsdel.
        *   **"Granska nästa" / "Visa resultat"**: Tar dig till det första ogranskade kravet för granskningsdelen. Om alla krav är hanterade ändras texten, och knappen tar dig till kravlistan.
        *   **"Besök"**: Öppnar granskningsdelens url i en ny flik (om url är angiven).

### 6.3 Hantera granskningsdel under pågående granskning
När en granskning har status "Pågående" kan du fortfarande modifiera dina granskningsdel från granskningsöversikten:
*   **Lägg till ny granskningsdel:** Klicka på knappen **"Lägg till ny granskningsdel"** (ofta bredvid rubriken för granskningsdelslistan). Ett formulär visas där du kan fylla i detaljerna för det nya granskningsdelen. Klicka på "Spara granskningsdelen" när du är klar.
*   **Redigera granskningsdel:** Klicka på knappen **"Redigera granskningsdel"** för det granskningsdel du vill ändra. Formuläret visas med granskningsdelens nuvarande data. Gör dina ändringar och klicka på "Spara ändringar".
*   **Radera granskningsdel:** Klicka på knappen **"Radera granskningsdel"**. Kom ihåg att minst en granskningsdel måste finnas kvar.

### 6.4 Globala åtgärder för granskningen
Längst ner i granskningsöversikten finns knappar för åtgärder som gäller hela granskningen:
*   **"Spara granskning till fil"**: Låter dig när som helst spara ner hela den aktuella granskningen som en json-fil på din dator.
*   **Om granskningen är "Pågående":**
    *   **"Lås och avsluta granskningen"**: Klicka här när du är helt klar med granskningen. Statusen ändras till "Låst", en sluttid registreras, och inga fler ändringar kan göras. Exportalternativ blir tillgängliga.
*   **Om granskningen är "Låst":**
    *   **"Lås upp granskning"**: Om du behöver göra ytterligare ändringar. Statusen återgår till "Pågående".
    *   **"Exportera till csv"**: Genererar en eller flera csv-filer med granskningsresultaten.
    *   **"Exportera till excel"**: Genererar en excel-fil (xlsx) med granskningsresultaten.

### 6.5 Tekniska snapshots (Åtgärder → Snapshots)

Under **Åtgärder** finns undersidan **Snapshots**. Där listas tekniska ögonblicksbilder som skapats när du använt **Hämta information** i en granskningsdel.

1. När du kör Hämta information i formuläret för en granskningsdel hämtas sidtitel och skärmavbild som tidigare. Samtidigt startar verktyget en snapshot i bakgrunden.
2. Du behöver inte vänta på snapshoten. Modalen visar fortfarande bara de två stegen sidtitel och skärmavbild.
3. Gå till **Åtgärder → Snapshots** för att se status per granskningsdel: väntar, hämtar, skapar snapshot, färdig eller misslyckades.
4. När en snapshot är färdig kan du ladda ner den som zip-fil. Du kan också ladda ner alla färdiga snapshots i en zip-fil.

Snapshoten innehåller teknisk information om sidan (till exempel HTML, nätverkslogg och skärmavbild). Den fångas med serverns webbläsare och speglar inte din inloggning eller cookies i din egen webbläsare.

## 7. Granska krav

### 7.1 Kravlistvyn
När du klickar på "Visa alla krav" för en granskningsdel i granskningsöversikten, kommer du till kravlistvyn.
*   Här visas information om det valda granskningsdelen.
*   Alla krav som är relevanta för granskningsdelen listas, grupperade efter huvudkategori och underkategori.
*   För varje krav ser du dess titel, status (Godkänt, Underkänt, etc.), antal hanterade kontrollpunkter och eventuell standardreferens.
*   Klicka på ett kravs titel för att gå till detaljerad granskning av det kravet.
*   En knapp finns för att navigera tillbaka till granskningsöversikten.

### 7.2 Kravgranskningsvyn
Detta är vyn där du bedömer ett enskilt krav mot den aktuella granskningsdelen. Den innehåller flera sektioner:
*   **Kravinformation:** Kravets titel, standardreferens och den övergripande statusen för kravet på denna granskningsdel.
*   **Beskrivande texter från regelfilen:** Förväntad observation, Instruktioner, Tips, Undantag, Vanliga fel (om de finns).
*   **Kravets metadata:** Huvudkategori, underkategori, påverkan.

#### 7.2.1 Bedöma kontrollpunkter
Under rubriken "Kontrollpunkter" listas ett eller flera villkor (`condition`) som ska bedömas.
För varje kontrollpunkt:
1.  Läs villkoret.
2.  Bedöm om villkoret stämmer för det du granskar:
    *   Klicka på **"Stämmer"** (grön knapp, ofta med en bock- eller cirkel-ikon till höger) om villkoret är uppfyllt och relevant.
    *   Klicka på **"Stämmer inte"** (röd knapp, ofta med ett kryss- eller avbryt-ikon till höger) om villkoret inte är uppfyllt.
    *   Om du klickar på samma knapp igen av väljs statusen (återgår till "Ej granskat" för kontrollpunkten).
3.  Statusen för kontrollpunkten uppdateras automatiskt baserat på ditt val och (om "Stämmer" valts) bedömningen av dess godkännandekriterier.

#### 7.2.2 Bedöma godkännandekriterier
Om du har klickat **"Stämmer"** för en kontrollpunkt, och den kontrollpunkten har underliggande godkännandekriterier, visas dessa:
1.  För varje kriterium, läs texten.
2.  Bedöm om kriteriet är uppfyllt:
    *   Klicka på **"Godkänt"** (grön knapp, ofta med en tumme-upp-ikon till höger).
    *   Klicka på **"Underkänt"** (röd knapp, ofta med en tumme-ner-ikon till höger).
    *   Om du klickar på samma knapp igen av väljs statusen för kriteriet.
3.  Statusen för kontrollpunkten, och därmed för hela kravet, uppdateras automatiskt baserat på dina bedömningar av kriterierna.

**Viktigt:** Om du markerar en kontrollpunkt som **"Stämmer inte"**, kommer alla dess underliggande godkännandekriterier automatiskt att anses som godkända (eftersom själva villkoret för kontrollpunkten inte var relevant eller uppfyllt). Du behöver då inte bedöma dem individuellt.

#### 7.2.3 Dokumentera observationer och kommentarer
Under kontrollpunkterna finns textfält för att dokumentera ditt arbete:
*   **Faktisk observation:** Beskriv vad du faktiskt observerade när du granskade detta krav på granskningsdelen.
*   **Kommentar till granskare:** Dina interna anteckningar som inte följer med i exporten till den granskade aktören.
*   **Kommentar till aktör:** Kommentarer som kommer att inkluderas i den exporterade rapporten till aktören.

Dessa fält sparas automatiskt när du skriver i dem.

#### 7.2.4 Navigera mellan krav
Längst upp och längst ner i vyn finns navigeringsknappar:
*   **"Tillbaka till kravlistan"**: Tar dig tillbaka till listan över alla krav för den aktuella granskningsdelen.
*   **"Föregående krav"**: Går till föregående krav i listan för samma granskningsdel. Visas inte om du är på det första kravet. Ikon till höger.
*   **"Nästa krav"**: Går till nästa krav i listan. Visas inte om du är på det sista kravet. Ikon till höger.
*   **"Nästa ohanterade krav"**: Hoppar till nästa krav i listan som ännu inte är fullständigt bedömt (status "Ej granskat" eller "Delvis granskad"). Om alla krav är hanterade visas inte denna knapp. Ikon till höger.

## 8. Låsa och låsa upp granskningen

När du har gått igenom alla krav för alla granskningsdelar och är klar med dina bedömningar och kommentarer, kan du låsa granskningen.
*   **Låsa:** Gå till **granskningsöversikten**. Klicka på knappen **"Lås och avsluta granskningen"**. Granskningens status ändras till "Låst". Inga fler ändringar kan göras i bedömningar, kommentarer eller granskningsdel. Nu kan du exportera resultaten.
*   **Låsa upp:** Om du behöver göra ändringar i en låst granskning, gå till **granskningsöversikten** och klicka på **"Lås upp granskning"**. Statusen återgår till "Pågående" och du kan redigera igen.

## 9. Spara och ladda granskning till/från fil

Eftersom applikationen körs helt i din webbläsare sparas ditt arbete i den aktuella webbläsarsessionen (`sessionStorage`). Om du stänger webbläsarfliken eller webbläsaren kan arbetet gå förlorat om det inte sparats till fil.
*   **Spara till fil:** Från **granskningsöversikten**, klicka på **"Spara granskning till fil"**. En json-fil med hela din granskningsdata kommer att laddas ner till din dator. Spara denna fil på en säker plats. Gör detta regelbundet under längre granskningssessioner.
*   **Ladda från fil:** Gå till **Admin** via sidomenyn och klicka på **"Ladda upp"** för att importera en sparad granskning. Du kan också använda **"Ladda ner"**-knappen i startvyns tabell för att ladda ner en granskning som JSON-fil.

## 10. Exportera resultat

När en granskning är **låst** kan du exportera resultaten. Från **granskningsöversikten**:
*   Klicka på **"Exportera till csv"** för att få resultaten som en eller flera textfiler i komma-separerat format.
*   Klicka på **"Exportera till excel"** för att få resultaten som en excel-fil (.xlsx), ofta med olika flikar för information och resultat.
*   Klicka på **"Exportera till Word (krav)"** för att få en formaterad Word-rapport sorterad på krav.
*   Klicka på **"Exportera till Word (granskningsdel)"** för att få en formaterad Word-rapport sorterat på granskningsdel.
*   Klicka på **"Exportera till HTML"** för att få en HTML-rapport för webbvisning.

De exporterade filerna innehåller metadata, information om granskningsdel, och detaljerade resultat för varje granskat krav, inklusive dina observationer och kommentarer till aktören.

## 11. Byta språk och tema

### Språkväxling

Längst upp till höger i applikationen finns en språkväljare:
*   **Språkväljare:** En dropdown-lista där du kan välja mellan tillgängliga språk (Svenska, English)
*   **Automatisk uppdatering:** Gränssnittet uppdateras direkt när du byter språk
*   **Sparat val:** Ditt språkval sparas för framtida sessioner
*   **Standard:** Applikationen använder webbläsarens språkinställning som standard

### Temaväxling

Verktyget stöder både ljust och mörkt tema:
*   **Temaväxlare:** En knapp för att växla mellan ljust och mörkt färgschema
*   **Automatisk detektering:** Applikationen använder ditt operativsystems temainställning som standard
*   **Sparat val:** Ditt temaval sparas för framtida sessioner
*   **Tillgänglighet:** Båda temana uppfyller WCAG 2.2 AA-kraven för färgkontrast

### Anpassning

*   **Zoom:** Använd webbläsarens zoom-funktioner (Ctrl/Cmd + +/-)
*   **Skärmläsare:** Verktyget är optimerat för skärmläsare
*   **Tangentbord:** Alla funktioner kan användas med tangentbord

## 12. Felsökning och tips

### Vanliga problem och lösningar

**Problem: Applikationen laddas inte**
*   Kontrollera att JavaScript är aktiverat i din webbläsare
*   Prova att ladda om sidan (F5 eller Ctrl+R)
*   Kontrollera att du använder en modern webbläsare

**Problem: Filuppladdning misslyckas**
*   Kontrollera att din regelfil eller sparade granskningsfil är i korrekt JSON-format
*   Eventuella felmeddelanden kan ge ledtrådar om vad som är fel
*   Kontrollera att filen inte är korrupt eller för stor

**Problem: Konstigt utseende eller funktion**
*   Prova att göra en "hård omladdning" av sidan (Ctrl+Shift+R eller Cmd+Shift+R)
*   Rensa webbläsarens cache och cookies
*   Kontrollera att du använder en kompatibel webbläsare

**Problem: Långsam prestanda**
*   Stäng andra flikar och program som använder mycket minne
*   Kontrollera att du har tillräckligt med RAM
*   Prova att använda en annan webbläsare

### Bästa praxis

*   **Spara ofta:** Använd funktionen "Spara granskning till fil" regelbundet för att inte förlora arbete
*   **Backup:** Skapa regelbundna säkerhetskopior av dina granskningar
*   **Uppdateringar:** Håll din webbläsare uppdaterad för bästa prestanda
*   **Stabilitet:** Undvik att stänga webbläsaren oväntat under pågående granskning

### Support

Om du stöter på problem som du inte kan lösa:
*   Kontrollera att du använder en kompatibel webbläsare
*   Kontakta den som tillhandahåller verktyget för support
*   Inkludera information om din webbläsare och operativsystem
*   Beskriv problemet så detaljerat som möjligt