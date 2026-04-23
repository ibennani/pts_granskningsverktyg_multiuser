import "./confirm_sample_edit_view_component.css";

export class ConfirmSampleEditViewComponent {
    private root: HTMLElement | null;
    private deps: any;
    private router: any;
    private getState: any;
    private dispatch: any;
    private flush_sync_to_server: any;
    private StoreActionTypes: any;
    private Translation: any;
    private Helpers: any;
    private NotificationComponent: any;
    private plate_element_ref: HTMLElement | null;

    constructor() {
        this.root = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.dispatch = null;
        this.flush_sync_to_server = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this.plate_element_ref = null;
    }

    init({ root, deps }: { root: HTMLElement; deps: any }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.flush_sync_to_server = deps.flush_sync_to_server || null;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;

        this.plate_element_ref = null;
    }

    handle_confirm_and_save() {
        const t = this.Translation.t;
        const pending_changes = this.getState().pendingSampleChanges;
        if (!pending_changes) {
            this.NotificationComponent.show_global_message(t('error_no_pending_sample_changes'), 'error');
            this.router('sample_management'); // Fallback
            return;
        }

        void (async () => {
            try {
                await this.dispatch({
                    type: this.StoreActionTypes.UPDATE_SAMPLE,
                    payload: {
                        sampleId: pending_changes.sampleId,
                        updatedSampleData: pending_changes.updatedSampleData
                    }
                });

                // Verifiera att innehållstyper faktiskt landade i state.
                const after = this.getState();
                const sample_after = after?.samples?.find((s: any) => String(s?.id) === String(pending_changes.sampleId));
                const expected = pending_changes.updatedSampleData?.selectedContentTypes;
                const actual = sample_after?.selectedContentTypes;
                const expected_set = new Set(Array.isArray(expected) ? expected : []);
                const actual_set = new Set(Array.isArray(actual) ? actual : []);
                const ok = expected_set.size === actual_set.size && [...expected_set].every(v => actual_set.has(v));
                if (!ok) {
                    this.NotificationComponent.show_global_message(
                        t('server_sync_error', { message: 'Innehållstyper kunde inte sparas i stickprovet. Försök igen – om felet kvarstår kan granskningen ha skrivits över av synk från servern.' })
                            || 'Innehållstyper kunde inte sparas i stickprovet. Försök igen – om felet kvarstår kan granskningen ha skrivits över av synk från servern.',
                        'error'
                    );
                    return;
                }

                await this.dispatch({ type: this.StoreActionTypes.CLEAR_STAGED_SAMPLE_CHANGES });
                await this.dispatch({ type: this.StoreActionTypes.CLEAR_SAMPLE_EDIT_DRAFT, payload: { skip_render: true } });

                if ((window as any).DraftManager?.commitCurrentDraft) {
                    (window as any).DraftManager.commitCurrentDraft();
                }

                // Robusthet: vänta in server-synk innan vi navigerar, så att polling/REPLACE_STATE_FROM_REMOTE
                // inte hinner skriva över stickprovsändringen direkt efter bekräftelsen.
                if (typeof this.flush_sync_to_server === 'function' && this.getState && this.dispatch) {
                    try {
                        await this.flush_sync_to_server(this.getState, this.dispatch);
                    } catch (e: any) {
                        this.NotificationComponent.show_global_message(
                            t('server_sync_error', { message: e?.message || 'Ändringen sparades lokalt men kunde inte synkas till servern.' })
                                || (e?.message || 'Ändringen sparades lokalt men kunde inte synkas till servern.'),
                            'warning'
                        );
                    }
                }

                this.NotificationComponent.show_global_message(t('sample_updated_successfully'), "success");
                this.router('sample_management');

                // Om synk/poll ersätter state strax efteråt kan ändringen "försvinna" utan att användaren ser fel.
                // Vi gör en fördröjd kontroll och visar ett tydligt meddelande om det sker.
                setTimeout(() => {
                    try {
                        const after_delay = this.getState();
                        const sample_after_delay = after_delay?.samples?.find((s: any) => String(s?.id) === String(pending_changes.sampleId));
                        const expected2 = pending_changes.updatedSampleData?.selectedContentTypes;
                        const actual2 = sample_after_delay?.selectedContentTypes;
                        const expected_set2 = new Set(Array.isArray(expected2) ? expected2 : []);
                        const actual_set2 = new Set(Array.isArray(actual2) ? actual2 : []);
                        const ok2 = expected_set2.size === actual_set2.size && [...expected_set2].every(v => actual_set2.has(v));
                        if (!ok2) {
                            this.NotificationComponent.show_global_message(
                                'Ändringen sparades först, men skrevs sedan över av en synk från servern. Prova att uppdatera sidan och gör ändringen igen. Om det fortsätter: kontrollera att du är online och att inga andra flikar/enheter har granskningen öppen samtidigt.',
                                'warning'
                            );
                        }
                    } catch (_) {
                        // ignoreras
                    }
                }, 1500);
            } catch (err: any) {
                this.NotificationComponent.show_global_message(
                    t('server_sync_error', { message: err?.message || 'Kunde inte spara ändringarna.' }) || (err?.message || 'Kunde inte spara ändringarna.'),
                    'error'
                );
            }
        })();
    }

    handle_discard_and_return() {
        const pending_changes = this.getState().pendingSampleChanges;
        // Återställ stickprovet till ursprungsläget om vi har en snapshot.
        if (pending_changes?.sampleId && pending_changes?.originalSampleData) {
            try {
                this.dispatch({
                    type: this.StoreActionTypes.UPDATE_SAMPLE,
                    payload: {
                        sampleId: pending_changes.sampleId,
                        updatedSampleData: pending_changes.originalSampleData,
                        skip_render: true
                    }
                });
            } catch (_) {
                // ignoreras
            }
        }
        this.dispatch({ type: this.StoreActionTypes.CLEAR_STAGED_SAMPLE_CHANGES });
        this.dispatch({ type: this.StoreActionTypes.CLEAR_SAMPLE_EDIT_DRAFT, payload: { skip_render: true } });
        this.router('sample_management');
    }

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        const current_state = this.getState();
        const pending_changes = current_state.pendingSampleChanges;

        this.root.innerHTML = '';
        const plate = this.Helpers.create_element('div', { class_name: ['content-plate', 'confirm-sample-edit-view-plate'] }) as any;
        this.plate_element_ref = plate;
        this.root.appendChild(plate);

        // Undvik \"felblink\" om pending_changes hunnit rensas precis innan vybyte.
        if (!pending_changes) {
            return;
        }

        plate.appendChild(this.Helpers.create_element('h1', { text_content: t('sample_edit_confirm_dialog_title') }));

        const {
            added_reqs,
            removed_reqs,
            data_will_be_lost,
            changed_fields,
            content_types_diff
        } = pending_changes.analysis;
        const rule_file = current_state.ruleFileContent;

        const get_field_label = (key: string) => {
            switch (key) {
                case 'sampleCategory': return t('sample_category_title');
                case 'sampleType': return t('sample_type_label');
                case 'description': return t('description');
                case 'url': return t('url');
                default: return key;
            }
        };

        const format_value = (val: any) => {
            const txt = (val ?? '').toString();
            return txt ? txt : t('value_not_specified');
        };

        if (Array.isArray(changed_fields) && changed_fields.length > 0) {
            const section = this.Helpers.create_element('div', { class_name: 'report-section' });
            section.appendChild(this.Helpers.create_element('h3', { text_content: t('sample_edit_confirm_changed_fields_header') }));
            const ul = this.Helpers.create_element('ul', { class_name: 'report-list' });
            changed_fields.forEach((f: any) => {
                const label = get_field_label(f.key);
                const old_v = format_value(f.oldValue);
                const new_v = format_value(f.newValue);
                ul.appendChild(this.Helpers.create_element('li', { text_content: `${label}: ${old_v} → ${new_v}` }));
            });
            section.appendChild(ul);
            plate.appendChild(section);
        }

        if (content_types_diff && (Array.isArray(content_types_diff.added) || Array.isArray(content_types_diff.removed))) {
            const section = this.Helpers.create_element('div', { class_name: 'report-section' });
            section.appendChild(this.Helpers.create_element('h3', { text_content: t('sample_edit_confirm_changed_content_types_header') }));
            const added = Array.isArray(content_types_diff.added) ? content_types_diff.added : [];
            const removed = Array.isArray(content_types_diff.removed) ? content_types_diff.removed : [];
            const render_bullet_list = (title: string, values: any[]) => {
                const wrapper = this.Helpers.create_element('div');
                wrapper.appendChild(this.Helpers.create_element('div', { class_name: 'report-subheading', text_content: title }));
                const ul = this.Helpers.create_element('ul', { class_name: ['report-list', 'report-list--compact'] });
                (values || []).forEach((txt: any) => {
                    ul.appendChild(this.Helpers.create_element('li', { text_content: String(txt) }));
                });
                wrapper.appendChild(ul);
                return wrapper;
            };

            if (added.length > 0) {
                section.appendChild(render_bullet_list(t('sample_edit_confirm_added_content_types_header'), added));
            }
            if (removed.length > 0) {
                section.appendChild(render_bullet_list(t('sample_edit_confirm_removed_content_types_header'), removed));
            }
            plate.appendChild(section);
        }

        const render_req_list = (req_ids: any[]) => {
            const ul = this.Helpers.create_element('ul', { class_name: 'report-list' });
            req_ids.forEach((id) => {
                const req = rule_file.requirements[id];
                if (req) {
                    const ref_text = req.standardReference?.text ? ` (${req.standardReference.text})` : '';
                    ul.appendChild(this.Helpers.create_element('li', { text_content: `${req.title}${ref_text}` }));
                }
            });
            return ul;
        };

        if (added_reqs.length > 0) {
            const section = this.Helpers.create_element('div', { class_name: 'report-section' });
            section.appendChild(this.Helpers.create_element('h3', { text_content: t('sample_edit_confirm_added_reqs_header') }));
            section.appendChild(render_req_list(added_reqs));
            plate.appendChild(section);
        }

        if (removed_reqs.length > 0) {
            const section = this.Helpers.create_element('div', { class_name: 'report-section' });
            section.appendChild(this.Helpers.create_element('h3', { text_content: t('sample_edit_confirm_removed_reqs_header') }));
            section.appendChild(render_req_list(removed_reqs));
            plate.appendChild(section);
        }

        if (data_will_be_lost) {
            const warning_div = this.Helpers.create_element('div', { style: 'margin-top: 1rem; padding: 1rem; border: 2px solid var(--danger-color); border-radius: var(--border-radius); background-color: var(--danger-color-light);' });
            warning_div.appendChild(this.Helpers.create_element('h4', {
                html_content: (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('warning', ['var(--danger-color)']) + ' ' : '') + t('sample_edit_confirm_data_loss_warning_header')
            }));
            warning_div.appendChild(this.Helpers.create_element('p', { text_content: t('sample_edit_confirm_data_loss_warning_text') }));
            plate.appendChild(warning_div);
        }

        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: 'margin-top: 2rem;' });
        const confirm_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            text_content: t('sample_edit_confirm_action_button')
        });
        const discard_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-danger'],
            text_content: t('sample_edit_discard_action_button')
        });

        confirm_btn.addEventListener('click', this.handle_confirm_and_save.bind(this));
        discard_btn.addEventListener('click', this.handle_discard_and_return.bind(this));

        actions_div.append(confirm_btn, discard_btn);
        plate.appendChild(actions_div);
    }

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        this.plate_element_ref = null;
    }
}

