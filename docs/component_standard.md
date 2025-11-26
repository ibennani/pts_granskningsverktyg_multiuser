# Komponentstandard för granskningsverktyget (frontend)

Detta dokument beskriver den **officiella komponentmodellen** för projektet.  
Alla nya komponenter ska följa denna standard, och befintliga komponenter ska migreras hit när de ändå ändras.

Målet är:
- Enhetlig struktur för alla komponenter
- Konsekvent användning av ES-moduler
- Inga IIFE-baserade komponenter
- Inga globala `window.*`-objekt (förutom ett minimalt bootstrap-lager)
- Förutsägbar livscykel: `init → render → destroy`

---

## 1. Grundstruktur för komponenter

Varje komponent ligger i en egen JS-fil, t.ex. `MyComponent.js`, och exporterar ett objekt med metoderna `init`, `render` och `destroy`.

```js
// MyComponent.js
import "./MyComponent.css";

export const MyComponent = {
  init({ root, deps }) {
    // `root` är DOM-elementet där komponenten ska rendera sin innehåll.
    // `deps` är ett objekt med beroenden (t.ex. store, helpers, translation)
    // som kan skickas in från anroparen.

    this.root = root;
    this.deps = deps;
    this._boundHandlers = {};

    // Sätt upp event listeners här (helst via hjälpfunktioner)
    // t.ex. this._bindEvents();
  },

  render(state) {
    // Uppdatera DOM utifrån inkommande state/props.
    // `state` kan vara hela applikationsstatet eller en delmängd,
    // beroende på hur komponenten används.

    if (!this.root) return;

    // Exempel: använd en templating-helper eller createElement
    // this.root.innerHTML = "..."; // endast via säker helper
  },

  destroy() {
    // Ta bort event listeners och nollställ referenser för att undvika minnesläckor.

    // t.ex:
    // if (this._boundHandlers.click) {
    //   this.root.removeEventListener("click", this._boundHandlers.click);
    // }

    this._boundHandlers = {};
    this.root = null;
    this.deps = null;
  },
};
```

### Viktiga regler

1. **Ingen IIFE i komponenter**  
   **Förbjudet** mönster (ska fasas ut):
   ```js
   export const MyComponent = (function () {
     // ...
     return { init, render, destroy };
   })();
   ```

2. **Inga komponenter på `window`**  
   Komponenter ska aldrig exponeras som `window.MyComponent`.  
   De ska importeras där de används:

   ```js
   import { MyComponent } from "./MyComponent.js";
   ```

3. **Ingen implicit global state i komponenten**  
   Komponenten får använda `this` internt för att lagra referenser och handlers,  
   men ska inte påverka globala objekt direkt (förutom via tydliga beroenden, t.ex. `deps.store.dispatch`).

---

## 2. ES-moduler och beroenden

### Importera alltid med `import`/`export`

All kod ska, där det är möjligt, använda ES-moduler:

```js
// Exempel på modul
export function doSomething() { /* ... */ }

// Konsumerande modul
import { doSomething } from "../utils/doSomething.js";
```

### Beroenden in i komponenter

Komponenter kan få in beroenden på två sätt:

1. **Via ES-imports (standard och förstahandsval)**

   ```js
   import { Helpers } from "../utils/Helpers.js";
   import { Translation } from "../i18n/Translation.js";
   ```

2. **Via `deps`-objektet i `init` (om det behövs)**

   ```js
   MyComponent.init({
     root: rootElement,
     deps: {
       store,
       router,
       logger,
     },
   });
   ```

#### Riktlinje

- Använd **imports** för generella helpers, utilities och rena funktioner.
- Använd **`deps`** för:
  - store/state
  - router
  - loggers/spårning
  - andra “tunga” objekt som gör komponenten lättare att testa om de injiceras.

---

## 3. Livscykel: `init`, `render`, `destroy`

### `init({ root, deps })`

- Körs **exakt en gång** när komponenten monteras.
- Ansvar:
  - Spara referenser (`this.root`, `this.deps`)
  - Initiera internt state (om nödvändigt)
  - Sätta upp event listeners
  - Göra initial `render(state)` om det är lämpligt

### `render(state)`

- Kan köras **flera gånger** under komponentens livstid.
- Ska *inte* sätta upp nya event listeners varje gång (för att undvika dubbletter) – det bör normalt ske i `init`.
- Ansvar:
  - Uppdatera DOM-struktur och innehåll baserat på `state`
  - Visa/dölja element, uppdatera klasser, texter, aria-attribut etc.

### `destroy()`

- Körs när komponenten inte längre behövs.
- Ansvar:
  - Ta bort alla event listeners (både på `root` och `document/window` om sådana används)
  - Nollställa referenser (`this.root`, `this.deps`, interna arrayer osv.)

---

## 4. CSS-konvention för komponenter

Varje komponent har en egen CSS-fil med samma namn som komponenten, t.ex.:

- JS: `MyComponent.js`
- CSS: `MyComponent.css`

I JS-filen importeras CSS-filen överst:

```js
import "./MyComponent.css";
```

### Root-klass per komponent

Varje komponent ska ha en **unik root-klass** som motsvarar komponentnamnet:

```html
<div class="MyComponent">
  ...
</div>
```

Inuti komponenten används BEM-liknande namngivning:

```css
.MyComponent { /* root-stilar */ }

.MyComponent__header { /* element */ }

.MyComponent__item { /* element */ }

.MyComponent__item--selected { /* modifier */ }
```

Globala, generiska klassnamn som `.btn`, `.container`, `.title` ska undvikas i komponent-CSS.  
Om generella utilities behövs ska de ligga i en dedikerad global CSS-fil (t.ex. `utilities.css`).

---

## 5. Förhållande till säkerhet och tillgänglighet

Komponentstandarden ska **inte** kringgå befintliga säkerhets- och tillgänglighetsprinciper.

Det innebär bland annat:

- Ingen ny direkt `innerHTML` med osäker/variabel data.
- Om `innerHTML` används, ska det ske via en central, godkänd helper som:
  - Escapar/saniterar innehåll korrekt
  - Följer projektets CSP och säkerhetsregler.

- Tangentbordsnavigering, fokus-hantering och aria-attribut ska fortsätta hanteras enligt projektets riktlinjer.

---

## 6. Vad ska fasas ut?

När befintlig kod refaktoreras ska följande mönster ses som **teknisk skuld** som ska bort där det är praktiskt möjligt:

- IIFE-baserade komponenter:
  ```js
  export const MyComponent = (function () { ... })();
  ```

- Komponenter eller helpers som läggs direkt på `window`:
  ```js
  window.MyComponent = { ... };
  ```

- Speciallösningar för beroendehantering (`dependency_manager` m.fl.) där vanliga ES-moduler räcker.

Målet är att alla komponenter till slut följer mallen i detta dokument.

---

## 7. Sammanfattning (checklista för komponenter)

När du skapar eller uppdaterar en komponent, kontrollera följande:

- [ ] Filen exporterar ett objekt: `export const MyComponent = { init, render, destroy }`.
- [ ] Ingen IIFE runt komponenten.
- [ ] Komponenten läggs inte på `window`.
- [ ] CSS importeras överst i filen: `import "./MyComponent.css";`.
- [ ] Komponenten har en unik root-klass (`.MyComponent`) och använder BEM-liknande struktur.
- [ ] Beroenden importeras via `import` eller skickas in via `deps`.
- [ ] Event listeners sätts upp i `init` och tas bort i `destroy`.
- [ ] Inga nya direkta `innerHTML`-anrop med osäker data – endast via godkända helpers.
