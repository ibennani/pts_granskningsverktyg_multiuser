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
import { RestoreSessionViewComponent } from './components/RestoreSessionViewComponent.js'; 
import { ConfirmUpdatesViewComponent } from './components/ConfirmUpdatesViewComponent.js';
import { FinalConfirmUpdatesViewComponent } from './components/FinalConfirmUpdatesViewComponent.js';
import { EditRulefileMainViewComponent } from './components/EditRulefileMainViewComponent.js';
import { RulefileRequirementsListComponent } from './components/RulefileRequirementsListComponent.js';
import { ViewRulefileRequirementComponent } from './components/ViewRulefileRequirementComponent.js';
import { EditRulefileRequirementComponent } from './components/EditRulefileRequirementComponent.js';
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
import { AuditViewComponent } from './components/AuditViewComponent.js';
import { StartViewComponent } from './components/StartViewComponent.js';
import { LoginViewComponent } from './components/LoginViewComponent.js';
import { ManageUsersViewComponent } from './components/ManageUsersViewComponent.js';
import { SettingsViewComponent } from './components/SettingsViewComponent.js';

import { GlobalActionBarComponent } from './components/GlobalActionBarComponent.js';
import { ModalComponent } from './components/ModalComponent.js';
import { show_confirm_delete_modal } from './logic/confirm_delete_modal_logic.js';
import { flush_sync_to_server } from './logic/server_sync.js';

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

        // Vid återställning av session eller inloggning ska vänstermenyn aldrig renderas.
        if (view_name === 'restore_session' || view_name === 'login') {
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

    function parse_view_and_params_from_hash() {
        const hash = typeof window !== 'undefined' && window.location?.hash ? window.location.hash.substring(1) : '';
        const is_skip_link = hash === 'main-content-heading';
        const [view_name, ...param_pairs] = hash.split('?');
        const params = {};
        if (param_pairs.length > 0 && !is_skip_link && view_name) {
            const query_string = param_pairs.join('?');
            const url_params = new URLSearchParams(query_string);
            for (const [key, value] of url_params) { params[key] = value; }
        }
        return {
            viewName: (is_skip_link || !view_name) ? 'start' : view_name,
            params: (is_skip_link || !view_name) ? {} : params
        };
    }

    function get_page_title_prefix(view_name, params) {
        const t = get_t_fallback();
        const current_state = getState();
        const audit_status = current_state?.auditStatus;
        let title_prefix = t('app_title');
        try {
            if (audit_status === 'rulefile_editing') {
                const section_to_menu_key = {
                    general: 'rulefile_section_general_title',
                    publisher_source: 'rulefile_section_general_title',
                    page_types: 'rulefile_metadata_section_page_types',
                    content_types: 'rulefile_metadata_section_content_types',
                    sample_types: 'rulefile_section_sample_types_title',
                    info_blocks_order: 'rulefile_section_info_blocks_order_title',
                    classifications: 'rulefile_section_classifications_title',
                    report_template: 'rulefile_section_report_template_title'
                };
                const section = params.section || params.editSection || 'general';
                if (view_name === 'rulefile_sections' && section_to_menu_key[section]) {
                    title_prefix = t(section_to_menu_key[section]);
                } else if (['rulefile_requirements', 'rulefile_view_requirement', 'rulefile_edit_requirement', 'rulefile_add_requirement'].includes(view_name)) {
                    title_prefix = t('rulefile_requirements_menu_title');
                } else if (view_name === 'rulefile_metadata_edit') {
                    title_prefix = t(section && section_to_menu_key[section] ? section_to_menu_key[section] : 'rulefile_section_general_title');
                } else if (view_name === 'rulefile_sections_edit_general') {
                    title_prefix = t('rulefile_section_general_title');
                } else if (view_name === 'rulefile_sections_edit_page_types') {
                    title_prefix = t('rulefile_metadata_section_page_types');
                } else if (view_name === 'confirm_delete' && params.type === 'requirement') {
                    title_prefix = t('rulefile_requirements_menu_title');
                } else if (view_name === 'confirm_delete' && (params.type === 'check' || params.type === 'criterion')) {
                    title_prefix = t('rulefile_requirements_menu_title');
                } else if (view_name === 'edit_rulefile_main') {
                    title_prefix = t('rulefile_section_general_title');
                }
            }

            if (title_prefix === t('app_title')) {
            switch (view_name) {
                case 'start': title_prefix = t('menu_link_manage_audits'); break;
                    case 'audit': title_prefix = t('audit_title'); break;
                    case 'audit_audits': title_prefix = t('audit_title_audits'); break;
                    case 'audit_rules': title_prefix = t('audit_title_rules'); break;
                    case 'manage_users': title_prefix = t('manage_users_title'); break;
                    case 'my_settings': title_prefix = t('menu_link_my_settings'); break;
                    case 'login': title_prefix = t('login_title'); break;
                    case 'metadata': title_prefix = t('audit_metadata_title'); break;
                    case 'edit_metadata': title_prefix = t('edit_audit_metadata_title'); break;
                    case 'sample_management': title_prefix = t('manage_samples_title'); break;
                    case 'sample_form': title_prefix = params.editSampleId ? t('edit_sample') : t('add_new_sample'); break;
                    case 'confirm_sample_edit': title_prefix = t('sample_edit_confirm_dialog_title'); break;
                    case 'audit_overview': title_prefix = t('audit_overview_title'); break;
                    case 'audit_actions': title_prefix = t('audit_actions_title'); break;
                    case 'all_requirements': title_prefix = t('left_menu_all_requirements'); break;
                    case 'audit_problems': title_prefix = t('audit_problems_title'); break;
                    case 'audit_images': title_prefix = t('audit_images_title'); break;
                    case 'requirement_list': title_prefix = t('requirement_list_title_suffix'); break;
                    case 'update_rulefile': title_prefix = t('update_rulefile_title'); break;
                    case 'restore_session': title_prefix = t('restore_session_title'); break;
                    case 'confirm_updates': title_prefix = t('handle_updated_assessments_title', {count: ''}).trim(); break;
                    case 'final_confirm_updates': title_prefix = t('final_confirm_updates_title'); break;
                    case 'edit_rulefile_main': title_prefix = t('edit_rulefile_title'); break;
                    case 'rulefile_requirements': title_prefix = t('rulefile_requirements_menu_title'); break;
                    case 'rulefile_view_requirement': title_prefix = t('rulefile_view_requirement_title'); break;
                    case 'rulefile_edit_requirement': title_prefix = t('rulefile_edit_requirement_title'); break;
                    case 'rulefile_add_requirement': title_prefix = t('rulefile_add_requirement_title'); break;
                    case 'rulefile_metadata_edit': title_prefix = t('rulefile_metadata_edit_title'); break;
                    case 'rulefile_sections_edit_general': title_prefix = t('rulefile_sections_edit_general_title'); break;
                    case 'rulefile_sections_edit_page_types': title_prefix = t('rulefile_sections_edit_page_types_title'); break;
                    case 'rulefile_sections': title_prefix = t('rulefile_sections_title'); break;
                    case 'confirm_delete':
                        if (params.type === 'requirement') title_prefix = t('rulefile_confirm_delete_title');
                        else if (params.type === 'check') title_prefix = t('confirm_delete_check_title');
                        else if (params.type === 'criterion') title_prefix = t('confirm_delete_criterion_title');
                        break;
                    case 'requirement_audit': {
                        const sidebar_mode = current_state?.uiSettings?.requirementAuditSidebar?.selectedMode;
                        if (sidebar_mode === 'requirement_samples') {
                            const sample = (current_state?.samples || []).find(s => String(s?.id) === String(params.sampleId || ''));
                            title_prefix = sample?.description || t('undefined_description');
                        } else {
                            const req_id = params.requirementId || '';
                            const requirements_map = current_state?.ruleFileContent?.requirements || {};
                            let requirement = requirements_map?.[req_id];

                            if (!requirement && req_id) {
                                requirement = Object.values(requirements_map).find(req => {
                                    if (!req || typeof req !== 'object') return false;
                                    const key = req.key !== undefined && req.key !== null ? String(req.key) : '';
                                    const id = req.id !== undefined && req.id !== null ? String(req.id) : '';
                                    return key === String(req_id) || id === String(req_id);
                                }) || null;
                            }
                            if (!requirement && req_id) {
                                consoleManager.warn('[Main.js] build_page_title: requirement not found for requirement_audit', {
                                    requirementId: req_id,
                                    requirementKeys: Object.keys(requirements_map || {}).slice(0, 20)
                                });
                            }

                            const requirement_name = requirement?.title || req_id || '';
                            title_prefix = requirement_name
                                ? `${t('page_title_requirement')} ${requirement_name}`
                                : t('page_title_requirement');
                        }
                        break;
                    }
                    default: break;
                }
            }
        } catch (e) {
            consoleManager.error("Error building page title:", e);
        }
        return (title_prefix && String(title_prefix).trim()) || t('app_title');
    }

    function build_page_title(view_name, params) {
        const t = get_t_fallback();
        const title_suffix = ` | ${t('app_title_suffix')}`;
        const current_state = getState();
        const audit_status = current_state?.auditStatus;
        const title_prefix = get_page_title_prefix(view_name || 'start', params || {});

        let final_title = `${title_prefix}${title_suffix}`;
        const is_inside_audit = audit_status !== 'rulefile_editing' &&
            !['start', 'audit', 'audit_audits', 'audit_rules', 'login', 'manage_users', 'my_settings'].includes(view_name);
        const actor_name = (is_inside_audit && current_state?.auditMetadata?.actorName)
            ? String(current_state.auditMetadata.actorName).trim()
            : '';
        if (actor_name) {
            final_title = `${actor_name} | ${final_title}`;
        }
        return (final_title && String(final_title).trim()) || t('app_title_suffix');
    }

    function updatePageTitle(view_name, params) {
        const new_title = build_page_title(view_name || 'start', params || {});
        if (!new_title || !String(new_title).trim()) {
            consoleManager.warn('[Main.js] updatePageTitle: build_page_title returnerade tom sträng. view:', view_name, 'params:', JSON.stringify(params));
            return;
        }
        document.title = new_title;
    }

    // Uppdaterar sidtiteln baserat på den aktuellt renderade vyn och dess parametrar.
    // Används av subscribe-callback och språkbyte – aldrig från routing-kod.
    function updatePageTitleFromCurrentView() {
        let params = {};
        try { params = JSON.parse(current_view_params_rendered_json || '{}'); } catch (_) {}
        updatePageTitle(current_view_name_rendered || 'start', params);
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
        if (saved_theme && saved_theme !== 'system') {
            document.documentElement.setAttribute('data-theme', saved_theme);
        } else {
            const prefers_dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const initial_theme = prefers_dark ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', initial_theme);
        }
    }

    function navigate_and_set_hash(target_view_name, target_params = {}) {
        nav_debug('navigate_and_set_hash anropad', { target_view_name, target_params, current_hash: window.location.hash });
        const target_hash_part = target_params && Object.keys(target_params).length > 0 ?
            `${target_view_name}?${new URLSearchParams(target_params).toString()}` :
            target_view_name;
        const new_hash = `#${target_hash_part}`;
        if (window.location.hash === new_hash) {
            nav_debug('Hash oförändrad – endast render', { new_hash });
            updatePageTitle(target_view_name, target_params);
            if (current_view_component_instance && typeof current_view_component_instance.render === 'function') {
                current_view_component_instance.render();
            }
        } else {
            nav_debug('Sätter hash', { from: window.location.hash, to: new_hash });
            window.location.hash = new_hash;
            updatePageTitle(target_view_name, target_params);
        }
    }

    const FOCUS_STORAGE_KEY = 'gv_focus_by_scope_v1';

    function load_focus_storage() {
        try {
            const raw = window.sessionStorage?.getItem(FOCUS_STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return {};
            return parsed;
        } catch (e) {
            return {};
        }
    }

    function save_focus_storage(storage) {
        try {
            window.sessionStorage?.setItem(FOCUS_STORAGE_KEY, JSON.stringify(storage || {}));
        } catch (e) {
            /* ignore */
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

        // För tabeller (t.ex. GenericTableComponent) där länkar/knappar saknar id/name,
        // försök spara rad-id och kolumnindex så att vi kan hitta tillbaka.
        const row = el.closest && el.closest('tr[data-row-id]');
        if (row && row.parentElement && row.parentElement.tagName === 'TBODY') {
            const row_id = row.getAttribute('data-row-id');
            if (row_id) {
                const cells = Array.from(row.cells || []);
                let col_index = -1;
                const owning_cell = el.closest('td');
                if (owning_cell) {
                    col_index = cells.indexOf(owning_cell);
                }
                if (col_index >= 0) {
                    return {
                        tableRowId: String(row_id),
                        tableColIndex: col_index
                    };
                }
            }
        }

        // För krav-/stickprovslistor där länken identifieras via requirementId + sampleId
        const requirement_id = el.getAttribute?.('data-requirement-id');
        const sample_id = el.getAttribute?.('data-sample-id');
        if (requirement_id && sample_id) {
            return {
                requirementId: requirement_id,
                sampleId: sample_id
            };
        }

        // Generellt fallback-mönster för länkar: använd href + index bland länkar med samma href
        const tag = el.tagName ? el.tagName.toLowerCase() : '';
        if (tag === 'a') {
            const href = el.getAttribute && el.getAttribute('href');
            if (href) {
                const selector = `a[href="${CSS.escape(href)}"]`;
                const all_links = Array.from(main_view_root.querySelectorAll(selector));
                const link_index = all_links.indexOf(el);
                return {
                    linkHref: href,
                    linkIndex: link_index >= 0 ? link_index : null
                };
            }
        }

        // Generellt fallback-mönster för knappar: använd tag + textinnehåll + index
        if (tag === 'button') {
            const label = (el.textContent || '').trim();
            if (label) {
                const all_buttons = Array
                    .from(main_view_root.querySelectorAll('button'))
                    .filter((btn) => (btn.textContent || '').trim() === label);
                const button_index = all_buttons.indexOf(el);
                return {
                    buttonTag: 'button',
                    buttonLabel: label,
                    buttonIndex: button_index >= 0 ? button_index : null
                };
            }
        }

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
        return view_name || 'start';
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

    function get_scope_key_from_view_and_params(view, params) {
        const route_key = view || 'start';
        const safe_params = params && typeof params === 'object' ? params : {};
        return `${route_key}:${JSON.stringify(safe_params)}`;
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
                    NotificationComponent.show_global_message((window.Translation?.t && window.Translation.t('draft_updated_other_tab')) || 'Utkast uppdaterades i annan flik.', 'info');
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

    function apply_restore_focus_instruction({ view_root }) {
        if (!view_root) return false;
        const focus_info = window.__gv_restore_focus_info;
        if (!focus_info) return false;
        window.__gv_restore_focus_info = null;
        window.customFocusApplied = true;

        const try_focus = (attempts_left) => {
            let el = null;

            // 1) Försök först med id/name (formfält m.m.)
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

            // 2) Om vi har tabellinfo (t.ex. rad i granskningstabellen), försök hitta rätt cell
            if (!el && focus_info.tableRowId && typeof focus_info.tableColIndex === 'number') {
                const tbody_rows = view_root.querySelectorAll('tbody tr[data-row-id]');
                let target_row = null;
                for (const r of tbody_rows) {
                    if (r.getAttribute('data-row-id') === String(focus_info.tableRowId)) {
                        target_row = r;
                        break;
                    }
                }
                if (target_row && target_row.cells && target_row.cells.length > focus_info.tableColIndex) {
                    const cell = target_row.cells[focus_info.tableColIndex];
                    if (cell) {
                        el = cell.querySelector('a[href], button, [tabindex="0"]');
                    }
                }
            }

            // 3) Om vi kommer från en krav-/stickprovslista, försök hitta samma länk via requirementId
            //    – i första hand med både requirementId + sampleId (alla krav-listan),
            //    men fall tillbaka till endast requirementId (kravlista per stickprov).
            if (!el && focus_info.requirementId) {
                let selector = `[data-requirement-id="${CSS.escape(focus_info.requirementId)}"]`;
                if (focus_info.sampleId) {
                    selector += `[data-sample-id="${CSS.escape(focus_info.sampleId)}"]`;
                }
                const candidates = view_root.querySelectorAll(selector);
                if (candidates && candidates.length > 0) {
                    el = candidates[0];
                }
            }

            // 4) Generellt fall för länkar: hitta via href + index
            if (!el && focus_info.linkHref) {
                const selector = `a[href="${CSS.escape(focus_info.linkHref)}"]`;
                const candidates = Array.from(view_root.querySelectorAll(selector));
                if (candidates.length > 0) {
                    const idx = typeof focus_info.linkIndex === 'number' ? focus_info.linkIndex : 0;
                    el = candidates[idx] || candidates[0];
                }
            }

            // 5) Generellt fall för knappar: hitta via textinnehåll + index
            if (!el && focus_info.buttonTag === 'button' && focus_info.buttonLabel) {
                const all_buttons = Array
                    .from(view_root.querySelectorAll('button'))
                    .filter((btn) => (btn.textContent || '').trim() === focus_info.buttonLabel);
                if (all_buttons.length > 0) {
                    const idx = typeof focus_info.buttonIndex === 'number' ? focus_info.buttonIndex : 0;
                    el = all_buttons[idx] || all_buttons[0];
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
                memoryManager.setTimeout(() => try_focus(attempts_left - 1), 100);
            }
        };
        // Vänta in att vyer som laddar data asynkront (t.ex. startvyns tabeller) hinner rendera klart.
        // 40 försök * 100 ms ≈ upp till 4 sekunders fönster för att hitta tillbaka till rätt element.
        memoryManager.setTimeout(() => try_focus(40), 200);
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
            NotificationComponent?.clear_global_message?.();
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
            case 'start': ComponentClass = AuditViewComponent; break;
            case 'audit': ComponentClass = AuditViewComponent; break;
            case 'audit_audits': ComponentClass = AuditViewComponent; break;
            case 'audit_rules': ComponentClass = AuditViewComponent; break;
            case 'manage_users': ComponentClass = ManageUsersViewComponent; break;
            case 'my_settings': ComponentClass = SettingsViewComponent; break;
            case 'login': ComponentClass = LoginViewComponent; break;
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
            case 'archived_requirements': ComponentClass = ArchivedRequirementsViewComponent; break;
            case 'rulefile_change_log': ComponentClass = RulefileChangeLogViewComponent; break;
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
            case 'rulefile_metadata_view': ComponentClass = RulefileMetadataViewComponent; break;
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
                    NotificationComponent: NotificationComponent,
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
            if (view_name_to_render !== 'restore_session') {
                update_restore_position(view_name_to_render, params_to_render, null);
                updateBackupRestorePosition(window.__gv_get_restore_position?.());
            }

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

    const SKIP_LINK_ANCHOR_ID = 'main-content-heading';

    async function handle_hash_change() {
        const hash = window.location.hash.substring(1);
        nav_debug('handle_hash_change anropad', { hash, full_url: window.location.href });
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
        let target_view = 'start';
        let target_params = params;
        const current_global_state = getState();

        const load_audit_and_navigate = async (auditId) => {
            const t = window.Translation?.t || (k => k);
            try {
                const { load_audit_with_rule_file } = await import('./api/client.js');
                const full_state = await load_audit_with_rule_file(auditId);
                const validation = ValidationLogic?.validate_saved_audit_file?.(full_state, { t });
                if (full_state && validation?.isValid) {
                    dispatch({ type: StoreActionTypes.LOAD_AUDIT_FROM_FILE, payload: full_state });
                    const status = full_state.auditStatus || 'not_started';
                    const samples = full_state.samples || [];
                    let next_view = 'audit_overview';
                    if (status === 'not_started' && samples.length === 0) {
                        next_view = 'sample_management';
                    } else if (status === 'not_started') {
                        next_view = 'metadata';
                    }
                    navigate_and_set_hash(next_view, {});
                    return true;
                }
                if (validation && !validation.isValid && window.NotificationComponent?.show_global_message) {
                    window.NotificationComponent.show_global_message(validation.message || t('error_invalid_saved_audit_file'), 'error');
                }
            } catch (err) {
                if (window.NotificationComponent?.show_global_message) {
                    window.NotificationComponent.show_global_message(
                        t('server_load_audit_error', { message: err.message }) || err.message,
                        'error'
                    );
                }
            }
            return false;
        };

        if (effective_view_name === 'upload') {
            if (params.auditId && (await load_audit_and_navigate(params.auditId))) return;
            navigate_and_set_hash('start', {});
            return;
        }

        if (effective_view_name === 'audit_overview' && params.auditId) {
            if (await load_audit_and_navigate(params.auditId)) return;
            navigate_and_set_hash('start', {});
            return;
        }

        if (effective_view_name) {
            target_view = effective_view_name;
        } else {
            target_view = 'start';
            target_params = {};
        }
        nav_debug('handle_hash_change -> render_view', { target_view, target_params, effective_view_name });
        if (is_skip_link_anchor || !effective_view_name) {
            const target_hash_part = target_params && Object.keys(target_params).length > 0 ?
                `${target_view}?${new URLSearchParams(target_params).toString()}` :
                target_view;
            history.replaceState(null, '', `#${target_hash_part}`);
        }
        try {
            const scope_key = get_scope_key_from_view_and_params(target_view, target_params);
            if (scope_key && window.sessionStorage) {
                const focus_storage = load_focus_storage();
                const focus_info = focus_storage[scope_key];
                if (focus_info) {
                    window.__gv_restore_focus_info = focus_info;
                }
            }
        } catch (e) {
            /* ignore */
        }
        updatePageTitle(target_view, target_params);
        render_view(target_view, target_params);
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
    
    async function apply_user_preferences_from_server() {
        if (!window.__GV_CURRENT_USER_NAME__) return;
        try {
            const { get_current_user_preferences } = await import('./api/client.js');
            const user = await get_current_user_preferences();
            if (user?.language_preference && typeof window.Translation?.set_language === 'function') {
                await window.Translation.set_language(user.language_preference);
            }
            if (user?.theme_preference === 'light' || user?.theme_preference === 'dark') {
                localStorage.setItem('theme_preference', user.theme_preference);
                document.documentElement.setAttribute('data-theme', user.theme_preference);
            } else if (user?.theme_preference === 'system' || user?.theme_preference === null || user?.theme_preference === '') {
                localStorage.removeItem('theme_preference');
                const prefers_dark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
                document.documentElement.setAttribute('data-theme', prefers_dark ? 'dark' : 'light');
            }
            const pref = user?.review_sort_preference || 'by_criteria';
            if (pref === 'by_criteria' || pref === 'by_sample') {
                const mode = pref === 'by_criteria' ? 'requirement_samples' : 'sample_requirements';
                dispatch({
                    type: StoreActionTypes.SET_REQUIREMENT_AUDIT_SIDEBAR_SETTINGS,
                    payload: { selectedMode: mode }
                });
            }
        } catch {
            /* ignorerar – användaren kanske inte finns i DB */
        }
    }

    async function start_normal_session(options = {}) {
        const { restore_pending } = options;
        ensure_app_layout();
        setup_tooltip_overlay();
        // Initialize layout manager to handle dynamic vertical positioning
        if (LayoutManager && typeof LayoutManager.init === 'function') {
            LayoutManager.init();
        }
        await apply_user_preferences_from_server();
        await init_global_components(); 
        if (window.ScoreManager?.init) { window.ScoreManager.init(subscribe, getState, dispatch, StoreActionTypes); }
        if (MarkdownToolbar?.init) { MarkdownToolbar.init(); }
        init_version_check_service();
        const rulefile_view_poll_instance = init_rulefile_view_poll_service({ getState, dispatch, StoreActionTypes });
        // Lagra referenser till event listeners för senare cleanup
        const language_changed_handler = on_language_changed_event;
        const hash_change_handler = handle_hash_change;
        const hash_change_wrapper = (...args) => {
            nav_debug('hashchange-event triggat', { hash: window.location.hash });
            hash_change_handler(...args);
        };
        memoryManager.addEventListener(window, 'hashchange', hash_change_wrapper);
        memoryManager.addEventListener(document, 'languageChanged', language_changed_handler);

        let focus_capture_timer = null;
        const focus_in_handler = (e) => {
            if (focus_capture_timer) clearTimeout(focus_capture_timer);
            focus_capture_timer = setTimeout(() => {
                focus_capture_timer = null;
                const info = capture_focus_info_from_element(document.activeElement);
                if (info) {
                    let parsed_params = {};
                    try {
                        parsed_params = JSON.parse(current_view_params_rendered_json || '{}');
                    } catch (e) {
                        parsed_params = {};
                    }
                    update_restore_position(current_view_name_rendered, parsed_params, info);
                    updateBackupRestorePosition(window.__gv_get_restore_position?.());
                    try {
                        const scope_key = get_scope_key_from_view_and_params(current_view_name_rendered, parsed_params);
                        if (scope_key && window.sessionStorage) {
                            const focus_storage = load_focus_storage();
                            focus_storage[scope_key] = info;
                            save_focus_storage(focus_storage);
                        }
                    } catch (e) {
                        /* ignore */
                    }
                }
            }, 150);
        };
        const focus_root = main_view_root || app_container;
        if (focus_root) {
            focus_root.addEventListener('focusin', focus_in_handler);
        }

        // Exponera cleanup-funktion globalt
        window.cleanupGlobalEventListeners = () => {
            if (rulefile_view_poll_instance?.disconnect) rulefile_view_poll_instance.disconnect();
            memoryManager.removeEventListener(document, 'languageChanged', language_changed_handler);
            memoryManager.removeEventListener(window, 'hashchange', hash_change_wrapper);
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

        function is_focus_in_editable_field(view_root) {
            if (!view_root) return false;
            const active = document.activeElement;
            if (!active || !view_root.contains(active)) return false;
            const tag = active.tagName ? active.tagName.toLowerCase() : '';
            return tag === 'input' || tag === 'textarea' || tag === 'select';
        }

        subscribe((new_state, listener_meta) => {
            if (listener_meta?.skip_render) {
                if (window.__GV_DEBUG_MODAL_SCROLL) {
                    consoleManager.log('[GV-ModalDebug] subscribe: skip_render – ingen render');
                }
                return;
            }
            if (window.__GV_DEBUG_MODAL_SCROLL) {
                consoleManager.log('[GV-ModalDebug] subscribe: RENDERAR top_action_bar, bottom_action_bar, current_view');
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
            updatePageTitleFromCurrentView();
            try {
                const parsed_params = JSON.parse(current_view_params_rendered_json || '{}');
                update_side_menu(current_view_name_rendered, parsed_params);
            } catch (error) {
                consoleManager.warn('[Main.js] Failed to parse current view params for side menu update:', error);
                update_side_menu(current_view_name_rendered, {});
            }
            const hash = window.location.hash.substring(1);
            const [view_name_from_hash,] = hash.split('?');
            if (current_view_name_rendered === view_name_from_hash && 
                current_view_component_instance && typeof current_view_component_instance.render === 'function') {
                if (current_view_name_rendered !== 'confirm_sample_edit') {
                    if ((current_view_name_rendered === 'audit' || current_view_name_rendered === 'audit_audits' || current_view_name_rendered === 'audit_rules') && current_view_component_instance._api_load_started && !current_view_component_instance._api_checked) {
                        return;
                    }
                    if (current_view_name_rendered === 'rulefile_edit_requirement' || current_view_name_rendered === 'rulefile_add_requirement') {
                        const skip_count = Number(window.skipRulefileRequirementRender) || 0;
                        if (skip_count > 0) {
                            window.skipRulefileRequirementRender = skip_count - 1;
                            return;
                        }
                    }
                    const view_root = main_view_root || app_container;
                    if (is_focus_in_editable_field(view_root)) {
                        return;
                    }
                    const scroll_before = {
                        windowY: window.scrollY,
                        appContainer: document.getElementById('app-container')?.scrollTop ?? 0,
                        mainViewRoot: document.getElementById('app-main-view-root')?.scrollTop ?? 0
                    };
                    const focus_state = capture_focus_state(view_root);
                    const window_scroll = focus_state ? { x: window.scrollX, y: window.scrollY } : null;
                    try {
                        const render_promise = current_view_component_instance.render();
                        if (DraftManager?.restoreIntoDom) {
                            DraftManager.restoreIntoDom(main_view_root || app_container);
                        }
                        const restore_scroll = () => {
                            requestAnimationFrame(() => {
                                if (focus_state && view_root) {
                                    restore_focus_state({
                                        focus_root: view_root,
                                        focus_state,
                                        window_scroll
                                    });
                                }
                                window.scrollTo(0, scroll_before.windowY);
                                document.documentElement.scrollTop = scroll_before.windowY;
                                document.body.scrollTop = scroll_before.windowY;
                                const ac = document.getElementById('app-container');
                                const mvr = document.getElementById('app-main-view-root');
                                if (ac) ac.scrollTop = scroll_before.appContainer;
                                if (mvr) mvr.scrollTop = scroll_before.mainViewRoot;
                            });
                        };
                        if (render_promise && typeof render_promise.then === 'function') {
                            render_promise.then(restore_scroll).catch(() => restore_scroll());
                        } else {
                            restore_scroll();
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
                window.location.hash = '#start';
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

        // Om byggtiden redan är inskriven (t.ex. av postbuild-scriptet) ska vi inte skriva över den.
        if (typeof buildTimestampElement.textContent === 'string' && buildTimestampElement.textContent.trim() !== '') {
            return;
        }

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

        let restore_pending = null;
        if (!had_session_storage) {
            restore_pending = loadStateFromLocalStorageBackup();
            if (restore_pending) {
                consoleManager.log("[Main.js] Session was cleared (e.g. tab closed) but backup found in localStorage. Showing restore prompt.");
            }
        }

        const is_logged_in = () => {
            if (typeof window === 'undefined') return true;
            return !!(window.__GV_CURRENT_USER_NAME__ ||
                (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gv_current_user_name')));
        };

        if (!is_logged_in()) {
            ensure_app_layout();
            await init_global_components();
            if (side_menu_root) {
                side_menu_root.innerHTML = '';
                side_menu_root.classList.add('hidden');
            }
            await render_view('login', {
                on_login: () => {
                    if (side_menu_root) side_menu_root.classList.remove('hidden');
                    start_normal_session({ restore_pending }).catch((err) =>
                        consoleManager.error('Error starting session:', err)
                    );
                }
            });
            return;
        }

        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gv_current_user_name')) {
            window.__GV_CURRENT_USER_NAME__ = sessionStorage.getItem('gv_current_user_name');
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
