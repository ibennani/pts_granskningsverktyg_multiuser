// js/main.js

import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import * as Helpers from './utils/helpers.js';
import * as TranslationLogic from './translation_logic.js';
import { NotificationComponent } from './components/NotificationComponent.js';
import { ProgressBarComponent } from './components/ProgressBarComponent.js';
import * as AuditLogic from './audit_logic.js';
import './export_logic.js';
import * as SaveAuditLogic from './logic/save_audit_logic.js';
import * as ValidationLogic from './validation_logic.js';
import * as RulefileUpdaterLogic from './logic/rulefile_updater_logic.js';
import * as ScoreCalculator from './logic/ScoreCalculator.js';
import * as RuleDataProcessor from './logic/RuleDataProcessor.js';
import * as RulefileEditorLogic from './logic/rulefile_editor_logic.js';
import { AutosaveService } from './logic/autosave_service.js';
import { MarkdownToolbar } from './features/markdown_toolbar.js';
import './utils/dependency_manager.js';
import './utils/console_manager.js';
import './utils/memory_manager.js';
import { dependencyManager } from './utils/dependency_manager.js';
import { consoleManager } from './utils/console_manager.js';
import { memoryManager } from './utils/memory_manager.js';

import { UploadViewComponent } from './components/UploadViewComponent.js';
import { EditMetadataViewComponent } from './components/EditMetadataViewComponent.js'; 
import { SampleManagementViewComponent } from './components/SampleManagementViewComponent.js';
import { SampleFormViewComponent } from './components/SampleFormViewComponent.js';
import { ConfirmSampleEditViewComponent } from './components/ConfirmSampleEditViewComponent.js';
import { AuditOverviewComponent } from './components/AuditOverviewComponent.js';
import { RequirementListComponent } from './components/RequirementListComponent.js';
import { RequirementAuditComponent } from './components/RequirementAuditComponent.js';
import { UpdateRulefileViewComponent } from './components/UpdateRulefileViewComponent.js'; 
import { RestoreSessionViewComponent } from './components/RestoreSessionViewComponent.js'; 
import { ConfirmUpdatesViewComponent } from './components/ConfirmUpdatesViewComponent.js';
import { FinalConfirmUpdatesViewComponent } from './components/FinalConfirmUpdatesViewComponent.js';
import { EditRulefileMainViewComponent } from './components/EditRulefileMainViewComponent.js';
import { RulefileRequirementsListComponent } from './components/RulefileRequirementsListComponent.js';
import { ViewRulefileRequirementComponent } from './components/ViewRulefileRequirementComponent.js';
import { EditRulefileRequirementComponent } from './components/EditRulefileRequirementComponent.js';
import { ConfirmDeleteViewComponent } from './components/ConfirmDeleteViewComponent.js';
import { EditRulefileMetadataViewComponent } from './components/EditRulefileMetadataViewComponent.js';
import { EditGeneralSectionComponent } from './components/EditGeneralSectionComponent.js';
import { EditPageTypesSectionComponent } from './components/EditPageTypesSectionComponent.js';
import { RulefileSectionsViewComponent } from './components/RulefileSectionsViewComponent.js';
import { ErrorBoundaryComponent } from './components/ErrorBoundaryComponent.js';
import { SideMenuComponent } from './components/SideMenuComponent.js';
import { AuditActionsViewComponent } from './components/AuditActionsViewComponent.js';
import { AllRequirementsViewComponent } from './components/AllRequirementsViewComponent.js';
import { AuditProblemsViewComponent } from './components/AuditProblemsViewComponent.js';
import { AuditImagesViewComponent } from './components/AuditImagesViewComponent.js';

import { GlobalActionBarComponent } from './components/GlobalActionBarComponent.js';
import { ModalComponent } from './components/ModalComponent.js';
import { show_confirm_delete_modal } from './logic/confirm_delete_modal_logic.js';

import { DraftManager } from './draft_manager.js';
import { getState, dispatch, subscribe, initState, StoreActionTypes, StoreInitialState, loadStateFromLocalStorageBackup, clearLocalStorageBackup, updateBackupRestorePosition, APP_STATE_KEY } from './state.js';
window.getState = getState;
window.dispatch = dispatch;
window.Store = { getState, dispatch, subscribe, StoreActionTypes, StoreInitialState };
window.StoreActionTypes = StoreActionTypes;
window.NotificationComponent = NotificationComponent;
window.ModalComponent = ModalComponent;
window.show_confirm_delete_modal = show_confirm_delete_modal;
window.dependencyManager = dependencyManager;
window.Helpers = Helpers;
window.Translation = TranslationLogic;
window.SaveAuditLogic = SaveAuditLogic;
window.RulefileUpdaterLogic = RulefileUpdaterLogic;
window.ScoreCalculator = ScoreCalculator;
window.RuleDataProcessor = RuleDataProcessor;
window.RulefileEditorLogic = RulefileEditorLogic;
window.AutosaveService = AutosaveService;
// Compatibility assignment
window.ValidationLogic = ValidationLogic;
window.AuditLogic = AuditLogic; // Compatibility assignment
window.DraftManager = DraftManager;


(function () {
    'use-strict';

    // Robust DOM-element kontroll med fallback-alternativ
    let app_wrapper = document.getElementById('app-wrapper');
    let app_container = document.getElementById('app-container');
    let top_action_bar_container = document.getElementById('global-action-bar-top');
    let bottom_action_bar_container = document.getElementById('global-action-bar-bottom');

    let side_menu_root = null;
    let main_view_root = null;
    let right_sidebar_root = null;
    const side_menu_component_instance = SideMenuComponent;

    // Fallback för app_wrapper - kritiskt element
    if (!app_wrapper) {
        consoleManager.error("[Main.js] CRITICAL: App wrapper not found in DOM! Creating fallback wrapper.");
        app_wrapper = document.createElement('div');
        app_wrapper.id = 'app-wrapper';
        
        // Lägg till i body om body finns, annars i documentElement
        if (document.body) {
            document.body.appendChild(app_wrapper);
        } else {
            document.documentElement.appendChild(app_wrapper);
        }
    }

    // Fallback för app_container - kritiskt element
    if (!app_container) {
        consoleManager.error("[Main.js] CRITICAL: App container not found in DOM! Creating fallback container.");
        app_container = document.createElement('div');
        app_container.id = 'app-container';
        app_container.style.cssText = 'min-height: 100vh; padding: 20px;';
        
        // Lägg till i wrapper om den finns, annars i body
        if (app_wrapper) {
            app_wrapper.appendChild(app_container);
        } else if (document.body) {
            document.body.appendChild(app_container);
        } else {
            document.documentElement.appendChild(app_container);
        }
    }

    // Fallback för action bar containers - mindre kritiskt
    if (!top_action_bar_container) {
        consoleManager.warn("[Main.js] Top action bar container not found. Creating fallback container.");
        top_action_bar_container = document.createElement('nav');
        top_action_bar_container.id = 'global-action-bar-top';
        top_action_bar_container.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #f8f9fa; border-bottom: 1px solid #dee2e6;';
        
        // Lägg till i wrapper om den finns, annars i body
        if (app_wrapper) {
            app_wrapper.insertBefore(top_action_bar_container, app_wrapper.firstChild);
        } else if (document.body) {
            document.body.insertBefore(top_action_bar_container, document.body.firstChild);
        } else {
            app_container.insertBefore(top_action_bar_container, app_container.firstChild);
        }
    }

    if (!bottom_action_bar_container) {
        consoleManager.warn("[Main.js] Bottom action bar container not found. Creating fallback container.");
        bottom_action_bar_container = document.createElement('nav');
        bottom_action_bar_container.id = 'global-action-bar-bottom';
        bottom_action_bar_container.style.cssText = 'position: fixed; bottom: 0; left: 0; right: 0; z-index: 1000; background: #f8f9fa; border-top: 1px solid #dee2e6;';
        
        // Lägg till i wrapper om den finns, annars i body
        if (app_wrapper) {
            app_wrapper.appendChild(bottom_action_bar_container);
        } else if (document.body) {
            document.body.appendChild(bottom_action_bar_container);
        } else {
            app_container.appendChild(bottom_action_bar_container);
        }
    }

    // Lägg till en varning om att fallback-element skapades
    if (!document.getElementById('app-container') || !document.getElementById('global-action-bar-top') || !document.getElementById('global-action-bar-bottom')) {
        consoleManager.warn("[Main.js] Some core containers were missing and fallback versions were created. Check HTML structure.");
    }

    let current_view_component_instance = null;
    let current_view_name_rendered = null;
    let current_view_params_rendered_json = "{}"; 
    let error_boundary_instance = null;
    let draft_listeners_initialized = false;
    let draft_is_composing = false;
    
    const top_action_bar_instance = new GlobalActionBarComponent();
    const bottom_action_bar_instance = new GlobalActionBarComponent();

    function ensure_app_layout() {
        if (!app_container) return;
        const existing_right_sidebar_root = document.getElementById('app-right-sidebar-root');
        if (document.getElementById('app-layout') && document.getElementById('app-main-view-root') && document.getElementById('app-side-menu-root') && existing_right_sidebar_root) {
            side_menu_root = document.getElementById('app-side-menu-root');
            main_view_root = document.getElementById('app-main-view-root');
            right_sidebar_root = existing_right_sidebar_root;
            return;
        }

        app_container.innerHTML = '';

        const layout = document.createElement('div');
        layout.id = 'app-layout';
        layout.className = 'app-layout';

        side_menu_root = document.createElement('div');
        side_menu_root.id = 'app-side-menu-root';
        side_menu_root.className = 'app-side-menu-root';

        main_view_root = document.createElement('main');
        main_view_root.id = 'app-main-view-root';
        main_view_root.className = 'app-main-view-root';
        main_view_root.setAttribute('tabindex', '-1');

        const right_sidebar = document.createElement('aside');
        right_sidebar.id = 'app-right-sidebar-root';
        right_sidebar.className = 'app-right-sidebar-root';
        right_sidebar_root = right_sidebar;

        layout.appendChild(side_menu_root);
        layout.appendChild(main_view_root);
        layout.appendChild(right_sidebar);
        app_container.appendChild(layout);
        if (typeof update_landmarks_and_skip_link === 'function') {
            update_landmarks_and_skip_link();
        }
    }

    function update_side_menu(view_name, params = {}) {
        if (!side_menu_component_instance || typeof side_menu_component_instance.render !== 'function') return;

        // Vid återställning av session ska vänstermenyn aldrig renderas.
        // Vi tömmer/döljer containern och lämnar utan att anropa render().
        if (view_name === 'restore_session') {
            if (side_menu_root) {
                side_menu_root.innerHTML = '';
                side_menu_root.classList.add('hidden');
            }
            return;
        }

        // När användaren anger metadata för en ny granskning ska vänstermenyn aldrig renderas.
        // Detta gäller under "not_started"-fasen i metadata-vyn.
        const state_for_menu = typeof getState === 'function' ? getState() : null;
        const is_initial_setup_view =
            (
                view_name === 'metadata' ||
                view_name === 'edit_metadata' ||
                view_name === 'sample_management' ||
                view_name === 'sample_form' ||
                view_name === 'confirm_sample_edit'
            ) &&
            state_for_menu?.auditStatus === 'not_started';
        if (is_initial_setup_view) {
            if (side_menu_root) {
                side_menu_root.innerHTML = '';
                side_menu_root.classList.add('hidden');
            }
            return;
        }

        // Säkerställ att menyn blir synlig igen när vi lämnar restore_session.
        if (side_menu_root) {
            side_menu_root.classList.remove('hidden');
        }

        if (typeof side_menu_component_instance.set_current_view === 'function') {
            side_menu_component_instance.set_current_view(view_name, params);
        }
        side_menu_component_instance.render();
    }

    function get_t_fallback() {
        return (typeof window.Translation !== 'undefined' && typeof window.Translation.t === 'function')
            ? window.Translation.t
            : (key, replacements) => `**${key}**`;
    }

    function updatePageTitle(viewName, params = {}) {
        const t = get_t_fallback();
        const title_suffix = ` | ${t('app_title_suffix')}`;
        let title_prefix = t('app_title');
        const current_state = getState();

        try {
            switch (viewName) {
                case 'upload':
                    title_prefix = t('start_or_load_audit_title');
                    break;
                case 'metadata':
                    title_prefix = t('audit_metadata_title');
                    break;
                case 'edit_metadata':
                    title_prefix = t('edit_audit_metadata_title');
                    break;
                case 'sample_management':
                    title_prefix = t('manage_samples_title');
                    break;
                case 'sample_form':
                    title_prefix = params.editSampleId ? t('edit_sample') : t('add_new_sample');
                    break;
                case 'confirm_sample_edit': 
                    title_prefix = t('sample_edit_confirm_dialog_title');
                    break;
                case 'audit_overview':
                    title_prefix = t('audit_overview_title');
                    break;
                case 'audit_actions':
                    title_prefix = t('audit_actions_title');
                    break;
                case 'all_requirements':
                    title_prefix = t('left_menu_all_requirements');
                    break;
                case 'audit_problems':
                    title_prefix = t('audit_problems_title');
                    break;
                case 'audit_images':
                    title_prefix = t('audit_images_title');
                    break;
                case 'requirement_list':
                    title_prefix = t('requirement_list_title_suffix');
                    break;
                case 'update_rulefile':
                    title_prefix = t('update_rulefile_title');
                    break;
                case 'restore_session':
                    title_prefix = t('restore_session_title');
                    break;
                case 'confirm_updates':
                    title_prefix = t('handle_updated_assessments_title', {count: ''}).trim();
                    break;
                case 'final_confirm_updates':
                    title_prefix = t('final_confirm_updates_title');
                    break;
                case 'edit_rulefile_main':
                    title_prefix = t('edit_rulefile_title');
                    break;
                case 'rulefile_requirements':
                    title_prefix = t('rulefile_requirements_menu_title');
                    break;
                case 'rulefile_view_requirement':
                    title_prefix = t('rulefile_view_requirement_title');
                    break;
                case 'rulefile_edit_requirement':
                    title_prefix = t('rulefile_edit_requirement_title');
                    break;
                case 'rulefile_add_requirement':
                    title_prefix = t('rulefile_add_requirement_title');
                    break;
                case 'rulefile_metadata_edit':
                    title_prefix = t('rulefile_metadata_edit_title');
                    break;
                case 'rulefile_sections_edit_general':
                    title_prefix = t('rulefile_sections_edit_general_title');
                    break;
                case 'rulefile_sections_edit_page_types':
                    title_prefix = t('rulefile_sections_edit_page_types_title');
                    break;
                case 'rulefile_sections':
                    title_prefix = t('rulefile_sections_title');
                    break;
                case 'confirm_delete':
                    switch(params.type) {
                        case 'requirement': title_prefix = t('rulefile_confirm_delete_title'); break;
                        case 'check': title_prefix = t('confirm_delete_check_title'); break;
                        case 'criterion': title_prefix = t('confirm_delete_criterion_title'); break;
                    }
                    break;
                case 'requirement_audit':
                    const requirement = current_state?.ruleFileContent?.requirements?.[params.requirementId];
                    const requirementTitle = requirement?.title;
                    const prefix = (current_state?.auditStatus === 'locked') ? t('view_prefix') : t('edit_prefix');
                    if (requirementTitle) {
                        title_prefix = `${prefix} ${requirementTitle}`;
                    } else {
                        title_prefix = t('audit_requirement_title');
                    }
                    break;
                default:
                    break;
            }
        } catch (e) {
            consoleManager.error("Error building page title:", e);
        }
        
        document.title = `${title_prefix}${title_suffix}`;
    }

    function update_app_chrome_texts() {
        const t = get_t_fallback();
        if (!window.Translation || typeof window.Translation.t !== 'function') {
            consoleManager.warn("[Main.js] update_app_chrome_texts: Translation.t is not available.");
            return;
        }
        try {
            if (top_action_bar_instance && typeof top_action_bar_instance.render === 'function') { 
                top_action_bar_instance.render(); 
            }
        } catch (error) {
            consoleManager.error("[Main.js] Error rendering top action bar:", error);
            if (error_boundary_instance && error_boundary_instance.show_error) {
                error_boundary_instance.show_error({
                    message: `Top action bar render failed: ${error.message}`,
                    stack: error.stack,
                    component: 'TopActionBar'
                });
            }
        }
        
        try {
            if (bottom_action_bar_instance && typeof bottom_action_bar_instance.render === 'function') { 
                bottom_action_bar_instance.render(); 
            }
        } catch (error) {
            consoleManager.error("[Main.js] Error rendering bottom action bar:", error);
            if (error_boundary_instance && error_boundary_instance.show_error) {
                error_boundary_instance.show_error({
                    message: `Bottom action bar render failed: ${error.message}`,
                    stack: error.stack,
                    component: 'BottomActionBar'
                });
            }
        }
    }

    async function init_global_components() {
        // Wait for dependency manager to be ready
        await window.dependencyManager?.initialize();
        
        if (!window.Translation || !window.Helpers || !NotificationComponent || !window.SaveAuditLogic) {
            consoleManager.error("[Main.js] init_global_components: Core dependencies not available!");
            return;
        }
        const common_deps = {
            getState: getState,
            dispatch: dispatch,
            StoreActionTypes: StoreActionTypes,
            Translation: window.Translation,
            Helpers: window.Helpers,
            NotificationComponent: NotificationComponent,
            ModalComponent: ModalComponent,
            SaveAuditLogic: window.SaveAuditLogic,
            AuditLogic: AuditLogic,
            ValidationLogic: ValidationLogic,
            AutosaveService: AutosaveService
        };

        // Initialize side menu (persistent)
        try {
            if (side_menu_root) {
                await side_menu_component_instance.init({
                    root: side_menu_root,
                    deps: {
                        ...common_deps,
                        router: navigate_and_set_hash,
                        subscribe
                    }
                });
            }
        } catch (error) {
            consoleManager.error("[Main.js] Failed to initialize side menu:", error);
        }
        try {
            await top_action_bar_instance.init({ root: top_action_bar_container, deps: common_deps });
        } catch (error) {
            consoleManager.error("[Main.js] Failed to initialize top action bar:", error);
            if (error_boundary_instance && error_boundary_instance.show_error) {
                error_boundary_instance.show_error({
                    message: `Top action bar initialization failed: ${error.message}`,
                    stack: error.stack,
                    component: 'TopActionBar'
                });
            }
        }
        
        try {
            await bottom_action_bar_instance.init({ root: bottom_action_bar_container, deps: common_deps });
        } catch (error) {
            consoleManager.error("[Main.js] Failed to initialize bottom action bar:", error);
            if (error_boundary_instance && error_boundary_instance.show_error) {
                error_boundary_instance.show_error({
                    message: `Bottom action bar initialization failed: ${error.message}`,
                    stack: error.stack,
                    component: 'BottomActionBar'
                });
            }
        }
        
        // Initialize error boundary
        try {
            error_boundary_instance = ErrorBoundaryComponent;
            await error_boundary_instance.init({ root: main_view_root || app_container, deps: common_deps });
        } catch (error) {
            consoleManager.error("[Main.js] Failed to initialize error boundary:", error);
        }

        // Initialize modal (global, samma nivå som app-wrapper)
        const modal_root = document.getElementById('modal-root');
        if (modal_root) {
            try {
                await ModalComponent.init({ root: modal_root, deps: common_deps });
            } catch (error) {
                consoleManager.error("[Main.js] Failed to initialize modal:", error);
            }
        }
    }
    
    function set_initial_theme() {
        const saved_theme = localStorage.getItem('theme_preference');
        if (saved_theme) {
            document.documentElement.setAttribute('data-theme', saved_theme);
        } else {
            const prefers_dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const initial_theme = prefers_dark ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', initial_theme);
        }
    }

    function navigate_and_set_hash(target_view_name, target_params = {}) {
        const target_hash_part = target_params && Object.keys(target_params).length > 0 ?
            `${target_view_name}?${new URLSearchParams(target_params).toString()}` :
            target_view_name;
        const new_hash = `#${target_hash_part}`;
        if (window.location.hash === new_hash) {
            if (current_view_component_instance && typeof current_view_component_instance.render === 'function') {
                current_view_component_instance.render();
            }
        } else {
            window.location.hash = new_hash; 
        }
    }

    let restore_position_state = { view: null, params: {}, focusInfo: null };

    function capture_focus_info_from_element(el) {
        if (!el || !main_view_root || !main_view_root.contains(el)) return null;
        const id = el.id;
        const name = el.getAttribute?.('name');
        const data_index = el.getAttribute?.('data-index');
        if (id) return { elementId: id, elementName: null, dataIndex: null };
        if (name !== null && name !== undefined) return { elementId: null, elementName: name, dataIndex: data_index };
        return null;
    }

    function update_restore_position(view, params, focus_info) {
        restore_position_state = {
            view: view,
            params: params || {},
            focusInfo: focus_info ?? restore_position_state.focusInfo
        };
    }

    window.__gv_get_restore_position = () => restore_position_state;

    function get_route_key_from_hash() {
        const hash = window.location.hash || '';
        const raw = hash.startsWith('#') ? hash.slice(1) : hash;
        const [view_name] = raw.split('?');
        return view_name || 'upload';
    }

    function get_scope_key_from_hash() {
        const route_key = get_route_key_from_hash();
        if (current_view_name_rendered === route_key) {
            return `${route_key}:${current_view_params_rendered_json}`;
        }
        const raw = (window.location.hash || '').replace(/^#/, '');
        const [, query = ''] = raw.split('?');
        if (!query) return `${route_key}:{}`;
        const url_params = new URLSearchParams(query);
        const params_obj = {};
        Array.from(url_params.entries()).forEach(([key, value]) => { params_obj[key] = value; });
        return `${route_key}:${JSON.stringify(params_obj)}`;
    }

    function should_capture_draft_target(target) {
        if (!target) return false;
        if (target.closest && target.closest('[data-draft-ignore="true"]')) return false;
        if (target.getAttribute && target.getAttribute('data-draft-ignore') === 'true') return false;
        if (target.getAttribute && target.getAttribute('data-draft-sensitive') === 'true') return false;
        if (target.type === 'password' || target.type === 'file') return false;
        if (target.isContentEditable) return true;
        const tag = target.tagName ? target.tagName.toLowerCase() : '';
        return tag === 'input' || tag === 'textarea' || tag === 'select';
    }

    function handle_draft_event(event) {
        if (!DraftManager?.captureFieldChange) return;
        if (!event || !event.target) return;
        if (draft_is_composing && event.type === 'input') return;
        const target = event.target;
        if (!should_capture_draft_target(target)) return;
        DraftManager.captureFieldChange(target);
    }

    function init_draft_manager() {
        DraftManager.init({
            getRouteKey: get_route_key_from_hash,
            getScopeKey: get_scope_key_from_hash,
            rootProvider: () => main_view_root || app_container,
            restorePolicy: { max_auto_restore_age_ms: 2 * 60 * 60 * 1000 },
            onConflict: () => {
                if (NotificationComponent?.show_global_message) {
                    NotificationComponent.show_global_message('Utkast uppdaterades i annan flik.', 'info');
                } else {
                    consoleManager.warn('[Main.js] Draft conflict detected.');
                }
            }
        });

        if (draft_listeners_initialized) return;
        draft_listeners_initialized = true;

        document.addEventListener('input', handle_draft_event, true);
        document.addEventListener('change', handle_draft_event, true);
        document.addEventListener('compositionstart', (event) => {
            draft_is_composing = true;
        }, true);
        document.addEventListener('compositionend', (event) => {
            draft_is_composing = false;
            handle_draft_event(event);
        }, true);

        window.addEventListener('pagehide', () => DraftManager.flushNow('pagehide'));
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) DraftManager.flushNow('visibilitychange');
        });
        window.addEventListener('beforeunload', () => DraftManager.flushNow('beforeunload'));
        window.addEventListener('storage', (event) => DraftManager.handleStorageEvent(event));
    }

    // --- START OF CHANGE ---
    function set_focus_to_h1() {
        memoryManager.setTimeout(() => {
            let force_focus = false;
            try {
                force_focus = window.sessionStorage?.getItem('gv_force_focus_h1_v1') === 'true';
                if (force_focus) {
                    window.sessionStorage?.removeItem('gv_force_focus_h1_v1');
                }
            } catch (e) {}
            // Kontrollera om en specifik fokusinstruktion redan har hanterats
            if (window.customFocusApplied && !force_focus) {
                // Återställ flaggan och gör ingenting mer
                window.customFocusApplied = false;
                return;
            }
            // Annars, kör den generella fokuseringen
            const focus_root = main_view_root || app_container;
            if (focus_root) {
                const h1_element = focus_root.querySelector('h1');
                if (h1_element) {
                    if (h1_element.getAttribute('tabindex') === null) {
                        h1_element.setAttribute('tabindex', '-1');
                    }
                    h1_element.focus();
                }
            }
        }, 100); 
    }
    // --- END OF CHANGE ---

    function apply_restore_focus_instruction({ view_root }) {
        if (!view_root) return false;
        const focus_info = window.__gv_restore_focus_info;
        if (!focus_info) return false;
        window.__gv_restore_focus_info = null;
        window.customFocusApplied = true;

        const try_focus = (attempts_left) => {
            let el = null;
            if (focus_info.elementId) {
                el = view_root.querySelector(`#${CSS.escape(focus_info.elementId)}`);
            }
            if (!el && focus_info.elementName) {
                el = view_root.querySelector(`[name="${CSS.escape(focus_info.elementName)}"]`);
                if (!el && focus_info.dataIndex !== null && focus_info.dataIndex !== undefined) {
                    const candidates = view_root.querySelectorAll(`[name="${CSS.escape(focus_info.elementName)}"]`);
                    const idx = parseInt(focus_info.dataIndex, 10);
                    if (!Number.isNaN(idx) && candidates[idx]) el = candidates[idx];
                }
            }
            if (el && document.contains(el)) {
                try {
                    el.focus({ preventScroll: false });
                    el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                } catch (e) {
                    el.focus();
                }
                return;
            }
            if (attempts_left > 0) {
                memoryManager.setTimeout(() => try_focus(attempts_left - 1), 50);
            }
        };
        memoryManager.setTimeout(() => try_focus(5), 100);
        return true;
    }

    function apply_post_render_focus_instruction({ view_name, view_root }) {
        if (view_root && apply_restore_focus_instruction({ view_root })) return true;

        // One-shot fokusinstruktioner används för att sätta fokus på rätt ställe
        // när användaren återgår från en vy till en annan (t.ex. efter formulär).
        if (!view_root || !window.sessionStorage) return false;

        const RETURN_FOCUS_AUDIT_INFO_H2_KEY = 'gv_return_focus_audit_info_h2_v1';

        if (view_name !== 'audit_overview') return false;

        let raw = null;
        try {
            raw = window.sessionStorage.getItem(RETURN_FOCUS_AUDIT_INFO_H2_KEY);
        } catch (e) {
            return false;
        }
        if (!raw) return false;

        let instruction = null;
        try {
            instruction = JSON.parse(raw);
        } catch (e) {
            try { window.sessionStorage.removeItem(RETURN_FOCUS_AUDIT_INFO_H2_KEY); } catch (err) {}
            return false;
        }

        if (instruction?.focus !== 'audit_info_h2') {
            try { window.sessionStorage.removeItem(RETURN_FOCUS_AUDIT_INFO_H2_KEY); } catch (err) {}
            return false;
        }

        // Hindra generella "fokusera <h1>" från att skriva över.
        window.customFocusApplied = true;

        // Försök hitta rubriken efter render. Om den ännu inte finns (pga sub-render),
        // gör ett par retry-försök innan vi ger upp.
        let attempts_left = 6;
        const try_focus = () => {
            const heading = view_root.querySelector('#audit-info-heading');
            if (heading) {
                // Scrolla så rubriken hamnar längst upp (med hänsyn till topp-baren)
                const top_action_bar = document.getElementById('global-action-bar-top');
                const top_bar_height = top_action_bar ? top_action_bar.offsetHeight : 0;

                const rect = heading.getBoundingClientRect();
                const absolute_top = rect.top + window.pageYOffset;
                const scroll_target = Math.max(0, absolute_top - top_bar_height);

                window.scrollTo({ top: scroll_target, behavior: 'auto' });

                try {
                    if (heading.getAttribute('tabindex') === null) {
                        heading.setAttribute('tabindex', '-1');
                    }
                    heading.focus({ preventScroll: true });
                } catch (e) {
                    heading.focus();
                }
                try { window.sessionStorage.removeItem(RETURN_FOCUS_AUDIT_INFO_H2_KEY); } catch (err) {}
                return;
            }

            attempts_left -= 1;
            if (attempts_left <= 0) {
                // Rensa för att undvika loop om elementet inte finns.
                try { window.sessionStorage.removeItem(RETURN_FOCUS_AUDIT_INFO_H2_KEY); } catch (err) {}
                return;
            }

            memoryManager.setTimeout(try_focus, 50);
        };

        // Vänta en tick så att DOM + subkomponenter hinner rendera.
        memoryManager.setTimeout(try_focus, 0);
        return true;
    }

    async function render_view(view_name_to_render, params_to_render = {}) {
        if (view_name_to_render === 'edit_rulefile_main') {
            view_name_to_render = 'rulefile_sections';
            params_to_render = { ...params_to_render, section: 'general' };
        }
        const t = get_t_fallback();
        const local_helpers_escape_html = (typeof window.Helpers !== 'undefined' && typeof window.Helpers.escape_html === 'function')
            ? window.Helpers.escape_html
            : (s) => s; 

        ensure_app_layout();
        const view_root = main_view_root || app_container;

        updatePageTitle(view_name_to_render, params_to_render);
        update_side_menu(view_name_to_render, params_to_render);

        top_action_bar_instance.render();
        bottom_action_bar_container.style.display = '';
        bottom_action_bar_instance.render();

        if (current_view_name_rendered === view_name_to_render && 
            current_view_params_rendered_json === JSON.stringify(params_to_render) &&
            current_view_component_instance && typeof current_view_component_instance.render === 'function') {
            
            current_view_component_instance.render();
            ensure_skip_link_target(view_root);
            return;
        }
        
        current_view_name_rendered = view_name_to_render;
        current_view_params_rendered_json = JSON.stringify(params_to_render);
        try { window.__gv_current_view_name = current_view_name_rendered; } catch (e) {}

        if (current_view_component_instance && typeof current_view_component_instance.destroy === 'function') {
            if (current_view_component_instance === RequirementListComponent && view_name_to_render === 'rulefile_requirements') {
                try {
                    current_view_component_instance.destroy();
                } catch (err) {
                    consoleManager.warn('[Main.js] Warning destroying RequirementListComponent before switching to rulefile view:', err);
                    // Log error to error boundary if available
                    if (error_boundary_instance && error_boundary_instance.show_error) {
                        error_boundary_instance.show_error({
                            message: `Component destruction failed: ${err.message}`,
                            stack: err.stack,
                            component: 'RequirementListComponent'
                        });
                    }
                }
            } else {
                try {
                    current_view_component_instance.destroy();
                } catch (err) {
                    consoleManager.error('[Main.js] Error destroying component:', err);
                    // Log error to error boundary if available
                    if (error_boundary_instance && error_boundary_instance.show_error) {
                        error_boundary_instance.show_error({
                            message: `Component destruction failed: ${err.message}`,
                            stack: err.stack,
                            component: current_view_name_rendered || 'Unknown'
                        });
                    }
                }
            }
        }
        if (view_root) {
            view_root.innerHTML = '';
        }
        current_view_component_instance = null;

        let ComponentClass;
        
        switch (view_name_to_render) {
            case 'upload': ComponentClass = UploadViewComponent; break;
            case 'metadata': ComponentClass = EditMetadataViewComponent; break;
            case 'edit_metadata': ComponentClass = EditMetadataViewComponent; break;
            case 'sample_management': ComponentClass = SampleManagementViewComponent; break;
            case 'sample_form': ComponentClass = SampleFormViewComponent; break;
            case 'confirm_sample_edit': ComponentClass = ConfirmSampleEditViewComponent; break; 
            case 'audit_overview': ComponentClass = AuditOverviewComponent; break;
            case 'audit_actions': ComponentClass = AuditActionsViewComponent; break;
            case 'all_requirements': ComponentClass = AllRequirementsViewComponent; break;
            case 'audit_problems': ComponentClass = AuditProblemsViewComponent; break;
            case 'audit_images': ComponentClass = AuditImagesViewComponent; break;
            case 'requirement_list': ComponentClass = RequirementListComponent; break;
            case 'requirement_audit': ComponentClass = RequirementAuditComponent; break;
            case 'update_rulefile': ComponentClass = UpdateRulefileViewComponent; break; 
            case 'restore_session': ComponentClass = RestoreSessionViewComponent; break;
            case 'confirm_updates': ComponentClass = ConfirmUpdatesViewComponent; break;
            case 'final_confirm_updates': ComponentClass = FinalConfirmUpdatesViewComponent; break;
            case 'edit_rulefile_main': ComponentClass = EditRulefileMainViewComponent; break;
            case 'rulefile_requirements': ComponentClass = RulefileRequirementsListComponent; break;
            case 'rulefile_view_requirement': ComponentClass = ViewRulefileRequirementComponent; break;
            case 'rulefile_edit_requirement': ComponentClass = EditRulefileRequirementComponent; break;
            case 'rulefile_add_requirement': ComponentClass = EditRulefileRequirementComponent; break;
            case 'rulefile_metadata_edit': ComponentClass = EditRulefileMetadataViewComponent; break;
            case 'rulefile_sections_edit_general': ComponentClass = EditGeneralSectionComponent; break;
            case 'rulefile_sections_edit_page_types': ComponentClass = EditPageTypesSectionComponent; break;
            case 'rulefile_sections': ComponentClass = RulefileSectionsViewComponent; break;
            case 'confirm_delete': ComponentClass = ConfirmDeleteViewComponent; break;
            default:
                consoleManager.error(`[Main.js] View "${view_name_to_render}" not found in render_view switch.`);
                const error_h1 = document.createElement('h1');
                error_h1.textContent = t("error_loading_view_details");
                const error_p = document.createElement('p');
                error_p.textContent = t("error_view_not_found", {viewName: local_helpers_escape_html(view_name_to_render)});
                if (view_root) {
                    view_root.appendChild(error_h1);
                    view_root.appendChild(error_p);
                    ensure_skip_link_target(view_root);
                }
                return;
        }

        try {
            // Clear any previous error boundary display
            if (error_boundary_instance && error_boundary_instance.clear_error) {
                error_boundary_instance.clear_error();
            }

            // Wait for dependencies to be ready before component initialization
            await dependencyManager.waitForDependencies();

            current_view_component_instance = ComponentClass; 

            if (!current_view_component_instance || typeof current_view_component_instance.init !== 'function' || typeof current_view_component_instance.render !== 'function') {
                throw new Error("Component is invalid or missing required methods.");
            }

            if (view_name_to_render === 'restore_session') {
                await current_view_component_instance.init({
                    root: view_root,
                    deps: {
                        router: navigate_and_set_hash,
                        params: params_to_render, // Contains on_restore, on_discard, autosaved_state
                        getState,
                        dispatch,
                        StoreActionTypes,
                        subscribe,
                        Translation: window.Translation,
                        Helpers: window.Helpers,
                        NotificationComponent: NotificationComponent,
                        SaveAuditLogic: window.SaveAuditLogic,
                        AuditLogic: AuditLogic,
                        ExportLogic: window.ExportLogic,
                        ValidationLogic: ValidationLogic,
                        AutosaveService: AutosaveService,
                        rightSidebarRoot: right_sidebar_root
                    }
                });
            } else {
                // Support new component standard (init({ root, deps }))
                // We assume if length is 1, it's the new standard
                if (current_view_component_instance.init.length === 1) {
                    await current_view_component_instance.init({
                        root: view_root,
                        deps: {
                            router: navigate_and_set_hash,
                            params: params_to_render,
                            getState,
                            dispatch,
                            StoreActionTypes,
                            subscribe,
                            Translation: window.Translation,
                            Helpers: window.Helpers,
                            NotificationComponent: NotificationComponent,
                            SaveAuditLogic: window.SaveAuditLogic,
                            AuditLogic: AuditLogic,
                            ExportLogic: window.ExportLogic,
                            ValidationLogic: ValidationLogic,
                            AutosaveService: AutosaveService,
                            rightSidebarRoot: right_sidebar_root
                        }
                    });
                } else {
                    // Legacy component support
                    await current_view_component_instance.init(
                        view_root, 
                        navigate_and_set_hash, 
                        params_to_render,
                        getState, 
                        dispatch,
                        StoreActionTypes,
                        subscribe
                    );
                }
            }
            
            current_view_component_instance.render();
            ensure_skip_link_target(view_root);
            if (DraftManager?.restoreIntoDom) {
                DraftManager.restoreIntoDom(view_root);
            }
            if (view_name_to_render !== 'restore_session') {
                update_restore_position(view_name_to_render, params_to_render, null);
                updateBackupRestorePosition(window.__gv_get_restore_position?.());
            }

            const did_apply_custom_focus = apply_post_render_focus_instruction({
                view_name: view_name_to_render,
                view_root
            });
            if (!did_apply_custom_focus) {
                set_focus_to_h1();
            }

        } catch (error) {
            consoleManager.error(`[Main.js] CATCH BLOCK: Error during view ${view_name_to_render} lifecycle:`, error);
            
            // Use error boundary if available, otherwise fall back to simple error display
            if (error_boundary_instance && error_boundary_instance.show_error) {
                const retry_callback = () => {
                    consoleManager.log(`[Main.js] Retrying view ${view_name_to_render}`);
                    render_view(view_name_to_render, params_to_render);
                };
                
                error_boundary_instance.show_error({
                    message: error.message,
                    stack: error.stack,
                    component: view_name_to_render
                }, retry_callback);
            } else {
                // Fallback to simple error display
                const view_name_escaped_for_error = local_helpers_escape_html(view_name_to_render);
                if(view_root) {
                    const error_h1 = document.createElement('h1');
                    error_h1.textContent = t("error_loading_view_details");
                    const error_p = document.createElement('p');
                    error_p.textContent = t("error_loading_view", {viewName: view_name_escaped_for_error, errorMessage: error.message});
                    view_root.appendChild(error_h1);
                    view_root.appendChild(error_p);
                    ensure_skip_link_target(view_root);
                }
            }
        }
    }

    const SKIP_LINK_ANCHOR_ID = 'main-content-heading';

    function handle_hash_change() { 
        const hash = window.location.hash.substring(1);
        const [view_name_from_hash, ...param_pairs] = hash.split('?');
        /* Ignorera #main-content-heading – det är en intern ankare för skiplänken, inte ett vynamn */
        const is_skip_link_anchor = view_name_from_hash === SKIP_LINK_ANCHOR_ID;
        const effective_view_name = is_skip_link_anchor ? '' : view_name_from_hash;

        const params = {};
        if (param_pairs.length > 0 && !is_skip_link_anchor) {
            const query_string = param_pairs.join('?');
            const url_params = new URLSearchParams(query_string);
            for (const [key, value] of url_params) { params[key] = value; }
         }
        let target_view = 'upload';
        let target_params = params;
        const current_global_state = getState();
        if (effective_view_name) {
            target_view = effective_view_name;
        } else if (current_global_state && current_global_state.ruleFileContent && current_global_state.auditStatus !== 'rulefile_editing') {
            target_view = 'audit_overview';
            target_params = {};
        } else if (current_global_state && current_global_state.ruleFileContent && current_global_state.auditStatus === 'rulefile_editing') {
            target_view = 'rulefile_sections';
            target_params = { section: 'general' };
        }
        if (is_skip_link_anchor) {
            const target_hash_part = target_params && Object.keys(target_params).length > 0 ?
                `${target_view}?${new URLSearchParams(target_params).toString()}` :
                target_view;
            history.replaceState(null, '', `#${target_hash_part}`);
        }
        render_view(target_view, target_params);
    }

    function on_language_changed_event() { 
        update_app_chrome_texts();
        try {
            const parsed_params = JSON.parse(current_view_params_rendered_json || '{}');
            updatePageTitle(current_view_name_rendered, parsed_params);
            update_side_menu(current_view_name_rendered, parsed_params);
        } catch (error) {
            consoleManager.warn('[Main.js] Failed to parse current view params for page title update:', error);
            updatePageTitle(current_view_name_rendered, {});
            update_side_menu(current_view_name_rendered, {});
        }
        if (current_view_component_instance && typeof current_view_component_instance.render === 'function') {
            current_view_component_instance.render();
        }
    }
    
    async function start_normal_session(options = {}) {
        const { restore_pending } = options;
        ensure_app_layout();
        await init_global_components(); 
        if (window.ScoreManager?.init) { window.ScoreManager.init(subscribe, getState, dispatch, StoreActionTypes); }
        if (MarkdownToolbar?.init) { MarkdownToolbar.init(); }
        // Lagra referenser till event listeners för senare cleanup
        const language_changed_handler = on_language_changed_event;
        const hash_change_handler = handle_hash_change;
        memoryManager.addEventListener(document, 'languageChanged', language_changed_handler);
        memoryManager.addEventListener(window, 'hashchange', hash_change_handler);

        let focus_capture_timer = null;
        const focus_in_handler = (e) => {
            if (focus_capture_timer) clearTimeout(focus_capture_timer);
            focus_capture_timer = setTimeout(() => {
                focus_capture_timer = null;
                const info = capture_focus_info_from_element(document.activeElement);
                if (info) {
                    update_restore_position(current_view_name_rendered, JSON.parse(current_view_params_rendered_json || '{}'), info);
                    updateBackupRestorePosition(window.__gv_get_restore_position?.());
                }
            }, 150);
        };
        const focus_root = main_view_root || app_container;
        if (focus_root) {
            focus_root.addEventListener('focusin', focus_in_handler);
        }

        // Exponera cleanup-funktion globalt
        window.cleanupGlobalEventListeners = () => {
            memoryManager.removeEventListener(document, 'languageChanged', language_changed_handler);
            memoryManager.removeEventListener(window, 'hashchange', hash_change_handler);
            const fr = main_view_root || app_container;
            if (fr) fr.removeEventListener('focusin', focus_in_handler);
            
            // Clean up error boundary
            if (error_boundary_instance && typeof error_boundary_instance.destroy === 'function') {
                try {
                    error_boundary_instance.destroy();
                } catch (error) {
                    consoleManager.error('[Main.js] Error cleaning up error boundary:', error);
                }
            }
            
            consoleManager.info('[Main.js] Global event listeners cleaned up');
        };
        subscribe((new_state, listener_meta) => { 
            if (listener_meta?.skip_render) {
                return;
            }
            try {
                top_action_bar_instance.render();
            } catch (error) {
                consoleManager.error("[Main.js] Error in subscription top action bar render:", error);
                if (error_boundary_instance && error_boundary_instance.show_error) {
                    error_boundary_instance.show_error({
                        message: `Top action bar subscription render failed: ${error.message}`,
                        stack: error.stack,
                        component: 'TopActionBar'
                    });
                }
            }
            
            try {
                bottom_action_bar_instance.render();
            } catch (error) {
                consoleManager.error("[Main.js] Error in subscription bottom action bar render:", error);
                if (error_boundary_instance && error_boundary_instance.show_error) {
                    error_boundary_instance.show_error({
                        message: `Bottom action bar subscription render failed: ${error.message}`,
                        stack: error.stack,
                        component: 'BottomActionBar'
                    });
                }
            }
            try {
                const parsed_params = JSON.parse(current_view_params_rendered_json || '{}');
                updatePageTitle(current_view_name_rendered, parsed_params);
                update_side_menu(current_view_name_rendered, parsed_params);
            } catch (error) {
                consoleManager.warn('[Main.js] Failed to parse current view params for page title update:', error);
                updatePageTitle(current_view_name_rendered, {});
                update_side_menu(current_view_name_rendered, {});
            }
            const hash = window.location.hash.substring(1);
            const [view_name_from_hash,] = hash.split('?');
            if (current_view_name_rendered === view_name_from_hash && 
                current_view_component_instance && typeof current_view_component_instance.render === 'function') {
                if (current_view_name_rendered !== 'confirm_sample_edit') {
                    if (current_view_name_rendered === 'rulefile_edit_requirement' || current_view_name_rendered === 'rulefile_add_requirement') {
                        const skip_count = Number(window.skipRulefileRequirementRender) || 0;
                        if (skip_count > 0) {
                            window.skipRulefileRequirementRender = skip_count - 1;
                            return;
                        }
                    }
                    try {
                        current_view_component_instance.render();
                        if (DraftManager?.restoreIntoDom) {
                            DraftManager.restoreIntoDom(main_view_root || app_container);
                        }
                    } catch (error) {
                        consoleManager.error("[Main.js] Error in subscription current view render:", error);
                        if (error_boundary_instance && error_boundary_instance.show_error) {
                            error_boundary_instance.show_error({
                                message: `Current view render failed: ${error.message}`,
                                stack: error.stack,
                                component: current_view_name_rendered || 'Unknown'
                            });
                        }
                    }
                }
            }
        });
        if (NotificationComponent?.clear_global_message) { NotificationComponent.clear_global_message(); }

        if (restore_pending) {
            const state_to_restore = restore_pending.state || restore_pending;
            const restore_position = restore_pending.restorePosition || null;
            const on_restore = () => {
                clearLocalStorageBackup();
                dispatch({ type: StoreActionTypes.LOAD_AUDIT_FROM_FILE, payload: state_to_restore });
                if (restore_position && restore_position.view) {
                    window.__gv_restore_focus_info = restore_position.focusInfo || null;
                    navigate_and_set_hash(restore_position.view, restore_position.params || {});
                }
                handle_hash_change();
            };
            const on_discard = () => {
                clearLocalStorageBackup();
                window.location.hash = '#upload';
                handle_hash_change();
            };
            await render_view('restore_session', {
                on_restore,
                on_discard,
                autosaved_state: state_to_restore
            });
        } else {
            handle_hash_change(); 
        }
        update_app_chrome_texts();
    } 

    function update_build_timestamp() {
        const buildTimestampElement = document.getElementById('build-timestamp');
        if (!buildTimestampElement) return;

        const t = window.Translation?.t || ((key, replacements) => {
            if (replacements) {
                let result = key;
                for (const [k, v] of Object.entries(replacements)) {
                    result = result.replace(`{${k}}`, v);
                }
                return result;
            }
            return key;
        });

        if (window.BUILD_INFO?.date && window.BUILD_INFO?.time) {
            const buildDate = window.BUILD_INFO.date;
            const buildTime = window.BUILD_INFO.time;
            buildTimestampElement.textContent = t('build_timestamp_built', { date: buildDate, time: buildTime });
            buildTimestampElement.style.display = 'block';
        } else {
            // Fallback: show current timestamp if BUILD_INFO is not available
            const now = new Date();
            const fallbackDate = now.toLocaleDateString('sv-SE');
            const fallbackTime = now.toLocaleTimeString('sv-SE', {
                hour: '2-digit',
                minute: '2-digit',
            });
            buildTimestampElement.textContent = t('build_timestamp_dev_fallback', { date: fallbackDate, time: fallbackTime });
            buildTimestampElement.style.display = 'block';
        }
    }

    function ensure_skip_link_target(root) {
        if (!root) return;
        const prev = document.getElementById('main-content-heading');
        if (prev) prev.removeAttribute('id');
        const h1 = root.querySelector('h1');
        if (h1) {
            h1.id = 'main-content-heading';
            if (h1.getAttribute('tabindex') === null) {
                h1.setAttribute('tabindex', '-1');
            }
        }
    }

    function setup_skip_link_click_handler() {
        const skip_link = document.querySelector('.skip-link');
        if (!skip_link || skip_link.hasAttribute('data-skip-handler-bound')) return;
        skip_link.setAttribute('data-skip-handler-bound', 'true');
        skip_link.addEventListener('click', (e) => {
            const target = document.getElementById(SKIP_LINK_ANCHOR_ID);
            if (target) {
                e.preventDefault();
                target.focus({ preventScroll: false });
                target.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }
        });
    }

    function update_landmarks_and_skip_link() {
        const t = typeof window.Translation !== 'undefined' && typeof window.Translation.t === 'function'
            ? window.Translation.t.bind(window.Translation)
            : (key) => key;
        const skip_link = document.querySelector('.skip-link');
        if (skip_link) skip_link.textContent = t('skip_to_content');
        const top_nav = document.getElementById('global-action-bar-top');
        if (top_nav) top_nav.setAttribute('aria-label', t('landmark_top_navigation'));
        const bottom_nav = document.getElementById('global-action-bar-bottom');
        if (bottom_nav) bottom_nav.setAttribute('aria-label', t('landmark_bottom_navigation'));
        const right_sidebar = document.getElementById('app-right-sidebar-root');
        if (right_sidebar) right_sidebar.setAttribute('aria-label', t('landmark_right_sidebar'));
    }

    async function init_app() { 
        set_initial_theme();
        // Add a small delay to ensure build-info.js is loaded
        memoryManager.setTimeout(() => {
            update_build_timestamp();
        }, 100);
        await window.Translation.ensure_initial_load();
        setup_skip_link_click_handler();
        update_landmarks_and_skip_link();
        document.addEventListener('languageChanged', update_landmarks_and_skip_link);

        const had_session_storage = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(APP_STATE_KEY) !== null;
        initState();
        init_draft_manager();

        dispatch({ type: StoreActionTypes.CLEAR_STAGED_SAMPLE_CHANGES });

        let restore_pending = null;
        if (!had_session_storage) {
            restore_pending = loadStateFromLocalStorageBackup();
            if (restore_pending) {
                consoleManager.log("[Main.js] Session was cleared (e.g. tab closed) but backup found in localStorage. Showing restore prompt.");
            }
        }

        const active_session_state = getState();
        if (active_session_state && active_session_state.ruleFileContent && active_session_state.auditStatus !== 'rulefile_editing') {
            consoleManager.log("[Main.js] Active session found in sessionStorage. Starting normally.");
            await start_normal_session({ restore_pending: null });
        } else if (restore_pending) {
            consoleManager.log("[Main.js] Showing restore session prompt.");
            await start_normal_session({ restore_pending });
        } else {
            consoleManager.log("[Main.js] No active session. Starting fresh.");
            await start_normal_session({ restore_pending: null });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init_app().catch(err => consoleManager.error("Error during app initialization (from DOMContentLoaded):", err));
        });
    } else {
        init_app().catch(err => consoleManager.error("Error during app initialization (direct call):", err));
    }

})();
