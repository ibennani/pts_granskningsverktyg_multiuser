import "./progress_bar_component.css";
import "./audit_status_stack_component.css";
import { format_nonzero_percent_suffix, format_overview_distribution_percent_suffix } from '../logic/audit_status_stack_labels.js';
import { get_status_icon } from './requirements_list/requirement_list_status_icons.js';

const audit_status_stack_segment_defs = [
    { field: 'passed', label_key: 'audit_status_passed', css_modifier: 'passed' },
    { field: 'partially_audited', label_key: 'audit_status_partially_audited', css_modifier: 'partially_audited' },
    { field: 'failed', label_key: 'audit_status_failed', css_modifier: 'failed' },
    { field: 'not_audited', label_key: 'audit_status_not_audited', css_modifier: 'not_audited' }
];

/** Granskningsöversikt: balksegment vänster→höger — underkänt, ingen anmärkning, delvis granskad, ogranskat/återstår */
const audit_status_stack_overview_segment_defs = [
    { field: 'failed', label_key: 'audit_status_failed', css_modifier: 'failed' },
    { field: 'passed', label_key: 'audit_status_passed', css_modifier: 'passed' },
    { field: 'partially_audited', label_key: 'audit_status_partially_audited', css_modifier: 'partially_audited' },
    { field: 'not_audited', label_key: 'audit_status_not_audited', css_modifier: 'not_audited' }
];

/** Minsta andel (%) för att ett färgsegment ska ritas i balken; under detta lämnas ytan som spårets bakgrund. */
const MIN_AUDIT_STATUS_BAR_SEGMENT_PERCENT = 0.1;

/**
 * @param {number} n
 * @param {number} total
 * @returns {boolean}
 */
function _should_render_audit_status_bar_segment(n, total) {
    if (total <= 0 || n <= 0) {
        return false;
    }
    const pct = (100 * n) / total;
    return pct + 1e-9 >= MIN_AUDIT_STATUS_BAR_SEGMENT_PERCENT;
}

/** Ordning och etiketter för granskningsöversiktens punktlista under balken (samma ordning som balksegmenten) */
const overview_distribution_defs = [
    { field: 'failed', label_key: 'audit_overview_distribution_failed' },
    { field: 'passed', label_key: 'audit_overview_distribution_passed' },
    { field: 'partially_audited', label_key: 'audit_overview_distribution_partial' },
    { field: 'not_audited', label_key: 'audit_overview_distribution_remaining' }
];

function _sanitize_status_counts(counts) {
    const passed = Math.max(0, Math.floor(Number(counts?.passed) || 0));
    const partially_audited = Math.max(0, Math.floor(Number(counts?.partially_audited) || 0));
    const failed = Math.max(0, Math.floor(Number(counts?.failed) || 0));
    const not_audited = Math.max(0, Math.floor(Number(counts?.not_audited) || 0));
    const sum = passed + partially_audited + failed + not_audited;
    return { passed, partially_audited, failed, not_audited, total: sum };
}

function _append_stack_track_segments(track_el, create_element, safe_counts) {
    const total = safe_counts.total;
    if (total <= 0) {
        return;
    }
    audit_status_stack_segment_defs.forEach((def) => {
        const n = safe_counts[def.field];
        if (!_should_render_audit_status_bar_segment(n, total)) {
            return;
        }
        const seg = create_element('div', {
            class_name: ['audit-status-stack__segment', `audit-status-stack__segment--${def.css_modifier}`]
        });
        seg.style.flexGrow = String(n);
        seg.style.flexBasis = '0';
        track_el.appendChild(seg);
    });
}

/** Översikt: segment endast om andel ≥ 0,1 %; annars ingen färgremsa i balken. */
function _append_overview_track_segments_four(track_el, create_element, safe_counts) {
    const total = safe_counts.total;
    if (total <= 0) {
        return;
    }
    audit_status_stack_overview_segment_defs.forEach((def) => {
        const n = safe_counts[def.field];
        if (!_should_render_audit_status_bar_segment(n, total)) {
            return;
        }
        const seg = create_element('div', {
            class_name: ['audit-status-stack__segment', `audit-status-stack__segment--${def.css_modifier}`]
        });
        const pct = (100 * n) / total;
        seg.style.flexGrow = '0';
        seg.style.flexShrink = '1';
        seg.style.flexBasis = `${pct}%`;
        seg.style.minWidth = '0';
        seg.style.boxSizing = 'border-box';
        track_el.appendChild(seg);
    });
}

function _append_stack_legend_items(ul_el, create_element, t, safe_counts, format_number_locally, lang_code) {
    const total = safe_counts.total;
    audit_status_stack_segment_defs.forEach((def) => {
        const n = safe_counts[def.field];
        if (n <= 0) {
            return;
        }
        const li = create_element('li');
        const label_span = create_element('span', {
            class_name: 'audit-status-stack__legend-label',
            text_content: `${t(def.label_key)}: `
        });
        li.appendChild(label_span);
        const pct_suffix = format_nonzero_percent_suffix(n, total, format_number_locally, lang_code) || '';
        li.appendChild(document.createTextNode(`${n}${pct_suffix}`));
        ul_el.appendChild(li);
    });
}

function _append_overview_distribution_list(ul_el, create_element, t, safe_counts, format_number_locally, lang_code) {
    const total = safe_counts.total;
    const count_unit = t('audit_overview_distribution_count_suffix', { defaultValue: '' });
    overview_distribution_defs.forEach((def) => {
        const n = safe_counts[def.field];
        const li = create_element('li', { class_name: 'audit-status-stack__distribution-item' });
        const status_kebab = def.field.replace(/_/g, '-');
        const icon_wrap = create_element('span', {
            class_name: 'audit-status-stack__distribution-icon',
            attributes: { 'aria-hidden': 'true' }
        });
        icon_wrap.appendChild(create_element('span', {
            class_name: `status-icon status-icon-${status_kebab}`,
            text_content: get_status_icon(def.field)
        }));
        li.appendChild(icon_wrap);
        const text_wrap = create_element('span', { class_name: 'audit-status-stack__distribution-text' });
        const label_span = create_element('span', {
            class_name: 'audit-status-stack__distribution-label',
            text_content: `${t(def.label_key)}: `
        });
        text_wrap.appendChild(label_span);
        const pct_suffix = format_overview_distribution_percent_suffix(n, total, format_number_locally, lang_code);
        text_wrap.appendChild(document.createTextNode(`${n}${count_unit}${pct_suffix}`));
        li.appendChild(text_wrap);
        ul_el.appendChild(li);
    });
}

function _build_overview_distribution_stack(create_element, t, safe_counts, ui_opts) {
    const {
        show_total_line,
        format_number_locally,
        lang_code,
        distribution_heading_id
    } = ui_opts;
    const root = create_element('div', {
        class_name: ['audit-status-stack', 'progress-bar-wrapper', 'audit-status-stack--overview']
    });
    if (show_total_line) {
        root.appendChild(create_element('p', {
            class_name: 'audit-status-stack__total',
            text_content: t('audit_status_assessments_total', {
                total: safe_counts.total,
                defaultValue: 'Krav-bedömningar totalt: {total}'
            })
        }));
    }
    const track = create_element('div', {
        class_name: 'audit-status-stack__track',
        attributes: { 'aria-hidden': 'true' }
    });
    _append_overview_track_segments_four(track, create_element, safe_counts);
    root.appendChild(track);

    const dist_heading_id = distribution_heading_id || 'audit-overview-distribution-heading';
    root.appendChild(create_element('h3', {
        class_name: 'audit-status-stack__distribution-title',
        attributes: { id: dist_heading_id },
        text_content: t('audit_overview_distribution_heading', { defaultValue: 'Fördelning av kontroller' })
    }));

    const ul = create_element('ul', {
        class_name: 'audit-status-stack__distribution-list',
        attributes: { 'aria-labelledby': dist_heading_id }
    });
    _append_overview_distribution_list(ul, create_element, t, safe_counts, format_number_locally, lang_code);
    root.appendChild(ul);
    return root;
}

function _build_audit_status_stack_root(create_element, t, safe, ui_opts) {
    const {
        variant,
        group_labelledby_id,
        show_total_line,
        format_number_locally,
        lang_code,
        overview_distribution_layout,
        distribution_heading_id
    } = ui_opts;
    if (overview_distribution_layout) {
        return _build_overview_distribution_stack(create_element, t, safe, {
            show_total_line,
            format_number_locally,
            lang_code,
            distribution_heading_id
        });
    }
    const outer_classes = ['audit-status-stack', 'progress-bar-wrapper'];
    if (variant === 'compact') {
        outer_classes.push('audit-status-stack--compact');
    }
    const root = create_element('div', { class_name: outer_classes });
    if (show_total_line) {
        root.appendChild(create_element('p', {
            class_name: 'audit-status-stack__total',
            text_content: t('audit_status_assessments_total', {
                total: safe.total,
                defaultValue: 'Krav-bedömningar totalt: {total}'
            })
        }));
    }
    const group_attrs = { role: 'group' };
    if (group_labelledby_id) {
        group_attrs['aria-labelledby'] = group_labelledby_id;
    } else {
        group_attrs['aria-label'] = t('audit_status_distribution_region_label', {
            defaultValue: 'Kravstatusfördelning'
        });
    }
    const group = create_element('div', {
        class_name: 'audit-status-stack__group',
        attributes: group_attrs
    });
    const track = create_element('div', {
        class_name: 'audit-status-stack__track',
        attributes: { 'aria-hidden': 'true' }
    });
    _append_stack_track_segments(track, create_element, safe);
    group.appendChild(track);
    const legend = create_element('ul', { class_name: 'audit-status-stack__legend' });
    _append_stack_legend_items(legend, create_element, t, safe, format_number_locally, lang_code);
    group.appendChild(legend);
    root.appendChild(group);
    return root;
}

export class ProgressBarComponent {
    static created_instances = new Set();
    static css_loaded = false;

    static async load_styles_if_needed() {
        if (!ProgressBarComponent.css_loaded && typeof window.Helpers !== 'undefined' && typeof window.Helpers.load_css === 'function') {
            if (!document.querySelector(`link[href$="progress_bar_component.css"]`)) {
                try {
                    await window.Helpers.load_css('./progress_bar_component.css');
                    ProgressBarComponent.css_loaded = true;
                } catch (error) {
                    console.warn("Failed to load CSS for ProgressBarComponent:", error);
                }
            } else {
                ProgressBarComponent.css_loaded = true; // Already in DOM
            }
        } else if (!ProgressBarComponent.css_loaded) {
            // Fallback or ignore
        }
    }

    static create(current_value, max_value, options = {}) {
        ProgressBarComponent.load_styles_if_needed();

        if (typeof window.Helpers === 'undefined' || typeof window.Helpers.create_element !== 'function') {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn("ProgressBarComponent: Helpers.create_element not available!");
            const fallback_progress = document.createElement('div');
            const t = (typeof window.Translation !== 'undefined' && typeof window.Translation.t === 'function')
                ? window.Translation.t
                : (key, rep) => (rep && rep.defaultValue ? rep.defaultValue : key);
            fallback_progress.textContent = t('progress_bar_fallback_text', { current: current_value, max: max_value });
            return fallback_progress;
        }

        const { create_element } = window.Helpers;
        const t = (typeof window.Translation !== 'undefined' && typeof window.Translation.t === 'function')
            ? window.Translation.t
            : (key, rep) => (rep && rep.defaultValue ? rep.defaultValue : key);

        const progress_wrapper = create_element('div', { class_name: 'progress-bar-wrapper' });

        progress_wrapper._cleanup = function () {
            ProgressBarComponent.created_instances.delete(progress_wrapper);
            while (progress_wrapper.firstChild) {
                progress_wrapper.removeChild(progress_wrapper.firstChild);
            }
        };

        const progress_element_attributes = {
            value: String(current_value),
            max: String(max_value),
            'aria-label': options.label || t('progress_bar_label', { defaultValue: 'Progress' })
        };
        if (options.id) {
            progress_element_attributes.id = options.id;
        }
        progress_element_attributes['aria-valuemin'] = "0";
        progress_element_attributes['aria-valuemax'] = String(max_value);
        progress_element_attributes['aria-valuenow'] = String(current_value);
        progress_element_attributes['aria-hidden'] = 'true';

        const progress_element = create_element('progress', {
            class_name: 'progress-bar-element',
            attributes: progress_element_attributes
        });

        progress_wrapper.appendChild(progress_element);

        if (options.show_text || options.show_percentage) {
            let text_content_val = '';
            if (options.show_text) {
                text_content_val = `${current_value} / ${max_value}`;
            } else if (options.show_percentage) {
                const percentage = max_value > 0 ? Math.round((current_value / max_value) * 100) : 0;
                text_content_val = `${percentage}%`;
            }
            const progress_text = create_element('span', {
                class_name: 'progress-bar-text',
                text_content: text_content_val
            });
            if (options.text_sr_only) {
                progress_text.classList.add('visually-hidden');
            }
            progress_wrapper.appendChild(progress_text);
        }

        ProgressBarComponent.created_instances.add(progress_wrapper);

        return progress_wrapper;
    }

    /**
     * Staplad statusbalk + lista (endast rader med antal > 0). Spåret är dekorativt (aria-hidden).
     * @param {object} options
     * @param {object} options.counts — passed, partially_audited, failed, not_audited, total
     * @param {function} options.t — översättning
     * @param {function} options.create_element — Helpers.create_element
     * @param {function} options.format_number_locally
     * @param {string} options.lang_code
     * @param {string} [options.variant] — 'default' | 'compact'
     * @param {string|null} [options.group_labelledby_id]
     * @param {boolean} [options.show_total_line]
     * @param {boolean} [options.overview_distribution_layout] — granskningsöversikt: h3 Fördelning + punktlista, balk utan inner group
     * @param {string|null} [options.distribution_heading_id] — id för h3 Fördelning
     */
    static create_audit_status_stack(options = {}) {
        ProgressBarComponent.load_styles_if_needed();

        const {
            counts,
            t,
            create_element,
            format_number_locally,
            lang_code = 'sv-SE',
            variant = 'default',
            group_labelledby_id = null,
            show_total_line = true,
            overview_distribution_layout = false,
            distribution_heading_id = null
        } = options;

        if (typeof create_element !== 'function' || typeof t !== 'function') {
            const fallback = document.createElement('div');
            fallback.textContent = typeof t === 'function'
                ? t('audit_status_stack_fallback', { defaultValue: 'Kunde inte visa statusfördelning.' })
                : 'Kunde inte visa statusfördelning.';
            return fallback;
        }

        const safe = _sanitize_status_counts(counts);
        return _build_audit_status_stack_root(create_element, t, safe, {
            variant,
            group_labelledby_id,
            show_total_line,
            format_number_locally,
            lang_code,
            overview_distribution_layout,
            distribution_heading_id
        });
    }

    static cleanup_all_instances() {
        for (const instance of ProgressBarComponent.created_instances) {
            if (instance._cleanup) {
                instance._cleanup();
            }
        }
        ProgressBarComponent.created_instances.clear();
    }

    static reset_css_state() {
        ProgressBarComponent.css_loaded = false;
    }
}
