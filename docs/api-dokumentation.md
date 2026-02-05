# API-dokumentation - Granskningsverktyget

**Version:** 1.0  
**Datum:** 2025-01-27

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

Granskningsverktyget använder en modulär arkitektur med tydliga API:er för varje komponent. Alla API:er är dokumenterade med TypeScript-liknande typer för bättre förståelse.

### API-struktur

```
window.Store          # State management
window.Helpers        # Hjälpfunktioner
window.Translation    # Internationalisering
window.ExportLogic    # Export-funktionalitet
window.AuditLogic     # Granskningslogik
window.ValidationLogic # Validering
```

## 2. State Management API

### Store API

State management exponeras både som ES-modul och via `window.Store` för bakåtkompatibilitet.

**ES-modul (rekommenderat):**
```javascript
import { getState, dispatch, subscribe, StoreActionTypes } from './state.js';

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
```

**Via window (bakåtkompatibilitet):**
```javascript
// Hämta aktuell state
const state = window.Store.getState();

// Dispatch action
await window.Store.dispatch({
    type: window.StoreActionTypes.UPDATE_METADATA,
    payload: { caseNumber: '12345' }
});

// Prenumerera på state-ändringar
const unsubscribe = window.Store.subscribe((newState) => {
    console.log('State updated:', newState);
});

// Rensa autosave
window.Store.clearAutosavedState();

// Tvinga sparning till localStorage
window.Store.forceSaveStateToLocalStorage(state);
```

### Action Types

```javascript
// Action types för state management
const ActionTypes = {
    // Audit management
    INITIALIZE_NEW_AUDIT: 'INITIALIZE_NEW_AUDIT',
    INITIALIZE_RULEFILE_EDITING: 'INITIALIZE_RULEFILE_EDITING',
    LOAD_AUDIT_FROM_FILE: 'LOAD_AUDIT_FROM_FILE',
    SET_AUDIT_STATUS: 'SET_AUDIT_STATUS',
    
    // Metadata
    UPDATE_METADATA: 'UPDATE_METADATA',
    
    // Samples
    ADD_SAMPLE: 'ADD_SAMPLE',
    UPDATE_SAMPLE: 'UPDATE_SAMPLE',
    DELETE_SAMPLE: 'DELETE_SAMPLE',
    
    // Requirements
    UPDATE_REQUIREMENT_RESULT: 'UPDATE_REQUIREMENT_RESULT',
    UPDATE_REQUIREMENT_DEFINITION: 'UPDATE_REQUIREMENT_DEFINITION',
    ADD_REQUIREMENT_DEFINITION: 'ADD_REQUIREMENT_DEFINITION',
    DELETE_REQUIREMENT_DEFINITION: 'DELETE_REQUIREMENT_DEFINITION',
    
    // UI
    SET_UI_FILTER_SETTINGS: 'SET_UI_FILTER_SETTINGS',
    STAGE_SAMPLE_CHANGES: 'STAGE_SAMPLE_CHANGES',
    CLEAR_STAGED_SAMPLE_CHANGES: 'CLEAR_STAGED_SAMPLE_CHANGES'
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

Alla komponenter följer samma API-mönster:

```javascript
// Komponent API
interface Component {
    init({ root, deps }): Promise<void>;
    render(): void;
    destroy(): void;
}
```

### Exempel: UploadViewComponent

```javascript
// js/components/UploadViewComponent.js
export const UploadViewComponent = {
    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        
        // Ladda CSS
        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'UploadViewComponent');
        }
    },
    
    render() {
        // Rendering
    },
    
    destroy() {
        // Cleanup
        this.root = null;
        this.deps = null;
    }
};
```

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
        ValidationLogic?: Object;   // Valideringslogik (valfritt)
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
    className: 'my-class',
    textContent: 'Hello World',
    attributes: { 'data-testid': 'my-element' }
});

const safeHtml = window.Helpers.escape_html('<script>alert("xss")</script>');
const formattedDate = window.Helpers.format_iso_to_local_datetime('2025-01-27T10:30:00Z', 'sv-SE');
```

### Console Manager API

```javascript
// window.consoleManager
interface ConsoleManager {
    log(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
}

// Exempel
window.consoleManager.log('Debug message', { data: 'value' });
window.consoleManager.error('Error occurred', error);
```

### Memory Manager API

```javascript
// window.memoryManager
interface MemoryManager {
    setTimeout(callback: Function, delay: number): number;
    setInterval(callback: Function, delay: number): number;
    addEventListener(target: EventTarget, event: string, handler: Function): void;
    removeEventListener(target: EventTarget, event: string, handler: Function): void;
    cleanup(): void;
}

// Exempel
const timerId = window.memoryManager.setTimeout(() => {
    console.log('Timer executed');
}, 1000);

window.memoryManager.addEventListener(document, 'click', handleClick);
```

## 5. Export API

### ExportLogic API

ExportLogic exponeras via `window.ExportLogic` och skapas i `js/export_logic.js`.

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
const state = window.Store.getState();
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

## 6. Validering API

### ValidationLogic API

```javascript
// window.ValidationLogic
interface ValidationLogic {
    validate_rule_file_json(jsonObject: Object): ValidationResult;
    validate_saved_audit_file(jsonObject: Object): ValidationResult;
}

interface ValidationResult {
    isValid: boolean;
    message: string;
}

// Exempel
const validationResult = window.ValidationLogic.validate_rule_file_json(ruleFileData);
if (!validationResult.isValid) {
    console.error('Validation failed:', validationResult.message);
}
```

### Valideringsregler

```javascript
// Regelfil-validering
const RULE_FILE_SCHEMA = {
    metadata: {
        title: { type: 'string', required: true },
        version: { type: 'string', required: false },
        pageTypes: { type: 'array', required: true },
        contentTypes: { type: 'array', required: true }
    },
    requirements: { type: 'object', required: true }
};

// Sparfil-validering
const SAVED_AUDIT_SCHEMA = {
    saveFileVersion: { type: 'string', required: true },
    ruleFileContent: { type: 'object', required: true },
    auditMetadata: { type: 'object', required: true },
    auditStatus: { type: 'string', required: true },
    samples: { type: 'array', required: true }
};
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
    "app_title": "Granskningsverktyget",
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
```

## 8. Event System

### Custom Events

```javascript
// Språkändring
document.addEventListener('languageChanged', (event) => {
    console.log('Language changed to:', event.detail.language);
});

// State-ändringar
window.Store.subscribe((newState) => {
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

```javascript
// window.ErrorBoundaryComponent
interface ErrorBoundaryComponent {
    init(container: HTMLElement): Promise<void>;
    show_error(error: ErrorInfo): void;
    clear_error(): void;
    destroy(): void;
}

interface ErrorInfo {
    message: string;
    stack: string;
    component: string;
}

// Exempel
window.ErrorBoundaryComponent.show_error({
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
// Importera från modul (rekommenderat)
import { dispatch, getState, StoreActionTypes } from './state.js';

// Eller använd window (bakåtkompatibilitet)
const { dispatch, getState, StoreActionTypes } = window.Store;

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
        id: window.Helpers.generate_uuid_v4(),
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
const state = window.Store.getState();

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

**Support:** För frågor om API:er, se [Utvecklarguide](utvecklarguide.md) eller skapa en issue i repository.
