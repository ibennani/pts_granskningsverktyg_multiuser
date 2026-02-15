import { migrate_rulefile_to_new_structure } from '../logic/rulefile_migration_logic.js';
import {
    check_api_available,
    get_users,
    get_audits,
    get_rules,
    get_audit,
    create_audit
} from '../api/client.js';

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
    this.api_available = false;
    this.users = [];
    this.audits = [];
    this.rules = [];
    this.selected_user_name = null;

    // Bind methods
    this.handle_audit_rule_file_select = this.handle_audit_rule_file_select.bind(this);
    this.handle_saved_audit_file_select = this.handle_saved_audit_file_select.bind(this);
    this.handle_edit_file_select = this.handle_edit_file_select.bind(this);
    this.handle_user_change = this.handle_user_change.bind(this);
    this.handle_open_audit = this.handle_open_audit.bind(this);
    this.handle_create_audit_from_server = this.handle_create_audit_from_server.bind(this);
    this.handle_retry_api_check = this.handle_retry_api_check.bind(this);

    if (this.Helpers && this.Helpers.load_css_safely) {
        this.Helpers.load_css_safely(this.CSS_PATH, 'UploadViewComponent', {
            timeout: 5000,
            maxRetries: 2,
        }).catch(() => {
            console.warn('[UploadViewComponent] Continuing without CSS due to loading failure');
        });
    }
  },

  async ensure_api_data(force = false) {
    if (this._api_checked && !force) return;
    if (force) this._api_checked = false;
    this._api_checked = true;
    this.api_available = await check_api_available();
    if (this.api_available) {
      try {
        this.users = await get_users();
        this.selected_user_name = window.__GV_CURRENT_USER_NAME__ || (this.users[0]?.name ?? null);
        if (this.selected_user_name) {
          window.__GV_CURRENT_USER_NAME__ = this.selected_user_name;
          this.audits = await get_audits();
        }
      } catch {
        this.users = [];
        this.audits = [];
      }
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
        
        // Konvertera från gammal struktur till ny struktur om nödvändigt
        const migrated_content = migrate_rulefile_to_new_structure(json_content, {
          Translation: this.Translation
        });
        
        const validation_result = this.ValidationLogic.validate_rule_file_json(migrated_content);

        if (validation_result.isValid) {
          if (window.DraftManager?.clearCurrentDraft) {
            window.DraftManager.clearCurrentDraft();
          }

          if (this.NotificationComponent)
            this.NotificationComponent.show_global_message(
              validation_result.message,
              'success'
            );

          this.dispatch({
            type: this.StoreActionTypes.INITIALIZE_NEW_AUDIT,
            payload: { ruleFileContent: migrated_content },
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
        
        // Konvertera regelfilen från gammal struktur till ny struktur om nödvändigt
        if (file_content_object.ruleFileContent) {
          file_content_object.ruleFileContent = migrate_rulefile_to_new_structure(
            file_content_object.ruleFileContent,
            { Translation: this.Translation }
          );
        }
        
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
        
        // Konvertera från gammal struktur till ny struktur om nödvändigt
        const migrated_content = migrate_rulefile_to_new_structure(json_content, {
          Translation: this.Translation
        });
        
        const validation_result = this.ValidationLogic.validate_rule_file_json(migrated_content);

        if (validation_result.isValid) {
          if (window.DraftManager?.clearCurrentDraft) {
            window.DraftManager.clearCurrentDraft();
          }

          const migrated_content_string = JSON.stringify(
            migrated_content,
            null,
            2
          );

          this.dispatch({
            type: this.StoreActionTypes.INITIALIZE_RULEFILE_EDITING,
            payload: {
              ruleFileContent: migrated_content,
              originalRuleFileContentString: migrated_content_string,
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

  async handle_user_change(event) {
    const name = event.target.value;
    this.selected_user_name = name || null;
    window.__GV_CURRENT_USER_NAME__ = name || '';
    await this.fetch_audits();
    this.render();
  },

  async handle_open_audit(audit_id) {
    const t = this.get_t_func();
    try {
      const full_state = await get_audit(audit_id);
      if (full_state.ruleFileContent && this.ValidationLogic?.validate_saved_audit_file?.(full_state)?.isValid) {
        this.dispatch({
          type: this.StoreActionTypes.LOAD_AUDIT_FROM_FILE,
          payload: full_state
        });
        if (this.NotificationComponent) {
          this.NotificationComponent.show_global_message(t('saved_audit_loaded_successfully'), 'success');
        }
        this.router('audit_overview');
      } else {
        if (this.NotificationComponent) {
          this.NotificationComponent.show_global_message(t('error_invalid_saved_audit_file'), 'error');
        }
      }
    } catch (err) {
      if (this.NotificationComponent) {
        this.NotificationComponent.show_global_message(t('server_load_audit_error', { message: err.message }) || err.message, 'error');
      }
    }
  },

  async show_rule_picker() {
    const t = this.get_t_func();
    const ModalComponent = window.ModalComponent;
    if (!ModalComponent?.show || !this.Helpers?.create_element) return;
    await this.fetch_rules();
    if (this.rules.length === 0) {
      if (this.NotificationComponent) {
        this.NotificationComponent.show_global_message(t('server_no_rules'), 'error');
      }
      return;
    }
    ModalComponent.show(
      { h1_text: t('server_select_rule'), message_text: t('server_select_rule_intro') },
      (container, modal_instance) => {
        const ul = this.Helpers.create_element('ul', { class_name: 'upload-rules-list' });
        this.rules.forEach(r => {
          const li = this.Helpers.create_element('li');
          const btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'button-link-style'],
            text_content: r.name || `Regelfil ${r.id}`
          });
          btn.addEventListener('click', () => {
            modal_instance.close();
            this.handle_create_audit_from_server(r.id);
          });
          li.appendChild(btn);
          ul.appendChild(li);
        });
        container.appendChild(ul);
      }
    );
  },

  async handle_create_audit_from_server(rule_set_id) {
    const t = this.get_t_func();
    if (!window.__GV_CURRENT_USER_NAME__) {
      if (this.NotificationComponent) {
        this.NotificationComponent.show_global_message(t('server_select_user_first'), 'error');
      }
      return;
    }
    try {
      const full_state = await create_audit(rule_set_id);
      this.dispatch({
        type: this.StoreActionTypes.LOAD_AUDIT_FROM_FILE,
        payload: full_state
      });
      if (this.NotificationComponent) {
        this.NotificationComponent.show_global_message(t('saved_audit_loaded_successfully'), 'success');
      }
      this.router('metadata');
    } catch (err) {
      if (this.NotificationComponent) {
        this.NotificationComponent.show_global_message(t('server_create_audit_error', { message: err.message }) || err.message, 'error');
      }
    }
  },

  async fetch_audits() {
    if (!window.__GV_CURRENT_USER_NAME__) return;
    try {
      this.audits = await get_audits();
    } catch {
      this.audits = [];
    }
  },

  async fetch_rules() {
    try {
      this.rules = await get_rules();
    } catch {
      this.rules = [];
    }
  },

  async handle_retry_api_check() {
    await this.ensure_api_data(true);
    this.render();
  },

  render() {
    if (!this.root || !this.Helpers || !this.Helpers.create_element) {
      console.error('[UploadViewComponent] render prerequisites missing.');
      return;
    }
    if (!this._api_checked) {
      this.ensure_api_data().then(() => {
        if (this.root) this.render();
      });
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

    let retry_block = null;
    if (this._api_checked && !this.api_available) {
      retry_block = this.Helpers.create_element('div', { class_name: 'upload-server-retry-block' });
      const retry_p = this.Helpers.create_element('p', {
        class_name: 'upload-server-retry',
        text_content: t('server_retry_hint')
      });
      const retry_btn = this.Helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        text_content: t('server_retry_button')
      });
      retry_btn.addEventListener('click', () => this.handle_retry_api_check());
      retry_block.append(retry_p, retry_btn);
    }

    if (this.api_available && this.users.length > 0) {
      const user_section = this.Helpers.create_element('div', { class_name: 'upload-server-section' });
      const user_label = this.Helpers.create_element('label', {
        attributes: { for: 'upload-user-select' },
        text_content: t('server_user_label')
      });
      const user_select = this.Helpers.create_element('select', {
        id: 'upload-user-select',
        attributes: { 'aria-label': t('server_user_label') }
      });
      const empty_option = this.Helpers.create_element('option', { attributes: { value: '' }, text_content: t('server_user_select_placeholder') });
      user_select.appendChild(empty_option);
      this.users.forEach(u => {
        const opt = this.Helpers.create_element('option', {
          attributes: { value: u.name },
          text_content: u.name
        });
        if (this.selected_user_name === u.name) opt.setAttribute('selected', 'selected');
        user_select.appendChild(opt);
      });
      user_select.addEventListener('change', this.handle_user_change);
      user_section.append(user_label, user_select);

      if (this.selected_user_name) {
        const audits_title = this.Helpers.create_element('h2', {
          text_content: t('server_audits_title'),
          style: 'font-size: 1.2rem; margin-top: 1.5rem;'
        });
        const new_audit_btn = this.Helpers.create_element('button', {
          class_name: ['button', 'button-primary'],
          text_content: t('server_new_audit_from_rules')
        });
        new_audit_btn.addEventListener('click', () => this.show_rule_picker());
        const audits_list = this.Helpers.create_element('ul', { class_name: 'upload-audits-list' });
        this.audits.forEach(a => {
          const li = this.Helpers.create_element('li');
          const btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'button-link-style'],
            text_content: `${a.rule_set_name || 'Granskning'} (${a.status}) – ${a.id}`
          });
          btn.addEventListener('click', () => this.handle_open_audit(a.id));
          li.appendChild(btn);
          audits_list.appendChild(li);
        });
        if (this.audits.length === 0) {
          const empty_p = this.Helpers.create_element('p', { class_name: 'upload-audits-empty', text_content: t('server_no_audits') });
          user_section.append(audits_title, new_audit_btn, empty_p);
        } else {
          user_section.append(audits_title, new_audit_btn, audits_list);
        }
      }
      plate_element.appendChild(user_section);
      const hr = this.Helpers.create_element('hr', { style: 'margin: 1.5rem 0;' });
      plate_element.appendChild(hr);
    }

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

    const main_content = [title, intro_text];
    if (retry_block) main_content.push(retry_block);
    plate_element.append(
      ...main_content,
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
