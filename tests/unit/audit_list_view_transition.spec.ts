/**
 * @fileoverview Enhetstester för granskningslistans växlingsanimation.
 */

import { jest, describe, test, expect } from '@jest/globals';
import {
    clear_audit_lists_transition_classes,
    clear_table_page_transition_classes,
    clear_table_page_height_transition,
    run_audit_lists_toggle_animation,
    run_table_page_change_animation,
    wrap_table_page_change_handler,
    TABLE_PAGE_HEIGHT_TRANSITION_CLASS,
    TABLE_PAGE_TRANSITION_EXIT_CLASS,
    TABLE_PAGE_TRANSITION_ENTER_CLASS,
    AUDIT_LIST_TOGGLE_TRANSITION_MS,
    TABLE_PAGE_TRANSITION_TOTAL_MS,
    TABLE_PAGE_FADE_OUT_MS,
    TABLE_PAGE_LAYOUT_MS,
    TABLE_PAGE_FADE_IN_MS
} from '../../js/logic/audit_list_view_transition.ts';

describe('audit_list_view_transition', () => {
    test('AUDIT_LIST_TOGGLE_TRANSITION_MS är halva totala listväxlingstiden', () => {
        expect(AUDIT_LIST_TOGGLE_TRANSITION_MS).toBe(125);
    });

    test('TABLE_PAGE timing: layout och fade in parallellt efter kort fade out', () => {
        expect(TABLE_PAGE_FADE_OUT_MS).toBe(125);
        expect(TABLE_PAGE_LAYOUT_MS).toBe(500);
        expect(TABLE_PAGE_FADE_IN_MS).toBe(500);
        expect(TABLE_PAGE_TRANSITION_TOTAL_MS).toBe(625);
        expect(TABLE_PAGE_TRANSITION_TOTAL_MS).toBe(
            TABLE_PAGE_FADE_OUT_MS + Math.max(TABLE_PAGE_LAYOUT_MS, TABLE_PAGE_FADE_IN_MS)
        );
    });

    test('clear_audit_lists_transition_classes tar bort opacity-klasser', () => {
        const container = document.createElement('div');
        container.classList.add(
            'audit-lists--transition-exit',
            'audit-lists--transition-enter-start'
        );

        clear_audit_lists_transition_classes(container);

        expect(container.classList.contains('audit-lists--transition-exit')).toBe(false);
        expect(container.classList.contains('audit-lists--transition-enter-start')).toBe(false);
    });

    test('run_audit_lists_toggle_animation lämnar inte kvar exit-klass efter render', async () => {
        const container = document.createElement('div');
        container.className = 'audit-audits-sections-container';
        document.body.appendChild(container);

        const run_render = jest.fn(() => {
            container.innerHTML = '<section>Lista</section>';
        });

        await run_audit_lists_toggle_animation(() => container, run_render);

        expect(run_render).toHaveBeenCalledTimes(1);
        expect(container.classList.contains('audit-lists--transition-exit')).toBe(false);
        expect(container.classList.contains('audit-lists--transition-enter-start')).toBe(false);
        expect(container.textContent).toContain('Lista');

        document.body.removeChild(container);
    });

    test('clear_table_page_transition_classes tar bort opacity-klasser på tabellstack', () => {
        const stack = document.createElement('div');
        stack.classList.add(
            'generic-table-stack--transition-exit',
            'generic-table-stack--transition-enter-start'
        );

        clear_table_page_transition_classes(stack);

        expect(stack.classList.contains('generic-table-stack--transition-exit')).toBe(false);
        expect(stack.classList.contains('generic-table-stack--transition-enter-start')).toBe(false);
    });

    test('clear_table_page_height_transition tar bort höjdövergångsklass och inline-stilar', () => {
        const host = document.createElement('div');
        host.classList.add(TABLE_PAGE_HEIGHT_TRANSITION_CLASS);
        host.style.height = '120px';
        host.style.overflow = 'hidden';

        clear_table_page_height_transition(host);

        expect(host.classList.contains(TABLE_PAGE_HEIGHT_TRANSITION_CLASS)).toBe(false);
        expect(host.style.height).toBe('');
        expect(host.style.overflow).toBe('');
    });

    test('run_table_page_change_animation renderar om tabellstack utan kvarvarande klasser', async () => {
        const root = document.createElement('div');
        root.className = 'generic-table-page-layout-host';
        const stack = document.createElement('div');
        stack.className = 'generic-table-stack';
        root.appendChild(stack);
        document.body.appendChild(root);

        const run_render = jest.fn(() => {
            stack.innerHTML = '<nav class="table-pagination-nav"></nav>';
        });

        await run_table_page_change_animation(
            () => root.querySelector('.generic-table-stack'),
            run_render,
            () => root
        );

        expect(run_render).toHaveBeenCalledTimes(1);
        expect(stack.classList.contains('generic-table-stack--transition-exit')).toBe(false);
        expect(stack.classList.contains('generic-table-stack--transition-enter-start')).toBe(false);
        expect(root.classList.contains(TABLE_PAGE_HEIGHT_TRANSITION_CLASS)).toBe(false);
        expect(root.style.height).toBe('');

        document.body.removeChild(root);
    });

    test('run_table_page_change_animation kör fade out före render och fade in parallellt med layout', async () => {
        const layout_host = document.createElement('div');
        layout_host.className = 'generic-table-page-layout-host';
        const stack = document.createElement('div');
        stack.className = 'generic-table-stack';
        layout_host.appendChild(stack);
        document.body.appendChild(layout_host);

        Object.defineProperty(layout_host, 'offsetHeight', {
            configurable: true,
            get: () => 200
        });
        Object.defineProperty(layout_host, 'scrollHeight', {
            configurable: true,
            get: () => 80
        });

        const phase_log: string[] = [];
        const original_add = stack.classList.add.bind(stack.classList);
        stack.classList.add = (...tokens: string[]) => {
            phase_log.push(`add:${tokens.join(',')}`);
            return original_add(...tokens);
        };

        const run_render = jest.fn(() => {
            phase_log.push('render');
            expect(stack.classList.contains(TABLE_PAGE_TRANSITION_ENTER_CLASS)).toBe(true);
            expect(stack.classList.contains(TABLE_PAGE_TRANSITION_EXIT_CLASS)).toBe(false);
            stack.innerHTML = '<nav class="table-pagination-nav"></nav>';
        });

        await run_table_page_change_animation(
            () => layout_host.querySelector('.generic-table-stack'),
            run_render,
            () => layout_host
        );

        const exit_index = phase_log.findIndex((entry) => entry.includes(TABLE_PAGE_TRANSITION_EXIT_CLASS));
        const render_index = phase_log.indexOf('render');
        expect(exit_index).toBeGreaterThanOrEqual(0);
        expect(render_index).toBeGreaterThan(exit_index);
        expect(run_render).toHaveBeenCalledTimes(1);

        document.body.removeChild(layout_host);
    });

    test('run_table_page_change_animation låser layout-höjd före render så syskon inte hoppar', async () => {
        const container = document.createElement('div');
        container.className = 'audit-audits-sections-container';
        const active_section = document.createElement('section');
        active_section.className = 'start-view-audits-section';
        const layout_host = document.createElement('div');
        layout_host.className = 'generic-table-page-layout-host';
        const stack = document.createElement('div');
        stack.className = 'generic-table-stack';
        stack.style.height = '200px';
        layout_host.appendChild(stack);
        active_section.appendChild(layout_host);
        Object.defineProperty(layout_host, 'offsetHeight', {
            configurable: true,
            get: () => 200
        });
        Object.defineProperty(layout_host, 'scrollHeight', {
            configurable: true,
            get: () => 80
        });
        const following_section = document.createElement('section');
        following_section.className = 'start-view-audits-section start-view-audits-section-following';
        following_section.textContent = 'Efterföljande sektion';
        container.appendChild(active_section);
        container.appendChild(following_section);
        document.body.appendChild(container);

        let height_lock_at_render = '';
        let overflow_at_render = '';
        const run_render = jest.fn(() => {
            height_lock_at_render = layout_host.style.height;
            overflow_at_render = layout_host.style.overflow;
            stack.style.height = '80px';
            stack.innerHTML = '<nav class="table-pagination-nav"></nav>';
        });

        await run_table_page_change_animation(
            () => layout_host.querySelector('.generic-table-stack'),
            run_render,
            () => layout_host
        );

        expect(overflow_at_render).toBe('hidden');
        expect(height_lock_at_render).toMatch(/^\d+px$/);
        expect(parseInt(height_lock_at_render, 10)).toBeGreaterThan(0);
        expect(run_render).toHaveBeenCalledTimes(1);
        expect(layout_host.classList.contains(TABLE_PAGE_HEIGHT_TRANSITION_CLASS)).toBe(false);
        expect(layout_host.style.height).toBe('');

        document.body.removeChild(container);
    });

    test('run_table_page_change_animation animerar layout-höjd vid expanderande innehåll (nästa sida)', async () => {
        const layout_host = document.createElement('div');
        layout_host.className = 'generic-table-page-layout-host';
        const stack = document.createElement('div');
        stack.className = 'generic-table-stack';
        stack.style.height = '80px';
        layout_host.appendChild(stack);
        document.body.appendChild(layout_host);

        let offset_height_read = 80;
        Object.defineProperty(layout_host, 'offsetHeight', {
            configurable: true,
            get: () => offset_height_read
        });

        const run_render = jest.fn(() => {
            stack.style.height = '200px';
            stack.innerHTML = '<nav class="table-pagination-nav"></nav>';
            offset_height_read = 200;
        });

        await run_table_page_change_animation(
            () => layout_host.querySelector('.generic-table-stack'),
            run_render,
            () => layout_host
        );

        expect(run_render).toHaveBeenCalledTimes(1);
        expect(layout_host.classList.contains(TABLE_PAGE_HEIGHT_TRANSITION_CLASS)).toBe(false);
        expect(layout_host.style.height).toBe('');
        expect(stack.classList.contains('generic-table-stack--transition-exit')).toBe(false);
        expect(stack.classList.contains('generic-table-stack--transition-enter-start')).toBe(false);

        document.body.removeChild(layout_host);
    });

    test('run_table_page_change_animation hoppar över höjdövergång när höjden är oförändrad', async () => {
        const layout_host = document.createElement('div');
        layout_host.className = 'generic-table-page-layout-host';
        const stack = document.createElement('div');
        stack.className = 'generic-table-stack';
        layout_host.appendChild(stack);
        document.body.appendChild(layout_host);

        Object.defineProperty(layout_host, 'offsetHeight', {
            configurable: true,
            get: () => 120
        });

        const run_render = jest.fn(() => {
            stack.innerHTML = '<nav class="table-pagination-nav"></nav>';
        });

        await run_table_page_change_animation(
            () => layout_host.querySelector('.generic-table-stack'),
            run_render,
            () => layout_host
        );

        expect(run_render).toHaveBeenCalledTimes(1);
        expect(layout_host.classList.contains(TABLE_PAGE_HEIGHT_TRANSITION_CLASS)).toBe(false);
        expect(layout_host.style.height).toBe('');

        document.body.removeChild(layout_host);
    });

    test('wrap_table_page_change_handler animerar sidbyte och anropar callback', async () => {
        const root = document.createElement('div');
        root.className = 'generic-table-page-layout-host';
        const stack = document.createElement('div');
        stack.className = 'generic-table-stack';
        root.appendChild(stack);
        document.body.appendChild(root);

        const on_page_change = jest.fn();
        const handler = wrap_table_page_change_handler(root, on_page_change);
        handler(1);

        await new Promise((resolve) => setTimeout(resolve, TABLE_PAGE_TRANSITION_TOTAL_MS + 100));

        expect(on_page_change).toHaveBeenCalledWith(1);

        document.body.removeChild(root);
    });
});
