/**
 * @fileoverview Invariants: inbäddad ruleFileContent i granskningar ska inte strukturellt normaliseras.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from '@jest/globals';
import { validate_saved_audit_file } from '../../js/validation_logic.ts';
import { sanitize_persisted_app_state_shape } from '../../js/logic/sanitize_persisted_app_state.ts';
import { state_to_patch, state_to_import } from '../../js/sync/sync_payload_mapper.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const minimal_rule = JSON.parse(
    readFileSync(path.join(__dirname, '../fixtures/minimal-rulefile.json'), 'utf8')
);

function build_audit_with_duplicate_vocabularies() {
    const rule = JSON.parse(JSON.stringify(minimal_rule)) as Record<string, unknown>;
    const meta = rule.metadata as Record<string, unknown>;
    meta.vocabularies = {
        pageTypes: meta.pageTypes,
        contentTypes: meta.contentTypes,
        sampleTypes: meta.samples
    };
    return {
        ruleFileContent: rule,
        auditMetadata: { caseNumber: '', actorName: '' },
        auditStatus: 'not_started',
        samples: [],
        version: 1
    };
}

describe('audit_rulefile_snapshot_invariants', () => {
    it('state_to_patch skickar ruleFileContent oförändrad', () => {
        const state = build_audit_with_duplicate_vocabularies();
        const snapshot = JSON.stringify(state.ruleFileContent);
        const patch = state_to_patch(state);
        expect(JSON.stringify(patch.ruleFileContent)).toBe(snapshot);
    });

    it('state_to_import skickar ruleFileContent oförändrad', () => {
        const state = build_audit_with_duplicate_vocabularies();
        const snapshot = JSON.stringify(state.ruleFileContent);
        const payload = state_to_import(state);
        expect(JSON.stringify(payload.ruleFileContent)).toBe(snapshot);
    });

    it('validate_saved_audit_file muterar inte inbäddad regelfil', () => {
        const audit = build_audit_with_duplicate_vocabularies();
        const before = JSON.stringify(audit.ruleFileContent);
        const result = validate_saved_audit_file(audit);
        expect(result.isValid).toBe(true);
        expect(JSON.stringify(audit.ruleFileContent)).toBe(before);
    });

    it('sanitize_persisted_app_state_shape behåller vocabulary-dubletter i snapshot', () => {
        const state = build_audit_with_duplicate_vocabularies();
        const before = JSON.stringify(state.ruleFileContent);
        const sanitized = sanitize_persisted_app_state_shape(state as Record<string, unknown>);
        expect(JSON.stringify(sanitized.ruleFileContent)).toBe(before);
    });

    it('state_to_import inkluderar ruleSetId när den finns i state', () => {
        const state = {
            ...build_audit_with_duplicate_vocabularies(),
            ruleSetId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
        };
        const payload = state_to_import(state);
        expect(payload.ruleSetId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    });

    it('state_to_patch inkluderar ruleSetId när den finns i state', () => {
        const state = {
            ...build_audit_with_duplicate_vocabularies(),
            ruleSetId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
        };
        const patch = state_to_patch(state);
        expect(patch.ruleSetId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    });
});
