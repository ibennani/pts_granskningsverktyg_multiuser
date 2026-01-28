import { SaveAuditButtonComponent } from './SaveAuditButtonComponent.js';

export class GlobalActionBarComponent {
  constructor() {
    this.CSS_PATH = './css/components/global_action_bar_component.css';

    // Internal references
    this.root = null;
    this.deps = null;
    this.save_audit_button_element = null;
    this.save_audit_button_instance = null;
    this.theme_toggle_button = null;
    this.theme_observer = null;

    // Dependencies
    this.getState = null;
    this.Translation = null;
    this.Helpers = null;
    this.NotificationComponent = null;
    this.dispatch = null;
    this.StoreActionTypes = null;

    // Bind methods
    this.handle_save_rulefile = this.handle_save_rulefile.bind(this);
    this.handle_language_change = this.handle_language_change.bind(this);
    this.toggle_theme = this.toggle_theme.bind(this);
  }

  async init({ root, deps }) {
    this.root = root;
    this.deps = deps;
    this.getState = deps.getState;
    this.Translation = deps.Translation;
    this.Helpers = deps.Helpers;
    this.NotificationComponent = deps.NotificationComponent;
    this.dispatch = deps.dispatch;
    this.StoreActionTypes = deps.StoreActionTypes;

    if (this.Helpers && this.Helpers.load_css) {
      try {
        const link_tag = document.querySelector(`link[href="${this.CSS_PATH}"]`);
        if (!link_tag) await this.Helpers.load_css(this.CSS_PATH);
      } catch (error) {
        console.warn('Failed to load CSS for GlobalActionBarComponent:', error);
      }
    }

    this.save_audit_button_container_element = this.Helpers.create_element(
      'div',
      { class_name: 'save-audit-button-container' }
    );

    // Initialize child component
    this.save_audit_button_instance = new SaveAuditButtonComponent();
    await this.save_audit_button_instance.init({
      root: this.save_audit_button_container_element,
      deps: this.deps
    });

    // Setup MutationObserver for theme synchronization
    this.setup_theme_observer();
  }

  clone_rulefile_content(ruleFileContent) {
    return JSON.parse(JSON.stringify(ruleFileContent));
  }

  compute_next_version(current_version_string, today) {
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

  to_filename_version_suffix(version_string) {
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

  generate_rulefile_filename(title, version_string) {
    const default_extension = '.json';
    const version_suffix = this.to_filename_version_suffix(version_string);
    const safe_suffix = version_suffix ? `_${version_suffix}` : '';

    let base_name = (title || 'rulefile').trim();
    // Ersätt alla whitespace med understreck
    base_name = base_name.replace(/\s+/g, '_');
    // Ta bort ogiltiga filnamnstecken: \ / : * ? " < > |
    base_name = base_name.replace(/[\\/:*?"<>|]/g, '');

    return `${base_name}${safe_suffix}${default_extension}`;
  }

  handle_save_rulefile() {
    const t = this.Translation.t;
    const current_state = this.getState();

    if (!current_state.ruleFileContent) {
      this.NotificationComponent.show_global_message(t('error_internal'), 'error');
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
    let filename_for_download = 'rulefile.json';

    if (is_edit_mode && has_changes) {
      const updated_rulefile_content = this.clone_rulefile_content(
        current_state.ruleFileContent
      );
      const current_metadata = updated_rulefile_content.metadata || {};
      const next_version = this.compute_next_version(
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
      const title = updated_rulefile_content.metadata?.title || 'rulefile';
      filename_for_download = this.generate_rulefile_filename(
        title,
        next_version
      );

      if (typeof this.dispatch === 'function' && this.StoreActionTypes) {
        this.dispatch({
          type: this.StoreActionTypes.SET_RULE_FILE_CONTENT,
          payload: { ruleFileContent: updated_rulefile_content },
        });
        this.dispatch({
          type: this.StoreActionTypes.SET_RULEFILE_EDIT_BASELINE,
          payload: {
            originalRuleFileContentString: data_string_for_download,
            originalRuleFileFilename: filename_for_download,
          },
        });
      }
    } else if (is_edit_mode && !has_changes && original_string) {
      data_string_for_download = original_string;
      // Generera filnamn baserat på titel även när det inte finns ändringar
      const current_metadata = current_state.ruleFileContent?.metadata || {};
      const current_version = current_metadata.version || null;
      const title = current_metadata.title || 'rulefile';
      filename_for_download = this.generate_rulefile_filename(
        title,
        current_version
      );
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

    this.NotificationComponent.show_global_message(
      t('rulefile_saved_as_file', { filename: filename_for_download }),
      'success'
    );
  }

  handle_language_change(event) {
    this.Translation.set_language(event.target.value);
  }

  toggle_theme() {
    const current_theme =
      document.documentElement.getAttribute('data-theme') || 'light';
    this.set_theme(current_theme === 'dark' ? 'light' : 'dark');
  }

  set_theme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme_preference', theme);
    // Button update is now handled by MutationObserver
  }

  setup_theme_observer() {
    // Disconnect existing observer if any
    if (this.theme_observer) {
      this.theme_observer.disconnect();
    }

    this.theme_observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          const new_theme = document.documentElement.getAttribute('data-theme') || 'light';
          this.update_theme_button_content(new_theme);
        }
      });
    });

    this.theme_observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // Initial sync
    const current_theme = document.documentElement.getAttribute('data-theme') || 'light';
    this.update_theme_button_content(current_theme);
  }

  update_theme_button_content(theme) {
    if (!this.theme_toggle_button) return;

    const t = this.Translation.t;
    this.theme_toggle_button.innerHTML = '';
    const icon_color = getComputedStyle(document.documentElement)
      .getPropertyValue('--button-default-text')
      .trim();

    if (theme === 'dark') {
      const light_span = this.Helpers.create_element('span', {
        class_name: 'button-text',
        text_content: t('light_mode'),
      });
      this.theme_toggle_button.appendChild(light_span);
      if (this.Helpers.get_icon_svg) {
        const light_icon = this.Helpers.get_icon_svg(
          'light_mode',
          [icon_color],
          18
        );
        if (light_icon) {
          this.theme_toggle_button.insertAdjacentHTML('beforeend', light_icon);
        }
      }
      this.theme_toggle_button.setAttribute('aria-label', t('light_mode'));
    } else {
      const dark_span = this.Helpers.create_element('span', {
        class_name: 'button-text',
        text_content: t('dark_mode'),
      });
      this.theme_toggle_button.appendChild(dark_span);
      if (this.Helpers.get_icon_svg) {
        const dark_icon = this.Helpers.get_icon_svg('dark_mode', [icon_color], 18);
        if (dark_icon) {
          this.theme_toggle_button.insertAdjacentHTML('beforeend', dark_icon);
        }
      }
      this.theme_toggle_button.setAttribute('aria-label', t('dark_mode'));
    }
  }

  render() {
    if (!this.root) return;
    this.root.innerHTML = '';

    const t = this.Translation.t;
    const current_state = this.getState();
    const audit_status = current_state?.auditStatus;
    const has_rulefile_loaded = Boolean(current_state?.ruleFileContent);

    const bar_element = this.Helpers.create_element('div', {
      class_name: 'global-action-bar',
    });
    const left_group = this.Helpers.create_element('div', {
      class_name: ['action-bar-group', 'left'],
    });

    if (audit_status !== 'rulefile_editing' && has_rulefile_loaded) {
      if (this.save_audit_button_instance) {
        this.save_audit_button_instance.render();
        left_group.appendChild(this.save_audit_button_container_element);
      }
    } else if (audit_status === 'rulefile_editing' && has_rulefile_loaded) {
      const save_rulefile_button = this.Helpers.create_element('button', {
        class_name: ['button', 'button-primary'],
        html_content:
          `<span class="button-text">${t('save_and_download_rulefile')}</span>` +
          (this.Helpers.get_icon_svg
            ? this.Helpers.get_icon_svg('save', ['currentColor'], 18)
            : ''),
      });
      save_rulefile_button.addEventListener('click', this.handle_save_rulefile);
      left_group.appendChild(save_rulefile_button);
    }

    bar_element.appendChild(left_group);

    const right_group = this.Helpers.create_element('div', {
      class_name: ['action-bar-group', 'right'],
    });

    const language_selector_container = this.Helpers.create_element('div', {
      class_name: 'language-selector-container',
    });
    const language_label = this.Helpers.create_element('label', {
      attributes: { for: `language-selector-${this.root.id}` },
      text_content: t('language_switcher_label'),
      class_name: 'visually-hidden',
    });
    language_selector_container.appendChild(language_label);

    const language_selector = this.Helpers.create_element('select', {
      id: `language-selector-${this.root.id}`,
      class_name: ['form-control', 'form-control-small'],
    });
    const supported_languages = this.Translation.get_supported_languages();
    for (const lang_code in supported_languages) {
      const option = this.Helpers.create_element('option', {
        value: lang_code,
        text_content: supported_languages[lang_code],
      });
      language_selector.appendChild(option);
    }
    language_selector.value = this.Translation.get_current_language_code();
    language_selector.addEventListener('change', this.handle_language_change);
    language_selector_container.appendChild(language_selector);
    right_group.appendChild(language_selector_container);

    this.theme_toggle_button = this.Helpers.create_element('button', {
      class_name: ['button', 'button-default'],
      attributes: { 'aria-live': 'polite' },
    });

    this.theme_toggle_button.addEventListener('click', this.toggle_theme);

    // Initial content set (will also be handled by observer, but good for initial render)
    const current_theme = document.documentElement.getAttribute('data-theme') || 'light';
    this.update_theme_button_content(current_theme);

    right_group.appendChild(this.theme_toggle_button);

    bar_element.appendChild(right_group);
    this.root.appendChild(bar_element);
  }

  destroy() {
    if (this.root) this.root.innerHTML = '';

    // Destroy child component
    if (this.save_audit_button_instance) {
      this.save_audit_button_instance.destroy();
    }

    if (this.theme_observer) {
      this.theme_observer.disconnect();
      this.theme_observer = null;
    }

    this.root = null;
    this.deps = null;
    this.save_audit_button_container_element = null;
    this.theme_toggle_button = null;
    this.Helpers = null;
    this.Translation = null;
    this.getState = null;
    this.dispatch = null;
  }
}
