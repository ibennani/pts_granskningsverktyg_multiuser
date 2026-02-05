# Användarmanual: Granskningsverktyget

**Version:** 2.1.0
**Datum:** 2025-01-27

## Välkommen!

Denna manual hjälper dig att använda Granskningsverktyget - ett webbaserat verktyg för digital tillsyn. Verktyget är designat för att underlätta processen med att granska webbsidor och digitala tjänster mot en given uppsättning regler (en regelfil).

### Vad är Granskningsverktyget?

Granskningsverktyget är en modern webbapplikation som stöder hela processen från regelfilsuppladdning till slutlig rapportgenerering. Verktyget är designat för att vara användarvänligt, tillgängligt och effektivt för granskare som arbetar med digital tillsyn.

### Huvudfunktioner

- **Regelfilshantering**: Ladda upp och validera JSON-baserade regelfiler
- **Stickprovshantering**: Definiera och hantera stickprov för granskning
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
4.  [Hantera stickprov (innan granskning startas)](#4-hantera-stickprov-innan-granskning-startas)
    *   [Lägga till ett nytt stickprov](#41-lägga-till-ett-nytt-stickprov)
    *   [Visa och redigera stickprov](#42-visa-och-redigera-stickprov)
    *   [Radera ett stickprov](#43-radera-ett-stickprov)
5.  [Starta granskningen](#5-starta-granskningen)
6.  [Granskningsöversikten](#6-granskningsöversikten)
    *   [Granskningsinformation](#61-granskningsinformation)
    *   [Stickprovslista och progress](#62-stickprovslista-och-progress)
    *   [Hantera stickprov under pågående granskning](#63-hantera-stickprov-under-pågående-granskning)
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

För att använda Granskningsverktyget behöver du:

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

När du öppnar applikationen möts du av startvyn. Här har du två huvudsakliga val:

### 2.1 Starta en ny granskning
Om du vill påbörja en helt ny granskning:
1.  Klicka på knappen **"Starta ny granskning"**.
2.  Du kommer att uppmanas att välja en **regelfil** från din dator. Denna fil måste vara i json-format och innehålla de regler och kriterier som granskningen ska baseras på.
3.  Om regelfilen är giltig, laddas den in och du navigeras automatiskt till vyn för att mata in metadata för din nya granskning.
4.  Om filen är ogiltig visas ett felmeddelande. Försök med en annan fil eller kontrollera att filen har korrekt format.

### 2.2 Ladda en tidigare sparad granskning
Om du tidigare har sparat en pågående eller avslutad granskning som en json-fil:
1.  Klicka på knappen **"Ladda upp pågående granskning"**.
2.  Välj den sparade granskningsfilen (`.json`) från din dator.
3.  Om filen är en giltig sparad granskning, återställs hela ditt tidigare arbete och du navigeras till granskningsöversikten.
4.  Om filen är ogiltig visas ett felmeddelande.

## 3. Mata in metadata

Efter att du har laddat en ny regelfil kommer du till vyn för metadata. Här kan du ange allmän information om granskningen.
Följande fält finns (alla är frivilliga):
*   **Ärendenummer:** Ett internt ärendenummer för granskningen.
*   **Aktör:** Namnet på den organisation eller webbplats som granskas.
*   **Länk till aktör:** Webbplatsadressen (url) till det som granskas.
*   **Ansvarig granskare:** Namnet på den som utför granskningen.
*   **Intern kommentar:** Ett fält för dina egna anteckningar om granskningen. Denna kommentar inkluderas inte i exporterade rapporter till aktören.

När du är klar, klicka på **"Fortsätt till stickprov"**.
**Notera:** Metadata kan bara redigeras innan du formellt startar granskningen.

## 4. Hantera stickprov (innan granskning startas)

I denna vy definierar du de specifika sidor, vyer eller komponenter (stickprov) som ska ingå i din granskning.

### 4.1 Lägga till ett nytt stickprov
1.  Om formuläret för att lägga till stickprov inte visas direkt, klicka på knappen **"Lägg till nytt stickprov"**.
2.  Fyll i formuläret:
    *   **Typ av sida:** Välj från listan (t.ex. "Startsida", "Artikel"). Listan baseras på din uppladdade regelfil. Detta är ett obligatoriskt fält. När du väljer en sidtyp kan fältet "Beskrivning" fyllas i automatiskt, men du kan ändra det.
    *   **Beskrivning (stickprovets namn):** Ge stickprovet ett tydligt och unikt namn (t.ex. "Kontaktsida med formulär"). Detta är ett obligatoriskt fält.
    *   **Url:** Ange den fullständiga webbadressen till stickprovet (om relevant).
    *   **Innehållstyper:** Kryssa i de typer av innehåll som finns på eller är relevanta för detta stickprov (t.ex. "Tabeller", "Video", "Formulär"). Minst en innehållstyp måste väljas. De krav som granskas för stickprovet baseras på dessa val.
3.  Klicka på **"Spara stickprovet"**. Stickprovet läggs då till i listan "Tillagda stickprov".

### 4.2 Visa och redigera stickprov
*   Alla tillagda stickprov visas i en lista. För varje stickprov ser du dess namn, typ, url och valda innehållstyper.
*   För att redigera ett stickprov, klicka på knappen **"Redigera stickprov"** (ofta en penna-ikon) för det aktuella stickprovet. Formuläret visas då ifyllt med stickprovets nuvarande information. Gör dina ändringar och klicka på **"Spara ändringar"**.
*   Om du vill se listan igen medan formuläret är öppet, klicka på **"Visa befintliga stickprov"**.

### 4.3 Radera ett stickprov
*   För att radera ett stickprov, klicka på knappen **"Radera stickprov"** (ofta en soptunna-ikon) för det aktuella stickprovet.
*   Du kommer att få en bekräftelsefråga. Klicka "OK" för att radera, eller "Avbryt".
*   **Notera:** Du kan inte radera det sista stickprovet. En granskning måste ha minst ett stickprov för att kunna startas. Om endast ett stickprov finns, kommer raderingsknappen inte att visas.

## 5. Starta granskningen

När du har lagt till alla önskade stickprov och är nöjd med metadata:
1.  Från vyn "Hantera stickprov", klicka på knappen **"Starta granskning"**.
    *   Denna knapp är endast aktiv om du har lagt till minst ett stickprov.
2.  Granskningens status ändras nu till "Pågående".
3.  Metadata blir skrivskyddad.
4.  Du navigeras till **granskningsöversikten**.

## 6. Granskningsöversikten

Detta är din centrala vy när en granskning är pågående eller har avslutats (låsts).

### 6.1 Granskningsinformation
Högst upp visas allmän information om granskningen, såsom ärendenummer, aktör, ansvarig granskare, regelfilens titel och version, samt starttid och aktuell status för granskningen. Du ser även en progressbar som visar den totala framstegen för alla stickprov.

### 6.2 Stickprovslista och progress
*   Rubriken **"Tillagda stickprov: X st"** visar hur många stickprov som ingår i granskningen.
*   Under rubriken listas alla dina stickprov. För varje stickprov visas:
    *   Namn/Beskrivning.
    *   Typ av sida.
    *   Url (om angiven, klickbar för att öppna i ny flik).
    *   Antal granskade krav / totalt antal relevanta krav för just det stickprovet, samt en progressbar.
    *   Valda innehållstyper.
    *   **Knappar per stickprov:**
        *   **"Redigera stickprov"**: (Endast om granskningen är "Pågående") Låter dig ändra stickprovets detaljer.
        *   **"Radera stickprov"**: (Endast om granskningen är "Pågående" och det finns fler än ett stickprov) Låter dig ta bort stickprovet. En bekräftelsedialog visas.
        *   **"Visa alla krav"**: Tar dig till en lista över alla krav som är relevanta för detta stickprov.
        *   **"Granska nästa" / "Visa resultat"**: Tar dig till det första ogranskade kravet för stickprovet. Om alla krav är hanterade ändras texten, och knappen tar dig till kravlistan.
        *   **"Besök"**: Öppnar stickprovets url i en ny flik (om url är angiven).

### 6.3 Hantera stickprov under pågående granskning
När en granskning har status "Pågående" kan du fortfarande modifiera dina stickprov från granskningsöversikten:
*   **Lägg till nytt stickprov:** Klicka på knappen **"Lägg till nytt stickprov"** (ofta bredvid rubriken för stickprovslistan). Ett formulär visas där du kan fylla i detaljerna för det nya stickprovet. Klicka på "Spara stickprovet" när du är klar.
*   **Redigera stickprov:** Klicka på knappen **"Redigera stickprov"** för det stickprov du vill ändra. Formuläret visas med stickprovets nuvarande data. Gör dina ändringar och klicka på "Spara ändringar".
*   **Radera stickprov:** Klicka på knappen **"Radera stickprov"**. Kom ihåg att minst ett stickprov måste finnas kvar.

### 6.4 Globala åtgärder för granskningen
Längst ner i granskningsöversikten finns knappar för åtgärder som gäller hela granskningen:
*   **"Spara granskning till fil"**: Låter dig när som helst spara ner hela den aktuella granskningen som en json-fil på din dator.
*   **Om granskningen är "Pågående":**
    *   **"Lås och avsluta granskningen"**: Klicka här när du är helt klar med granskningen. Statusen ändras till "Låst", en sluttid registreras, och inga fler ändringar kan göras. Exportalternativ blir tillgängliga.
*   **Om granskningen är "Låst":**
    *   **"Lås upp granskning"**: Om du behöver göra ytterligare ändringar. Statusen återgår till "Pågående".
    *   **"Exportera till csv"**: Genererar en eller flera csv-filer med granskningsresultaten.
    *   **"Exportera till excel"**: Genererar en excel-fil (xlsx) med granskningsresultaten.

## 7. Granska krav

### 7.1 Kravlistvyn
När du klickar på "Visa alla krav" för ett stickprov i granskningsöversikten, kommer du till kravlistvyn.
*   Här visas information om det valda stickprovet.
*   Alla krav som är relevanta för stickprovet listas, grupperade efter huvudkategori och underkategori.
*   För varje krav ser du dess titel, status (Godkänt, Underkänt, etc.), antal hanterade kontrollpunkter och eventuell standardreferens.
*   Klicka på ett kravs titel för att gå till detaljerad granskning av det kravet.
*   En knapp finns för att navigera tillbaka till granskningsöversikten.

### 7.2 Kravgranskningsvyn
Detta är vyn där du bedömer ett enskilt krav mot det aktuella stickprovet. Den innehåller flera sektioner:
*   **Kravinformation:** Kravets titel, standardreferens och den övergripande statusen för kravet på detta stickprov.
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
*   **Faktisk observation:** Beskriv vad du faktiskt observerade när du granskade detta krav på stickprovet.
*   **Kommentar till granskare:** Dina interna anteckningar som inte följer med i exporten till den granskade aktören.
*   **Kommentar till aktör:** Kommentarer som kommer att inkluderas i den exporterade rapporten till aktören.

Dessa fält sparas automatiskt när du skriver i dem.

#### 7.2.4 Navigera mellan krav
Längst upp och längst ner i vyn finns navigeringsknappar:
*   **"Tillbaka till kravlistan"**: Tar dig tillbaka till listan över alla krav för det aktuella stickprovet.
*   **"Föregående krav"**: Går till föregående krav i listan för samma stickprov. Visas inte om du är på det första kravet. Ikon till höger.
*   **"Nästa krav"**: Går till nästa krav i listan. Visas inte om du är på det sista kravet. Ikon till höger.
*   **"Nästa ohanterade krav"**: Hoppar till nästa krav i listan som ännu inte är fullständigt bedömt (status "Ej granskat" eller "Delvis granskad"). Om alla krav är hanterade visas inte denna knapp. Ikon till höger.

## 8. Låsa och låsa upp granskningen

När du har gått igenom alla krav för alla stickprov och är klar med dina bedömningar och kommentarer, kan du låsa granskningen.
*   **Låsa:** Gå till **granskningsöversikten**. Klicka på knappen **"Lås och avsluta granskningen"**. Granskningens status ändras till "Låst". Inga fler ändringar kan göras i bedömningar, kommentarer eller stickprov. Nu kan du exportera resultaten.
*   **Låsa upp:** Om du behöver göra ändringar i en låst granskning, gå till **granskningsöversikten** och klicka på **"Lås upp granskning"**. Statusen återgår till "Pågående" och du kan redigera igen.

## 9. Spara och ladda granskning till/från fil

Eftersom applikationen körs helt i din webbläsare sparas ditt arbete i den aktuella webbläsarsessionen (`sessionStorage`). Om du stänger webbläsarfliken eller webbläsaren kan arbetet gå förlorat om det inte sparats till fil.
*   **Spara till fil:** Från **granskningsöversikten**, klicka på **"Spara granskning till fil"**. En json-fil med hela din granskningsdata kommer att laddas ner till din dator. Spara denna fil på en säker plats. Gör detta regelbundet under längre granskningssessioner.
*   **Ladda från fil:** Använd alternativet **"Ladda upp pågående granskning"** på applikationens startvy för att återuppta en tidigare sparad granskning.

## 10. Exportera resultat

När en granskning är **låst** kan du exportera resultaten. Från **granskningsöversikten**:
*   Klicka på **"Exportera till csv"** för att få resultaten som en eller flera textfiler i komma-separerat format.
*   Klicka på **"Exportera till excel"** för att få resultaten som en excel-fil (.xlsx), ofta med olika flikar för information och resultat.
*   Klicka på **"Exportera till Word (krav)"** för att få en formaterad Word-rapport sorterad på krav.
*   Klicka på **"Exportera till Word (stickprov)"** för att få en formaterad Word-rapport sorterat på stickprov.
*   Klicka på **"Exportera till HTML"** för att få en HTML-rapport för webbvisning.

De exporterade filerna innehåller metadata, information om stickprov, och detaljerade resultat för varje granskat krav, inklusive dina observationer och kommentarer till aktören.

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