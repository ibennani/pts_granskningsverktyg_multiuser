/**
 * Enhetstester för central uteslutning av markdown-formatera-knappen.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import {
    exclude_markdown_toolbar_for_id,
    exclude_markdown_toolbar_for_selector,
    exclude_markdown_toolbar_when,
    is_markdown_toolbar_excluded,
    mark_textarea_without_markdown_toolbar,
    MARKDOWN_TOOLBAR_SKIP_DATA_ATTR,
} from '../../js/utils/markdown_toolbar_exclusions.ts';

describe('markdown_toolbar_exclusions', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('mark_textarea_without_markdown_toolbar sätter data-attribut', () => {
        const textarea = document.createElement('textarea');
        mark_textarea_without_markdown_toolbar(textarea);
        expect(textarea.getAttribute(MARKDOWN_TOOLBAR_SKIP_DATA_ATTR)).toBe('true');
    });

    test('is_markdown_toolbar_excluded returnerar true för markerad textarea', () => {
        const textarea = document.createElement('textarea');
        mark_textarea_without_markdown_toolbar(textarea);
        expect(is_markdown_toolbar_excluded(textarea)).toBe(true);
    });

    test('is_markdown_toolbar_excluded returnerar true för registrerat id', () => {
        const textarea = document.createElement('textarea');
        textarea.id = 'notes-without-toolbar';
        exclude_markdown_toolbar_for_id('notes-without-toolbar');
        expect(is_markdown_toolbar_excluded(textarea)).toBe(true);
    });

    test('is_markdown_toolbar_excluded returnerar true för registrerad selektor', () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'plain-notes';
        const textarea = document.createElement('textarea');
        wrapper.appendChild(textarea);
        document.body.appendChild(wrapper);

        exclude_markdown_toolbar_for_selector('.plain-notes textarea');
        expect(is_markdown_toolbar_excluded(textarea)).toBe(true);
    });

    test('is_markdown_toolbar_excluded returnerar true för registrerat villkor', () => {
        const textarea = document.createElement('textarea');
        textarea.className = 'no-format';
        exclude_markdown_toolbar_when((el) => el.classList.contains('no-format'));
        expect(is_markdown_toolbar_excluded(textarea)).toBe(true);
    });

    test('is_markdown_toolbar_excluded returnerar false för vanlig textarea', () => {
        const textarea = document.createElement('textarea');
        textarea.id = 'regular-comment-field';
        expect(is_markdown_toolbar_excluded(textarea)).toBe(false);
    });

    test('standardundantag utesluter manage-users-plate', () => {
        const plate = document.createElement('div');
        plate.className = 'manage-users-plate';
        const textarea = document.createElement('textarea');
        plate.appendChild(textarea);
        document.body.appendChild(plate);

        expect(is_markdown_toolbar_excluded(textarea)).toBe(true);
    });
});
