/**
 * @fileoverview Enhetstester för is_web_monitoring_audit.
 */
import { is_web_monitoring_audit } from '../../js/logic/is_web_monitoring_audit.ts';

describe('is_web_monitoring_audit', () => {
    test('identifierar webb via type och text', () => {
        expect(
            is_web_monitoring_audit({
                metadata: { monitoringType: { type: 'web', text: 'Webb' } },
            })
        ).toBe(true);
        expect(
            is_web_monitoring_audit({
                metadata: { monitoringType: { text: 'Website' } },
            })
        ).toBe(true);
        expect(
            is_web_monitoring_audit({
                metadata: { monitoringType: { text: 'WEBBPLATS' } },
            })
        ).toBe(true);
    });

    test('returnerar falskt för pdf och okänd typ', () => {
        expect(
            is_web_monitoring_audit({
                metadata: { monitoringType: { text: 'PDF-dokument' } },
            })
        ).toBe(false);
        expect(
            is_web_monitoring_audit({
                metadata: { monitoringType: { text: 'Övrigt' } },
            })
        ).toBe(false);
        expect(is_web_monitoring_audit({ metadata: {} })).toBe(false);
        expect(is_web_monitoring_audit(null)).toBe(false);
    });
});
