import '../../css/components/side_menu_component.css';
import { consoleManager } from '../utils/console_manager.js';
import { build_compact_hash_fragment, expand_view_slug_from_hash, normalize_params_from_hash_query } from '../logic/router_url_codec.js';
import { is_debug_modal_scroll, is_debug_nav, is_debug_problems_update } from '../app/runtime_flags.js';

export class SideMenuComponent {
    static CSS_PATH = '../../css/components/side_menu_component.css';

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;

        this.router = deps.router;
        this.getState = deps.getState;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.AuditLogic = deps.AuditLogic;
        this.clear_auth_token = deps.clear_auth_token;

        this.current_view_name = 'start';
        this.current_view_params = {};
        this.is_menu_open = false;

        this.menu_button_ref = null;
        this.nav_ref = null;
        this.first_link_ref = null;
        this.last_menu_counts = null;
        this.last_menu_structure_key = null;
        this.external_menu_button_id = 'app-mobile-menu-toggle';

        this.handle_toggle_menu = this.handle_toggle_menu.bind(this);
        this.handle_close_menu = this.handle_close_menu.bind(this);
        this.handle_compact_escape_keydown = this.handle_compact_escape_keydown.bind(this);
        this.handle_layout_compact_changed = this.handle_layout_compact_changed.bind(this);
        this.handle_external_toggle_event = this.handle_external_toggle_event.bind(this);
        this.handle_close_side_menu_event = this.handle_close_side_menu_event.bind(this);
        this._compact_escape_listener_registered = false;

        if (this.Helpers?.load_css && SideMenuComponent.CSS_PATH) {
            await this.Helpers.load_css(SideMenuComponent.CSS_PATH).catch(() => {});
        }

        this.unsubscribe = null;
        if (typeof deps.subscribe === 'function') {
            this.unsubscribe = deps.subscribe((_new_state, listener_meta) => {
                if (listener_meta?.skip_render) return;
                if (!this.root || typeof this.render !== 'function') return;

                const menu_model = this.get_menu_model();
                if (is_debug_problems_update()) {
                    const problems_item = (menu_model?.items || []).find((i) => i.count_id === 'problems_count');
                    consoleManager.log('[GV-Debug menu] listener: problems_count i model:', problems_item?.count_value, 'skip_render:', listener_meta?.skip_render);
                }
                if (!menu_model.should_show) {
                    if (is_debug_modal_scroll()) consoleManager.log('[GV-ModalDebug] SideMenu: full render (hidden)');
                    this.render();
                    return;
                }
                if (this.update_counts_only(menu_model)) {
                    if (is_debug_problems_update()) consoleManager.log('[GV-Debug menu] listener: update_counts_only lyckades');
                    if (is_debug_modal_scroll()) consoleManager.log('[GV-ModalDebug] SideMenu: update_counts_only');
                    return;
                }
                if (is_debug_problems_update()) consoleManager.log('[GV-Debug menu] listener: update_counts_only gjorde inget, kör full render');
                if (is_debug_modal_scroll()) consoleManager.log('[GV-ModalDebug] SideMenu: full render');
                this.render();
            });
        }

        document.addEventListener('gv:layout_compact_changed', this.handle_layout_compact_changed);
        document.addEventListener('gv:toggle_side_menu', this.handle_external_toggle_event);
        document.addEventListener('gv:close_side_menu', this.handle_close_side_menu_event);

        if (this.is_small_screen()) {
            this.add_compact_escape_listener();
        }
    }

    set_current_view(view_name, params = {}) {
        this.current_view_name = view_name || 'start';
        this.current_view_params = params || {};
    }

    is_small_screen() {
        if (typeof document === 'undefined') return false;
        return Boolean(document.getElementById('app-layout')?.classList.contains('app-layout--compact'));
    }

    /**
     * Uppdaterar bara kompakt menypanel (klass/inert) utan full render — krävs för att CSS-transition ska synas.
     * @returns {boolean} true om DOM uppdaterades
     */
    sync_compact_menu_panel_from_state() {
        if (!this.is_small_screen() || !this.root) return false;
        const panel = this.root.querySelector('.side-menu__compact-panel');
        const nav = this.nav_ref || this.root.querySelector('#side-menu-nav');
        if (!panel || !nav || !document.contains(nav)) return false;
        const inner = panel.querySelector('.side-menu__compact-panel-inner');
        const collapsed = !this.is_menu_open;
        panel.classList.toggle('side-menu__compact-panel--collapsed', collapsed);
        if (inner) {
            inner.inert = collapsed;
        }
        if (collapsed) {
            nav.setAttribute('aria-hidden', 'true');
        } else {
            nav.removeAttribute('aria-hidden');
        }
        nav.classList.toggle('is-open', this.is_menu_open);

        if (!this.menu_button_ref && typeof document !== 'undefined') {
            this.menu_button_ref = document.getElementById(this.external_menu_button_id);
        }
        if (this.menu_button_ref) {
            this.menu_button_ref.setAttribute('aria-expanded', this.is_menu_open ? 'true' : 'false');
        }

        return true;
    }

    handle_layout_compact_changed(event) {
        const compact = Boolean(event?.detail?.compact);
        if (!compact) {
            this.is_menu_open = false;
            this.remove_compact_escape_listener();
        } else {
            this.add_compact_escape_listener();
        }
        this.render();
    }

    handle_close_side_menu_event() {
        if (!this.is_small_screen()) return;
        if (this.is_menu_open) {
            this.handle_close_menu({ restore_focus: false });
        }
    }

    handle_toggle_menu() {
        if (this.is_menu_open) {
            this.handle_close_menu({ restore_focus: true });
            return;
        }

        this.is_menu_open = true;
        const synced = this.sync_compact_menu_panel_from_state();
        if (!synced) {
            this.render();
        }
    }

    handle_external_toggle_event() {
        if (!this.is_small_screen()) return;
        if (!this.is_menu_open) {
            const layout = document.getElementById('app-layout');
            layout?.classList.remove('app-layout--filter-open');
        }
        this.handle_toggle_menu();
    }

    handle_close_menu({ restore_focus = false } = {}) {
        if (!this.is_menu_open) return;
        this.is_menu_open = false;
        const synced = this.sync_compact_menu_panel_from_state();
        if (!synced) {
            this.render();
        }

        if (restore_focus) {
            requestAnimationFrame(() => {
                if (!this.menu_button_ref && typeof document !== 'undefined') {
                    this.menu_button_ref = document.getElementById(this.external_menu_button_id);
                }
                if (this.menu_button_ref && document.contains(this.menu_button_ref)) {
                    try {
                        this.menu_button_ref.focus({ preventScroll: true });
                    } catch (e) {
                        this.menu_button_ref.focus();
                    }
                }
            });
        }
    }

    add_compact_escape_listener() {
        if (this._compact_escape_listener_registered) return;
        this._compact_escape_listener_registered = true;
        document.addEventListener('keydown', this.handle_compact_escape_keydown);
    }

    remove_compact_escape_listener() {
        if (!this._compact_escape_listener_registered) return;
        this._compact_escape_listener_registered = false;
        document.removeEventListener('keydown', this.handle_compact_escape_keydown);
    }

    handle_compact_escape_keydown(event) {
        if (!this.is_small_screen()) return;
        if (event.key !== 'Escape') return;
        const layout = document.getElementById('app-layout');
        if (layout?.classList.contains('app-layout--filter-open')) {
            event.preventDefault();
            layout.classList.remove('app-layout--filter-open');
            return;
        }
        if (!this.is_menu_open) return;
        event.preventDefault();
        this.handle_close_menu({ restore_focus: true });
    }

    build_hash(view_name, params = {}) {
        return `#${build_compact_hash_fragment(view_name, params && typeof params === 'object' ? params : {})}`;
    }

    get_view_name_from_location_hash() {
        // Härleder aktiv vy från URL:en för att undvika att menyn "fastnar"
        // i fel aktivt val vid navigeringar som inte alltid uppdaterar intern state i exakt rätt ordning.
        try {
            const raw = window.location?.hash || '';
            const hash = raw.startsWith('#') ? raw.substring(1) : raw;
            const [view_name] = hash.split('?');
            if (!view_name) return null;
            return expand_view_slug_from_hash(view_name);
        } catch (e) {
            return null;
        }
    }

    get_params_from_location_hash() {
        try {
            const raw = window.location?.hash || '';
            const hash = raw.startsWith('#') ? raw.substring(1) : raw;
            const query_part = hash.split('?')[1];
            if (!query_part) return {};
            return normalize_params_from_hash_query(Object.fromEntries(new URLSearchParams(query_part)));
        } catch (e) {
            return {};
        }
    }

    create_menu_link({ label, view_name, params = {}, count_id, count_value }) {
        const view_from_hash = this.get_view_name_from_location_hash();
        let active_view_name = view_from_hash || this.current_view_name;
        if (active_view_name === 'backup_detail' || active_view_name === 'backup_rulefile_detail' || active_view_name === 'backup_settings') {
            active_view_name = 'backup';
        }
        const current_params = this.get_params_from_location_hash();
        let is_active = active_view_name === view_name;
        if (is_active && view_name === 'rulefile_sections' && params.section) {
            is_active = current_params.section === params.section;
        }

        const base_path = (window.location && window.location.pathname)
            ? window.location.pathname.split('?')[0].split('#')[0]
            : '/';
        const search_params = new URLSearchParams({ view: view_name, ...params });
        const href = `${base_path}?${search_params.toString()}`;

        const link = this.Helpers.create_element('a', {
            attributes: {
                href,
                'aria-label': label,
                ...(is_active ? { 'aria-current': 'page' } : {})
            },
            class_name: ['side-menu__link', ...(is_active ? ['active'] : [])]
        });

        if (count_id !== null && count_id !== undefined && count_value !== null && count_value !== undefined) {
            const count_str = String(count_value);
            const parts = label.split(count_str);
            if (parts.length === 2) {
                link.appendChild(document.createTextNode(parts[0]));
                const count_span = this.Helpers.create_element('span', {
                    class_name: 'side-menu__count',
                    attributes: { 'data-count-id': count_id },
                    text_content: count_str
                });
                link.appendChild(count_span);
                link.appendChild(document.createTextNode(parts[1]));
            } else {
                link.textContent = label;
            }
        } else {
            link.textContent = label;
        }

        link.addEventListener('click', (event) => {
            if (is_debug_nav()) {
                consoleManager.log('[GV-NAV] Sidomeny-länk klickad', { view_name, params, has_router: typeof this.router === 'function' });
            }
            if (typeof this.router === 'function') {
                event.preventDefault();
                this.router(view_name, params);
            }
            if (this.is_small_screen()) {
                this.handle_close_menu();
            }
        });

        return link;
    }

    get_menu_model() {
        const t = this.Translation.t;
        const state = typeof this.getState === 'function' ? this.getState() : null;
        const audit_status = state?.auditStatus;
        const sample_count = state?.samples?.length || 0;
        const rule_file_content = state?.ruleFileContent || null;
        const requirements = rule_file_content?.requirements;

        // Antalet krav i menyn ska räkna krav som är relevanta för minst ett stickprov,
        // baserat på valda innehållstyper (inte baserat på requirementResults som ofta är tomt innan granskning).
        const can_use_audit_logic = Boolean(
            this.AuditLogic &&
            typeof this.AuditLogic.get_relevant_requirements_for_sample === 'function' &&
            rule_file_content
        );

        const requirement_ids_in_rulefile = new Set();
        if (Array.isArray(requirements)) {
            requirements.forEach((req, idx) => {
                const req_id = (req && typeof req === 'object') ? (req.key || req.id || String(idx)) : String(idx);
                if (req_id) requirement_ids_in_rulefile.add(String(req_id));
            });
        } else if (requirements && typeof requirements === 'object') {
            Object.entries(requirements).forEach(([req_id, req]) => {
                const effective_id = (req && typeof req === 'object') ? (req.key || req.id || req_id) : req_id;
                if (effective_id) requirement_ids_in_rulefile.add(String(effective_id));
            });
        }

        const requirement_ids_in_samples = new Set();
        (state?.samples || []).forEach(sample => {
            if (can_use_audit_logic) {
                const relevant_reqs = this.AuditLogic.get_relevant_requirements_for_sample(rule_file_content, sample);
                (relevant_reqs || []).forEach(req => {
                    const req_id = req?.key || req?.id;
                    if (req_id) requirement_ids_in_samples.add(String(req_id));
                });
                return;
            }

            // Fallback (bakåtkompatibilitet): om AuditLogic inte är injicerad.
            const req_results = sample?.requirementResults;
            if (!req_results || typeof req_results !== 'object') return;
            Object.keys(req_results).forEach(req_id => requirement_ids_in_samples.add(String(req_id)));
        });

        const requirement_count = requirement_ids_in_rulefile.size > 0
            ? [...requirement_ids_in_samples].filter(req_id => requirement_ids_in_rulefile.has(req_id)).length
            : requirement_ids_in_samples.size;

        if (this.current_view_name === 'start' || this.current_view_name === 'audit' || this.current_view_name === 'audit_audits' || this.current_view_name === 'audit_rules' || this.current_view_name === 'manage_users' || this.current_view_name === 'my_settings' || this.current_view_name === 'statistics' || this.current_view_name === 'backup' || this.current_view_name === 'backup_detail' || this.current_view_name === 'backup_rulefile_detail' || this.current_view_name === 'backup_settings') {
            const is_admin = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gv_current_user_is_admin') === '1';
            const items = [
                { label: t('menu_link_manage_audits'), view_name: 'start' },
                { label: t('menu_link_manage_rules'), view_name: 'audit_rules' },
                { label: t('menu_link_backups'), view_name: 'backup' },
                { label: t('menu_link_statistics'), view_name: 'statistics' },
                { label: t('menu_link_my_settings'), view_name: 'my_settings' }
            ];
            if (is_admin) {
                items.push({ label: t('menu_link_manage_users'), view_name: 'manage_users' });
            }
            return {
                should_show: true,
                aria_label: t('side_menu_aria_label'),
                items
            };
        }

        if (audit_status === 'rulefile_editing') {
            return {
                should_show: true,
                aria_label: t('side_menu_aria_label'),
                items: [
                    { label: t('rulefile_section_general_title'), view_name: 'rulefile_sections', params: { section: 'general' } },
                    { label: t('rulefile_requirements_menu_title'), view_name: 'rulefile_requirements' },
                    { label: t('rulefile_metadata_section_page_types'), view_name: 'rulefile_sections', params: { section: 'page_types' } },
                    { label: t('rulefile_metadata_section_content_types'), view_name: 'rulefile_sections', params: { section: 'content_types' } },
                    { label: t('rulefile_section_info_blocks_order_title'), view_name: 'rulefile_sections', params: { section: 'info_blocks_order' } },
                    { label: t('rulefile_section_classifications_title'), view_name: 'rulefile_sections', params: { section: 'classifications' } },
                    { label: t('rulefile_section_report_template_title'), view_name: 'rulefile_sections', params: { section: 'report_template' } },
                    { label: t('side_menu_back_to_audit'), view_name: 'audit_rules', back_to_start: true }
                ]
            };
        }

        if (this.current_view_name === 'metadata' || this.current_view_name === 'edit_metadata') {
            return {
                should_show: true,
                aria_label: t('side_menu_aria_label'),
                items: [
                    { label: t('audit_metadata_title'), view_name: 'metadata' },
                    { label: t('left_menu_sample_list_with_count', { count: sample_count }), view_name: 'sample_management', count_id: 'sample_count', count_value: sample_count }
                ]
            };
        }

        if (audit_status === 'in_progress' || audit_status === 'locked' || audit_status === 'archived') {
            const problems_count = (this.AuditLogic && typeof this.AuditLogic.count_audit_problems === 'function')
                ? this.AuditLogic.count_audit_problems(state)
                : 0;
            const media_places_count = (this.AuditLogic && typeof this.AuditLogic.count_attached_media_places === 'function')
                ? this.AuditLogic.count_attached_media_places(state)
                : 0;

            return {
                should_show: true,
                aria_label: t('side_menu_aria_label'),
                items: [
                    { label: t('left_menu_audit_overview'), view_name: 'audit_overview' },
                    { label: t('left_menu_all_requirements_with_count', { count: requirement_count }), view_name: 'all_requirements', count_id: 'requirement_count', count_value: requirement_count },
                    { label: t('left_menu_sample_list_with_count', { count: sample_count }), view_name: 'sample_management', count_id: 'sample_count', count_value: sample_count },
                    { label: t('left_menu_images_with_count', { count: media_places_count }), view_name: 'audit_images', count_id: 'media_places_count', count_value: media_places_count },
                    { label: t('left_menu_problems_with_count', { count: problems_count }), view_name: 'audit_problems', count_id: 'problems_count', count_value: problems_count },
                    { label: t('left_menu_actions'), view_name: 'audit_actions' },
                    { label: t('audit_back_to_start'), view_name: 'start', back_to_start: true }
                ]
            };
        }

        // Fallback: visa minsta möjliga meny när vi inte är i ett definierat läge
        return {
            should_show: true,
            aria_label: t('side_menu_aria_label'),
            items: [
                { label: t('audit_metadata_title'), view_name: 'metadata' },
                { label: t('left_menu_sample_list_with_count', { count: sample_count }), view_name: 'sample_management', count_id: 'sample_count', count_value: sample_count }
            ]
        };
    }

    _get_structure_key(menu_model) {
        if (!menu_model?.items) return '';
        return `${menu_model.should_show}-${menu_model.items.map(i => i.view_name).join(',')}`;
    }

    _get_counts_from_model(menu_model) {
        const counts = {};
        (menu_model?.items || []).forEach(item => {
            if (item.count_id !== null && item.count_id !== undefined) {
                counts[item.count_id] = item.count_value;
            }
        });
        return counts;
    }

    _counts_equal(a, b) {
        const keys = new Set([...(Object.keys(a || {})), ...(Object.keys(b || {}))]);
        for (const k of keys) {
            if ((a?.[k] ?? null) !== (b?.[k] ?? null)) return false;
        }
        return true;
    }

    update_counts_only(menu_model) {
        if (!this.root || !this.nav_ref) {
            if (is_debug_problems_update()) consoleManager.log('[GV-Debug menu] update_counts_only: avbryt (root eller nav_ref saknas)');
            return false;
        }

        const structure_key = this._get_structure_key(menu_model);
        if (structure_key !== this.last_menu_structure_key) {
            if (is_debug_problems_update()) consoleManager.log('[GV-Debug menu] update_counts_only: avbryt (structure ändrad)', { structure_key, last: this.last_menu_structure_key });
            return false;
        }

        const new_counts = this._get_counts_from_model(menu_model);
        if (this._counts_equal(new_counts, this.last_menu_counts)) {
            if (is_debug_problems_update()) consoleManager.log('[GV-Debug menu] update_counts_only: inga ändringar i counts', new_counts);
            return true;
        }

        if (is_debug_problems_update()) consoleManager.log('[GV-Debug menu] update_counts_only: uppdaterar counts', { new_counts, last: this.last_menu_counts });

        const items_with_count = (menu_model?.items || []).filter((i) => i.count_id !== null && i.count_id !== undefined);
        for (const [count_id, new_value] of Object.entries(new_counts)) {
            const span = this.nav_ref.querySelector(`[data-count-id="${CSS.escape(count_id)}"]`);
            if (is_debug_problems_update() && count_id === 'problems_count') {
                consoleManager.log('[GV-Debug menu] update_counts_only: problems_count span', span ? 'finns' : 'saknas', 'nytt värde:', new_value);
            }
            if (span && span.textContent !== String(new_value)) {
                span.textContent = String(new_value);
                const item = items_with_count.find((i) => i.count_id === count_id);
                const link = span.closest('a');
                if (link && item?.label) link.setAttribute('aria-label', item.label);
            }
        }

        this.last_menu_counts = new_counts;
        return true;
    }

    render() {
        if (!this.root) return;
        const t = this.Translation.t;

        const menu_model = this.get_menu_model();
        const has_items = menu_model?.items && menu_model.items.length > 0;
        // Regel: När vänstermenyn saknar alternativ ska den inte visas alls.
        if (!menu_model.should_show || !has_items) {
            this.root.innerHTML = '';
            this.root.classList.add('hidden');
            this.is_menu_open = false;
            this.nav_ref = null;
            return;
        }

        this.root.classList.remove('hidden');
        this.root.innerHTML = '';
        this.first_link_ref = null;

        const wrapper = this.Helpers.create_element('div', { class_name: 'side-menu' });
        if (typeof document !== 'undefined') {
            this.menu_button_ref = document.getElementById(this.external_menu_button_id);
        }

        const compact_panel = this.Helpers.create_element('div', { class_name: 'side-menu__compact-panel' });
        const compact_panel_inner = this.Helpers.create_element('div', { class_name: 'side-menu__compact-panel-inner' });

        const nav = this.Helpers.create_element('nav', {
            id: 'side-menu-nav',
            class_name: ['side-menu__nav', ...(this.is_menu_open ? ['is-open'] : [])],
            attributes: { 'aria-label': menu_model.aria_label }
        });
        this.nav_ref = nav;

        const list = this.Helpers.create_element('ul', { class_name: 'side-menu__list' });
        menu_model.items.forEach((item, idx) => {
            const is_manage_users = item.view_name === 'manage_users';
            const li = this.Helpers.create_element('li', {
                class_name: [
                    'side-menu__item',
                    ...(item.back_to_start ? ['side-menu__item--back-to-start'] : []),
                    ...(is_manage_users ? ['side-menu__item--separated'] : [])
                ]
            });
            const link = this.create_menu_link(item);
            if (idx === 0) {
                this.first_link_ref = link;
            }
            li.appendChild(link);
            list.appendChild(li);
        });

        // Logga ut – synlig för alla, placerad under Hantera användare / Mina inställningar
        const logout_li = this.Helpers.create_element('li', {
            class_name: ['side-menu__item', 'side-menu__item--separated']
        });
        const logout_link = this.Helpers.create_element('a', {
            attributes: {
                href: '#login',
                'aria-label': t('menu_link_logout')
            },
            class_name: 'side-menu__link',
            text_content: t('menu_link_logout')
        });
        logout_link.addEventListener('click', (event) => {
            event.preventDefault();
            if (typeof this.clear_auth_token === 'function') {
                this.clear_auth_token();
            }
            if (typeof this.router === 'function') {
                this.router('login');
            }
            if (this.is_small_screen()) {
                this.handle_close_menu();
            }
        });
        logout_li.appendChild(logout_link);
        list.appendChild(logout_li);

        nav.appendChild(list);

        const compact_collapsed = this.is_small_screen() && !this.is_menu_open;
        if (compact_collapsed) {
            compact_panel.classList.add('side-menu__compact-panel--collapsed');
            compact_panel_inner.inert = true;
            nav.setAttribute('aria-hidden', 'true');
        } else {
            compact_panel_inner.inert = false;
            nav.removeAttribute('aria-hidden');
        }

        if (this.menu_button_ref) {
            this.menu_button_ref.setAttribute('aria-expanded', this.is_menu_open ? 'true' : 'false');
        }

        compact_panel_inner.appendChild(nav);
        compact_panel.appendChild(compact_panel_inner);
        wrapper.appendChild(compact_panel);
        this.root.appendChild(wrapper);

        this.last_menu_structure_key = this._get_structure_key(menu_model);
        this.last_menu_counts = this._get_counts_from_model(menu_model);
    }

    destroy() {
        this.remove_compact_escape_listener();
        document.removeEventListener('gv:layout_compact_changed', this.handle_layout_compact_changed);
        document.removeEventListener('gv:toggle_side_menu', this.handle_external_toggle_event);
        document.removeEventListener('gv:close_side_menu', this.handle_close_side_menu_event);

        if (typeof this.unsubscribe === 'function') {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        if (this.root) {
            this.root.innerHTML = '';
        }

        this.root = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.Translation = null;
        this.Helpers = null;
        this.clear_auth_token = null;

        this.menu_button_ref = null;
        this.nav_ref = null;
        this.first_link_ref = null;
    }
}
