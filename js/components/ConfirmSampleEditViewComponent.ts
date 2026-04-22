export class ConfirmSampleEditViewComponent {
    private root: HTMLElement | null;
    private deps: any;
    private router: any;
    private getState: any;
    private dispatch: any;
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

        this.dispatch({
            type: this.StoreActionTypes.UPDATE_SAMPLE,
            payload: {
                sampleId: pending_changes.sampleId,
                updatedSampleData: pending_changes.updatedSampleData
            }
        });

        this.dispatch({ type: this.StoreActionTypes.CLEAR_STAGED_SAMPLE_CHANGES });

        this.NotificationComponent.show_global_message(t('sample_updated_successfully'), "success");
        this.router('sample_management');
    }

    handle_discard_and_return() {
        this.dispatch({ type: this.StoreActionTypes.CLEAR_STAGED_SAMPLE_CHANGES });
        this.router('sample_management');
    }

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        const current_state = this.getState();
        const pending_changes = current_state.pendingSampleChanges;

        this.root.innerHTML = '';
        const plate = this.Helpers.create_element('div', { class_name: 'content-plate' }) as any;
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
            if (added.length > 0) {
                section.appendChild(this.Helpers.create_element('h4', { text_content: t('sample_edit_confirm_added_content_types_header') }));
                const ul_added = this.Helpers.create_element('ul', { class_name: 'report-list' });
                added.forEach((txt: any) => ul_added.appendChild(this.Helpers.create_element('li', { text_content: String(txt) })));
                section.appendChild(ul_added);
            }
            if (removed.length > 0) {
                section.appendChild(this.Helpers.create_element('h4', { text_content: t('sample_edit_confirm_removed_content_types_header') }));
                const ul_removed = this.Helpers.create_element('ul', { class_name: 'report-list' });
                removed.forEach((txt: any) => ul_removed.appendChild(this.Helpers.create_element('li', { text_content: String(txt) })));
                section.appendChild(ul_removed);
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

