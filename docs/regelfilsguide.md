# Regelfilsguide: Skapa och anpassa regelfiler för Leffe

**Version:** 1.1  
**Datum:** 2026-03-27

## 1. Introduktion

Denna guide beskriver formatet och strukturen för de json-regelfiler som används av **Leffe** (webbappen för digital tillsyn). En korrekt utformad regelfil är avgörande för att kunna genomföra en meningsfull och strukturerad granskning.

Regelfilen definierar bland annat:
*   Allmän information om regelverket (t.ex. titel, version).
*   Vilka typer av sidor/vyer som kan granskas (som stickprov).
*   Vilka typer av innehåll som kraven kan kopplas till (för att filtrera relevanta krav per stickprov).
*   De specifika kraven som ska granskas.
*   Kontrollpunkter och underliggande godkännandekriterier för varje krav.

Verktyget validerar den uppladdade regelfilen mot det schema som beskrivs i detta dokument. Felaktigt formaterade filer eller filer som inte följer schemat kommer att avvisas med ett felmeddelande.

## 2. Allmän json-struktur

Regelfilen måste vara en giltig json-fil (`.json`). Hela innehållet ska utgöras av ett enda json-objekt.

**Grundläggande struktur:**

{
  "metadata": {
    // Metadata om regelfilen och dess definitioner
  },
  "requirements": {
    // Definitioner av alla enskilda granskningskrav
  }
}

## 3. Toppnivåobjektet

Toppnivåobjektet i json-filen måste innehålla följande två nycklar, och båda är obligatoriska:

*   **`metadata`**: Ett objekt som innehåller allmän information om regelfilen samt definitioner av sidtyper och innehållstyper som används för att kategorisera stickprov och krav. Beskrivs i detalj i avsnitt 4.
*   **`requirements`**: Ett objekt där varje nyckel-värdepar representerar ett enskilt krav som ska kunna granskas. Beskrivs i detalj i avsnitt 5.

## 4. Metadata-objektet (`metadata`)

Objektet under nyckeln `metadata` är obligatoriskt och definierar övergripande information och klassificeringar som används i hela granskningsprocessen.

**Fält inom `metadata`:**

*   **`title`** (Sträng)
    *   **Obligatorisk:** Ja.
    *   **Beskrivning:** Titeln på regelfilen eller den standard/regelverk som granskningen baseras på (t.ex. "WCAG 2.1 AA Riktlinjer", "Interna Tillgänglighetskrav Företag X", "Webbriktlinjer version 2023").
    *   **Villkor:** Får inte vara en tom sträng.

*   **`version`** (Sträng)
    *   **Obligatorisk:** Nej (frivillig).
    *   **Beskrivning:** Ett versionsnummer eller en identifierare för denna specifika regelfil (t.ex. `"1.0.0"`, `"2024-Q2 Rev B"`). Visas i gränssnittet.

*   **`pageTypes`** (Array av strängar)
    *   **Obligatorisk:** Ja.
    *   **Beskrivning:** En lista med fördefinierade typer av webbsidor, vyer eller digitala komponenter som kan väljas när en användare skapar ett stickprov. Detta hjälper till att kategorisera stickproven.
    *   **Villkor:** Arrayen får inte vara tom. Varje sträng i arrayen ska vara en meningsfull beskrivning och får inte vara tom (t.ex. `"Startsida"`, `"Produktsida"`, `"Nyhetsartikel"`, `"Kontaktformulär"`, `"Sökresultatsida"`, `"Mobilapp - Inloggningsvy"`).

*   **`contentTypes`** (Array av objekt)
    *   **Obligatorisk:** Ja.
    *   **Beskrivning:** En lista över olika typer av innehåll eller funktionalitet som kraven kan vara specifikt relevanta för. Detta används för att filtrera fram relevanta krav för ett givet stickprov baserat på vad stickprovet innehåller.
    *   **Villkor:** Arrayen får inte vara tom. Varje objekt i arrayen måste ha följande två nycklar:
        *   **`id`** (Sträng):
            *   **Obligatorisk:** Ja.
            *   **Beskrivning:** En kort, unik identifierare för innehållstypen (t.ex. `"forms"`, `"tables"`, `"video-content"`, `"images-graphics"`, `"aria-usage"`). Denna `id` används internt för att koppla krav till innehållstyper (se `contentType` i kravobjektet).
            *   **Villkor:** Får inte vara en tom sträng och bör vara unik inom `contentTypes`-arrayen.
        *   **`text`** (Sträng):
            *   **Obligatorisk:** Ja.
            *   **Beskrivning:** En läsbar beskrivning av innehållstypen som visas för användaren i gränssnittet när de väljer innehållstyper för ett stickprov (t.ex. `"Formulär"`, `"Tabeller"`, `"Videoinnehåll"`, `"Bilder och grafik"`, `"Användning av ARIA"`).
            *   **Villkor:** Får inte vara en tom sträng.

**Exempel på `metadata`-objekt:**

"metadata": {
  "title": "Webbriktlinjer för Offentlig Sektor Sverige - Basnivå",
  "version": "1.2",
  "pageTypes": [
    "Startsida",
    "Informationssida",
    "Nyhetsartikel",
    "E-tjänst (steg 1)",
    "Kontaktformulär",
    "Sökfunktion"
  ],
  "contentTypes": [
    { "id": "text", "text": "Textinnehåll och struktur" },
    { "id": "images", "text": "Bilder och ick-textuellt innehåll" },
    { "id": "forms", "text": "Formulär" },
    { "id": "tables", "text": "Tabeller" },
    { "id": "video", "text": "Video och rörligt ljud" },
    { "id": "audio", "text": "Endast ljud" },
    { "id": "navigation", "text": "Navigation och orientering" }
  ]
}

## 5. Requirements-objektet (`requirements`)

Objektet under nyckeln `requirements` är obligatoriskt och innehåller definitionerna för alla enskilda granskningskrav.
*   Detta är ett json-**objekt**, inte en array.
*   Varje **nyckel** i detta objekt är ett unikt id för ett krav (t.ex. `"wcag-1.1.1"`, `"r12-form-labels"`). Detta id används för att referera till kravet internt, i resultatdata och vid navigering. Det rekommenderas att använda en meningsfull och stabil identifierare.
*   **Värdet** för varje nyckel är ett **kravobjekt** som beskriver det specifika kravet.

### 5.1 Kravobjektets struktur

Varje kravobjekt måste innehålla följande **obligatoriska fält**:

*   **`id`** (Sträng)
    *   **Beskrivning:** En unik identifierare för kravet.
    *   **Villkor:** **Denna måste vara identisk med nyckeln som används i `requirements`-objektet.** Får inte vara en tom sträng.

*   **`key`** (Sträng)
    *   **Beskrivning:** En unik identifierare för kravet.
    *   **Villkor:** **Denna måste vara identisk med nyckeln som används i `requirements`-objektet och `id`-fältet.** _Detta fält är för närvarande redundant. Överväg att i framtida versioner av schemat endast kräva `id` och låta `requirements`-nyckeln vara detta `id`._ Får inte vara en tom sträng.

*   **`title`** (Sträng)
    *   **Beskrivning:** En kort, beskrivande titel för kravet som visas tydligt för användaren i gränssnittet (t.ex. "Icke-textuellt innehåll har textalternativ", "Tangentbordsfokus är synligt").
    *   **Villkor:** Får inte vara en tom sträng.

*   **`expectedObservation`** (Sträng)
    *   **Beskrivning:** En tydlig och koncis beskrivning av vad granskaren förväntas observera eller kunna bekräfta om kravet är uppfyllt på det aktuella stickprovet. Detta är ofta den primära texten som granskaren utgår ifrån vid bedömning. Kan innehålla formuleringshjälp eller exempel på hur en korrekt observation kan se ut.
    *   **Villkor:** Får inte vara en tom sträng.

*   **`contentType`** (Array av strängar)
    *   **Beskrivning:** En lista med id:n (strängar) som korresponderar mot `id`-fälten i `metadata.contentTypes`. Specificerar vilka typer av innehåll detta krav är relevant för.
    *   **Villkor:** Detta är en obligatorisk array.
        *   Om arrayen innehåller ett eller flera `contentType`-id:n, kommer kravet endast att visas för stickprov där minst en av dessa innehållstyper har valts.
        *   Om arrayen är tom (`[]`), antas kravet vara relevant för **alla** stickprov, oavsett vilka innehållstyper som är valda för stickprovet.

*   **`checks`** (Array av objekt)
    *   **Beskrivning:** En lista som innehåller ett eller flera kontrollpunktsobjekt. Varje kontrollpunkt representerar ett specifikt villkor eller en fråga som granskaren måste bedöma för att avgöra om kravet som helhet är uppfyllt.
    *   **Villkor:** Arrayen är obligatorisk och måste innehålla minst ett kontrollpunktsobjekt. Även om ett krav är enkelt, bör det ha minst en kontrollpunkt som representerar den huvudsakliga bedömningen. (Se avsnitt 5.2 för kontrollpunktsobjektets struktur).

Kravobjektet kan också innehålla följande **frivilliga fält** för att ge ytterligare vägledning och kontext:

*   **`instructions`** (Sträng eller Array av strängar)
    *   **Beskrivning:** Detaljerade instruktioner, steg-för-steg-guider eller metoder för hur granskaren ska testa eller bedöma detta krav. Kan inkludera länkar till testverktyg eller specifika tekniker.
    *   **Formatering:** Om en array av strängar används, kommer varje sträng att presenteras som en separat punkt (t.ex. i en punktlista) i användargränssnittet.

*   **`tips`** (Sträng eller Array av strängar)
    *   **Beskrivning:** Användbara tips, råd, "bra att tänka på", eller exempel på god praxis relaterade till kravet.
    *   **Formatering:** Samma som `instructions`.

*   **`exceptions`** (Sträng eller Array av strängar)
    *   **Beskrivning:** En beskrivning av specifika situationer, kontexter eller typer av innehåll där detta krav *inte* behöver uppfyllas eller där det finns legitima undantag.
    *   **Formatering:** Samma som `instructions`.

*   **`commonErrors`** (Sträng eller Array av strängar)
    *   **Beskrivning:** En lista eller beskrivning av vanliga misstag eller fel som utvecklare ofta gör i relation till detta krav. Detta kan hjälpa granskaren att snabbt identifiera problemområden.
    *   **Formatering:** Samma som `instructions`.

*   **`metadata`** (Objekt)
    *   **Beskrivning:** Ett objekt för att lagra ytterligare klassificerande metadata specifikt för detta krav. Används för gruppering och presentation i användargränssnittet.
    *   **Fält inom `metadata` (alla frivilliga):**
        *   **`mainCategory`** (Objekt): Definierar huvudkategorin för kravet.
            *   `id` (Sträng): En unik identifierare för huvudkategorin (t.ex. `"perceivable"`, `"forms-cat"`, `"robustness"`). Används för intern logik.
            *   `text` (Sträng): Läsbar text för huvudkategorin som visas för användaren (t.ex. `"Uppfattbar"`, `"Formulärhantering"`, `"Robust"`). Används för gruppering och sortering.
        *   **`subCategory`** (Objekt): Definierar underkategorin för kravet, inom en eventuell huvudkategori.
            *   `id` (Sträng): En unik identifierare för underkategorin.
            *   `text` (Sträng): Läsbar text för underkategorin.
        *   **`impact`** (Objekt): Anger den potentiella konsekvensnivån om kravet inte uppfylls.
            *   `isCritical` (Boolean): Sätts till `true` om felet anses vara av kritisk natur (t.ex. blockerar helt åtkomst för vissa användare). Default är `false` om utelämnat.
        *   **`standardReference`** (Objekt): Referens till en extern standard, riktlinje eller lagtext.
            *   `text` (Sträng): Den text som ska visas för referensen (t.ex. "WCAG 2.1 Success Criterion 1.1.1 Non-text Content (Level A)", "Lag (2018:1937) om tillgänglighet till digital offentlig service, 8 §").
            *   `url` (Sträng, frivillig): En direkt klickbar webbadress till den externa referensen.

### 5.2 Kontrollpunktsobjektets struktur (element i `checks`-arrayen)

Varje objekt i ett kravs `checks`-array definierar en specifik kontrollpunkt eller ett villkor som ska bedömas av granskaren.

**Obligatoriska fält:**

*   **`id`** (Sträng)
    *   **Beskrivning:** En unik identifierare för denna kontrollpunkt, unik *inom det aktuella kravet*. Används för att lagra resultat.
    *   **Villkor:** Får inte vara en tom sträng.

*   **`condition`** (Sträng)
    *   **Beskrivning:** Den faktiska texten som beskriver villkoret eller frågan som granskaren ska ta ställning till. Detta är huvudtexten för kontrollpunkten. (t.ex. "Har alla informativa bilder ett meningsfullt `alt`-attribut?", "Är formulärfält korrekt associerade med sina `label`-element via `for`/`id`?").
    *   **Villkor:** Får inte vara en tom sträng.

*   **`passCriteria`** (Array av objekt)
    *   **Beskrivning:** En lista som innehåller ett eller flera godkännandekriterieobjekt. Dessa är underkriterier som, om kontrollpunktens `condition` bedöms som "Stämmer", måste uppfyllas för att kontrollpunkten ska anses godkänd.
    *   **Villkor:** Arrayen är obligatorisk. Om en kontrollpunkt inte har några specifika underkriterier (dvs. bedömningen av `condition` är tillräcklig), kan denna array vara tom (`[]`). (Se avsnitt 5.3 för godkännandekriterieobjektets struktur).

**Frivilliga fält:**

*   **`logic`** (Sträng)
    *   **Beskrivning:** Anger hur statusen för de individuella `passCriteria` (om sådana finns) ska kombineras för att bestämma den beräknade statusen för kontrollpunkten (förutsatt att kontrollpunktens `condition` har bedömts som "Stämmer").
    *   **Tillåtna värden:** `"AND"` eller `"OR"`.
    *   **Default:** Om fältet utelämnas, antas `"AND"`.
    *   **`"AND"`:** Alla godkännandekriterier måste ha status "Godkänt" för att kontrollpunkten ska beräknas som "Godkänd". Om något kriterium är "Underkänt", blir kontrollpunkten "Underkänd". Om något är "Ej bedömt" och resten "Godkänt", blir kontrollpunkten "Delvis granskad".
    *   **`"OR"`:** Minst ett godkännandekriterium måste ha status "Godkänt" för att kontrollpunkten ska beräknas som "Godkänd". Kontrollpunkten blir "Underkänd" endast om *alla* bedömda kriterier är "Underkända". Om alla är "Ej bedömda" blir den "Ej granskad". Om några är "Ej bedömda" och inga "Godkända", blir den "Delvis granskad".

### 5.3 Godkännandekriterieobjektets struktur (element i `passCriteria`-arrayen)

Varje objekt i en kontrollpunkts `passCriteria`-array definierar ett specifikt, ofta mer tekniskt eller detaljerat, underkriterium som måste vara uppfyllt.

**Obligatoriska fält:**

*   **`id`** (Sträng)
    *   **Beskrivning:** En unik identifierare för detta godkännandekriterium, unik *inom den aktuella kontrollpunkten*. Används för att lagra resultat.
    *   **Villkor:** Får inte vara en tom sträng.

*   **`requirement`** (Sträng)
    *   **Beskrivning:** Texten som beskriver det specifika kriteriet som ska uppfyllas (t.ex. "`alt`-attributet är meningsfullt och beskriver bildens syfte, inte bara filnamnet.", "`for`-attributet på `label`-elementet matchar exakt `id`-attributet på det associerade `input`-elementet.").
    *   **Villkor:** Får inte vara en tom sträng.

### Exempel på ett komplett `requirements`-objekt med ett krav:

"requirements": {
  "sc-1.1.1-non-text-content": {
    "id": "sc-1.1.1-non-text-content",
    "key": "sc-1.1.1-non-text-content", 
    "title": "Icke-textuellt innehåll",
    "expectedObservation": "Allt icke-textuellt innehåll som presenteras för användaren har ett textalternativ som tjänar ett likvärdigt syfte, med undantag för de situationer som listas under 'Undantag'.",
    "instructions": [
      "Identifiera allt icke-textuellt innehåll på sidan (bilder, ikoner, diagram, ljud, video etc.).",
      "För varje informativt element, verifiera att det finns ett textalternativ.",
      "För dekorativa element, verifiera att de är korrekt dolda för hjälpmedel."
    ],
    "contentType": ["images", "audio", "video"],
    "metadata": {
      "mainCategory": { "id": "perceivable", "text": "Princip 1: Uppfattbar" },
      "subCategory": { "id": "text-alternatives", "text": "1.1 Textalternativ" },
      "impact": { "isCritical": true },
      "standardReference": {
        "text": "WCAG 2.1 framgångskriterium 1.1.1 Icke-textuellt innehåll (Nivå A)",
        "url": "https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html"
      }
    },
    "checks": [
      {
        "id": "check-images-alt",
        "condition": "Har alla `<img>`-element som förmedlar information ett `alt`-attribut som korrekt beskriver bildens syfte eller innehåll?",
        "logic": "AND", 
        "passCriteria": [
          {
            "id": "pc-img-alt-present",
            "requirement": "Informativa `<img>`-element har ett `alt`-attribut."
          },
          {
            "id": "pc-img-alt-meaningful",
            "requirement": "`alt`-texten är en korrekt och koncis beskrivning av bildens information eller funktion."
          }
        ]
      },
      {
        "id": "check-decorative-images-hidden",
        "condition": "Är rent dekorativa `<img>`-element implementerade så att de ignoreras av hjälpmedel?",
        "passCriteria": [
          {
            "id": "pc-decorative-empty-alt",
            "requirement": "Dekorativa bilder har ett tomt alt-attribut (`alt=\"\"`) eller är implementerade som CSS-bakgrunder."
          }
        ]
      }
    ]
  }
  // ... fler kravobjekt kan följa här ...
}

## 6. Validering vid uppladdning

När en regelfil laddas upp i tillsynsverktyget kommer den att valideras mot det schema som beskrivs i detta dokument. Om fel upptäcks, kommer ett meddelande att visas som indikerar vad som behöver korrigeras. Det är viktigt att noggrant följa strukturen, nycklarnas namn och datatyperna för att säkerställa att regelfilen kan tolkas korrekt av verktyget och att granskningsprocessen blir meningsfull.