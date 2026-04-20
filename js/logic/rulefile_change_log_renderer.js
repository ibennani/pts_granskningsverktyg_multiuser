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

    let accordion_auto_id = 0;
    const next_accordion_id = () => {
        accordion_auto_id += 1;
        return `rulefile-change-log-acc-${accordion_auto_id}`;
    };

    const get_text = (val) => (val === null || val === undefined ? '' : String(val)).trim();
    const get_check_human_label = (check_obj) => {
        if (!check_obj || typeof check_obj !== 'object') return '';
        // Prioritera villkor/condition eftersom det brukar vara det användaren känner igen.
        const condition = get_text(check_obj.condition);
        if (condition) return condition;
        const title = get_text(check_obj.title);
        if (title) return title;
        const req_text = get_text(check_obj.requirement);
        if (req_text) return req_text;
        return '';
    };
    const get_added_check_labels_for_requirement = (req_def, added_check_ids) => {
        const out = [];
        const checks = Array.isArray(req_def?.checks) ? req_def.checks : [];
        const id_to_check = new Map();
        checks.forEach((c) => {
            const id = get_text(c?.id || c?.key);
            if (id) id_to_check.set(id, c);
        });
        (added_check_ids || []).forEach((check_id) => {
            const c = id_to_check.get(get_text(check_id)) || null;
            const label = get_check_human_label(c);
            if (label) {
                out.push(label);
            } else {
                // Undvik tekniska id:n i UI.
                out.push(t('update_rulefile_change_log_new_check_fallback'));
            }
        });
        // Rensa dubbletter utan att förstöra ordningen.
        const seen = new Set();
        return out.filter((x) => {
            const k = get_text(x);
            if (!k || seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    };

    const stable_json = (obj) => {
        try {
            return JSON.stringify(obj === undefined ? null : obj);
        } catch {
            return '';
        }
    };

    const summarize_requirement_changes = (old_req_def, new_req_def) => {
        const changes = [];
        if (get_text(old_req_def?.title) !== get_text(new_req_def?.title)) changes.push(t('update_rulefile_change_log_changed_title'));
        if (stable_json(old_req_def?.standardReference) !== stable_json(new_req_def?.standardReference)) changes.push(t('update_rulefile_change_log_changed_reference'));
        if (stable_json(old_req_def?.contentType) !== stable_json(new_req_def?.contentType)) changes.push(t('update_rulefile_change_log_changed_content_type'));
        if (stable_json(old_req_def?.expectedObservation) !== stable_json(new_req_def?.expectedObservation)) changes.push(t('update_rulefile_change_log_changed_expected_observation'));
        if (stable_json(old_req_def?.instructions) !== stable_json(new_req_def?.instructions)) changes.push(t('update_rulefile_change_log_changed_instructions'));
        if (stable_json(old_req_def?.tips) !== stable_json(new_req_def?.tips)) changes.push(t('update_rulefile_change_log_changed_tips'));
        if (stable_json(old_req_def?.exceptions) !== stable_json(new_req_def?.exceptions)) changes.push(t('update_rulefile_change_log_changed_exceptions'));
        if (stable_json(old_req_def?.commonErrors) !== stable_json(new_req_def?.commonErrors)) changes.push(t('update_rulefile_change_log_changed_common_errors'));
        if (stable_json(old_req_def?.examples) !== stable_json(new_req_def?.examples)) changes.push(t('update_rulefile_change_log_changed_examples'));
        if (stable_json(old_req_def?.checks) !== stable_json(new_req_def?.checks)) changes.push(t('update_rulefile_change_log_changed_checks'));
        if (stable_json(old_req_def?.metadata) !== stable_json(new_req_def?.metadata)) changes.push(t('update_rulefile_change_log_changed_other'));

        // Fallback om vi inte kan identifiera något fält (ska vara ovanligt).
        return changes.length ? changes : [t('update_rulefile_change_log_changed_other')];
    };

    const create_accordion = (title_text, count, build_content_fn) => {
        const section = Helpers.create_element('section', { class_name: 'rulefile-change-log__accordion' });
        const base_id = next_accordion_id();
        const header_id = `${base_id}-header`;
        const content_id = `${base_id}-content`;

        const header_button = Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'rulefile-change-log__accordion-header'],
            attributes: {
                type: 'button',
                id: header_id,
                'aria-controls': content_id,
                'aria-expanded': 'false'
            }
        });

        const content = Helpers.create_element('div', {
            class_name: 'rulefile-change-log__accordion-content',
            attributes: {
                id: content_id,
                role: 'region',
                'aria-labelledby': header_id
            }
        });
        // Rullgardinsanimation: vi styr max-height i JS (se click handler).
        content.style.maxHeight = '0px';

        const header_inner = Helpers.create_element('span', { class_name: 'rulefile-change-log__accordion-header-inner' });
        const header_title = Helpers.create_element('span', {
            class_name: 'rulefile-change-log__accordion-title',
            text_content: title_text
        });
        const header_count = Helpers.create_element('span', {
            class_name: 'rulefile-change-log__accordion-count',
            text_content: `(${count})`
        });
        const chevron = Helpers.create_element('span', {
            class_name: 'rulefile-change-log__accordion-chevron',
            attributes: { 'aria-hidden': 'true' }
        });
        header_inner.append(header_title, header_count, chevron);
        header_button.appendChild(header_inner);

        const content_inner = Helpers.create_element('div', { class_name: 'rulefile-change-log__accordion-content-inner' });
        content.appendChild(content_inner);

        header_button.addEventListener('click', () => {
            const is_open = section.classList.contains('rulefile-change-log__accordion--open');
            header_button.setAttribute('aria-expanded', is_open ? 'false' : 'true');
            if (!is_open) {
                section.classList.add('rulefile-change-log__accordion--open');
                // Expandera mjukt till content_inner höjd.
                const h = content_inner.scrollHeight;
                content.style.maxHeight = `${h}px`;
            } else {
                section.classList.remove('rulefile-change-log__accordion--open');
                content.style.maxHeight = '0px';
            }
        });

        section.appendChild(header_button);
        build_content_fn(content_inner);
        section.appendChild(content);

        container.appendChild(section);
    };

    const create_requirement_heading_text = (title, ref_text) => {
        const base = get_text(title) || '';
        const ref = get_text(ref_text);
        if (base && ref) return `${base} (${ref})`;
        return base || ref || '';
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
            const heading_text = create_requirement_heading_text(item.title || item.id, ref_text);
            const h4 = Helpers.create_element('h4', { class_name: 'rulefile-change-log__req-title', text_content: heading_text });
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
            const heading_text = create_requirement_heading_text(item.title || item.id, ref_text);
            const h4 = Helpers.create_element('h4', { class_name: 'rulefile-change-log__req-title', text_content: heading_text });
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

            const heading_text = create_requirement_heading_text(item.title || item.id, ref_text);
            const article = Helpers.create_element('article', { class_name: 'rulefile-change-log__req' });
            article.appendChild(Helpers.create_element('h4', { class_name: 'rulefile-change-log__req-title', text_content: heading_text }));
            const summary_p = Helpers.create_element('p', {
                class_name: 'rulefile-change-log__req-summary',
                text_content: t('update_rulefile_change_log_requirement_changed')
            });
            article.appendChild(summary_p);

            const pc_changes = item.passCriteriaChanges || {};
            const added_checks = Array.isArray(pc_changes.addedChecks) ? pc_changes.addedChecks : [];
            const added_pcs = Array.isArray(pc_changes.added) ? pc_changes.added : [];
            const updated_pcs = Array.isArray(pc_changes.updated) ? pc_changes.updated : [];

            // Extra info om vad som ändrats (framförallt när passCriteriaChanges är tomt)
            const change_labels = summarize_requirement_changes(old_req_def, new_req_def);
            if (Array.isArray(change_labels) && change_labels.length > 0) {
                const hint = Helpers.create_element('p', {
                    class_name: 'rulefile-change-log__req-hint',
                    text_content: `${t('update_rulefile_change_log_changed_parts_prefix')} ${change_labels.join(', ')}.`
                });
                article.appendChild(hint);
            }

            if (added_checks.length > 0) {
                const heading = Helpers.create_element('h5', { class_name: 'rulefile-change-log__subheading', text_content: t('update_rulefile_change_log_new_checks_heading') });
                const checks_ul = Helpers.create_element('ul', { class_name: 'rulefile-change-log__sublist' });
                const labels = get_added_check_labels_for_requirement(new_req_def || old_req_def, added_checks);
                labels.forEach((label) => {
                    checks_ul.appendChild(Helpers.create_element('li', { text_content: label }));
                });
                const block = Helpers.create_element('section', { class_name: 'rulefile-change-log__change-block' });
                block.append(heading, checks_ul);
                article.appendChild(block);
            }

            if (added_pcs.length > 0) {
                const heading = Helpers.create_element('h5', { class_name: 'rulefile-change-log__subheading', text_content: t('update_rulefile_change_log_new_pass_criteria_heading') });
                const pcs_ul = Helpers.create_element('ul', { class_name: 'rulefile-change-log__sublist' });
                added_pcs.forEach((pc) => {
                    const txt = get_text(pc?.text);
                    if (!txt) return;
                    pcs_ul.appendChild(Helpers.create_element('li', { text_content: txt }));
                });
                const block = Helpers.create_element('section', { class_name: 'rulefile-change-log__change-block' });
                block.append(heading, pcs_ul);
                article.appendChild(block);
            }

            if (updated_pcs.length > 0) {
                const heading = Helpers.create_element('h5', { class_name: 'rulefile-change-log__subheading', text_content: t('update_rulefile_change_log_updated_pass_criteria_heading') });
                const pcs_ul = Helpers.create_element('ul', { class_name: 'rulefile-change-log__sublist' });
                updated_pcs.forEach((pc) => {
                    const txt = get_text(pc?.text);
                    if (!txt) return;
                    pcs_ul.appendChild(Helpers.create_element('li', { text_content: txt }));
                });
                const block = Helpers.create_element('section', { class_name: 'rulefile-change-log__change-block' });
                block.append(heading, pcs_ul);
                article.appendChild(block);
            }

            li.appendChild(article);
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

