/**
 * Enhetstester för audit_settings_render.
 */
import { describe, test, expect } from '@jest/globals';
import {
    normalize_audit_settings_section,
    normalize_audit_settings_return_to,
    audit_settings_back_label_key,
} from '../../js/components/audit_settings_render.ts';

describe('audit_settings_render', () => {
    test('normalize_audit_settings_section accepterar information och summary', () => {
        expect(normalize_audit_settings_section('information')).toBe('information');
        expect(normalize_audit_settings_section('summary')).toBe('summary');
        expect(normalize_audit_settings_section(undefined)).toBe('');
        expect(normalize_audit_settings_section('invalid')).toBe('');
    });

    test('normalize_audit_settings_return_to accepterar overview och settings', () => {
        expect(normalize_audit_settings_return_to('overview')).toBe('overview');
        expect(normalize_audit_settings_return_to('settings')).toBe('settings');
        expect(normalize_audit_settings_return_to(undefined)).toBe('settings');
        expect(normalize_audit_settings_return_to('invalid')).toBe('settings');
    });

    test('audit_settings_back_label_key väljer rätt etikett', () => {
        expect(audit_settings_back_label_key('overview')).toBe('audit_settings_back_to_overview');
        expect(audit_settings_back_label_key('settings')).toBe('audit_settings_back_to_hub');
    });
});
