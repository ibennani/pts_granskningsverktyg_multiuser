# API-dokumentation – Leffe

**Version:** 1.3  
**Datum:** 2026-06-09

## Innehållsförteckning

1. [Översikt](#1-översikt)
2. [State Management API](#2-state-management-api)
3. [Komponenter API](#3-komponenter-api)
4. [Hjälpfunktioner API](#4-hjälpfunktioner-api)
5. [Export API](#5-export-api)
6. [Validering API](#6-validering-api)
7. [Internationalisering API](#7-internationalisering-api)
8. [Event System](#8-event-system)
9. [Error Handling](#9-error-handling)
10. [Exempel](#10-exempel)

## 1. Översikt

Leffe använder en modulär arkitektur med tydliga API:er för varje komponent. Alla API:er är dokumenterade med TypeScript-liknande typer för bättre förståelse.

### API-struktur

- **State:** `import { getState, dispatch, subscribe, … } from './state.js'` — se avsnitt 2.
- **`window.Helpers`** — hjälpfunktioner
- **`window.Translation`** — internationalisering
- **`window.ExportLogic`** — export
- **`window.ConsoleManager`** / **`window.MemoryManager`** — loggning respektive timer och event listener-hantering
- **Granskningslogik och validering** — ES-moduler (`audit_logic.ts`, `validation_logic.ts`), injiceras via `deps` till vykomponenter (exponeras **inte** på `window`)

State sätts **inte** på `window.Store` i nuvarande kodbas.

## 2. State Management API

### Store API

State management exponeras som **ES-modul** från `js/state.js` (implementation i `js/state/index.ts`). För **lagringsnycklar**, **backup**, **serversynk** och **startflöde**, se `docs/state_and_persistence.md`.

**ES-modul:**
```javascript
import {
    getState,
    dispatch,
    subscribe,
    StoreActionTypes,
    initState,
    loadStateFromLocalStorageBackup,
    clearLocalStorageBackup,
    updateBackupRestorePosition,
    APP_STATE_KEY
} from './state.js';

// Hämta aktuell state
const state = getState();

// Dispatch action
await dispatch({
    type: StoreActionTypes.UPDATE_METADATA,
    payload: { caseNumber: '12345' }
});

// Prenumerera på state-ändringar
const unsubscribe = subscribe((newState) => {
    console.log('State updated:', newState);
});

// Backup (t.ex. efter manuell återställning)
clearLocalStorageBackup();
```

### Action Types

Fullständig lista finns i `js/state/actionTypes.ts` (exporteras som `StoreActionTypes`). Urval:

```javascript
// Action types för state management (urval)
const ActionTypes = {
    INITIALIZE_NEW_AUDIT: 'INITIALIZE_NEW_AUDIT',
    DISCARD_PREPARED_AUDIT: 'DISCARD_PREPARED_AUDIT',
    INITIALIZE_RULEFILE_EDITING: 'INITIALIZE_RULEFILE_EDITING',
    LOAD_AUDIT_FROM_FILE: 'LOAD_AUDIT_FROM_FILE',
    SET_AUDIT_STATUS: 'SET_AUDIT_STATUS',
    UPDATE_METADATA: 'UPDATE_METADATA',
    ADD_SAMPLE: 'ADD_SAMPLE',
    UPDATE_SAMPLE: 'UPDATE_SAMPLE',
    DELETE_SAMPLE: 'DELETE_SAMPLE',
    UPDATE_REQUIREMENT_RESULT: 'UPDATE_REQUIREMENT_RESULT',
    SET_RULE_FILE_CONTENT: 'SET_RULE_FILE_CONTENT',
    UPDATE_RULEFILE_CONTENT: 'UPDATE_RULEFILE_CONTENT',
    REPLACE_RULEFILE_AND_RECONCILE: 'REPLACE_RULEFILE_AND_RECONCILE',
    SET_UI_FILTER_SETTINGS: 'SET_UI_FILTER_SETTINGS',
    SET_ALL_REQUIREMENTS_FILTER_SETTINGS: 'SET_ALL_REQUIREMENTS_FILTER_SETTINGS',
    STAGE_SAMPLE_CHANGES: 'STAGE_SAMPLE_CHANGES',
    CLEAR_STAGED_SAMPLE_CHANGES: 'CLEAR_STAGED_SAMPLE_CHANGES',
    SET_REMOTE_AUDIT_ID: 'SET_REMOTE_AUDIT_ID',
    REPLACE_STATE_FROM_REMOTE: 'REPLACE_STATE_FROM_REMOTE'
};
```

### State Structure

```javascript
// State-objektets struktur
interface AppState {
    saveFileVersion: string;
    ruleFileContent: RuleFileContent | null;
    auditMetadata: AuditMetadata;
    auditStatus: 'not_started' | 'in_progress' | 'locked' | 'rulefile_editing';
    startTime: string | null;
    endTime: string | null;
    samples: Sample[];
    deficiencyCounter: number;
    uiSettings: UISettings;
    auditCalculations: AuditCalculations;
    pendingSampleChanges: SampleChanges | null;
}

interface AuditMetadata {
    caseNumber: string;
    actorName: string;
    actorLink: string;
    auditorName: string;
    caseHandler: string;
    internalComment: string;
}

interface Sample {
    id: string;
    sampleCategory: string;
    sampleType: string;
    description: string;
    url: string;
    selectedContentTypes: string[];
    requirementResults: Record<string, RequirementResult>;
}

interface RequirementResult {
    status: 'passed' | 'failed' | 'partially_audited' | 'not_audited';
    actualObservation: string;
    commentToAuditor: string;
    commentToActor: string;
    lastStatusUpdate: string;
    checkResults: Record<string, CheckResult>;
    needsReview?: boolean;
}
```

## 3. Komponenter API

### Komponentbasstruktur

Vykomponenter ska exponera samma livscykel (`init`, `render`, `destroy`). **Nya** komponenter implementeras som **klasser**; äldre sektioner kan fortfarande vara objektliteral.

```javascript
// Komponent API (gemensamt kontrakt)
interface Component {
    init({ root, deps }): Promise<void>;
    render(): void;
    destroy(): void;
}
```

### Exempel: vykomponent som klass

```javascript
// js/components/audit_view/AuditViewComponent.js
export class AuditViewComponent {
    static CSS_PATH = './audit_view_component.css';

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        if (deps.Helpers?.load_css_safely) {
            await deps.Helpers.load_css_safely(AuditViewComponent.CSS_PATH, 'AuditViewComponent');
        }
    }

    render() { /* ... */ }

    destroy() {
        this.root = null;
        this.deps = null;
    }
}
```

Registrering sker i `js/logic/view_components_index.js` (en instans per vy), inte i `main.js`.

### Komponentparametrar

```javascript
// Init-parametrar
interface ComponentInitParams {
    root: HTMLElement;              // DOM-container där komponenten renderas
    deps: {                         // Beroenden-objekt
        router: Function;          // Navigeringsfunktion
        getState: Function;         // State-getter
        dispatch: Function;         // Action dispatcher
        StoreActionTypes: Object;   // Action types
        Translation: Object;        // Översättningsfunktioner
        Helpers: Object;            // Hjälpfunktioner
        NotificationComponent: Object; // Notifikationskomponent
        AuditLogic?: Object;        // Granskningslogik (via deps)
        ValidationLogic?: Object;   // Valideringslogik (via deps)
        AutosaveService?: Object;   // Formulärautospar
        // ... andra beroenden
    }
}
```

## 4. Hjälpfunktioner API

### Helpers API

```javascript
// window.Helpers
interface Helpers {
    // DOM manipulation
    create_element(tagName: string, options?: ElementOptions): HTMLElement;
    escape_html(unsafe: string): string;
    
    // Data formatting
    format_iso_to_local_datetime(isoString: string, locale?: string): string;
    format_number_locally(number: number, locale?: string): string;
    get_current_iso_datetime_utc(): string;
    
    // Utilities
    generate_uuid_v4(): string;
    add_protocol_if_missing(url: string): string;
    natural_sort(a: string, b: string): number;
    
    // Icons
    get_icon_svg(iconName: string, colors?: string[], size?: number): string;
    
    // CSS loading
    load_css(href: string): Promise<void>;
}

// Exempel på användning
const element = window.Helpers.create_element('div', {
    class_name: 'my-class',
    text_content: 'Hello World',
    attributes: { 'data-testid': 'my-element' }
});

const safeHtml = window.Helpers.escape_html('<script>alert("xss")</script>');
const formattedDate = window.Helpers.format_iso_to_local_datetime('2025-01-27T10:30:00Z', 'sv-SE');
```

### Console Manager API

```javascript
// window.ConsoleManager (sätts i js/utils/console_manager.js)
interface ConsoleManager {
    log(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
}

// Exempel
window.ConsoleManager.log('Debug message', { data: 'value' });
window.ConsoleManager.warn('Varning', { data: 'value' });
```

### Memory Manager API

```javascript
// window.MemoryManager (sätts i js/utils/memory_manager.js)
interface MemoryManager {
    setTimeout(callback: Function, delay: number): number;
    setInterval(callback: Function, delay: number): number;
    addEventListener(target: EventTarget, event: string, handler: Function): void;
    removeEventListener(target: EventTarget, event: string, handler: Function): void;
    cleanup(): void;
}

// Exempel
const timerId = window.MemoryManager.setTimeout(() => {
    console.log('Timer executed');
}, 1000);

window.MemoryManager.addEventListener(document, 'click', handleClick);
```

## 5. Export API

### ExportLogic API

ExportLogic exponeras via `window.ExportLogic` och skapas i `js/export_logic.ts` (importeras i bootstrap som `./export_logic.ts`).

```javascript
// window.ExportLogic
interface ExportLogic {
    export_to_csv(currentAudit: AppState): void;
    export_to_excel(currentAudit: AppState): Promise<void>;
    export_to_word_criterias(currentAudit: AppState): Promise<void>;
    export_to_word_samples(currentAudit: AppState): Promise<void>;
    export_to_html(currentAudit: AppState): Promise<void>;
}

// Exempel
import { getState } from './state.js';
const state = getState();
window.ExportLogic.export_to_csv(state);
await window.ExportLogic.export_to_excel(state);
await window.ExportLogic.export_to_word_criterias(state);
await window.ExportLogic.export_to_word_samples(state);
await window.ExportLogic.export_to_html(state);
```

### Export-funktioner

```javascript
// CSV Export
function export_to_csv(current_audit) {
    // Genererar CSV-fil med brister
    // Filnamn: audit_report_deficiencies_[actor]_[date].csv
}

// Excel Export
async function export_to_excel(current_audit) {
    // Genererar Excel-fil med flera flikar
    // Filnamn: audit_report_deficiencies_[actor]_[date].xlsx
}

// Word Export (sorterat på krav)
async function export_to_word_criterias(current_audit) {
    // Genererar Word-dokument med formaterad rapport, sorterat på krav
    // Filnamn: [case_number]_[actor]_[date]_sorterat_på_krav.docx
}

// Word Export (sorterat på stickprov)
async function export_to_word_samples(current_audit) {
    // Genererar Word-dokument med formaterad rapport, sorterat på stickprov
    // Filnamn: [case_number]_[actor]_[date]_sorterat_på_stickprov.docx
}
```

## 6. Validering och granskningslogik

Granskningslogik och validering exponeras **inte** på `window`. Använd ES-import eller `deps` i vykomponenter.

### ValidationLogic API

```javascript
import * as ValidationLogic from './validation_logic.ts';

interface ValidationResult {
    isValid: boolean;
    message: string;
}

// Fristående regelfil
const validationResult = ValidationLogic.validate_rule_file_json(ruleFileData);
if (!validationResult.isValid) {
    console.error('Validation failed:', validationResult.message);
}

// Sparad granskning (toppfält + inbäddad regelfil)
const auditResult = ValidationLogic.validate_saved_audit_file(auditData);

// I vykomponenter (via deps):
const result = this.ValidationLogic.validate_saved_audit_file(auditData);
```

Validering sker i kod (`validation_logic.ts`, `validation_rulefile_requirements.ts`), inte via separata JSON Schema-filer. Felmeddelanden kommer från översättningsnycklar i `js/i18n/*.json`.

### AuditLogic API (urval)

```javascript
import * as AuditLogic from './audit_logic.ts';

// I vykomponenter:
this.AuditLogic.calculate_requirement_status(requirement, result);
this.AuditLogic.get_relevant_requirements_for_sample(ruleFileContent, sample);
this.AuditLogic.calculate_overall_audit_progress(auditData);

// Vanliga funktioner:
// calculate_check_status, calculate_requirement_status,
// get_relevant_requirements_for_sample, get_ordered_relevant_requirement_keys,
// calculate_overall_audit_progress, find_first_incomplete_requirement_key_for_sample
```

## 7. Internationalisering API

### Translation API

```javascript
// window.Translation
interface Translation {
    t(key: string, replacements?: Object): string;
    set_language(langTag: string): Promise<void>;
    get_current_language_code(): string;
    get_supported_languages(): Object;
    ensure_initial_load(): Promise<void>;
}

// Exempel
const text = window.Translation.t('welcome_message', { name: 'John' });
await window.Translation.set_language('en-GB');
const currentLang = window.Translation.get_current_language_code();
```

### Språkfiler

```javascript
// js/i18n/sv-SE.json
{
    "app_title": "Leffe",
    "welcome_message": "Välkommen, {name}!",
    "error_loading": "Fel vid laddning",
    "success_saved": "Sparat framgångsrikt"
}

// js/i18n/en-GB.json
{
    "app_title": "Audit Tool",
    "welcome_message": "Welcome, {name}!",
    "error_loading": "Error loading",
    "success_saved": "Successfully saved"
}

// js/i18n/nb-NO.json (samma nycklar som övriga språkfiler)
```

Standardspråk vid saknad översättning: **en-GB**.

## 8. Event System

### Custom Events

```javascript
// Språkändring
document.addEventListener('languageChanged', (event) => {
    console.log('Language changed to:', event.detail.language);
});

// State-ändringar
import { subscribe } from './state.js';
subscribe((newState) => {
    console.log('State updated:', newState);
});

// Komponent-events
const component = document.querySelector('.my-component');
component.addEventListener('componentUpdated', (event) => {
    console.log('Component updated:', event.detail);
});
```

### Event Dispatch

```javascript
// Dispatch custom event
const event = new CustomEvent('languageChanged', {
    detail: { language: 'en-GB' }
});
document.dispatchEvent(event);
```

## 9. Error Handling

### Error Boundary API

`ErrorBoundaryComponent` är en **klass** (`js/components/ErrorBoundaryComponent.js`) som instansieras i `main.js`. Den exponeras **inte** på `window`.

```javascript
import { ErrorBoundaryComponent } from './components/ErrorBoundaryComponent.js';

const errorBoundary = new ErrorBoundaryComponent();
await errorBoundary.init({ root, deps });

errorBoundary.show_error({
    message: 'Component failed to render',
    stack: 'Error stack trace...',
    component: 'MyComponent'
});
```

### Error Types

```javascript
// Olika typer av fel
const ErrorTypes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RENDER_ERROR: 'RENDER_ERROR',
    STATE_ERROR: 'STATE_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};
```

## 10. Exempel

### Komplett komponent-exempel

```javascript
// js/components/ExampleComponent.js
import '../../css/components/example_component.css';

export const ExampleComponent = {
    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        
        // Lyssna på state-ändringar
        this.unsubscribe = deps.subscribe(this.handleStateChange.bind(this));
        
        // Ladda CSS
        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(
                './css/components/example_component.css',
                'ExampleComponent'
            );
        }
        
        // Initial rendering
        this.render();
    },
    
    render() {
        if (!this.root) return;
        
        const state = this.getState();
        const t = this.Translation.t;
        
        // Rensa root
        this.root.innerHTML = '';
        
        // Skapa element med Helpers.create_element
        const container = this.Helpers.create_element('div', {
            class_name: 'example-component'
        });
        
        const heading = this.Helpers.create_element('h2', {
            text_content: t('example_title')
        });
        
        const statusText = this.Helpers.create_element('p', {
            text_content: `Status: ${state.auditStatus}`
        });
        
        const button = this.Helpers.create_element('button', {
            class_name: 'example-button',
            text_content: t('click_here'),
            attributes: { 'data-testid': 'example-button' }
        });
        
        container.appendChild(heading);
        container.appendChild(statusText);
        container.appendChild(button);
        this.root.appendChild(container);
        
        // Event listeners
        button.addEventListener('click', this.handleClick.bind(this));
    },
    
    handleClick(event) {
        this.dispatch({
            type: this.StoreActionTypes.UPDATE_METADATA,
            payload: { caseNumber: '12345' }
        });
    },
    
    handleStateChange(newState) {
        this.render();
    },
    
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        
        if (this.root) {
            this.root.innerHTML = '';
        }
        
        this.root = null;
        this.deps = null;
    }
};
```

### State management-exempel

```javascript
// Importera från modul
import { dispatch, getState, StoreActionTypes } from './state.js';
import * as Helpers from './utils/helpers.js';

// Skapa ny granskning
await dispatch({
    type: StoreActionTypes.INITIALIZE_NEW_AUDIT,
    payload: {
        ruleFileContent: ruleFileData
    }
});

// Uppdatera metadata
await dispatch({
    type: StoreActionTypes.UPDATE_METADATA,
    payload: {
        caseNumber: '2025-001',
        actorName: 'Testföretag AB',
        auditorName: 'Anna Andersson'
    }
});

// Lägg till stickprov
await dispatch({
    type: StoreActionTypes.ADD_SAMPLE,
    payload: {
        id: Helpers.generate_uuid_v4(),
        description: 'Startsida',
        url: 'https://example.com',
        selectedContentTypes: ['text', 'images']
    }
});

// Uppdatera kravresultat
await dispatch({
    type: StoreActionTypes.UPDATE_REQUIREMENT_RESULT,
    payload: {
        sampleId: 'sample-123',
        requirementId: 'req-1',
        newRequirementResult: {
            status: 'failed',
            actualObservation: 'Brist observerad',
            commentToActor: 'Förbättring krävs'
        }
    }
});
```

### Export-exempel

```javascript
// Exportera till olika format
import { getState } from './state.js';

const state = getState();

// CSV-export
window.ExportLogic.export_to_csv(state);

// Excel-export
try {
    await window.ExportLogic.export_to_excel(state);
    window.NotificationComponent.show_global_message('Excel-fil genererad', 'success');
} catch (error) {
    window.NotificationComponent.show_global_message('Fel vid Excel-export', 'error');
}

// Word-export (sorterat på krav)
try {
    await window.ExportLogic.export_to_word_criterias(state);
    window.NotificationComponent.show_global_message('Word-dokument genererat', 'success');
} catch (error) {
    window.NotificationComponent.show_global_message('Fel vid Word-export', 'error');
}

// Word-export (sorterat på stickprov)
try {
    await window.ExportLogic.export_to_word_samples(state);
    window.NotificationComponent.show_global_message('Word-dokument genererat', 'success');
} catch (error) {
    window.NotificationComponent.show_global_message('Fel vid Word-export', 'error');
}

// HTML-export
try {
    await window.ExportLogic.export_to_html(state);
    window.NotificationComponent.show_global_message('HTML-fil genererad', 'success');
} catch (error) {
    window.NotificationComponent.show_global_message('Fel vid HTML-export', 'error');
}
```

---

## Backend HTTP API – JSON-storlek och reverse proxy

- Max storlek för JSON-body (t.ex. `POST /api/audits/import`) är **10 MiB** (`JSON_MAX_UPLOAD_BYTES` i `js/constants/json_upload_limits.js`), samma värde som `express.json` använder i `server/index.js`.
- Klienten avvisar uppladdade JSON-filer större än samma gräns innan parsning (gransknings-/regeluppladdning i granskningsvyn).
- **Import av granskning** valideras på servern med samma logik som `validate_saved_audit_file` (toppfält, metadata/stickprov/typ av status, samt inbäddad regelfil enligt `validation_logic.ts`). Felmeddelanden byggs från `js/i18n/sv-SE.json` via `audit_import_t` i `server/routes/audit_route_support.ts`; import-routes i `server/routes/audit_import_routes.ts`.
- **JSON-struktur:** `js/utils/json_structure_guard.js` begränsar nästlingsdjup och antal noder på importerad data (klient och server).
- **Rate limit:** `POST /api/audits/import` och `POST /api/rules/import` använder `import_payload_rate_limiter` i `server/middleware/rateLimiter.js` (svar **429** vid för många försök).
- I **produktion** bakom t.ex. **nginx**: sätt `client_max_body_size` till minst **10m** så proxyn inte avvisar begäran innan den når Node (annars kan användaren få otydliga fel). `server/index.js` använder `trust proxy` för korrekt klient-IP bakom proxy.

## Autentisering och CSRF

- API-anrop efter inloggning använder **`Authorization: Bearer <JWT>`** (se `js/api/client.js`), inte en sessionscookie för själva API:t. **CSRF** mot klassiska cookie-sessioner är därför mindre centralt här än i äldre cookie-only appar. **CORS** är allowlist-baserad (`ALLOWED_ORIGINS` / `PUBLIC_APP_URL` i `server/index.js`).
- Om ni i framtiden låter API:t använda **HttpOnly-cookie** för autentisering utan Bearer-header bör ni införa **CSRF-token** eller strikt **SameSite**-policy för den cookien.

## Export – integritetsfält (SHA-256)

- Vid nedladdning av granskning som JSON (klient `save_audit_to_json_file` / server `GET /api/audits/:id/export`) kan filen innehålla `exportIntegrity: { algorithm: 'SHA-256', value: '<hex>' }`.
- Hashen beräknas över **kanonisk JSON**: hela nyttolasten **utan** `exportIntegrity`, serialiserad med `JSON.stringify(obj, null, 2)` (UTF-8). Verifiering: ta bort `exportIntegrity`, stringify likadant, SHA-256, jämför med `value`. Serverhjälp: `server/utils/export_integrity_node.js`; klient: `js/utils/export_integrity.js`.

## Markdown och visning (XSS)

- Markdown som blir HTML ska där det är användargenererat innehåll i första hand gå via `Helpers.sanitize_html` efter `marked.parse` (se t.ex. stickprov formulär).

---

**Support:** För frågor om API:er, se [Utvecklarguide](utvecklarguide.md) eller skapa en issue i repository.
