export const SideMenuComponent = {
    CSS_PATH: 'css/components/side_menu_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;

        this.router = deps.router;
        this.getState = deps.getState;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.AuditLogic = deps.AuditLogic;

        this.current_view_name = 'start';
        this.current_view_params = {};
        this.is_menu_open = false;

        this.menu_button_ref = null;
        this.nav_ref = null;
        this.first_link_ref = null;
        this.last_menu_counts = null;
        this.last_menu_structure_key = null;

        this.small_screen_media_query = window.matchMedia
            ? window.matchMedia('(max-width: 768px)')
            : null;

        this.handle_toggle_menu = this.handle_toggle_menu.bind(this);
        this.handle_close_menu = this.handle_close_menu.bind(this);
        this.handle_document_keydown = this.handle_document_keydown.bind(this);
        this.handle_media_query_change = this.handle_media_query_change.bind(this);

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }

        this.unsubscribe = null;
        if (typeof deps.subscribe === 'function') {
            this.unsubscribe = deps.subscribe((_new_state, listener_meta) => {
                if (listener_meta?.skip_render) return;
                if (!this.root || typeof this.render !== 'function') return;

                const menu_model = this.get_menu_model();
                if (window.__GV_DEBUG_PROBLEMS_UPDATE__) {
                    const problems_item = (menu_model?.items || []).find((i) => i.count_id === 'problems_count');
                    console.log('[GV-Debug menu] listener: problems_count i model:', problems_item?.count_value, 'skip_render:', listener_meta?.skip_render);
                }
                if (!menu_model.should_show) {
                    if (window.__GV_DEBUG_MODAL_SCROLL) console.log('[GV-ModalDebug] SideMenu: full render (hidden)');
                    this.render();
                    return;
                }
                if (this.update_counts_only(menu_model)) {
                    if (window.__GV_DEBUG_PROBLEMS_UPDATE__) console.log('[GV-Debug menu] listener: update_counts_only lyckades');
                    if (window.__GV_DEBUG_MODAL_SCROLL) console.log('[GV-ModalDebug] SideMenu: update_counts_only');
                    return;
                }
                if (window.__GV_DEBUG_PROBLEMS_UPDATE__) console.log('[GV-Debug menu] listener: update_counts_only gjorde inget, kör full render');
                if (window.__GV_DEBUG_MODAL_SCROLL) console.log('[GV-ModalDebug] SideMenu: full render');
                this.render();
            });
        }

        if (this.small_screen_media_query) {
            try {
                this.small_screen_media_query.addEventListener('change', this.handle_media_query_change);
            } catch (e) {
                // Safari < 14
                this.small_screen_media_query.addListener(this.handle_media_query_change);
            }
        }
    },

    set_current_view(view_name, params = {}) {
        this.current_view_name = view_name || 'start';
        this.current_view_params = params || {};
    },

    is_small_screen() {
        if (!this.small_screen_media_query) return false;
        return Boolean(this.small_screen_media_query.matches);
    },

    handle_media_query_change() {
        if (!this.is_small_screen()) {
            this.is_menu_open = false;
            this.remove_escape_listener();
        }
        this.render();
    },

    handle_toggle_menu() {
        if (this.is_menu_open) {
            this.handle_close_menu({ restore_focus: true });
            return;
        }

        this.is_menu_open = true;
        this.add_escape_listener();
        this.render();

        // Fokus på första länken när menyn öppnas
        requestAnimationFrame(() => {
            if (this.first_link_ref && document.contains(this.first_link_ref)) {
                try {
                    this.first_link_ref.focus({ preventScroll: true });
                } catch (e) {
                    this.first_link_ref.focus();
                }
            }
        });
    },

    handle_close_menu({ restore_focus = false } = {}) {
        if (!this.is_menu_open) return;
        this.is_menu_open = false;
        this.remove_escape_listener();
        this.render();

        if (restore_focus) {
            requestAnimationFrame(() => {
                if (this.menu_button_ref && document.contains(this.menu_button_ref)) {
                    try {
                        this.menu_button_ref.focus({ preventScroll: true });
                    } catch (e) {
                        this.menu_button_ref.focus();
                    }
                }
            });
        }
    },

    add_escape_listener() {
        document.addEventListener('keydown', this.handle_document_keydown);
    },

    remove_escape_listener() {
        document.removeEventListener('keydown', this.handle_document_keydown);
    },

    handle_document_keydown(event) {
        if (!this.is_small_screen()) return;
        if (!this.is_menu_open) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            this.handle_close_menu({ restore_focus: true });
        }
    },

    build_hash(view_name, params = {}) {
        const has_params = params && Object.keys(params).length > 0;
        if (!has_params) return `#${view_name}`;
        return `#${view_name}?${new URLSearchParams(params).toString()}`;
    },

    get_view_name_from_location_hash() {
        // Härleder aktiv vy från URL:en för att undvika att menyn "fastnar"
        // i fel aktivt val vid navigeringar som inte alltid uppdaterar intern state i exakt rätt ordning.
        try {
            const raw = window.location?.hash || '';
            const hash = raw.startsWith('#') ? raw.substring(1) : raw;
            const [view_name] = hash.split('?');
            return view_name || null;
        } catch (e) {
            return null;
        }
    },

    get_params_from_location_hash() {
        try {
            const raw = window.location?.hash || '';
            const hash = raw.startsWith('#') ? raw.substring(1) : raw;
            const query_part = hash.split('?')[1];
            if (!query_part) return {};
            return Object.fromEntries(new URLSearchParams(query_part));
        } catch (e) {
            return {};
        }
    },

    create_menu_link({ label, view_name, params = {}, count_id, count_value }) {
        const view_from_hash = this.get_view_name_from_location_hash();
        let active_view_name = view_from_hash || this.current_view_name;
        if (active_view_name === 'backup_detail') {
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

        if (count_id != null && count_value != null) {
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
            if (window.__GV_DEBUG_NAV) {
                console.log('[GV-NAV] Sidomeny-länk klickad', { view_name, params, has_router: typeof this.router === 'function' });
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
    },

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

        if (this.current_view_name === 'restore_session') {
            return { should_show: false, items: [], aria_label: t('side_menu_aria_label') };
        }

        if (this.current_view_name === 'start' || this.current_view_name === 'audit' || this.current_view_name === 'audit_audits' || this.current_view_name === 'audit_rules' || this.current_view_name === 'manage_users' || this.current_view_name === 'my_settings' || this.current_view_name === 'backup' || this.current_view_name === 'backup_detail') {
            return {
                should_show: true,
                aria_label: t('side_menu_aria_label'),
                items: [
                    { label: t('menu_link_manage_audits'), view_name: 'start' },
                    { label: t('menu_link_manage_rules'), view_name: 'audit_rules' },
                    { label: t('menu_link_backups'), view_name: 'backup' },
                    { label: t('menu_link_my_settings'), view_name: 'my_settings' },
                    { label: t('menu_link_manage_users'), view_name: 'manage_users' }
                ]
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

        if (audit_status === 'in_progress' || audit_status === 'locked') {
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
    },

    _get_structure_key(menu_model) {
        if (!menu_model?.items) return '';
        return `${menu_model.should_show}-${menu_model.items.map(i => i.view_name).join(',')}`;
    },

    _get_counts_from_model(menu_model) {
        const counts = {};
        (menu_model?.items || []).forEach(item => {
            if (item.count_id != null) {
                counts[item.count_id] = item.count_value;
            }
        });
        return counts;
    },

    _counts_equal(a, b) {
        const keys = new Set([...(Object.keys(a || {})), ...(Object.keys(b || {}))]);
        for (const k of keys) {
            if ((a?.[k] ?? null) !== (b?.[k] ?? null)) return false;
        }
        return true;
    },

    update_counts_only(menu_model) {
        if (!this.root || !this.nav_ref) {
            if (window.__GV_DEBUG_PROBLEMS_UPDATE__) console.log('[GV-Debug menu] update_counts_only: avbryt (root eller nav_ref saknas)');
            return false;
        }

        const structure_key = this._get_structure_key(menu_model);
        if (structure_key !== this.last_menu_structure_key) {
            if (window.__GV_DEBUG_PROBLEMS_UPDATE__) console.log('[GV-Debug menu] update_counts_only: avbryt (structure ändrad)', { structure_key, last: this.last_menu_structure_key });
            return false;
        }

        const new_counts = this._get_counts_from_model(menu_model);
        if (this._counts_equal(new_counts, this.last_menu_counts)) {
            if (window.__GV_DEBUG_PROBLEMS_UPDATE__) console.log('[GV-Debug menu] update_counts_only: inga ändringar i counts', new_counts);
            return true;
        }

        if (window.__GV_DEBUG_PROBLEMS_UPDATE__) console.log('[GV-Debug menu] update_counts_only: uppdaterar counts', { new_counts, last: this.last_menu_counts });

        let changed = false;
        const items_with_count = (menu_model?.items || []).filter((i) => i.count_id != null);
        for (const [count_id, new_value] of Object.entries(new_counts)) {
            const span = this.nav_ref.querySelector(`[data-count-id="${CSS.escape(count_id)}"]`);
            if (window.__GV_DEBUG_PROBLEMS_UPDATE__ && count_id === 'problems_count') {
                console.log('[GV-Debug menu] update_counts_only: problems_count span', span ? 'finns' : 'saknas', 'nytt värde:', new_value);
            }
            if (span && span.textContent !== String(new_value)) {
                span.textContent = String(new_value);
                const item = items_with_count.find((i) => i.count_id === count_id);
                const link = span.closest('a');
                if (link && item?.label) link.setAttribute('aria-label', item.label);
                changed = true;
            }
        }

        this.last_menu_counts = new_counts;
        return true;
    },

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
            this.remove_escape_listener();
            return;
        }

        this.root.classList.remove('hidden');
        this.root.innerHTML = '';
        this.first_link_ref = null;

        const wrapper = this.Helpers.create_element('div', { class_name: 'side-menu' });

        const menu_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'side-menu__toggle'],
            attributes: {
                type: 'button',
                'aria-expanded': this.is_menu_open ? 'true' : 'false',
                'aria-controls': 'side-menu-nav'
            },
            text_content: this.is_menu_open ? t('side_menu_close_button') : t('side_menu_open_button'),
            event_listeners: { click: this.handle_toggle_menu }
        });
        this.menu_button_ref = menu_button;
        wrapper.appendChild(menu_button);

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
        nav.appendChild(list);

        const should_hide_nav = this.is_small_screen() && !this.is_menu_open;
        nav.hidden = should_hide_nav;

        wrapper.appendChild(nav);
        this.root.appendChild(wrapper);

        this.last_menu_structure_key = this._get_structure_key(menu_model);
        this.last_menu_counts = this._get_counts_from_model(menu_model);
    },

    destroy() {
        this.remove_escape_listener();

        if (typeof this.unsubscribe === 'function') {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        if (this.small_screen_media_query) {
            try {
                this.small_screen_media_query.removeEventListener('change', this.handle_media_query_change);
            } catch (e) {
                this.small_screen_media_query.removeListener(this.handle_media_query_change);
            }
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

        this.menu_button_ref = null;
        this.nav_ref = null;
        this.first_link_ref = null;
        this.small_screen_media_query = null;
    }
};
