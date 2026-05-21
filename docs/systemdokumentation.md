# Systemdokumentation: Leffe (webbapp för digital tillsyn)

**Version:** 1.2  
**Datum:** 2026-05-20

## 1. Introduktion

### 1.1 Syfte med dokumentationen
Denna systemdokumentation syftar till att beskriva den interna arkitekturen, funktionaliteten och kodstrukturen för **Leffe**. Målet är att underlätta för utvecklare att förstå, underhålla och vidareutveckla systemet. Dokumentationen beskriver *hur* systemet är implementerat, till skillnad från den tekniska specifikationen som beskriver *vad* systemet ska göra.

### 1.2 Översikt av systemet
Leffe är en SPA (Single Page Application) byggd med HTML5, CSS3 och JavaScript (ES6-moduler). I drift används en **Express-backend** (`server/`) med **PostgreSQL**, **JWT-baserad inloggning** (lösenord med bcrypt) och **WebSocket** för realtidssynk. Klienten synkar granskningar och regelfiler via REST under `/v2/api` (proxat från Vite i utveckling). Tillstånd hanteras i `state.js` med sparning i webbläsaren (`sessionStorage`/`localStorage`) och synk mot server när användaren arbetar mot backend. Användaren kan även ladda ner/importera granskning som JSON-fil där det stöds i gränssnittet.

### 1.3 Målgrupp
Denna dokumentation riktar sig primärt till mjukvaruutvecklare som är involverade i underhåll, felsökning eller vidareutveckling av applikationen.

## 2. Systemarkitektur

### 2.1 Frontend-arkitektur
Applikationen följer en Single Page Application (SPA) modell.
*   **Kärnteknologier:** HTML5 för struktur, CSS3 för presentation (med CSS-variabler för teman och grundläggande styling), och JavaScript (ES6+) för all logik och dynamik.
*   **Struktur:** Koden är organiserad i moduler. Kärnlogik (tillstånd, validering, översättning, etc.) finns i egna moduler, medan användargränssnittet är uppbyggt av återanvändbara komponenter. Varje komponent hanterar sin egen rendering, logik och ofta sin egen CSS.
*   **Rendering:** Dynamisk rendering sker helt på klientsidan. `index.html` agerar som en tom behållare (`<div id="app-container"></div>`) där JavaScript-komponenter renderar sitt innehåll.
*   **Datahantering:**
    *   Applikationens huvudsakliga tillstånd hanteras av `state.js` med Redux-liknande pattern. Vid varje `dispatch()` sparas state direkt till `sessionStorage` (ingen debounce) för att överleva sidomladdningar inom samma session. En backup sparas till `localStorage`.
    *   Användarpreferenser (tema, språk) sparas i `localStorage`.
    *   Manuell export och import av hela granskningstillståndet sker via JSON-filer.
*   **Navigering:** Klient-sidans routing hanteras via URL-hash (`#`-fragment). `js/logic/router.js` parsar hash; `js/logic/view_render.js` byter vy; bootstrap och session startas från `js/logic/app_bootstrap.js` (anropas från `main.js`).

### 2.2 Fil- och katalogstruktur
Projektet följer en standardiserad struktur för webbapplikationer:

*   **Rot:**
    *   `index.html`: Huvudsaklig HTML-fil.
*   **`css/`**: Innehåller all CSS.
    *   `style.css`: Globala stilar, CSS-variabler för teman (ljust/mörkt), grundläggande elementstyling och hjälpklasser.
    *   `components/`: En underkatalog för CSS-filer som är specifika för varje JavaScript-komponent (t.ex. `add_sample_form_component.css`). Dessa filer laddas dynamiskt av respektive komponent.
*   **`js/`**: Innehåller all JavaScript-kod.
    *   `main.js`: Applikationens startpunkt (IIFE): globala chrome-komponenter, `deps`-objekt, anropar `app_bootstrap.js`.
    *   `state.js`: Re-export av publikt state-API från `js/state/index.ts`.
    *   `logic/`: Routing (`router.js`), vyrendering (`view_render.js`), vyregister (`view_components_index.js`), autospar, session m.m.
    *   `translation_logic.ts` (brygga `.js`): Internationalisering, språkfiler i `js/i18n/`.
    *   `validation_logic.ts`: Validering av regelfiler och sparade granskningar.
    *   `audit_logic.ts`: Statusberäkningar, relevanta krav per stickprov m.m.
    *   `export_logic.ts`: Fasad för export (CSV, Excel, Word, HTML) under `js/export/`; exponeras som `window.ExportLogic`.
    *   `draft_manager.ts`: Fältutkast i `localStorage` (separat från central `dispatch`).
    *   `utils/helpers.js`: DOM-hjälpare, CSS-laddning, ikoner m.m.
    *   `components/`: UI-komponenter – **klasser** för vyer (`export class …`), **objektliteral** för vissa äldre sektioner.
    *   `i18n/`: JSON-filer per språk (`sv-SE.json`, `en-GB.json`).
*   **`server/`**: Express-API, PostgreSQL, JWT, WebSocket – se `docs/api-dokumentation.md`.
*   **`shared/`**: Gemensam kod mellan klient och server (inga DOM-beroenden).
*   **`docs/`**: Innehåller all projektdokumentation.
    *   `teknisk_specifikation_vX.X.md`: Den formella tekniska specifikationen.
    *   `systemdokumentation.md`: Denna fil.
    *   `anvandarmanual.md`: Guide för slutanvändare.
    *   `regelfilsguide.md`: Guide för att skapa regelfiler.
    *   `testplan.md`: Testplan och exempel på testfall.

## 3. Kärnmoduler och deras ansvar

### 3.1 `main.js` och bootstrap
*   **Ansvar:** Startpunkt: sätter `window.Translation` och `window.Helpers`, bygger `deps`, startar `init_app()` i `js/logic/app_bootstrap.js` och token-förnyelse.
*   **Routing:** Hash-baserad routing i `js/logic/router.js`; vybyte via `render_view()` i `js/logic/view_render.js`.
*   **Vyhantering:**
    *   Vykomponenter registreras som **instanser** i `js/logic/view_components_index.js` (`get_component_class(view_name)`).
    *   `view_render.js` anropar `init({ root, deps })`, `render()` och `destroy()` på aktiv vy.
*   **Globala UI-kontroller:** Sidomeny, action bars, språk/tema; vid `languageChanged` uppdateras chrome och aktiv vy renderas om.
*   **Inloggning:** Utan JWT-token visas login-vyn; efter inloggning startar `session_manager.ts` normal session.

### 3.2 `state.js` (re-export från `js/state/index.ts`)
*   **Ansvar:** Hanterar det globala applikationstillståndet med Redux-liknande pattern. Själva reducerlogiken är uppdelad i `js/state/*.ts` och `*.js`; den publika ytan är `js/state.js`.
*   **State-struktur:** State-objektet innehåller bland annat `ruleFileContent`, `auditMetadata`, `auditStatus`, `samples`, `uiSettings`, `auditCalculations`, fjärrfält som `auditId` / `version` / `ruleSetId` i pågående session, m.m. Strukturen beskrivs i `js/state/initialState.js` och i den tekniska specifikationen (avsnitt 6.1–6.3).
*   **Lagringsmekanism:** 
    *   Vid varje lyckad `dispatch()` som ändrar state sparas hela state till **`sessionStorage`** under nyckeln `digitalTillsynAppCentralState` (ingen debounce i state-lagret).
    *   När innehållet bedöms återställningsbart skrivs en **backup** till **`localStorage`** (`digitalTillsynAppStateBackup`) tillsammans med valfri `restorePosition` (hash-vy). Backup används vid cold start om sessionStorage var tom; jämförelse med server sker i `session_boot_merge.js` när användaren är inloggad.
    *   State serialiseras till JSON; ogiltig eller för gammal version rensas och ersätts med standardtillstånd.
*   **Exporterade funktioner (urval):**
    *   `getState()`, `dispatch(action)`, `subscribe(listener)`, `initState()` — se `docs/state_and_persistence.md` för full tabell och flöden.
    *   `loadStateFromLocalStorageBackup()`, `clearLocalStorageBackup()`, `updateBackupRestorePosition()` — backup-API.
    *   `APP_STATE_KEY` — sessionStorage-nyckel för diagnostik.
*   **Action Types:** Exporteras som `StoreActionTypes`.
*   **Utförlig dokumentation:** `docs/state_and_persistence.md` (nycklar, serversynk, undantag, skillnad mot formulär-autospar).

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

### 3.4 `validation_logic.ts` (klient och server-import)
*   **Ansvar:** Validerar JSON för **regelfiler** och **sparade granskningar** innan de laddas in eller sparas. Regler och felmeddelanden underhålls i kod tillsammans med översättningsnycklar i `js/i18n/*.json` (ingen separat JSON Schema-/Zod-fil).
*   **Nyckelfunktioner:**
    *   `validate_rule_file_json(jsonObject, options?)`: Kontrollerar att regelfilen har obligatoriska delar (metadata med titel, innehållstyper/stickprovstyper, `requirements` som objekt eller array med giltiga krav m.m.). Returnerar `{ isValid, message }`. Vid lyckad validering används meddelandenyckeln `rule_file_validation_complete`.
    *   `validate_saved_audit_file(jsonObject, options?)`: Kontrollerar toppnivåfält (`ruleFileContent`, `auditMetadata`, `auditStatus`, `samples`), att metadata är objekt, att stickprov är en array, att status är en sträng, samt den inbäddade regelfilen: om både `metadata` och `requirements` finns anropas samma regelkedja som för fristående regelfil; annars kontrolleras åtminstone kravlistan. Returnerar `{ isValid, message }` med texter från `saved_audit_validation_ok` respektive `error_saved_audit_*` / `error_saved_audit_embedded_rulefile_invalid` (med detalj från underliggande fel).

### 3.5 `audit_logic.ts` (brygga `audit_logic.js`)
*   **Ansvar:** Innehåller central affärslogik för granskningsprocessen, främst relaterad till statusberäkningar och att avgöra vilka krav som är relevanta.
*   **Nyckelfunktioner:**
    *   `calculate_check_status(check_object, pass_criteria_statuses_map, overall_manual_status)`: Beräknar status för en kontrollpunkt via samma trestegsmodell som kravnivå: ogranskad → delvis granskad → (när alla godkännandekriterier är bedömda) underkänd om minst ett är underkänt, annars godkänd. Manuell status ("Stämmer inte", "Inte aktuellt", ej påbörjad) hanteras före kriterieaggregering. `aggregate_child_audit_statuses` används för kriterier och kontrollpunkter.
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

Vykomponenter registreras i `view_components_index.js` och renderas via `view_render.js`. **Nya** vyer är **klasser** (`export class …`); vissa äldre sektioner använder fortfarande objektliteral. Alla tar `init({ root, deps })`, `render()`, `destroy()`.

Se även `docs/component_standard.md`.

### 4.1 Vykomponenter (urval)
Dessa utgör de huvudsakliga "sidorna" i applikationen (hash-routes i parentes):

*   **`AuditViewComponent.js`** (`#start`)
    *   **Syfte:** Startvy och granskningsarbetsyta. När servern är tillgänglig visar den en tabell över alla granskningar (via `AuditListComponent`). Tabellen visar Diarienummer, Aktörens namn, Status, Progress, Bristindex, Granskare och Ladda ner. Saknad metadata visas som "—".
    *   **Interaktioner:** `get_audits()` för listan; klick på aktör navigerar till granskning; nedladdning via `download_audit_by_id` / sparlogik.
    *   **CSS:** `js/components/audit_view/audit_view_component.css`.

*   **`EditMetadataViewComponent.js`**
    *   **Syfte:** Tillåter användaren att mata in eller redigera metadata för den aktuella granskningen (t.ex. ärendenummer, aktör, granskare).
    *   **Interaktioner:** Läser metadata från `deps.getState().auditMetadata`. Om granskningens status är `not_started`, är fälten redigerbara. Vid submit sparas datan via `deps.dispatch()` och `sync_to_server_now()` anropas för befintliga granskningar så att servern uppdateras innan navigering. Metadata kan redigeras även under pågående granskning via knappen "Redigera" i granskningsinfopanelens header.
    *   **CSS:** `css/components/edit_metadata_view_component.css`.

*   **`SampleManagementViewComponent.ts`**
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

*   **`RequirementAuditComponent.ts`**
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
    *   **Interaktioner:** Används av `SampleManagementViewComponent` och `AuditOverviewComponent`. Läser `deps.getState().samples`. Renderar knappar ("Redigera", "Radera", "Visa krav", "Ogranskade utan anmärkning" endast för utvald inloggning under pågående granskning när det finns helt ogranskade krav, "Granska nästa", "Besök url") villkorligt baserat på `auditStatus` och antal stickprov. Använder eventdelegering för klick och anropar `deps.router()`, `on_edit_callback`, `on_delete_callback` eller `on_mark_sample_bulk_pass_fully_unreviewed` från föräldern.
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
_(Se föregående svar för detaljerad beskrivning av flödena: Starta ny granskning, Genomföra granskning, Låsa och exportera). Viktigt är att dataändringar (t.ex. i `RequirementAuditComponent` eller `AddSampleFormComponent`) uppdaterar state via `dispatch()`, vilket sparar direkt till `sessionStorage`. När en vy renderas om (antingen via `router` eller ett explicit anrop till `render()`), hämtar den den senaste versionen från `getState()`._

## 6. Tillgänglighetsaspekter (intern implementation)
*   **Ikoner:** Alla SVG-ikoner som genereras via `Helpers.get_icon_svg` inkluderar `aria-hidden="true"`, eftersom de alltid används i kontexten av en textbeskrivande knapp eller länk. I de flesta fall placeras ikoner till höger om knapptexten.
*   **Fokus:**
    *   Standardfokusindikatorer från webbläsaren förstärks globalt med `:focus-visible`.
    *   Vid dynamisk visning av `AddSampleFormComponent` (från `AuditOverviewComponent`), görs ett försök att sätta fokus programmatiskt till det första fältet i formuläret.
    *   När dialoger/modaler stängs (t.ex. `AddSampleFormComponent` eller den inbyggda `confirm()`-dialogen), görs ett försök att återställa fokus till det element som hade fokus innan dialogen öppnades, med hjälp av `previously_focused_element`.
    *   **Förbättringsområde:** Den nuvarande `confirm()`-dialogen för radering har begränsad fokuskontroll. En anpassad modal skulle ge bättre möjligheter för fokusfångst (trapping) och mer precis återställning.
*   **Semantik:** Applikationen strävar efter att använda semantiskt korrekt HTML (rubriker `<h1>`-`<h4>`, listor `<ul>`/`<li>`, knappar `<button>`, formulärelement `<form>`, `<label>`, `<input>`, `<select>`, `<textarea>`, `<fieldset>`, `<legend>`).
*   **Dynamiska meddelanden:** `NotificationComponent` använder en `div` med `aria-live="polite"` för att meddela statusuppdateringar och felmeddelanden på ett tillgängligt sätt.
*   **ARIA-attribut:** `aria-pressed` används på växlingsknappar (t.ex. för "Stämmer"/"Stämmer inte"). `aria-label` används på knappar i `SampleListComponent` för att ge unik kontext när flera likadana knappar finns. I `ChecklistHandler` har kontrollpunkter (h3) aria-label i formatet "Kontrollpunkt X. {status}" och godkännandekriterier (h4) aria-label i formatet "Godkännandekriterium X.Y. {status}". Nedladdningsknappar i granskningslistan har aria-label "Ladda ner {diarienummer} {aktörens namn}".

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