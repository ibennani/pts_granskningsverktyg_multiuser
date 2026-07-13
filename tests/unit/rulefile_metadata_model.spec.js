import { describe, it, expect } from '@jest/globals';
import { clone_metadata, ensure_metadata_defaults } from '../../js/logic/rulefile_metadata_model.js';

describe('rulefile_metadata_model', () => {
    describe('clone_metadata', () => {
        it('klonar djupt så ändringar inte påverkar originalet', () => {
            const src = { a: { b: 1 } };
            const copy = clone_metadata(src);
            copy.a.b = 2;
            expect(src.a.b).toBe(1);
        });
        it('hanterar undefined som tomt objekt', () => {
            expect(clone_metadata(undefined)).toEqual({});
        });
    });

    describe('ensure_metadata_defaults', () => {
        it('sätter monitoringType och kanoniska platta vocabulary-fält', () => {
            const m = {};
            ensure_metadata_defaults(m);
            expect(m.monitoringType).toEqual({ type: '', text: '' });
            expect(Array.isArray(m.pageTypes)).toBe(true);
            expect(m.vocabularies).toBeUndefined();
        });
    });
});
