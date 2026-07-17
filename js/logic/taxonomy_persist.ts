/**
 * @fileoverview Id-generering och normalisering för taxonomier vid sparning.
 */

export type TaxonomyConceptPersist = { id?: string; label?: string; appendix1Intro?: string };
export type TaxonomyEntryPersist = {
    id?: string;
    label?: string;
    version?: string;
    uri?: string;
    concepts?: TaxonomyConceptPersist[];
};

export function slug_from_label(label: string, fallback: string): string {
    const slug = label
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || fallback;
}

function assign_stable_ids(taxonomies: TaxonomyEntryPersist[]): void {
    taxonomies.forEach((taxonomy, tax_index) => {
        const label = String(taxonomy.label ?? '').trim();
        if (!String(taxonomy.id ?? '').trim()) {
            taxonomy.id = slug_from_label(label, `taxonomy-${tax_index + 1}`);
        }
        const concepts = Array.isArray(taxonomy.concepts) ? taxonomy.concepts : [];
        concepts.forEach((concept, concept_index) => {
            const concept_label = String(concept.label ?? '').trim();
            if (!String(concept.id ?? '').trim()) {
                concept.id = slug_from_label(
                    concept_label,
                    `concept-${tax_index + 1}-${concept_index + 1}`
                );
            }
        });
        taxonomy.concepts = concepts;
    });
}

export function finalize_taxonomy_ids_for_persist(working_metadata: {
    taxonomies?: TaxonomyEntryPersist[];
}): void {
    if (!Array.isArray(working_metadata.taxonomies)) return;
    assign_stable_ids(working_metadata.taxonomies);
}
