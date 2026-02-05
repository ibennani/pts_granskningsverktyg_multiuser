# Systemdokumentation: Webbapplikation för digital tillsyn

**Version:** 1.0
**Datum:** 2024-05-27 _(Ersätt med aktuellt datum)_

## 1. Introduktion

### 1.1 Syfte med dokumentationen
Denna systemdokumentation syftar till att beskriva den interna arkitekturen, funktionaliteten och kodstrukturen för webbapplikationen för digital tillsyn. Målet är att underlätta för utvecklare att förstå, underhålla och vidareutveckla systemet. Dokumentationen beskriver *hur* systemet är implementerat, till skillnad från den tekniska specifikationen som beskriver *vad* systemet ska göra.

### 1.2 Översikt av systemet
Applikationen är ett klient-sida verktyg byggt med HTML5, CSS3 och modern JavaScript (ES6+ standard, med användning av moduler). Den möjliggör för användare att ladda upp JSON-baserade regelfiler, definiera och hantera stickprov, granska krav mot dessa stickprov, dokumentera observationer och exportera resultat. All data lagras och bearbetas lokalt i användarens webbläsare. Systemet är designat för att vara fristående och kräver ingen backend-server för sin kärnfunktionalitet.

### 1.3 Målgrupp
Denna dokumentation riktar sig primärt till mjukvaruutvecklare som är involverade i underhåll, felsökning eller vidareutveckling av applikationen.

## 2. Systemarkitektur

### 2.1 Frontend-arkitektur
Applikationen följer en Single Page Application (SPA) modell.
*   **Kärnteknologier:** HTML5 för struktur, CSS3 för presentation (med CSS-variabler för teman och grundläggande styling), och JavaScript (ES6+) för all logik och dynamik.
*   **Struktur:** Koden är organiserad i moduler. Kärnlogik (tillstånd, validering, översättning, etc.) finns i egna moduler, medan användargränssnittet är uppbyggt av återanvändbara komponenter. Varje komponent hanterar sin egen rendering, logik och ofta sin egen CSS.
*   **Rendering:** Dynamisk rendering sker helt på klientsidan. `index.html` agerar som en tom behållare (`<div id="app-container"></div>`) där JavaScript-komponenter renderar sitt innehåll.
*   **Datahantering:**
    *   Applikationens huvudsakliga tillstånd (`current_audit`) hanteras av `state.js` och sparas i webbläsarens `sessionStorage` för att överleva sidomladdningar inom samma session.
    *   Användarpreferenser (tema, språk) sparas i `localStorage`.
    *   Manuell export och import av hela granskningstillståndet sker via JSON-filer.
*   **Navigering:** Klient-sidans routing hanteras via URL-hash (`#`-fragment). `main.js` lyssnar på `hashchange`-händelser för att byta vyer.

### 2.2 Fil- och katalogstruktur
Projektet följer en standardiserad struktur för webbapplikationer:

*   **Rot:**
    *   `index.html`: Huvudsaklig HTML-fil.
*   **`css/`**: Innehåller all CSS.
    *   `style.css`: Globala stilar, CSS-variabler för teman (ljust/mörkt), grundläggande elementstyling och hjälpklasser.
    *   `components/`: En underkatalog för CSS-filer som är specifika för varje JavaScript-komponent (t.ex. `add_sample_form_component.css`). Dessa filer laddas dynamiskt av respektive komponent.
*   **`js/`**: Innehåller all JavaScript-kod.
    *   `main.js`: Applikationens startpunkt, hanterar routing, initiering av vyer och globala UI-kontroller.
    *   `state.js`: Ansvarar för global tillståndshantering (det `current_audit`-objekt som innehåller all granskningsdata).
    *   `translation_logic.js`: Hanterar internationalisering (i18n), laddning av språkfiler från `js/i18n/` och tillhandahåller översättningsfunktioner.
    *   `validation_logic.js`: Innehåller logik för att validera JSON-strukturen hos uppladdade regelfiler och sparade granskningsfiler.
    *   `audit_logic.js`: Innehåller affärslogik relaterad till granskningsprocessen, såsom beräkning av status för krav och kontrollpunkter, samt identifiering av relevanta krav för specifika stickprov.
    *   `export_logic.js`: Hanterar logiken för att generera och initiera nedladdning av granskningsdata i CSV- och XLSX-format. Använder det externa biblioteket SheetJS (via CDN) för XLSX-generering.
    *   `utils/`: Innehåller allmänna hjälpfunktioner.
        *   `helpers.js`: En samling av återanvändbara funktioner för DOM-manipulering (t.ex. `create_element`), generering av UUID, dynamisk laddning av CSS, datumformatering, HTML-sanering och generering av SVG-ikoner.
    *   `components/`: Innehåller alla UI-komponenter. Varje komponent är implementerad som en ES6-modul, oftast med en IIFE-struktur (Immediately Invoked Function Expression) som returnerar ett objekt med publika metoder (vanligtvis `init`, `render`, `destroy`). Komponenterna exporteras som namngivna konstanter för att kunna importeras av `main.js` eller andra komponenter.
    *   `i18n/`: Innehåller JSON-filer för språkstöd, en fil per språk (t.ex. `sv-SE.json`, `en-GB.json`).
*   **`docs/`**: Innehåller all projektdokumentation.
    *   `teknisk_specifikation_vX.X.md`: Den formella tekniska specifikationen.
    *   `systemdokumentation.md`: Denna fil.
    *   `anvandarmanual.md`: Guide för slutanvändare.
    *   `regelfilsguide.md`: Guide för att skapa regelfiler.
    *   `testplan.md`: Testplan och exempel på testfall.

## 3. Kärnmoduler och deras ansvar

### 3.1 `main.js`
*   **Ansvar:** Fungerar som applikationens centrala kontrollenhet och startpunkt.
*   **Routing:** Implementerar en enkel hash-baserad router. Lyssnar på `window.onhashchange`-händelsen. Parsar hashen för att extrahera vynamn och eventuella parametrar (t.ex. `sampleId`, `requirementId`).
*   **Vyhantering:**
    *   Baserat på den aktiva routen, importerar och initierar den korrekta vykomponenten från `js/components/`.
    *   Anropar `init(app_container, navigate_and_set_hash_callback, params)` på komponenten.
    *   Anropar `render()` på komponenten för att visa innehållet i `div#app-container`.
    *   Vid byte av vy anropas `destroy()` på den föregående vykomponenten för att rensa eventlyssnare och andra resurser.
*   **Globala UI-kontroller:**
    *   Initierar och hanterar språkväljaren (`<select>`) och temaväxlaren (`<button>`).
    *   Lyssnar på `languageChanged`-eventet (utsänt av `translation_logic.js`) och anropar `update_app_chrome_texts()` samt renderar om den aktiva vyn för att applicera det nya språket.
*   **Felhantering:** Grundläggande felhantering om en specificerad vykomponent inte kan laddas eller om renderingen misslyckas.

### 3.2 `state.js`
*   **Ansvar:** Hanterar det globala applikationstillståndet med Redux-liknande pattern. Exporterar funktioner för state-hantering.
*   **State-struktur:** State-objektet innehåller `ruleFileContent`, `auditMetadata`, `auditStatus`, `samples`, `uiSettings`, `auditCalculations`, etc. Strukturen är detaljerad i den tekniska specifikationen (avsnitt 6.1-6.3).
*   **Lagringsmekanism:** 
    *   Använder `localStorage` för att spara state med autospar (3 sekunders debounce).
    *   Använder `sessionStorage` som backup.
    *   State serialiseras till JSON innan lagring och deserialiseras vid läsning.
*   **Exporterade funktioner:**
    *   `getState()`: Returnerar en kopia av det aktuella state-objektet.
    *   `dispatch(action)`: Dispatcherar en action som uppdaterar state via reducer. Returnerar Promise.
    *   `subscribe(listener)`: Prenumererar på state-ändringar. Returnerar unsubscribe-funktion.
    *   `initState()`: Initierar state från localStorage eller skapar initial state.
    *   `loadStateFromLocalStorage()`: Laddar state från localStorage.
    *   `clearAutosavedState()`: Rensar autosparat state.
    *   `forceSaveStateToLocalStorage(state)`: Tvingar sparning av state.
*   **Action Types:** Exporteras som `StoreActionTypes` (tidigare `ActionTypes`).
*   **Bakåtkompatibilitet:** För bakåtkompatibilitet exponeras även via `window.Store` och `window.StoreActionTypes`.

### 3.3 `translation_logic.js`
*   **Ansvar:** Tillhandahåller funktionalitet för internationalisering (i18n).
*   **Språkfiler:** Laddar JSON-filer från katalogen `js/i18n/`. Varje fil (t.ex. `sv-SE.json`) innehåller nyckel-värdepar för översättningar.
*   **Språkval:** Hanterar initial detektering av webbläsarens språk och faller tillbaka till ett standardspråk (sv-SE) om detekterat språk inte stöds eller om språkfil saknas. Tillåter användaren att byta språk via UI.
*   **Nyckelfunktioner:**
    *   `Translation.t(key, replacements = {})`: Huvudfunktion för översättning. Tar en `key` och ett valfritt `replacements`-objekt (för platshållare som `{count}`). Returnerar den översatta strängen eller `**key**` om nyckeln saknas.
    *   `Translation.set_language(lang_tag)`: Asynkron funktion som byter det aktiva språket. Laddar den nya språkfilen och skickar sedan ett globalt `CustomEvent` kallat `languageChanged` via `document.dispatchEvent()`.
    *   `Translation.get_current_language_code()`: Returnerar den aktiva språkkoden (t.ex. "sv-SE").
    *   `Translation.get_supported_languages()`: Returnerar ett objekt med de språk som applikationen har språkfiler för.
    *   `Translation.ensure_initial_load()`: En promise som löses när den initiala språkfilen har laddats, vilket säkerställer att applikationen inte försöker rendera text innan översättningar är tillgängliga.

### 3.4 `validation_logic.js`
*   **Ansvar:** Validerar strukturen och datatyperna i de JSON-filer som användaren laddar upp (både regelfiler och sparade granskningssessioner).
*   **`RULE_FILE_SCHEMA`:** Ett internt definierat JavaScript-objekt som agerar som ett schema för regelfiler. Det specificerar obligatoriska nycklar på olika nivåer, förväntade datatyper (t.ex. array av strängar, objekt), och vissa villkor (t.ex. att strängar inte får vara tomma). Se den tekniska specifikationens avsnitt 10 för en detaljerad beskrivning av det förväntade regelfilsformatet som detta schema validerar mot.
*   **Nyckelfunktioner:**
    *   `validate_rule_file_json(jsonObject)`: Tar emot ett parsat JSON-objekt (från en regelfil) och validerar det rekursivt mot `RULE_FILE_SCHEMA`. Returnerar ett objekt `{ isValid: boolean, message: string }` där `message` innehåller en beskrivning av det första felet som hittades, eller ett framgångsmeddelande.
    *   `validate_saved_audit_file(jsonObject)`: Utför en mer grundläggande validering av en sparad granskningsfil, primärt för att säkerställa att nödvändiga toppnivånycklar (`saveFileVersion`, `ruleFileContent`, `auditMetadata`, `auditStatus`, `samples`) finns. Returnerar `{ isValid: boolean, message: string }`.

### 3.5 `audit_logic.js`
*   **Ansvar:** Innehåller central affärslogik för granskningsprocessen, främst relaterad till statusberäkningar och att avgöra vilka krav som är relevanta.
*   **Nyckelfunktioner:**
    *   `calculate_check_status(check_object, pass_criteria_statuses_map, overall_manual_status)`: Beräknar status (`passed`, `failed`, `partially_audited`, `not_audited`) för en enskild kontrollpunkt. Tar hänsyn till den manuellt satta statusen för kontrollpunkten ("Stämmer"/"Stämmer inte"), statusen på dess individuella godkännandekriterier, och den definierade logiken (`AND`/`OR`) för hur kriterierna ska kombineras.
    *   `calculate_requirement_status(requirement_object, requirement_result_object)`: Beräknar den övergripande statusen för ett helt krav baserat på de beräknade statusarna för alla dess ingående kontrollpunkter. Om någon kontrollpunkt är `failed`, blir kravet `failed`. Om alla är `passed`, blir kravet `passed`, etc.
    *   `get_relevant_requirements_for_sample(rule_file_content, sample_object)`: Filtrerar och returnerar en array av de kravobjekt från `rule_file_content.requirements` som är relevanta för ett givet `sample_object`. Relevansen baseras på `sample_object.selectedContentTypes` och varje kravs definierade `contentType`-array.
    *   `get_ordered_relevant_requirement_keys(rule_file_content, sample_object)`: Returnerar en array av krav-ID:n (nycklar) som är relevanta för ett stickprov, sorterade i en användarvänlig ordning (först efter huvudkategori (text), sedan underkategori (text), och slutligen kravtitel (text), allt alfabetiskt).
    *   `calculate_overall_audit_progress(current_audit_data)`: Beräknar det totala antalet relevanta krav över alla stickprov och hur många av dessa som har en slutgiltig status (`passed` eller `failed`). Returnerar ett objekt `{ audited: number, total: number }`.
    *   `find_first_incomplete_requirement_key_for_sample(rule_file_content, sample_object)`: Letar igenom de relevanta och sorterade kraven för ett stickprov och returnerar nyckeln till det första kravet som har status `not_audited` eller `partially_audited`. Används för "Granska nästa ohanterade"-funktionaliteten.

### 3.6 `js/utils/helpers.js`
*   **Ansvar:** En samling av generiska hjälpfunktioner som används på flera ställen i applikationen för att undvika kodduplicering och förenkla vanliga uppgifter.
*   **Exempel på funktioner:**
    *   `generate_uuid_v4()`: Skapar ett unikt ID.
    *   `load_css(href)`: Laddar en CSS-fil asynkront.
    *   `format_iso_to_local_datetime(iso_string)`: Formaterar datumsträngar för visning.
    *   `get_current_iso_datetime_utc()`: Hämtar aktuell tid i ISO 8601 UTC-format.
    *   `escape_html(unsafe_string)`: Sanerar strängar för säker HTML-rendering.
    *   `create_element(tag_name, options = {})`: En central funktion för att programmatiskt skapa HTML-element med diverse attribut och innehåll.
    *   `get_icon_svg(icon_name, colors = [], size = 24)`: Returnerar en SVG-sträng för en given ikon. Har ett internt mappningsobjekt (`base_paths`) från ikonnamn till SVG-sökvägsdata. Hanterar fallback om en ikon inte hittas.
    *   `add_protocol_if_missing(url_string)`: Lägger till "https://" till en URL om protokoll saknas.

## 4. Komponentbibliotek (`js/components/`)

Varje JavaScript-fil i denna katalog representerar en UI-komponent. De flesta följer ett mönster med en IIFE som returnerar ett objekt med metoderna `init(container, router_cb, params)`, `render()`, och `destroy()`. De exporteras sedan som namngivna konstanter.

### 4.1 Vykomponenter
Dessa renderas direkt av `main.js` och utgör de huvudsakliga "sidorna" i applikationen. Alla komponenter följer samma mönster:

**Komponentstruktur:**
```javascript
export const ComponentName = {
    init({ root, deps }) {
        // root: DOM-element där komponenten renderas
        // deps: objekt med beroenden (router, getState, dispatch, Translation, Helpers, etc.)
        this.root = root;
        this.deps = deps;
        // Ladda CSS via Helpers.load_css_safely()
    },
    render() {
        // Rendera komponentens UI
    },
    destroy() {
        // Rensa event listeners och referenser
    }
};
```

*   **`UploadViewComponent.js`**
    *   **Syfte:** Applikationens startvy. Tillåter användaren att antingen ladda upp en JSON-regelfil för att starta en ny granskning, eller ladda upp en tidigare sparad JSON-granskningsfil.
    *   **Internt tillstånd:** Håller referenser till filinput-elementen.
    *   **Interaktioner:** Använder `FileReader` API för att läsa filinnehåll. Anropar `ValidationLogic` för att validera filerna. Vid lyckad validering/laddning, uppdateras state via `deps.dispatch()` och `deps.router()` anropas för att navigera till nästa vy (`EditMetadataViewComponent` för ny granskning, `AuditOverviewComponent` för laddad granskning). Använder `NotificationComponent` för att visa statusmeddelanden.
    *   **CSS:** `css/components/upload_view_component.css`.

*   **`EditMetadataViewComponent.js`**
    *   **Syfte:** Tillåter användaren att mata in eller visa metadata för den aktuella granskningen (t.ex. ärendenummer, aktör).
    *   **Internt tillstånd:** Håller referenser till formulärfälten.
    *   **Interaktioner:** Läser initial metadata från `deps.getState().auditMetadata`. Om granskningens status är `not_started`, är fälten redigerbara. Vid submit sparas datan via `deps.dispatch()` och `deps.router()` navigerar till `SampleManagementViewComponent`. Om status inte är `not_started`, visas datan som skrivskyddad. Använder `NotificationComponent`.
    *   **CSS:** `css/components/edit_metadata_view_component.css`.

*   **`SampleManagementViewComponent.js`**
    *   **Syfte:** Hanterar skapande, listning, redigering och radering av stickprov *innan* en granskning har startat (dvs. när `auditStatus === 'not_started'`).
    *   **Internt tillstånd:** Håller reda på om formuläret för att lägga till/redigera stickprov är synligt (`is_form_visible`).
    *   **Interaktioner:** Använder/initierar `SampleFormViewComponent` för att visa formuläret och `SampleListComponent` för att visa listan över befintliga stickprov. Knapparna "Lägg till nytt stickprov" och "Starta granskning" renderas villkorligt. Vid start av granskning uppdateras `auditStatus` via `deps.dispatch()` och `deps.router()` navigerar till `AuditOverviewComponent`.
    *   **CSS:** `css/components/sample_management_view_component.css`.

*   **`AuditOverviewComponent.js`**
    *   **Syfte:** Central vy som visar en översikt av en pågående eller låst granskning. Inkluderar metadata, övergripande progress, en lista över stickprov, och åtgärder för hela granskningen. Tillåter hantering av stickprov (lägga till, redigera, radera) om granskningen är `in_progress`.
    *   **Internt tillstånd:** `is_add_sample_form_visible` för att styra formulärets synlighet.
    *   **Interaktioner:** Hämtar all data från `deps.getState()`. Använder `AuditLogic.calculate_overall_audit_progress` och `ProgressBarComponent` för att visa total progress. Initierar och använder `SampleListComponent` för att visa stickprovslistan. Initierar och använder `SampleFormViewComponent` (dynamiskt visad/dold) för att lägga till eller redigera stickprov när `auditStatus === 'in_progress'`. Hanterar anrop till `window.ExportLogic` för export. Hanterar logik för att låsa/låsa upp granskning.
    *   **CSS:** `css/components/audit_overview_component.css`.

*   **`RequirementListComponent.js`**
    *   **Syfte:** Visar en detaljerad lista över alla krav som är relevanta för ett specifikt stickprov, grupperade efter kategori och underkategori.
    *   **Internt tillstånd:** Håller det aktuella `sample_object`, en lista över `relevant_requirements` och en strukturerad `requirements_by_category`.
    *   **Interaktioner:** Tar emot `sampleId` som parameter via router. Använder `AuditLogic` för att hämta och sortera relevanta krav. Renderar varje krav, ofta med hjälp av en intern logik eller `RequirementCardComponent` (om den används externt). Klick på en kravtitel navigerar till `RequirementAuditComponent` via `deps.router()`. Använder eventdelegering för klick på kravtitlar.
    *   **CSS:** `css/components/requirement_list_component.css`.

*   **`RequirementAuditComponent.js`**
    *   **Syfte:** Detaljvy för att granska och bedöma ett enskilt krav mot ett specifikt stickprov.
    *   **Internt tillstånd:** Håller referenser till `current_sample_object`, `current_requirement_object`, `current_requirement_result`, samt till DOM-element för inmatningsfält.
    *   **Interaktioner:** Tar emot `sampleId` och `requirementId` som parametrar via router. Visar all information om kravet. Renderar kontrollpunkter och godkännandekriterier med interaktiva knappar för statusbedömning. Använder eventdelegering för knappinteraktioner. Anropar `AuditLogic` för att beräkna statusar. Sparar ändringar i `requirementResults` via `deps.dispatch()`. Hanterar navigationsknappar ("Föregående", "Nästa", "Nästa ohanterade").
    *   **CSS:** `css/components/requirement_audit_component.css`.

### 4.2 Återanvändbara UI-delkomponenter

*   **`SampleFormViewComponent.js`**
    *   **Syfte:** Ett formulär för att mata in eller redigera detaljer för ett stickprov (sidtyp, beskrivning, url, innehållstyper).
    *   **Interaktioner:** Anropas av `SampleManagementViewComponent` (för initiala stickprov) och `AuditOverviewComponent` (för stickprov under pågående granskning). Populerar sina fält från `deps.getState().ruleFileContent.metadata` (för `pageTypes` och `contentTypes`). Vid submit anropas en `on_sample_saved_callback` som tillhandahålls av föräldrakomponenten.
    *   **CSS:** `css/components/sample_form_view_component.css`.

*   **`SampleListComponent.js`**
    *   **Syfte:** Renderar en lista (`<ul>`) av stickprov (`<li>`). Varje listobjekt visar information om stickprovet och åtgärdsknappar.
    *   **Interaktioner:** Används av `SampleManagementViewComponent` och `AuditOverviewComponent`. Läser `deps.getState().samples`. Renderar knappar ("Redigera", "Radera", "Visa krav", "Granska", "Besök url") villkorligt baserat på `auditStatus` och antal stickprov. Använder eventdelegering för att hantera klick på dessa knappar, och anropar sedan antingen `deps.router()` för navigering eller `on_edit_callback`/`on_delete_callback` som tillhandahålls av föräldern.
    *   **CSS:** `css/components/sample_list_component.css`.

*   **`RequirementCardComponent.js`**
    *   **Syfte:** En enkel komponent som renderar ett "kort" för ett enskilt krav, typiskt för användning i `RequirementListComponent`. Visar titel, statusindikator och referens.
    *   **Interaktioner:** Tar emot kravdata och en router-callback. Gör kravtiteln klickbar för navigering.
    *   **CSS:** `css/components/requirement_card_component.css`.

*   **`NotificationComponent.js`**
    *   **Syfte:** Global komponent för att visa tillfälliga meddelanden (info, success, warning, error) till användaren.
    *   **Interaktioner:** Exponerar metoder som `show_global_message(message, type)` och `clear_global_message()`. Manipulerar en dedikerad `div#global-message-area` som typiskt placeras av den aktiva vykomponenten.
    *   **CSS:** `css/components/notification_component.css`.

*   **`ProgressBarComponent.js`**
    *   **Syfte:** Enkel komponent för att rendera en HTML `<progress>`-bar med tillhörande text.
    *   **Interaktioner:** `create(current_value, max_value, options)` returnerar ett DOM-element.
    *   **CSS:** `css/components/progress_bar_component.css`.

## 5. Arbetsflöden och datacykler
_(Se föregående svar för detaljerad beskrivning av flödena: Starta ny granskning, Genomföra granskning, Låsa och exportera). Viktigt är att dataändringar (t.ex. i `RequirementAuditComponent` eller `AddSampleFormComponent`) uppdaterar `current_audit`-objektet via `State.setCurrentAudit()`, vilket i sin tur sparar till `sessionStorage`. När en vy renderas om (antingen via `router` eller ett explicit anrop till `render()`), hämtar den den senaste versionen från `State.getCurrentAudit()`._

## 6. Tillgänglighetsaspekter (intern implementation)
*   **Ikoner:** Alla SVG-ikoner som genereras via `Helpers.get_icon_svg` inkluderar `aria-hidden="true"`, eftersom de alltid används i kontexten av en textbeskrivande knapp eller länk. I de flesta fall placeras ikoner till höger om knapptexten.
*   **Fokus:**
    *   Standardfokusindikatorer från webbläsaren förstärks globalt med `:focus-visible`.
    *   Vid dynamisk visning av `AddSampleFormComponent` (från `AuditOverviewComponent`), görs ett försök att sätta fokus programmatiskt till det första fältet i formuläret.
    *   När dialoger/modaler stängs (t.ex. `AddSampleFormComponent` eller den inbyggda `confirm()`-dialogen), görs ett försök att återställa fokus till det element som hade fokus innan dialogen öppnades, med hjälp av `previously_focused_element`.
    *   **Förbättringsområde:** Den nuvarande `confirm()`-dialogen för radering har begränsad fokuskontroll. En anpassad modal skulle ge bättre möjligheter för fokusfångst (trapping) och mer precis återställning.
*   **Semantik:** Applikationen strävar efter att använda semantiskt korrekt HTML (rubriker `<h1>`-`<h4>`, listor `<ul>`/`<li>`, knappar `<button>`, formulärelement `<form>`, `<label>`, `<input>`, `<select>`, `<textarea>`, `<fieldset>`, `<legend>`).
*   **Dynamiska meddelanden:** `NotificationComponent` använder en `div` med `aria-live="polite"` för att meddela statusuppdateringar och felmeddelanden på ett tillgängligt sätt.
*   **ARIA-attribut:** `aria-pressed` används på växlingsknappar (t.ex. för "Stämmer"/"Stämmer inte"). `aria-label` används på knappar i `SampleListComponent` för att ge unik kontext när flera likadana knappar finns.

## 7. Utvecklingsmiljö och byggprocess
Systemet använder **Vite** som byggsystem och utvecklingsserver. Vite hanterar:
- ES6-modulbundling och transformation
- Hot Module Replacement (HMR) för snabb utveckling
- Produktionsbyggnad med optimering och minifiering
- Automatisk konfiguration av HTTP-server för utveckling

**Utveckling:**
- Kör `npm run dev` för att starta utvecklingsservern på port 5173
- Vite serverar filer och hanterar ES6-moduler automatiskt
- HMR uppdaterar ändringar automatiskt i webbläsaren

**Produktion:**
- Kör `npm run build` för att bygga optimerade filer till `dist/`-mappen
- Byggprocessen inkluderar lintning, validering och optimering
- Använd `npm run preview` för att förhandsgranska produktionsbyggnaden

## 8. Kända begränsningar och potentiella förbättringsområden
_(Se den separata sektionen som utvecklats tidigare för en detaljerad lista)._

## 9. Felsökningsguide (tips)
*   **Webbläsarens utvecklarverktyg:** Använd flikarna Konsol (Console), Element (Elements), Nätverk (Network), och Applikation (Application -> Session Storage, Local Storage) intensivt.
*   **Konsolloggar:** Många `console.log`-satser finns utplacerade (särskilt i `AuditOverviewComponent` efter nylig felsökning) för att spåra exekvering och variabelvärden. Dessa kan aktiveras/kommenteras bort vid behov.
*   **`debugger;`:** Använd `debugger;`-satsen i JavaScript-koden för att sätta brytpunkter och stega igenom koden i webbläsarens felsökningsverktyg.
*   **Tillståndskontroll:** Inspektera `sessionStorage` för att se det aktuella värdet av `current_audit`-objektet. Detta är ofta det snabbaste sättet att verifiera att data sparas korrekt.
*   **Validera JSON:** Om problem uppstår vid laddning av regelfiler eller sparade granskningar, kopiera JSON-innehållet och validera det med ett online JSON-valideringsverktyg för att upptäcka syntaxfel.
*   **CSS-problem:** Använd elementinspektören för att se vilka CSS-regler som appliceras och om det finns konflikter eller oavsiktligt dolda element (kontrollera `display`, `visibility`, `opacity`, `height`, `width`).
*   **Hård omladdning:** Använd Ctrl+Shift+R (eller Cmd+Shift+R på Mac) för att tvinga webbläsaren att ladda om alla resurser från servern och ignorera cachen, vilket kan lösa problem relaterade till gamla filversioner.