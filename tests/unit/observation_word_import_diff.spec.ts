/**
 * Tester för diff vid Word-import av observationstexter.
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_observation_word_import_diff,
    normalize_observation_text_for_diff,
} from '../../js/import/observation_word_import_diff.ts';

function create_audit_with_deficiencies(entries) {
    const pass_criteria = {};
    for (const entry of entries) {
        pass_criteria[entry.pc_id] = {
            status: 'failed',
            deficiencyId: entry.deficiency_id,
            observationDetail: entry.observation,
        };
    }

    return {
        ruleFileContent: {
            metadata: { language: 'sv-SE' },
            requirements: {
                req1: {
                    id: 'req1',
                    title: 'Krav 1',
                    checks: [{
                        id: 'check1',
                        passCriteria: entries.map((entry) => ({
                            id: entry.pc_id,
                            requirement: entry.fallback || 'Standardtext',
                        })),
                    }],
                },
            },
        },
        samples: [{
            id: 's1',
            description: 'Startsida',
            requirementResults: {
                req1: {
                    checkResults: {
                        check1: {
                            overallStatus: 'passed',
                            passCriteria: pass_criteria,
                        },
                    },
                },
            },
        }],
    };
}

describe('observation_word_import_diff', () => {
    test('normalize_observation_text_for_diff matchar export och Word-omläsning', () => {
        const audit_text = '**Fet text** och punkt:\n- första\n- andra';
        const word_text = '**Fet text** och punkt:\n- första\n- andra';
        expect(normalize_observation_text_for_diff(audit_text)).toBe(
            normalize_observation_text_for_diff(word_text)
        );
    });

    test('normalize_observation_text_for_diff ignorerar tomma rader och NBSP', () => {
        const audit_text = 'Rad ett\n\nRad två';
        const word_text = 'Rad ett\nRad två\u00A0';
        expect(normalize_observation_text_for_diff(audit_text)).toBe(
            normalize_observation_text_for_diff(word_text)
        );
    });

    test('identisk Word-fil efter export räknas som oförändrad', () => {
        const audit = create_audit_with_deficiencies([
            { pc_id: 'pc1', deficiency_id: 'B3', observation: '**Fet** och *kursiv*' },
            { pc_id: 'pc2', deficiency_id: 'B7', observation: '- punkt ett\n- punkt två' },
        ]);

        const diff = build_observation_word_import_diff(audit, {
            ok: true,
            blocks: [
                { id_number: '3', observation_markdown: '**Fet** och *kursiv*' },
                { id_number: '7', observation_markdown: '- punkt ett\n- punkt två' },
            ],
        });

        expect(diff.summary.changed_count).toBe(0);
        expect(diff.summary.unchanged_count).toBe(2);
        expect(diff.can_import).toBe(true);
    });

    test('rapporterar ändrad, saknad och okänd brist', () => {
        const audit = create_audit_with_deficiencies([
            { pc_id: 'pc1', deficiency_id: 'B3', observation: 'Gammal text' },
            { pc_id: 'pc2', deficiency_id: 'B7', observation: 'Oförändrad' },
        ]);

        const diff = build_observation_word_import_diff(audit, {
            ok: true,
            blocks: [
                { id_number: '3', observation_markdown: 'Ny text' },
                { id_number: '7', observation_markdown: 'Oförändrad' },
                { id_number: '99', observation_markdown: 'Okänd' },
            ],
        });

        expect(diff.summary.total_in_audit).toBe(2);
        expect(diff.summary.changed_count).toBe(1);
        expect(diff.summary.missing_in_word_count).toBe(0);
        expect(diff.summary.unchanged_count).toBe(1);
        expect(diff.summary.unknown_in_word_count).toBe(1);
        expect(diff.can_import).toBe(false);
    });

    test('tillåter import när inga okända id finns', () => {
        const audit = create_audit_with_deficiencies([
            { pc_id: 'pc1', deficiency_id: 'B3', observation: 'Gammal' },
        ]);

        const diff = build_observation_word_import_diff(audit, {
            ok: true,
            blocks: [{ id_number: '3', observation_markdown: 'Ny' }],
        });

        expect(diff.can_import).toBe(true);
        expect(diff.summary.changed_count).toBe(1);
    });

    test('markerar brist som saknas i Word', () => {
        const audit = create_audit_with_deficiencies([
            { pc_id: 'pc1', deficiency_id: 'B3', observation: 'Kvar' },
        ]);

        const diff = build_observation_word_import_diff(audit, {
            ok: true,
            blocks: [],
        });

        expect(diff.parse_ok).toBe(true);
        expect(diff.summary.missing_in_word_count).toBe(1);
        expect(diff.items[0].status).toBe('missing_in_word');
    });
});
