/**
 * @fileoverview Tester för validate_saved_audit_file (sparad granskning + inbäddad regelfil).
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from '@jest/globals';
import { validate_saved_audit_file } from '../../js/validation_logic.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const minimal_rule = JSON.parse(
    readFileSync(path.join(__dirname, '../fixtures/minimal-rulefile.json'), 'utf8')
);

function build_valid_audit() {
    return {
        ruleFileContent: minimal_rule,
        auditMetadata: { caseNumber: '', actorName: '' },
        auditStatus: 'not_started',
        samples: []
    };
}

describe('validate_saved_audit_file', () => {
    it('godkänner giltig sparad granskning med full regelfil', () => {
        const r = validate_saved_audit_file(build_valid_audit());
        expect(r.isValid).toBe(true);
        expect(r.message).toContain('saved_audit_validation_ok');
    });

    it('underkänner saknade toppfält', () => {
        const r = validate_saved_audit_file({
            auditMetadata: {},
            auditStatus: 'x',
            samples: []
        });
        expect(r.isValid).toBe(false);
        expect(r.message).toContain('error_saved_audit_missing_keys');
    });

    it('underkänner när samples inte är en array', () => {
        const bad = build_valid_audit();
        (bad as Record<string, unknown>).samples = {};
        const r = validate_saved_audit_file(bad);
        expect(r.isValid).toBe(false);
        expect(r.message).toContain('error_saved_audit_samples_not_array');
    });

    it('underkänner när auditStatus inte är sträng', () => {
        const bad = build_valid_audit();
        (bad as Record<string, unknown>).auditStatus = 1;
        const r = validate_saved_audit_file(bad);
        expect(r.isValid).toBe(false);
        expect(r.message).toContain('error_saved_audit_status_not_string');
    });

    it('underkänner trasig inbäddad regelfil med tydlig detalj', () => {
        const bad = build_valid_audit();
        const rf = { ...(bad.ruleFileContent as object), metadata: { title: '' } } as Record<string, unknown>;
        (bad as Record<string, unknown>).ruleFileContent = rf;
        const r = validate_saved_audit_file(bad);
        expect(r.isValid).toBe(false);
        expect(r.message).toContain('error_saved_audit_embedded_rulefile_invalid');
    });
});
