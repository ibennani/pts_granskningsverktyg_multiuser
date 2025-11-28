export const UploadViewComponent = {
  init({ root, deps }) {
    this.root = root;
    this.deps = deps;
    this.router = deps.router;
    this.getState = deps.getState;
    this.dispatch = deps.dispatch;
    this.StoreActionTypes = deps.StoreActionTypes;
    this.Translation = deps.Translation;
    this.Helpers = deps.Helpers;
    this.NotificationComponent = deps.NotificationComponent;
    this.ValidationLogic = deps.ValidationLogic || window.ValidationLogic; 

    this.CSS_PATH = './css/components/upload_view_component.css';
    
    // Internal refs
    this.rule_file_input_for_audit = null;
    this.saved_audit_input_element = null;
    this.rule_file_input_for_edit = null;

    // Bind methods
    this.handle_audit_rule_file_select = this.handle_audit_rule_file_select.bind(this);
    this.handle_saved_audit_file_select = this.handle_saved_audit_file_select.bind(this);
    this.handle_edit_file_select = this.handle_edit_file_select.bind(this);

    if (this.Helpers && this.Helpers.load_css_safely) {
        this.Helpers.load_css_safely(this.CSS_PATH, 'UploadViewComponent', {
            timeout: 5000,
            maxRetries: 2,
        }).catch(() => {
            console.warn('[UploadViewComponent] Continuing without CSS due to loading failure');
        });
    }
  },

  get_t_func() {
    return (this.Translation && typeof this.Translation.t === 'function')
      ? this.Translation.t
      : (key) => `**${key}**`;
  },

  handle_audit_rule_file_select(event) {
    const t = this.get_t_func();
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json_content = JSON.parse(e.target.result);
        const validation_result = this.ValidationLogic.validate_rule_file_json(json_content);

        if (validation_result.isValid) {
          if (window.Store && typeof window.Store.clearAutosavedState === 'function') {
             window.Store.clearAutosavedState();
          }

          if (this.NotificationComponent)
            this.NotificationComponent.show_global_message(
              validation_result.message,
              'success'
            );

          this.dispatch({
            type: this.StoreActionTypes.INITIALIZE_NEW_AUDIT,
            payload: { ruleFileContent: json_content },
          });

          this.router('metadata');
        } else {
          if (this.NotificationComponent)
            this.NotificationComponent.show_global_message(
              validation_result.message,
              'error'
            );
        }
      } catch (error) {
        console.error('Error parsing JSON from rule file for audit:', error);
        if (this.NotificationComponent)
          this.NotificationComponent.show_global_message(
            t('rule_file_invalid_json'),
            'error'
          );
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  },

  handle_saved_audit_file_select(event) {
    const t = this.get_t_func();
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const file_content_object = JSON.parse(e.target.result);
        const validation_result = this.ValidationLogic.validate_saved_audit_file(file_content_object);

        if (validation_result.isValid) {
          this.dispatch({
            type: this.StoreActionTypes.LOAD_AUDIT_FROM_FILE,
            payload: file_content_object,
          });

          if (this.NotificationComponent)
            this.NotificationComponent.show_global_message(
              t('saved_audit_loaded_successfully'),
              'success'
            );
          this.router('audit_overview');
        } else {
          if (this.NotificationComponent)
            this.NotificationComponent.show_global_message(
              validation_result.message,
              'error'
            );
        }
      } catch (error) {
        console.error('Error parsing JSON from saved audit file:', error);
        if (this.NotificationComponent)
          this.NotificationComponent.show_global_message(
            t('error_invalid_saved_audit_file'),
            'error'
          );
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  },

  handle_edit_file_select(event) {
    const t = this.get_t_func();
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json_content = JSON.parse(e.target.result);
        const validation_result = this.ValidationLogic.validate_rule_file_json(json_content);

        if (validation_result.isValid) {
          if (window.Store && typeof window.Store.clearAutosavedState === 'function') {
            window.Store.clearAutosavedState();
          }

          this.dispatch({
            type: this.StoreActionTypes.INITIALIZE_RULEFILE_EDITING,
            payload: {
              ruleFileContent: json_content,
              originalRuleFileContentString: JSON.stringify(
                json_content,
                null,
                2
              ),
              originalRuleFileFilename: file.name || '',
            },
          });

          this.router('edit_rulefile_main');
        } else {
          if (this.NotificationComponent)
            this.NotificationComponent.show_global_message(
              validation_result.message,
              'error'
            );
        }
      } catch (error) {
        console.error('Error parsing rule file for editing:', error);
        if (this.NotificationComponent)
          this.NotificationComponent.show_global_message(
            t('rule_file_invalid_json'),
            'error'
          );
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  },

  render() {
    if (!this.root || !this.Helpers || !this.Helpers.create_element) {
      console.error('[UploadViewComponent] render prerequisites missing.');
      return;
    }
    this.root.innerHTML = '';
    const t = this.get_t_func();

    // Create plate
    const plate_element = this.Helpers.create_element('div', {
      class_name: 'content-plate',
    });

    if (this.NotificationComponent && this.NotificationComponent.get_global_message_element_reference) {
        const global_message_element_ref = this.NotificationComponent.get_global_message_element_reference();
        plate_element.appendChild(global_message_element_ref);
        
        if (this.NotificationComponent.clear_global_message &&
            !global_message_element_ref.classList.contains('message-error') &&
            !global_message_element_ref.classList.contains('message-warning')
        ) {
            this.NotificationComponent.clear_global_message();
        }
    }

    const title = this.Helpers.create_element('h1', {
      text_content: t('app_title'),
    });
    const intro_text = this.Helpers.create_element('p', {
      text_content: t('upload_view_intro'),
    });

    const actions_title = this.Helpers.create_element('h2', {
      text_content: t('upload_view_actions_title'),
      style: 'font-size: 1.2rem; margin-top: 2rem;',
    });
    
    // Action 1: Load ongoing
    const load_ongoing_description_id = 'upload-help-resume';
    const load_ongoing_audit_btn = this.Helpers.create_element('button', {
      id: 'load-ongoing-audit-btn',
      class_name: ['button', 'button-secondary'],
      attributes: { 'aria-describedby': load_ongoing_description_id },
      html_content:
        `<span>${t('upload_ongoing_audit')}</span>` +
        (this.Helpers.get_icon_svg
          ? this.Helpers.get_icon_svg('upload_file')
          : ''),
    });
    const load_ongoing_description = this.Helpers.create_element('p', {
      class_name: ['upload-action-description'],
      attributes: { id: load_ongoing_description_id },
      text_content: t('upload_view_description_resume_audit'),
    });
    const load_ongoing_block = this.Helpers.create_element('div', {
      class_name: ['upload-action-block'],
    });
    load_ongoing_block.append(load_ongoing_audit_btn, load_ongoing_description);

    // Action 2: Start new
    const start_new_description_id = 'upload-help-start-new';
    const start_new_audit_btn = this.Helpers.create_element('button', {
      id: 'start-new-audit-btn',
      class_name: ['button', 'button-primary'],
      attributes: { 'aria-describedby': start_new_description_id },
      html_content:
        `<span>${t('start_new_audit')}</span>` +
        (this.Helpers.get_icon_svg
          ? this.Helpers.get_icon_svg('start_new')
          : ''),
    });
    const start_new_description = this.Helpers.create_element('p', {
      class_name: ['upload-action-description'],
      attributes: { id: start_new_description_id },
      text_content: t('upload_view_description_start_new'),
    });
    const start_new_block = this.Helpers.create_element('div', {
      class_name: ['upload-action-block'],
    });
    start_new_block.append(start_new_audit_btn, start_new_description);

    const actions_container = this.Helpers.create_element('div', {
      class_name: ['upload-action-stack'],
    });
    actions_container.append(load_ongoing_block, start_new_block);

    const section_separator = this.Helpers.create_element('hr', {
      style: 'margin: 2rem 0;',
    });

    // Action 3: Edit rulefile
    const edit_section_title = this.Helpers.create_element('h2', {
      text_content: t('upload_view_title_edit'),
      style: 'font-size: 1.2rem; margin-top: 2.5rem;',
    });
    const edit_description_id = 'upload-help-edit';
    const edit_rulefile_btn = this.Helpers.create_element('button', {
      id: 'edit-rulefile-btn',
      class_name: ['button', 'button-default'],
      attributes: { 'aria-describedby': edit_description_id },
      html_content:
        `<span>${t('upload_view_button_edit')}</span>` +
        (this.Helpers.get_icon_svg
          ? this.Helpers.get_icon_svg('edit')
          : ''),
    });
    const edit_description = this.Helpers.create_element('p', {
      class_name: ['upload-action-description'],
      attributes: { id: edit_description_id },
      text_content: t('upload_view_description_edit_rulefile'),
    });
    const edit_block = this.Helpers.create_element('div', {
      class_name: ['upload-action-block'],
    });
    edit_block.append(edit_rulefile_btn, edit_description);

    this.rule_file_input_for_audit = this.Helpers.create_element('input', {
      id: 'rule-file-input-audit',
      attributes: { type: 'file', accept: '.json', style: 'display: none;' },
    });
    this.saved_audit_input_element = this.Helpers.create_element('input', {
      id: 'saved-audit-input',
      attributes: { type: 'file', accept: '.json', style: 'display: none;' },
    });
    this.rule_file_input_for_edit = this.Helpers.create_element('input', {
      id: 'rule-file-input-edit',
      attributes: { type: 'file', accept: '.json', style: 'display: none;' },
    });

    plate_element.append(
      title,
      intro_text,
      actions_title,
      actions_container,
      section_separator,
      edit_section_title,
      edit_block,
      this.rule_file_input_for_audit,
      this.saved_audit_input_element,
      this.rule_file_input_for_edit
    );

    this.root.appendChild(plate_element);

    // Event listeners
    start_new_audit_btn.addEventListener('click', () =>
      this.rule_file_input_for_audit.click()
    );
    this.rule_file_input_for_audit.addEventListener(
      'change',
      this.handle_audit_rule_file_select
    );

    load_ongoing_audit_btn.addEventListener('click', () =>
      this.saved_audit_input_element.click()
    );
    this.saved_audit_input_element.addEventListener(
      'change',
      this.handle_saved_audit_file_select
    );

    edit_rulefile_btn.addEventListener('click', () =>
      this.rule_file_input_for_edit.click()
    );
    this.rule_file_input_for_edit.addEventListener(
      'change',
      this.handle_edit_file_select
    );
  },

  destroy() {
    if (this.rule_file_input_for_audit)
      this.rule_file_input_for_audit.removeEventListener(
        'change',
        this.handle_audit_rule_file_select
      );
    if (this.saved_audit_input_element)
      this.saved_audit_input_element.removeEventListener(
        'change',
        this.handle_saved_audit_file_select
      );
    if (this.rule_file_input_for_edit)
      this.rule_file_input_for_edit.removeEventListener(
        'change',
        this.handle_edit_file_select
      );

    if (this.root) this.root.innerHTML = '';
    
    this.root = null;
    this.deps = null;
    this.ValidationLogic = null;
    this.rule_file_input_for_audit = null;
    this.saved_audit_input_element = null;
    this.rule_file_input_for_edit = null;
  }
};
