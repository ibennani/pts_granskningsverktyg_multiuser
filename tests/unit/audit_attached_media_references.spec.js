/**
 * @fileoverview Tester för referensräkning och säker serverradering av bifogad media.
 */

import {
    collect_attached_media_filenames,
    filenames_safe_to_delete_from_server
} from '../../js/logic/audit_attached_media_references.js';

describe('audit_attached_media_references', () => {
    const state = {
        samples: [
            {
                id: 's1',
                attachedMediaFilenames: ['stickprov.png'],
                requirementResults: {
                    req1: {
                        checkResults: {
                            chk1: {
                                passCriteria: {
                                    pc1: { attachedMediaFilenames: ['kontroll.png', 'delad.png'] }
                                }
                            }
                        }
                    }
                }
            },
            {
                id: 's2',
                attachedMediaFilenames: ['annat.png'],
                requirementResults: {}
            }
        ]
    };

    test('collect_attached_media_filenames samlar stickprov och kontrollpunkter', () => {
        const refs = collect_attached_media_filenames(state);
        expect([...refs].sort()).toEqual(['annat.png', 'delad.png', 'kontroll.png', 'stickprov.png']);
    });

    test('override för kontrollpunkt uppdaterar referenser efter sparning', () => {
        const refs = collect_attached_media_filenames(state, {
            type: 'pc',
            sampleId: 's1',
            requirementId: 'req1',
            checkId: 'chk1',
            pcId: 'pc1',
            filenames: ['ny.png']
        });
        expect(refs.has('kontroll.png')).toBe(false);
        expect(refs.has('delad.png')).toBe(false);
        expect(refs.has('ny.png')).toBe(true);
        expect(refs.has('stickprov.png')).toBe(true);
    });

    test('filenames_safe_to_delete_from_server tar bara bort ej refererade filer', () => {
        const still = collect_attached_media_filenames(state, {
            type: 'pc',
            sampleId: 's1',
            requirementId: 'req1',
            checkId: 'chk1',
            pcId: 'pc1',
            filenames: []
        });
        const removed = ['kontroll.png', 'delad.png', 'saknas.png'];
        expect(filenames_safe_to_delete_from_server(removed, still).sort()).toEqual(
            ['delad.png', 'kontroll.png', 'saknas.png'].sort()
        );

        const still_with_shared = collect_attached_media_filenames(state, {
            type: 'pc',
            sampleId: 's1',
            requirementId: 'req1',
            checkId: 'chk1',
            pcId: 'pc1',
            filenames: ['delad.png']
        });
        expect(filenames_safe_to_delete_from_server(['kontroll.png', 'delad.png'], still_with_shared)).toEqual([
            'kontroll.png'
        ]);
    });
});
