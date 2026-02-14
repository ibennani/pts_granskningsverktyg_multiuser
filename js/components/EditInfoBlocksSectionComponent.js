// js/components/EditInfoBlocksSectionComponent.js

export const EditInfoBlocksSectionComponent = {
    CSS_PATH: 'css/components/rulefile_sections_view.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.AutosaveService = deps.AutosaveService;
        this.edit_baseline = null;
        this.autosave_session = null;
        this.handle_autosave_input = this.handle_autosave_input.bind(this);

        if (this.Helpers?.load_css) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
    },

    handle_autosave_input() {
        this.autosave_session?.request_autosave?.();
    },

    _get_block_display_name(block_id) {
        const t = this.Translation.t;
        const name_map = {
            'expectedObservation': t('requirement_expected_observation'),
            'instructions': t('requirement_instructions'),
            'exceptions': t('requirement_exceptions'),
            'commonErrors': t('requirement_common_errors'),
            'tips': t('requirement_tips'),
            'examples': t('requirement_examples')
        };
        return name_map[block_id] || block_id;
    },

    _get_custom_block_name_from_requirements(block_id) {
        const requirements = this.getState()?.ruleFileContent?.requirements || {};
        for (const req of Object.values(requirements)) {
            const name = req?.infoBlocks?.[block_id]?.name;
            if (typeof name === 'string') return name;
        }
        return '';
    },

    _count_requirements_with_info_block_text(block_id) {
        const requirements = this.getState()?.ruleFileContent?.requirements || {};
        let count = 0;
        for (const req of Object.values(requirements)) {
            const text = req?.infoBlocks?.[block_id]?.text;
            if (typeof text === 'string' && text.trim().length > 0) {
                count += 1;
            }
        }
        return count;
    },

    _save_info_blocks_order(new_order, block_names = {}, skip_render = false) {
        const state = this.getState();
        const currentRulefile = state?.ruleFileContent || {};
        const metadata = currentRulefile.metadata || {};
        const requirements = { ...currentRulefile.requirements };

        if (!metadata.blockOrders) metadata.blockOrders = {};
        metadata.blockOrders = { ...metadata.blockOrders, infoBlocks: new_order };

        if (Object.keys(block_names).length > 0) {
            for (const [req_id, req] of Object.entries(requirements)) {
                const base_blocks = req?.infoBlocks && typeof req.infoBlocks === 'object' ? req.infoBlocks : {};
                const new_info_blocks = { ...base_blocks };
                for (const [block_id, name] of Object.entries(block_names)) {
                    const existing = new_info_blocks[block_id];
                    new_info_blocks[block_id] = existing
                        ? { ...existing, name }
                        : { name, expanded: true, text: '' };
                }
                const order_set = new Set(new_order);
                const filtered = Object.fromEntries(
                    Object.entries(new_info_blocks).filter(([id]) => order_set.has(id))
                );
                requirements[req_id] = { ...req, infoBlocks: filtered };
            }
        }

        const updatedRulefileContent = {
            ...currentRulefile,
            metadata,
            requirements
        };

        this.dispatch({
            type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: updatedRulefileContent, skip_render }
        });
    },

    _remove_info_block_from_dom(list_item, list) {
        const items = Array.from(list.children);
        const idx = items.indexOf(list_item);
        const was_last = idx === items.length - 1;
        list_item.remove();
        if (was_last && items.length > 1) {
            const new_last = items[idx - 1];
            const down_slots = new_last.querySelectorAll('.info-blocks-order-btn-slot');
            if (down_slots[1]) down_slots[1].innerHTML = '';
        }
    },

    _handle_info_block_order_move(ol, direction, idx) {
        const items = Array.from(ol.children);
        const inputs = items.map(li => li.querySelector('.info-blocks-order-name-input'));
        const order_from_dom = inputs.map(inp => inp?.getAttribute('data-block-id')).filter(Boolean);
        const block_names = inputs.reduce((acc, inp) => {
            const id = inp?.getAttribute('data-block-id');
            if (id) acc[id] = (inp?.value || '').trim();
            return acc;
        }, {});
        const new_order = [...order_from_dom];
        const focus_index = direction === 'up' ? idx - 1 : idx + 1;
        const old_index = idx;
        [new_order[idx], new_order[focus_index]] = [new_order[focus_index], new_order[idx]];
        this._animate_then_save_info_block_move(ol, direction, idx, focus_index, new_order, block_names);
    },

    _animate_then_save_info_block_move(ol, direction, idx, focus_index, new_order, block_names) {
        const items = Array.from(ol.children);
        const total = items.length;
        const moved_item = items[idx];
        const other_item = items[focus_index];
        if (!moved_item || !other_item || moved_item === other_item) {
            this.move_after_render = { focus_index, old_index: idx, button_type: direction };
            this._save_info_blocks_order(new_order, block_names);
            return;
        }

        const get_offset = (el) => el.getBoundingClientRect().top;
        const dist = get_offset(other_item) - get_offset(moved_item);
        const cubic = 'cubic-bezier(0.4, 0, 0.2, 1)';
        const DUR_MOVE = 0.25;
        const DUR_FADE = 0.25;

        // Vilken knapp försvinner respektive tillkommer
        let fade_out_btn = null;
        let fade_in_after = null; // { row: 'moved'|'other', action: 'up'|'down' }
        if (direction === 'up') {
            if (idx === 1) {
                fade_out_btn = moved_item.querySelector('button[data-action="move-info-block-up"]');
                fade_in_after = { row: 'other', action: 'up' };
            } else if (idx === total - 1) {
                fade_out_btn = other_item.querySelector('button[data-action="move-info-block-down"]');
                fade_in_after = { row: 'moved', action: 'down' };
            }
        } else {
            if (idx === 0) {
                fade_out_btn = other_item.querySelector('button[data-action="move-info-block-up"]');
                fade_in_after = { row: 'moved', action: 'up' };
            } else if (idx === total - 2) {
                fade_out_btn = moved_item.querySelector('button[data-action="move-info-block-down"]');
                fade_in_after = { row: 'other', action: 'down' };
            }
        }

        moved_item.style.position = 'relative';
        moved_item.style.zIndex = '10';
        moved_item.classList.add('info-blocks-order-item-moving');
        other_item.style.position = 'relative';
        other_item.style.zIndex = '9';
        other_item.classList.add('info-blocks-order-item-moving');

        requestAnimationFrame(() => {
            moved_item.style.transition = `transform ${DUR_MOVE}s ${cubic}`;
            moved_item.style.transform = `translateY(${dist}px)`;
            other_item.style.transition = `transform ${DUR_MOVE}s ${cubic}`;
            other_item.style.transform = `translateY(${-dist}px)`;

            const after_move = () => {
                if (fade_out_btn) {
                    fade_out_btn.style.transition = `opacity ${DUR_FADE}s ${cubic}`;
                    fade_out_btn.style.opacity = '0';
                    setTimeout(after_fade_out, DUR_FADE * 1000);
                } else {
                    after_fade_out();
                }
            };
            const after_fade_out = () => {
                moved_item.style.transition = '';
                moved_item.style.transform = '';
                moved_item.classList.remove('info-blocks-order-item-moving');
                other_item.style.transition = '';
                other_item.style.transform = '';
                other_item.classList.remove('info-blocks-order-item-moving');
                if (fade_out_btn) {
                    fade_out_btn.style.transition = '';
                    fade_out_btn.style.opacity = '';
                }
                this.move_after_render = { focus_index, old_index: idx, button_type: direction, fade_in_after };
                this._save_info_blocks_order(new_order, block_names);
            };
            setTimeout(after_move, DUR_MOVE * 1000);
        });
    },

    _append_info_block_to_list(list, new_id) {
        const t = this.Translation.t;
        const total = list.children.length + 1;
        const block_label = t('rulefile_info_blocks_unnamed_block');
        const list_item = this.Helpers.create_element('li', { class_name: 'info-blocks-order-item', attributes: { 'data-index': String(total - 1) } });
        const item_content = this.Helpers.create_element('div', { class_name: 'info-blocks-order-item-content' });

        const input_id = `info_block_name_${new_id}`;
        const name_label = this.Helpers.create_element('label', {
            attributes: { for: input_id },
            text_content: t('rulefile_info_blocks_order_name_label') || 'Namn',
            class_name: 'info-blocks-order-name-label'
        });
        const text_input = this.Helpers.create_element('input', {
            class_name: 'form-control info-blocks-order-name-input',
            attributes: { type: 'text', id: input_id, value: '', 'data-block-id': new_id }
        });
        text_input.addEventListener('input', this.handle_autosave_input);
        const input_wrapper = this.Helpers.create_element('div', { class_name: 'info-blocks-order-input-wrapper' });
        input_wrapper.appendChild(name_label);
        input_wrapper.appendChild(text_input);
        item_content.appendChild(input_wrapper);

        const controls = this.Helpers.create_element('div', { class_name: 'info-blocks-order-controls' });

        const up_slot = this.Helpers.create_element('div', { class_name: 'info-blocks-order-btn-slot' });
        const up_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-small', 'button-default'],
            attributes: { type: 'button', 'data-action': 'move-info-block-up', 'aria-label': block_label },
            html_content: `<span>${t('rulefile_metadata_move_up_text') || 'Flytta upp'}</span>` +
                         (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('arrow_upward', ['currentColor'], 16)}</span>` : '')
        });
        up_btn.addEventListener('click', (e) => {
            const li = e.currentTarget.closest('.info-blocks-order-item');
            const ol = li?.closest('ol');
            if (!ol || !li) return;
            const items = Array.from(ol.children);
            const idx = items.indexOf(li);
            if (idx > 0) {
                this._handle_info_block_order_move(ol, 'up', idx);
            }
        });
        up_slot.appendChild(up_btn);
        controls.appendChild(up_slot);

        const down_slot = this.Helpers.create_element('div', { class_name: 'info-blocks-order-btn-slot' });
        controls.appendChild(down_slot);

        const delete_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-small', 'button-danger'],
            attributes: { type: 'button', 'aria-label': block_label },
            html_content: `<span>${t('rulefile_metadata_delete_button_text') || 'Ta bort'}</span>` +
                         (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('delete', ['currentColor'], 16)}</span>` : '')
        });
        delete_btn.addEventListener('click', () => {
            const input = list_item.querySelector('.info-blocks-order-name-input');
            const block_name = (input?.value || '').trim() || block_label;
            const count = this._count_requirements_with_info_block_text(new_id);
            let warning_text = t('modal_message_delete_info_block_intro', { name: block_name });
            if (count > 0) {
                warning_text += '\n\n' + t('modal_message_delete_info_block_count', { count });
                warning_text += '\n\n' + t('modal_message_delete_info_block_warning', { count });
            }
            warning_text += '\n\n' + t('modal_message_delete_info_block_confirm');
            if (window.show_confirm_delete_modal) {
                window.show_confirm_delete_modal({
                    h1_text: t('modal_h1_delete_info_block', { name: block_name }),
                    warning_text,
                    delete_button: delete_btn,
                    on_confirm: () => this._remove_info_block_from_dom(list_item, list)
                });
            } else {
                this._remove_info_block_from_dom(list_item, list);
            }
        });
        controls.appendChild(delete_btn);

        item_content.appendChild(controls);
        list_item.appendChild(item_content);

        const prev_last = list.lastElementChild;
        if (prev_last) {
            const prev_controls = prev_last.querySelector('.info-blocks-order-controls');
            const prev_down_slot = prev_controls?.querySelectorAll('.info-blocks-order-btn-slot')[1];
            if (prev_down_slot && prev_down_slot.children.length === 0) {
                const down_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-small', 'button-default'],
                    attributes: { type: 'button', 'data-action': 'move-info-block-down', 'aria-label': block_label },
                    html_content: `<span>${t('rulefile_metadata_move_down_text') || 'Flytta ner'}</span>` +
                                 (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('arrow_downward', ['currentColor'], 16)}</span>` : '')
                });
                down_btn.addEventListener('click', (e) => {
                    const li = e.currentTarget.closest('.info-blocks-order-item');
                    const ol = li?.closest('ol');
                    if (!ol || !li) return;
                    const items = Array.from(ol.children);
                    const idx = items.indexOf(li);
                    if (idx < items.length - 1) {
                        this._handle_info_block_order_move(ol, 'down', idx);
                    }
                });
                prev_down_slot.appendChild(down_btn);
            }
        }

        list.appendChild(list_item);

        const fade_duration_ms = 250;
        list_item.style.opacity = '0';
        list_item.style.transition = `opacity ${fade_duration_ms}ms ease-out`;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                list_item.style.opacity = '1';
            });
        });
        setTimeout(() => {
            list_item.style.transition = '';
            list_item.style.opacity = '';
            text_input.focus();
        }, fade_duration_ms);
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        const state = this.getState();
        const metadata = state?.ruleFileContent?.metadata || {};
        const block_order = metadata?.blockOrders?.infoBlocks || [
            'expectedObservation',
            'instructions',
            'exceptions',
            'commonErrors',
            'tips',
            'examples'
        ];

        if (!this.edit_baseline) {
            this.edit_baseline = JSON.parse(JSON.stringify(state?.ruleFileContent || {}));
        }

        this.root.innerHTML = '';
        const editor = this.Helpers.create_element('div', { class_name: 'info-blocks-order-editor' });
        const info_text = this.Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: t('rulefile_info_blocks_order_instruction') || 'Ändra ordningen genom att klicka på pilarna. Denna ordning används för alla krav i regelfilen.'
        });
        editor.appendChild(info_text);

        const working_order = [...block_order];

        const add_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'button-small'],
            attributes: { type: 'button', 'aria-label': t('rulefile_info_blocks_add_button') },
            html_content: `<span>${t('rulefile_info_blocks_add_button')}</span>` +
                         (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('add', ['currentColor'], 16)}</span>` : '')
        });
        const list = this.Helpers.create_element('ol', { class_name: 'info-blocks-order-list-editable' });
        const total = working_order.length;

        add_button.addEventListener('click', () => {
            const new_id = `custom_${this.Helpers.generate_uuid_v4().substring(0, 8)}`;
            this._append_info_block_to_list(list, new_id);
        });
        editor.appendChild(add_button);

        working_order.forEach((blockId, index) => {
            const list_item = this.Helpers.create_element('li', { class_name: 'info-blocks-order-item', attributes: { 'data-index': index } });
            const item_content = this.Helpers.create_element('div', { class_name: 'info-blocks-order-item-content' });

            const input_id = `info_block_name_${blockId}`;
            const name_label = this.Helpers.create_element('label', {
                attributes: { for: input_id },
                text_content: t('rulefile_info_blocks_order_name_label') || 'Namn',
                class_name: 'info-blocks-order-name-label'
            });
            const display_name = blockId.startsWith('custom_')
                ? this._get_custom_block_name_from_requirements(blockId)
                : this._get_block_display_name(blockId);
            const block_label = (display_name || '').trim() || t('rulefile_info_blocks_unnamed_block');
            const text_input = this.Helpers.create_element('input', {
                class_name: 'form-control info-blocks-order-name-input',
                attributes: {
                    type: 'text',
                    id: input_id,
                    value: display_name,
                    'data-block-id': blockId
                }
            });
            text_input.addEventListener('input', this.handle_autosave_input);
            const input_wrapper = this.Helpers.create_element('div', { class_name: 'info-blocks-order-input-wrapper' });
            input_wrapper.appendChild(name_label);
            input_wrapper.appendChild(text_input);
            item_content.appendChild(input_wrapper);

            const controls = this.Helpers.create_element('div', { class_name: 'info-blocks-order-controls' });

            const is_first = index === 0;
            const is_last = index === total - 1;

            const up_slot = this.Helpers.create_element('div', { class_name: 'info-blocks-order-btn-slot' });
            if (!is_first) {
                const up_target_index = index - 1;
                const up_aria = block_label === t('rulefile_info_blocks_unnamed_block')
                    ? block_label
                    : (up_target_index === 0
                        ? (t('rulefile_info_blocks_move_up_to_top') || 'Flytta till översta raden')
                        : (t('rulefile_info_blocks_move_up_to_row', { row: up_target_index + 1 }) || `Flytta upp till rad ${up_target_index + 1}`));
                const up_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-small', 'button-default'],
                    attributes: {
                        type: 'button',
                        'data-action': 'move-info-block-up',
                        'data-index': String(index),
                        'aria-label': up_aria
                    },
                    html_content: `<span>${t('rulefile_metadata_move_up_text') || 'Flytta upp'}</span>` +
                                 (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('arrow_upward', ['currentColor'], 16)}</span>` : '')
                });
                up_btn.addEventListener('click', (e) => {
                    const li = e.currentTarget.closest('.info-blocks-order-item');
                    const ol = li?.closest('ol');
                    if (!ol || !li) return;
                    const items = Array.from(ol.children);
                    const idx = items.indexOf(li);
                    if (idx > 0) {
                        this._handle_info_block_order_move(ol, 'up', idx);
                    }
                });
                up_slot.appendChild(up_btn);
            }
            controls.appendChild(up_slot);

            const down_slot = this.Helpers.create_element('div', { class_name: 'info-blocks-order-btn-slot' });
            if (!is_last) {
                const down_target_index = index + 1;
                const down_aria = block_label === t('rulefile_info_blocks_unnamed_block')
                    ? block_label
                    : (down_target_index === total - 1
                        ? (t('rulefile_info_blocks_move_down_to_bottom') || 'Flytta till nedersta raden')
                        : (t('rulefile_info_blocks_move_down_to_row', { row: down_target_index + 1 }) || `Flytta ner till rad ${down_target_index + 1}`));
                const down_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-small', 'button-default'],
                    attributes: {
                        type: 'button',
                        'data-action': 'move-info-block-down',
                        'data-index': String(index),
                        'aria-label': down_aria
                    },
                    html_content: `<span>${t('rulefile_metadata_move_down_text') || 'Flytta ner'}</span>` +
                                 (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('arrow_downward', ['currentColor'], 16)}</span>` : '')
                });
                down_btn.addEventListener('click', (e) => {
                    const li = e.currentTarget.closest('.info-blocks-order-item');
                    const ol = li?.closest('ol');
                    if (!ol || !li) return;
                    const items = Array.from(ol.children);
                    const idx = items.indexOf(li);
                    if (idx < items.length - 1) {
                        this._handle_info_block_order_move(ol, 'down', idx);
                    }
                });
                down_slot.appendChild(down_btn);
            }
            controls.appendChild(down_slot);

            const delete_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-small', 'button-danger'],
                attributes: {
                    type: 'button',
                    'aria-label': block_label === t('rulefile_info_blocks_unnamed_block')
                        ? block_label
                        : (t('rulefile_metadata_delete_button_text') || 'Ta bort')
                },
                html_content: `<span>${t('rulefile_metadata_delete_button_text') || 'Ta bort'}</span>` +
                             (this.Helpers.get_icon_svg ? `<span aria-hidden="true">${this.Helpers.get_icon_svg('delete', ['currentColor'], 16)}</span>` : '')
            });
            delete_btn.addEventListener('click', () => {
                const input = list_item.querySelector('.info-blocks-order-name-input');
                const block_name = (input?.value || '').trim() || t('rulefile_info_blocks_unnamed_block');
                const count = this._count_requirements_with_info_block_text(blockId);
                let warning_text = t('modal_message_delete_info_block_intro', { name: block_name });
                if (count > 0) {
                    warning_text += '\n\n' + t('modal_message_delete_info_block_count', { count });
                    warning_text += '\n\n' + t('modal_message_delete_info_block_warning', { count });
                }
                warning_text += '\n\n' + t('modal_message_delete_info_block_confirm');
                if (window.show_confirm_delete_modal) {
                    window.show_confirm_delete_modal({
                        h1_text: t('modal_h1_delete_info_block', { name: block_name }),
                        warning_text,
                        delete_button: delete_btn,
                        on_confirm: () => this._remove_info_block_from_dom(list_item, list)
                    });
                } else {
                    this._remove_info_block_from_dom(list_item, list);
                }
            });
            controls.appendChild(delete_btn);

            item_content.appendChild(controls);
            list_item.appendChild(item_content);
            list.appendChild(list_item);
        });

        editor.appendChild(list);

        this.autosave_session?.destroy();
        this.autosave_session = this.AutosaveService?.create_session?.({
            form_element: editor,
            focus_root: editor,
            debounce_ms: 250,
            on_save: () => {
                const list_el = editor.querySelector('.info-blocks-order-list-editable');
                if (list_el) {
                    const order_from_dom = Array.from(list_el.querySelectorAll('.info-blocks-order-name-input'))
                        .map(inp => inp.getAttribute('data-block-id')).filter(Boolean);
                    const block_names = Array.from(list_el.querySelectorAll('.info-blocks-order-name-input')).reduce((acc, inp) => {
                        const id = inp.getAttribute('data-block-id');
                        if (id) acc[id] = (inp.value || '').trim();
                        return acc;
                    }, {});
                    this._save_info_blocks_order(order_from_dom, block_names);
                }
            }
        }) || null;

        const save_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button' },
            html_content: `<span>${t('save_changes_button')}</span>` +
                          (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('save') : '')
        });
        save_button.addEventListener('click', () => {
            const inputs = list.querySelectorAll('.info-blocks-order-name-input');
            const order_from_dom = Array.from(inputs).map(inp => inp.getAttribute('data-block-id')).filter(Boolean);
            const block_names = Array.from(inputs).reduce((acc, inp) => {
                const id = inp.getAttribute('data-block-id');
                if (id) acc[id] = (inp.value || '').trim();
                return acc;
            }, {});
            const unnamed_count = Object.values(block_names).filter(n => !n).length;
            if (unnamed_count > 0) {
                const ModalComponent = window.ModalComponent;
                const Helpers = window.Helpers;
                if (ModalComponent?.show && Helpers?.create_element) {
                    const first_empty = Array.from(inputs).find(inp => !(inp.value || '').trim());
                    ModalComponent.show(
                        {
                            h1_text: t('modal_h1_unnamed_info_blocks'),
                            message_text: t('modal_message_unnamed_info_blocks', { count: unnamed_count })
                        },
                        (container, modal) => {
                            const btn = Helpers.create_element('button', {
                                class_name: ['button', 'button-primary'],
                                text_content: t('modal_unnamed_info_blocks_understand')
                            });
                            btn.addEventListener('click', () => {
                                modal.close(first_empty ?? null);
                            });
                            const wrapper = Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                            wrapper.appendChild(btn);
                            container.appendChild(wrapper);
                        }
                    );
                }
                return;
            }
            this._save_info_blocks_order(order_from_dom, block_names, true);
            this.edit_baseline = null;
            this.NotificationComponent.show_global_message?.(
                t('rulefile_info_blocks_order_saved') || 'Informationsblock sparad',
                'success'
            );
            sessionStorage.setItem('focusAfterLoad', '.rulefile-sections-header h1');
            this.router('rulefile_sections', { section: 'info_blocks_order' });
        });

        const cancel_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button', 'aria-label': t('rulefile_info_blocks_back_to_view') },
            html_content: `<span>${t('rulefile_info_blocks_back_to_view')}</span>`
        });
        cancel_button.addEventListener('click', () => {
            if (this.edit_baseline) {
                this.dispatch({
                    type: this.StoreActionTypes.SET_RULE_FILE_CONTENT,
                    payload: { ruleFileContent: this.edit_baseline, skip_render: true }
                });
                this.edit_baseline = null;
            }
            sessionStorage.setItem('focusAfterLoad', '.rulefile-sections-header h1');
            this.router('rulefile_sections', { section: 'info_blocks_order' });
        });

        const actions = this.Helpers.create_element('div', { class_name: 'form-actions' });
        actions.appendChild(save_button);
        actions.appendChild(cancel_button);
        editor.appendChild(actions);

        this.root.appendChild(editor);

        // Animation efter flytt av informationsblock
        // Radflytt sker i _animate_then_save_info_block_move; här hanteras endast fade-in av tillkommande knapp
        if (this.move_after_render) {
            const { focus_index, old_index, button_type, fade_in_after } = this.move_after_render;
            this.move_after_render = null;
            const list_el = this.root.querySelector('.info-blocks-order-list-editable');
            if (list_el) {
                const items = Array.from(list_el.querySelectorAll('.info-blocks-order-item'));
                const cubic = 'cubic-bezier(0.4, 0, 0.2, 1)';
                const DUR_FADE = 0.25;

                const do_focus = () => {
                    const action = button_type === 'up' ? 'move-info-block-up' : 'move-info-block-down';
                    let btn = list_el.querySelector(`button[data-action="${action}"][data-index="${focus_index}"]`);
                    if (!btn) {
                        const other_action = button_type === 'up' ? 'move-info-block-down' : 'move-info-block-up';
                        btn = list_el.querySelector(`button[data-action="${other_action}"][data-index="${focus_index}"]`);
                    }
                    if (btn) btn.focus();
                };

                if (fade_in_after) {
                    const target_item = fade_in_after.row === 'moved' ? items[focus_index] : items[old_index];
                    const fade_in_btn = target_item?.querySelector(`button[data-action="move-info-block-${fade_in_after.action}"]`);
                    if (fade_in_btn) {
                        fade_in_btn.style.opacity = '0';
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                fade_in_btn.style.transition = `opacity ${DUR_FADE}s ${cubic}`;
                                fade_in_btn.style.opacity = '1';
                                setTimeout(() => {
                                    fade_in_btn.style.transition = '';
                                    fade_in_btn.style.opacity = '';
                                    do_focus();
                                }, DUR_FADE * 1000);
                            });
                        });
                    } else {
                        do_focus();
                    }
                } else {
                    do_focus();
                }
            }
        }
    },

    flush_to_state() {
        if (!this.root) return;
        const list_el = this.root.querySelector('.info-blocks-order-list-editable');
        if (!list_el) return;
        this.autosave_session?.cancel_pending?.();
        const inputs = list_el.querySelectorAll('.info-blocks-order-name-input');
        const order_from_dom = Array.from(inputs).map(inp => inp.getAttribute('data-block-id')).filter(Boolean);
        const block_names = Array.from(inputs).reduce((acc, inp) => {
            const id = inp.getAttribute('data-block-id');
            if (id) acc[id] = (inp.value || '').trim();
            return acc;
        }, {});
        this._save_info_blocks_order(order_from_dom, block_names);
    },

    destroy() {
        this.autosave_session?.destroy();
        this.autosave_session = null;
        this.edit_baseline = null;
        this.move_after_render = null;
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
    }
};
