/**
 * @fileoverview Redigeringsformulär för regelfilssektioner (inline-init).
 */

/**
 * @param {{ deps: object, view: object }} ctx
 * @param {HTMLElement} container
 * @param {object} _metadata
 */
export async function render_rulefile_general_edit_form(ctx, container, _metadata) {
    const { deps, view } = ctx;
    const is_first_render = !view.general_edit_component;

    if (view.general_edit_component && container.children.length > 0) {
        return;
    }

    const { EditGeneralSectionComponent } = await import('../EditGeneralSectionComponent.js');

    const comp = new EditGeneralSectionComponent();

    await comp.init({
        root: container,
        deps
    });

    comp.render();

    if (is_first_render && !view.general_form_initial_focus_set) {
        setTimeout(() => {
            const firstH2 = container.querySelector('h2');
            if (firstH2) {
                firstH2.setAttribute('tabindex', '-1');
                firstH2.focus();
                view.general_form_initial_focus_set = true;
            }
        }, 100);
    }

    view.general_edit_component = comp;
}

/**
 * @param {{ deps: object, view: object }} ctx
 * @param {HTMLElement} container
 * @param {object} _metadata
 */
export async function render_rulefile_page_types_edit_form(ctx, container, _metadata) {
    const { deps, view } = ctx;
    const is_first_render = !view.page_types_edit_component;

    if (view.page_types_edit_component && container.children.length > 0) {
        return;
    }

    const { EditPageTypesSectionComponent } = await import('../EditPageTypesSectionComponent.js');

    const comp = new EditPageTypesSectionComponent();

    await comp.init({
        root: container,
        deps
    });

    comp.render();

    if (is_first_render && !view.page_types_form_initial_focus_set) {
        setTimeout(() => {
            const firstH2 = container.querySelector('h2');
            if (firstH2) {
                firstH2.setAttribute('tabindex', '-1');
                firstH2.focus();
                view.page_types_form_initial_focus_set = true;
            }
        }, 100);
    }

    view.page_types_edit_component = comp;
}

/**
 * @param {{ deps: object, view: object }} ctx
 * @param {HTMLElement} container
 * @param {object} _metadata
 */
export async function render_rulefile_content_types_edit_form(ctx, container, _metadata) {
    const { deps, view } = ctx;
    const is_first_render = !view.content_types_edit_component;

    if (view.content_types_edit_component && container.children.length > 0) {
        return;
    }

    const { EditContentTypesSectionComponent } = await import('../EditContentTypesSectionComponent.js');

    await EditContentTypesSectionComponent.init({
        root: container,
        deps
    });

    EditContentTypesSectionComponent.render();

    if (is_first_render && !view.content_types_form_initial_focus_set) {
        setTimeout(() => {
            const firstH2 = container.querySelector('h2');
            if (firstH2) {
                firstH2.setAttribute('tabindex', '-1');
                firstH2.focus();
                view.content_types_form_initial_focus_set = true;
            }
        }, 100);
    }

    view.content_types_edit_component = EditContentTypesSectionComponent;
}

/**
 * @param {{ deps: object, view: object }} ctx
 * @param {HTMLElement} container
 * @param {object} _metadata
 */
export async function render_rulefile_info_blocks_edit_form(ctx, container, _metadata) {
    const { deps, view } = ctx;

    if (view.info_blocks_edit_component && container.children.length > 0) {
        return;
    }

    const { EditInfoBlocksSectionComponent } = await import('../EditInfoBlocksSectionComponent.js');

    await EditInfoBlocksSectionComponent.init({
        root: container,
        deps
    });

    EditInfoBlocksSectionComponent.render();

    view.info_blocks_edit_component = EditInfoBlocksSectionComponent;
}

/**
 * @param {{ deps: object, view: object }} ctx
 * @param {HTMLElement} container
 * @param {object} _metadata
 */
export async function render_rulefile_classifications_edit_form(ctx, container, _metadata, part = '') {
    const { deps, view } = ctx;
    const next_part = String(part || deps.params?.part || '').trim();
    const next_taxonomy_id = String(deps.params?.taxonomyId ?? '').trim();

    if (view.classifications_edit_component) {
        const same_part = view.classifications_edit_part === next_part;
        const same_taxonomy = (view.classifications_edit_taxonomy_id || '') === next_taxonomy_id;
        if (same_part && same_taxonomy && container.children.length > 0) {
            return;
        }
        view.classifications_edit_component.skip_autosave_on_destroy = true;
        view.classifications_edit_component.destroy();
        view.classifications_edit_component = null;
    }

    const { EditRulefileClassificationsComponent } = await import('./EditRulefileClassificationsComponent.js');
    const comp = new EditRulefileClassificationsComponent();
    await comp.init({
        root: container,
        deps: {
            ...deps,
            params: { ...(deps.params || {}), part: next_part },
        },
    });
    comp.render();
    view.classifications_edit_component = comp;
    view.classifications_edit_part = next_part;
    view.classifications_edit_taxonomy_id = next_taxonomy_id;
}

/**
 * @param {{ deps: object, view: object }} ctx
 * @param {HTMLElement} container
 * @param {object} ruleFileContent
 */
export async function render_rulefile_report_template_edit_form(ctx, container, ruleFileContent, appendix = '1') {
    const { deps, view } = ctx;
    const next_appendix = String(appendix || '1');

    if (view.report_template_edit_component) {
        const same_appendix = view.report_template_edit_appendix === next_appendix;
        if (same_appendix && container.children.length > 0) {
            return;
        }
        if (typeof view.report_template_edit_component.destroy === 'function') {
            view.report_template_edit_component.destroy();
        }
        view.report_template_edit_component = null;
    }

    if (next_appendix === '2') {
        const { EditReportTemplateAppendix2Component } = await import('./EditReportTemplateAppendix2Component.js');
        const comp = new EditReportTemplateAppendix2Component();
        await comp.init({ root: container, deps });
        comp.render();
        view.report_template_edit_component = comp;
        view.report_template_edit_appendix = next_appendix;
        return;
    }

    if (next_appendix === '3') {
        const { EditReportTemplateAppendix3Component } = await import('./EditReportTemplateAppendix3Component.js');
        const comp = new EditReportTemplateAppendix3Component();
        await comp.init({ root: container, deps });
        comp.render();
        view.report_template_edit_component = comp;
        view.report_template_edit_appendix = next_appendix;
        return;
    }

    const { EditReportTemplateAppendix1Component } = await import('./EditReportTemplateAppendix1Component.js');
    const comp = new EditReportTemplateAppendix1Component();
    await comp.init({ root: container, deps });
    comp.render();
    view.report_template_edit_component = comp;
    view.report_template_edit_appendix = next_appendix;
}
