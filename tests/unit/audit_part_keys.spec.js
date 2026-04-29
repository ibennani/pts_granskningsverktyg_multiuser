import { describe, test, expect } from '@jest/globals';
import {
    make_requirement_text_part_key,
    make_observation_detail_part_key,
    parse_audit_part_key
} from '../../shared/audit/audit_part_keys.js';

describe('audit_part_keys', () => {
    test('bygger och tolkar req_text', () => {
        const pk = make_requirement_text_part_key('a1', 's1', 'r1', 'commentToAuditor');
        expect(pk).toBe('audit:a1:sample:s1:req:r1:commentToAuditor');
        expect(parse_audit_part_key(pk)).toEqual({
            kind: 'req_text',
            audit_id: 'a1',
            sample_id: 's1',
            requirement_id: 'r1',
            field: 'commentToAuditor'
        });
    });

    test('bygger och tolkar observationDetail', () => {
        const pk = make_observation_detail_part_key('a1', 's1', 'r1', 'c1', 'p1');
        expect(pk).toBe('audit:a1:sample:s1:req:r1:check:c1:pc:p1:observationDetail');
        expect(parse_audit_part_key(pk)).toEqual({
            kind: 'observation_detail',
            audit_id: 'a1',
            sample_id: 's1',
            requirement_id: 'r1',
            check_id: 'c1',
            pc_id: 'p1'
        });
    });

    test('ogiltiga ger null', () => {
        expect(parse_audit_part_key('')).toBeNull();
        expect(parse_audit_part_key('audit:')).toBeNull();
        expect(parse_audit_part_key('audit:a:sample:s:req:r:commentToAuditor:extra')).toBeNull();
        expect(parse_audit_part_key('audit:a:sample:s:req:r:commentToSomeone')).toBeNull();
        expect(parse_audit_part_key('audit:a:sample:s:req:r:check:c:pc:p:other')).toBeNull();
    });
});

