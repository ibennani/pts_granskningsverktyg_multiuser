import { describe, expect, test } from '@jest/globals';
import {
    count_attached_images,
    count_attached_media_places
} from '../../js/logic/audit_logic_problems_media.ts';

describe('audit_logic attached media counts', () => {
    test('count_attached_images räknar totalt antal filnamn, inte antal kontrollpunkter', () => {
        const state = {
            samples: [
                {
                    id: 's1',
                    requirementResults: {
                        req1: {
                            checkResults: {
                                c1: {
                                    passCriteria: {
                                        pc1: {
                                            attachedMediaFilenames: ['a.png', 'b.jpg']
                                        },
                                        pc2: {
                                            attachedMediaFilenames: ['c.mp4']
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        };

        expect(count_attached_images(state)).toBe(3);
        expect(count_attached_media_places(state)).toBe(2);
    });

    test('count_attached_images ignorerar tomma filnamn', () => {
        const state = {
            samples: [
                {
                    id: 's1',
                    requirementResults: {
                        req1: {
                            checkResults: {
                                c1: {
                                    passCriteria: {
                                        pc1: {
                                            attachedMediaFilenames: ['a.png', '  ', '', 'b.jpg']
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        };

        expect(count_attached_images(state)).toBe(2);
        expect(count_attached_media_places(state)).toBe(1);
    });
});
