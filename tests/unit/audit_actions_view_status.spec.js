/**
 * Tester för vilka statusknappar AuditActionsViewComponent visar per läge.
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

function make_deps(audit_status) {
    const state = {
        auditStatus: audit_status,
        ruleFileContent: { requirements: {} },
        samples: [{ id: 's1', requirementResults: {} }],
        auditMetadata: {}
    };
    const dispatch = jest.fn(async (action) => {
        if (action?.payload?.status) {
            state.auditStatus = action.payload.status;
        }
    });
    return {
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

describe('AuditActionsViewComponent statusknappar', () => {
    let AuditActionsViewComponent;

    beforeEach(async () => {
        jest.resetModules();
        const mod = await import('../../js/components/AuditActionsViewComponent.ts');
        AuditActionsViewComponent = mod.AuditActionsViewComponent;
    });

    async function render_with_status(status) {
        const root = document.createElement('div');
        document.body.appendChild(root);
        const component = new AuditActionsViewComponent();
        await component.init({ root, deps: make_deps(status) });
        component.render();
        return { root, component };
    }

    function button_ids(root) {
        return [...root.querySelectorAll('button[id^="audit-action-btn-"]')].map((b) => b.id);
    }

    function heading_texts(root) {
        return [...root.querySelectorAll('h2')].map((h) => h.textContent);
    }

    test('in_progress visar avsluta-knapp, inte lås upp eller arkivera', async () => {
        const { root, component } = await render_with_status('in_progress');
        const ids = button_ids(root);
        expect(ids).toContain('audit-action-btn-lock-audit');
        expect(ids).not.toContain('audit-action-btn-unlock-audit');
        expect(ids).not.toContain('audit-action-btn-archive-audit');
        expect(ids).not.toContain('audit-action-btn-activate-audit');
        component.destroy();
        root.remove();
    });

    test('locked visar lås upp och arkivera, inte avsluta', async () => {
        const { root, component } = await render_with_status('locked');
        const ids = button_ids(root);
        expect(ids).toContain('audit-action-btn-unlock-audit');
        expect(ids).toContain('audit-action-btn-archive-audit');
        expect(ids).not.toContain('audit-action-btn-lock-audit');
        expect(ids).not.toContain('audit-action-btn-activate-audit');
        component.destroy();
        root.remove();
    });

    test('archived visar återaktivera, inte lås upp direkt', async () => {
        const { root, component } = await render_with_status('archived');
        const ids = button_ids(root);
        expect(ids).toContain('audit-action-btn-activate-audit');
        expect(ids).not.toContain('audit-action-btn-unlock-audit');
        expect(ids).not.toContain('audit-action-btn-lock-audit');
        expect(ids).not.toContain('audit-action-btn-archive-audit');
        component.destroy();
        root.remove();
    });

    test('locked visar bilageguide och exportknappar för observationstexter', async () => {
        const { root, component } = await render_with_status('locked');
        const ids = button_ids(root);
        const headings = heading_texts(root);

        expect(headings).toContain('audit_actions_appendix_guide_title');
        expect(headings).toContain('audit_actions_exports_title');
        expect(ids).toContain('audit-action-btn-download-observation-texts-word');
        expect(ids).toContain('audit-action-btn-import-processed-observation-texts-word');
        expect(root.textContent).toContain('audit_actions_appendix_guide_intro');
        expect(root.querySelector('#audit-action-desc-appendix-guide-upload')).toBeTruthy();
        expect(root.querySelector('.audit-actions__appendix-guide-upload-block')).toBeTruthy();

        const download_desc = root.querySelector('#audit-action-desc-appendix-guide-download');
        const download_btn = root.querySelector('#audit-action-btn-download-observation-texts-word');
        const upload_desc = root.querySelector('#audit-action-desc-appendix-guide-upload');
        const upload_btn = root.querySelector('#audit-action-btn-import-processed-observation-texts-word');

        expect(download_desc?.compareDocumentPosition(download_btn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(download_btn?.compareDocumentPosition(upload_desc)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(upload_desc?.compareDocumentPosition(upload_btn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

        component.destroy();
        root.remove();
    });

    test('exportbeskrivning ligger ovanför exportknapp', async () => {
        const { root, component } = await render_with_status('locked');
        const desc = root.querySelector('#audit-action-desc-download-audit');
        const btn = root.querySelector('#audit-action-btn-download-audit');
        expect(desc?.compareDocumentPosition(btn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        component.destroy();
        root.remove();
    });

    test('in_progress visar låst-meddelande i guide och export, utan guide-knappar', async () => {
        const { root, component } = await render_with_status('in_progress');
        const ids = button_ids(root);

        expect(root.textContent).toContain('audit_not_locked_for_export');
        expect(ids).not.toContain('audit-action-btn-download-observation-texts-word');
        expect(ids).not.toContain('audit-action-btn-import-processed-observation-texts-word');
        component.destroy();
        root.remove();
    });

    test('klick på avsluta dispatchar locked direkt och uppdaterar vyn', async () => {
        const root = document.createElement('div');
        document.body.appendChild(root);
        const deps = make_deps('in_progress');
        const component = new AuditActionsViewComponent();
        await component.init({ root, deps });
        component.render();
        root.querySelector('#audit-action-btn-lock-audit').click();
        await Promise.resolve();
        expect(deps.dispatch).toHaveBeenCalledWith({
            type: 'SET_AUDIT_STATUS',
            payload: { status: 'locked' }
        });
        expect(deps.flush_sync_to_server).not.toHaveBeenCalled();
        expect(root.querySelector('#audit-action-btn-unlock-audit')).toBeTruthy();
        expect(root.querySelector('#audit-action-btn-lock-audit')).toBeFalsy();
        expect(document.activeElement?.id).toBe('audit-action-btn-unlock-audit');
        component.destroy();
        root.remove();
    });
});
