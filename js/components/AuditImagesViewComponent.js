export const AuditImagesViewComponent = {
    CSS_PATH: 'css/components/audit_images_view_component.css',

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

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }

        this.handle_requirement_link_click = this.handle_requirement_link_click.bind(this);
        this.handle_attach_media_click = this.handle_attach_media_click.bind(this);

        this.unsubscribe = null;
        if (typeof deps.subscribe === 'function') {
            this.unsubscribe = deps.subscribe(() => {
                if (this.root && window.__gv_current_view_name === 'audit_images' && typeof this.render === 'function') {
                    this.render();
                }
            });
        }
    },

    build_hash(view_name, params = {}) {
        const has_params = params && Object.keys(params).length > 0;
        if (!has_params) return `#${view_name}`;
        return `#${view_name}?${new URLSearchParams(params).toString()}`;
    },

    handle_requirement_link_click(event) {
        event.preventDefault();
        const target = event.currentTarget;
        const sample_id = target?.getAttribute?.('data-sample-id');
        const requirement_id = target?.getAttribute?.('data-requirement-id');
        if (sample_id && requirement_id && typeof this.router === 'function') {
            this.router('requirement_audit', { sampleId: sample_id, requirementId: requirement_id });
        }
    },

    handle_attach_media_click(event) {
        const btn = event.target.closest('button[data-action="attach-media"]');
        if (!btn) return;
        event.preventDefault();

        const sample_id = btn.getAttribute('data-sample-id');
        const req_id = btn.getAttribute('data-requirement-id');
        const check_id = btn.getAttribute('data-check-id');
        const pc_id = btn.getAttribute('data-pc-id');
        if (!sample_id || !req_id || !check_id || !pc_id) return;

        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;

        const state = this.getState();
        const sample = state?.samples?.find(s => s.id === sample_id);
        const requirement_result_ref = sample?.requirementResults?.[req_id];
        if (!requirement_result_ref) return;

        const t = this.Translation.t;
        ModalComponent.show(
            {
                h1_text: t('attach_media_modal_h1'),
                message_text: t('attach_media_modal_intro')
            },
            (container, modal) => {
                const form_group = this.Helpers.create_element('div', { class_name: 'form-group' });
                const label = this.Helpers.create_element('label', {
                    attributes: { for: 'attach-media-filenames' },
                    text_content: t('attach_media_modal_filename_label')
                });
                form_group.appendChild(label);

                const existing_filenames = requirement_result_ref?.checkResults?.[check_id]?.passCriteria?.[pc_id]?.attachedMediaFilenames;
                const initial_text = Array.isArray(existing_filenames) ? existing_filenames.join('\n') : '';
                const textarea = this.Helpers.create_element('textarea', {
                    id: 'attach-media-filenames',
                    class_name: 'form-control',
                    attributes: { rows: '3' }
                });
                textarea.value = initial_text;
                if (this.Helpers?.init_auto_resize_for_textarea) {
                    this.Helpers.init_auto_resize_for_textarea(textarea);
                }
                form_group.appendChild(textarea);
                container.appendChild(form_group);

                const actions_wrapper = this.Helpers.create_element('div', { class_name: 'modal-attach-media-actions' });
                const save_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('attach_media_modal_save')
                });
                save_btn.addEventListener('click', () => {
                    const filenames = textarea.value
                        .split('\n')
                        .map(s => s.trim())
                        .filter(Boolean);
                    const check_result = requirement_result_ref?.checkResults?.[check_id];
                    if (check_result?.passCriteria?.[pc_id]) {
                        check_result.passCriteria[pc_id].attachedMediaFilenames = filenames;

                        const requirements = state?.ruleFileContent?.requirements;
                        const requirement = (Array.isArray(requirements)
                            ? requirements.find(r => (r?.key || r?.id) === req_id)
                            : requirements?.[req_id]) || null;
                        if (requirement && this.AuditLogic) {
                            (requirement.checks || []).forEach(check_def => {
                                const check_res = requirement_result_ref.checkResults[check_def.id];
                                if (check_res) {
                                    check_res.status = this.AuditLogic.calculate_check_status(check_def, check_res.passCriteria, check_res.overallStatus);
                                }
                            });
                            requirement_result_ref.status = this.AuditLogic.calculate_requirement_status(requirement, requirement_result_ref);
                            requirement_result_ref.lastStatusUpdate = this.Helpers.get_current_iso_datetime_utc?.() || new Date().toISOString();
                        }

                        this.dispatch({
                            type: this.StoreActionTypes.UPDATE_REQUIREMENT_RESULT,
                            payload: {
                                sampleId: sample_id,
                                requirementId: req_id,
                                newRequirementResult: requirement_result_ref,
                                skip_render: true
                            }
                        });
                    }
                    modal.close(save_btn);
                });
                const discard_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    attributes: { type: 'button' },
                    text_content: t('attach_media_modal_discard')
                });
                discard_btn.addEventListener('click', () => {
                    modal.close(discard_btn);
                });
                actions_wrapper.appendChild(save_btn);
                actions_wrapper.appendChild(discard_btn);
                container.appendChild(actions_wrapper);
            }
        );
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';

        const state = this.getState();
        if (!state?.ruleFileContent) {
            const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
            plate.appendChild(this.Helpers.create_element('h1', { text_content: t('audit_images_title') }));
            plate.appendChild(this.Helpers.create_element('p', { text_content: t('error_no_active_audit') }));
            this.root.appendChild(plate);
            return;
        }

        const images = this.AuditLogic?.collect_attached_images ? this.AuditLogic.collect_attached_images(state) : [];

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate audit-images-plate' });
        this.root.appendChild(plate);

        const h1 = this.Helpers.create_element('h1', { text_content: t('audit_images_title') });
        plate.appendChild(h1);

        const intro = this.Helpers.create_element('p', {
            class_name: 'audit-images-intro',
            text_content: t('audit_images_intro')
        });
        plate.appendChild(intro);

        const list_wrapper = this.Helpers.create_element('div', { class_name: 'audit-images-list' });
        plate.appendChild(list_wrapper);

        if (images.length === 0) {
            const empty_msg = this.Helpers.create_element('p', {
                class_name: 'audit-images-empty',
                text_content: t('audit_images_empty')
            });
            list_wrapper.appendChild(empty_msg);
        } else {
            const grouped = this.group_images_by_requirement_sample(images);
            const is_audit_locked = state.auditStatus === 'locked';
            grouped.forEach((group) => {
                const card = this.create_image_card(group, t, is_audit_locked);
                list_wrapper.appendChild(card);
            });
        }
    },

    group_images_by_requirement_sample(images) {
        const map = new Map();
        images.forEach((item) => {
            const key = `${item.reqId}::${item.sample?.id || ''}`;
            if (!map.has(key)) {
                map.set(key, {
                    requirement: item.requirement,
                    sample: item.sample,
                    reqId: item.reqId,
                    items: []
                });
            }
            map.get(key).items.push(item);
        });
        return Array.from(map.values());
    },

    create_image_card(group, t, is_audit_locked = false) {
        const card = this.Helpers.create_element('article', { class_name: 'audit-image-card' });

        const req_title = group.requirement?.title || group.reqId || '';
        const std_ref = group.requirement?.standardReference;
        const ref_text = std_ref?.text?.trim() || '';
        const ref_url = std_ref?.url?.trim() || '';
        const sample_name = group.sample?.description || group.sample?.id || '';
        const sample_url = group.sample?.url?.trim() || '';
        const total_count = group.items.length;

        const req_row = this.Helpers.create_element('h2', { class_name: 'audit-image-card__row audit-image-card__requirement-row' });
        const req_label = this.Helpers.create_element('span', {
            class_name: 'audit-image-card__label',
            text_content: `${t('audit_images_card_requirement_label')} `
        });
        req_row.appendChild(req_label);
        const req_link = this.Helpers.create_element('a', {
            attributes: {
                href: this.build_hash('requirement_audit', { sampleId: group.sample?.id, requirementId: group.reqId }),
                'data-sample-id': group.sample?.id || '',
                'data-requirement-id': group.reqId || ''
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
                const ref_link = this.Helpers.create_element('a', {
                    attributes: {
                        href: this.Helpers.add_protocol_if_missing(ref_url),
                        target: '_blank',
                        rel: 'noopener noreferrer'
                    },
                    text_content: ref_text
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
            const sample_link = this.Helpers.create_element('a', {
                attributes: {
                    href: this.Helpers.add_protocol_if_missing(sample_url),
                    target: '_blank',
                    rel: 'noopener noreferrer'
                },
                text_content: sample_name || sample_url
            });
            sample_row.appendChild(sample_link);
        } else {
            sample_row.appendChild(document.createTextNode(sample_name || ''));
        }
        card.appendChild(sample_row);

        const pc_groups = this.group_items_by_check_pc(group.items);
        pc_groups.forEach(({ check_def, pc_def, check_index, pc_index, filenames }, idx) => {
            const section = this.Helpers.create_element('div', { class_name: 'audit-image-card__pc-section' });
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
            if (idx === 0) {
                const count_row = this.Helpers.create_element('p', {
                    class_name: 'audit-image-card__count',
                    html_content: `<strong>${this.Helpers.escape_html(t('audit_images_card_count', { count: total_count }))}</strong>`
                });
                section.appendChild(count_row);
            }
            const ul = this.Helpers.create_element('ul', { class_name: 'audit-image-card__filenames' });
            filenames.forEach((fn) => {
                const li = this.Helpers.create_element('li', { text_content: fn });
                ul.appendChild(li);
            });
            section.appendChild(ul);

            if (!is_audit_locked && check_def?.id && pc_def?.id) {
                const image_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('image', ['currentColor'], 16) : '';
                const video_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('videocam', ['currentColor'], 16) : '';
                const attach_icons_html = (image_icon || video_icon)
                    ? `<span class="attach-media-button-icons" aria-hidden="true">${image_icon}${video_icon}</span>`
                    : '';
                const attach_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small', 'audit-images-attach-btn'],
                    attributes: {
                        'data-action': 'attach-media',
                        'data-sample-id': group.sample?.id || '',
                        'data-requirement-id': group.reqId || '',
                        'data-check-id': check_def.id,
                        'data-pc-id': pc_def.id,
                        type: 'button',
                        'aria-label': `${t('audit_images_edit_media_button')} ${t('attach_media_aria_label_for')} ${t('pass_criterion_label')} ${check_index >= 0 && pc_index >= 0 ? `${check_index + 1}.${pc_index + 1}` : ''}`
                    },
                    html_content: `<span>${this.Helpers.escape_html(t('audit_images_edit_media_button'))}</span>${attach_icons_html}`
                });
                attach_btn.addEventListener('click', this.handle_attach_media_click);
                section.appendChild(attach_btn);
            }

            card.appendChild(section);
        });

        return card;
    },

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
                    filenames: []
                });
            }
            map.get(key).filenames.push(item.filename);
        });
        return Array.from(map.values());
    },

    destroy() {
        if (typeof this.unsubscribe === 'function') {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        if (this.root) {
            this.root.innerHTML = '';
        }
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
};
