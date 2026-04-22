import { AddSampleFormComponent } from './AddSampleFormComponent.js';

export class SampleFormViewComponent {
    private root: HTMLElement | null;
    private deps: any;
    private router: any;
    private params: any;
    private getState: any;
    private dispatch: any;
    private StoreActionTypes: any;
    private Translation: any;
    private Helpers: any;
    private NotificationComponent: any;
    private AuditLogic: any;
    private add_sample_form_container_element: HTMLElement | null;
    private plate_element_ref: HTMLElement | null;
    private add_sample_form_component_instance: any;

    constructor() {
        this.root = null;
        this.deps = null;
        this.router = null;
        this.params = null;
        this.getState = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this.AuditLogic = null;
        this.add_sample_form_container_element = null;
        this.plate_element_ref = null;
        this.add_sample_form_component_instance = new AddSampleFormComponent();
    }

    async init({ root, deps }: { root: HTMLElement; deps: any }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.params = deps.params;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.AuditLogic = deps.AuditLogic;

        this.add_sample_form_container_element = null;
        this.plate_element_ref = null;

        this.add_sample_form_container_element = this.Helpers.create_element('div', { id: 'add-sample-form-area-in-view' });

        await this.add_sample_form_component_instance.init({
            root: this.add_sample_form_container_element,
            deps: {
                on_sample_saved: this.on_form_saved_or_updated.bind(this),
                discard: this.discard_and_return.bind(this),
                router: this.router,
                getState: this.getState,
                dispatch: this.dispatch,
                StoreActionTypes: this.StoreActionTypes,
                Translation: this.Translation,
                Helpers: this.Helpers,
                NotificationComponent: this.NotificationComponent,
                AuditLogic: this.AuditLogic,
                AutosaveService: this.deps?.AutosaveService || (window as any).AutosaveService
            }
        });
    }

    on_form_saved_or_updated() {
        this.router('sample_management');
    }

    discard_and_return() {
        this.add_sample_form_component_instance.discard?.();
        this.router('sample_management');
    }

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        const sample_id_to_edit = this.params?.editSampleId || null;
        const current_state = this.getState();
        const audit_status = current_state.auditStatus;
        const sample_count = current_state.samples?.length || 0;

        const root = this.root;
        root.innerHTML = '';
        const plate = this.Helpers.create_element('div', { class_name: 'content-plate' }) as any;
        this.plate_element_ref = plate;
        root.appendChild(plate);

        const title_text = sample_id_to_edit ? t('edit_sample') : t('add_new_sample');
        plate.appendChild(this.Helpers.create_element('h1', { text_content: title_text }));

        const intro_text_key = (audit_status === 'not_started') ? 'add_samples_intro_message' : 'add_sample_form_new_intro';
        plate.appendChild(this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t(intro_text_key)
        }));

        this.add_sample_form_component_instance.render(sample_id_to_edit);
        plate.appendChild(this.add_sample_form_container_element as any);

        const should_hide_back_to_samples_for_first_sample =
            audit_status === 'not_started' &&
            !sample_id_to_edit &&
            sample_count === 0;

        if (!should_hide_back_to_samples_for_first_sample) {
            const bottom_actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: 'margin-top: 2rem; justify-content: flex-start;' });
            const return_button_text_key = 'back_to_sample_management';

            const return_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                html_content: `<span>${t(return_button_text_key)}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('arrow_back') : '')
            });
            return_button.addEventListener('click', this.discard_and_return.bind(this));
            bottom_actions_div.appendChild(return_button);
            plate.appendChild(bottom_actions_div);
        }
    }

    destroy() {
        if (this.add_sample_form_component_instance?.destroy) {
            this.add_sample_form_component_instance.destroy();
        }
        if (this.root) this.root.innerHTML = '';
        this.plate_element_ref = null;
        this.root = null;
        this.deps = null;
    }
}

