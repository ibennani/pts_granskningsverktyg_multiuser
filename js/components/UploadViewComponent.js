// js/components/UploadViewComponent.js

export const UploadViewComponent = (function () {
  'use-strict';

  const CSS_PATH = './css/components/upload_view_component.css';
  let app_container_ref;
  let router_ref;
  let global_message_element_ref;

  let rule_file_input_for_audit;
  let saved_audit_input_element;
  let rule_file_input_for_edit;

  // Local state/dependencies
  let local_getState;
  let local_dispatch;
  let local_StoreActionTypes;

  function get_t_func() {
    return typeof window.Translation !== 'undefined' &&
      typeof window.Translation.t === 'function'
      ? window.Translation.t
      : (key, replacements) => `**${key}**`;
  }

  function handle_audit_rule_file_select(event) {
    const t = get_t_func();
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const json_content = JSON.parse(e.target.result);
        const validation_result =
          window.ValidationLogic.validate_rule_file_json(json_content);

        if (validation_result.isValid) {
          if (
            window.Store &&
            typeof window.Store.clearAutosavedState === 'function'
          ) {
            window.Store.clearAutosavedState();
          }

          if (window.NotificationComponent)
            NotificationComponent.show_global_message(
              validation_result.message,
              'success'
            );

          local_dispatch({
            type: local_StoreActionTypes.INITIALIZE_NEW_AUDIT,
            payload: { ruleFileContent: json_content },
          });

          router_ref('metadata');
        } else {
          if (window.NotificationComponent)
            NotificationComponent.show_global_message(
              validation_result.message,
              'error'
            );
        }
      } catch (error) {
        console.error('Error parsing JSON from rule file for audit:', error);
        if (window.NotificationComponent)
          NotificationComponent.show_global_message(
            t('rule_file_invalid_json'),
            'error'
          );
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  function handle_saved_audit_file_select(event) {
    const t = get_t_func();
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const file_content_object = JSON.parse(e.target.result);
        const validation_result =
          window.ValidationLogic.validate_saved_audit_file(file_content_object);

        if (validation_result.isValid) {
          local_dispatch({
            type: local_StoreActionTypes.LOAD_AUDIT_FROM_FILE,
            payload: file_content_object,
          });

          if (window.NotificationComponent)
            NotificationComponent.show_global_message(
              t('saved_audit_loaded_successfully'),
              'success'
            );
          router_ref('audit_overview');
        } else {
          if (window.NotificationComponent)
            NotificationComponent.show_global_message(
              validation_result.message,
              'error'
            );
        }
      } catch (error) {
        console.error('Error parsing JSON from saved audit file:', error);
        if (window.NotificationComponent)
          NotificationComponent.show_global_message(
            t('error_invalid_saved_audit_file'),
            'error'
          );
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  function handle_edit_file_select(event) {
    const t = get_t_func();
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const json_content = JSON.parse(e.target.result);
        const validation_result =
          window.ValidationLogic.validate_rule_file_json(json_content);

        if (validation_result.isValid) {
          if (
            window.Store &&
            typeof window.Store.clearAutosavedState === 'function'
          ) {
            window.Store.clearAutosavedState();
          }

          local_dispatch({
            type: local_StoreActionTypes.INITIALIZE_RULEFILE_EDITING,
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

          // --- HÄR ÄR ÄNDRINGEN ---
          router_ref('edit_rulefile_main');
        } else {
          if (window.NotificationComponent)
            NotificationComponent.show_global_message(
              validation_result.message,
              'error'
            );
        }
      } catch (error) {
        console.error('Error parsing rule file for editing:', error);
        if (window.NotificationComponent)
          NotificationComponent.show_global_message(
            t('rule_file_invalid_json'),
            'error'
          );
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  async function init(
    _app_container,
    _router,
    _params,
    _getState,
    _dispatch,
    _StoreActionTypes
  ) {
    app_container_ref = _app_container;
    router_ref = _router;

    local_getState = _getState;
    local_dispatch = _dispatch;
    local_StoreActionTypes = _StoreActionTypes;

    if (window.NotificationComponent?.get_global_message_element_reference) {
      global_message_element_ref =
        window.NotificationComponent.get_global_message_element_reference();
    }

    if (window.Helpers?.load_css_safely) {
      try {
        await window.Helpers.load_css_safely(CSS_PATH, 'UploadViewComponent', {
          timeout: 5000,
          maxRetries: 2,
        });
      } catch (error) {
        // Fel hanteras redan i load_css_safely med användarvarning
        console.warn(
          '[UploadViewComponent] Continuing without CSS due to loading failure'
        );
      }
    }
  }

  function render() {
    if (!app_container_ref || !window.Helpers?.create_element) {
      console.error('[UploadViewComponent] render prerequisites missing.');
      return;
    }
    app_container_ref.innerHTML = '';
    const t = get_t_func();

    // Skapa bakgrundsplatta
    const plate_element = window.Helpers.create_element('div', {
      class_name: 'content-plate',
    });

    if (global_message_element_ref) {
      plate_element.appendChild(global_message_element_ref);
      if (
        window.NotificationComponent?.clear_global_message &&
        !global_message_element_ref.classList.contains('message-error') &&
        !global_message_element_ref.classList.contains('message-warning')
      ) {
        window.NotificationComponent.clear_global_message();
      }
    }

    const title = window.Helpers.create_element('h1', {
      text_content: t('app_title'),
    });
    const intro_text = window.Helpers.create_element('p', {
      text_content: t('upload_view_intro'),
    });

    const actions_title = window.Helpers.create_element('h2', {
      text_content: t('upload_view_actions_title'),
      style: 'font-size: 1.2rem; margin-top: 2rem;',
    });
    const load_ongoing_description_id = 'upload-help-resume';
    const load_ongoing_audit_btn = window.Helpers.create_element('button', {
      id: 'load-ongoing-audit-btn',
      class_name: ['button', 'button-secondary'],
      attributes: { 'aria-describedby': load_ongoing_description_id },
      html_content:
        `<span>${t('upload_ongoing_audit')}</span>` +
        (window.Helpers.get_icon_svg
          ? window.Helpers.get_icon_svg('upload_file')
          : ''),
    });
    const load_ongoing_description = window.Helpers.create_element('p', {
      class_name: ['upload-action-description'],
      attributes: { id: load_ongoing_description_id },
      text_content: t('upload_view_description_resume_audit'),
    });
    const load_ongoing_block = window.Helpers.create_element('div', {
      class_name: ['upload-action-block'],
    });
    load_ongoing_block.append(load_ongoing_audit_btn, load_ongoing_description);

    const start_new_description_id = 'upload-help-start-new';
    const start_new_audit_btn = window.Helpers.create_element('button', {
      id: 'start-new-audit-btn',
      class_name: ['button', 'button-primary'],
      attributes: { 'aria-describedby': start_new_description_id },
      html_content:
        `<span>${t('start_new_audit')}</span>` +
        (window.Helpers.get_icon_svg
          ? window.Helpers.get_icon_svg('start_new')
          : ''),
    });
    const start_new_description = window.Helpers.create_element('p', {
      class_name: ['upload-action-description'],
      attributes: { id: start_new_description_id },
      text_content: t('upload_view_description_start_new'),
    });
    const start_new_block = window.Helpers.create_element('div', {
      class_name: ['upload-action-block'],
    });
    start_new_block.append(start_new_audit_btn, start_new_description);

    const actions_container = window.Helpers.create_element('div', {
      class_name: ['upload-action-stack'],
    });
    actions_container.append(load_ongoing_block, start_new_block);

    const section_separator = window.Helpers.create_element('hr', {
      style: 'margin: 2rem 0;',
    });

    const edit_section_title = window.Helpers.create_element('h2', {
      text_content: t('upload_view_title_edit'),
      style: 'font-size: 1.2rem; margin-top: 2.5rem;',
    });
    const edit_description_id = 'upload-help-edit';
    const edit_rulefile_btn = window.Helpers.create_element('button', {
      id: 'edit-rulefile-btn',
      class_name: ['button', 'button-default'],
      attributes: { 'aria-describedby': edit_description_id },
      html_content:
        `<span>${t('upload_view_button_edit')}</span>` +
        (window.Helpers.get_icon_svg
          ? window.Helpers.get_icon_svg('edit')
          : ''),
    });
    const edit_description = window.Helpers.create_element('p', {
      class_name: ['upload-action-description'],
      attributes: { id: edit_description_id },
      text_content: t('upload_view_description_edit_rulefile'),
    });
    const edit_block = window.Helpers.create_element('div', {
      class_name: ['upload-action-block'],
    });
    edit_block.append(edit_rulefile_btn, edit_description);

    rule_file_input_for_audit = window.Helpers.create_element('input', {
      id: 'rule-file-input-audit',
      attributes: { type: 'file', accept: '.json', style: 'display: none;' },
    });
    saved_audit_input_element = window.Helpers.create_element('input', {
      id: 'saved-audit-input',
      attributes: { type: 'file', accept: '.json', style: 'display: none;' },
    });
    rule_file_input_for_edit = window.Helpers.create_element('input', {
      id: 'rule-file-input-edit',
      attributes: { type: 'file', accept: '.json', style: 'display: none;' },
    });

    // Lägg till allt innehåll i bakgrundsplattan
    plate_element.append(
      title,
      intro_text,
      actions_title,
      actions_container,
      section_separator,
      edit_section_title,
      edit_block,
      rule_file_input_for_audit,
      saved_audit_input_element,
      rule_file_input_for_edit
    );

    // Lägg till bakgrundsplattan i app-container
    app_container_ref.appendChild(plate_element);

    start_new_audit_btn.addEventListener('click', () =>
      rule_file_input_for_audit.click()
    );
    rule_file_input_for_audit.addEventListener(
      'change',
      handle_audit_rule_file_select
    );

    load_ongoing_audit_btn.addEventListener('click', () =>
      saved_audit_input_element.click()
    );
    saved_audit_input_element.addEventListener(
      'change',
      handle_saved_audit_file_select
    );

    edit_rulefile_btn.addEventListener('click', () =>
      rule_file_input_for_edit.click()
    );
    rule_file_input_for_edit.addEventListener(
      'change',
      handle_edit_file_select
    );
  }

  function destroy() {
    if (rule_file_input_for_audit)
      rule_file_input_for_audit.removeEventListener(
        'change',
        handle_audit_rule_file_select
      );
    if (saved_audit_input_element)
      saved_audit_input_element.removeEventListener(
        'change',
        handle_saved_audit_file_select
      );
    if (rule_file_input_for_edit)
      rule_file_input_for_edit.removeEventListener(
        'change',
        handle_edit_file_select
      );

    app_container_ref.innerHTML = '';
    local_getState = null;
    local_dispatch = null;
    local_StoreActionTypes = null;
  }

  return {
    init,
    render,
    destroy,
  };
})();
