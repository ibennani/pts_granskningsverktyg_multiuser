/**
 * Tester för Åtgärder-vyn: hub, hantera, nedladdningar och status-dropdown.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

function make_helpers() {
    return {
        load_css: jest.fn(() => Promise.resolve()),
        create_element: (tag, opts = {}) => {
            const el = document.createElement(tag);
            if (opts.class_name) {
                const classes = Array.isArray(opts.class_name) ? opts.class_name : [opts.class_name];
                el.className = classes.join(' ');
            }
            if (opts.text_content) el.textContent = opts.text_content;
            if (opts.attributes) {
                Object.entries(opts.attributes).forEach(([k, v]) => el.setAttribute(k, String(v)));
            }
            if (opts.html_content) el.innerHTML = opts.html_content;
            if (opts.event_listeners) {
                Object.entries(opts.event_listeners).forEach(([ev, fn]) => el.addEventListener(ev, fn));
            }
            return el;
        },
        get_icon_svg: () => '<svg></svg>'
    };
}

function make_deps(audit_status, section = '', extra_params = {}) {
    const state = {
        auditStatus: audit_status,
        ruleFileContent: { requirements: {}, metadata: { language: 'sv' }, appendix2: {} },
        samples: [{ id: 's1', requirementResults: {} }],
        auditMetadata: {}
    };
    const dispatch = jest.fn(async (action) => {
        if (action?.payload?.status) {
            state.auditStatus = action.payload.status;
        }
    });
    return {
        params: section ? { section, ...extra_params } : { ...extra_params },
        router: jest.fn(),
        getState: () => state,
        dispatch,
        flush_sync_to_server: jest.fn(() => Promise.resolve()),
        StoreActionTypes: { SET_AUDIT_STATUS: 'SET_AUDIT_STATUS' },
        Translation: { t: (key) => key },
        Helpers: make_helpers(),
        NotificationComponent: { show_global_message: jest.fn() },
        ExportLogic: {
            export_observation_texts_word: jest.fn(),
            export_to_pdf_deficiency_types: jest.fn(),
            export_to_excel: jest.fn(),
            export_to_pdf_screenshots_appendix: jest.fn(),
            export_audit_appendices_zip: jest.fn(),
        },
        AuditLogic: {
            get_relevant_requirements_for_sample: () => [],
            get_effective_requirement_audit_status: () => 'not_audited',
            get_stored_requirement_result_for_def: () => null,
            count_audit_problems: () => 0
        },
        SaveAuditLogic: null
    };
}

describe('AuditActionsViewComponent hub och sektioner', () => {
    let AuditActionsViewComponent;

    beforeEach(async () => {
        jest.resetModules();
        const mod = await import('../../js/components/AuditActionsViewComponent.ts');
        AuditActionsViewComponent = mod.AuditActionsViewComponent;
    });

    async function render_with(status, section = '', extra_params = {}) {
        const root = document.createElement('div');
        document.body.appendChild(root);
        const component = new AuditActionsViewComponent();
        await component.init({ root, deps: make_deps(status, section, extra_params) });
        await component._render_immediate();
        return { root, component };
    }

    function button_ids(root) {
        return [...root.querySelectorAll('button[id^="audit-action-btn-"]')].map((b) => b.id);
    }

    function heading_texts(root) {
        return [...root.querySelectorAll('h1, h2')].map((h) => h.textContent);
    }

    function select_options(root) {
        const select = root.querySelector('#audit-action-status-select');
        if (!select) return [];
        return [...select.options].map((o) => o.value);
    }

    test('hub visar titel och länkar till hantera, bilagor och snapshots', async () => {
        const { root, component } = await render_with('in_progress');
        expect(heading_texts(root)).toContain('audit_actions_title');
        expect(root.textContent).toContain('audit_actions_hub_intro');
        expect(root.textContent).toContain('audit_actions_nav_manage');
        expect(root.textContent).toContain('audit_actions_nav_information');
        expect(root.textContent).toContain('audit_actions_nav_appendix_templates');
        expect(root.textContent).toContain('audit_actions_nav_downloads');
        expect(root.textContent).toContain('audit_actions_nav_snapshots');
        expect(root.querySelector('#audit-actions-hub-heading')).toBeFalsy();
        expect(root.querySelector('#audit-action-status-select')).toBeFalsy();
        component.destroy();
        root.remove();
    });

    test('hub visar bilagor och export som andra block efter hantera granskning', async () => {
        const { root, component } = await render_with('in_progress');
        const hub_links = [...root.querySelectorAll('.audit-settings__hub-link')].map((link) => link.textContent);

        expect(hub_links).toEqual([
            'audit_actions_nav_manage',
            'audit_actions_nav_downloads',
            'audit_actions_nav_information',
            'audit_actions_nav_appendix_templates',
            'audit_actions_nav_snapshots',
        ]);

        component.destroy();
        root.remove();
    });

    test('bilagoredigering saknar Tillbaka till Åtgärder-rad direkt under plattan', async () => {
        const { root, component } = await render_with('locked', 'appendix_templates', {
            appendix: '2',
            edit: 'true',
        });
        const plate = root.querySelector('.audit-actions-plate.rulefile-sections-main-plate');
        expect(plate?.querySelector(':scope > .audit-settings__back-row')).toBeNull();

        component.destroy();
        root.remove();
    });

    test('snapshots visar endast rubrik', async () => {
        const { root, component } = await render_with('in_progress', 'snapshots');
        await new Promise((resolve) => {
            const deadline = Date.now() + 2000;
            const wait_for_heading = () => {
                if (root.querySelector('h1') || Date.now() >= deadline) {
                    resolve(undefined);
                    return;
                }
                setTimeout(wait_for_heading, 10);
            };
            wait_for_heading();
        });
        expect(heading_texts(root)).toEqual(['audit_actions_snapshots_title']);
        expect(root.querySelector('.audit-actions__content')).toBeFalsy();
        component.destroy();
        root.remove();
    });

    test('manage visar status-dropdown, inte lås/arkivera-knappar', async () => {
        const { root, component } = await render_with('in_progress', 'manage');
        const ids = button_ids(root);
        expect(root.querySelector('#audit-action-status-select')).toBeTruthy();
        expect(root.querySelector('#audit-action-status-select-hints')).toBeTruthy();
        expect(root.querySelectorAll('.audit-actions__status-hint').length).toBe(4);
        expect(root.textContent).toContain('audit_actions_status_use_not_started');
        expect(root.textContent).toContain('audit_actions_status_use_in_progress');
        expect(root.textContent).toContain('audit_actions_status_use_locked');
        expect(root.textContent).toContain('audit_actions_status_use_archived');
        expect(ids).not.toContain('audit-action-btn-lock-audit');
        expect(ids).not.toContain('audit-action-btn-unlock-audit');
        expect(ids).not.toContain('audit-action-btn-archive-audit');
        expect(ids).not.toContain('audit-action-btn-activate-audit');
        expect(ids).not.toContain('audit-action-btn-download-audit');
        expect(root.textContent).not.toContain('audit_actions_go_to_downloads');
        component.destroy();
        root.remove();
    });

    test('downloads visar JSON men döljer bilagor för in_progress', async () => {
        const { root, component } = await render_with('in_progress', 'downloads');
        const ids = button_ids(root);
        const headings = heading_texts(root);

        expect(headings).toContain('audit_actions_json_backup_title');
        expect(headings).toContain('audit_actions_downloads_locked_title');
        expect(headings).not.toContain('audit_actions_appendix_guide_title');
        expect(ids).toContain('audit-action-btn-download-audit');
        expect(root.textContent).toContain('audit_actions_downloads_in_progress_intro_before');
        expect(root.textContent).toContain('audit_actions_nav_manage');
        const manage_link = root.querySelector(
            '.audit-actions__downloads-locked-notice a'
        );
        expect(manage_link?.textContent).toBe('audit_actions_nav_manage');
        expect(root.textContent).not.toContain('audit_actions_exports_title');
        expect(ids).not.toContain('audit-action-btn-download-observation-texts-word');
        expect(root.textContent).not.toContain('audit_actions_go_to_manage');
        component.destroy();
        root.remove();
    });

    test('downloads visar bilagor och export för locked', async () => {
        const { root, component } = await render_with('locked', 'downloads');
        const ids = button_ids(root);
        const headings = heading_texts(root);

        expect(headings).toContain('audit_actions_json_backup_title');
        expect(headings).toContain('audit_actions_appendix_guide_title');
        expect(headings).toContain('audit_actions_download_appendices_title');
        expect(headings).toContain('audit_actions_exports_title');
        expect(ids).toContain('audit-action-btn-download-audit');
        expect(ids).toContain('audit-action-btn-download-observation-texts-word');
        expect(ids).toContain('audit-action-btn-import-processed-observation-texts-word');
        expect(ids).toContain('audit-action-btn-appendix-1-summary');
        expect(root.querySelector('#audit-action-status-select')).toBeFalsy();
        component.destroy();
        root.remove();
    });

    test('locked downloads visar bilageguide före export', async () => {
        const { root, component } = await render_with('locked', 'downloads');
        const headings = heading_texts(root);

        expect(headings.indexOf('audit_actions_appendix_guide_title')).toBeLessThan(
            headings.indexOf('audit_actions_download_appendices_title')
        );
        expect(headings.indexOf('audit_actions_download_appendices_title')).toBeLessThan(
            headings.indexOf('audit_actions_exports_title')
        );

        component.destroy();
        root.remove();
    });

    test('archived downloads visar export men inte importknapp', async () => {
        const { root, component } = await render_with('archived', 'downloads');
        const ids = button_ids(root);

        expect(ids).toContain('audit-action-btn-download-observation-texts-word');
        expect(ids).not.toContain('audit-action-btn-import-processed-observation-texts-word');
        expect(root.textContent).toContain('audit_actions_import_processed_observation_texts_archived_blocked');
        component.destroy();
        root.remove();
    });

    test('manage visar statusrubrik som h2 med aria-labelledby på select', async () => {
        const { root, component } = await render_with('in_progress', 'manage');
        const label = root.querySelector('#audit-action-status-select-label');
        const select = root.querySelector('#audit-action-status-select');

        expect(label?.tagName).toBe('H2');
        expect(label?.classList.contains('audit-actions__section-title')).toBe(true);
        expect(label?.textContent).toBe('audit_actions_status_select_label');
        expect(select?.getAttribute('aria-labelledby')).toBe('audit-action-status-select-label');
        expect(heading_texts(root)).not.toContain('audit_actions_status_section_title_in_progress');

        component.destroy();
        root.remove();
    });

    test('statusändring via select utan bekräftelse dispatchar in_progress', async () => {
        jest.useFakeTimers();
        const root = document.createElement('div');
        document.body.appendChild(root);
        const deps = make_deps('locked', 'manage');
        const component = new AuditActionsViewComponent();
        await component.init({ root, deps });
        component.render();

        const select = root.querySelector('#audit-action-status-select');
        select.value = 'in_progress';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();

        expect(deps.dispatch).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(250);
        await Promise.resolve();
        expect(deps.dispatch).toHaveBeenCalledWith({
            type: 'SET_AUDIT_STATUS',
            payload: { status: 'in_progress' }
        });
        await jest.runAllTimersAsync();
        expect(select.value).toBe('in_progress');
        component.destroy();
        root.remove();
        jest.useRealTimers();
    });

    test('statusändring till locked visar bekräftelsemodal', async () => {
        jest.resetModules();
        const { app_runtime_refs: runtime_refs } = await import('../../js/utils/app_runtime_refs.js');
        const { AuditActionsViewComponent: ActionsComponent } = await import(
            '../../js/components/AuditActionsViewComponent.ts'
        );
        const orig_modal = runtime_refs.modal_component;
        const show_spy = jest.fn();
        runtime_refs.modal_component = { show: show_spy };

        const root = document.createElement('div');
        document.body.appendChild(root);
        const deps = make_deps('in_progress', 'manage');
        const component = new ActionsComponent();
        await component.init({ root, deps });
        component.render();

        const select = root.querySelector('#audit-action-status-select');
        select.value = 'locked';
        select.dispatchEvent(new Event('change', { bubbles: true }));

        expect(show_spy).toHaveBeenCalledWith(
            expect.objectContaining({ h1_text: 'audit_actions_status_change_confirm_locked_title' }),
            expect.any(Function)
        );

        runtime_refs.modal_component = orig_modal;
        component.destroy();
        root.remove();
    });
});

describe('get_allowed_audit_status_targets', () => {
    test('returnerar giltiga övergångar per status', async () => {
        const { get_allowed_audit_status_targets } = await import(
            '../../js/components/audit_actions_view_status_select.ts'
        );
        expect(get_allowed_audit_status_targets('in_progress')).toEqual(['in_progress', 'locked']);
        expect(get_allowed_audit_status_targets('locked')).toEqual(['locked', 'in_progress', 'archived']);
        expect(get_allowed_audit_status_targets('archived')).toEqual(['archived', 'locked']);
        expect(get_allowed_audit_status_targets('not_started')).toEqual(['not_started']);
    });
});

describe('audit_actions_render', () => {
    test('normalize_audit_actions_section accepterar manage, downloads och snapshots', async () => {
        const { normalize_audit_actions_section } = await import(
            '../../js/components/audit_actions_render.ts'
        );
        expect(normalize_audit_actions_section('manage')).toBe('manage');
        expect(normalize_audit_actions_section('downloads')).toBe('downloads');
        expect(normalize_audit_actions_section('snapshots')).toBe('snapshots');
        expect(normalize_audit_actions_section('information')).toBe('information');
        expect(normalize_audit_actions_section('appendix_templates')).toBe('appendix_templates');
        expect(normalize_audit_actions_section('hub')).toBe('');
        expect(normalize_audit_actions_section(undefined)).toBe('');
        expect(normalize_audit_actions_section('invalid')).toBe('');
    });
});

describe('manage status-dropdown alternativ', () => {
    let AuditActionsViewComponent;

    beforeEach(async () => {
        jest.resetModules();
        const mod = await import('../../js/components/AuditActionsViewComponent.ts');
        AuditActionsViewComponent = mod.AuditActionsViewComponent;
    });

    async function render_manage(status) {
        const root = document.createElement('div');
        document.body.appendChild(root);
        const component = new AuditActionsViewComponent();
        await component.init({ root, deps: make_deps(status, 'manage') });
        component.render();
        return { root, component };
    }

    function select_options(root) {
        const select = root.querySelector('#audit-action-status-select');
        return [...select.options].map((o) => o.value);
    }

    const ALL_STATUS_OPTIONS = ['not_started', 'in_progress', 'locked', 'archived'];

    test('in_progress select visar alla fyra statusar', async () => {
        const { root, component } = await render_manage('in_progress');
        expect(select_options(root)).toEqual(ALL_STATUS_OPTIONS);
        component.destroy();
        root.remove();
    });

    test('locked select visar alla fyra statusar', async () => {
        const { root, component } = await render_manage('locked');
        expect(select_options(root)).toEqual(ALL_STATUS_OPTIONS);
        component.destroy();
        root.remove();
    });

    test('archived select visar alla fyra statusar', async () => {
        const { root, component } = await render_manage('archived');
        expect(select_options(root)).toEqual(ALL_STATUS_OPTIONS);
        component.destroy();
        root.remove();
    });

    test('not_started select visar alla fyra statusar', async () => {
        const { root, component } = await render_manage('not_started');
        expect(select_options(root)).toEqual(ALL_STATUS_OPTIONS);
        component.destroy();
        root.remove();
    });
});
