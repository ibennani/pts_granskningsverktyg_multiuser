// @ts-nocheck
/**
 * @fileoverview Renderar statussektionen på Hantera granskning (Åtgärder).
 */
import { find_requirement_definition } from '../audit_logic.js';
import { build_audit_status_select } from './audit_actions_view_status_select.js';

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function build_audit_actions_status_section(view, state, t) {
    const status_section = view.Helpers.create_element('section', {
        class_name: 'audit-actions__status-section',
    });

    status_section.appendChild(
        build_audit_status_select(view, t, {
            on_change: (event, target_status) => view.handle_status_select_change(event, target_status),
        })
    );

    const status_actions = view.Helpers.create_element('div', { class_name: 'audit-actions__status-list' });

    const update_rulefile_slot = view.Helpers.create_element('div', {
        class_name: 'audit-actions__update-rulefile-slot',
        attributes: { 'data-audit-action': 'update-rulefile-slot' },
    });
    view._populate_update_rulefile_slot(update_rulefile_slot, state);
    status_actions.appendChild(update_rulefile_slot);

    const { req_count: unreviewed_count } = view.count_unreviewed_requirements();
    if (state.auditStatus === 'in_progress' && unreviewed_count > 0) {
        status_actions.appendChild(view.create_status_action_item({
            label: t('mark_all_unreviewed_passed_button'),
            description: t('mark_all_unreviewed_passed_description'),
            on_click: view.handle_mark_all_unreviewed_as_passed,
            variant: 'button-default',
            icon_name: 'check',
            id_suffix: 'mark-all-unreviewed',
        }));
    }

    if (state.lastRulefileUpdateLog && state.lastRulefileUpdateLog.report) {
        status_actions.appendChild(view.create_status_action_item({
            label: t('audit_actions_view_rulefile_change_log_label'),
            description: t('audit_actions_view_rulefile_change_log_description'),
            on_click: () => view.router('rulefile_change_log'),
            variant: 'button-default',
            icon_name: 'info',
            id_suffix: 'view-rulefile-change-log',
        }));
    }

    const requirements = state?.ruleFileContent?.requirements;
    let updated_reqs_count = 0;
    (state.samples || []).forEach((sample) => {
        Object.keys(sample.requirementResults || {}).forEach((reqId) => {
            const req_def = requirements ? find_requirement_definition(requirements, reqId) : null;
            if (!req_def) return;
            const resolved = view.AuditLogic.get_stored_requirement_result_for_def(
                sample.requirementResults,
                requirements,
                req_def,
                reqId
            );
            if (resolved?.needsReview !== true) return;
            const display_status = view.AuditLogic.get_effective_requirement_audit_status
                ? view.AuditLogic.get_effective_requirement_audit_status(
                    requirements,
                    sample.requirementResults,
                    req_def,
                    reqId
                )
                : 'not_audited';
            if (display_status === 'passed' || display_status === 'failed') updated_reqs_count++;
        });
    });

    if (updated_reqs_count > 0 && state.auditStatus !== 'archived') {
        status_actions.appendChild(view.create_status_action_item({
            label: t('handle_updated_assessments', { count: updated_reqs_count }),
            description: t('audit_actions_handle_updated_description'),
            on_click: () => view.router('confirm_updates'),
            variant: 'button-info',
            icon_name: 'info',
            id_suffix: 'handle-updated',
        }));
    }

    status_section.appendChild(status_actions);
    return status_section;
}

/**
 * @param {import('./AuditActionsViewComponent.js').AuditActionsViewComponent} view
 */
export function refresh_audit_actions_rulefile_subscription(view, state) {
    if (state.auditStatus === 'in_progress') {
        if (view.newerRuleAvailable === null && !view._newerRuleCheckInProgress) {
            view._refresh_newer_rule_check();
        }
        view._ensure_rules_push_subscription();
    } else {
        view._close_rules_push_subscription();
        view.newerRuleAvailable = null;
    }
}
