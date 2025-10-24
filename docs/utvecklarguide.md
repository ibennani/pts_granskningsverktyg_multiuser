# Utvecklarguide - Granskningsverktyget

**Version:** 1.0  
**Datum:** 2025-01-27

## Innehållsförteckning

1. [Utvecklingsmiljö](#1-utvecklingsmiljö)
2. [Projektarkitektur](#2-projektarkitektur)
3. [Kodstandarder](#3-kodstandarder)
4. [Utvecklingsworkflow](#4-utvecklingsworkflow)
5. [Komponentutveckling](#5-komponentutveckling)
6. [State Management](#6-state-management)
7. [Testning](#7-testning)
8. [Debugging](#8-debugging)
9. [Prestanda](#9-prestanda)
10. [Säkerhet](#10-säkerhet)

## 1. Utvecklingsmiljö

### Rekommenderade verktyg

- **Kodredigerare**: VS Code med följande tillägg:
  - ESLint
  - Prettier
  - Live Server
  - GitLens
  - Auto Rename Tag
  - Bracket Pair Colorizer

- **Webbläsare**: Chrome med utvecklarverktyg
- **Versionshantering**: Git
- **Terminal**: VS Code Integrated Terminal eller liknande

### Miljövariabler

Skapa `.env.local` för lokala inställningar:

```bash
# Utveckling
NODE_ENV=development
VITE_APP_DEBUG=true
VITE_APP_LOG_LEVEL=debug

# API-endpoints (om relevant)
VITE_API_BASE_URL=http://localhost:3000/api
```

## 2. Projektarkitektur

### Översikt

```
Granskningsverktyget/
├── js/
│   ├── main.js                 # Applikationsstartpunkt
│   ├── state.js               # State management
│   ├── components/             # UI-komponenter
│   ├── logic/                 # Affärslogik
│   ├── utils/                 # Hjälpfunktioner
│   └── i18n/                  # Språkfiler
├── css/
│   ├── style.css              # Globala stilar
│   ├── components/            # Komponentspecifika stilar
│   └── features/              # Funktionsspecifika stilar
├── tests/                     # Tester
└── docs/                      # Dokumentation
```

### Arkitekturprinciper

1. **Modulär design**: Varje komponent är en ES6-modul
2. **Separation of concerns**: UI, logik och data är separerade
3. **Komponentbaserat**: Återanvändbara UI-komponenter
4. **State management**: Centraliserad state med Redux-liknande pattern
5. **Internationalisering**: Språkstöd via JSON-filer

### Dataflöde

```
User Action → Component → State Update → Re-render
     ↓
Event Handler → Dispatch Action → Reducer → New State
     ↓
State Change → Component Re-render → UI Update
```

## 3. Kodstandarder

### JavaScript

**Namngivning:**
```javascript
// Variabler: camelCase
const userName = 'john';
const isLoggedIn = true;

// Funktioner: camelCase
function calculateScore() { }
const handleClick = () => { };

// Klasser: PascalCase
class UserComponent { }

// Konstanter: UPPER_SNAKE_CASE
const API_BASE_URL = 'https://api.example.com';
```

**Funktionsstruktur:**
```javascript
// Använd funktionsdeklarationer för huvudfunktioner
function processData(data) {
    // Validering först
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid data provided');
    }
    
    // Huvudlogik
    const processedData = data.map(item => ({
        id: item.id,
        name: item.name.trim(),
        status: item.status || 'unknown'
    }));
    
    // Returnera resultat
    return processedData;
}

// Använd arrow functions för korta funktioner
const formatDate = (date) => new Date(date).toLocaleDateString('sv-SE');
```

**Kommentarer:**
```javascript
/**
 * Beräknar kvalitetspoäng baserat på granskningsresultat
 * @param {Object} auditData - Granskningsdata
 * @param {Array} auditData.samples - Stickprov
 * @param {Object} auditData.ruleFileContent - Regelfil
 * @returns {number} Poäng mellan 0-100
 */
function calculateQualityScore(auditData) {
    // Implementation...
}
```

### CSS

**BEM-metodologi:**
```css
/* Block */
.requirement-card { }

/* Element */
.requirement-card__title { }
.requirement-card__content { }

/* Modifier */
.requirement-card--highlighted { }
.requirement-card--disabled { }
```

**CSS-variabler:**
```css
:root {
    --color-primary: #6E3282;
    --color-secondary: #F4F1EE;
    --spacing-small: 8px;
    --spacing-medium: 16px;
    --spacing-large: 24px;
}
```

### HTML

**Semantisk HTML:**
```html
<main role="main">
    <section aria-labelledby="requirements-heading">
        <h2 id="requirements-heading">Krav</h2>
        <ul role="list">
            <li role="listitem">
                <article>
                    <h3>Kravtitel</h3>
                    <p>Beskrivning</p>
                </article>
            </li>
        </ul>
    </section>
</main>
```

## 4. Utvecklingsworkflow

### Git Workflow

1. **Skapa feature branch**
   ```bash
   git checkout -b feature/ny-funktion
   ```

2. **Utveckla funktionalitet**
   ```bash
   # Gör ändringar
   git add .
   git commit -m "feat: lägg till ny funktion"
   ```

3. **Testa ändringar**
   ```bash
   npm run lint
   npm run test:e2e
   ```

4. **Pusha och skapa PR**
   ```bash
   git push origin feature/ny-funktion
   # Skapa Pull Request
   ```

### Commit-meddelanden

Följ [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Typer
feat: ny funktion
fix: buggfix
docs: dokumentation
style: formatering
refactor: omstrukturering
test: tester
chore: underhåll

# Exempel
feat: lägg till export till Word-format
fix: korrigera validering av regelfiler
docs: uppdatera användarmanual
```

### Code Review

**Vad att kontrollera:**
- Kodkvalitet och läsbarhet
- Prestanda och optimering
- Säkerhet och validering
- Testtäckning
- Dokumentation
- Tillgänglighet

## 5. Komponentutveckling

### Komponentstruktur

```javascript
// js/components/ExampleComponent.js
(function() {
    'use strict';
    
    let componentState = {
        isVisible: false,
        data: null
    };
    
    let domElements = {};
    
    async function init(container, routerCallback, params, getState, dispatch, actionTypes, subscribe) {
        // Initialisering
        domElements.container = container;
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
        
        domElements.container.innerHTML = `
            <div class="example-component">
                <h2>Exempel</h2>
                <p>Innehåll: ${state.exampleData || 'Ingen data'}</p>
            </div>
        `;
        
        // Event listeners
        setupEventListeners();
    }
    
    function setupEventListeners() {
        // Event delegation för bättre prestanda
        domElements.container.addEventListener('click', handleClick);
    }
    
    function handleClick(event) {
        const target = event.target;
        
        if (target.matches('.example-button')) {
            handleExampleAction();
        }
    }
    
    function handleExampleAction() {
        // Dispatch action
        componentState.dispatch({
            type: componentState.actionTypes.EXAMPLE_ACTION,
            payload: { data: 'example' }
        });
    }
    
    function handleStateChange(newState) {
        // Uppdatera komponent vid state-ändringar
        if (componentState.isVisible) {
            render();
        }
    }
    
    function destroy() {
        // Cleanup
        if (componentState.unsubscribe) {
            componentState.unsubscribe();
        }
        
        domElements.container.removeEventListener('click', handleClick);
        domElements.container.innerHTML = '';
    }
    
    // Exportera komponent
    window.ExampleComponent = {
        init,
        render,
        destroy
    };
})();
```

### CSS för komponenter

```css
/* css/components/example_component.css */
.example-component {
    padding: var(--spacing-medium);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-background);
}

.example-component__title {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: var(--spacing-small);
}

.example-component__content {
    color: var(--color-text-secondary);
}

.example-component--highlighted {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
}

/* Responsiv design */
@media (max-width: 768px) {
    .example-component {
        padding: var(--spacing-small);
    }
}
```

## 6. State Management

### State-struktur

```javascript
// js/state.js
const initial_state = {
    saveFileVersion: '2.1.0',
    ruleFileContent: null,
    auditMetadata: {
        caseNumber: '',
        actorName: '',
        actorLink: '',
        auditorName: '',
        caseHandler: '',
        internalComment: ''
    },
    auditStatus: 'not_started',
    startTime: null,
    endTime: null,
    samples: [],
    uiSettings: {
        requirementListFilter: {
            searchText: '',
            sortBy: 'default',
            status: { 
                passed: true, 
                failed: true, 
                partially_audited: true, 
                not_audited: true 
            }
        }
    }
};
```

### Actions

```javascript
// Action types
export const ActionTypes = {
    INITIALIZE_NEW_AUDIT: 'INITIALIZE_NEW_AUDIT',
    UPDATE_METADATA: 'UPDATE_METADATA',
    ADD_SAMPLE: 'ADD_SAMPLE',
    UPDATE_SAMPLE: 'UPDATE_SAMPLE',
    DELETE_SAMPLE: 'DELETE_SAMPLE',
    SET_AUDIT_STATUS: 'SET_AUDIT_STATUS',
    UPDATE_REQUIREMENT_RESULT: 'UPDATE_REQUIREMENT_RESULT'
};

// Action creators
function initializeNewAudit(ruleFileContent) {
    return {
        type: ActionTypes.INITIALIZE_NEW_AUDIT,
        payload: { ruleFileContent }
    };
}

function updateMetadata(metadata) {
    return {
        type: ActionTypes.UPDATE_METADATA,
        payload: metadata
    };
}
```

### Reducers

```javascript
function root_reducer(current_state, action) {
    switch (action.type) {
        case ActionTypes.INITIALIZE_NEW_AUDIT:
            return {
                ...initial_state,
                ruleFileContent: action.payload.ruleFileContent,
                auditStatus: 'not_started'
            };
            
        case ActionTypes.UPDATE_METADATA:
            return {
                ...current_state,
                auditMetadata: { 
                    ...current_state.auditMetadata, 
                    ...action.payload 
                }
            };
            
        case ActionTypes.ADD_SAMPLE:
            return {
                ...current_state,
                samples: [...current_state.samples, action.payload]
            };
            
        default:
            return current_state;
    }
}
```

## 7. Testning

### Enhetstester

```javascript
// tests/unit/example.test.js
import { describe, test, expect } from 'jest';

describe('ExampleComponent', () => {
    test('should render correctly', () => {
        const component = new ExampleComponent();
        const container = document.createElement('div');
        
        component.init(container, mockRouter, {});
        component.render();
        
        expect(container.innerHTML).toContain('Exempel');
    });
    
    test('should handle click events', () => {
        const component = new ExampleComponent();
        const container = document.createElement('div');
        
        component.init(container, mockRouter, {});
        component.render();
        
        const button = container.querySelector('.example-button');
        button.click();
        
        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'EXAMPLE_ACTION',
            payload: { data: 'example' }
        });
    });
});
```

### E2E-tester

```javascript
// tests/example.e2e.spec.js
import { test, expect } from '@playwright/test';

test.describe('Example Feature', () => {
    test('should load example page', async ({ page }) => {
        await page.goto('/');
        
        await expect(page.locator('h1')).toContainText('Granskningsverktyget');
    });
    
    test('should handle user interaction', async ({ page }) => {
        await page.goto('/');
        
        await page.click('[data-testid="example-button"]');
        await expect(page.locator('.example-result')).toBeVisible();
    });
});
```

### Testdata

```javascript
// tests/fixtures/example-data.js
export const mockRuleFile = {
    metadata: {
        title: 'Test Regelfil',
        version: '1.0.0',
        pageTypes: ['Startsida', 'Produktsida'],
        contentTypes: [
            { id: 'text', text: 'Text' },
            { id: 'images', text: 'Bilder' }
        ]
    },
    requirements: {
        'req-1': {
            id: 'req-1',
            title: 'Test Krav',
            expectedObservation: 'Test observation',
            contentType: ['text'],
            checks: []
        }
    }
};
```

## 8. Debugging

### Browser Developer Tools

**Console debugging:**
```javascript
// Aktivera debug-läge
window.DEBUG = true;

// Logga state-ändringar
console.log('Current state:', getState());

// Logga action dispatch
const originalDispatch = dispatch;
dispatch = (action) => {
    console.log('Dispatching action:', action);
    return originalDispatch(action);
};
```

**Network debugging:**
```javascript
// Övervaka fetch-anrop
const originalFetch = window.fetch;
window.fetch = (...args) => {
    console.log('Fetch request:', args);
    return originalFetch(...args).then(response => {
        console.log('Fetch response:', response);
        return response;
    });
};
```

### VS Code Debugging

**Launch configuration** (`.vscode/launch.json`):
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Debug Tests",
            "type": "node",
            "request": "launch",
            "program": "${workspaceFolder}/node_modules/.bin/jest",
            "args": ["--runInBand"],
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen"
        }
    ]
}
```

### Performance Debugging

```javascript
// Mät renderingstid
function measureRenderTime(componentName, renderFunction) {
    const start = performance.now();
    renderFunction();
    const end = performance.now();
    console.log(`${componentName} render time: ${end - start}ms`);
}

// Mät minnesanvändning
function logMemoryUsage() {
    if (performance.memory) {
        console.log('Memory usage:', {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB'
        });
    }
}
```

## 9. Prestanda

### Optimering

**Lazy loading:**
```javascript
// Ladda komponenter vid behov
async function loadComponent(componentName) {
    const module = await import(`./components/${componentName}.js`);
    return module[componentName];
}
```

**Memoization:**
```javascript
// Cacha beräkningar
const memoizedCalculation = (() => {
    const cache = new Map();
    
    return (input) => {
        if (cache.has(input)) {
            return cache.get(input);
        }
        
        const result = expensiveCalculation(input);
        cache.set(input, result);
        return result;
    };
})();
```

**Event delegation:**
```javascript
// Använd event delegation för bättre prestanda
document.addEventListener('click', (event) => {
    if (event.target.matches('.dynamic-button')) {
        handleButtonClick(event.target);
    }
});
```

### Bundle Optimization

**Vite-konfiguration:**
```javascript
// vite.config.mjs
export default {
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['exceljs', 'docx'],
                    utils: ['./js/utils/helpers.js', './js/utils/console_manager.js']
                }
            }
        }
    }
};
```

## 10. Säkerhet

### Input Validation

```javascript
// Validera användarinput
function validateInput(input, type) {
    switch (type) {
        case 'email':
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
        case 'url':
            try {
                new URL(input);
                return true;
            } catch {
                return false;
            }
        case 'text':
            return typeof input === 'string' && input.length <= 1000;
        default:
            return false;
    }
}
```

### XSS Prevention

```javascript
// Sanera HTML
function sanitizeHTML(unsafe) {
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
}

// Använd säkra DOM-metoder
function createSafeElement(tag, content) {
    const element = document.createElement(tag);
    element.textContent = content; // Säker
    return element;
}
```

### Data Protection

```javascript
// Kryptera känslig data
function encryptSensitiveData(data) {
    // Använd Web Crypto API för kryptering
    return crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(12) },
        key,
        new TextEncoder().encode(JSON.stringify(data))
    );
}
```

## Ytterligare resurser

- [MDN Web Docs](https://developer.mozilla.org/)
- [Vite dokumentation](https://vitejs.dev/guide/)
- [Playwright dokumentation](https://playwright.dev/docs/intro)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Support:** För frågor om utveckling, kontakta utvecklingsteamet eller skapa en issue i repository.
