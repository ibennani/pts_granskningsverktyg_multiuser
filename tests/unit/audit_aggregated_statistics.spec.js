/**
 * Tester för server/audit_aggregated_statistics.js
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_statistics_from_audit_rows,
    calendar_year_completed,
    duration_weeks_for_audit,
    requirement_stats_display_name,
    collapse_bilingual_requirement_title,
    get_monitoring_type_label,
    requirement_number_sort_key_for_stats,
    MONITORING_LABEL_FALLBACK_SENTINEL
} from '../../server/audit_aggregated_statistics.js';

describe('audit_aggregated_statistics', () => {
    test('calendar_year_completed använder metadata.endTime', () => {
        expect(calendar_year_completed({
            metadata: { endTime: '2024-06-15T12:00:00.000Z' },
            updated_at: new Date('2023-01-01')
        })).toBe(2024);
    });

    test('duration_weeks_for_audit räknar veckor mellan start och slut', () => {
        const w = duration_weeks_for_audit({
            metadata: {
                startTime: '2024-01-01T00:00:00.000Z',
                endTime: '2024-01-29T00:00:00.000Z'
            },
            created_at: new Date('2020-01-01'),
            updated_at: new Date('2024-02-01')
        });
        expect(w).not.toBeNull();
        expect(w).toBeGreaterThan(3.9);
        expect(w).toBeLessThan(4.1);
    });

    test('requirement_stats_display_name visar standardReference före titel', () => {
        const req = {
            key: 'krav_8639b1f4_b775_4075_b3f9_bc723f5d2806',
            title: 'Tillräckligt med tid',
            standardReference: { text: '9.2.2.1' }
        };
        expect(requirement_stats_display_name(req)).toBe('9.2.2.1 Tillräckligt med tid');
    });

    test('requirement_stats_display_name visar standardReference före titel även när nyckel redan är en referens', () => {
        const req = {
            key: '9.2.4.11',
            title: 'Fokus inte dolt',
            standardReference: { text: '9.2.4.11' }
        };
        expect(requirement_stats_display_name(req)).toBe('9.2.4.11 Fokus inte dolt');
    });

    test('collapse_bilingual_requirement_title tar bort engelsk prefix före Information och', () => {
        const raw = 'Info and Relationships Information och relationer för rubriker';
        expect(collapse_bilingual_requirement_title(raw)).toBe('Information och relationer för rubriker');
    });

    test('collapse_bilingual_requirement_title tar bort engelsk WCAG-text före Tre …', () => {
        const raw = 'Three Flashes or Below Threshold Tre blinkningar eller under tröskelvärdet';
        expect(collapse_bilingual_requirement_title(raw)).toBe(
            'Tre blinkningar eller under tröskelvärdet'
        );
    });

    test('collapse_bilingual_requirement_title tar bort engelsk WCAG-text före Ledtexter …', () => {
        const raw = 'Labels or Instructions Ledtexter, instruktioner';
        expect(collapse_bilingual_requirement_title(raw)).toBe('Ledtexter, instruktioner');
    });

    test('requirement_stats_display_name behåller hela titeln som del 2 (ingen kollaps)', () => {
        const req = {
            key: 'krav_x',
            title: 'Info and Relationships Information och relationer för rubriker',
            standardReference: { text: '9.1.3.1' }
        };
        expect(requirement_stats_display_name(req)).toBe(
            '9.1.3.1 Info and Relationships Information och relationer för rubriker'
        );
    });

    test('requirement_stats_display_name behåller dubbelspråkig titel för 9.2.3.1', () => {
        const req = {
            key: 'krav_x',
            title: 'Three Flashes or Below Threshold Tre blinkningar eller under tröskelvärdet',
            standardReference: { text: '9.2.3.1' }
        };
        expect(requirement_stats_display_name(req)).toBe(
            '9.2.3.1 Three Flashes or Below Threshold Tre blinkningar eller under tröskelvärdet'
        );
    });

    test('requirement_stats_display_name behåller engelsk+svensk titel för 9.3.3.2', () => {
        const req = {
            key: 'krav_x',
            title: 'Labels or Instructions Ledtexter, instruktioner',
            standardReference: { text: '9.3.3.2' }
        };
        expect(requirement_stats_display_name(req)).toBe(
            '9.3.3.2 Labels or Instructions Ledtexter, instruktioner'
        );
    });

    test('requirement_stats_display_name tar bara inledande siffror ur standardReference.text', () => {
        const req = {
            key: 'krav_x',
            title: 'Hantera enbart med tangentbord.',
            standardReference: { text: '9.2.1.1 Keyboard' }
        };
        expect(requirement_stats_display_name(req)).toBe(
            '9.2.1.1 Hantera enbart med tangentbord.'
        );
    });

    test('get_monitoring_type_label läser monitoringType.text', () => {
        expect(get_monitoring_type_label({
            metadata: { monitoringType: { text: 'Webbsida', type: 'web' } }
        })).toBe('Webbsida');
    });

    test('get_monitoring_type_label utan metadata ger sentinel', () => {
        expect(get_monitoring_type_label({})).toBe(MONITORING_LABEL_FALLBACK_SENTINEL);
    });

    test('requirement_number_sort_key_for_stats använder standardReference före nyckel', () => {
        expect(
            requirement_number_sort_key_for_stats(
                { key: 'krav_x', standardReference: { text: '9.2.2.1' } },
                'krav_x'
            )
        ).toBe('9.2.2.1');
        expect(
            requirement_number_sort_key_for_stats({ key: '9.1.1.1', standardReference: {} }, 'x')
        ).toBe('9.1.1.1');
        expect(
            requirement_number_sort_key_for_stats(
                { key: 'krav_x', standardReference: { text: '9.2.1.1 Keyboard' } },
                'krav_x'
            )
        ).toBe('9.2.1.1');
    });

    test('build_statistics_from_audit_rows grupperar per år och per regelfilstyp', () => {
        const rule_web = {
            metadata: { monitoringType: { text: 'Webbsida' } },
            requirements: {
                a: {
                    key: '9.2.2.1',
                    title: 'Tillräckligt med tid',
                    standardReference: { text: '9.2.2.1' },
                    checks: []
                }
            }
        };
        const samples_fail = [{
            id: 's1',
            selectedContentTypes: [],
            requirementResults: {
                '9.2.2.1': { status: 'failed', checkResults: {} }
            }
        }];
        const rows = [
            {
                metadata: { startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-29T00:00:00.000Z' },
                samples: samples_fail,
                rule_file_content: rule_web,
                created_at: new Date('2024-01-01'),
                updated_at: new Date('2024-02-01')
            },
            {
                metadata: { startTime: '2024-02-01T00:00:00.000Z', endTime: '2024-03-01T00:00:00.000Z' },
                samples: samples_fail,
                rule_file_content: rule_web,
                created_at: new Date('2024-02-01'),
                updated_at: new Date('2024-03-01')
            }
        ];
        const out = build_statistics_from_audit_rows(rows);
        expect(out.available_years).toEqual([2024]);
        const y2024 = out.per_year['2024'];
        expect(y2024.completed_count).toBe(2);
        expect(y2024.median_duration_weeks).toBeGreaterThan(0);
        expect(Array.isArray(y2024.monitoring_type_top_failed)).toBe(true);
        const web = y2024.monitoring_type_top_failed.find((s) => s.monitoring_type_label === 'Webbsida');
        expect(web).toBeTruthy();
        expect(web.audits_in_type).toBe(2);
        expect(web.top_requirements[0].requirement_name).toBe('9.2.2.1 Tillräckligt med tid');
        expect(web.top_requirements[0].audit_fail_rate_percent).toBe(100);

        const pmd = y2024.principle_median_deficiency;
        expect(pmd).toBeDefined();
        expect(pmd.perceivable).toBe(0);
        expect(pmd.operable).toBe(0);
        expect(pmd.understandable).toBe(0);
        expect(pmd.robust).toBe(0);
        expect(y2024.total_median_deficiency).toBe(0);
        expect(y2024.median_sample_count).toBe(1);
        expect(y2024.worst_sample_type).toBeNull();
    });

    test('build_statistics_from_audit_rows hittar stickprovstyp med högst bristindex', () => {
        const rule_web = {
            metadata: { monitoringType: { text: 'Webbsida' } },
            requirements: {
                r1: {
                    key: 'k1',
                    title: 'Krav 1',
                    metadata: { impact: { isCritical: true, primaryScore: 4, secondaryScore: 0 } },
                    checks: []
                }
            }
        };

        const sample_bad = {
            id: 's_bad',
            sampleCategory: 'cat1',
            sampleType: 'type_bad',
            selectedContentTypes: [],
            requirementResults: {
                k1: {
                    checkResults: {
                        c1: {
                            overallStatus: 'passed',
                            passCriteria: {
                                pc1: { status: 'failed' }
                            }
                        }
                    }
                }
            }
        };
        const sample_good = {
            id: 's_good',
            sampleCategory: 'cat1',
            sampleType: 'type_good',
            selectedContentTypes: [],
            requirementResults: {
                k1: { checkResults: {} }
            }
        };

        const out = build_statistics_from_audit_rows([
            {
                metadata: { endTime: '2024-01-01T00:00:00.000Z' },
                samples: [sample_bad, sample_good],
                rule_file_content: rule_web,
                updated_at: new Date('2024-01-02')
            }
        ]);
        const y2024 = out.per_year['2024'];
        expect(y2024.median_sample_count).toBe(2);
        expect(y2024.worst_sample_type).toEqual({
            sample_type: 'type_bad',
            sample_type_label: 'type_bad',
            median_deficiency: 100
        });
    });

    test('sampleType-id mappas till text i worst_sample_type och diagram per regelfilstyp', () => {
        const rule_web = {
            metadata: {
                monitoringType: { text: 'Webbsida' },
                samples: {
                    sampleCategories: [{
                        id: 'cat1',
                        text: 'Kategori 1',
                        categories: [
                            { id: 'sokresultatsida', text: 'Sökresultat' }
                        ]
                    }]
                }
            },
            requirements: {
                r1: {
                    key: 'k1',
                    title: 'Krav 1',
                    metadata: { impact: { isCritical: true, primaryScore: 4, secondaryScore: 0 } },
                    checks: []
                }
            }
        };
        const sample = {
            id: 's1',
            sampleCategory: 'cat1',
            sampleType: 'sokresultatsida',
            selectedContentTypes: [],
            requirementResults: {
                k1: {
                    checkResults: {
                        c1: {
                            overallStatus: 'passed',
                            passCriteria: { pc1: { status: 'failed' } }
                        }
                    }
                }
            }
        };
        const out = build_statistics_from_audit_rows([{
            metadata: { endTime: '2024-01-01T00:00:00.000Z' },
            samples: [sample],
            rule_file_content: rule_web,
            updated_at: new Date('2024-01-02')
        }]);
        const y2024 = out.per_year['2024'];
        expect(y2024.worst_sample_type.sample_type_label).toBe('Sökresultat');
        expect(Array.isArray(y2024.monitoring_sampletype_chart)).toBe(true);
        expect(y2024.monitoring_sampletype_chart[0].monitoring_type_label).toBe('Webbsida');
        expect(y2024.monitoring_sampletype_chart[0].sample_types[0]).toMatchObject({
            sample_type_id: 'sokresultatsida',
            sample_type_label: 'Sökresultat',
            median_deficiency: 100
        });
    });
});
