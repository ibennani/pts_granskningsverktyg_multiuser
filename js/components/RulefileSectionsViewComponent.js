// js/components/RulefileSectionsViewComponent.js

import { get_section_config } from './rulefile_sections/rulefile_sections_config.js';
import { create_rulefile_section_header } from './rulefile_sections/rulefile_sections_header.js';
import {
    format_simple_value,
    create_definition_list,
    format_date_display,
    create_source_link,
    create_list
} from './rulefile_sections/rulefile_sections_display_helpers.js';
import {
    render_rulefile_general_section,
    render_rulefile_publisher_source_section,
    render_rulefile_classifications_section,
    render_rulefile_coming_soon_section
} from './rulefile_sections/rulefile_sections_basic_views.js';
import {
    flush_info_blocks_order_from_dom,
    render_rulefile_page_types_section,
    render_rulefile_content_types_section,
    render_rulefile_report_template_section,
    render_rulefile_info_blocks_order_section
} from './rulefile_sections/rulefile_sections_type_views.js';
import {
    render_rulefile_general_edit_form,
    render_rulefile_page_types_edit_form,
    render_rulefile_content_types_edit_form,
    render_rulefile_info_blocks_edit_form
} from './rulefile_sections/rulefile_sections_edit_forms.js';
import './rulefile_sections_view.css';

let _last_section_id = null;
let _last_is_editing = null;

export class RulefileSectionsViewComponent {
    constructor() {
        this.CSS_PATH = './rulefile_sections_view.css';
        this.root = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this.AutosaveService = null;
        this.is_initial_render = true;
        this.general_form_initial_focus_set = false;
        this.page_types_form_initial_focus_set = false;
        this.content_types_form_initial_focus_set = false;
    }

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
        this.AutosaveService = deps.AutosaveService;
        this.is_initial_render = true; // Flagga för att veta om detta är första render
        this.general_form_initial_focus_set = false; // Flagga för att veta om fokus redan har satts på general-formuläret
        this.page_types_form_initial_focus_set = false; // Flagga för att veta om fokus redan har satts på page_types-formuläret
        this.content_types_form_initial_focus_set = false; // Flagga för att veta om fokus redan har satts på content_types-formuläret
        
        if (this.Helpers?.load_css) {
            await this.Helpers.load_css(this.CSS_PATH).catch(err => console.warn('[RulefileSectionsViewComponent] Failed to load CSS', err));
        }
    }

    _get_section_config(section_id) {
        return get_section_config(section_id, this.Translation.t);
    }

    _create_header(section_config, is_editing = false) {
        return create_rulefile_section_header({
            Helpers: this.Helpers,
            Translation: this.Translation,
            router: this.router,
            getState: this.getState,
            get_page_types_edit_component: () => this.page_types_edit_component
        }, section_config, is_editing);
    }

    _format_simple_value(value) {
        return format_simple_value(value);
    }

    _create_definition_list(entries) {
        return create_definition_list(this.Helpers, entries);
    }

    _format_date_display(iso_string) {
        return format_date_display(iso_string);
    }

    _create_source_link(source_url) {
        return create_source_link(this.Helpers, this.Translation, source_url);
    }

    _create_list(items, empty_key, class_name = 'metadata-list') {
        return create_list(this.Helpers, this.Translation.t, items, empty_key, class_name);
    }

    _render_general_section(metadata) {
        return render_rulefile_general_section(
            { Helpers: this.Helpers, Translation: this.Translation },
            metadata
        );
    }

    _render_publisher_source_section(metadata) {
        return render_rulefile_publisher_source_section(
            { Helpers: this.Helpers, Translation: this.Translation },
            metadata
        );
    }

    _render_classifications_section(metadata) {
        return render_rulefile_classifications_section(
            { Helpers: this.Helpers, Translation: this.Translation },
            metadata
        );
    }

    _render_page_types_section(metadata) {
        return render_rulefile_page_types_section(
            { Helpers: this.Helpers, Translation: this.Translation, getState: this.getState },
            metadata
        );
    }

    _render_content_types_section(metadata) {
        return render_rulefile_content_types_section(
            { Helpers: this.Helpers, Translation: this.Translation },
            metadata
        );
    }

    _render_report_template_section(ruleFileContent) {
        return render_rulefile_report_template_section(
            { Helpers: this.Helpers, Translation: this.Translation },
            ruleFileContent
        );
    }

    _render_coming_soon_section() {
        return render_rulefile_coming_soon_section({ Helpers: this.Helpers, Translation: this.Translation });
    }

    _flush_info_blocks_order_from_dom() {
        flush_info_blocks_order_from_dom({ info_blocks_edit_component: this.info_blocks_edit_component });
    }

    _render_info_blocks_order_section(metadata) {
        return render_rulefile_info_blocks_order_section(
            { Helpers: this.Helpers, Translation: this.Translation, getState: this.getState },
            metadata
        );
    }

    async _render_general_edit_form(container, _metadata) {
        return render_rulefile_general_edit_form(
            { deps: this.deps, view: this },
            container,
            _metadata
        );
    }

    async _render_page_types_edit_form(container, _metadata) {
        return render_rulefile_page_types_edit_form(
            { deps: this.deps, view: this },
            container,
            _metadata
        );
    }

    async _render_content_types_edit_form(container, _metadata) {
        return render_rulefile_content_types_edit_form(
            { deps: this.deps, view: this },
            container,
            _metadata
        );
    }

    async _render_info_blocks_edit_form(container, _metadata) {
        return render_rulefile_info_blocks_edit_form(
            { deps: this.deps, view: this },
            container,
            _metadata
        );
    }

    async render() {
        if (!this.root) return;
        const state = this.getState();
        const params = this.deps.params || {};
        const section_id = params.section || 'general';
        const is_editing = params.edit === 'true';

        // Redirect: gamla Stickprov-länken pekar nu på Sidtyper
        if (section_id === 'sample_types') {
            this.router('rulefile_sections', { section: 'page_types', edit: params.edit || undefined });
            return;
        }

        // Spara informationsblock från DOM innan vi rensar (vid navigering via sidomenyn)
        if (section_id !== 'info_blocks_order') {
            this._flush_info_blocks_order_from_dom();
        }

        // Viktigt: Kontrollera att vi är i regelfilredigeringsläge
        if (state?.auditStatus !== 'rulefile_editing') {
            this.router('edit_rulefile_main');
            return;
        }

        if (!state?.ruleFileContent?.metadata) {
            this.router('edit_rulefile_main');
            return;
        }

        const prev_section = _last_section_id;
        const prev_editing = _last_is_editing;
        _last_section_id = section_id;
        _last_is_editing = is_editing;

        const editable_sections = ['general', 'page_types', 'content_types', 'info_blocks_order'];
        const is_switching_view_edit = editable_sections.includes(section_id) &&
            prev_section === section_id &&
            prev_editing !== is_editing &&
            this.root.firstElementChild;

        if (is_switching_view_edit) {
            const old_plate = this.root.firstElementChild;
            old_plate.style.transition = 'opacity 0.25s ease';
            old_plate.style.opacity = '0';
            setTimeout(async () => {
                this.root.innerHTML = '';
                const main_plate = await this._build_main_plate(state, section_id, is_editing);
                main_plate.style.opacity = '0';
                main_plate.style.transition = 'opacity 0.25s ease';
                this.root.appendChild(main_plate);
                window.scrollTo(0, 0);
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        main_plate.style.opacity = '1';
                        setTimeout(() => {
                            main_plate.style.transition = '';
                            main_plate.style.opacity = '';
                            this._apply_focus_after_load();
                            this.is_initial_render = false;
                        }, 250);
                    });
                });
            }, 250);
            return;
        }

        this.root.innerHTML = '';
        const main_plate = await this._build_main_plate(state, section_id, is_editing);
        this.root.appendChild(main_plate);
        this._apply_focus_after_load();
        this.is_initial_render = false;
    }

    async _build_main_plate(state, section_id, is_editing) {
        const metadata = state?.ruleFileContent?.metadata || {};
        const main_plate = this.Helpers.create_element('div', { class_name: 'content-plate rulefile-sections-main-plate' });
        this.NotificationComponent.append_global_message_areas_to(main_plate);
        const layout = this.Helpers.create_element('div', { class_name: 'rulefile-sections-layout' });
        const right_wrapper = this.Helpers.create_element('div', { class_name: 'rulefile-sections-right-wrapper' });
        let section_content;
        let header_section_config;
        const section_heading_id = `rulefile-section-${section_id}-heading`;
        if (is_editing && (section_id === 'general' || section_id === 'page_types' || section_id === 'content_types' || section_id === 'info_blocks_order')) {
            header_section_config = this._get_section_config(section_id);
            right_wrapper.appendChild(this._create_header(header_section_config, is_editing));
            const edit_form_container = this.Helpers.create_element('div', { class_name: 'rulefile-section-edit-form-container' });
            if (section_id === 'general') await this._render_general_edit_form(edit_form_container, metadata);
            else if (section_id === 'page_types') await this._render_page_types_edit_form(edit_form_container, metadata);
            else if (section_id === 'content_types') await this._render_content_types_edit_form(edit_form_container, metadata);
            else if (section_id === 'info_blocks_order') await this._render_info_blocks_edit_form(edit_form_container, metadata);
            const edit_section = this.Helpers.create_element('section', {
                class_name: 'rulefile-section-content',
                attributes: { 'aria-labelledby': section_heading_id }
            });
            edit_section.appendChild(edit_form_container);
            right_wrapper.appendChild(edit_section);
        } else {
            switch (section_id) {
                case 'general':
                case 'publisher_source':
                    header_section_config = this._get_section_config('general');
                    section_content = this._render_general_section(metadata);
                    break;
                case 'classifications':
                    header_section_config = this._get_section_config(section_id);
                    section_content = this._render_coming_soon_section();
                    break;
                case 'page_types':
                    header_section_config = this._get_section_config(section_id);
                    section_content = this._render_page_types_section(metadata);
                    break;
                case 'content_types':
                    header_section_config = this._get_section_config(section_id);
                    section_content = this._render_content_types_section(metadata);
                    break;
                case 'report_template':
                    header_section_config = this._get_section_config(section_id);
                    section_content = this._render_coming_soon_section();
                    break;
                case 'info_blocks_order':
                    header_section_config = this._get_section_config(section_id);
                    section_content = this._render_info_blocks_order_section(metadata);
                    break;
                default:
                    header_section_config = this._get_section_config('general');
                    section_content = this._render_general_section(metadata);
            }
            right_wrapper.appendChild(this._create_header(header_section_config, is_editing));
            if (section_content && header_section_config) {
                section_content.setAttribute('aria-labelledby', `rulefile-section-${header_section_config.id}-heading`);
            }
            right_wrapper.appendChild(section_content);
        }
        layout.appendChild(right_wrapper);
        main_plate.appendChild(layout);
        return main_plate;
    }

    _apply_focus_after_load() {
        const focusSelector = sessionStorage.getItem('focusAfterLoad');
        if (focusSelector) {
            sessionStorage.removeItem('focusAfterLoad');
            setTimeout(() => {
                const elementToFocus = this.root?.querySelector(focusSelector);
                if (elementToFocus) {
                    elementToFocus.setAttribute('tabindex', '-1');
                    elementToFocus.focus();
                }
            }, 100);
        }
    }

    destroy() {
        // Cleanup redigeringskomponenter om de finns
        if (this.general_edit_component && typeof this.general_edit_component.destroy === 'function') {
            this.general_edit_component.destroy();
            this.general_edit_component = null;
        }
        if (this.page_types_edit_component && typeof this.page_types_edit_component.destroy === 'function') {
            this.page_types_edit_component.destroy();
            this.page_types_edit_component = null;
        }
        
        // Återställ fokus-flaggorna så att fokus sätts när användaren navigerar tillbaka
        if (this.content_types_edit_component && typeof this.content_types_edit_component.destroy === 'function') {
            this.content_types_edit_component.destroy();
            this.content_types_edit_component = null;
        }
        if (this.info_blocks_edit_component && typeof this.info_blocks_edit_component.destroy === 'function') {
            this.info_blocks_edit_component.destroy();
            this.info_blocks_edit_component = null;
        }
        
        this.general_form_initial_focus_set = false;
        this.page_types_form_initial_focus_set = false;
        this.content_types_form_initial_focus_set = false;
        
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
    }
}
