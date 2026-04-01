/**
 * Tester för newer_rule_check.js
 */
import { describe, test, expect } from '@jest/globals';
import { find_newer_rule_for_audit } from '../../js/logic/newer_rule_check.js';

describe('newer_rule_check', () => {
    const v_gt = (a, b) => a > b;

    test('returnerar null vid ogiltig indata', () => {
        expect(find_newer_rule_for_audit(null, [], v_gt)).toBeNull();
        expect(find_newer_rule_for_audit({}, null, v_gt)).toBeNull();
        expect(find_newer_rule_for_audit({}, [], v_gt)).toBeNull();
    });

    test('returnerar null när granskningsversion saknas eller är tom', () => {
        const rules = [{ id: '1', metadata_version: '2.0.0' }];
        expect(find_newer_rule_for_audit({}, rules, v_gt)).toBeNull();
        expect(find_newer_rule_for_audit({ metadata: {} }, rules, v_gt)).toBeNull();
        expect(find_newer_rule_for_audit({ metadata: { version: '   ' } }, rules, v_gt)).toBeNull();
    });

    test('ruleSetId: returnerar nyare regel när servern är högre', () => {
        const ruleFileContent = { metadata: { version: '1.0.0' } };
        const rules = [
            { id: 'a', metadata_version: '0.9.0' },
            { id: 'target', metadata_version: '2.0.0' }
        ];
        const out = find_newer_rule_for_audit(ruleFileContent, rules, v_gt, 'target');
        expect(out).toEqual({ ruleId: 'target', version: '2.0.0' });
    });

    test('ruleSetId: returnerar null om regel saknas eller inte är nyare', () => {
        const rc = { metadata: { version: '1.0.0' } };
        expect(find_newer_rule_for_audit(rc, [{ id: 'x' }], v_gt, 'missing')).toBeNull();
        expect(
            find_newer_rule_for_audit(rc, [{ id: 'x', metadata_version: '0.5.0' }], v_gt, 'x')
        ).toBeNull();
    });

    test('utan ruleSetId: matchar på titel och väljer högsta nyare version', () => {
        const ruleFileContent = {
            metadata: {
                version: '1.0.0',
                title: 'Min regel',
                monitoringType: { text: 'Tillsyn A' }
            }
        };
        const rules = [
            {
                id: 'r1',
                name: 'annan',
                monitoring_type_text: 'Tillsyn A',
                metadata_version: '1.5.0'
            },
            {
                id: 'r2',
                name: 'Min regel',
                monitoring_type_text: 'x',
                metadata_version: '2.0.0'
            }
        ];
        const out = find_newer_rule_for_audit(ruleFileContent, rules, v_gt);
        expect(out).toEqual({ ruleId: 'r2', version: '2.0.0' });
    });

    test('utan ruleSetId: returnerar null om inga id:n kan matchas', () => {
        const rc = { metadata: { version: '1.0.0', title: 'Unik' } };
        const rules = [{ id: 'r', name: 'annan', metadata_version: '9.0.0' }];
        expect(find_newer_rule_for_audit(rc, rules, v_gt)).toBeNull();
    });
});
