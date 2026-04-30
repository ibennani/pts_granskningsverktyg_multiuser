/**
 * @fileoverview Tester för validering av requirements-sektion (objekt och array).
 */

import { describe, it, expect } from '@jest/globals';
import { validate_rulefile_requirements_section } from '../../js/logic/validation_rulefile_requirements.js';

const t = (key: string) => `t:${key}`;

describe('validate_rulefile_requirements_section', () => {
    it('underkänner ogiltig typ', () => {
        const r = validate_rulefile_requirements_section('nope', t);
        expect(r.isValid).toBe(false);
        expect(r.message).toContain('t:rule_file_requirements_must_be_object');
    });

    it('godkänner minimalt giltigt objekt', () => {
        const r = validate_rulefile_requirements_section(
            {
                k1: {
                    id: 'k1',
                    title: 'Rubrik',
                    checks: [
                        {
                            id: 'c1',
                            passCriteria: [{ id: 'p1' }]
                        }
                    ]
                }
            },
            t
        );
        expect(r.isValid).toBe(true);
    });

    it('godkänner array med samma struktur', () => {
        const r = validate_rulefile_requirements_section(
            [
                {
                    id: 'a1',
                    title: 'Från array'
                }
            ],
            t
        );
        expect(r.isValid).toBe(true);
    });

    it('underkänner tom array', () => {
        const r = validate_rulefile_requirements_section([], t);
        expect(r.isValid).toBe(false);
    });
});
