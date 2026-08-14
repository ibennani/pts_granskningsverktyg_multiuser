/**
 * @fileoverview Tester för fade vid statusväxling på Åtgärder-sidan.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
    audit_actions_status_change_should_fade_content,
    run_audit_actions_content_transition,
    AUDIT_ACTIONS_CONTENT_OPACITY_TRANSITION,
} from '../../js/components/audit_actions_view_content_transition.ts';

describe('audit_actions_view_content_transition', () => {
    test('audit_actions_status_change_should_fade_content gäller in_progress ↔ locked', () => {
        expect(audit_actions_status_change_should_fade_content('in_progress', 'locked')).toBe(true);
        expect(audit_actions_status_change_should_fade_content('locked', 'in_progress')).toBe(true);
        expect(audit_actions_status_change_should_fade_content('locked', 'archived')).toBe(false);
        expect(audit_actions_status_change_should_fade_content('in_progress', 'archived')).toBe(false);
        expect(audit_actions_status_change_should_fade_content('in_progress', 'in_progress')).toBe(false);
    });

    describe('run_audit_actions_content_transition', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('anropar run_render direkt utan content-element', async () => {
            const run_render = jest.fn();
            const root = document.createElement('div');

            const promise = run_audit_actions_content_transition(root, run_render);
            await jest.runAllTimersAsync();
            await promise;

            expect(run_render).toHaveBeenCalledTimes(1);
        });

        test('tonar ut, renderar om och tonar in när content finns', async () => {
            const root = document.createElement('div');
            const content = document.createElement('div');
            content.className = 'audit-actions__content';
            root.appendChild(content);

            let render_count = 0;
            const run_render = jest.fn(() => {
                render_count += 1;
                if (render_count === 1) {
                    content.remove();
                    const next = document.createElement('div');
                    next.className = 'audit-actions__content';
                    next.style.opacity = '0';
                    next.style.transition = AUDIT_ACTIONS_CONTENT_OPACITY_TRANSITION;
                    root.appendChild(next);
                }
            });

            const promise = run_audit_actions_content_transition(root, run_render);
            await jest.advanceTimersByTimeAsync(0);
            expect(run_render).not.toHaveBeenCalled();
            await jest.runAllTimersAsync();
            await promise;

            expect(run_render).toHaveBeenCalledTimes(1);
            const new_content = root.querySelector('.audit-actions__content') as HTMLElement | null;
            expect(new_content?.style.opacity).toBe('');
            expect(new_content?.style.transition).toBe('');
        });

        test('anropar run_render först efter utfadning', async () => {
            const root = document.createElement('div');
            const content = document.createElement('div');
            content.className = 'audit-actions__content';
            root.appendChild(content);

            const order: string[] = [];
            const run_render = jest.fn(() => {
                order.push('render');
            });

            const promise = run_audit_actions_content_transition(root, run_render);
            order.push('start');
            await jest.advanceTimersByTimeAsync(249);
            expect(run_render).not.toHaveBeenCalled();
            await jest.advanceTimersByTimeAsync(1);
            await Promise.resolve();
            expect(run_render).toHaveBeenCalledTimes(1);
            await jest.runAllTimersAsync();
            await promise;

            expect(order).toEqual(['start', 'render']);
        });

        test('använder samma opacity-transition som regelfilssektionernas vy/redigera-växling', async () => {
            const root = document.createElement('div');
            const content = document.createElement('div');
            content.className = 'audit-actions__content';
            root.appendChild(content);

            const run_render = jest.fn(() => {
                content.remove();
                const next = document.createElement('div');
                next.className = 'audit-actions__content';
                root.appendChild(next);
            });

            const promise = run_audit_actions_content_transition(root, run_render);
            await jest.advanceTimersByTimeAsync(0);
            expect(content.style.transition).toBe(AUDIT_ACTIONS_CONTENT_OPACITY_TRANSITION);
            await jest.runAllTimersAsync();
            await promise;
        });
    });
});

describe('AuditActionsViewComponent render under statusfade', () => {
    test('render() är no-op medan statusfade pågår', async () => {
        const mod = await import('../../js/components/AuditActionsViewComponent.ts');
        const AuditActionsViewComponentClass = mod.AuditActionsViewComponent;
        const component = new AuditActionsViewComponentClass();
        component._audit_actions_status_transition_active = true;
        component.root = document.createElement('div');
        component.Helpers = {
            create_element: (tag, opts = {}) => {
                const el = document.createElement(tag);
                if (opts.text_content) el.textContent = opts.text_content;
                return el;
            },
        };
        component.Translation = { t: (key) => key };
        component.getState = () => ({ ruleFileContent: { requirements: {} }, auditStatus: 'locked', samples: [] });

        component.render();
        expect(component.root.querySelector('.audit-actions__content')).toBeFalsy();
    });
});
