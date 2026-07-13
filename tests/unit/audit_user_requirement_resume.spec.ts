/**
 * @file Enhetstester för audit_user_requirement_resume.ts
 */
import { describe, test, expect } from '@jest/globals';
import {
    USER_LAST_REQUIREMENT_RESUME_METADATA_KEY,
    build_resume_metadata_patch,
    format_resume_local_timestamp,
    get_user_resume_from_metadata,
    is_valid_user_resume,
    normalize_resume_user_key,
    should_show_audit_overview_continue_button,
    user_name_exists_in_instance,
    without_user_last_requirement_resume_in_metadata
} from '../../js/logic/audit_user_requirement_resume.js';

function build_partial_progress_state() {
    return {
        auditStatus: 'in_progress',
        ruleFileContent: {
            metadata: {
                pageTypes: ['Startsida'],
                contentTypes: [{ id: 'text', text: 'Text', types: [{ id: 'plain', text: 'Plain' }] }],
                samples: { sampleTypes: ['Webbsida'] }
            },
            requirements: {
                req1: { id: 'req1', title: 'Krav 1' },
                req2: { id: 'req2', title: 'Krav 2' }
            }
        },
        samples: [
            {
                id: 's1',
                sampleType: 'Webbsida',
                pageType: 'Startsida',
                requirementResults: {
                    req1: { status: 'passed', checks: {}, passCriteria: {} }
                }
            }
        ]
    };
}

describe('audit_user_requirement_resume', () => {
    test('normalize_resume_user_key trimmar och lowercasar', () => {
        expect(normalize_resume_user_key('  Anna Andersson ')).toBe('anna andersson');
    });

    test('format_resume_local_timestamp ger datum och HH:mm:ss', () => {
        const ts = format_resume_local_timestamp('2026-01-15T08:30:45.000Z');
        expect(ts.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(ts.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        expect(ts.iso).toBeTruthy();
    });

    test('build_resume_metadata_patch sparar namn, datum, tid och focusInfo per användare', () => {
        const meta = build_resume_metadata_patch(
            {},
            'Anna Andersson',
            's1',
            'req1',
            { elementId: 'obs-1' },
            '2026-07-13T10:00:00.000Z'
        );
        const map = meta[USER_LAST_REQUIREMENT_RESUME_METADATA_KEY] as Record<string, Record<string, unknown>>;
        const entry = map['anna andersson'];
        expect(entry.displayUserName).toBe('Anna Andersson');
        expect(entry.sampleId).toBe('s1');
        expect(entry.requirementId).toBe('req1');
        expect(entry.focusInfo).toEqual({ elementId: 'obs-1' });
        expect(entry.lastUpdatedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entry.lastUpdatedTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    test('två användare i samma metadata skriver inte över varandra', () => {
        let meta = build_resume_metadata_patch({}, 'Anna', 's1', 'req1', { elementId: 'a' });
        meta = build_resume_metadata_patch(meta, 'Bo', 's1', 'req2', { elementId: 'b' });
        expect(get_user_resume_from_metadata(meta, 'Anna')?.requirementId).toBe('req1');
        expect(get_user_resume_from_metadata(meta, 'Bo')?.requirementId).toBe('req2');
    });

    test('without_user_last_requirement_resume_in_metadata tar bort kartan', () => {
        const meta = build_resume_metadata_patch({}, 'Anna', 's1', 'req1', { elementId: 'x' });
        const cleared = without_user_last_requirement_resume_in_metadata(meta);
        expect(cleared[USER_LAST_REQUIREMENT_RESUME_METADATA_KEY]).toBeUndefined();
    });

    test('user_name_exists_in_instance matchar normaliserat namn', () => {
        expect(user_name_exists_in_instance('Anna', [{ name: 'Anna' }])).toBe(true);
        expect(user_name_exists_in_instance('Anna', [{ name: 'Bo' }])).toBe(false);
    });

    test('should_show_audit_overview_continue_button vid delvis progress och giltig resume', () => {
        const state = build_partial_progress_state();
        const meta = build_resume_metadata_patch(
            {},
            'Anna',
            's1',
            'req1',
            { elementName: 'f1' }
        );
        state.auditMetadata = meta;
        const users = [{ name: 'Anna' }];
        expect(should_show_audit_overview_continue_button(state, 'Anna', users)).toBe(true);
    });

    test('should_show_audit_overview_continue_button dold vid 0 % progress', () => {
        const state = {
            auditStatus: 'in_progress',
            ruleFileContent: build_partial_progress_state().ruleFileContent,
            samples: [
                {
                    id: 's1',
                    sampleType: 'Webbsida',
                    pageType: 'Startsida',
                    requirementResults: {}
                }
            ],
            auditMetadata: build_resume_metadata_patch({}, 'Anna', 's1', 'req1', { elementId: 'x' })
        };
        expect(should_show_audit_overview_continue_button(state, 'Anna', [{ name: 'Anna' }])).toBe(false);
    });

    test('should_show dold om användare saknas i instansen', () => {
        const state = build_partial_progress_state();
        state.auditMetadata = build_resume_metadata_patch({}, 'Anna', 's1', 'req1', { elementId: 'x' });
        expect(should_show_audit_overview_continue_button(state, 'Anna', [{ name: 'Bo' }])).toBe(false);
    });

    test('is_valid_user_resume false om granskningsdel saknas', () => {
        const state = build_partial_progress_state();
        const resume = get_user_resume_from_metadata(
            build_resume_metadata_patch({}, 'Anna', 's-missing', 'req1', { elementId: 'x' }),
            'Anna'
        );
        expect(resume).toBeTruthy();
        expect(is_valid_user_resume(state, resume!)).toBe(false);
    });
});
