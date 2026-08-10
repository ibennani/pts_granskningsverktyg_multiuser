/**
 * @fileoverview Status-dropdown för Hantera granskning på Åtgärder-sidan.
 */

export type AuditStatusTarget = 'not_started' | 'in_progress' | 'locked' | 'archived';

const STATUS_I18N_KEYS: Record<AuditStatusTarget, string> = {
    not_started: 'audit_status_not_started',
    in_progress: 'audit_status_in_progress',
    locked: 'audit_status_locked',
    archived: 'audit_status_archived',
};

const STATUS_USE_I18N_KEYS: Record<AuditStatusTarget, string> = {
    not_started: 'audit_actions_status_use_not_started',
    in_progress: 'audit_actions_status_use_in_progress',
    locked: 'audit_actions_status_use_locked',
    archived: 'audit_actions_status_use_archived',
};

/** Alla granskningsstatusar i logisk ordning (dropdown och förklaringar). */
export const ALL_AUDIT_STATUS_TARGETS: AuditStatusTarget[] = [
    'not_started',
    'in_progress',
    'locked',
    'archived',
];

/** Giltiga målstatusar i dropdownen utifrån nuvarande granskningsstatus. */
export function get_allowed_audit_status_targets(current_status: string): AuditStatusTarget[] {
    switch (current_status) {
        case 'in_progress':
            return ['in_progress', 'locked'];
        case 'locked':
            return ['locked', 'in_progress', 'archived'];
        case 'archived':
            return ['archived', 'locked'];
        case 'not_started':
            return ['not_started'];
        default:
            return [current_status as AuditStatusTarget];
    }
}

/** Success-toast-nyckel efter statusändring. */
export function get_audit_status_change_success_message_key(
    _from_status: string,
    to_status: string
): string {
    switch (to_status) {
        case 'locked':
            return 'audit_locked_successfully';
        case 'in_progress':
            return 'audit_unlocked_successfully';
        case 'archived':
            return 'audit_archived_successfully';
        default:
            return 'audit_reactivated_successfully';
    }
}

/** Bekräftelsemodal krävs för avslutad och arkiverad status. */
export function audit_status_change_needs_confirmation(to_status: string): boolean {
    return to_status === 'locked' || to_status === 'archived';
}

type StatusSelectView = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    getState: () => { auditStatus?: string } | null | undefined;
};

type StatusSelectHandlers = {
    on_change: (event: Event, target_status: string) => void;
};

function build_audit_status_hints_list(
    view: StatusSelectView,
    t: (key: string) => string,
    hints_id: string
): HTMLElement {
    const list = view.Helpers.create_element('ul', {
        class_name: 'audit-actions__status-hints',
        attributes: { id: hints_id },
    });

    for (const status of ALL_AUDIT_STATUS_TARGETS) {
        const item = view.Helpers.create_element('li', {
            class_name: 'audit-actions__status-hint',
        });
        item.appendChild(
            view.Helpers.create_element('strong', {
                text_content: `${t(STATUS_I18N_KEYS[status])}: `,
            })
        );
        item.appendChild(document.createTextNode(t(STATUS_USE_I18N_KEYS[status])));
        list.appendChild(item);
    }

    return list;
}

/**
 * Bygger rubrik, hjälptext, select och förklaringar per statusalternativ.
 */
export function build_audit_status_select(
    view: StatusSelectView,
    t: (key: string) => string,
    handlers: StatusSelectHandlers
): HTMLElement {
    const current_status = String(view.getState()?.auditStatus ?? '');

    const wrapper = view.Helpers.create_element('div', {
        class_name: 'audit-actions__status-select-block',
    });

    const help_id = 'audit-action-status-select-help';
    const hints_id = 'audit-action-status-select-hints';
    const label_id = 'audit-action-status-select-label';
    const label = view.Helpers.create_element('h2', {
        class_name: ['audit-actions__section-title', 'audit-actions__status-select-label'],
        attributes: { id: label_id },
        text_content: t('audit_actions_status_select_label'),
    });
    wrapper.appendChild(label);

    wrapper.appendChild(
        view.Helpers.create_element('p', {
            class_name: 'audit-actions__status-description',
            text_content: t('audit_actions_status_select_help'),
            attributes: { id: help_id },
        })
    );

    wrapper.appendChild(build_audit_status_hints_list(view, t, hints_id));

    const select = view.Helpers.create_element('select', {
        class_name: 'form-control audit-actions__status-select',
        attributes: {
            id: 'audit-action-status-select',
            'aria-labelledby': label_id,
            'aria-describedby': `${help_id} ${hints_id}`,
        },
    }) as HTMLSelectElement;

    for (const status of ALL_AUDIT_STATUS_TARGETS) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = t(STATUS_I18N_KEYS[status] ?? status);
        if (status === current_status) {
            option.selected = true;
        }
        select.appendChild(option);
    }

    select.addEventListener('change', (event) => {
        handlers.on_change(event, select.value);
    });

    wrapper.appendChild(select);

    return wrapper;
}

/** Sätter select till aktuell status utan att trigga on_change. */
export function reset_audit_status_select(root: ParentNode | null, audit_status: string): void {
    const select = root?.querySelector('#audit-action-status-select') as HTMLSelectElement | null;
    if (!select) return;
    select.value = audit_status;
}
