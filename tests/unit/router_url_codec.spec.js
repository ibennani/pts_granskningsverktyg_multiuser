/**
 * Tester för router_url_codec.js
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_compact_hash_fragment,
    compact_param_keys_for_hash,
    expand_view_slug_from_hash,
    normalize_params_from_hash_query,
    resolve_legacy_audit_settings_route
} from '../../js/logic/router_url_codec.js';

describe('router_url_codec', () => {
    test('expand_view_slug_from_hash mappar korta koder till kanoniska vyer', () => {
        expect(expand_view_slug_from_hash('ra')).toBe('requirement_audit');
        expect(expand_view_slug_from_hash('ov')).toBe('audit_overview');
        expect(expand_view_slug_from_hash('audit')).toBe('audit');
        expect(expand_view_slug_from_hash('as')).toBe('audit_settings');
    });

    test('resolve_legacy_audit_settings_route mappar till Åtgärder', () => {
        expect(resolve_legacy_audit_settings_route('audit_settings', { section: 'information' })).toEqual({
            viewName: 'audit_actions',
            params: { section: 'information' },
        });
        expect(resolve_legacy_audit_settings_route('audit_settings', { section: 'summary' })).toEqual({
            viewName: 'audit_actions',
            params: { section: 'appendix_templates', appendix: '1', edit: 'true' },
        });
        expect(resolve_legacy_audit_settings_route('audit_overview', { foo: 'bar' })).toEqual({
            viewName: 'audit_overview',
            params: { foo: 'bar' },
        });
    });

    test('build_compact_hash_fragment stöder audit_settings section', () => {
        expect(build_compact_hash_fragment('audit_settings', { section: 'summary' })).toBe('as?section=summary');
    });

    test('normalize_params_from_hash_query expanderar a, s, r', () => {
        expect(normalize_params_from_hash_query({ a: '1', s: '2', r: '3' })).toEqual({
            auditId: '1',
            sampleId: '2',
            requirementId: '3'
        });
    });

    test('compact_param_keys_for_hash använder korta nycklar för id-fält', () => {
        expect(compact_param_keys_for_hash({ auditId: '9', caseNumber: 'x' })).toEqual({
            a: '9',
            caseNumber: 'x'
        });
    });

    test('build_compact_hash_fragment kombinerar kort vy och parametrar', () => {
        expect(build_compact_hash_fragment('requirement_audit', {
            auditId: '1',
            sampleId: 's',
            requirementId: 'r1'
        })).toBe('ra?a=1&s=s&r=r1');
    });
});
