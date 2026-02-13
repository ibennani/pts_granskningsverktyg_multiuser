// js/components/EditContentTypesSectionComponent.js

import {
    get_requirements_count_by_content_type_id,
    get_requirements_count_for_parent_content_type,
    remove_content_type_from_requirements
} from '../utils/content_types_helper.js';

export const EditContentTypesSectionComponent = {
    CSS_PATH: 'css/components/edit_rulefile_metadata_view.css',

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
        this.form_element_ref = null;
        this.working_metadata = null;
        this.initial_metadata_snapshot = null;
        this.skip_autosave_on_destroy = false;
        this.content_types_container = null;
        this.handle_autosave_input = this.handle_autosave_input.bind(this);

        if (this.Helpers?.load_css) {
            await this.Helpers.load_css(this.CSS_PATH).catch(err => console.warn('[EditContentTypesSectionComponent] Failed to load CSS', err));
        }
    },

    _clone_metadata(metadata) {
        return JSON.parse(JSON.stringify(metadata || {}));
    },

    _ensure_metadata_defaults(workingMetadata) {
        const vocabularies = workingMetadata.vocabularies || {};
        if (!Array.isArray(workingMetadata.contentTypes)) {
            workingMetadata.contentTypes = Array.isArray(vocabularies.contentTypes)
                ? [...vocabularies.contentTypes]
                : [];
        }
        if (!vocabularies.contentTypes) {
            vocabularies.contentTypes = workingMetadata.contentTypes;
        }
        return workingMetadata;
    },

    _generate_slug(value) {
        if (!value) return '';
        return value.toString().trim().toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^-+|-+$/g, '');
    },

    _ensure_unique_slug(slugSet, preferred, fallback) {
        let base = preferred || fallback || 'item';
        if (!base) base = 'item';
        let candidate = base;
        let counter = 1;
        while (!candidate || slugSet.has(candidate)) {
            candidate = `${base}-${counter++}`;
        }
        slugSet.add(candidate);
        return candidate;
    },

    _create_inline_input(label_key, value, onChange, options = {}) {
        const { textarea = false, rawLabel = null } = options;
        const wrapper = this.Helpers.create_element('div', { class_name: 'inline-field' });
        const inputId = `inline-${Math.random().toString(36).substring(2, 10)}`;
        const labelText = rawLabel ?? this.Translation.t(label_key);
        const label = this.Helpers.create_element('label', { attributes: { for: inputId }, text_content: labelText });
        wrapper.appendChild(label);

        let input;
        if (textarea) {
            input = this.Helpers.create_element('textarea', {
                class_name: 'form-control form-control-compact',
                attributes: { id: inputId, rows: '3' }
            });
            input.value = value ?? '';
            this.Helpers.init_auto_resize_for_textarea?.(input);
            input.addEventListener('input', event => onChange(event.target.value));
        } else {
            input = this.Helpers.create_element('input', {
                class_name: 'form-control form-control-compact',
                attributes: { id: inputId, type: 'text' }
            });
            input.value = value ?? '';
            input.addEventListener('input', event => onChange(event.target.value));
        }

        wrapper.appendChild(input);
        return wrapper;
    },

    _create_small_button(text_or_key, icon_name, onClick, variant = 'secondary', options = {}) {
        const { plainText = false, ariaLabel = null } = options;
        const resolveText = (value) => plainText ? value : this.Translation.t(value);
        const computeHtml = (value) => {
            const label = resolveText(value);
            const safeLabel = this.Helpers.escape_html ? this.Helpers.escape_html(label) : label;
            return `<span>${safeLabel}</span>` + (icon_name && this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg(icon_name) : '');
        };

        const button = this.Helpers.create_element('button', {
            class_name: ['button', `button-${variant}`, 'button-small'],
            attributes: { type: 'button' },
            html_content: computeHtml(text_or_key)
        });

        const resolvedAria = ariaLabel || resolveText(text_or_key);
        if (resolvedAria) {
            button.setAttribute('aria-label', resolvedAria);
        }

        button.addEventListener('click', onClick);

        button.updateButtonText = (newText, newAria) => {
            button.innerHTML = computeHtml(newText);
            const aria = newAria || resolveText(newText);
            if (aria) {
                button.setAttribute('aria-label', aria);
            }
        };

        return button;
    },

    _render_content_types_editor(container, workingMetadata, addAnimation = null, focusAfterRender = null) {
        const t = this.Translation.t;
        const ruleFileContent = this.getState()?.ruleFileContent || {};
        container.innerHTML = '';

        const content_types = workingMetadata.vocabularies?.contentTypes || workingMetadata.contentTypes || [];

        if (!Array.isArray(content_types) || content_types.length === 0) {
            container.appendChild(this.Helpers.create_element('p', {
                class_name: 'editable-empty',
                text_content: t('rulefile_metadata_empty_value')
            }));
        }

        content_types.forEach((parent, parentIndex) => {
            if (!parent) {
                content_types[parentIndex] = { id: '', text: '', description: '', types: [] };
                parent = content_types[parentIndex];
            }
            parent.types = Array.isArray(parent.types) ? parent.types : [];

            const card = this.Helpers.create_element('article', { class_name: 'editable-card content-type-card' });
            const headingRow = this.Helpers.create_element('div', { class_name: 'editable-card-header' });
            const heading = this.Helpers.create_element('h3', { text_content: parent.text || t('rulefile_metadata_untitled_item') });
            const initialRemoveLabel = this.Translation.t('rulefile_metadata_remove_content_type', { name: heading.textContent });
            const parentDisplayName = parent.text || t('rulefile_metadata_untitled_item');
            const removeParentBtn = this._create_small_button(initialRemoveLabel, 'delete', () => {
                const h1_text = this.Translation.t('modal_h1_delete_content_type');
                const reqCount = get_requirements_count_for_parent_content_type(ruleFileContent, parent);
                const message_text = reqCount > 0
                    ? this.Translation.t('modal_message_delete_content_type_with_requirements', {
                        name: parentDisplayName,
                        count: reqCount
                    })
                    : this.Translation.t('modal_message_delete_content_type', { name: parentDisplayName });
                if (window.show_confirm_delete_modal) {
                    window.show_confirm_delete_modal({
                        h1_text,
                        warning_text: message_text,
                        delete_button: removeParentBtn,
                        on_confirm: () => this._delete_content_type_with_animation(workingMetadata, parentIndex, card)
                    });
                } else {
                    this._delete_content_type_with_animation(workingMetadata, parentIndex, card);
                }
            }, 'danger', { plainText: true, ariaLabel: initialRemoveLabel });
            headingRow.append(heading, removeParentBtn);
            card.appendChild(headingRow);

            card.appendChild(this._create_inline_input('rulefile_metadata_field_text', parent.text || '', value => {
                parent.text = value;
                const displayName = value || t('rulefile_metadata_untitled_item');
                heading.textContent = displayName;
                const updatedLabel = this.Translation.t('rulefile_metadata_remove_content_type', { name: displayName });
                removeParentBtn.updateButtonText?.(updatedLabel, updatedLabel);
                this.handle_autosave_input();
            }));

            const childList = this.Helpers.create_element('div', { class_name: 'editable-sublist' });
            const subheading = this.Helpers.create_element('h4', {
                text_content: t('rulefile_metadata_subcategories_title') || 'Underkategorier'
            });
            childList.appendChild(subheading);

            parent.types.forEach((child, childIndex) => {
                if (!child) {
                    parent.types[childIndex] = { id: '', text: '', description: '' };
                    child = parent.types[childIndex];
                }
                const childId = child.id || (parent.id ? `${parent.id}-${this._generate_slug(child.text)}` : '');
                const reqCount = childId ? get_requirements_count_by_content_type_id(ruleFileContent, childId) : 0;

                const childCard = this.Helpers.create_element('div', { class_name: 'editable-card editable-child-card' });
                const childHeader = this.Helpers.create_element('div', { class_name: 'editable-card-header' });
                const childDisplayName = child.text || t('rulefile_metadata_untitled_item');
                const removeChildInitial = this.Translation.t('rulefile_metadata_remove_content_subtype', { name: childDisplayName });
                const removeChildBtn = this._create_small_button(removeChildInitial, 'delete', () => {
                    const msg = reqCount > 0
                        ? (t('rulefile_metadata_remove_content_type_with_requirements', { count: reqCount })
                            || `Denna underkategori är kopplad till ${reqCount} krav. Vill du ta bort den? Kopplingen till kraven tas bort.`)
                        : (t('confirm_delete_content_subtype', { name: childDisplayName }) || `Är du säker på att du vill ta bort undertypen "${childDisplayName}"?`);
                    if (window.show_confirm_delete_modal) {
                        window.show_confirm_delete_modal({
                            warning_text: msg,
                            delete_button: removeChildBtn,
                            on_confirm: () => this._delete_content_subtype_with_animation(workingMetadata, parentIndex, childIndex, child, container, childCard)
                        });
                    } else {
                        this._delete_content_subtype_with_animation(workingMetadata, parentIndex, childIndex, child, container, childCard);
                    }
                }, 'danger', { plainText: true, ariaLabel: removeChildInitial });
                childHeader.appendChild(removeChildBtn);

                if (reqCount > 0) {
                    const countSpan = this.Helpers.create_element('span', {
                        class_name: 'content-type-requirements-count',
                        text_content: t('rulefile_metadata_content_type_requirements_count', { count: reqCount }) || `${reqCount} krav kopplade`
                    });
                    childHeader.appendChild(countSpan);
                }
                childCard.appendChild(childHeader);

                childCard.appendChild(this._create_inline_input('rulefile_metadata_field_text', child.text || '', value => {
                    child.text = value;
                    const updatedName = value || t('rulefile_metadata_untitled_item');
                    const updatedLabel = this.Translation.t('rulefile_metadata_remove_content_subtype', { name: updatedName });
                    removeChildBtn.updateButtonText?.(updatedLabel, updatedLabel);
                    this.handle_autosave_input();
                }));
                childCard.appendChild(this._create_inline_input('rulefile_metadata_field_description', child.description || '', value => {
                    child.description = value;
                    this.handle_autosave_input();
                }, { textarea: true }));
                childList.appendChild(childCard);
            });

            const addChildBtn = this._create_small_button('rulefile_metadata_add_content_subtype', 'add', () => {
                parent.types.push({ id: '', text: '', description: '' });
                this._render_content_types_editor(container, workingMetadata, {
                    type: 'child',
                    parentIndex,
                    childIndex: parent.types.length - 1
                });
            });
            childList.appendChild(addChildBtn);
            card.appendChild(childList);
            container.appendChild(card);
        });

        const addParentBtn = this._create_small_button('rulefile_metadata_add_content_type', 'add', () => {
            content_types.push({ id: '', text: '', description: '', types: [] });
            this._render_content_types_editor(container, workingMetadata, {
                type: 'parent',
                index: content_types.length - 1
            });
        });
        container.appendChild(addParentBtn);

        if (addAnimation) {
            this._apply_add_fade_in(container, addAnimation);
        }
        if (focusAfterRender) {
            this._focus_after_render(container, focusAfterRender);
        }
    },

    _apply_add_fade_in(container, addAnimation) {
        const fade_duration_ms = 1000;
        let targetEl = null;

        if (addAnimation.type === 'parent') {
            const cards = Array.from(container.children).filter(el => el.classList.contains('content-type-card'));
            targetEl = cards[addAnimation.index] || null;
        } else if (addAnimation.type === 'child') {
            const cards = Array.from(container.children).filter(el => el.classList.contains('content-type-card'));
            const parentCard = cards[addAnimation.parentIndex] || null;
            const childList = parentCard?.querySelector('.editable-sublist');
            const childCards = childList ? childList.querySelectorAll('.editable-child-card') : [];
            targetEl = childCards[addAnimation.childIndex] || null;
        }

        if (!targetEl) return;

        targetEl.style.opacity = '0';
        targetEl.style.transition = `opacity ${fade_duration_ms}ms ease-out`;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                targetEl.style.opacity = '1';
            });
        });

        const nameInput = targetEl.querySelector('.inline-field input');
        if (nameInput) {
            requestAnimationFrame(() => {
                nameInput.focus();
            });
        }
    },

    _focus_after_render(container, focusAfterRender) {
        const cards = Array.from(container.children).filter(el => el.classList.contains('content-type-card'));
        let buttonToFocus = null;

        if (focusAfterRender.type === 'parent') {
            const card = cards[focusAfterRender.index];
            if (card) {
                buttonToFocus = card.querySelector('.editable-card-header .button');
            }
            if (!buttonToFocus) {
                buttonToFocus = container.lastElementChild;
            }
        } else if (focusAfterRender.type === 'child') {
            const parentCard = cards[focusAfterRender.parentIndex] || null;
            if (parentCard) {
                const childList = parentCard.querySelector('.editable-sublist');
                const childCards = childList ? childList.querySelectorAll('.editable-child-card') : [];
                const childCard = childCards[focusAfterRender.childIndex];
                if (childCard) {
                    buttonToFocus = childCard.querySelector('.editable-card-header .button');
                }
                if (!buttonToFocus) {
                    buttonToFocus = childList?.lastElementChild;
                }
            }
        }

        if (buttonToFocus) {
            requestAnimationFrame(() => {
                buttonToFocus.focus();
            });
        }
    },

    _delete_content_type_with_animation(workingMetadata, parentIndex, elementToDelete) {
        this.handle_autosave_input();
        const content_types = workingMetadata.vocabularies?.contentTypes || workingMetadata.contentTypes || [];

        if (parentIndex < 0 || parentIndex >= content_types.length) return;

        const fade_duration_ms = 1000;
        const move_duration_ms = 1000;
        const gap = 12; // 0.75rem från content-types-editor
        const totalHeight = elementToDelete.offsetHeight + gap;

        elementToDelete.style.transition = `opacity ${fade_duration_ms}ms ease-out, transform ${fade_duration_ms}ms ease-out`;
        requestAnimationFrame(() => {
            elementToDelete.style.opacity = '0';
            elementToDelete.style.transform = 'scale(0.95)';
        });

        setTimeout(() => {
            if (elementToDelete.parentNode) {
                elementToDelete.parentNode.removeChild(elementToDelete);
            }

            const parent = this.content_types_container;
            if (!parent) return;
            const cardsArray = Array.from(parent.children).filter(el => el.classList.contains('content-type-card'));
            const itemsAfter = cardsArray.slice(parentIndex);

            itemsAfter.forEach((item) => {
                item.style.transition = `transform ${move_duration_ms}ms cubic-bezier(0.4, 0, 0.2, 1)`;
                item.style.transform = `translateY(-${totalHeight}px)`;
            });

            const addBtn = parent.lastElementChild;
            if (addBtn && !addBtn.classList.contains('editable-card')) {
                addBtn.style.transition = `transform ${move_duration_ms}ms cubic-bezier(0.4, 0, 0.2, 1)`;
                addBtn.style.transform = `translateY(-${totalHeight}px)`;
            }

            setTimeout(() => {
                content_types.splice(parentIndex, 1);
                this._render_content_types_editor(this.content_types_container, workingMetadata, null, {
                    type: 'parent',
                    index: parentIndex
                });
            }, move_duration_ms);
        }, fade_duration_ms);
    },

    _delete_content_subtype_with_animation(workingMetadata, parentIndex, childIndex, child, container, elementToDelete) {
        const t = this.Translation.t;
        const ruleFileContent = this.getState()?.ruleFileContent || {};
        const childId = child.id;
        const reqCount = childId ? get_requirements_count_by_content_type_id(ruleFileContent, childId) : 0;

        this.handle_autosave_input();

        const content_types = workingMetadata.vocabularies?.contentTypes || workingMetadata.contentTypes || [];
        const fade_duration_ms = 1000;
        const move_duration_ms = 1000;
        const gap = 8; // 0.5rem från editable-sublist
        const totalHeight = elementToDelete.offsetHeight + gap;

        elementToDelete.style.transition = `opacity ${fade_duration_ms}ms ease-out, transform ${fade_duration_ms}ms ease-out`;
        requestAnimationFrame(() => {
            elementToDelete.style.opacity = '0';
            elementToDelete.style.transform = 'scale(0.95)';
        });

        setTimeout(() => {
            const parentList = elementToDelete.parentElement;
            if (elementToDelete.parentNode) {
                elementToDelete.parentNode.removeChild(elementToDelete);
            }
            if (!parentList) return;
            const childCards = parentList.querySelectorAll('.editable-child-card');
            const cardsArray = Array.from(childCards);
            const itemsAfter = cardsArray.slice(childIndex);

            itemsAfter.forEach((item) => {
                item.style.transition = `transform ${move_duration_ms}ms cubic-bezier(0.4, 0, 0.2, 1)`;
                item.style.transform = `translateY(-${totalHeight}px)`;
            });

            const addChildBtn = parentList.lastElementChild;
            if (addChildBtn && addChildBtn.classList.contains('button')) {
                addChildBtn.style.transition = `transform ${move_duration_ms}ms cubic-bezier(0.4, 0, 0.2, 1)`;
                addChildBtn.style.transform = `translateY(-${totalHeight}px)`;
            }

            setTimeout(() => {
                content_types[parentIndex].types.splice(childIndex, 1);
                this._render_content_types_editor(this.content_types_container, workingMetadata, null, {
                    type: 'child',
                    parentIndex,
                    childIndex: childIndex
                });

                let updatedRulefile = this.getState()?.ruleFileContent || {};
                if (childId && reqCount > 0) {
                    updatedRulefile = remove_content_type_from_requirements(updatedRulefile, childId);
                }
                updatedRulefile = {
                    ...updatedRulefile,
                    metadata: {
                        ...updatedRulefile.metadata,
                        contentTypes: content_types,
                        vocabularies: {
                            ...updatedRulefile.metadata?.vocabularies,
                            contentTypes: content_types
                        }
                    }
                };
                this.dispatch({
                    type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
                    payload: { ruleFileContent: updatedRulefile }
                });
            }, move_duration_ms);
        }, fade_duration_ms);
    },

    _perform_save(shouldTrim, skip_render) {
        if (!this.form_element_ref || !this.working_metadata) return;

        const state = this.getState();
        const currentRulefile = state?.ruleFileContent || {};
        const content_types = this.working_metadata.vocabularies?.contentTypes || this.working_metadata.contentTypes || [];

        const cleanedContentTypes = content_types.map(parent => {
            const cleanedParent = {
                id: (parent.id || '').trim(),
                text: (parent.text || '').trim(),
                description: ''
            };
            const childTypes = Array.isArray(parent.types) ? parent.types : [];
            cleanedParent.types = childTypes
                .map(child => ({
                    id: (child?.id || '').trim(),
                    text: (child?.text || '').trim(),
                    description: (child?.description || '').trim()
                }))
                .filter(child => child.id || child.text || child.description);
            return cleanedParent;
        }).filter(parent => parent.id || parent.text || (parent.types && parent.types.length > 0));

        const contentTypeSlugSet = new Set(cleanedContentTypes.map(ct => ct.id).filter(Boolean));
        cleanedContentTypes.forEach(parent => {
            if (!parent.id) {
                parent.id = this._ensure_unique_slug(contentTypeSlugSet, this._generate_slug(parent.text), 'content-type');
            } else {
                contentTypeSlugSet.add(parent.id);
            }

            const childSlugSet = new Set(parent.types.map(child => child.id).filter(Boolean));
            parent.types.forEach(child => {
                if (!child.id) {
                    const childSlug = this._generate_slug(child.text);
                    const base = parent.id || this._generate_slug(parent.text) || 'content';
                    const preferred = childSlug ? `${base}-${childSlug}` : '';
                    child.id = this._ensure_unique_slug(childSlugSet, preferred, `${base}-child`);
                } else {
                    childSlugSet.add(child.id);
                }
            });
        });

        const updatedMetadata = {
            ...currentRulefile.metadata,
            contentTypes: cleanedContentTypes,
            vocabularies: {
                ...currentRulefile.metadata?.vocabularies,
                contentTypes: cleanedContentTypes
            }
        };

        const updatedRulefileContent = {
            ...currentRulefile,
            metadata: updatedMetadata
        };

        this.dispatch({
            type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: updatedRulefileContent, skip_render: skip_render === true }
        });
    },

    handle_autosave_input() {
        this.autosave_session?.request_autosave();
    },

    _create_form(metadata) {
        const t = this.Translation.t;
        const form = this.Helpers.create_element('form', { class_name: 'content-types-edit-form' });

        this.content_types_container = this.Helpers.create_element('div', { class_name: 'editable-card-list content-types-editor' });
        this._render_content_types_editor(this.content_types_container, metadata);
        form.appendChild(this.content_types_container);

        const save_button_container = this.Helpers.create_element('div', { class_name: 'form-actions' });
        const save_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button', 'aria-label': t('rulefile_metadata_save_content_types') },
            html_content: `<span>${t('rulefile_metadata_save_content_types')}</span>` +
                (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('save') : '')
        });
        save_button.addEventListener('click', () => {
            this.autosave_session?.flush({ should_trim: true, skip_render: true });
            this._perform_save(true, true);
            this.NotificationComponent.show_global_message?.(t('rulefile_metadata_edit_saved'), 'success');
            sessionStorage.setItem('focusAfterLoad', '.rulefile-sections-header h2');
            this.router('rulefile_sections', { section: 'content_types' });
        });

        const cancel_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button', 'aria-label': t('rulefile_content_types_back_without_saving') },
            html_content: `<span>${t('rulefile_content_types_back_without_saving')}</span>`
        });
        cancel_button.addEventListener('click', () => {
            this._restore_initial_state();
            this.skip_autosave_on_destroy = true;
            this.autosave_session?.cancel_pending();
            sessionStorage.setItem('focusAfterLoad', '.rulefile-sections-header h2');
            this.router('rulefile_sections', { section: 'content_types' });
        });

        save_button_container.appendChild(save_button);
        save_button_container.appendChild(cancel_button);
        form.appendChild(save_button_container);

        form.addEventListener('submit', event => event.preventDefault());
        return { form, workingMetadata: metadata };
    },

    _restore_initial_state() {
        if (!this.initial_metadata_snapshot) return;
        const state = this.getState();
        const currentRulefile = state?.ruleFileContent || {};
        const restoredRulefileContent = {
            ...currentRulefile,
            metadata: this.initial_metadata_snapshot
        };
        this.dispatch({
            type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: restoredRulefileContent }
        });
    },

    render() {
        if (!this.root) return;
        const state = this.getState();

        if (!state?.ruleFileContent?.metadata) return;

        if (this.form_element_ref && this.root.contains(this.form_element_ref) && this.root.children.length > 0) {
            return;
        }

        this.initial_metadata_snapshot = this._clone_metadata(state.ruleFileContent.metadata);
        this.root.innerHTML = '';

        const { form, workingMetadata } = this._create_form(this._ensure_metadata_defaults(this._clone_metadata(state.ruleFileContent.metadata)));
        this.form_element_ref = form;
        this.working_metadata = workingMetadata;

        this.autosave_session?.destroy();
        this.autosave_session = this.AutosaveService?.create_session({
            form_element: form,
            focus_root: form,
            debounce_ms: 250,
            on_save: ({ should_trim, skip_render }) => {
                this._perform_save(should_trim, skip_render);
            }
        }) || null;

        this.root.appendChild(form);
    },

    destroy() {
        if (!this.skip_autosave_on_destroy && this.form_element_ref && this.working_metadata) {
            this.autosave_session?.flush({ should_trim: true, skip_render: true });
        }
        this.autosave_session?.destroy();
        this.autosave_session = null;

        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.form_element_ref = null;
        this.working_metadata = null;
        this.initial_metadata_snapshot = null;
        this.content_types_container = null;
        this.deps = null;
    }
};
