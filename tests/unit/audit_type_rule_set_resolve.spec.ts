/**
 * @file Enhetstester för härledning av regelfil vid granskningstyp-overlay.
 */
import {
    build_default_published_audit_types_content,
    pick_published_rule_row_by_monitoring_kind,
    read_rule_set_id_candidates,
    resolve_monitoring_kind_from_rule_content,
} from '../../shared/audit/audit_type_rule_set_resolve.js';
import { apply_audit_type_overlay_with_published } from '../../js/logic/audit_type_rule_overlay.js';

describe('audit_type_rule_set_resolve', () => {
    test('read_rule_set_id_candidates läser metadata.ruleSetId', () => {
        expect(
            read_rule_set_id_candidates(null, {
                metadata: { ruleSetId: 'old-id', monitoringType: { type: 'web' } },
            })
        ).toEqual(['old-id']);
    });

    test('resolve_monitoring_kind_from_rule_content känner igen webbplats', () => {
        expect(
            resolve_monitoring_kind_from_rule_content({
                metadata: { monitoringType: { text: 'Webbplats', type: 'web' } },
            })
        ).toBe('web');
    });

    test('pick_published_rule_row_by_monitoring_kind väljer webb-regelfil', () => {
        const match = pick_published_rule_row_by_monitoring_kind(
            [
                {
                    id: 'web-id',
                    name: 'PTS tillsynsregler för granskning av webbplatser',
                    is_published: true,
                    published_content: {},
                },
                {
                    id: 'pdf-id',
                    name: 'PTS marknadskontrollregler för granskning av PDF-dokument',
                    is_published: true,
                    published_content: {},
                },
            ],
            'web'
        );
        expect(match?.id).toBe('web-id');
    });

    test('legacy snapshot utan rule_set_id får typer via webb-match eller standard', () => {
        const legacy = {
            metadata: {
                monitoringType: { text: 'Webbplats', type: 'web' },
                title: 'PTS tillsynsregler för granskning av webbplatser',
            },
        };
        const published = {
            metadata: {
                auditTypes: [
                    { id: 'tillsyn-lptt', label: 'Tillsyn, LPTT', taxonomyId: 'wcag22-pour' },
                    {
                        id: 'marknadskontroll-lptt',
                        label: 'Marknadskontroll LPTT',
                        taxonomyId: 'fptt-bilaga-2',
                    },
                ],
            },
        };
        const effective = apply_audit_type_overlay_with_published(legacy, published) as {
            metadata: { auditTypes: unknown[] };
        };
        expect(effective.metadata.auditTypes).toHaveLength(2);

        const fallback = apply_audit_type_overlay_with_published(
            legacy,
            build_default_published_audit_types_content()
        ) as { metadata: { auditTypes: unknown[] } };
        expect(fallback.metadata.auditTypes).toHaveLength(2);
    });
});
