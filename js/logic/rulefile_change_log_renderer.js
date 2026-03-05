'use-strict';

/**
 * Renderar en ändringslogg för regelfilsuppdatering med tre accordeoner:
 * - Nya krav
 * - Borttagna krav
 * - Uppdaterade krav
 *
 * @param {Object} params
 * @param {HTMLElement} params.container - Elementet där loggen ska renderas.
 * @param {function} params.t - Översättningsfunktion.
 * @param {Object} params.Helpers - Hjälpobjekt med create_element, escape_html, get_icon_svg m.m.
 * @param {Object} params.report - Rapport från analyze_rule_file_changes.
 * @param {Object} params.old_requirements - Krav från gamla regelfilen (key -> kravobjekt).
 * @param {Object} params.new_requirements - Krav från nya regelfilen (key -> kravobjekt).
 */
export function render_rulefile_change_log(params) {
    const {
        container,
        t,
        Helpers,
        report,
        old_requirements,
        new_requirements
    } = params || {};

    if (!container || !Helpers?.create_element || !report) return;

    const old_reqs = old_requirements || {};
    const new_reqs = new_requirements || {};

    const added_requirements = Array.isArray(report.added_requirements) ? report.added_requirements : [];
    const removed_requirements = Array.isArray(report.removed_requirements) ? report.removed_requirements : [];
    const updated_requirements = Array.isArray(report.updated_requirements) ? report.updated_requirements : [];

    const create_accordion = (title_text, count, build_content_fn) => {
        const section = Helpers.create_element('section', { class_name: 'rulefile-change-log__accordion' });

        const header_button = Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'rulefile-change-log__accordion-header'],
            text_content: `${title_text} (${count})`
        });

        const content = Helpers.create_element('div', {
            class_name: 'rulefile-change-log__accordion-content'
        });
        content.style.display = 'none';

        header_button.addEventListener('click', () => {
            const is_hidden = content.style.display === 'none';
            content.style.display = is_hidden ? '' : 'none';
        });

        section.appendChild(header_button);
        build_content_fn(content);
        section.appendChild(content);

        container.appendChild(section);
    };

    const build_added_content = (parent) => {
        if (added_requirements.length === 0) {
            parent.appendChild(Helpers.create_element('p', {
                class_name: 'text-muted',
                text_content: t('no_items_in_category')
            }));
            return;
        }

        const ul = Helpers.create_element('ul', { class_name: 'rulefile-change-log__list' });
        added_requirements.forEach((item) => {
            const li = Helpers.create_element('li', { class_name: 'rulefile-change-log__item' });
            const req_def = new_reqs[item.id] || {};
            const ref_text = req_def?.standardReference?.text;
            let heading_text = item.title || item.id;
            if (ref_text) {
                heading_text += ` (${ref_text})`;
            }
            const h4 = Helpers.create_element('h4', { text_content: heading_text });
            li.appendChild(h4);

            const content_type = req_def?.contentType || null;
            if (content_type) {
                li.appendChild(Helpers.create_element('p', {
                    class_name: 'text-muted',
                    text_content: `${t('content_types')}: ${content_type}`
                }));
            }

            ul.appendChild(li);
        });

        parent.appendChild(ul);
    };

    const build_removed_content = (parent) => {
        if (removed_requirements.length === 0) {
            parent.appendChild(Helpers.create_element('p', {
                class_name: 'text-muted',
                text_content: t('no_items_in_category')
            }));
            return;
        }

        const ul = Helpers.create_element('ul', { class_name: 'rulefile-change-log__list' });
        removed_requirements.forEach((item) => {
            const li = Helpers.create_element('li', { class_name: 'rulefile-change-log__item' });
            const req_def = old_reqs[item.id] || {};
            const ref_text = req_def?.standardReference?.text;
            let heading_text = item.title || item.id;
            if (ref_text) {
                heading_text += ` (${ref_text})`;
            }
            const h4 = Helpers.create_element('h4', { text_content: heading_text });
            li.appendChild(h4);
            ul.appendChild(li);
        });

        parent.appendChild(ul);
    };

    const build_updated_content = (parent) => {
        if (updated_requirements.length === 0) {
            parent.appendChild(Helpers.create_element('p', {
                class_name: 'text-muted',
                text_content: t('no_items_in_category')
            }));
            return;
        }

        const ul = Helpers.create_element('ul', { class_name: 'rulefile-change-log__list' });

        updated_requirements.forEach((item) => {
            const li = Helpers.create_element('li', { class_name: 'rulefile-change-log__item' });
            const old_req_def = old_reqs[item.id] || {};
            const new_req_def = new_reqs[item.id] || {};
            const ref_text = (new_req_def.standardReference || old_req_def.standardReference || {})?.text;

            let heading_text = item.title || item.id;
            if (ref_text) {
                heading_text += ` (${ref_text})`;
            }

            li.appendChild(Helpers.create_element('h4', { text_content: heading_text }));

            li.appendChild(Helpers.create_element('p', {
                class_name: 'text-muted',
                text_content: t('update_rulefile_change_log_requirement_changed')
            }));

            const pc_changes = item.passCriteriaChanges || {};
            const added_checks = Array.isArray(pc_changes.addedChecks) ? pc_changes.addedChecks : [];
            const added_pcs = Array.isArray(pc_changes.added) ? pc_changes.added : [];
            const updated_pcs = Array.isArray(pc_changes.updated) ? pc_changes.updated : [];

            if (added_checks.length > 0) {
                const heading = Helpers.create_element('h5', { text_content: t('update_rulefile_change_log_new_checks_heading') });
                li.appendChild(heading);
                const checks_ul = Helpers.create_element('ul', { class_name: 'rulefile-change-log__sublist' });
                added_checks.forEach((check_id) => {
                    checks_ul.appendChild(Helpers.create_element('li', {
                        text_content: String(check_id)
                    }));
                });
                li.appendChild(checks_ul);
            }

            if (added_pcs.length > 0) {
                const heading = Helpers.create_element('h5', { text_content: t('update_rulefile_change_log_new_pass_criteria_heading') });
                li.appendChild(heading);
                const pcs_ul = Helpers.create_element('ul', { class_name: 'rulefile-change-log__sublist' });
                added_pcs.forEach((pc) => {
                    pcs_ul.appendChild(Helpers.create_element('li', {
                        text_content: pc.text || ''
                    }));
                });
                li.appendChild(pcs_ul);
            }

            if (updated_pcs.length > 0) {
                const heading = Helpers.create_element('h5', { text_content: t('update_rulefile_change_log_updated_pass_criteria_heading') });
                li.appendChild(heading);
                const pcs_ul = Helpers.create_element('ul', { class_name: 'rulefile-change-log__sublist' });
                updated_pcs.forEach((pc) => {
                    pcs_ul.appendChild(Helpers.create_element('li', {
                        text_content: pc.text || ''
                    }));
                });
                li.appendChild(pcs_ul);
            }

            ul.appendChild(li);
        });

        parent.appendChild(ul);
    };

    create_accordion(
        t('update_rulefile_change_log_section_added'),
        added_requirements.length,
        build_added_content
    );

    create_accordion(
        t('update_rulefile_change_log_section_removed'),
        removed_requirements.length,
        build_removed_content
    );

    create_accordion(
        t('update_rulefile_change_log_section_updated'),
        updated_requirements.length,
        build_updated_content
    );
}

