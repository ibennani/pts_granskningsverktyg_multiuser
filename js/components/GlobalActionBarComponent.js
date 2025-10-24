// js/components/GlobalActionBarComponent.js
import { SaveAuditButtonComponentFactory } from './SaveAuditButtonComponent.js';

export const GlobalActionBarComponentFactory = function () {
  'use-strict';

  const CSS_PATH = './css/components/global_action_bar_component.css';
  let container_ref;
  let dependencies = {};

  let save_audit_button_component_instance = null;
  let save_audit_button_container_element = null;

  async function init(_container, _dependencies) {
    container_ref = _container;
    dependencies = _dependencies;

    if (dependencies.Helpers && dependencies.Helpers.load_css) {
      try {
        const link_tag = document.querySelector(`link[href="${CSS_PATH}"]`);
        if (!link_tag) await dependencies.Helpers.load_css(CSS_PATH);
      } catch (error) {
        console.warn('Failed to load CSS for GlobalActionBarComponent:', error);
      }
    }

    save_audit_button_container_element = dependencies.Helpers.create_element(
      'div',
      { class_name: 'save-audit-button-container' }
    );
    save_audit_button_component_instance = SaveAuditButtonComponentFactory();

    await save_audit_button_component_instance.init(
      save_audit_button_container_element,
      dependencies.getState,
      dependencies.SaveAuditLogic.save_audit_to_json_file,
      dependencies.Translation.t,
      dependencies.NotificationComponent.show_global_message,
      dependencies.Helpers.create_element,
      dependencies.Helpers.get_icon_svg,
      dependencies.Helpers.load_css
    );
  }

  function clone_rulefile_content(ruleFileContent) {
    return JSON.parse(JSON.stringify(ruleFileContent));
  }

  function compute_next_version(current_version_string, today) {
    const current_year = today.getFullYear();
    const current_month = today.getMonth() + 1;
    const version_match =
      typeof current_version_string === 'string'
        ? current_version_string.match(/^(\d{4})\.(\d{1,2})\.r(\d+)$/)
        : null;

    if (version_match) {
      const [, version_year, version_month, release] = version_match;
      const version_year_number = parseInt(version_year, 10);
      const version_month_number = parseInt(version_month, 10);
      if (
        version_year_number === current_year &&
        version_month_number === current_month
      ) {
        return `${current_year}.${current_month}.r${parseInt(release, 10) + 1}`;
      }
    }

    return `${current_year}.${current_month}.r1`;
  }

  function to_filename_version_suffix(version_string) {
    const match =
      typeof version_string === 'string'
        ? version_string.match(/^(\d{4})\.(\d{1,2})\.r(\d+)$/)
        : null;
    if (!match) return null;
    const year = match[1];
    const month = parseInt(match[2], 10);
    const release = match[3];
    return `${year}_${month}_r${release}`;
  }

  function build_rulefile_download_filename(original_filename, version_string) {
    const default_extension = '.json';
    const version_suffix = to_filename_version_suffix(version_string);
    const safe_suffix = version_suffix || '';
    if (!original_filename) {
      return `rulefile_${safe_suffix || 'export'}${default_extension}`;
    }

    const last_dot_index = original_filename.lastIndexOf('.');
    const extension =
      last_dot_index > -1
        ? original_filename.slice(last_dot_index)
        : default_extension;
    const base_name =
      last_dot_index > -1
        ? original_filename.slice(0, last_dot_index)
        : original_filename;

    if (!safe_suffix) {
      return `${base_name}${extension}`;
    }

    const pattern = /(_\d{4}_\d{1,2}_r\d+)$/;
    const updated_base = base_name.match(pattern)
      ? base_name.replace(pattern, `_${safe_suffix}`)
      : `${base_name}_${safe_suffix}`;

    return `${updated_base}${extension}`;
  }

  function handle_save_rulefile() {
    const {
      getState,
      Translation,
      NotificationComponent,
      dispatch,
      StoreActionTypes,
    } = dependencies;
    const t = Translation.t;
    const current_state = getState();

    if (!current_state.ruleFileContent) {
      NotificationComponent.show_global_message(t('error_internal'), 'error');
      return;
    }

    const is_edit_mode = current_state.auditStatus === 'rulefile_editing';
    const original_string = current_state.ruleFileOriginalContentString;
    const current_string = JSON.stringify(
      current_state.ruleFileContent,
      null,
      2
    );
    const has_changes = !original_string || current_string !== original_string;

    const today = new Date();
    const today_iso_date = today.toISOString().split('T')[0];
    let data_string_for_download = current_string;
    let filename_for_download =
      current_state.ruleFileOriginalFilename || 'rulefile.json';

    if (is_edit_mode && has_changes) {
      const updated_rulefile_content = clone_rulefile_content(
        current_state.ruleFileContent
      );
      const current_metadata = updated_rulefile_content.metadata || {};
      const next_version = compute_next_version(
        current_metadata.version,
        today
      );
      updated_rulefile_content.metadata = {
        ...current_metadata,
        dateModified: today_iso_date,
        version: next_version,
      };

      data_string_for_download = JSON.stringify(
        updated_rulefile_content,
        null,
        2
      );
      filename_for_download = build_rulefile_download_filename(
        current_state.ruleFileOriginalFilename,
        next_version
      );

      if (typeof dispatch === 'function' && StoreActionTypes) {
        dispatch({
          type: StoreActionTypes.SET_RULE_FILE_CONTENT,
          payload: { ruleFileContent: updated_rulefile_content },
        });
        dispatch({
          type: StoreActionTypes.SET_RULEFILE_EDIT_BASELINE,
          payload: {
            originalRuleFileContentString: data_string_for_download,
            originalRuleFileFilename: filename_for_download,
          },
        });
      }
    } else if (is_edit_mode && !has_changes && original_string) {
      data_string_for_download = original_string;
    }

    const blob = new Blob([data_string_for_download], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename_for_download;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    NotificationComponent.show_global_message(
      t('rulefile_saved_as_file', { filename: filename_for_download }),
      'success'
    );
  }

  function render() {
    if (!container_ref) return;
    container_ref.innerHTML = '';

    const { getState, Translation, Helpers } = dependencies;
    const t = Translation.t;
    const current_state = getState();
    const audit_status = current_state?.auditStatus;
    const has_rulefile_loaded = Boolean(current_state?.ruleFileContent);

    const bar_element = Helpers.create_element('div', {
      class_name: 'global-action-bar',
    });
    const left_group = Helpers.create_element('div', {
      class_name: ['action-bar-group', 'left'],
    });

    // --- FIX: Logic only applies to the left group (save buttons) ---
    if (audit_status !== 'rulefile_editing' && has_rulefile_loaded) {
      save_audit_button_component_instance.render();
      left_group.appendChild(save_audit_button_container_element);
    } else if (audit_status === 'rulefile_editing' && has_rulefile_loaded) {
      const save_rulefile_button = Helpers.create_element('button', {
        class_name: ['button', 'button-primary'],
        html_content:
          `<span class="button-text">${t('save_and_download_rulefile')}</span>` +
          (Helpers.get_icon_svg
            ? Helpers.get_icon_svg('save', ['currentColor'], 18)
            : ''),
      });
      save_rulefile_button.addEventListener('click', handle_save_rulefile);
      left_group.appendChild(save_rulefile_button);
    }

    bar_element.appendChild(left_group);

    // --- FIX: The right group is now ALWAYS rendered ---
    const right_group = Helpers.create_element('div', {
      class_name: ['action-bar-group', 'right'],
    });

    const language_selector_container = Helpers.create_element('div', {
      class_name: 'language-selector-container',
    });
    const language_label = Helpers.create_element('label', {
      attributes: { for: `language-selector-${container_ref.id}` },
      text_content: t('language_switcher_label'),
      class_name: 'visually-hidden',
    });
    language_selector_container.appendChild(language_label);

    const language_selector = Helpers.create_element('select', {
      id: `language-selector-${container_ref.id}`,
      class_name: ['form-control', 'form-control-small'],
    });
    const supported_languages = Translation.get_supported_languages();
    for (const lang_code in supported_languages) {
      const option = Helpers.create_element('option', {
        value: lang_code,
        text_content: supported_languages[lang_code],
      });
      language_selector.appendChild(option);
    }
    language_selector.value = Translation.get_current_language_code();
    language_selector.addEventListener('change', (event) =>
      Translation.set_language(event.target.value)
    );
    language_selector_container.appendChild(language_selector);
    right_group.appendChild(language_selector_container);

    const theme_toggle_button = Helpers.create_element('button', {
      class_name: ['button', 'button-default'],
      attributes: { 'aria-live': 'polite' },
    });

    function update_theme_button_content(theme) {
      theme_toggle_button.innerHTML = '';
      const icon_color = getComputedStyle(document.documentElement)
        .getPropertyValue('--button-default-text')
        .trim();
      if (theme === 'dark') {
        const light_span = Helpers.create_element('span', {
          class_name: 'button-text',
          text_content: t('light_mode'),
        });
        theme_toggle_button.appendChild(light_span);
        if (Helpers.get_icon_svg) {
          const light_icon = Helpers.get_icon_svg(
            'light_mode',
            [icon_color],
            18
          );
          if (light_icon) {
            theme_toggle_button.insertAdjacentHTML('beforeend', light_icon);
          }
        }
        theme_toggle_button.setAttribute('aria-label', t('light_mode'));
      } else {
        const dark_span = Helpers.create_element('span', {
          class_name: 'button-text',
          text_content: t('dark_mode'),
        });
        theme_toggle_button.appendChild(dark_span);
        if (Helpers.get_icon_svg) {
          const dark_icon = Helpers.get_icon_svg('dark_mode', [icon_color], 18);
          if (dark_icon) {
            theme_toggle_button.insertAdjacentHTML('beforeend', dark_icon);
          }
        }
        theme_toggle_button.setAttribute('aria-label', t('dark_mode'));
      }
    }

    function set_theme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme_preference', theme);
      update_theme_button_content(theme);
    }

    theme_toggle_button.addEventListener('click', () => {
      const current_theme =
        document.documentElement.getAttribute('data-theme') || 'light';
      set_theme(current_theme === 'dark' ? 'light' : 'dark');
    });

    const current_theme =
      document.documentElement.getAttribute('data-theme') || 'light';
    update_theme_button_content(current_theme);
    right_group.appendChild(theme_toggle_button);

    bar_element.appendChild(right_group);
    container_ref.appendChild(bar_element);
  }

  function destroy() {
    if (container_ref) container_ref.innerHTML = '';
    if (save_audit_button_component_instance) {
      save_audit_button_component_instance.destroy();
    }
    dependencies = {};
  }

  return {
    init,
    render,
    destroy,
  };
};
