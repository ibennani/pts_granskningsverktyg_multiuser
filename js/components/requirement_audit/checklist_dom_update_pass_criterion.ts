/**
 * @fileoverview DOM-uppdatering per godkännandekriterium i ChecklistHandler.
 */

import { get_current_user_name } from '../../utils/helpers.js';
import {
    button_aria_label_with_context,
    get_plain_text_from_html,
    safe_parse_markdown_inline,
    set_pass_criterion_title_aria_label,
    sync_pass_criterion_deficiency_id_on_title
} from './checklist_dom_build.js';
import {
    effective_pc_status,
    read_check_stored_data,
    read_pc_stored_data
} from './checklist_observation_visibility.js';
import {
    observation_was_hidden_with_user_text,
    resolve_observation_target_for_textarea,
    restore_observation_textarea_after_show,
    sync_observation_textarea_from_target,
    sync_observation_wrapper_visibility,
    should_apply_observation_textarea_sync
} from './checklist_observation_text.js';
import { apply_status_button_active_state } from './checklist_status_button_ui.js';
import {
    as_build_host,
    as_observation_host,
    resolve_dom_update_env,
    type ChecklistDomUpdateHost
} from './checklist_dom_update_types.js';

function sync_pc_observation_textarea(
    host: ChecklistDomUpdateHost,
    params: {
        check_id: string;
        pc_id: string;
        pc_data: ReturnType<typeof read_pc_stored_data>;
        overall_manual_status: string;
        observation_textarea: HTMLTextAreaElement | null;
        current_pc_status: string;
        env: ReturnType<typeof resolve_dom_update_env>;
        force_sync?: boolean;
    }
): void {
    const {
        check_id, pc_id, pc_data, overall_manual_status, observation_textarea,
        current_pc_status, env, force_sync = false
    } = params;
    const restored_after_show = observation_textarea
        ? restore_observation_textarea_after_show(as_observation_host(host), check_id, pc_id, observation_textarea)
        : false;
    if (!observation_textarea || restored_after_show
        || observation_was_hidden_with_user_text(as_observation_host(host), check_id, pc_id)) {
        return;
    }
    const target_value = resolve_observation_target_for_textarea(
        as_observation_host(host), check_id, pc_id, pc_data, overall_manual_status, observation_textarea
    );
    const is_this_focused = document.activeElement === observation_textarea;
    const pc_observation_editing_elsewhere = env.has_pc_observation_textarea_focus && !is_this_focused;
    const typing_other = !is_this_focused && env.any_textarea_or_input_focused_in_sync_root
        && !env.has_pc_observation_textarea_focus;
    const should_sync_obs = force_sync
        || (!is_this_focused && !pc_observation_editing_elsewhere && !typing_other);
    if (should_apply_observation_textarea_sync(
        as_observation_host(host), observation_textarea, target_value, should_sync_obs,
        overall_manual_status, pc_data.status, check_id, pc_id
    )) {
        sync_observation_textarea_from_target(as_observation_host(host), observation_textarea, target_value, check_id, pc_id);
    } else if (host.Helpers?.init_auto_resize_for_textarea) {
        host.Helpers.init_auto_resize_for_textarea(observation_textarea);
    }
    if (current_pc_status !== 'failed') {
        return;
    }
}

function update_observation_lock_ui(
    host: ChecklistDomUpdateHost,
    textarea: HTMLTextAreaElement,
    check_id: string,
    pc_id: string,
    audit_archived: boolean,
    t: (key: string, params?: Record<string, unknown>) => string
): void {
    let locked_by_other = false;
    let remote_lock: { user_name?: string } | null = null;
    if (host.lock_helpers && host.get_audit_id && host.get_sample_id && host.get_requirement_map_key) {
        const audit_id = host.get_audit_id();
        const sample_id = host.get_sample_id();
        const req_id = host.get_requirement_map_key();
        if (audit_id && sample_id && req_id) {
            const part_key = host.lock_helpers.makeObservationDetailPartKey(
                audit_id, sample_id, req_id, check_id, pc_id
            );
            remote_lock = host.lock_helpers.getRemoteLock(part_key);
            const my_client_lock_id = host.lock_helpers.ensureClientLockId(part_key);
            locked_by_other = host.lock_helpers.isRemoteLockHeldByOtherUser(
                remote_lock, get_current_user_name(), my_client_lock_id
            );
        }
    }
    const want_readonly = locked_by_other || audit_archived;
    if (textarea.readOnly !== want_readonly) {
        const had_focus = document.activeElement === textarea;
        textarea.readOnly = want_readonly;
        if (had_focus && !want_readonly) {
            setTimeout(() => {
                const active = document.activeElement;
                if (active !== textarea && (active === document.body || active === null)) {
                    textarea.focus({ preventScroll: true });
                }
            }, 0);
        }
    }
    textarea.classList.toggle('readonly-textarea', want_readonly);
    const wrapper = textarea.closest('.form-group');
    if (!wrapper) return;
    let hint_el = wrapper.querySelector('.lock-hint') as HTMLElement | null;
    if (!hint_el) return;
    if (locked_by_other) {
        const display_name = remote_lock?.user_name || t('another_user');
        hint_el.textContent = t('user_is_editing_field', { name: display_name });
        hint_el.style.marginBottom = '4px';
        textarea.setAttribute('aria-describedby', hint_el.id);
        textarea.style.border = '4px solid #d32f2f';
    } else {
        hint_el.textContent = '';
        hint_el.style.marginBottom = '0';
        textarea.removeAttribute('aria-describedby');
        textarea.style.border = '';
    }
}

function get_criterion_numbering(
    host: ChecklistDomUpdateHost,
    check_id: string,
    pc_id: string
): { numbering: string; criterion_title: string; pc_def: { requirement?: string } | undefined } {
    const t = host.Translation.t;
    const check_def = host.requirement_definition_ref?.checks?.find(
        (c) => (c?.id || c?.key) === check_id
    );
    const pc_def = check_def?.passCriteria?.find((p) => (p?.id || p?.key) === pc_id);
    const check_idx = check_def ? (host.requirement_definition_ref?.checks?.indexOf(check_def) ?? 0) : 0;
    const pc_idx = pc_def ? (check_def?.passCriteria?.indexOf(pc_def) ?? 0) : 0;
    const numbering = `${check_idx + 1}.${pc_idx + 1}`;
    return {
        numbering,
        criterion_title: `${t('pass_criterion_label')} ${numbering}`,
        pc_def
    };
}

function update_pass_criterion_status_row(
    host: ChecklistDomUpdateHost,
    pc_item_li: HTMLElement,
    current_pc_status: string
): string {
    const t = host.Translation.t;
    const pc_status_text_container = pc_item_li.querySelector('.pass-criterion-status') as HTMLElement | null;
    const pc_status_text = t(`audit_status_${current_pc_status}`);
    if (pc_status_text_container) {
        pc_status_text_container.innerHTML = '';
        pc_status_text_container.setAttribute('aria-hidden', 'true');
        pc_status_text_container.appendChild(host.Helpers.create_element('strong', { text_content: t('status') }));
        pc_status_text_container.appendChild(document.createTextNode(': '));
        pc_status_text_container.appendChild(host.Helpers.create_element('span', {
            class_name: `status-text status-${current_pc_status}`,
            text_content: pc_status_text
        }));
    }
    return pc_status_text;
}

function update_pass_criterion_title_block(
    host: ChecklistDomUpdateHost,
    pc_item_li: HTMLElement,
    check_id: string,
    pc_id: string,
    pc_status_text: string,
    audit_frozen: boolean,
    current_pc_status: string,
    pc_data: ReturnType<typeof read_pc_stored_data>
): void {
    const pc_title_h4 = pc_item_li.querySelector('.pass-criterion-title') as HTMLElement | null;
    if (!pc_title_h4) return;
    const { criterion_title } = get_criterion_numbering(host, check_id, pc_id);
    sync_pass_criterion_deficiency_id_on_title(
        as_build_host(host), pc_title_h4, audit_frozen, current_pc_status, pc_data.deficiencyId as string | undefined
    );
    set_pass_criterion_title_aria_label(
        as_build_host(host), pc_title_h4, criterion_title, pc_status_text, audit_frozen, current_pc_status,
        pc_data.deficiencyId as string | undefined
    );
}

function update_pass_criterion_action_buttons(
    host: ChecklistDomUpdateHost,
    pc_item_li: HTMLElement,
    check_id: string,
    pc_id: string,
    current_pc_status: string,
    audit_frozen: boolean,
    heal_opts: { skip_if_unchanged?: boolean }
): void {
    const t = host.Translation.t;
    const passed_btn = pc_item_li.querySelector('button[data-action="set-pc-passed"]') as HTMLElement | null;
    const failed_btn = pc_item_li.querySelector('button[data-action="set-pc-failed"]') as HTMLElement | null;
    if (!passed_btn || !failed_btn) return;
    apply_status_button_active_state(host, passed_btn, current_pc_status === 'passed', {
        check_id, pc_id, action: 'set-pc-passed'
    }, heal_opts);
    apply_status_button_active_state(host, failed_btn, current_pc_status === 'failed', {
        check_id, pc_id, action: 'set-pc-failed'
    }, heal_opts);
    const { pc_def } = get_criterion_numbering(host, check_id, pc_id);
    const requirement_plain = get_plain_text_from_html(
        safe_parse_markdown_inline(as_build_host(host), pc_def?.requirement || '')
    );
    passed_btn.setAttribute(
        'aria-label',
        button_aria_label_with_context(t('pass_criterion_approved'), requirement_plain)
    );
    failed_btn.setAttribute(
        'aria-label',
        button_aria_label_with_context(t('pass_criterion_failed'), requirement_plain)
    );
    const parent = passed_btn.parentElement as HTMLElement | null;
    if (parent) parent.style.display = audit_frozen ? 'none' : 'flex';
}

function update_attach_media_button(
    host: ChecklistDomUpdateHost,
    pc_item_li: HTMLElement,
    check_id: string,
    pc_id: string,
    pc_data: ReturnType<typeof read_pc_stored_data>
): void {
    const t = host.Translation.t;
    const attach_media_btn = pc_item_li.querySelector('button[data-action="attach-media"]') as HTMLElement | null;
    if (!attach_media_btn) return;
    const attached_filenames = Array.isArray(pc_data.attachedMediaFilenames)
        ? pc_data.attachedMediaFilenames.filter((f) => f && String(f).trim())
        : [];
    const attached_count = attached_filenames.length;
    const attach_btn_label = attached_count > 0
        ? t('edit_attached_media_button', { count: attached_count })
        : t('attach_media_button');
    const { criterion_title, pc_def } = get_criterion_numbering(host, check_id, pc_id);
    const requirement_plain = get_plain_text_from_html(
        safe_parse_markdown_inline(as_build_host(host), pc_def?.requirement || '')
    );
    attach_media_btn.setAttribute(
        'aria-label',
        `${attach_btn_label} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`
    );
    const text_span = attach_media_btn.querySelector('span:first-child') as HTMLElement | null;
    if (text_span) text_span.textContent = attach_btn_label;
}

function update_copy_observation_row(
    host: ChecklistDomUpdateHost,
    pc_item_li: HTMLElement,
    check_id: string,
    pc_id: string,
    current_pc_status: string,
    audit_frozen: boolean
): void {
    const copy_observation_row = pc_item_li.querySelector('.pc-copy-observation-row') as HTMLElement | null;
    if (!copy_observation_row) return;
    const observations = host.get_observations_from_other_samples(check_id, pc_id);
    copy_observation_row.hidden = !(observations.length > 0 && current_pc_status === 'failed' && !audit_frozen);
}

export function update_dom_single_pass_criterion_item(
    host: ChecklistDomUpdateHost,
    check_wrapper: HTMLElement,
    pc_item_li: HTMLElement,
    check_id: string,
    check_result_data: ReturnType<typeof read_check_stored_data>,
    overall_manual_status: string,
    env: ReturnType<typeof resolve_dom_update_env>
): void {
    const pc_id = pc_item_li.dataset.pcId!;
    const pc_data = read_pc_stored_data(check_result_data, pc_id);
    const current_pc_status = effective_pc_status(overall_manual_status, pc_data.status);
    const heal_opts = env.force_status_button_sync ? {} : { skip_if_unchanged: true };
    const pc_status_text = update_pass_criterion_status_row(host, pc_item_li, current_pc_status);
    update_pass_criterion_title_block(
        host, pc_item_li, check_id, pc_id, pc_status_text, env.audit_frozen, current_pc_status, pc_data
    );
    update_pass_criterion_action_buttons(
        host, pc_item_li, check_id, pc_id, current_pc_status, env.audit_frozen, heal_opts
    );
    const observation_wrapper = pc_item_li.querySelector('.pc-observation-detail-wrapper') as HTMLElement | null;
    const observation_textarea = observation_wrapper?.querySelector(
        'textarea.pc-observation-detail-textarea'
    ) as HTMLTextAreaElement | null ?? null;
    sync_observation_wrapper_visibility(
        as_observation_host(host), observation_wrapper, overall_manual_status, pc_data, check_id, pc_id
    );
    if (observation_textarea) {
        update_observation_lock_ui(host, observation_textarea, check_id, pc_id, env.audit_archived, host.Translation.t);
    }
    sync_pc_observation_textarea(host, {
        check_id, pc_id, pc_data, overall_manual_status, observation_textarea,
        current_pc_status, env
    });
    update_attach_media_button(host, pc_item_li, check_id, pc_id, pc_data);
    update_copy_observation_row(host, pc_item_li, check_id, pc_id, current_pc_status, env.audit_frozen);
}

export function update_dom_pc_only(
    host: ChecklistDomUpdateHost,
    check_id: string,
    pc_id: string
): void {
    const check_wrapper = host.container_ref?.querySelector(
        `.check-item[data-check-id="${CSS.escape(String(check_id))}"]`
    ) as HTMLElement | null;
    const pc_item_li = check_wrapper?.querySelector(
        `.pass-criterion-item[data-pc-id="${CSS.escape(String(pc_id))}"]`
    ) as HTMLElement | null;
    if (!check_wrapper || !pc_item_li) return;
    const check_result_data = read_check_stored_data(host.requirement_result_ref?.checkResults ?? null, check_id);
    const overall_manual_status = check_result_data?.overallStatus || 'not_audited';
    const pc_data = read_pc_stored_data(check_result_data, pc_id);
    const current_pc_status = effective_pc_status(overall_manual_status, pc_data.status);
    update_pass_criterion_action_buttons(
        host, pc_item_li, check_id, pc_id, current_pc_status, host._audit_frozen_for_ui(), {}
    );
    const observation_wrapper = pc_item_li.querySelector('.pc-observation-detail-wrapper') as HTMLElement | null;
    sync_observation_wrapper_visibility(
        as_observation_host(host), observation_wrapper, overall_manual_status, pc_data, check_id, pc_id
    );
    sync_pc_observation_textarea(host, {
        check_id, pc_id, pc_data, overall_manual_status,
        observation_textarea: pc_item_li.querySelector('textarea.pc-observation-detail-textarea'),
        current_pc_status,
        env: resolve_dom_update_env(host),
        force_sync: true
    });
    update_copy_observation_row(
        host, pc_item_li, check_id, pc_id, current_pc_status, host._audit_frozen_for_ui()
    );
}
