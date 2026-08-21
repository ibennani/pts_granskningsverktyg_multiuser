/**
 * @fileoverview Enhetstester för interpolate_translation_plain (textContent utan HTML-escape).
 */
import { describe, test, expect, beforeAll } from '@jest/globals';
import {
    ensure_initial_load,
    interpolate_translation_plain,
    t,
} from '../../js/translation_logic.ts';

describe('interpolate_translation_plain', () => {
    beforeAll(async () => {
        await ensure_initial_load();
    });

    test('visar & oförändrat i textContent-liknande sträng', () => {
        const plain = interpolate_translation_plain('observation_word_import_error_wrong_audit', {
            audit_case: '2024-1',
            audit_actor: 'A & B Co',
        });
        const escaped = t('observation_word_import_error_wrong_audit', {
            audit_case: '2024-1',
            audit_actor: 'A & B Co',
        });

        expect(plain).toContain('A & B Co');
        expect(plain).not.toContain('&amp;');
        expect(escaped).toContain('&amp;');
    });

    test('interpolerar filnamn med & utan escape', () => {
        const plain = interpolate_translation_plain('observation_word_import_selected_file', {
            filename: 'rapport & bilaga.docx',
        });

        expect(plain).toContain('rapport & bilaga.docx');
        expect(plain).not.toContain('&amp;');
    });

    test('interpolerar exportfilnamn med & utan escape', () => {
        const plain = interpolate_translation_plain('audit_saved_as_file', {
            filename: '26-1559_XXL_Sport_&_Vildmark_AB_Tillsyn_LPTT_bilaga_3_skarmbilder.pdf',
        });
        const escaped = t('audit_saved_as_file', {
            filename: '26-1559_XXL_Sport_&_Vildmark_AB_Tillsyn_LPTT_bilaga_3_skarmbilder.pdf',
        });

        expect(plain).toContain('Sport_&_Vildmark');
        expect(plain).not.toContain('&amp;');
        expect(escaped).toContain('&amp;');
    });
});
