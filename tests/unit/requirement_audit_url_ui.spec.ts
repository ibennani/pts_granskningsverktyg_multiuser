/**
 * Tester för kravgranskningens sidomeny i URL-parametrar.
 */
import { describe, test, expect } from '@jest/globals';
import {
    default_requirement_audit_sidebar_like,
    requirement_audit_sidebar_settings_to_url_params,
    url_params_to_requirement_audit_sidebar_patch,
    merge_requirement_audit_sidebar_patch,
    REQUIREMENT_AUDIT_URL_SEARCH_MAX_LEN,
    strip_requirement_audit_ui_keys,
    REQUIREMENT_AUDIT_URL_KEYS,
    status_object_to_mask,
    mask_to_status_object
} from '../../js/logic/requirement_audit_url_ui.js';

describe('requirement_audit_url_ui', () => {
    test('standardinställningar ger tomma URL-parametrar', () => {
        const defs = default_requirement_audit_sidebar_like();
        expect(requirement_audit_sidebar_settings_to_url_params(defs)).toEqual({});
    });

    test('roundtrip för läge och sortering sample_requirements', () => {
        const base = default_requirement_audit_sidebar_like();
        const custom = JSON.parse(JSON.stringify(base));
        custom.selectedMode = 'sample_requirements';
        custom.filtersByMode.sample_requirements.sortBy = 'title_desc';
        custom.filtersByMode.sample_requirements.searchText = '  x  ';
        const flat = requirement_audit_sidebar_settings_to_url_params(custom);
        expect(flat[REQUIREMENT_AUDIT_URL_KEYS.MODE]).toBe('sr');
        expect(flat[REQUIREMENT_AUDIT_URL_KEYS.SORT_SR]).toBe('title_desc');
        expect(flat[REQUIREMENT_AUDIT_URL_KEYS.SEARCH_SR]).toBe('x');
        const patch = url_params_to_requirement_audit_sidebar_patch(flat);
        expect(patch).toBeTruthy();
        const merged = merge_requirement_audit_sidebar_patch(base, patch);
        expect(merged.selectedMode).toBe('sample_requirements');
        expect(merged.filtersByMode.sample_requirements.sortBy).toBe('title_desc');
        expect(merged.filtersByMode.sample_requirements.searchText).toBe('x');
    });

    test('status-mask packas och läses', () => {
        const status = mask_to_status_object(0);
        expect(status.needs_help).toBe(false);
        const all_true = JSON.parse(JSON.stringify(default_requirement_audit_sidebar_like())).filtersByMode
            .sample_requirements
            .status;
        const m = status_object_to_mask(all_true);
        expect(m).toBe(63);
    });

    test('truncate lång söktext', () => {
        const long = 'å'.repeat(REQUIREMENT_AUDIT_URL_SEARCH_MAX_LEN + 10);
        const base = JSON.parse(JSON.stringify(default_requirement_audit_sidebar_like()));
        base.filtersByMode.requirement_samples.searchText = long;
        const flat = requirement_audit_sidebar_settings_to_url_params(base);
        expect(flat[REQUIREMENT_AUDIT_URL_KEYS.SEARCH_RS]?.length).toBe(REQUIREMENT_AUDIT_URL_SEARCH_MAX_LEN);
    });

    test('strip_requirement_audit_ui_keys tar bort ras-nycklar', () => {
        const rec = strip_requirement_audit_ui_keys({
            auditId: '1',
            [REQUIREMENT_AUDIT_URL_KEYS.MODE]: 'sr'
        });
        expect(rec.rasM).toBeUndefined();
        expect(rec.auditId).toBe('1');
    });
});
