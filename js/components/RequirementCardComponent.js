
export const RequirementCardComponent = {
    // Cache for CSS loading state
    css_loaded: false,
    CSS_PATH: 'css/components/requirement_card_component.css',

    /**
     * Creates a requirement card element.
     * 
     * @param {Object} requirement - The requirement object
     * @param {string} sample_id - The ID of the current sample
     * @param {string} requirement_status - The status of the requirement (e.g., 'passed', 'failed', 'not_audited')
     * @param {Function} router_cb - Callback function for routing (router(view, params))
     * @param {Object} [options] - Optional dependencies and configuration
     * @param {Object} [options.deps] - Dependencies (Translation, Helpers)
     * @returns {HTMLElement} The list item element representing the card
     */
    create(requirement, sample_id, requirement_status, router_cb, options = {}) {
        // Dependencies resolution with window fallback for compatibility
        const deps = options.deps || {};
        const Helpers = deps.Helpers || window.Helpers;
        const Translation = deps.Translation || window.Translation;

        // Check for required dependencies
        if (!Helpers || typeof Helpers.create_element !== 'function') {
            console.error("RequirementCardComponent: Helpers.create_element not available!");
            const el = document.createElement('li');
            el.textContent = `Error: Helpers missing for ${requirement?.title || 'Unknown Requirement'}`;
            return el;
        }

        const t = (Translation && typeof Translation.t === 'function')
            ? Translation.t
            : (key, replacements) => {
                let str = replacements && replacements.defaultValue ? replacements.defaultValue : `**${key}**`;
                if (replacements && !replacements.defaultValue) {
                    for (const rKey in replacements) {
                        str += ` (${rKey}: ${replacements[rKey]})`;
                    }
                }
                return str + " (ReqCard t not found)";
            };

        // Load CSS if needed
        this.load_styles_if_needed(Helpers);

        const create_element = Helpers.create_element;
        const add_protocol_if_missing = Helpers.add_protocol_if_missing || ((url) => url);

        const card_li = create_element('li', { class_name: 'requirement-card' });
        const card_content_wrapper = create_element('div', { class_name: 'requirement-card-inner-content' });

        const indicator = create_element('span', {
            class_name: ['status-indicator', `status-${requirement_status}`],
            attributes: { 'aria-hidden': 'true' } // Decorative
        });
        card_content_wrapper.appendChild(indicator);

        const text_content_div = create_element('div', { class_name: 'requirement-card-text-content' });

        const title_h_container = create_element('h3', { class_name: 'requirement-card-title-container' });
        const title_button = create_element('button', {
            class_name: 'requirement-card-title-button',
            text_content: requirement.title
        });
        title_button.addEventListener('click', () => {
            if (router_cb && typeof router_cb === 'function') {
                router_cb('requirement_audit', { sampleId: sample_id, requirementId: requirement.key });
            } else {
                console.warn("RequirementCard: router_cb not provided or not a function for title navigation.");
            }
        });
        title_h_container.appendChild(title_button);
        text_content_div.appendChild(title_h_container);

        if (requirement.standardReference && requirement.standardReference.text) {
            let reference_element;
            if (requirement.standardReference.url) {
                const url_to_use = add_protocol_if_missing(requirement.standardReference.url);
                reference_element = create_element('a', {
                    class_name: 'requirement-card-reference-link',
                    text_content: requirement.standardReference.text,
                    attributes: {
                        href: url_to_use,
                        target: '_blank',
                        rel: 'noopener noreferrer'
                    }
                });
            } else {
                reference_element = create_element('span', {
                    class_name: 'requirement-card-reference-text',
                    text_content: requirement.standardReference.text
                });
            }
            const ref_wrapper = create_element('div', { class_name: 'requirement-card-reference-wrapper' });
            ref_wrapper.appendChild(reference_element);
            text_content_div.appendChild(ref_wrapper);
        }
        card_content_wrapper.appendChild(text_content_div);
        card_li.appendChild(card_content_wrapper);

        return card_li;
    },

    /**
     * Helper to load CSS exactly once.
     * @param {Object} Helpers - Helpers instance
     */
    async load_styles_if_needed(Helpers) {
        if (!this.css_loaded && Helpers && typeof Helpers.load_css === 'function') {
            if (!document.querySelector(`link[href$="${this.CSS_PATH}"]`)) {
                try {
                    await Helpers.load_css(this.CSS_PATH);
                    this.css_loaded = true;
                } catch (error) {
                    console.warn("Failed to load CSS for RequirementCardComponent:", error);
                }
            } else {
                this.css_loaded = true; // CSS already in DOM
            }
        }
    }
};
