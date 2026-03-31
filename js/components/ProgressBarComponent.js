import "./progress_bar_component.css";

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
