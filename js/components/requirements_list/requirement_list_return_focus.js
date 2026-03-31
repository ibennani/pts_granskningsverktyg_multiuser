/**
 * Återställer fokus till en kravrad efter navigering tillbaka till listan.
 * @module js/components/requirements_list/requirement_list_return_focus
 */

/**
 * @param {HTMLElement|null|undefined} content_div_for_delegation
 * @param {string|null|undefined} return_focus_session_key
 * @param {string} mode
 * @param {string|null|undefined} params_sample_id
 */
export function apply_return_focus_if_needed(content_div_for_delegation, return_focus_session_key, mode, params_sample_id) {
    if (!content_div_for_delegation) return;
    if (!window.sessionStorage || !return_focus_session_key) return;

    let raw = null;
    try {
        raw = window.sessionStorage.getItem(return_focus_session_key);
    } catch (e) {
        return;
    }
    if (!raw) return;

    let focus_instruction = null;
    try {
        focus_instruction = JSON.parse(raw);
    } catch (e) {
        try {
            window.sessionStorage.removeItem(return_focus_session_key);
        } catch (_) {
            // ignoreras medvetet
        }
        return;
    }

    const requirement_id = focus_instruction?.requirementId || null;
    const sample_id = focus_instruction?.sampleId || null;

    try {
        window.sessionStorage.removeItem(return_focus_session_key);
    } catch (_) {
        // ignoreras medvetet
    }

    if (!requirement_id || !sample_id) return;

    let target_link = null;
    if (mode === 'all') {
        target_link = content_div_for_delegation.querySelector(
            `a.list-title-link[data-requirement-id="${CSS.escape(String(requirement_id))}"][data-sample-id="${CSS.escape(String(sample_id))}"]`
        );
    } else {
        const current_sample_id = params_sample_id || null;
        if (String(sample_id) !== String(current_sample_id)) return;
        target_link = content_div_for_delegation.querySelector(
            `a.list-title-link[data-requirement-id="${CSS.escape(String(requirement_id))}"]`
        );
    }
    if (!target_link) return;

    window.customFocusApplied = true;

    const top_action_bar = document.getElementById('global-action-bar-top');
    const top_bar_height = top_action_bar ? top_action_bar.offsetHeight : 0;

    const element_rect = target_link.getBoundingClientRect();
    const absolute_element_top = element_rect.top + window.pageYOffset;
    const scroll_position = absolute_element_top - top_bar_height;

    window.scrollTo({ top: scroll_position, behavior: 'smooth' });

    const content_div = content_div_for_delegation;
    requestAnimationFrame(() => {
        setTimeout(() => {
            if (!content_div || !document.contains(content_div)) return;
            let link = null;
            if (mode === 'all') {
                link = content_div.querySelector(
                    `a.list-title-link[data-requirement-id="${CSS.escape(String(requirement_id))}"][data-sample-id="${CSS.escape(String(sample_id))}"]`
                );
            } else {
                if (String(sample_id) !== String(params_sample_id || null)) return;
                link = content_div.querySelector(
                    `a.list-title-link[data-requirement-id="${CSS.escape(String(requirement_id))}"]`
                );
            }
            if (link && document.contains(link)) {
                try {
                    link.focus({ preventScroll: true });
                } catch (e) {
                    link.focus();
                }
            }
        }, 300);
    });
}
