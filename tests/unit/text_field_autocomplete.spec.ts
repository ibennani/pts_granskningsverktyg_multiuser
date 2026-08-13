/**
 * @fileoverview Tester för autocomplete avstängning på textfält.
 */
import { describe, expect, test } from '@jest/globals';
import { create_element } from '../../js/dom/create_element.js';
import { should_disable_text_field_autocomplete } from '../../js/dom/text_field_autocomplete.ts';

describe('should_disable_text_field_autocomplete', () => {
    test('gäller textarea och vanliga textliknande input-typer', () => {
        expect(should_disable_text_field_autocomplete('textarea')).toBe(true);
        expect(should_disable_text_field_autocomplete('input', 'text')).toBe(true);
        expect(should_disable_text_field_autocomplete('input', 'search')).toBe(true);
        expect(should_disable_text_field_autocomplete('input', 'url')).toBe(true);
    });

    test('gäller inte lösenord, dolda fält eller knappar', () => {
        expect(should_disable_text_field_autocomplete('input', 'password')).toBe(false);
        expect(should_disable_text_field_autocomplete('input', 'hidden')).toBe(false);
        expect(should_disable_text_field_autocomplete('input', 'checkbox')).toBe(false);
        expect(should_disable_text_field_autocomplete('select')).toBe(false);
    });
});

describe('create_element autocomplete', () => {
    test('sätter autocomplete off på textfält och textarea', () => {
        const input = create_element('input', {
            attributes: { type: 'text', autocomplete: 'username' },
        }) as HTMLInputElement;
        expect(input.getAttribute('autocomplete')).toBe('off');

        const textarea = create_element('textarea', {
            attributes: { autocomplete: 'on' },
        }) as HTMLTextAreaElement;
        expect(textarea.getAttribute('autocomplete')).toBe('off');
    });

    test('lämnar lösenordsfält utan att tvinga autocomplete off', () => {
        const password = create_element('input', {
            attributes: { type: 'password', autocomplete: 'current-password' },
        }) as HTMLInputElement;
        expect(password.getAttribute('autocomplete')).toBe('current-password');
    });
});
