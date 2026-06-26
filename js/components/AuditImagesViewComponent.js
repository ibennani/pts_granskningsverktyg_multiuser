import { get_current_user_name } from '../utils/helpers.js';
import './audit_images_view_component.css';
import '../../css/components/attach_media_modal.css';
import { build_compact_hash_fragment } from '../logic/router_url_codec.js';
import { get_requirement_public_key, find_requirement_definition, definition_primary_id, resolve_map_entry } from '../audit_logic.js';
import { get_current_view_name } from '../app/browser_globals.js';
import {
    build_audit_images_view_fingerprint,
    build_audit_images_structure_fingerprint,
    get_audit_images_card_count_label
} from '../logic/audit_images_view_incremental.js';
import { sort_audit_image_card_groups } from '../logic/sample_attached_media_normalize.js';
import {
    create_sample_screenshot_card,
    group_key_for_image_item,
    is_sample_screenshot_media_item,
    open_sample_screenshot_attach_modal,
    patch_sample_screenshot_card
} from './audit_images_sample_screenshot.js';
import { open_attach_media_modal } from './media/AttachMediaModal.js';
import { can_edit_observation_detail } from '../logic/audit_observation_edit_policy.js';
import { fill_audit_media_filenames_list, revoke_audit_media_blob_urls } from './media/render_audit_media_list_item.js';
import { collect_attached_media_filenames } from '../logic/audit_attached_media_references.js';

export class AuditImagesViewComponent {
    constructor() {        this.root = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.AuditLogic = null;
        this.unsubscribe = null;
        this.plate_element_ref = null;
        this.list_wrapper_ref = null;
        this.images_h1_ref = null;
        this.is_dom_initialized = false;
        this._last_images_fingerprint = null;
        this._last_images_structure_fingerprint = null;
    }

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;

        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.AuditLogic = deps.AuditLogic;

        this.handle_requirement_link_click = this.handle_requirement_link_click.bind(this);
        this.handle_attach_media_click = this.handle_attach_media_click.bind(this);
        this.handle_sample_attach_media_click = this.handle_sample_attach_media_click.bind(this);

        this.unsubscribe = null;
        if (typeof deps.subscribe === 'function') {
            this.unsubscribe = deps.subscribe((_new_state, listener_meta) => {
                if (listener_meta?.skip_render) return;
                if (this.root && get_current_view_name() === 'audit_images' && typeof this.render === 'function') {
                    this.render();
                }
            });
        }
    }

    build_hash(view_name, params = {}) {
        return `#${build_compact_hash_fragment(view_name, params && typeof params === 'object' ? params : {})}`;
    }

    handle_requirement_link_click(event) {
        event.preventDefault();
        const target = event.currentTarget;
        const sample_id = target?.getAttribute?.('data-sample-id');
        const requirement_id = target?.getAttribute?.('data-requirement-id');
        if (sample_id && requirement_id && typeof this.router === 'function') {
            this.router('requirement_audit', { sampleId: sample_id, requirementId: requirement_id });
        }
    }

    handle_sample_attach_media_click(event) {
        const btn = event.target.closest('button[data-action="attach-sample-media"]');
        if (!btn) return;
        event.preventDefault();
        const sample_id = btn.getAttribute('data-sample-id');
        if (!sample_id) return;
        open_sample_screenshot_attach_modal(this, sample_id, btn);
    }

    handle_attach_media_click(event) {
        const btn = event.target.closest('button[data-action="attach-media"]');
        if (!btn || !this.Helpers?.create_element) return;
        event.preventDefault();

        const sample_id = btn.getAttribute('data-sample-id');
        const req_id_public = btn.getAttribute('data-requirement-id');
        const req_id_map = btn.getAttribute('data-requirement-map-id');
        const check_id = btn.getAttribute('data-check-id');
        const pc_id = btn.getAttribute('data-pc-id');
        if (!sample_id || !req_id_public || !req_id_map || !check_id || !pc_id) return;

        const state = this.getState();
        const sample = state?.samples?.find((s) => String(s.id) === String(sample_id));
        const requirement_result_ref = sample?.requirementResults?.[req_id_map];

        const t = this.Translation.t;
        const chk_resolved = requirement_result_ref
            ? resolve_map_entry(requirement_result_ref.checkResults, check_id)
            : null;
        const check_result_for_read = chk_resolved?.value;
        const pc_resolved = check_result_for_read?.passCriteria
            ? resolve_map_entry(check_result_for_read.passCriteria, pc_id)
            : null;
        const existing_filenames = pc_resolved?.value?.attachedMediaFilenames;
        let initial_filenames = Array.isArray(existing_filenames) ? existing_filenames : [];
        if (initial_filenames.length === 0) {
            const section = btn.closest('.audit-image-card__pc-section');
            if (section) {
                initial_filenames = Array.from(
                    section.querySelectorAll('.audit-image-card__media-name')
                )
                    .map((el) => String(el.textContent || '').trim())
                    .filter(Boolean);
            }
        }

        open_attach_media_modal({
            t,
            Helpers: this.Helpers,
            audit_id: state?.auditId ?? null,
            initial_filenames,
            textarea_id: 'attach-media-filenames-images-view',
            media_scope: 'requirement',
            trigger_element: btn,
            get_still_referenced_filenames_after_save: (final_filenames) =>
                collect_attached_media_filenames(state, {
                    type: 'pc',
                    sampleId: sample_id,
                    requirementId: req_id_map,
                    checkId: check_id,
                    pcId: pc_id,
                    filenames: final_filenames
                }),
            get_observation_detail: () => {
                const chk_live = requirement_result_ref
                    ? resolve_map_entry(requirement_result_ref.checkResults, check_id)
                    : null;
                const pc_live = chk_live?.value?.passCriteria
                    ? resolve_map_entry(chk_live.value.passCriteria, pc_id)
                    : null;
                return String(pc_live?.value?.observationDetail || '');
            },
            get_observation_edit: () => this._build_observation_edit_options(
                { sample, reqId: req_id_map },
                req_id_public,
                check_id,
                pc_id,
                can_edit_observation_detail(state.auditStatus)
            ),
            on_save: (filenames) => {
                if (!requirement_result_ref) return;
                const chk_save = resolve_map_entry(requirement_result_ref.checkResults, check_id);
                const check_result = chk_save?.value;
                const pc_save = check_result?.passCriteria
                    ? resolve_map_entry(check_result.passCriteria, pc_id)
                    : null;
                if (!pc_save?.value) return;

                pc_save.value.attachedMediaFilenames = filenames;

                const requirements = state?.ruleFileContent?.requirements;
                const requirement = find_requirement_definition(requirements, req_id_public) || null;
                if (requirement && this.AuditLogic) {
                    (requirement.checks || []).forEach((check_def) => {
                        const resolved = resolve_map_entry(
                            requirement_result_ref.checkResults,
                            definition_primary_id(check_def)
                        );
                        const check_res = resolved?.value;
                        if (check_res) {
                            check_res.status = this.AuditLogic.calculate_check_status(
                                check_def,
                                check_res.passCriteria,
                                check_res.overallStatus
                            );
                        }
                    });
                    requirement_result_ref.status = this.AuditLogic.calculate_requirement_status(requirement, requirement_result_ref);
                    requirement_result_ref.lastStatusUpdate = this.Helpers.get_current_iso_datetime_utc?.() || new Date().toISOString();
                    requirement_result_ref.lastStatusUpdateBy = get_current_user_name();
                }

                this.dispatch({
                    type: this.StoreActionTypes.UPDATE_REQUIREMENT_RESULT,
                    payload: {
                        sampleId: sample.id,
                        requirementId: req_id_map,
                        newRequirementResult: requirement_result_ref,
                        skip_render: true
                    }
                });
                if (typeof this.deps?.refreshSideMenuAndTitle === 'function') {
                    this.deps.refreshSideMenuAndTitle();
                }
                if (this.root && typeof this.render === 'function' && get_current_view_name() === 'audit_images') {
                    this.render();
                }
            }
        });
    }

    _save_pc_observation_detail(sample_id, req_id_map, req_id_public, check_id, pc_id, text) {
        const state = this.getState();
        const sample = state?.samples?.find((s) => String(s.id) === String(sample_id));
        const requirement_result_ref = sample?.requirementResults?.[req_id_map];
        if (!requirement_result_ref) return;

        const chk_save = resolve_map_entry(requirement_result_ref.checkResults, check_id);
        const check_result = chk_save?.value;
        const pc_save = check_result?.passCriteria
            ? resolve_map_entry(check_result.passCriteria, pc_id)
            : null;
        if (!pc_save?.value) return;

        pc_save.value.observationDetail = text;

        const requirements = state?.ruleFileContent?.requirements;
        const requirement = find_requirement_definition(requirements, req_id_public) || null;
        if (requirement && this.AuditLogic) {
            (requirement.checks || []).forEach((check_def) => {
                const resolved = resolve_map_entry(
                    requirement_result_ref.checkResults,
                    definition_primary_id(check_def)
                );
                const check_res = resolved?.value;
                if (check_res) {
                    check_res.status = this.AuditLogic.calculate_check_status(
                        check_def,
                        check_res.passCriteria,
                        check_res.overallStatus
                    );
                }
            });
            requirement_result_ref.status = this.AuditLogic.calculate_requirement_status(requirement, requirement_result_ref);
            requirement_result_ref.lastStatusUpdate = this.Helpers.get_current_iso_datetime_utc?.() || new Date().toISOString();
            requirement_result_ref.lastStatusUpdateBy = get_current_user_name();
        }

        this.dispatch({
            type: this.StoreActionTypes.UPDATE_REQUIREMENT_RESULT,
            payload: {
                sampleId: sample.id,
                requirementId: req_id_map,
                newRequirementResult: requirement_result_ref,
                skip_render: true
            }
        });
        if (typeof this.deps?.refreshSideMenuAndTitle === 'function') {
            this.deps.refreshSideMenuAndTitle();
        }
        if (this.root && typeof this.render === 'function' && get_current_view_name() === 'audit_images') {
            this.render();
        }
    }

    _build_observation_edit_options(group, public_req_id, check_id, pc_id, can_edit_observation) {
        if (!can_edit_observation || !check_id || !pc_id || !group?.sample?.id || !group?.reqId) {
            return null;
        }
        return {
            can_edit: true,
            on_save: (text) => this._save_pc_observation_detail(
                group.sample.id,
                group.reqId,
                public_req_id,
                check_id,
                pc_id,
                text
            )
        };
    }

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        const state = this.getState();

        if (!state?.ruleFileContent) {
            this._render_images_error_plate(t('audit_images_title'), t('error_no_active_audit'));
            return;
        }

        const images = this.AuditLogic?.collect_attached_images ? this.AuditLogic.collect_attached_images(state) : [];
        if (!this.is_dom_initialized || !this.plate_element_ref?.isConnected) {
            this._build_images_dom_shell(t);
            this.is_dom_initialized = true;
        }
        const is_audit_locked = state.auditStatus === 'locked' || state.auditStatus === 'archived';
        this._update_images_header(images, t);
        this._sync_image_cards(this.group_images_by_requirement_sample(images), images, t, is_audit_locked);
    }

    _update_images_header(images, t) {
        if (!this.images_h1_ref) return;
        const media_count = Array.isArray(images) ? images.length : 0;
        this.images_h1_ref.textContent = media_count > 0
            ? t('audit_images_title_with_count', { count: String(media_count) })
            : t('audit_images_title');
    }

    _render_images_error_plate(title, message) {
        this.is_dom_initialized = false;
        this.plate_element_ref = null;
        this.list_wrapper_ref = null;
        this.images_h1_ref = null;
        this._last_images_fingerprint = null;
        this._last_images_structure_fingerprint = null;
        this.root.innerHTML = '';
        const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
        plate.appendChild(this.Helpers.create_element('h1', { text_content: title }));
        plate.appendChild(this.Helpers.create_element('p', { text_content: message }));
        this.root.appendChild(plate);
    }

    _build_images_dom_shell(t) {
        this.root.innerHTML = '';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate audit-images-plate' });
        this.root.appendChild(this.plate_element_ref);
        this.images_h1_ref = this.Helpers.create_element('h1', {
            id: 'main-content-heading',
            attributes: { tabindex: '-1' }
        });
        this.plate_element_ref.appendChild(this.images_h1_ref);
        this.plate_element_ref.appendChild(this.Helpers.create_element('p', {
            class_name: 'audit-images-intro',
            text_content: t('audit_images_intro')
        }));
        this.list_wrapper_ref = this.Helpers.create_element('div', { class_name: 'audit-images-list' });
        this.plate_element_ref.appendChild(this.list_wrapper_ref);
        this._last_images_fingerprint = null;
        this._last_images_structure_fingerprint = null;
    }

    _sync_image_cards(grouped, images, t, is_audit_locked) {
        if (!this.list_wrapper_ref) return;

        const content_fingerprint = build_audit_images_view_fingerprint(images);
        const structure_fingerprint = build_audit_images_structure_fingerprint(images);

        if (content_fingerprint === this._last_images_fingerprint) {
            return;
        }

        if (
            this._last_images_structure_fingerprint
            && structure_fingerprint === this._last_images_structure_fingerprint
        ) {
            grouped.forEach((group) => {
                this._patch_image_card_filenames(group, t, is_audit_locked);
            });
            this._last_images_fingerprint = content_fingerprint;
            return;
        }

        this.list_wrapper_ref.innerHTML = '';
        if (grouped.length === 0) {
            this.list_wrapper_ref.appendChild(this.Helpers.create_element('p', {
                class_name: 'audit-images-empty',
                text_content: t('audit_images_empty')
            }));
        } else {
            grouped.forEach((group) => {
                this.list_wrapper_ref.appendChild(this.create_image_card(group, t, is_audit_locked));
            });
        }

        this._last_images_fingerprint = content_fingerprint;
        this._last_images_structure_fingerprint = structure_fingerprint;
    }

    _patch_image_card_filenames(group, t, is_audit_locked) {
        const audit_id = this.getState()?.auditId ?? null;
        if (group.is_sample_screenshot) {
            patch_sample_screenshot_card(this.list_wrapper_ref, group, t, audit_id);
            return;
        }

        const card = this.list_wrapper_ref?.querySelector(
            `.audit-image-card[data-req-map-id="${CSS.escape(String(group.reqId || ''))}"][data-sample-id="${CSS.escape(String(group.sample?.id || ''))}"]`
        );
        if (!card) return;

        const count_strong = card.querySelector('.audit-image-card__count strong');
        if (count_strong) {
            count_strong.textContent = get_audit_images_card_count_label(t, group.items.length);
        }

        const pc_groups = this.group_items_by_check_pc(group.items);
        pc_groups.forEach(({ check_def, pc_def, check_index, pc_index, filenames, observation_detail }) => {
            const dom_check_id = definition_primary_id(check_def);
            const dom_pc_id = definition_primary_id(pc_def);
            if (!dom_check_id || !dom_pc_id) return;

            const section = card.querySelector(
                `.audit-image-card__pc-section[data-check-id="${CSS.escape(dom_check_id)}"][data-pc-id="${CSS.escape(dom_pc_id)}"]`
            );
            if (!section) return;

            const ul = section.querySelector('ul.audit-image-card__filenames');
            if (ul) {
                const requirements = this.getState()?.ruleFileContent?.requirements;
                const public_req_id = get_requirement_public_key(requirements, group.reqId) || String(group.reqId || '');
                const observation_edit = this._build_observation_edit_options(
                    group,
                    public_req_id,
                    dom_check_id,
                    dom_pc_id,
                    can_edit_observation_detail(this.getState()?.auditStatus)
                );
                fill_audit_media_filenames_list(
                    ul,
                    this.Helpers,
                    t,
                    audit_id,
                    filenames,
                    observation_detail,
                    observation_edit
                );
            }

            const attach_btn = section.querySelector('button[data-action="attach-media"]');
            if (attach_btn) {
                const attach_btn_label = t('edit_attached_media_button', { count: filenames.length });
                const span = attach_btn.querySelector('span');
                if (span) {
                    span.textContent = attach_btn_label;
                }
                attach_btn.setAttribute(
                    'aria-label',
                    `${attach_btn_label} ${t('attach_media_aria_label_for')} ${t('pass_criterion_label')} ${check_index >= 0 && pc_index >= 0 ? `${check_index + 1}.${pc_index + 1}` : ''}`
                );
            } else if (!is_audit_locked) {
                /* Knappen saknas — strukturen stämmer men låsning kan ha ändrats; full omritning hanteras vid strukturbyte. */
            }
        });
    }

    group_images_by_requirement_sample(images) {
        const map = new Map();
        images.forEach((item) => {
            const key = group_key_for_image_item(item);
            if (!map.has(key)) {
                map.set(key, {
                    is_sample_screenshot: is_sample_screenshot_media_item(item),
                    requirement: item.requirement,
                    sample: item.sample,
                    reqId: item.reqId,
                    items: []
                });
            }
            map.get(key).items.push(item);
        });
        return sort_audit_image_card_groups(Array.from(map.values()));
    }

    create_image_card(group, t, is_audit_locked = false) {
        if (group.is_sample_screenshot) {
            return create_sample_screenshot_card(this, group, t, is_audit_locked, this.handle_sample_attach_media_click);
        }

        const card = this.Helpers.create_element('article', {
            class_name: 'audit-image-card',
            attributes: {
                'data-req-map-id': group.reqId || '',
                'data-sample-id': group.sample?.id || ''
            }
        });

        const req_title = group.requirement?.title || group.reqId || '';
        const std_ref = group.requirement?.standardReference;
        const ref_text = std_ref?.text?.trim() || '';
        const ref_url = std_ref?.url?.trim() || '';
        const sample_name = group.sample?.description || group.sample?.id || '';
        const sample_url = group.sample?.url?.trim() || '';
        const total_count = group.items.length;

        const requirements = this.getState()?.ruleFileContent?.requirements;
        const public_req_id = get_requirement_public_key(requirements, group.reqId) || String(group.reqId || '');

        const req_row = this.Helpers.create_element('h2', { class_name: 'audit-image-card__row audit-image-card__requirement-row' });
        const req_label = this.Helpers.create_element('span', {
            class_name: 'audit-image-card__label',
            text_content: `${t('audit_images_card_requirement_label')} `
        });
        req_row.appendChild(req_label);
        const req_link = this.Helpers.create_element('a', {
            attributes: {
                href: this.build_hash('requirement_audit', { sampleId: group.sample?.id, requirementId: public_req_id }),
                'data-sample-id': group.sample?.id || '',
                'data-requirement-id': public_req_id,
                'data-requirement-map-id': group.reqId || ''
            },
            text_content: req_title
        });
        req_link.addEventListener('click', this.handle_requirement_link_click);
        req_row.appendChild(req_link);
        card.appendChild(req_row);

        if (ref_text) {
            const ref_row = this.Helpers.create_element('p', { class_name: 'audit-image-card__row' });
            const ref_label = this.Helpers.create_element('span', {
                class_name: 'audit-image-card__label',
                text_content: `${t('audit_images_card_reference_label')} `
            });
            ref_row.appendChild(ref_label);
            if (ref_url && this.Helpers.add_protocol_if_missing) {
                const icon_html = this.Helpers.get_external_link_icon_html ? this.Helpers.get_external_link_icon_html(t) : ' ↗';
                const ref_link = this.Helpers.create_element('a', {
                    attributes: {
                        href: this.Helpers.add_protocol_if_missing(ref_url),
                        target: '_blank',
                        rel: 'noopener noreferrer'
                    },
                    html_content: (this.Helpers.escape_html ? this.Helpers.escape_html(ref_text) : ref_text) + icon_html
                });
                ref_row.appendChild(ref_link);
            } else {
                ref_row.appendChild(document.createTextNode(ref_text));
            }
            card.appendChild(ref_row);
        }

        const sample_row = this.Helpers.create_element('p', { class_name: 'audit-image-card__row' });
        const sample_label = this.Helpers.create_element('span', {
            class_name: 'audit-image-card__label',
            text_content: `${t('audit_images_card_sample_label')} `
        });
        sample_row.appendChild(sample_label);
        if (sample_url && this.Helpers.add_protocol_if_missing) {
            const icon_html = this.Helpers.get_external_link_icon_html ? this.Helpers.get_external_link_icon_html(t) : ' ↗';
            const sample_link = this.Helpers.create_element('a', {
                attributes: {
                    href: this.Helpers.add_protocol_if_missing(sample_url),
                    target: '_blank',
                    rel: 'noopener noreferrer'
                },
                html_content: (this.Helpers.escape_html ? this.Helpers.escape_html(sample_name || sample_url) : (sample_name || sample_url)) + icon_html
            });
            sample_row.appendChild(sample_link);
        } else {
            sample_row.appendChild(document.createTextNode(sample_name || ''));
        }
        card.appendChild(sample_row);

        const count_row = this.Helpers.create_element('p', {
            class_name: 'audit-image-card__count',
            html_content: `<strong>${this.Helpers.escape_html(get_audit_images_card_count_label(t, total_count))}</strong>`
        });
        card.appendChild(count_row);

        const audit_id = this.getState()?.auditId ?? null;
        const pc_groups = this.group_items_by_check_pc(group.items);
        pc_groups.forEach(({ check_def, pc_def, check_index, pc_index, filenames, observation_detail }) => {
            const dom_check_id = definition_primary_id(check_def);
            const dom_pc_id = definition_primary_id(pc_def);
            const section = this.Helpers.create_element('div', {
                class_name: 'audit-image-card__pc-section',
                attributes: {
                    'data-check-id': dom_check_id || '',
                    'data-pc-id': dom_pc_id || ''
                }
            });
            const check_num = check_index >= 0 ? check_index + 1 : '';
            const pc_num = check_index >= 0 && pc_index >= 0 ? `${check_index + 1}.${pc_index + 1}` : '';
            if (check_def?.condition) {
                const check_label_p = this.Helpers.create_element('p', {
                    class_name: 'audit-image-card__checkpoint',
                    html_content: `<strong>${this.Helpers.escape_html(t('check_item_title'))} ${check_num}:</strong>`
                });
                section.appendChild(check_label_p);
                const check_text_p = this.Helpers.create_element('p', {
                    class_name: 'audit-image-card__checkpoint-text',
                    text_content: check_def.condition
                });
                section.appendChild(check_text_p);
            }
            if (pc_def?.requirement) {
                const pc_label_p = this.Helpers.create_element('p', {
                    class_name: 'audit-image-card__pass-criterion',
                    html_content: `<strong>${this.Helpers.escape_html(t('pass_criterion_label'))} ${pc_num}:</strong>`
                });
                section.appendChild(pc_label_p);
                const pc_text_p = this.Helpers.create_element('p', {
                    class_name: 'audit-image-card__pass-criterion-text',
                    text_content: pc_def.requirement
                });
                section.appendChild(pc_text_p);
            }
            const ul = this.Helpers.create_element('ul', { class_name: 'audit-image-card__filenames' });
            const observation_edit = this._build_observation_edit_options(
                group,
                public_req_id,
                dom_check_id,
                dom_pc_id,
                can_edit_observation_detail(this.getState()?.auditStatus)
            );
            fill_audit_media_filenames_list(
                ul,
                this.Helpers,
                t,
                audit_id,
                filenames,
                observation_detail,
                observation_edit
            );
            section.appendChild(ul);

            if (!is_audit_locked && dom_check_id && dom_pc_id) {
                const image_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('image', ['currentColor'], 16) : '';
                const video_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('videocam', ['currentColor'], 16) : '';
                const attach_icons_html = (image_icon || video_icon)
                    ? `<span class="attach-media-button-icons" aria-hidden="true">${image_icon}${video_icon}</span>`
                    : '';
                const attach_btn_label = t('edit_attached_media_button', { count: filenames.length });
                const attach_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small', 'audit-images-attach-btn'],
                    attributes: {
                        'data-action': 'attach-media',
                        'data-sample-id': group.sample?.id || '',
                        'data-requirement-id': public_req_id,
                        'data-requirement-map-id': group.reqId || '',
                        'data-check-id': dom_check_id,
                        'data-pc-id': dom_pc_id,
                        type: 'button',
                        'aria-label': `${attach_btn_label} ${t('attach_media_aria_label_for')} ${t('pass_criterion_label')} ${check_index >= 0 && pc_index >= 0 ? `${check_index + 1}.${pc_index + 1}` : ''}`
                    },
                    html_content: `<span>${this.Helpers.escape_html(attach_btn_label)}</span>${attach_icons_html}`
                });
                attach_btn.addEventListener('click', this.handle_attach_media_click);
                section.appendChild(attach_btn);
            }

            card.appendChild(section);
        });

        return card;
    }

    group_items_by_check_pc(items) {
        const map = new Map();
        items.forEach((item) => {
            const key = `${item.checkId}::${item.pcId}`;
            if (!map.has(key)) {
                map.set(key, {
                    check_def: item.check_def,
                    pc_def: item.pc_def,
                    check_index: item.check_index,
                    pc_index: item.pc_index,
                    observation_detail: String(item.observationDetail || '').trim(),
                    filenames: []
                });
            }
            map.get(key).filenames.push(item.filename);
        });
        return Array.from(map.values());
    }

    destroy() {
        const audit_id = this.getState?.()?.auditId ?? null;
        revoke_audit_media_blob_urls(audit_id);
        if (typeof this.unsubscribe === 'function') {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.plate_element_ref = null;
        this.list_wrapper_ref = null;
        this.images_h1_ref = null;
        this.is_dom_initialized = false;
        this._last_images_fingerprint = null;
        this._last_images_structure_fingerprint = null;
        this.root = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.AuditLogic = null;
    }
}
