import "./add_sample_form_component.css";
import {
    classify_sample_edit_change,
    compute_sample_edit_field_diff
} from '../logic/sample_edit_diff.js';
import { render_add_sample_form } from './add_sample_form/render_add_sample_form.js';
import { get_selected_content_type_ids } from './add_sample_form/content_type_accordion.js';
import {
    clear_new_sample_form_draft,
    get_new_sample_draft_storage_key,
    load_new_sample_form_draft,
    save_new_sample_form_draft,
    type NewSampleFormDraft
} from './add_sample_form/new_sample_form_draft.js';
import { clear_sample_auto_screenshot_if_needed, handle_sample_url_blur } from './add_sample_form/sample_url_auto_screenshot.js';
import { build_sample_url_screenshot_form_host, type SampleUrlScreenshotFormHostSource } from './add_sample_form/sample_url_screenshot_form_host.js';
import { build_sample_url_page_title_form_host, handle_sample_url_page_title_on_blur, type SampleUrlPageTitleFormHostSource } from './add_sample_form/sample_url_page_title.js';
import { handle_analyze_page_content_click as run_analyze_page_content_click, update_content_type_analyze_visibility, type ContentTypeDetectionComponentLike } from './add_sample_form/content_type_detection.js';
import { sync_to_server_now } from '../logic/server_sync.js';
import { get_auth_token } from '../api/client.js';
import { audit_status_blocks_sample_and_requirement_edits } from '../utils/audit_status_helpers.js';

export class AddSampleFormComponent {
    private root: HTMLElement | null;
    private deps: any;
    private on_sample_saved_callback: any;
    private discard_callback: any;
    private router: any;
    private getState: any;
    private dispatch: any;
    private StoreActionTypes: any;
    private Translation: any;
    private Helpers: any;
    private NotificationComponent: any;
    private AuditLogic: any;
    private AutosaveService: any;

    private form_element: any;
    private category_fieldset_element: any;
    private sample_type_select: any;
    private description_input: any;
    private description_label_element: HTMLLabelElement | null;
    private url_input: any;
    private url_form_group_ref: any;
    private content_types_container_element: any;
    private sample_type_container: any;
    private sample_attach_media_btn: HTMLButtonElement | null;
    private sample_attached_media_filenames: string[];
    private url_auto_screenshot_filename: string | null;
    private url_auto_screenshot_source_url: string | null;
    private url_auto_screenshot_generation: number;
    private sample_url_screenshot_in_progress: boolean;

    private current_editing_sample_id: string | null;
    private original_content_types_on_load: string[];
    private previous_sample_type_value: string;
    private previous_url_page_title: string;
    private url_page_title_generation: number;
    private page_title_label_loading_count: number;
    private autosave_session: any;
    private skip_autosave_on_destroy: boolean;
    private initial_sample_snapshot: any;
    private show_back_to_samples_button: boolean;
    private content_type_selected_ids: Set<string>;
    private content_types_section_panel_inner: HTMLElement | null;
    private content_type_analyze_btn: HTMLButtonElement | null;
    private content_type_analyze_live_region: HTMLElement | null;
    private content_type_detection_in_progress: boolean;
    private content_type_detection_generation: number;

    constructor() {
        this.root = null;
        this.deps = null;
        this.on_sample_saved_callback = null;
        this.discard_callback = null;
        this.router = null;
        this.getState = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this.AuditLogic = null;
        this.AutosaveService = null;

        this.form_element = null;
        this.category_fieldset_element = null;
        this.sample_type_select = null;
        this.description_input = null;
        this.description_label_element = null;
        this.url_input = null;
        this.url_form_group_ref = null;
        this.content_types_container_element = null;
        this.sample_type_container = null;
        this.sample_attach_media_btn = null;
        this.sample_attached_media_filenames = [];
        this.url_auto_screenshot_filename = null;
        this.url_auto_screenshot_source_url = null;
        this.url_auto_screenshot_generation = 0;
        this.sample_url_screenshot_in_progress = false;

        this.current_editing_sample_id = null;
        this.original_content_types_on_load = [];
        this.previous_sample_type_value = '';
        this.previous_url_page_title = '';
        this.url_page_title_generation = 0;
        this.page_title_label_loading_count = 0;
        this.autosave_session = null;
        this.skip_autosave_on_destroy = false;
        this.initial_sample_snapshot = null;
        this.show_back_to_samples_button = false;
        this.content_type_selected_ids = new Set();
        this.content_types_section_panel_inner = null;
        this.content_type_analyze_btn = null;
        this.content_type_analyze_live_region = null;
        this.content_type_detection_in_progress = false;
        this.content_type_detection_generation = 0;
    }

    init({ root, deps }: { root: HTMLElement; deps: any }) {
        this.root = root;
        this.deps = deps;
        this.on_sample_saved_callback = deps.on_sample_saved;
        this.discard_callback = deps.discard;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.AuditLogic = deps.AuditLogic;
        this.AutosaveService = deps.AutosaveService;

        this.form_element = null;
        this.category_fieldset_element = null;
        this.sample_type_select = null;
        this.description_input = null;
        this.description_label_element = null;
        this.url_input = null;
        this.url_form_group_ref = null;
        this.content_types_container_element = null;
        this.sample_type_container = null;
        this.sample_attach_media_btn = null;
        this.sample_attached_media_filenames = [];
        this.url_auto_screenshot_filename = null;
        this.url_auto_screenshot_source_url = null;
        this.url_auto_screenshot_generation = 0;
        this.sample_url_screenshot_in_progress = false;

        this.current_editing_sample_id = null;
        this.original_content_types_on_load = [];
        this.previous_sample_type_value = "";
        this.previous_url_page_title = "";
        this.url_page_title_generation = 0;
        this.page_title_label_loading_count = 0;
        this.autosave_session = null;
        this.skip_autosave_on_destroy = false;
        this.initial_sample_snapshot = null;
        this.show_back_to_samples_button = false;
        this.content_type_selected_ids = new Set();
        this.content_types_section_panel_inner = null;
        this.content_type_analyze_btn = null;
        this.content_type_analyze_live_region = null;
        this.content_type_detection_in_progress = false;
        this.content_type_detection_generation = 0;

        this.handle_form_submit = this.handle_form_submit.bind(this);
        this.update_description_from_sample_type = this.update_description_from_sample_type.bind(this);
        this._handleCheckboxChange = this._handleCheckboxChange.bind(this);
        this.handle_autosave_input = this.handle_autosave_input.bind(this);
        this.handle_content_type_change = this.handle_content_type_change.bind(this);
        this.handle_url_input_blur = this.handle_url_input_blur.bind(this);
        this.handle_analyze_page_content_click = this.handle_analyze_page_content_click.bind(this);
        this.get_t_internally = this.get_t_internally.bind(this);
    }

    handle_analyze_page_content_click(): void {
        void run_analyze_page_content_click(this as unknown as ContentTypeDetectionComponentLike);
    }

    _get_sample_edit_draft() {
        const state = this.getState ? this.getState() : null;
        const d = state?.sampleEditDraft || null;
        if (!d) return null;
        if (!this.current_editing_sample_id) return null;
        if (String(d.sampleId) !== String(this.current_editing_sample_id)) return null;
        return d;
    }

    _ensure_sample_edit_draft_initialized() {
        if (!this.current_editing_sample_id) return;
        const state = this.getState();
        const existing = state?.sampleEditDraft;
        if (existing && String(existing.sampleId) === String(this.current_editing_sample_id)) return;

        const current_sample = state.samples.find((s: any) => String(s.id) === String(this.current_editing_sample_id));
        if (!current_sample) return;

        // Skapa ett utkast som startar på stickprovets aktuella värden.
        this.dispatch({
            type: this.StoreActionTypes.SET_SAMPLE_EDIT_DRAFT,
            payload: {
                sampleId: this.current_editing_sample_id,
                updatedSampleData: {
                    sampleCategory: current_sample.sampleCategory ?? null,
                    sampleType: current_sample.sampleType ?? null,
                    description: current_sample.description ?? '',
                    url: current_sample.url ?? '',
                    selectedContentTypes: Array.isArray(current_sample.selectedContentTypes) ? [...current_sample.selectedContentTypes] : [],
                    attachedMediaFilenames: Array.isArray(current_sample.attachedMediaFilenames)
                        ? [...current_sample.attachedMediaFilenames]
                        : [],
                    urlAutoScreenshotFilename: current_sample.urlAutoScreenshotFilename ?? null
                },
                originalSampleData: this.initial_sample_snapshot ? JSON.parse(JSON.stringify(this.initial_sample_snapshot)) : JSON.parse(JSON.stringify(current_sample))
            }
        });
    }

    _update_sample_edit_draft_from_dom({ should_trim, skip_render }: { should_trim: boolean; skip_render: boolean }) {
        if (!this.current_editing_sample_id) return;
        const selected_category_radio = this.form_element?.querySelector('input[name="sampleCategory"]:checked');
        const sample_category_id = selected_category_radio ? selected_category_radio.value : null;
        const sample_type_id = this.sample_type_select?.value;
        const description_raw = this.description_input?.value || '';
        const url_raw = this.url_input?.value || '';
        const selected_raw_values = get_selected_content_type_ids(this);

        const description = this.Helpers?.sanitize_plain_input
            ? this.Helpers.sanitize_plain_input(description_raw, { trim: should_trim })
            : (should_trim ? description_raw.trim() : description_raw.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''));

        let url_val = this.Helpers?.sanitize_plain_input
            ? this.Helpers.sanitize_plain_input(url_raw, { trim: should_trim })
            : (should_trim ? url_raw.trim() : url_raw.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''));

        const selected_content_types = this.Helpers?.sanitize_plain_array
            ? this.Helpers.sanitize_plain_array(selected_raw_values, { trim: should_trim })
            : selected_raw_values.map((v: any) => (should_trim ? v.trim() : v.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')));

        if (url_val) url_val = this.Helpers.add_protocol_if_missing(url_val);

        const attached_media_filenames = [...(this.sample_attached_media_filenames || [])];

        const draft = this._get_sample_edit_draft();
        const original = draft?.originalSampleData || (this.initial_sample_snapshot ? JSON.parse(JSON.stringify(this.initial_sample_snapshot)) : null);

        this.dispatch({
            type: this.StoreActionTypes.SET_SAMPLE_EDIT_DRAFT,
            payload: {
                sampleId: this.current_editing_sample_id,
                updatedSampleData: {
                    sampleCategory: sample_category_id,
                    sampleType: sample_type_id,
                    description,
                    url: url_val,
                    selectedContentTypes: selected_content_types,
                    attachedMediaFilenames: attached_media_filenames,
                    urlAutoScreenshotFilename: this.url_auto_screenshot_filename
                },
                originalSampleData: original,
                skip_render
            }
        });
    }

    get_sample_categories_from_state() {
        const state = this.getState ? this.getState() : null;
        const metadata = state?.ruleFileContent?.metadata || {};
        const samples = metadata.samples || {};

        let sample_categories = Array.isArray(samples.sampleCategories) ? samples.sampleCategories : [];

        if (sample_categories.length === 0) {
            const vocab_sample_types = metadata.vocabularies?.sampleTypes || {};
            if (Array.isArray(vocab_sample_types.sampleCategories)) {
                sample_categories = vocab_sample_types.sampleCategories;
            }
        }

        return sample_categories;
    }

    get_t_internally() {
        return this.Translation?.t || ((key: string) => `**${key}**`);
    }

    async ensure_audit_id_for_media(): Promise<string | null> {
        const state = this.getState?.();
        if (state?.auditId) {
            return String(state.auditId);
        }
        if (!get_auth_token() || !this.dispatch) {
            return null;
        }
        try {
            await sync_to_server_now(() => this.getState?.(), this.dispatch);
        } catch {
            return null;
        }
        const after_sync = this.getState?.();
        return after_sync?.auditId ? String(after_sync.auditId) : null;
    }

    handle_url_input_blur(): void {
        const val = (this.url_input?.value || '').trim();
        if (val && this.Helpers?.add_protocol_if_missing) {
            const fixed = this.Helpers.add_protocol_if_missing(val);
            if (fixed !== val && this.url_input) {
                this.url_input.value = fixed;
            }
        }
        const screenshot_host = build_sample_url_screenshot_form_host(
            this as unknown as SampleUrlScreenshotFormHostSource
        );
        const page_title_host = build_sample_url_page_title_form_host(
            this as unknown as SampleUrlPageTitleFormHostSource
        );
        void handle_sample_url_page_title_on_blur(page_title_host);
        void handle_sample_url_blur(screenshot_host);
    }

    update_description_from_sample_type() {
        if (!this.sample_type_select || !this.description_input) return;
        if (!this.sample_type_select.value) {
            this.previous_sample_type_value = '';
            return;
        }

        const current_description = this.description_input.value.trim();
        const new_sample_type_text = this.sample_type_select.options[this.sample_type_select.selectedIndex]?.text;

        if (new_sample_type_text && (current_description === '' || current_description === this.previous_sample_type_value)) {
            this.description_input.value = new_sample_type_text;
        }
        this.previous_sample_type_value = new_sample_type_text;
    }

    on_category_change(selected_cat_id: string, preselected_sample_type_id: string | null = null) {
        const sample_categories = this.get_sample_categories_from_state();
        const selected_category = sample_categories.find((c: any) => c.id === selected_cat_id);

        if (!selected_category) return;

        if (!this.sample_type_container) return;
        this.sample_type_container.innerHTML = '';
        const t = this.get_t_internally();
        const label = this.Helpers.create_element('label', { attributes: { for: 'sampleTypeSelect' }, text_content: t('sample_type_label') });
        this.sample_type_select = this.Helpers.create_element('select', { id: 'sampleTypeSelect', class_name: 'form-control' });
        this.sample_type_select.addEventListener('change', () => {
            this.update_description_from_sample_type();
            // Variant B: typ- och ev. auto-uppdaterad beskrivning ska direkt in i utkastet.
            this.save_form_data_immediately(true, false, true);
        });
        const default_option = this.Helpers.create_element('option', { value: '', text_content: t('select_option') });
        this.sample_type_select.appendChild(default_option);
        (selected_category.categories || []).forEach((subcat: any) => {
            this.sample_type_select.appendChild(this.Helpers.create_element('option', { value: subcat.id, text_content: subcat.text }));
        });
        if (preselected_sample_type_id) {
            this.sample_type_select.value = preselected_sample_type_id;
        }
        this.sample_type_container.appendChild(label);
        this.sample_type_container.appendChild(this.sample_type_select);

        if (this.url_form_group_ref) {
            this.url_form_group_ref.style.display = selected_category.hasUrl ? '' : 'none';
            if (!selected_category.hasUrl) {
                this.url_input.value = '';
                void clear_sample_auto_screenshot_if_needed(
                    build_sample_url_screenshot_form_host(this as unknown as SampleUrlScreenshotFormHostSource)
                );
            }
        }
        update_content_type_analyze_visibility(this as unknown as ContentTypeDetectionComponentLike);

        this.previous_sample_type_value = this.sample_type_select.value
            ? (this.sample_type_select.options[this.sample_type_select.selectedIndex]?.text || '')
            : '';
    }

    _updateParentCheckboxState(parentCheckbox: any) {
        const parentId = parentCheckbox.dataset.parentId;
        const children = this.content_types_container_element.querySelectorAll(`input[data-child-for="${parentId}"]`);
        if (children.length === 0) {
            parentCheckbox.checked = false;
            parentCheckbox.indeterminate = false;
            parentCheckbox.setAttribute('aria-checked', 'false');
            return;
        }
        const allChecked = Array.from(children).every((child: any) => child.checked);
        const someChecked = Array.from(children).some((child: any) => child.checked);
        parentCheckbox.checked = allChecked;
        parentCheckbox.indeterminate = someChecked && !allChecked;

        if (parentCheckbox.indeterminate) {
            parentCheckbox.setAttribute('aria-checked', 'mixed');
        } else {
            parentCheckbox.setAttribute('aria-checked', parentCheckbox.checked.toString());
        }
    }

    _handleCheckboxChange(event: any) {
        const target = event.target;
        if (target.type !== 'checkbox') return;
        if (target.dataset.parentId) {
            const parentId = target.dataset.parentId;
            const isChecked = target.checked;
            const children = this.content_types_container_element.querySelectorAll(`input[data-child-for="${parentId}"]`);
            children.forEach((child: any) => {
                child.checked = isChecked;
                const dm = (window as any).DraftManager;
                if (dm?.captureFieldChange) {
                    try {
                        dm.captureFieldChange(child);
                    } catch (_) {
                        // ignoreras
                    }
                }
            });
        } else if (target.dataset.childFor) {
            const parentId = target.dataset.childFor;
            const parentCheckbox = this.content_types_container_element.querySelector(`input[data-parent-id="${parentId}"]`);
            if (parentCheckbox) this._updateParentCheckboxState(parentCheckbox);
        }
    }

    handle_autosave_input() {
        if (this.current_editing_sample_id) {
            this.autosave_session?.request_autosave();
            return;
        }
        this._persist_new_sample_draft(false);
    }

    _get_new_sample_draft_storage_key(): string {
        return get_new_sample_draft_storage_key(this.getState?.() ?? null);
    }

    load_new_sample_draft_for_form(): NewSampleFormDraft | null {
        if (this.current_editing_sample_id) return null;
        return load_new_sample_form_draft(this._get_new_sample_draft_storage_key());
    }

    _read_new_sample_payload_from_dom(should_trim: boolean) {
        const selected_category_radio = this.form_element?.querySelector('input[name="sampleCategory"]:checked');
        const sample_category_id = selected_category_radio ? (selected_category_radio as HTMLInputElement).value : null;
        const sample_type_id = this.sample_type_select?.value || null;
        const description_raw = this.description_input?.value || '';
        const url_raw = this.url_input?.value || '';
        const selected_raw_values = get_selected_content_type_ids(this);

        const description = this.Helpers?.sanitize_plain_input
            ? this.Helpers.sanitize_plain_input(description_raw, { trim: should_trim })
            : (should_trim ? description_raw.trim() : description_raw.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''));

        let url_val = this.Helpers?.sanitize_plain_input
            ? this.Helpers.sanitize_plain_input(url_raw, { trim: should_trim })
            : (should_trim ? url_raw.trim() : url_raw.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''));

        const selected_content_types = this.Helpers?.sanitize_plain_array
            ? this.Helpers.sanitize_plain_array(selected_raw_values, { trim: should_trim })
            : selected_raw_values.map((v) => (should_trim ? v.trim() : v.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')));

        if (url_val) url_val = this.Helpers.add_protocol_if_missing(url_val);

        return {
            sampleCategory: sample_category_id,
            sampleType: sample_type_id,
            description,
            url: url_val,
            selectedContentTypes: selected_content_types,
            attachedMediaFilenames: [...(this.sample_attached_media_filenames || [])],
            urlAutoScreenshotFilename: this.url_auto_screenshot_filename
        };
    }

    _persist_new_sample_draft(should_trim: boolean) {
        if (this.current_editing_sample_id || !this.form_element) return;
        save_new_sample_form_draft(
            this._get_new_sample_draft_storage_key(),
            this._read_new_sample_payload_from_dom(should_trim)
        );
    }

    _clear_new_sample_draft() {
        clear_new_sample_form_draft(this._get_new_sample_draft_storage_key());
    }

    handle_content_type_change(e: any) {
        this._handleCheckboxChange(e);
        this.handle_autosave_input();
    }

    save_form_data_immediately(is_autosave = false, should_trim = !is_autosave, skip_render = false) {
        if (!this.current_editing_sample_id) {
            this._persist_new_sample_draft(should_trim);
            return;
        }

        // Variant B: autospar och ändringar skriver alltid till ett "utkast" i state.
        // Själva stickprovet uppdateras först när användaren bekräftar.
        this._update_sample_edit_draft_from_dom({ should_trim, skip_render });
    }

    _resolve_content_type_label(rule_file: any, id: string) {
        const groups = rule_file?.metadata?.vocabularies?.contentTypes || rule_file?.metadata?.contentTypes || [];
        for (const g of groups) {
            for (const t of (g.types || [])) {
                if (t.id === id) return String(t.text || id);
            }
        }
        return id;
    }

    _resolve_sample_category_label(rule_file: any, id: string) {
        const cats = rule_file?.metadata?.samples?.sampleCategories ||
            rule_file?.metadata?.vocabularies?.sampleTypes?.sampleCategories ||
            [];
        const cat = (cats || []).find((c: any) => c.id === id);
        return cat ? String(cat.text || id) : id;
    }

    _resolve_sample_type_label(rule_file: any, id: string) {
        const cats = rule_file?.metadata?.samples?.sampleCategories ||
            rule_file?.metadata?.vocabularies?.sampleTypes?.sampleCategories ||
            [];
        for (const c of (cats || [])) {
            const match = (c.categories || []).find((s: any) => s.id === id);
            if (match) return String(match.text || id);
        }
        return id;
    }

    _stage_changes_and_navigate(sample_payload_data: any, is_autosave = false, skip_render_for_trim = false) {
        const state = this.getState();
        const rule_file = state.ruleFileContent;
        const sample_being_edited = state.samples.find((s: any) => s.id === this.current_editing_sample_id);
        const baseline_sample = this.initial_sample_snapshot || sample_being_edited;
        const baseline_content_types = Array.isArray(baseline_sample?.selectedContentTypes)
            ? baseline_sample.selectedContentTypes
            : [];

        const old_relevant_reqs = new Set(
            this.AuditLogic
                .get_relevant_requirements_for_sample(rule_file, { ...sample_being_edited, selectedContentTypes: baseline_content_types })
                .map((r: any) => r.key || r.id)
                .filter(Boolean)
        );
        const new_relevant_reqs = new Set(
            this.AuditLogic
                .get_relevant_requirements_for_sample(rule_file, sample_payload_data)
                .map((r: any) => r.key || r.id)
                .filter(Boolean)
        );

        const added_req_ids = [...new_relevant_reqs].filter(id => !old_relevant_reqs.has(id));
        const removed_req_ids = [...old_relevant_reqs].filter(id => !new_relevant_reqs.has(id));

        const reqs_obj = rule_file?.requirements;
        const data_will_be_lost = removed_req_ids.some((id: any) => {
            const req_def = this.AuditLogic.find_requirement_definition?.(reqs_obj, id);
            if (!req_def) return !!(sample_being_edited.requirementResults || {})[id];
            const stored = this.AuditLogic.get_stored_requirement_result_for_def(
                sample_being_edited.requirementResults,
                reqs_obj,
                req_def,
                id
            );
            return !!stored;
        });

        const field_diff = compute_sample_edit_field_diff({
            old_sample: {
                sampleCategory: baseline_sample?.sampleCategory ?? null,
                sampleType: baseline_sample?.sampleType ?? null,
                description: baseline_sample?.description ?? null,
                url: baseline_sample?.url ?? null,
                selectedContentTypes: baseline_content_types
            },
            new_sample: sample_payload_data,
            resolve_sample_category_label: (id: string) => this._resolve_sample_category_label(rule_file, id),
            resolve_sample_type_label: (id: string) => this._resolve_sample_type_label(rule_file, id),
            resolve_content_type_label: (id: string) => this._resolve_content_type_label(rule_file, id)
        });

        const should_skip_render = is_autosave === true || skip_render_for_trim === true;
        this.dispatch({
            type: this.StoreActionTypes.STAGE_SAMPLE_CHANGES,
            payload: {
                sampleId: this.current_editing_sample_id,
                updatedSampleData: sample_payload_data,
                originalSampleData: this.initial_sample_snapshot ? JSON.parse(JSON.stringify(this.initial_sample_snapshot)) : null,
                analysis: {
                    added_reqs: added_req_ids,
                    removed_reqs: removed_req_ids,
                    data_will_be_lost,
                    ...field_diff
                },
                skip_render: should_skip_render
            }
        });

        if (!is_autosave) {
            // Vi navigerar direkt till bekräftelsesidan – undvik att destroy() triggar en extra flush/router.
            this.skip_autosave_on_destroy = true;
            this.autosave_session?.cancel_pending?.();
            this.router('confirm_sample_edit');
        }
    }

    _perform_save(sample_payload_data: any, is_autosave = false, skip_render_for_trim = false) {
        const t = this.get_t_internally();
        const should_skip_render = is_autosave === true || skip_render_for_trim === true;
        const audit_status = this.getState?.()?.auditStatus;
        if (
            !this.current_editing_sample_id &&
            audit_status_blocks_sample_and_requirement_edits(audit_status)
        ) {
            this.NotificationComponent.show_global_message(t('error_cannot_add_sample_when_audit_closed'), 'error');
            return;
        }
        if (this.current_editing_sample_id) {
            this.dispatch({
                type: this.StoreActionTypes.UPDATE_SAMPLE,
                payload: {
                    sampleId: this.current_editing_sample_id,
                    updatedSampleData: sample_payload_data,
                    skip_render: should_skip_render
                }
            });

            if (sample_payload_data.selectedContentTypes) {
                this.original_content_types_on_load = [...sample_payload_data.selectedContentTypes];
            }

            if (!is_autosave) {
                if ((window as any).DraftManager?.commitCurrentDraft) {
                    (window as any).DraftManager.commitCurrentDraft();
                }
                this.NotificationComponent.show_global_message(t('sample_updated_successfully'), "success");
            }
        } else {
            const new_sample_object = { ...sample_payload_data, id: this.Helpers.generate_uuid_v4(), requirementResults: {} };
            this.dispatch({
                type: this.StoreActionTypes.ADD_SAMPLE,
                payload: { ...new_sample_object, skip_render: should_skip_render }
            });
            this._clear_new_sample_draft();
            if (!is_autosave && (window as any).DraftManager?.commitCurrentDraft) {
                (window as any).DraftManager.commitCurrentDraft();
            }
            this.NotificationComponent.show_global_message(t('sample_added_successfully'), "success");
        }

        if (!is_autosave && this.on_sample_saved_callback) {
            this.on_sample_saved_callback();
        }
    }

    handle_form_submit(event: any) {
        event.preventDefault();
        const t = this.get_t_internally();
        this.NotificationComponent.clear_global_message();

        const selected_category_radio = this.form_element.querySelector('input[name="sampleCategory"]:checked');
        const sample_category_id = selected_category_radio ? selected_category_radio.value : null;
        const sample_type_id = this.sample_type_select?.value || null;

        const description_raw = this.description_input.value;
        const url_raw = this.url_input.value;
        const selected_raw_values = get_selected_content_type_ids(this);

        const description = this.Helpers?.sanitize_plain_input
            ? this.Helpers.sanitize_plain_input(description_raw, { trim: true })
            : description_raw.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        let url_val = this.Helpers?.sanitize_plain_input
            ? this.Helpers.sanitize_plain_input(url_raw, { trim: true })
            : url_raw.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        const selected_content_types = this.Helpers?.sanitize_plain_array
            ? this.Helpers.sanitize_plain_array(selected_raw_values, { trim: true })
            : selected_raw_values.map((v: any) => v.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''));

        if (url_val) url_val = this.Helpers.add_protocol_if_missing(url_val);

        const sample_payload_data = {
            sampleCategory: sample_category_id,
            sampleType: sample_type_id,
            description: description,
            url: url_val,
            selectedContentTypes: selected_content_types,
            attachedMediaFilenames: [...(this.sample_attached_media_filenames || [])],
            urlAutoScreenshotFilename: this.url_auto_screenshot_filename
        };

        if (!this.current_editing_sample_id) {
            this._perform_save(sample_payload_data, false, false);
            return;
        }

        // Spara senaste formulärvärden som utkast innan vi analyserar och går vidare.
        this.dispatch({
            type: this.StoreActionTypes.SET_SAMPLE_EDIT_DRAFT,
            payload: {
                sampleId: this.current_editing_sample_id,
                updatedSampleData: sample_payload_data,
                originalSampleData: this.initial_sample_snapshot ? JSON.parse(JSON.stringify(this.initial_sample_snapshot)) : null,
                skip_render: true
            }
        });

        const current_state = this.getState();
        const current_sample = current_state.samples.find((s: any) => s.id === this.current_editing_sample_id);
        const baseline_sample = this.initial_sample_snapshot || current_sample;
        const change_kind = classify_sample_edit_change(baseline_sample, sample_payload_data);
        if (change_kind === 'none') {
            this.dispatch({ type: this.StoreActionTypes.CLEAR_SAMPLE_EDIT_DRAFT, payload: { skip_render: true } });
            this.router('sample_management');
            return;
        }

        if (change_kind === 'media_only') {
            this.skip_autosave_on_destroy = true;
            this.autosave_session?.cancel_pending?.();
            this._perform_save(sample_payload_data, false, false);
            this.dispatch({ type: this.StoreActionTypes.CLEAR_SAMPLE_EDIT_DRAFT, payload: { skip_render: true } });
            return;
        }

        this._stage_changes_and_navigate(sample_payload_data, false, true);
    }

    set_show_back_to_samples_button(show: boolean) {
        this.show_back_to_samples_button = show === true;
    }

    render(sample_id_to_edit: string | null = null) {
        this.skip_autosave_on_destroy = false;
        render_add_sample_form(this, sample_id_to_edit);
        this._ensure_sample_edit_draft_initialized();
    }

    discard() {
        this.skip_autosave_on_destroy = true;
        this.autosave_session?.cancel_pending();

        // Återställ till ursprungsläget så att autosparade ändringar inte blir kvar när användaren väljer att inte bekräfta.
        if (this.current_editing_sample_id && this.initial_sample_snapshot) {
            try {
                const snapshot = JSON.parse(JSON.stringify(this.initial_sample_snapshot));
                this.dispatch({
                    type: this.StoreActionTypes.UPDATE_SAMPLE,
                    payload: {
                        sampleId: this.current_editing_sample_id,
                        updatedSampleData: snapshot,
                        skip_render: true
                    }
                });
                this.original_content_types_on_load = [...(snapshot.selectedContentTypes || [])];
            } catch (_) {
                // ignoreras
            }
        }

        // Rensa ev. staged ändringar som kan ligga kvar.
        try {
            this.dispatch({ type: this.StoreActionTypes.CLEAR_STAGED_SAMPLE_CHANGES, payload: { skip_render: true } });
        } catch (_) {
            // ignoreras
        }

        try {
            this.dispatch({ type: this.StoreActionTypes.CLEAR_SAMPLE_EDIT_DRAFT, payload: { skip_render: true } });
        } catch (_) {
            // ignoreras
        }

        if (!this.current_editing_sample_id) {
            this._clear_new_sample_draft();
        }
    }

    destroy() {
        if (!this.skip_autosave_on_destroy && this.form_element) {
            if (this.current_editing_sample_id) {
                this.autosave_session?.flush({ should_trim: true, skip_render: true });
            } else {
                this._persist_new_sample_draft(true);
            }
        }
        this.autosave_session?.destroy();
        this.autosave_session = null;

        if (this.form_element) {
            this.form_element.removeEventListener('submit', this.handle_form_submit);
        }
        if (this.sample_type_select) {
            this.sample_type_select.removeEventListener('change', this.update_description_from_sample_type);
        }
        if (this.content_types_container_element) {
            this.content_types_container_element.removeEventListener('change', this.handle_content_type_change);
        }

        this.root = null;
        this.deps = null;
        this.form_element = null;
        this.current_editing_sample_id = null;
        this.initial_sample_snapshot = null;
    }
}

