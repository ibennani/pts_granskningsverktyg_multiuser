/**
 * Tester för fokus-debug i krav-vy.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';

describe('krav_vy_fokus_debug', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('build_krav_vy_focus_payload beskriver observations-textarea', async () => {
        const { build_krav_vy_focus_payload } = await import(
            '../../js/components/requirement_audit/krav_vy_knapp_debug_log.js'
        );
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="check-item" data-check-id="c1">
                <div class="pass-criterion-item" data-pc-id="p1">
                    <textarea id="pc-observation-c1-p1" class="pc-observation-detail-textarea"></textarea>
                </div>
            </div>
        `;
        const textarea = wrapper.querySelector('textarea');
        const payload = build_krav_vy_focus_payload(textarea);
        expect(payload).toMatchObject({
            typ: 'textarea',
            fält: 'Observation',
            check_id: 'c1',
            pc_id: 'p1'
        });
    });

    test('log_krav_vy_fokus_from_event ignorerar icke-fokuserbara element', async () => {
        const { log_krav_vy_fokus_from_event } = await import(
            '../../js/components/requirement_audit/krav_vy_knapp_debug_log.js'
        );
        const div = document.createElement('div');
        expect(() => {
            log_krav_vy_fokus_from_event('Fokus fick', { target: div, relatedTarget: null });
        }).not.toThrow();
    });
});
