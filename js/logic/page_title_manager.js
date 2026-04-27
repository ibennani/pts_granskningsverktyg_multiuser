/**
 * Sidtitel (document.title) utifrån vy och tillstånd.
 * @module js/logic/page_title_manager
 */

import { consoleManager } from '../utils/console_manager.js';

/**
 * Hittar kravobjekt i regelfilens innehåll utifrån route-param (id/nyckel).
 * @param {object} current_state
 * @param {string} req_id
 * @returns {object|null}
 */
function find_requirement_in_rulefile_content(current_state, req_id) {
    if (!req_id) return null;
    const requirements_map = current_state?.ruleFileContent?.requirements || {};
    let requirement = requirements_map[req_id];
    if (!requirement) {
        requirement = Object.values(requirements_map).find((req) => {
            if (!req || typeof req !== 'object') return false;
            const key = req.key !== undefined && req.key !== null ? String(req.key) : '';
            const id = req.id !== undefined && req.id !== null ? String(req.id) : '';
            return key === String(req_id) || id === String(req_id);
        }) || null;
    }
    return requirement;
}

/**
 * Bygger prefix för document.title på vyn "redigera krav" i regelfilen.
 * @param {object} params
 * @param {object} current_state
 * @param {function(string): string} t Översättningsfunktion
 * @returns {string}
 */
function get_rulefile_edit_requirement_title_prefix(params, current_state, t) {
    const edit_label = t('rulefile_edit_requirement_title');
    const req_id = params?.id != null ? String(params.id) : '';
    const requirement = find_requirement_in_rulefile_content(current_state, req_id);
    const name_part = (requirement && String(requirement.title || '').trim()) || (req_id || '');
    return name_part ? `${edit_label} | ${name_part}` : edit_label;
}

function get_t_fallback(Translation) {
    return (Translation && typeof Translation.t === 'function')
        ? Translation.t.bind(Translation)
        : (key, _replacements) => `**${key}**`;
}

export function get_page_title_prefix(view_name, params, { getState, Translation }) {
    const t = get_t_fallback(Translation);
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
            } else if (view_name === 'rulefile_edit_requirement') {
                title_prefix = get_rulefile_edit_requirement_title_prefix(params, current_state, t);
            } else if (['rulefile_requirements', 'rulefile_view_requirement', 'rulefile_add_requirement'].includes(view_name)) {
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
                case 'statistics': title_prefix = t('menu_link_statistics'); break;
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
                case 'confirm_updates': title_prefix = t('handle_updated_assessments_title', { count: '' }).trim(); break;
                case 'final_confirm_updates': title_prefix = t('final_confirm_updates_title'); break;
                case 'edit_rulefile_main': title_prefix = t('edit_rulefile_title'); break;
                case 'rulefile_requirements': title_prefix = t('rulefile_requirements_menu_title'); break;
                case 'rulefile_view_requirement': title_prefix = t('rulefile_view_requirement_title'); break;
                case 'rulefile_edit_requirement':
                    title_prefix = get_rulefile_edit_requirement_title_prefix(params, current_state, t);
                    break;
                case 'rulefile_add_requirement': title_prefix = t('rulefile_add_requirement_title'); break;
                case 'rulefile_metadata_edit': title_prefix = t('rulefile_metadata_edit_title'); break;
                case 'rulefile_sections_edit_general': title_prefix = t('rulefile_sections_edit_general_title'); break;
                case 'rulefile_sections_edit_page_types': title_prefix = t('rulefile_sections_edit_page_types_title'); break;
                case 'rulefile_sections': title_prefix = t('rulefile_sections_title'); break;
                case 'backup':
                case 'backup_detail':
                case 'backup_rulefile_detail':
                case 'backup_settings': title_prefix = t('menu_link_backups'); break;
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
                            consoleManager.warn('[page_title_manager] build_page_title: requirement not found for requirement_audit', {
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
        consoleManager.error('Error building page title:', e);
    }
    return (title_prefix && String(title_prefix).trim()) || t('app_title');
}

export function build_page_title(view_name, params, { getState, Translation }) {
    const t = get_t_fallback(Translation);
    const title_suffix = ` | ${t('app_title_suffix')}`;
    const current_state = getState();
    const audit_status = current_state?.auditStatus;
    const title_prefix = get_page_title_prefix(view_name || 'start', params || {}, { getState, Translation });

    let final_title = `${title_prefix}${title_suffix}`;
    const is_inside_audit = audit_status !== 'rulefile_editing' &&
        !['start', 'audit', 'audit_audits', 'audit_rules', 'login', 'manage_users', 'my_settings', 'statistics'].includes(view_name);
    const actor_name = (is_inside_audit && current_state?.auditMetadata?.actorName)
        ? String(current_state.auditMetadata.actorName).trim()
        : '';
    if (actor_name) {
        final_title = `${actor_name} | ${final_title}`;
    }
    return (final_title && String(final_title).trim()) || t('app_title_suffix');
}

export function updatePageTitle(view_name, params, { getState, Translation }) {
    const new_title = build_page_title(view_name || 'start', params || {}, { getState, Translation });
    if (!new_title || !String(new_title).trim()) {
        consoleManager.warn('[page_title_manager] updatePageTitle: build_page_title returnerade tom sträng. view:', view_name, 'params:', JSON.stringify(params));
        return;
    }
    document.title = new_title;
}

export function updatePageTitleFromCurrentView({ getState, Translation, get_current_view_name, get_current_view_params_json }) {
    let params = {};
    try { params = JSON.parse(get_current_view_params_json() || '{}'); } catch {
        /* ignorera ogiltig JSON */
    }
    updatePageTitle(get_current_view_name() || 'start', params, { getState, Translation });
}
