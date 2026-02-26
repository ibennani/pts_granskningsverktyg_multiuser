export const RestoreSessionViewComponent = {
    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        
        // Params passed via deps.params
        this.on_restore_callback = deps.params.on_restore;
        this.on_discard_callback = deps.params.on_discard;
        this.autosaved_state_ref = deps.params.autosaved_state;
        
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
    },

    render() {
        if (!this.root || !this.Translation || !this.Helpers || !this.autosaved_state_ref) {
            console.error("[RestoreSessionView] Cannot render, core dependencies or autosaved state missing.");
            const t = (this.Translation && this.Translation.t) ? this.Translation.t : ((key) => key);
            const errorMessage = t('restore_session_error_display');
            if (this.root) {
                this.root.innerHTML = `<p>${(this.Helpers && this.Helpers.escape_html) ? this.Helpers.escape_html(errorMessage) : errorMessage}</p>`;
            }
            return;
        }

        const t = this.Translation.t;
        this.root.innerHTML = '';

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
        
        plate.appendChild(this.Helpers.create_element('h1', { text_content: t('restore_session_title') }));
        plate.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('restore_session_lead_text') }));

        const info_box = this.Helpers.create_element('div', { 
            style: { 
                marginBottom: '2rem', 
                padding: '1rem', 
                backgroundColor: 'var(--background-color)', 
                borderRadius: 'var(--border-radius)' 
            } 
        });
        
        const actor_name = this.autosaved_state_ref.auditMetadata?.actorName || 'Okänd';
        info_box.appendChild(this.Helpers.create_element('p', { 
            html_content: t('restore_session_info', { actorName: actor_name }),
            style: { fontWeight: '500', fontSize: '1.1rem' }
        }));

        const last_update_timestamps = (this.autosaved_state_ref.samples || [])
            .flatMap(s => Object.values(s.requirementResults || {}))
            .map(res => res.lastStatusUpdate)
            .filter(Boolean);

        if (last_update_timestamps.length > 0) {
            last_update_timestamps.sort((a, b) => new Date(b) - new Date(a));
            const most_recent_update = last_update_timestamps[0];

            if (most_recent_update && this.Helpers.format_iso_to_relative_time) {
                const lang_code = this.Translation.get_current_language_code();
                info_box.appendChild(this.Helpers.create_element('p', { 
                    text_content: t('restore_session_timestamp', { timestamp: this.Helpers.format_iso_to_relative_time(most_recent_update, lang_code) }),
                    style: { color: 'var(--text-color-muted)', fontSize: '0.9rem' }
                }));
            }
        }
        
        plate.appendChild(info_box);
        plate.appendChild(this.Helpers.create_element('p', { text_content: t('restore_session_question') }));

        const actions_div = this.Helpers.create_element('div', { 
            class_name: 'form-actions', 
            style: { marginTop: '1.5rem' } 
        });

        const restore_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-success'],
            text_content: t('restore_session_confirm_button')
        });
        restore_button.addEventListener('click', this.on_restore_callback);

        const discard_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-danger'],
            text_content: t('restore_session_discard_button')
        });
        discard_button.addEventListener('click', this.on_discard_callback);

        actions_div.append(restore_button, discard_button);
        plate.appendChild(actions_div);

        this.root.appendChild(plate);
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.on_restore_callback = null;
        this.on_discard_callback = null;
        this.autosaved_state_ref = null;
        this.root = null;
        this.deps = null;
    }
};
