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

```javascript
// Hämta aktuell state
const state = window.Store.getState();

// Dispatch action
window.Store.dispatch({
    type: 'UPDATE_METADATA',
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
    init(container, routerCallback, params, getState, dispatch, actionTypes, subscribe): Promise<void>;
    render(): void;
    destroy(): void;
}
```

### Exempel: UploadViewComponent

```javascript
// js/components/UploadViewComponent.js
window.UploadViewComponent = {
    async init(container, routerCallback, params, getState, dispatch, actionTypes, subscribe) {
        // Initialisering
    },
    
    render() {
        // Rendering
    },
    
    destroy() {
        // Cleanup
    }
};
```

### Komponentparametrar

```javascript
// Init-parametrar
interface ComponentInitParams {
    container: HTMLElement;           // DOM-container
    routerCallback: Function;         // Navigeringsfunktion
    params: Object;                  // URL-parametrar
    getState: Function;              // State-getter
    dispatch: Function;              // Action dispatcher
    actionTypes: Object;             // Action types
    subscribe: Function;             // State subscription
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

```javascript
// window.ExportLogic
interface ExportLogic {
    export_to_csv(currentAudit: AppState): void;
    export_to_excel(currentAudit: AppState): Promise<void>;
    export_to_word_criterias(currentAudit: AppState): Promise<void>;
    export_to_word_samples(currentAudit: AppState): Promise<void>;
}

// Exempel
const state = window.Store.getState();
window.ExportLogic.export_to_csv(state);
await window.ExportLogic.export_to_excel(state);
await window.ExportLogic.export_to_word_criterias(state);
await window.ExportLogic.export_to_word_samples(state);
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
(function() {
    'use strict';
    
    let componentState = {
        container: null,
        routerCallback: null,
        getState: null,
        dispatch: null,
        actionTypes: null,
        unsubscribe: null
    };
    
    async function init(container, routerCallback, params, getState, dispatch, actionTypes, subscribe) {
        componentState.container = container;
        componentState.routerCallback = routerCallback;
        componentState.getState = getState;
        componentState.dispatch = dispatch;
        componentState.actionTypes = actionTypes;
        
        // Lyssna på state-ändringar
        componentState.unsubscribe = subscribe(handleStateChange);
        
        // Ladda CSS
        await window.Helpers.load_css('css/components/example_component.css');
        
        // Initial rendering
        render();
    }
    
    function render() {
        const state = componentState.getState();
        
        componentState.container.innerHTML = `
            <div class="example-component">
                <h2>Exempel</h2>
                <p>Status: ${state.auditStatus}</p>
                <button class="example-button" data-testid="example-button">
                    Klicka här
                </button>
            </div>
        `;
        
        setupEventListeners();
    }
    
    function setupEventListeners() {
        componentState.container.addEventListener('click', handleClick);
    }
    
    function handleClick(event) {
        if (event.target.matches('.example-button')) {
            handleExampleAction();
        }
    }
    
    function handleExampleAction() {
        componentState.dispatch({
            type: componentState.actionTypes.UPDATE_METADATA,
            payload: { caseNumber: '12345' }
        });
    }
    
    function handleStateChange(newState) {
        render();
    }
    
    function destroy() {
        if (componentState.unsubscribe) {
            componentState.unsubscribe();
        }
        
        componentState.container.removeEventListener('click', handleClick);
        componentState.container.innerHTML = '';
    }
    
    window.ExampleComponent = {
        init,
        render,
        destroy
    };
})();
```

### State management-exempel

```javascript
// Skapa ny granskning
window.Store.dispatch({
    type: window.StoreActionTypes.INITIALIZE_NEW_AUDIT,
    payload: {
        ruleFileContent: ruleFileData
    }
});

// Uppdatera metadata
window.Store.dispatch({
    type: window.StoreActionTypes.UPDATE_METADATA,
    payload: {
        caseNumber: '2025-001',
        actorName: 'Testföretag AB',
        auditorName: 'Anna Andersson'
    }
});

// Lägg till stickprov
window.Store.dispatch({
    type: window.StoreActionTypes.ADD_SAMPLE,
    payload: {
        id: window.Helpers.generate_uuid_v4(),
        description: 'Startsida',
        url: 'https://example.com',
        selectedContentTypes: ['text', 'images']
    }
});

// Uppdatera kravresultat
window.Store.dispatch({
    type: window.StoreActionTypes.UPDATE_REQUIREMENT_RESULT,
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
```

---

**Support:** För frågor om API:er, se [Utvecklarguide](utvecklarguide.md) eller skapa en issue i repository.
