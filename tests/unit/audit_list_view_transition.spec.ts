/**
 * @fileoverview Enhetstester för granskningslistans växlingsanimation.
 */

import { jest, describe, test, expect } from '@jest/globals';
import {
    clear_audit_lists_transition_classes,
    clear_table_page_transition_classes,
    clear_table_page_layout_animation,
    run_audit_lists_toggle_animation,
    run_table_page_change_animation,
    wrap_table_page_change_handler,
    TABLE_PAGE_LAYOUT_ANIMATING_CLASS,
    AUDIT_LIST_TOGGLE_TRANSITION_MS
} from '../../js/logic/audit_list_view_transition.ts';

describe('audit_list_view_transition', () => {
    test('AUDIT_LIST_TOGGLE_TRANSITION_MS är halva totala listväxlingstiden', () => {
        expect(AUDIT_LIST_TOGGLE_TRANSITION_MS).toBe(250);
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

    test('clear_table_page_layout_animation tar bort höjdanimationsklass och inline-stilar', () => {
        const host = document.createElement('div');
        host.classList.add(TABLE_PAGE_LAYOUT_ANIMATING_CLASS);
        host.style.height = '120px';
        host.style.overflow = 'hidden';

        clear_table_page_layout_animation(host);

        expect(host.classList.contains(TABLE_PAGE_LAYOUT_ANIMATING_CLASS)).toBe(false);
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
        expect(root.classList.contains(TABLE_PAGE_LAYOUT_ANIMATING_CLASS)).toBe(false);
        expect(root.style.height).toBe('');

        document.body.removeChild(root);
    });

    test('run_table_page_change_animation animerar layout-host höjd vid sidbyte', async () => {
        const root = document.createElement('div');
        root.className = 'generic-table-page-layout-host';
        const stack = document.createElement('div');
        stack.className = 'generic-table-stack';
        stack.style.height = '200px';
        root.appendChild(stack);
        document.body.appendChild(root);

        const run_render = jest.fn(() => {
            stack.style.height = '80px';
            stack.innerHTML = '<nav class="table-pagination-nav"></nav>';
        });

        await run_table_page_change_animation(
            () => root.querySelector('.generic-table-stack'),
            run_render,
            () => root
        );

        expect(run_render).toHaveBeenCalledTimes(1);
        expect(root.classList.contains(TABLE_PAGE_LAYOUT_ANIMATING_CLASS)).toBe(false);
        expect(root.style.height).toBe('');

        document.body.removeChild(root);
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

        await new Promise((resolve) => setTimeout(resolve, AUDIT_LIST_TOGGLE_TRANSITION_MS * 2 + 100));

        expect(on_page_change).toHaveBeenCalledWith(1);

        document.body.removeChild(root);
    });
});
