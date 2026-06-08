/**
 * Synklogik observationsfält — när textarea ska visas och UI-audit.
 */
import { describe, test, expect } from '@jest/globals';

describe('checklist_observation_visibility', () => {
    test('observationsfält dolt vid ej bedömd eller godkänd', async () => {
        const {
            should_show_observation_wrapper,
            effective_pc_status
        } = await import('../../js/components/requirement_audit/checklist_observation_visibility.js');

        expect(should_show_observation_wrapper('passed', 'not_audited')).toBe(false);
        expect(should_show_observation_wrapper('passed', 'passed')).toBe(false);
        expect(should_show_observation_wrapper('not_audited', 'not_audited')).toBe(false);
        expect(effective_pc_status('not_applicable', 'failed')).toBe('passed');
        expect(should_show_observation_wrapper('not_applicable', 'failed')).toBe(false);
    });

    test('observationsfält synligt endast vid underkänt', async () => {
        const { should_show_observation_wrapper } = await import(
            '../../js/components/requirement_audit/checklist_observation_visibility.js'
        );
        expect(should_show_observation_wrapper('passed', 'failed')).toBe(true);
    });

    test('read_pc_stored_data hittar post via tolerant nyckel', async () => {
        const { read_pc_stored_data } = await import(
            '../../js/components/requirement_audit/checklist_observation_visibility.js'
        );
        const data = read_pc_stored_data(
            { passCriteria: { '1.1': { status: 'failed', observationDetail: 'Hej' } } },
            '1.1'
        );
        expect(data.status).toBe('failed');
        expect(data.observationDetail).toBe('Hej');
    });

    test('audit_observation_ui flaggar textarea synlig utan underkänt', async () => {
        const { audit_observation_ui } = await import(
            '../../js/components/requirement_audit/checklist_observation_visibility.js'
        );
        const audit = audit_observation_ui({
            overall_manual_status: 'passed',
            pc_status: 'not_audited',
            wrapper_visible: true,
            failed_button_active: false
        });
        expect(audit.mismatch).toBe(true);
        expect(audit.reasons).toContain('textarea_synlig_men_inte_underkänt_i_data');
    });

    test('audit_observation_ui flaggar underkänt-knapp som inte matchar data', async () => {
        const { audit_observation_ui } = await import(
            '../../js/components/requirement_audit/checklist_observation_visibility.js'
        );
        const audit = audit_observation_ui({
            overall_manual_status: 'passed',
            pc_status: 'failed',
            wrapper_visible: true,
            failed_button_active: false
        });
        expect(audit.mismatch).toBe(true);
        expect(audit.reasons).toContain('underkänt_knapp_matchar_inte_data');
    });

    test('apply_observation_wrapper_visibility döljer inte när fokus ligger i wrapper', async () => {
        const { apply_observation_wrapper_visibility } = await import(
            '../../js/components/requirement_audit/checklist_observation_visibility.js'
        );
        const wrapper = document.createElement('div');
        const textarea = document.createElement('textarea');
        wrapper.appendChild(textarea);
        document.body.appendChild(wrapper);
        textarea.focus();

        const result = apply_observation_wrapper_visibility(wrapper, 'passed', 'not_audited', textarea);
        expect(result.deferred_hide).toBe(true);
        expect(result.applied).toBe(false);
        expect(wrapper.hidden).toBe(false);

        document.body.removeChild(wrapper);
    });

    test('apply_observation_wrapper_visibility sätter hidden enligt data', async () => {
        const { apply_observation_wrapper_visibility } = await import(
            '../../js/components/requirement_audit/checklist_observation_visibility.js'
        );
        const wrapper = document.createElement('div');
        apply_observation_wrapper_visibility(wrapper, 'passed', 'failed');
        expect(wrapper.hidden).toBe(false);
        apply_observation_wrapper_visibility(wrapper, 'passed', 'passed');
        expect(wrapper.hidden).toBe(true);
    });

    test('read_check_stored_data hittar post via tolerant nyckel', async () => {
        const { read_check_stored_data } = await import(
            '../../js/components/requirement_audit/checklist_observation_visibility.js'
        );
        const data = read_check_stored_data(
            { chk1: { overallStatus: 'passed', passCriteria: {} } },
            'chk1'
        );
        expect(data?.overallStatus).toBe('passed');
    });
});
