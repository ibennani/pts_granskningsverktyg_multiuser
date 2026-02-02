# Förslag: Ny vy för regelfilredigering med vänstermeny

## Översikt

En ny komponent `RulefileSectionsViewComponent` som visar olika delar av regelfilen med en vänstermeny för navigation. Varje sektion visas separat med en redigera-knapp.

**Viktigt:** Denna vy är endast tillgänglig när man redigerar regelfilen (`auditStatus === 'rulefile_editing'`). Den påverkar inte granskningsdelen av applikationen.

### Kontext: Regelfilredigering vs Granskning

- **Regelfilredigering:** När `auditStatus === 'rulefile_editing'` - användaren redigerar själva regelfilen (metadata, krav, etc.)
- **Granskning:** När `auditStatus === 'in_progress'` eller `'locked'` - användaren genomför en granskning baserad på regelfilen

Denna nya vy är endast en del av regelfilredigeringsflödet och påverkar inte granskningsflödet alls.

## Struktur

### Route
- **Route:** `rulefile_sections`
- **Parametrar:** `section` (t.ex. `general`, `publisher_source`, `classifications`, `report_template`, `info_blocks_order`)

### Komponent: `RulefileSectionsViewComponent`

```
┌─────────────────────────────────────────────────────────┐
│  [← Tillbaka]                                           │
├──────────┬──────────────────────────────────────────────┤
│          │  [Redigera Allmän information]              │
│          │  Allmän information                          │
│          │  ────────────────────────────                │
│          │                                              │
│ Vänster- │  Innehåll för sektionen...                   │
│ meny     │                                              │
│          │                                              │
│ • Allmän │                                              │
│ • Utgivare│                                             │
│ • Klassif.│                                             │
│ • Rapport│                                              │
│ • Info-  │                                              │
│   blocks │                                              │
└──────────┴──────────────────────────────────────────────┘
```

## Sektioner

### 1. Allmän information (`general`)
- Titel, beskrivning, version
- Språk, licens
- Datum (skapad, modifierad)
- Monitoring type
- **Redigera-knapp:** → `rulefile_metadata_edit` (med scroll till general-section)

### 2. Utgivare & källa (`publisher_source`)
- Publisher (namn, kontakt)
- Source (URL, titel, datum, format)
- **Redigera-knapp:** → `rulefile_metadata_edit` (med scroll till publisher-section)

### 3. Klassificeringar (`classifications`)
- Keywords
- Page Types
- Content Types
- Sample Categories & Types
- Taxonomies
- **Redigera-knapp:** → `rulefile_metadata_edit` (med scroll till classifications-section)

### 4. Rapportmall (`report_template`)
- Report Template Sections
- **Redigera-knapp:** → `rulefile_metadata_edit` (med scroll till report-template-section)

### 5. Info-blocks ordning (`info_blocks_order`)
- Lista över info-blocks i nuvarande ordning
- Drag-and-drop eller upp/ner-knappar för att ändra ordning
- **Redigera-knapp:** → Samma vy men i redigeringsläge

## Implementation

### Fil: `js/components/RulefileSectionsViewComponent.js`

```javascript
export const RulefileSectionsViewComponent = {
    CSS_PATH: 'css/components/rulefile_sections_view.css',

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
        
        if (this.Helpers?.load_css) {
            await this.Helpers.load_css(this.CSS_PATH).catch(err => console.warn('[RulefileSectionsViewComponent] Failed to load CSS', err));
        }
    },

    _get_section_config(section_id) {
        const t = this.Translation.t;
        const sections = {
            general: {
                id: 'general',
                title: t('rulefile_section_general_title') || 'Allmän information',
                editRoute: 'rulefile_metadata_edit',
                editSection: 'general'
            },
            publisher_source: {
                id: 'publisher_source',
                title: t('rulefile_section_publisher_source_title') || 'Utgivare & källa',
                editRoute: 'rulefile_metadata_edit',
                editSection: 'publisher_source'
            },
            classifications: {
                id: 'classifications',
                title: t('rulefile_section_classifications_title') || 'Klassificeringar',
                editRoute: 'rulefile_metadata_edit',
                editSection: 'classifications'
            },
            report_template: {
                id: 'report_template',
                title: t('rulefile_section_report_template_title') || 'Rapportmall',
                editRoute: 'rulefile_metadata_edit',
                editSection: 'report_template'
            },
            info_blocks_order: {
                id: 'info_blocks_order',
                title: t('rulefile_section_info_blocks_order_title') || 'Info-blocks ordning',
                editRoute: 'rulefile_sections',
                editSection: 'info_blocks_order',
                isEditable: true // Denna kan redigeras direkt i vyn
            }
        };
        return sections[section_id] || sections.general;
    },

    _create_left_menu(current_section_id) {
        const t = this.Translation.t;
        const menu = this.Helpers.create_element('nav', { 
            class_name: 'rulefile-sections-menu',
            attributes: { 'aria-label': t('rulefile_sections_menu_label') || 'Regelfilsektioner' }
        });

        const sections = [
            { id: 'general', label: t('rulefile_section_general_title') || 'Allmän information', icon: 'info' },
            { id: 'publisher_source', label: t('rulefile_section_publisher_source_title') || 'Utgivare & källa', icon: 'person' },
            { id: 'classifications', label: t('rulefile_section_classifications_title') || 'Klassificeringar', icon: 'label' },
            { id: 'report_template', label: t('rulefile_section_report_template_title') || 'Rapportmall', icon: 'description' },
            { id: 'info_blocks_order', label: t('rulefile_section_info_blocks_order_title') || 'Info-blocks ordning', icon: 'view_list' }
        ];

        const menu_list = this.Helpers.create_element('ul', { class_name: 'rulefile-sections-menu-list' });
        
        sections.forEach(section => {
            const menu_item = this.Helpers.create_element('li', { class_name: 'rulefile-sections-menu-item' });
            const menu_link = this.Helpers.create_element('a', {
                class_name: current_section_id === section.id ? 'active' : '',
                attributes: {
                    href: `#rulefile_sections?section=${section.id}`,
                    'aria-current': current_section_id === section.id ? 'page' : null
                },
                html_content: (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg(section.icon, [], 20) : '') + 
                              `<span>${section.label}</span>`
            });
            menu_link.addEventListener('click', (e) => {
                e.preventDefault();
                this.router('rulefile_sections', { section: section.id });
            });
            menu_item.appendChild(menu_link);
            menu_list.appendChild(menu_item);
        });

        menu.appendChild(menu_list);
        return menu;
    },

    _create_header(section_config) {
        const t = this.Translation.t;
        const header_wrapper = this.Helpers.create_element('div', { class_name: 'rulefile-sections-header' });
        
        const heading = this.Helpers.create_element('h1', { text_content: section_config.title });
        
        const edit_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'rulefile-sections-edit-button'],
            attributes: {
                type: 'button',
                'aria-label': t('rulefile_sections_edit_button_aria', { sectionName: section_config.title }) || 
                             `Redigera ${section_config.title}`
            },
            html_content: `<span>${t('edit') || 'Redigera'}</span>` + 
                          (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('edit') : '')
        });
        
        edit_button.addEventListener('click', () => {
            if (section_config.isEditable) {
                // För info_blocks_order, växla till redigeringsläge i samma vy
                this.router('rulefile_sections', { section: section_config.id, edit: 'true' });
            } else {
                // För andra sektioner, gå till metadata-edit med section-parameter
                this.router(section_config.editRoute, { section: section_config.editSection });
            }
        });

        header_wrapper.appendChild(heading);
        header_wrapper.appendChild(edit_button);
        
        return header_wrapper;
    },

    _render_general_section(metadata) {
        const t = this.Translation.t;
        const section = this.Helpers.create_element('section', { class_name: 'rulefile-section-content' });
        
        // Använd RulefileMetadataViewComponent's metoder för att visa data
        // Eller skapa egna visningskomponenter
        
        return section;
    },

    _render_info_blocks_order_section(metadata, isEditing = false) {
        const t = this.Translation.t;
        const section = this.Helpers.create_element('section', { class_name: 'rulefile-section-content' });
        
        const block_order = metadata?.blockOrders?.infoBlocks || [
            'expectedObservation',
            'instructions',
            'exceptions',
            'commonErrors',
            'tips',
            'examples'
        ];

        if (isEditing) {
            // Redigeringsläge: drag-and-drop eller upp/ner-knappar
            const editor = this.Helpers.create_element('div', { class_name: 'info-blocks-order-editor' });
            // ... implementera redigering
            section.appendChild(editor);
        } else {
            // Visningsläge: visa ordningen
            const list = this.Helpers.create_element('ol', { class_name: 'info-blocks-order-list' });
            block_order.forEach((blockId, index) => {
                const item = this.Helpers.create_element('li', {
                    text_content: this._get_block_display_name(blockId)
                });
                list.appendChild(item);
            });
            section.appendChild(list);
        }

        return section;
    },

    _get_block_display_name(block_id) {
        const t = this.Translation.t;
        const name_map = {
            'expectedObservation': t('requirement_expected_observation') || 'Förväntad observation',
            'instructions': t('requirement_instructions') || 'Instruktioner',
            'exceptions': t('requirement_exceptions') || 'Undantag',
            'commonErrors': t('requirement_common_errors') || 'Vanliga fel',
            'tips': t('requirement_tips') || 'Tips',
            'examples': t('requirement_examples') || 'Exempel'
        };
        return name_map[block_id] || block_id;
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        const state = this.getState();
        const params = this.deps.params || {};
        const section_id = params.section || 'general';
        const is_editing = params.edit === 'true';

        // Viktigt: Kontrollera att vi är i regelfilredigeringsläge
        // Denna vy ska endast vara tillgänglig när man redigerar regelfilen,
        // inte när man gör en granskning
        if (state?.auditStatus !== 'rulefile_editing') {
            // Om vi inte är i redigeringsläge, omdirigera till huvudmenyn
            this.router('edit_rulefile_main');
            return;
        }

        if (!state?.ruleFileContent?.metadata) {
            this.router('edit_rulefile_main');
            return;
        }

        this.root.innerHTML = '';
        
        const container = this.Helpers.create_element('div', { class_name: 'rulefile-sections-container' });
        
        // Global message
        const global_message = this.NotificationComponent.get_global_message_element_reference();
        if (global_message) {
            container.appendChild(global_message);
        }

        // Back button
        const back_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('back_to_edit_options') || 'Tillbaka'}</span>` + 
                          (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('arrow_back') : '')
        });
        back_button.addEventListener('click', () => this.router('edit_rulefile_main'));
        container.appendChild(back_button);

        // Main layout
        const layout = this.Helpers.create_element('div', { class_name: 'rulefile-sections-layout' });
        
        // Left menu
        const left_menu = this._create_left_menu(section_id);
        layout.appendChild(left_menu);

        // Content area
        const content_area = this.Helpers.create_element('div', { class_name: 'rulefile-sections-content-area' });
        const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });

        const section_config = this._get_section_config(section_id);
        const header = this._create_header(section_config);
        plate.appendChild(header);

        // Render section content
        const metadata = state.ruleFileContent.metadata;
        let section_content;
        
        switch (section_id) {
            case 'general':
                section_content = this._render_general_section(metadata);
                break;
            case 'publisher_source':
                section_content = this._render_publisher_source_section(metadata);
                break;
            case 'classifications':
                section_content = this._render_classifications_section(metadata);
                break;
            case 'report_template':
                section_content = this._render_report_template_section(state.ruleFileContent);
                break;
            case 'info_blocks_order':
                section_content = this._render_info_blocks_order_section(metadata, is_editing);
                break;
            default:
                section_content = this._render_general_section(metadata);
        }

        plate.appendChild(section_content);
        content_area.appendChild(plate);
        layout.appendChild(content_area);

        container.appendChild(layout);
        this.root.appendChild(container);
    },

    destroy() {
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
    }
};
```

### CSS: `css/components/rulefile_sections_view.css`

```css
.rulefile-sections-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem;
}

.rulefile-sections-layout {
    display: flex;
    gap: 2rem;
    margin-top: 2rem;
}

.rulefile-sections-menu {
    flex: 0 0 250px;
    background: var(--color-surface);
    border-radius: var(--border-radius);
    padding: 1rem;
    height: fit-content;
    position: sticky;
    top: 1rem;
}

.rulefile-sections-menu-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.rulefile-sections-menu-item {
    margin-bottom: 0.5rem;
}

.rulefile-sections-menu-item a {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    text-decoration: none;
    color: var(--color-text);
    border-radius: var(--border-radius);
    transition: background-color 0.2s;
}

.rulefile-sections-menu-item a:hover {
    background-color: var(--color-surface-hover);
}

.rulefile-sections-menu-item a.active {
    background-color: var(--color-primary);
    color: var(--color-on-primary);
    font-weight: 500;
}

.rulefile-sections-content-area {
    flex: 1;
    min-width: 0;
}

.rulefile-sections-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    gap: 1rem;
}

.rulefile-sections-header h1 {
    margin: 0;
    flex: 1;
}

.rulefile-sections-edit-button {
    flex-shrink: 0;
}

.rulefile-section-content {
    /* Styling för sektionsinnehåll */
}

.info-blocks-order-list {
    list-style: decimal;
    padding-left: 2rem;
}

.info-blocks-order-list li {
    padding: 0.5rem 0;
}
```

### Route-registrering i `main.js`

```javascript
// I switch-satsen för view_name_to_render:
case 'rulefile_sections': ComponentClass = RulefileSectionsViewComponent; break;

// I updatePageTitle:
case 'rulefile_sections':
    title_prefix = t('rulefile_sections_title');
    break;
```

### Översättningar (lägg till i `sv-SE.json` och `en-GB.json`)

```json
{
  "rulefile_sections_title": "Regelfilsektioner",
  "rulefile_sections_menu_label": "Regelfilsektioner",
  "rulefile_section_general_title": "Allmän information",
  "rulefile_section_publisher_source_title": "Utgivare & källa",
  "rulefile_section_classifications_title": "Klassificeringar",
  "rulefile_section_report_template_title": "Rapportmall",
  "rulefile_section_info_blocks_order_title": "Info-blocks ordning",
  "rulefile_sections_edit_button_aria": "Redigera {sectionName}",
  "edit": "Redigera"
}
```

## Integration med befintlig kod

### Uppdatera `EditRulefileMainViewComponent`

Ersätt eller komplettera de befintliga knapparna med en knapp som länkar till den nya vyn:

```javascript
// Ersätt eller lägg till efter befintliga knappar:
const view_sections_button = this.Helpers.create_element('button', {
    class_name: ['button', 'button-primary'],
    attributes: { type: 'button' },
    html_content: `<span>${t('view_rulefile_sections_button') || 'Visa regelfilsektioner'}</span>` + this.Helpers.get_icon_svg('view_list')
});
view_sections_button.addEventListener('click', () => this.router('rulefile_sections', { section: 'general' }));

button_group.append(edit_reqs_button, view_sections_button, edit_meta_button);
```

**Alternativt:** Ersätt `edit_meta_button` med `view_sections_button` om den nya vyn ska vara huvudvägen för att se/redigera metadata.

## Fördelar

1. **Tydlig navigation** - Vänstermeny gör det enkelt att hitta rätt sektion
2. **Fokuserad vy** - En sektion i taget gör det mindre överväldigande
3. **Konsekvent UX** - Redigera-knapp på samma plats för alla sektioner
4. **Tillgänglighet** - aria-label på redigera-knappen
5. **Flexibel** - Enkelt att lägga till nya sektioner
6. **Isolerad** - Påverkar endast regelfilredigering, inte granskningsflödet

## Begränsningar

- Endast tillgänglig när `auditStatus === 'rulefile_editing'`
- Om användaren försöker komma åt vyn när de inte är i redigeringsläge, omdirigeras de till `edit_rulefile_main`
- Granskningsflödet (`auditStatus !== 'rulefile_editing'`) påverkas inte alls

## Nästa steg

1. Implementera `RulefileSectionsViewComponent`
2. Skapa CSS-fil
3. Lägg till översättningar
4. Registrera route i `main.js` (endast tillgänglig när `auditStatus === 'rulefile_editing'`)
5. Uppdatera `EditRulefileMainViewComponent` med länk till ny vy
6. Implementera redigering av `info_blocks_order` direkt i vyn
7. Testa att vyn inte är tillgänglig när man inte är i regelfilredigeringsläge

## Säkerhet och validering

- Komponenten kontrollerar alltid att `auditStatus === 'rulefile_editing'` innan rendering
- Om användaren försöker komma åt vyn när de inte är i redigeringsläge, omdirigeras de automatiskt
- Granskningsflödet (`auditStatus !== 'rulefile_editing'`) påverkas inte alls av denna ändring
