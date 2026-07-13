/**
 * @fileoverview «Fortsätt där du slutade» — knapp och klick på granskningsöversikten.
 */

import { get_users } from '../api/client.js';
import { set_restore_focus_info } from '../app/browser_globals.js';
import {
    collect_ordered_sample_open_hrefs,
    show_audit_overview_continue_modal
} from '../logic/open_all_sample_urls_modal.js';
import {
    get_user_resume_from_metadata,
    should_show_audit_overview_continue_button,
    type UserRequirementResumeEntry
} from '../logic/audit_user_requirement_resume.js';
import { get_current_user_name } from '../user/current_user.js';

type InstanceUser = { name?: string | null };

type HelpersLike = {
    create_element: (
        tag: string,
        options?: {
            class_name?: string | string[];
            attributes?: Record<string, string>;
            text_content?: string;
            event_listeners?: Record<string, (event?: Event) => void>;
        }
    ) => HTMLElement;
    add_protocol_if_missing?: (raw: string) => string;
};

type ContinueAuditDeps = {
    router: (view: string, params?: Record<string, unknown>) => void;
    getState: () => Record<string, unknown>;
    Helpers: HelpersLike;
    t: (key: string, replacements?: Record<string, unknown>) => string;
    known_users: InstanceUser[] | null;
};

let cached_instance_users: InstanceUser[] | null = null;
let instance_users_load_promise: Promise<InstanceUser[]> | null = null;

/** Hämtar och cachar användarlistan för instansen (för registry-check). */
export function load_instance_users_for_continue() {
    if (cached_instance_users) {
        return Promise.resolve(cached_instance_users);
    }
    if (!instance_users_load_promise) {
        instance_users_load_promise = get_users()
            .then((data) => {
                cached_instance_users = Array.isArray(data) ? data : [];
                return cached_instance_users;
            })
            .catch(() => {
                cached_instance_users = [];
                return cached_instance_users;
            })
            .finally(() => {
                instance_users_load_promise = null;
            });
    }
    return instance_users_load_promise;
}

/** Rensar cache vid utloggning eller test. */
export function clear_instance_users_continue_cache() {
    cached_instance_users = null;
    instance_users_load_promise = null;
}

export function should_show_continue_audit_button(
    state: Record<string, unknown>,
    known_users: InstanceUser[] | null | undefined
) {
    return should_show_audit_overview_continue_button(state, get_current_user_name(), known_users);
}

function navigate_to_resume_requirement(
    router: ContinueAuditDeps['router'],
    resume: UserRequirementResumeEntry
) {
    if (resume.focusInfo) {
        set_restore_focus_info(resume.focusInfo);
    }
    router('requirement_audit', {
        sampleId: resume.sampleId,
        requirementId: resume.requirementId
    });
}

export function handle_continue_audit_click({
    router,
    getState,
    Helpers,
    t,
    focus_element
}: Pick<ContinueAuditDeps, 'router' | 'getState' | 'Helpers' | 't'> & {
    focus_element?: HTMLElement | null;
}) {
    const state = getState();
    const user_name = get_current_user_name();
    const resume = get_user_resume_from_metadata(
        state.auditMetadata as Record<string, unknown> | null | undefined,
        user_name
    );
    if (!resume) return;

    const add_protocol = Helpers?.add_protocol_if_missing || ((raw: string) => raw);
    const { ordered_hrefs } = collect_ordered_sample_open_hrefs(
        state.samples as Parameters<typeof collect_ordered_sample_open_hrefs>[0],
        add_protocol
    );

    const navigate = () => navigate_to_resume_requirement(router, resume);

    if (ordered_hrefs.length === 0) {
        navigate();
        return;
    }

    show_audit_overview_continue_modal({
        trigger_element: focus_element ?? null,
        getState,
        Helpers,
        Translation: { t },
        navigate_to_requirement: navigate
    });
}

export function create_continue_audit_button_if_visible({
    Helpers,
    t,
    getState,
    known_users,
    router
}: ContinueAuditDeps): HTMLElement | null {
    const state = getState();
    if (!should_show_continue_audit_button(state, known_users)) {
        return null;
    }
    return Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'button-small', 'audit-overview-continue-button'],
        attributes: { type: 'button' },
        text_content: t('audit_overview_continue_button'),
        event_listeners: {
            click: (event?: Event) => {
                const target = event?.currentTarget;
                handle_continue_audit_click({
                    router,
                    getState,
                    Helpers,
                    t,
                    focus_element: target instanceof HTMLElement ? target : null
                });
            }
        }
    });
}
