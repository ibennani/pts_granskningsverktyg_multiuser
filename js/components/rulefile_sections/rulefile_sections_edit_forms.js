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

    await EditGeneralSectionComponent.init({
        root: container,
        deps
    });

    EditGeneralSectionComponent.render();

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

    view.general_edit_component = EditGeneralSectionComponent;
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

    await EditPageTypesSectionComponent.init({
        root: container,
        deps
    });

    EditPageTypesSectionComponent.render();

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

    view.page_types_edit_component = EditPageTypesSectionComponent;
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
