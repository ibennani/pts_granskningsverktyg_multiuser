// js/components/ProgressBarComponent.js
(function () { // IIFE start
    'use-strict';

    const CSS_PATH = 'css/components/progress_bar_component.css';
    let css_loaded = false;
    let created_instances = new Set(); // Track created instances for cleanup

    async function load_styles_if_needed() {
        if (!css_loaded && typeof window.Helpers !== 'undefined' && typeof window.Helpers.load_css === 'function') {
            if (!document.querySelector(`link[href="${CSS_PATH}"]`)) {
                try {
                    await window.Helpers.load_css(CSS_PATH);
                    css_loaded = true;
                } catch (error) {
                    console.warn("Failed to load CSS for ProgressBarComponent:", error);
                }
            } else {
                css_loaded = true; // Already in DOM
            }
        } else if (!css_loaded) { // Fallback if Helpers.load_css is not available but css_loaded is false
            console.warn("ProgressBarComponent: Helpers.load_css not available or CSS already loaded state unknown.");
        }
    }

    function create(current_value, max_value, options = {}) {
        load_styles_if_needed(); // Fire and forget CSS loading

        if (typeof window.Helpers === 'undefined' || typeof window.Helpers.create_element !== 'function') {
            console.error("ProgressBarComponent: Helpers.create_element not available!");
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
        
        // Add cleanup method to the wrapper element
        progress_wrapper._cleanup = function() {
            // Remove from tracking set
            created_instances.delete(progress_wrapper);
            // Clear any child elements
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
        // Set aria-valuemin, aria-valuemax, aria-valuenow for better accessibility with the native progress element
        progress_element_attributes['aria-valuemin'] = "0";
        progress_element_attributes['aria-valuemax'] = String(max_value);
        progress_element_attributes['aria-valuenow'] = String(current_value);


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

        // Track this instance for cleanup
        created_instances.add(progress_wrapper);

        return progress_wrapper;
    }
    
    function cleanup_all_instances() {
        // Clean up all tracked instances
        for (const instance of created_instances) {
            if (instance._cleanup) {
                instance._cleanup();
            }
        }
        created_instances.clear();
    }

    function reset_css_state() {
        css_loaded = false;
    }

    const public_api = {
        create,
        cleanup_all_instances,
        reset_css_state
    };

    // Expose the component to the global scope
    if (typeof window.ProgressBarComponent === 'undefined') {
        window.ProgressBarComponent = public_api;
    } else { // If re-running script for some reason, ensure it's updated.
        window.ProgressBarComponent = public_api;
    }

})(); // IIFE end