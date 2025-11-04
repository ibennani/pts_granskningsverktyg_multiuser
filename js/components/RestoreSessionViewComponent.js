// js/components/RestoreSessionViewComponent.js

export const RestoreSessionViewComponent = (function () {
    'use-strict';

    let app_container_ref;
    let on_restore_callback;
    let on_discard_callback;
    let autosaved_state_ref;

    let Translation_t;
    let Helpers_create_element;
    let Helpers_format_iso_to_relative_time;

    function assign_globals_once() {
        if (Translation_t && Helpers_create_element) return;
        Translation_t = window.Translation?.t;
        Helpers_create_element = window.Helpers?.create_element;
        Helpers_format_iso_to_relative_time = window.Helpers?.format_iso_to_relative_time;
    }

    // Init tar emot beroenden och data från main.js
    async function init(_app_container, _on_restore, _on_discard, _autosaved_state) {
        assign_globals_once();
        app_container_ref = _app_container;
        on_restore_callback = _on_restore;
        on_discard_callback = _on_discard;
        autosaved_state_ref = _autosaved_state;
    }

    function render() {
        if (!app_container_ref || !Translation_t || !Helpers_create_element || !autosaved_state_ref) {
            console.error("[RestoreSessionView] Cannot render, core dependencies or autosaved state missing.");
            const t = Translation_t || ((key) => key);
            const errorMessage = t('restore_session_error_display');
            app_container_ref.innerHTML = `<p>${window.Helpers?.escape_html(errorMessage) || errorMessage}</p>`;
            return;
        }

        const t = Translation_t;
        app_container_ref.innerHTML = '';

        const plate = Helpers_create_element('div', { class_name: 'content-plate' });
        
        plate.appendChild(Helpers_create_element('h1', { text_content: t('restore_session_title') }));
        plate.appendChild(Helpers_create_element('p', { class_name: 'view-intro-text', text_content: t('restore_session_lead_text') }));

        const info_box = Helpers_create_element('div', { 
            style: { 
                marginBottom: '2rem', 
                padding: '1rem', 
                backgroundColor: 'var(--background-color)', 
                borderRadius: 'var(--border-radius)' 
            } 
        });
        
        const actor_name = autosaved_state_ref.auditMetadata?.actorName || 'Okänd';
        info_box.appendChild(Helpers_create_element('p', { 
            html_content: t('restore_session_info', { actorName: actor_name }),
            style: { fontWeight: '500', fontSize: '1.1rem' }
        }));

        const last_update_timestamps = (autosaved_state_ref.samples || [])
            .flatMap(s => Object.values(s.requirementResults || {}))
            .map(res => res.lastStatusUpdate)
            .filter(Boolean);

        if (last_update_timestamps.length > 0) {
            last_update_timestamps.sort((a, b) => new Date(b) - new Date(a));
            const most_recent_update = last_update_timestamps[0];

            if (most_recent_update && Helpers_format_iso_to_relative_time) {
                const lang_code = window.Translation.get_current_language_code();
                info_box.appendChild(Helpers_create_element('p', { 
                    text_content: t('restore_session_timestamp', { timestamp: Helpers_format_iso_to_relative_time(most_recent_update, lang_code) }),
                    style: { color: 'var(--text-color-muted)', fontSize: '0.9rem' }
                }));
            }
        }
        
        plate.appendChild(info_box);
        plate.appendChild(Helpers_create_element('p', { text_content: t('restore_session_question') }));

        const actions_div = Helpers_create_element('div', { 
            class_name: 'form-actions', 
            style: { marginTop: '1.5rem' } 
        });

        const restore_button = Helpers_create_element('button', {
            class_name: ['button', 'button-success'],
            text_content: t('restore_session_confirm_button')
        });
        restore_button.addEventListener('click', on_restore_callback);

        const discard_button = Helpers_create_element('button', {
            class_name: ['button', 'button-danger'],
            text_content: t('restore_session_discard_button')
        });
        discard_button.addEventListener('click', on_discard_callback);

        actions_div.append(restore_button, discard_button);
        plate.appendChild(actions_div);

        app_container_ref.appendChild(plate);
    }

    function destroy() {
        app_container_ref.innerHTML = '';
        on_restore_callback = null;
        on_discard_callback = null;
        autosaved_state_ref = null;
    }

    return {
        init,
        render,
        destroy
    };
})();