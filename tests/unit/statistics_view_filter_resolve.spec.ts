/**
 * @fileoverview Enhetstester för filterupplösning i statistikvyn.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { StatisticsViewComponent } from '../../js/components/StatisticsViewComponent.js';

function monitoring_entry_with_audit_types(audit_keys: string[]) {
    const per_audit_type: Record<string, { completed_count: number }> = {};
    audit_keys.forEach((k) => {
        per_audit_type[k] = { completed_count: 1 };
    });
    return {
        audit_type_labels_ordered: audit_keys,
        per_audit_type
    };
}

describe('StatisticsViewComponent filter resolve', () => {
    let component: StatisticsViewComponent;

    beforeEach(() => {
        component = new StatisticsViewComponent();
    });

    describe('_resolve_monitoring_slice', () => {
        it('väljer automatiskt enda regelfilstypen när inget filter anges', () => {
            const year_raw = {
                monitoring_type_labels_ordered: ['Webb'],
                per_monitoring_type: {
                    Webb: monitoring_entry_with_audit_types(['Fullständig'])
                }
            };

            const result = component._resolve_monitoring_slice(year_raw, {});

            expect(result.labels_with_data).toEqual(['Webb']);
            expect(result.selected_monitoring_key).toBe('Webb');
            expect(result.monitoring_entry).toBe(year_raw.per_monitoring_type.Webb);
        });

        it('lämnar tomt val när flera regelfilstyper finns och inget filter anges', () => {
            const year_raw = {
                monitoring_type_labels_ordered: ['Webb', 'App'],
                per_monitoring_type: {
                    Webb: monitoring_entry_with_audit_types(['Fullständig']),
                    App: monitoring_entry_with_audit_types(['Förenklad'])
                }
            };

            const result = component._resolve_monitoring_slice(year_raw, {});

            expect(result.selected_monitoring_key).toBe('');
            expect(result.monitoring_entry).toBeNull();
        });

        it('använder angiven monitoringType när den finns bland alternativen', () => {
            const year_raw = {
                monitoring_type_labels_ordered: ['Webb', 'App'],
                per_monitoring_type: {
                    Webb: monitoring_entry_with_audit_types(['Fullständig']),
                    App: monitoring_entry_with_audit_types(['Förenklad'])
                }
            };

            const result = component._resolve_monitoring_slice(year_raw, { monitoringType: 'App' });

            expect(result.selected_monitoring_key).toBe('App');
            expect(result.monitoring_entry).toBe(year_raw.per_monitoring_type.App);
        });
    });

    describe('_resolve_audit_type_slice', () => {
        it('väljer automatiskt enda granskningstypen när inget filter anges', () => {
            const monitoring_entry = monitoring_entry_with_audit_types(['Fullständig']);

            const result = component._resolve_audit_type_slice(monitoring_entry, {});

            expect(result.labels_with_data).toEqual(['Fullständig']);
            expect(result.selected_audit_type_key).toBe('Fullständig');
            expect(result.year_data).toBe(monitoring_entry.per_audit_type['Fullständig']);
        });

        it('lämnar tomt val när flera granskningstyper finns och inget filter anges', () => {
            const monitoring_entry = monitoring_entry_with_audit_types(['Fullständig', 'Förenklad']);

            const result = component._resolve_audit_type_slice(monitoring_entry, {});

            expect(result.selected_audit_type_key).toBe('');
            expect(result.year_data).toBeNull();
        });

        it('använder angiven auditType när den finns bland alternativen', () => {
            const monitoring_entry = monitoring_entry_with_audit_types(['Fullständig', 'Förenklad']);

            const result = component._resolve_audit_type_slice(monitoring_entry, { auditType: 'Förenklad' });

            expect(result.selected_audit_type_key).toBe('Förenklad');
            expect(result.year_data).toBe(monitoring_entry.per_audit_type.Förenklad);
        });
    });

    describe('slice_ready-scenario', () => {
        it('är redo direkt när båda filtren har ett alternativ vardera', () => {
            const year_raw = {
                monitoring_type_labels_ordered: ['Webb'],
                per_monitoring_type: {
                    Webb: monitoring_entry_with_audit_types(['Fullständig'])
                }
            };

            const monitoring_resolved = component._resolve_monitoring_slice(year_raw, {});
            const audit_resolved = component._resolve_audit_type_slice(
                monitoring_resolved.monitoring_entry,
                {}
            );

            const slice_ready =
                Boolean(monitoring_resolved.selected_monitoring_key) &&
                Boolean(audit_resolved.selected_audit_type_key) &&
                audit_resolved.year_data;

            expect(slice_ready).toBeTruthy();
        });
    });
});
