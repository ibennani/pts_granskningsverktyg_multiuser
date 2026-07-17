/**
 * @fileoverview Räknar principer (begrepp) i en taxonomi från regelfilens metadata.
 */

type TaxonomyWithConcepts = {
    concepts?: unknown;
};

/** Antal begrepp/principer i taxonomin. Saknas eller ogiltig lista ger 0. */
export function count_taxonomy_principles(taxonomy: TaxonomyWithConcepts): number {
    return Array.isArray(taxonomy.concepts) ? taxonomy.concepts.length : 0;
}
