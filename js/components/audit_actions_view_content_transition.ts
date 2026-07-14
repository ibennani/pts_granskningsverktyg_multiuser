/**
 * @fileoverview Fade vid växling mellan pågående och avslutad granskning på Åtgärder-sidan.
 * Samma sekvens som vy/redigera-växling i RulefileSectionsViewComponent.
 */

import { prefers_reduced_motion } from '../utils/expandable_panel_transition.js';

/** En fas (ut- eller infasning), samma som regelfilssektionernas vy/redigera-växling. */
export const AUDIT_ACTIONS_CONTENT_TRANSITION_MS = 250;

const CONTENT_SELECTOR = '.audit-actions__content';
export const AUDIT_ACTIONS_CONTENT_OPACITY_TRANSITION = 'opacity 0.25s ease';

/** Sant vid växling mellan pågående och avslutad (in_progress ↔ locked). */
export function audit_actions_status_change_should_fade_content(
    previous_status: string | null | undefined,
    next_status: string | null | undefined
): boolean {
    const statuses = new Set([previous_status, next_status]);
    return statuses.has('in_progress') && statuses.has('locked') && statuses.size === 2;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function force_reflow(element: HTMLElement): void {
    void element.offsetHeight;
}

/**
 * Tonar ut innehåll, kör run_render (t.ex. dispatch + omrendering) och tonar in igen (0,25 s + 0,25 s).
 * Nytt innehåll ska redan vara osynligt (opacity 0) innan det läggs i DOM, som i RulefileSectionsViewComponent.
 */
export function run_audit_actions_content_transition(
    root: HTMLElement | null,
    run_render: () => void | Promise<void>
): Promise<void> {
    const content = root?.querySelector(CONTENT_SELECTOR) as HTMLElement | null;
    if (!content || prefers_reduced_motion()) {
        return Promise.resolve(run_render());
    }

    content.style.transition = AUDIT_ACTIONS_CONTENT_OPACITY_TRANSITION;
    content.style.opacity = '0';
    force_reflow(content);

    return delay(AUDIT_ACTIONS_CONTENT_TRANSITION_MS)
        .then(() => Promise.resolve(run_render()))
        .then(() => {
            const new_content = root?.querySelector(CONTENT_SELECTOR) as HTMLElement | null;
            if (!new_content) return;

            new_content.style.opacity = '0';
            new_content.style.transition = AUDIT_ACTIONS_CONTENT_OPACITY_TRANSITION;

            return new Promise<void>((resolve) => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        new_content.style.opacity = '1';
                        setTimeout(() => {
                            new_content.style.transition = '';
                            new_content.style.opacity = '';
                            resolve();
                        }, AUDIT_ACTIONS_CONTENT_TRANSITION_MS);
                    });
                });
            });
        });
}
