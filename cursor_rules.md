# Cursor Rules

## Tekniska Krav
- Kod får inte orsaka `console.error` i runtime.
- Playwright-testerna `noConsoleErrors` måste passera i Chromium och WebKit.
- Använd modern ES-modulsyntax (`import/export`) i all kod.
- Följ Vite-konventioner och håll fast porten 5173.

## AI-arbetsflöde
- Analysera & Föreslå: När du får en uppgift, generera ingen kod. Analysera istället instruktionerna och återkom med en tydlig plan.
- Invänta Godkännande: Implementera först efter tydligt godkännande.

## Hårda Regler
- Aldrig `disabled`-attribut på interaktiva element.  
  Använd `aria-disabled="true"` endast vid tillfälliga tillstånd där funktionen väntar på data.
- Inga inaktiva komponenter någonsin – rendera bara komponenter som ska visas och användas i aktuellt tillstånd.
- Inga placeholders – använd alltid synliga `<label>`-element.
- Inga "Avbryt"-knappar – skriv vad som faktiskt händer. Ordet "Avbryt" kan dock utgöra en del av en längre beskrivning.
- Inga mus-beroenden – allt ska fungera med tangentbord.
- Språk i koden: engelska för filer, funktioner och variabler.

## Tillgänglighetskrav (WCAG 2.2 A & AA)
All kod ska uppfylla kraven i WCAG 2.2 nivå A och AA.  
Utöver WCAG:s formella krav gäller följande projektspecifika regler:

### Navigering och tangentbordsstöd
- All funktionalitet ska kunna användas med tangentbord utan mus.
- Fokusordning ska följa visuellt flöde och vara logisk.
- Fokus ska vara tydligt synligt och ha tillräcklig kontrast.
- Ingen tidsbegränsad interaktion får förhindra tangentbordsnavigering (WCAG 2.2.1, 2.2.6).
- Varje sida ska ha en länk som leder direkt till huvudinnehållet (“Hoppa till innehåll”).
- Sidans `<title>` ska tydligt beskriva sidans syfte.

### Kontrast och läsbarhet
- Textkontrast ska uppfylla minst 4.5:1 (AA).
- UI-komponenter (knappar, länkar, formulärfält) ska ha minst 3:1 kontrast mot bakgrunden (AA).
- Ingen text får förmedla information enbart med färg.

### Formulär och etiketter
- Alla inmatningsfält ska ha ett synligt `<label>`-element.
- Felmeddelanden ska förklaras i klartext och kopplas till fältet med `aria-describedby`.
- Fokus ska flyttas till fel- eller bekräftelsemeddelande efter formulärinlämning.
- Felmeddelanden ska beskriva hur användaren löser felet, inte bara att det finns.
- Krav på format eller inmatning ska förklaras före användning.
- Autofyll, hjälptexter och status ska vara tillgängliga via ARIA och text.

### Dynamiskt innehåll
- Alla visuella förändringar (t.ex. aviseringar, statusändringar, felmeddelanden) ska kommuniceras via ARIA live-regioner.
- Ingen automatisk navigering, redirect eller popup får ske utan användarens initiering eller tydlig förväntan.
- Komponenter som uppdateras asynkront får inte ta fokus oförutsett.
- Komponenter får använda tillfälliga tillstånd (t.ex. laddning, växling) men inte renderas som permanent inaktiva.

### Rörligt och tidsbaserat innehåll
- Ingen animation, video eller rörelse får starta automatiskt längre än 5 sekunder.
- Animationer får användas för att förtydliga tillstånd eller förbättra förståelse, men får inte skapa distraktion eller bero av musrörelser.
- Användaren ska kunna pausa, stoppa eller dölja rörligt innehåll.
- Ingen blinkande komponent får blinka mer än 3 gånger per sekund.

### Struktur och semantik
- Rubriker ska använda korrekt hierarki (`h1–h6`).
- Det ska finnas exakt ett `<h1>` per sida.
- Länkar ska beskriva målet tydligt (inte "Klicka här").
- Länkar som öppnar nytt fönster eller ny flik ska tydligt indikera det.
- Listor, tabeller och knappar ska använda korrekta semantiska element.
- Landmarks (`main`, `nav`, `header`, `footer`, `aside`) ska användas konsekvent.
- Språkattribut (`lang`) ska anges för hela dokumentet och för avvikande textstycken.

### Pekinteraktioner (WCAG 2.5)
- Alla interaktioner som kräver pekgester ska ha ett tangentbordsalternativ.
- Komponenter får inte kräva simultana gester (t.ex. nypa, dra med flera fingrar).
- Touchytor ska vara minst 24×24 px (WCAG 2.5.8).
- Inga tooltips som endast visas vid hover – all information ska vara tillgänglig utan mus och kunna nås via tangentbord. Visuella effekter får använda hover

### Responsivitet och zoom
- Allt innehåll ska vara fullt användbart vid 200 % zoom utan horisontell scroll, utöver nödvändig scroll för själva komponenten (WCAG 1.4.10).
- Layout får inte låsa användaren till en viss orientering.

### Egna tillägg utöver WCAG
- Inga element får vara dolda eller inaktiva genom `disabled`; använd `aria-disabled="true"` endast tillfälligt.
- Undvik att gömma innehåll visuellt utan korrekt ARIA-hantering (`sr-only` eller `aria-hidden`).
- Text som indikerar tillstånd (t.ex. "Sparar...", "Klar") ska kunna uppfattas av skärmläsare.
- Använd alltid HTML-komponenter. Använd endast aria-attribut när standard-html inte räcker till.

## Byggtext-regel
När `npm run build` körs ska texten  
**"Byggt YYYY-MM-DD klockan HH:MM"**  
visas diskret och centrerad under den yttersta diven.  
Texten ska använda svenska datum- och tidsformat och vara stylad med liten, grå text.
