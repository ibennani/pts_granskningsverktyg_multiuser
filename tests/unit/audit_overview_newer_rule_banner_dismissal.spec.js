/**
 * Tester för audit_overview_newer_rule_banner_dismissal.js
 */
import { describe, test, expect } from '@jest/globals';
import {
    newer_rule_banner_dismissal_storage_key,
    should_show_newer_rule_banner
} from '../../js/logic/audit_overview_newer_rule_banner_dismissal.js';

describe('audit_overview_newer_rule_banner_dismissal', () => {
    test('newer_rule_banner_dismissal_storage_key använder auditId och ruleSetId', () => {
        expect(newer_rule_banner_dismissal_storage_key('a1', 'r9')).toBe(
            'auditOverviewNewerRuleDismissed:a1:r9'
        );
    });

    test('newer_rule_banner_dismissal_storage_key faller tillbaka utan id', () => {
        expect(newer_rule_banner_dismissal_storage_key(undefined, undefined)).toBe(
            'auditOverviewNewerRuleDismissed:local:none'
        );
    });

    test('should_show_newer_rule_banner true utan sparad version', () => {
        expect(should_show_newer_rule_banner('2026.3.r2', null)).toBe(true);
        expect(should_show_newer_rule_banner('2026.3.r2', '')).toBe(true);
    });

    test('should_show_newer_rule_banner false utan erbjuden version', () => {
        expect(should_show_newer_rule_banner('', null)).toBe(false);
    });

    test('should_show_newer_rule_banner false om samma version som avvisad', () => {
        expect(should_show_newer_rule_banner('2026.3.r2', '2026.3.r2')).toBe(false);
    });

    test('should_show_newer_rule_banner true om erbjuden version är högre än avvisad', () => {
        expect(should_show_newer_rule_banner('2026.4.r1', '2026.3.r2')).toBe(true);
    });
});
