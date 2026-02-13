# Autospar – integration för nya vyer

## Översikt

Granskningsverktyget använder en central autospar-service (`AutosaveService` i `js/logic/autosave_service.js`) för formulär. Autospar triggas endast vid `input`-events, debouncar 250 ms, sparar utan visuell omrendering och bevarar fokus, markering och scroll-position.

## Anslut en ny vy

### 1. Lägg till AutosaveService i deps

Säkerställ att `AutosaveService` finns i deps som skickas till komponenten (finns redan i `main.js` för vykomponenter).

### 2. Skapa en autospar-session i render

```javascript
this.autosave_session?.destroy();
this.autosave_session = this.AutosaveService?.create_session({
    form_element: form,           // Formuläret eller containern
    focus_root: form,             // Var fokus ska återställas (ofta samma som form)
    debounce_ms: 250,
    on_save: ({ is_autosave, should_trim, skip_render, trim_text }) => {
        // Hämta värden från formuläret
        // Vid autospar: should_trim=false, skip_render=true
        // Vid manuell sparning: should_trim=true, skip_render=true (undviker att textarea krymper pga trimning)
        this.dispatch({ type: '...', payload: { ..., skip_render } });
    }
});
```

### 3. Koppla input-events

```javascript
input.addEventListener('input', this.handle_autosave_input);
// För change (t.ex. checkbox): 
checkbox.addEventListener('change', this.handle_autosave_input);
```

### 4. Implementera handle_autosave_input

```javascript
handle_autosave_input() {
    this.autosave_session?.request_autosave();
}
```

### 5. Manuell sparning

Vid Spara-knapp eller submit:

```javascript
this.autosave_session?.flush({ should_trim: true, skip_render: true });
```

### 6. "Tillbaka utan att spara"

Vid tillbaka/avbryt:

```javascript
this.skip_autosave_on_destroy = true;
this.autosave_session?.cancel_pending();
```

### 7. destroy()

```javascript
destroy() {
    if (!this.skip_autosave_on_destroy && this.form_element_ref && this.working_metadata) {
        this.autosave_session?.flush({ should_trim: true, skip_render: true });
    }
    this.autosave_session?.destroy();
    this.autosave_session = null;
    // ... resten av destroy
}
```

## Trimning

- **Autospar:** Ingen trimning.
- **Manuell sparning / lämna vy:** Använd `trim_text` från AutosaveService för text – trimmar mellanslag före/efter varje rad, tar bort tomrader först och sist, bevarar tomrader mitt i texten.

```javascript
// Exempel i on_save
const trim_text = opts.trim_text;
const value = trim_text ? trim_text(rawValue) : rawValue;
```

## Komponenter som redan använder autospar

- `EditGeneralSectionComponent` – regelfilsmetadata (allmän sektion)
- `EditPageTypesSectionComponent` – sidtyper
- `AddSampleFormComponent` – stickprovsformulär (vid redigering)
- `EditRulefileRequirementComponent` – kravredigering
