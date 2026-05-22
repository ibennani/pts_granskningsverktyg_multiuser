import { describe, test, expect } from '@jest/globals';
import {
    build_audit_images_view_fingerprint,
    build_audit_images_structure_fingerprint
} from '../../js/logic/audit_images_view_incremental.js';

describe('audit_images_view_incremental', () => {
    test('innehållsfingerprint ändras när filnamn ändras', () => {
        const base = [{
            reqId: 'req-1',
            sample: { id: 's1' },
            checkId: 'c1',
            pcId: 'pc1',
            filename: 'a.png'
        }];
        const changed = [{ ...base[0], filename: 'b.png' }];
        expect(build_audit_images_view_fingerprint(base)).not.toBe(build_audit_images_view_fingerprint(changed));
    });

    test('strukturfingerprint oförändrat när bara filnamn ändras', () => {
        const base = [{
            reqId: 'req-1',
            sample: { id: 's1' },
            checkId: 'c1',
            pcId: 'pc1',
            filename: 'a.png'
        }];
        const changed = [{ ...base[0], filename: 'b.png' }];
        expect(build_audit_images_structure_fingerprint(base)).toBe(build_audit_images_structure_fingerprint(changed));
    });

    test('strukturfingerprint ändras när kort läggs till', () => {
        const one = [{
            reqId: 'req-1',
            sample: { id: 's1' },
            checkId: 'c1',
            pcId: 'pc1',
            filename: 'a.png'
        }];
        const two = [
            ...one,
            {
                reqId: 'req-2',
                sample: { id: 's2' },
                checkId: 'c2',
                pcId: 'pc2',
                filename: 'x.jpg'
            }
        ];
        expect(build_audit_images_structure_fingerprint(one)).not.toBe(build_audit_images_structure_fingerprint(two));
    });
});
