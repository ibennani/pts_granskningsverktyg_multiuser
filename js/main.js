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
import { AutosaveService, capture_focus_state, restore_focus_state } from './logic/autosave_service.js';
import { init_version_check_service } from './logic/version_check_service.js';
import { init_rulefile_view_poll_service } from './logic/rulefile_view_poll_service.js';
import { init_connectivity_service } from './logic/connectivity_service.js';
import {
    capture_focus_info_from_element,
    apply_post_render_focus_instruction,
    load_focus_storage,
    save_focus_storage,
    update_restore_position
} from './logic/focus_manager.js';
import {
    navigate_and_set_hash as navigate_and_set_hash_impl,
    handle_hash_change as handle_hash_change_impl,
    get_route_key_from_hash,
    get_scope_key_from_hash,
    get_scope_key_from_view_and_params
} from './logic/router.js';
import {
    updatePageTitle as updatePageTitle_impl,
    updatePageTitleFromCurrentView as updatePageTitleFromCurrentView_impl
} from './logic/page_title_manager.js';
import {
    set_initial_theme,
    is_dev_build_environment,
    refresh_dev_build_info_from_server,
    update_build_timestamp,
    start_normal_session as start_normal_session_impl
} from './logic/session_manager.js';
import { MarkdownToolbar } from './features/markdown_toolbar.js';
import './utils/dependency_manager.js';
import './utils/console_manager.js';
import './utils/memory_manager.js';
import { dependencyManager } from './utils/dependency_manager.js';
import { consoleManager } from './utils/console_manager.js';
import { memoryManager } from './utils/memory_manager.js';
import { LayoutManager } from './utils/layout_manager.js';
import { setup_tooltip_overlay } from './utils/overlay_portal.js';

import { EditMetadataViewComponent } from './components/EditMetadataViewComponent.js'; 
import { SampleManagementViewComponent } from './components/SampleManagementViewComponent.js';
import { SampleFormViewComponent } from './components/SampleFormViewComponent.js';
import { ConfirmSampleEditViewComponent } from './components/ConfirmSampleEditViewComponent.js';
import { AuditOverviewComponent } from './components/AuditOverviewComponent.js';
import { RequirementListComponent } from './components/RequirementListComponent.js';
import { RequirementAuditComponent } from './components/RequirementAuditComponent.js';
import { UpdateRulefileViewComponent } from './components/UpdateRulefileViewComponent.js'; 
import { apply_session_boot_merge_from_backup } from './logic/session_boot_merge.js';
import { ConfirmUpdatesViewComponent } from './components/ConfirmUpdatesViewComponent.js';
import { FinalConfirmUpdatesViewComponent } from './components/FinalConfirmUpdatesViewComponent.js';
import { EditRulefileMainViewComponent } from './components/EditRulefileMainViewComponent.js';
import { RulefileRequirementsListComponent } from './components/RulefileRequirementsListComponent.js';
import { ViewRulefileRequirementComponent } from './components/ViewRulefileRequirementComponent.js';
import { EditRulefileRequirementComponent } from './components/rulefile_editor/EditRulefileRequirementComponent.js';
import { ConfirmDeleteViewComponent } from './components/ConfirmDeleteViewComponent.js';
import { EditRulefileMetadataViewComponent } from './components/EditRulefileMetadataViewComponent.js';
import { RulefileMetadataViewComponent } from './components/RulefileMetadataViewComponent.js';
import { EditGeneralSectionComponent } from './components/EditGeneralSectionComponent.js';
import { EditPageTypesSectionComponent } from './components/EditPageTypesSectionComponent.js';
import { RulefileSectionsViewComponent } from './components/RulefileSectionsViewComponent.js';
import { ErrorBoundaryComponent } from './components/ErrorBoundaryComponent.js';
import { SideMenuComponent } from './components/SideMenuComponent.js';
import { AuditActionsViewComponent } from './components/AuditActionsViewComponent.js';
import { AllRequirementsViewComponent } from './components/AllRequirementsViewComponent.js';
import { AuditProblemsViewComponent } from './components/AuditProblemsViewComponent.js';
import { ArchivedRequirementsViewComponent } from './components/ArchivedRequirementsViewComponent.js';
import { RulefileChangeLogViewComponent } from './components/RulefileChangeLogViewComponent.js';
import { AuditImagesViewComponent } from './components/AuditImagesViewComponent.js';
import { BackupOverviewComponent } from './components/BackupOverviewComponent.js';
import { BackupSettingsViewComponent } from './components/BackupSettingsViewComponent.js';
import { AuditViewComponent } from './components/audit_view/AuditViewComponent.js';
import { StartViewComponent } from './components/StartViewComponent.js';
import { LoginViewComponent } from './components/LoginViewComponent.js';
import { ManageUsersViewComponent } from './components/ManageUsersViewComponent.js';

const auditViewComponent = new AuditViewComponent();
const allRequirementsViewComponent = new AllRequirementsViewComponent();
const loginViewComponent = new LoginViewComponent();
import { SettingsViewComponent } from './components/SettingsViewComponent.js';

import { GlobalActionBarComponent } from './components/GlobalActionBarComponent.js';
import { ModalComponent } from './components/ModalComponent.js';
import { show_confirm_delete_modal } from './logic/confirm_delete_modal_logic.js';
import { flush_sync_to_server } from './logic/server_sync.js';

import { DraftManager } from './draft_manager.js';
import { get_auth_token, clear_auth_token, get_current_user_preferences, set_current_user_admin } from './api/client.js';
import { getState, dispatch, subscribe, initState, StoreActionTypes, StoreInitialState, loadStateFromLocalStorageBackup, clearLocalStorageBackup, updateBackupRestorePosition, APP_STATE_KEY } from './state.js';

const notificationComponent = new NotificationComponent();

window.getState = getState;
window.dispatch = dispatch;
window.Store = { getState, dispatch, subscribe, StoreActionTypes, StoreInitialState };
window.StoreActionTypes = StoreActionTypes;
window.NotificationComponent = notificationComponent;
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

    // Debug-navigering: sätt window.__GV_DEBUG_NAV = true i konsolen ELLER lägg till ?debug=nav i URL
    if (typeof window !== 'undefined' && window.location.search.includes('debug=nav')) {
        window.__GV_DEBUG_NAV = true;
        consoleManager.log('[GV-NAV] Debug aktiverad via URL (?debug=nav). Klicka Granskningar från Start och titta i konsolen.');
    }

    const nav_debug = (msg, data) => {
        if (window.__GV_DEBUG_NAV) {
            consoleManager.log(`[GV-NAV] ${msg}`, data !== undefined ? data : '');
        }
    };

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
        top_action_bar_container = document.createElement('div');
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
        bottom_action_bar_container = document.createElement('div');
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
        main_view_root.className = 'app-main-view-root main-wrapper';
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

        // Vid inloggning ska vänstermenyn aldrig renderas.
        if (view_name === 'login') {
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

    function updatePageTitle(view_name, params) {
        return updatePageTitle_impl(view_name, params, { getState, Translation: window.Translation });
    }

    function updatePageTitleFromCurrentView() {
        return updatePageTitleFromCurrentView_impl({
            getState,
            Translation: window.Translation,
            get_current_view_name: () => current_view_name_rendered,
            get_current_view_params_json: () => current_view_params_rendered_json
        });
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
        
        if (!window.Translation || !window.Helpers || !notificationComponent || !window.SaveAuditLogic) {
            consoleManager.error("[Main.js] init_global_components: Core dependencies not available!");
            return;
        }
        const common_deps = {
            getState: getState,
            dispatch: dispatch,
            StoreActionTypes: StoreActionTypes,
            Translation: window.Translation,
            Helpers: window.Helpers,
            NotificationComponent: notificationComponent,
            ModalComponent: ModalComponent,
            SaveAuditLogic: window.SaveAuditLogic,
            AuditLogic: AuditLogic,
            ValidationLogic: ValidationLogic,
            AutosaveService: AutosaveService,
            get_current_view_name: () => current_view_name_rendered
        };

        // Initialize side menu (persistent)
        try {
            if (side_menu_root) {
                await side_menu_component_instance.init({
                    root: side_menu_root,
                    deps: {
                        ...common_deps,
                        router: navigate_and_set_hash,
                        subscribe,
                        clear_auth_token
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
    
    function navigate_and_set_hash(target_view_name, target_params = {}) {
        return navigate_and_set_hash_impl(target_view_name, target_params, {
            nav_debug,
            getState,
            get_current_view_name: () => current_view_name_rendered,
            get_current_view_component: () => current_view_component_instance,
            updatePageTitle
        });
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
            getScopeKey: () => get_scope_key_from_hash({ current_view_name_rendered, current_view_params_rendered_json }),
            rootProvider: () => main_view_root || app_container,
            restorePolicy: { max_auto_restore_age_ms: 2 * 60 * 60 * 1000 },
            onConflict: () => {
                if (notificationComponent?.show_global_message) {
                    notificationComponent.show_global_message((window.Translation?.t && window.Translation.t('draft_updated_other_tab')) || 'Utkast uppdaterades i annan flik.', 'info');
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

    async function render_view(view_name_to_render, params_to_render = {}) {
        nav_debug('render_view startar', { view_name_to_render, params_to_render });
        if (view_name_to_render === 'edit_rulefile_main') {
            view_name_to_render = 'rulefile_sections';
            params_to_render = { ...params_to_render, section: 'general' };
        }
        const t = get_t_fallback();
        const local_helpers_escape_html = (typeof window.Helpers !== 'undefined' && typeof window.Helpers.escape_html === 'function')
            ? window.Helpers.escape_html
            : (s) => s; 

        // Om en publicerad regelfil är laddad ska vi aldrig gå in i redigeringsvyerna
        // för enskilda krav. Skicka i stället användaren till visningsläget eller kravlistan.
        try {
            const state_for_view = typeof getState === 'function' ? getState() : null;
            const is_published_rulefile = state_for_view?.ruleFileIsPublished === true;
            if (is_published_rulefile &&
                (view_name_to_render === 'rulefile_edit_requirement' || view_name_to_render === 'rulefile_add_requirement')) {
                if (view_name_to_render === 'rulefile_edit_requirement' && params_to_render?.id) {
                    view_name_to_render = 'rulefile_view_requirement';
                } else {
                    view_name_to_render = 'rulefile_requirements';
                    params_to_render = {};
                }
            }
        } catch (e) {
            consoleManager.warn('[Main.js] Kunde inte kontrollera ruleFileIsPublished vid vybyte:', e?.message || e);
        }

        // Vid navigering till inloggning (t.ex. efter Logga ut) saknas on_login – då måste vi sätta den
        // så att lyckad inloggning startar session och tar användaren till startvyn.
        if (view_name_to_render === 'login' && typeof (params_to_render?.on_login) !== 'function') {
            params_to_render = {
                ...params_to_render,
                on_login: () => {
                    start_normal_session().catch((err) =>
                        consoleManager.error('Error starting session after login:', err)
                    );
                }
            };
        }

        if (view_name_to_render !== 'login') {
            ensure_app_layout();
        }

        let view_root;
        if (view_name_to_render === 'login') {
            document.body.classList.add('view-login');
            ensure_app_layout();
            view_root = main_view_root || app_container;
        } else {
            document.body.classList.remove('view-login');
            view_root = main_view_root || app_container;
        }

        update_side_menu(view_name_to_render, params_to_render);

        if (main_view_root) {
            if (view_name_to_render === 'start') {
                main_view_root.classList.add('start-view-active');
            } else {
                main_view_root.classList.remove('start-view-active');
            }
        }

        const prev_view = current_view_name_rendered;
        const prev_params_json = current_view_params_rendered_json;
        current_view_name_rendered = view_name_to_render;
        // Uppdatera params direkt efter view-name för att undvika inkonsekvent state
        // om subscribe-callback triggas under komponentens livscykel.
        current_view_params_rendered_json = JSON.stringify(params_to_render);
        try { window.__gv_current_view_name = current_view_name_rendered; } catch (e) {}

        const is_same_view_quick_render = prev_view === view_name_to_render &&
            prev_params_json === JSON.stringify(params_to_render) &&
            current_view_component_instance && typeof current_view_component_instance.render === 'function';

        if (is_same_view_quick_render) {
            top_action_bar_instance.render();
            bottom_action_bar_container.style.display = '';
            bottom_action_bar_instance.render();
            update_landmarks_and_skip_link();
            if (!is_focus_in_editable_field(view_root)) {
                current_view_component_instance.render();
            }
            ensure_skip_link_target(view_root);
            return;
        }
        top_action_bar_instance.render();
        bottom_action_bar_container.style.display = '';
        bottom_action_bar_instance.render();
        update_landmarks_and_skip_link();

        const prev_params = prev_params_json ? (() => { try { return JSON.parse(prev_params_json); } catch (_) { return {}; } })() : {};
        const is_rulefile_sections_edit_toggle = view_name_to_render === 'rulefile_sections' &&
            prev_view === 'rulefile_sections' &&
            prev_params.section === (params_to_render?.section || 'general') &&
            (prev_params.edit === 'true') !== (params_to_render?.edit === 'true') &&
            current_view_component_instance === RulefileSectionsViewComponent &&
            typeof current_view_component_instance.render === 'function';

        if (is_rulefile_sections_edit_toggle) {
            current_view_component_instance.deps.params = params_to_render;
            const renderPromise = current_view_component_instance.render();
            if (renderPromise && typeof renderPromise.then === 'function') {
                await renderPromise;
            }
            ensure_skip_link_target(view_root);
            if (DraftManager?.restoreIntoDom) DraftManager.restoreIntoDom(view_root);
            update_restore_position(view_name_to_render, params_to_render, null);
            updateBackupRestorePosition(window.__gv_get_restore_position?.());
            apply_post_render_focus_instruction({ view_name: view_name_to_render, view_root });
            return;
        }

        // Spara väntande ändringar till servern innan vi lämnar vyn (undviker förlust vid snabb navigering)
        try {
            await flush_sync_to_server(getState, dispatch);
        } catch (flushErr) {
            consoleManager.warn('[Main.js] flush_sync_to_server:', flushErr?.message || flushErr);
        }

        if (current_view_component_instance && typeof current_view_component_instance.destroy === 'function') {
            notificationComponent?.clear_global_message?.();
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
            case 'start': ComponentClass = auditViewComponent; break;
            case 'audit': ComponentClass = auditViewComponent; break;
            case 'audit_audits': ComponentClass = auditViewComponent; break;
            case 'audit_rules': ComponentClass = auditViewComponent; break;
            case 'manage_users': ComponentClass = ManageUsersViewComponent; break;
            case 'my_settings': ComponentClass = SettingsViewComponent; break;
            case 'login': ComponentClass = loginViewComponent; break;
            case 'metadata': ComponentClass = EditMetadataViewComponent; break;
            case 'edit_metadata': ComponentClass = EditMetadataViewComponent; break;
            case 'sample_management': ComponentClass = SampleManagementViewComponent; break;
            case 'sample_form': ComponentClass = SampleFormViewComponent; break;
            case 'confirm_sample_edit': ComponentClass = ConfirmSampleEditViewComponent; break; 
            case 'audit_overview': ComponentClass = AuditOverviewComponent; break;
            case 'audit_actions': ComponentClass = AuditActionsViewComponent; break;
            case 'all_requirements': ComponentClass = allRequirementsViewComponent; break;
            case 'audit_problems': ComponentClass = AuditProblemsViewComponent; break;
            case 'audit_images': ComponentClass = AuditImagesViewComponent; break;
            case 'archived_requirements': ComponentClass = ArchivedRequirementsViewComponent; break;
            case 'rulefile_change_log': ComponentClass = RulefileChangeLogViewComponent; break;
            case 'requirement_list': ComponentClass = RequirementListComponent; break;
            case 'requirement_audit': ComponentClass = RequirementAuditComponent; break;
            case 'update_rulefile': ComponentClass = UpdateRulefileViewComponent; break; 
            case 'confirm_updates': ComponentClass = ConfirmUpdatesViewComponent; break;
            case 'final_confirm_updates': ComponentClass = FinalConfirmUpdatesViewComponent; break;
            case 'edit_rulefile_main': ComponentClass = EditRulefileMainViewComponent; break;
            case 'rulefile_requirements': ComponentClass = RulefileRequirementsListComponent; break;
            case 'rulefile_view_requirement': ComponentClass = ViewRulefileRequirementComponent; break;
            case 'rulefile_edit_requirement': ComponentClass = EditRulefileRequirementComponent; break;
            case 'rulefile_add_requirement': ComponentClass = EditRulefileRequirementComponent; break;
            case 'rulefile_metadata_edit': ComponentClass = EditRulefileMetadataViewComponent; break;
            case 'rulefile_metadata_view': ComponentClass = RulefileMetadataViewComponent; break;
            case 'rulefile_sections_edit_general': ComponentClass = EditGeneralSectionComponent; break;
            case 'rulefile_sections_edit_page_types': ComponentClass = EditPageTypesSectionComponent; break;
            case 'rulefile_sections': ComponentClass = RulefileSectionsViewComponent; break;
            case 'backup': ComponentClass = BackupOverviewComponent; break;
            case 'backup_detail': ComponentClass = BackupOverviewComponent; break;
            case 'backup_settings': ComponentClass = BackupSettingsViewComponent; break;
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
            
            await current_view_component_instance.init({
                root: view_root,
                deps: {
                    router: navigate_and_set_hash,
                    params: params_to_render,
                    view_name: view_name_to_render,
                    getState,
                    dispatch,
                    StoreActionTypes,
                    subscribe,
                    flush_sync_to_server,
                    Translation: window.Translation,
                    Helpers: window.Helpers,
                    NotificationComponent: notificationComponent,
                    SaveAuditLogic: window.SaveAuditLogic,
                    AuditLogic: AuditLogic,
                    ExportLogic: window.ExportLogic,
                    ValidationLogic: ValidationLogic,
                    AutosaveService: AutosaveService,
                    rightSidebarRoot: right_sidebar_root
                }
            });
            
            const render_promise = current_view_component_instance.render();
            if (render_promise && typeof render_promise.then === 'function') {
                await render_promise;
            }
            // Sätt sidtiteln korrekt efter att komponenten renderat klart.
            // Kontrollera att vi fortfarande är i samma vy – render() kan ha navigerat iväg
            // (t.ex. till audit_overview om data saknas), i så fall ska vi inte skriva över titeln.
            if (current_view_name_rendered === view_name_to_render) {
                updatePageTitle(view_name_to_render, params_to_render);
            }
            ensure_skip_link_target(view_root);
            if (DraftManager?.restoreIntoDom) {
                DraftManager.restoreIntoDom(view_root);
            }
            update_restore_position(view_name_to_render, params_to_render, null);
            updateBackupRestorePosition(window.__gv_get_restore_position?.());

            apply_post_render_focus_instruction({
                view_name: view_name_to_render,
                view_root
            });

            // Uppdatera landmärken och skiplänk efter att vyn (inklusive sidokolumn) har renderats klart
            if (typeof update_landmarks_and_skip_link === 'function') {
                update_landmarks_and_skip_link(view_name_to_render, params_to_render);
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

    async function handle_hash_change() {
        return handle_hash_change_impl({
            nav_debug,
            dispatch,
            StoreActionTypes,
            navigate_and_set_hash,
            updatePageTitle,
            render_view,
            load_focus_storage,
            get_scope_key_from_view_and_params
        });
    }

    function on_language_changed_event() { 
        update_app_chrome_texts();
        updatePageTitleFromCurrentView();
        try {
            const parsed_params = JSON.parse(current_view_params_rendered_json || '{}');
            update_side_menu(current_view_name_rendered, parsed_params);
        } catch (error) {
            consoleManager.warn('[Main.js] Failed to parse current view params for side menu update:', error);
            update_side_menu(current_view_name_rendered, {});
        }
        if (current_view_component_instance && typeof current_view_component_instance.render === 'function') {
            current_view_component_instance.render();
        }
    }
    
    function is_focus_in_editable_field(view_root) {
        if (!view_root) return false;
        const active = document.activeElement;
        if (!active || !view_root.contains(active)) return false;
        const tag = active.tagName ? active.tagName.toLowerCase() : '';
        return tag === 'input' || tag === 'textarea' || tag === 'select';
    }

    async function start_normal_session(options = {}) {
        return start_normal_session_impl({
            ...options,
            ensure_app_layout,
            setup_tooltip_overlay,
            LayoutManager,
            init_global_components,
            init_connectivity_service,
            init_version_check_service,
            init_rulefile_view_poll_service,
            MarkdownToolbar,
            nav_debug,
            on_language_changed_event,
            handle_hash_change,
            capture_focus_info_from_element,
            get_main_view_root: () => main_view_root,
            get_app_container: () => app_container,
            get_current_view_name_rendered: () => current_view_name_rendered,
            get_current_view_params_rendered_json: () => current_view_params_rendered_json,
            update_restore_position,
            updateBackupRestorePosition,
            get_scope_key_from_view_and_params,
            load_focus_storage,
            save_focus_storage,
            top_action_bar_instance,
            bottom_action_bar_instance,
            error_boundary_instance,
            NotificationComponent: notificationComponent,
            DraftManager,
            capture_focus_state,
            restore_focus_state,
            updatePageTitleFromCurrentView,
            update_side_menu,
            get_current_view_component: () => current_view_component_instance,
            is_focus_in_editable_field,
            subscribe,
            getState,
            dispatch,
            StoreActionTypes,
            update_app_chrome_texts
        });
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
            e.preventDefault();
            const main_root = document.getElementById('app-main-view-root');
            const first_h1 = main_root?.querySelector('h1');
            if (first_h1) {
                if (first_h1.getAttribute('tabindex') === null) {
                    first_h1.setAttribute('tabindex', '-1');
                }
                first_h1.focus({ preventScroll: false });
                first_h1.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }
        });
    }

    function update_landmarks_and_skip_link(view_name, params) {
        const t = typeof window.Translation !== 'undefined' && typeof window.Translation.t === 'function'
            ? window.Translation.t.bind(window.Translation)
            : (key) => key;

        // Uppdatera endast text på skiplänken – den är aldrig ett eget landmärke
        const skip_link = document.querySelector('.skip-link');
        if (skip_link) {
            skip_link.textContent = t('skip_to_content');
        }

        // Huvudinnehåll: exakt ett main-landmärke
        const main_el = document.getElementById('app-main-view-root');
        if (main_el) {
            // Rensa tidigare namn
            main_el.removeAttribute('aria-label');
            main_el.removeAttribute('aria-labelledby');

            // Försök koppla main till sidans huvudrubrik
            const root_for_heading = main_el || document;
            const heading = root_for_heading.querySelector('#main-content-heading') || root_for_heading.querySelector('h1');
            if (heading && heading.id) {
                main_el.setAttribute('aria-labelledby', heading.id);
            } else {
                main_el.setAttribute('aria-label', t('landmark_main_default'));
            }
        }

        // Globala action bars ska inte vara separata landmärken
        const top_container = document.getElementById('global-action-bar-top');
        if (top_container) {
            top_container.removeAttribute('aria-label');
            top_container.removeAttribute('aria-hidden');
        }
        const bottom_container = document.getElementById('global-action-bar-bottom');
        if (bottom_container) {
            bottom_container.removeAttribute('aria-label');
            bottom_container.removeAttribute('aria-hidden');
        }

        // Högerspalt som komplementärt landmärke när den har innehåll
        const right_sidebar = document.getElementById('app-right-sidebar-root');
        if (right_sidebar) {
            const sidebar_has_content = right_sidebar.childElementCount > 0;
            if (sidebar_has_content) {
                right_sidebar.setAttribute('aria-label', t('landmark_sidebar'));
                right_sidebar.removeAttribute('aria-hidden');
            } else {
                right_sidebar.removeAttribute('aria-label');
                right_sidebar.setAttribute('aria-hidden', 'true');
            }
        }
    }

    async function init_app() { 
        const AUTH_REQUIRED_EVENT = 'gv-auth-required';
        const AUTH_REQUIRED_MESSAGE_KEY = 'gv_auth_required_message';

        set_initial_theme();
        // Läs in färsk build-info i dev (cachning av första script-taggen) innan tidsstämpel sätts
        memoryManager.setTimeout(() => {
            (async () => {
                await refresh_dev_build_info_from_server();
                update_build_timestamp();
            })();
        }, 100);
        if (is_dev_build_environment()) {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState !== 'visible') return;
                (async () => {
                    await refresh_dev_build_info_from_server();
                    update_build_timestamp();
                })();
            });
        }
        await window.Translation.ensure_initial_load();
        setup_skip_link_click_handler();
        update_landmarks_and_skip_link();
        document.addEventListener('languageChanged', update_landmarks_and_skip_link);

        const had_session_storage = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(APP_STATE_KEY) !== null;
        initState();
        init_draft_manager();

        // Om servern svarar 401 (ogiltig/utgången token) vill vi växla tillbaka till inloggning
        // utan att lämna kvar bakgrundstjänster som fortsätter att göra anrop.
        const on_auth_required = async () => {
            if (window.__gv_auth_required_in_progress) return;
            window.__gv_auth_required_in_progress = true;
            try {
                if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(AUTH_REQUIRED_MESSAGE_KEY, '1');
            } catch (_) {}
            try {
                if (typeof window.cleanupGlobalEventListeners === 'function') {
                    window.cleanupGlobalEventListeners();
                }
            } catch (_) {}

            // Växla till inloggningsvy direkt i stället för att ladda om sidan
            ensure_app_layout();
            await init_global_components();
            if (side_menu_root) {
                side_menu_root.innerHTML = '';
                side_menu_root.classList.add('hidden');
            }
            try {
                const t = window.Translation?.t ?? ((k) => k);
                notificationComponent?.show_global_message?.(t('auth_session_expired'), 'warning');
            } catch (_) {}

            await render_view('login', {
                on_login: () => {
                    if (side_menu_root) side_menu_root.classList.remove('hidden');
                    start_normal_session().catch((err) =>
                        consoleManager.error('Error starting session after auth-required:', err)
                    );
                }
            });
        };
        memoryManager.addEventListener(window, AUTH_REQUIRED_EVENT, on_auth_required);

        let visibility_was_hidden = document.hidden;
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                visibility_was_hidden = true;
                return;
            }
            if (!visibility_was_hidden) return;
            visibility_was_hidden = false;
            const state = getState();
            if (!state?.auditId || state.auditStatus === 'rulefile_editing') return;
            (async () => {
                try {
                    const { load_audit_with_rule_file } = await import('./api/client.js');
                    const full_state = await load_audit_with_rule_file(state.auditId);
                    if (full_state?.samples) {
                        dispatch({
                            type: StoreActionTypes.REPLACE_STATE_FROM_REMOTE,
                            payload: { ...full_state, saveFileVersion: full_state.saveFileVersion || '2.1.0' }
                        });
                    }
                } catch (e) {
                    if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[Main.js] Synk vid flikbyte:', e);
                }
            })();
        });

        if (typeof BroadcastChannel !== 'undefined') {
            const audit_updates_channel = new BroadcastChannel('granskningsverktyget-audit-updates');
            audit_updates_channel.onmessage = (event) => {
                const msg = event?.data;
                if (msg?.type !== 'audit-updated' || !msg.auditId) return;
                const state = getState();
                if (!state?.auditId || state.auditId !== msg.auditId || state.auditStatus === 'rulefile_editing') return;
                (async () => {
                    try {
                        const { load_audit_with_rule_file } = await import('./api/client.js');
                        const full_state = await load_audit_with_rule_file(msg.auditId);
                        if (full_state?.samples) {
                            dispatch({
                                type: StoreActionTypes.REPLACE_STATE_FROM_REMOTE,
                                payload: { ...full_state, saveFileVersion: full_state.saveFileVersion || '2.1.0' }
                            });
                        }
                    } catch (e) {
                        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[Main.js] Synk från annan flik:', e);
                    }
                })();
            };
        }

        dispatch({ type: StoreActionTypes.CLEAR_STAGED_SAMPLE_CHANGES });

        let boot_local_backup = null;
        if (!had_session_storage) {
            boot_local_backup = loadStateFromLocalStorageBackup();
            if (boot_local_backup) {
                consoleManager.log('[Main.js] Cold start: localStorage-backup hittad; jämförs med servern vid start.');
            }
        }

        const boot_merge_common_opts = () => ({
            dispatch,
            getState,
            StoreActionTypes,
            ValidationLogic,
            router: navigate_and_set_hash,
            NotificationComponent: notificationComponent,
            t: typeof window.Translation?.t === 'function' ? window.Translation.t.bind(window.Translation) : ((k) => k),
            navigate_and_set_hash,
            handle_hash_change
        });

        const is_logged_in = () => {
            if (typeof window === 'undefined') return true;
            const has_token = !!get_auth_token();
            if (!has_token) {
                try {
                    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('gv_current_user_name');
                } catch (_) {}
                try {
                    delete window.__GV_CURRENT_USER_NAME__;
                } catch (_) {}
            }
            return has_token;
        };

        if (!is_logged_in()) {
            ensure_app_layout();
            await init_global_components();
            if (side_menu_root) {
                side_menu_root.innerHTML = '';
                side_menu_root.classList.add('hidden');
            }
            try {
                const should_show = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(AUTH_REQUIRED_MESSAGE_KEY) === '1';
                if (should_show) {
                    sessionStorage.removeItem(AUTH_REQUIRED_MESSAGE_KEY);
                    const t = window.Translation?.t ?? ((k) => k);
                    notificationComponent?.show_global_message?.(t('auth_session_expired'), 'warning');
                }
            } catch (_) {}
            await render_view('login', {
                on_login: async () => {
                    if (side_menu_root) side_menu_root.classList.remove('hidden');
                    try {
                        if (boot_local_backup) {
                            await apply_session_boot_merge_from_backup({
                                backup_entry: boot_local_backup,
                                ...boot_merge_common_opts()
                            });
                            boot_local_backup = null;
                        }
                    } catch (merge_err) {
                        consoleManager.error('[Main.js] Boot-merge efter inloggning misslyckades:', merge_err);
                    }
                    start_normal_session().catch((err) =>
                        consoleManager.error('Error starting session:', err)
                    );
                }
            });
            return;
        }

        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gv_current_user_name')) {
            window.__GV_CURRENT_USER_NAME__ = sessionStorage.getItem('gv_current_user_name');
        }
        const has_token = get_auth_token();
        // Synka alltid användardata från servern när vi har token (så att t.ex. ny admin-behörighet visas utan om-inloggning)
        if (has_token) {
            get_current_user_preferences().then((user) => {
                if (user?.name) {
                    window.__GV_CURRENT_USER_NAME__ = user.name;
                    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('gv_current_user_name', user.name);
                }
                set_current_user_admin(!!user?.is_admin);
            }).catch(() => {});
        }

        // När fliken blir synlig igen: hämta användardata så att admin-meny m.m. uppdateras
        document.addEventListener('visibilitychange', function sync_user_when_visible() {
            if (document.visibilityState !== 'visible' || !get_auth_token()) return;
            get_current_user_preferences().then((user) => {
                if (user?.name) {
                    window.__GV_CURRENT_USER_NAME__ = user.name;
                    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('gv_current_user_name', user.name);
                }
                set_current_user_admin(!!user?.is_admin);
                dispatch({ type: 'GV_USER_PREFERENCES_SYNCED' });
            }).catch(() => {});
        });

        try {
            if (boot_local_backup) {
                await apply_session_boot_merge_from_backup({
                    backup_entry: boot_local_backup,
                    ...boot_merge_common_opts()
                });
            }
        } catch (merge_err) {
            consoleManager.error('[Main.js] Boot-merge vid start misslyckades:', merge_err);
        }

        consoleManager.log('[Main.js] Startar session.');
        await start_normal_session();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init_app().catch(err => consoleManager.error("Error during app initialization (from DOMContentLoaded):", err));
        });
    } else {
        init_app().catch(err => consoleManager.error("Error during app initialization (direct call):", err));
    }

})();
