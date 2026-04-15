import { describe, test, expect } from '@jest/globals';
import {
    make_requirement_part_key,
    make_infoblock_text_part_key,
    parse_part_key
} from '../../js/logic/rulefile_part_keys.js';

describe('rulefile_part_keys', () => {
    test('bygger och tolkar infoblock-nyckel', () => {
        const pk = make_infoblock_text_part_key('req-1', 'tips');
        expect(pk).toBe('req:req-1:infoBlocks:tips:text');
        expect(parse_part_key(pk)).toEqual({ kind: 'infoblock_text', requirement_key: 'req-1', block_id: 'tips' });
    });

    test('tolkar requirement-del', () => {
        const pk = make_requirement_part_key('abc');
        expect(pk).toBe('req:abc');
        expect(parse_part_key(pk)).toEqual({ kind: 'req', requirement_key: 'abc' });
    });

    test('metadata/reportTemplate', () => {
        expect(parse_part_key('metadata')).toEqual({ kind: 'metadata' });
        expect(parse_part_key('reportTemplate')).toEqual({ kind: 'reportTemplate' });
    });

    test('ogiltiga format ger null', () => {
        expect(parse_part_key('')).toBeNull();
        expect(parse_part_key('req:')).toBeNull();
        expect(parse_part_key('req:a:infoBlocks::text')).toBeNull();
        expect(parse_part_key('req:a:infoBlocks:x:other')).toBeNull();
        expect(parse_part_key('something')).toBeNull();
    });
});

