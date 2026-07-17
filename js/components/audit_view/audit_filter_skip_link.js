/**
 * @fileoverview Skiplänk till sökfältet i granskningslistan.
 */

/**
 * @param {object} ctx AuditViewComponent-kontext
 * @returns {HTMLAnchorElement}
 */
export function create_audit_filter_skip_link(ctx) {
    const t = ctx.get_t_func();
    const link = ctx.Helpers.create_element('a', {
        class_name: ['skip-link', 'skip-link--audit-filter'],
        attributes: { href: '#audit-filter-input' },
        text_content: t('skip_to_audit_search')
    });
    link.addEventListener('click', ctx.handle_skip_to_audit_filter);
    return link;
}
