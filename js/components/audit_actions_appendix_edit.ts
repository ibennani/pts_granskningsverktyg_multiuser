/**
 * @fileoverview Redigeringsformulär för bilagor under Åtgärder.
 */

type AuditAppendixEditView = {
    audit_appendix_edit_component: { destroy?: () => void } | null;
    audit_appendix_edit_appendix: string | null;
};

type AuditAppendixEditCtx = {
    deps: Record<string, unknown>;
    view: AuditAppendixEditView;
};

export async function render_audit_appendix_edit_form(
    ctx: AuditAppendixEditCtx,
    container: HTMLElement,
    appendix = '1'
): Promise<void> {
    const { deps, view } = ctx;
    const next_appendix = String(appendix || '1');

    if (view.audit_appendix_edit_component) {
        const same_appendix = view.audit_appendix_edit_appendix === next_appendix;
        if (same_appendix && container.children.length > 0) {
            return;
        }
        if (typeof view.audit_appendix_edit_component.destroy === 'function') {
            view.audit_appendix_edit_component.destroy();
        }
        view.audit_appendix_edit_component = null;
    }

    if (next_appendix === '2') {
        const { EditAuditAppendix2Component } = await import('./audit_actions/EditAuditAppendix2Component.js');
        const comp = new EditAuditAppendix2Component();
        await comp.init({ root: container, deps: deps as never });
        comp.render();
        view.audit_appendix_edit_component = comp;
        view.audit_appendix_edit_appendix = next_appendix;
        return;
    }

    if (next_appendix === '3') {
        const { EditAuditAppendix3Component } = await import('./audit_actions/EditAuditAppendix3Component.js');
        const comp = new EditAuditAppendix3Component();
        await comp.init({ root: container, deps: deps as never });
        comp.render();
        view.audit_appendix_edit_component = comp;
        view.audit_appendix_edit_appendix = next_appendix;
        return;
    }

    const { EditAuditAppendix1Component } = await import('./audit_actions/EditAuditAppendix1Component.js');
    const comp = new EditAuditAppendix1Component();
    await comp.init({ root: container, deps: deps as never });
    comp.render();
    view.audit_appendix_edit_component = comp;
    view.audit_appendix_edit_appendix = next_appendix;
}
