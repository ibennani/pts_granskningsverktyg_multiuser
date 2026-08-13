/**
 * @fileoverview Hjälpare för standardkategori vid bulkimport av webbadresser.
 */
import { resolve_sample_vocab } from '../../shared/rulefile/rulefile_metadata_vocabularies.js';

/**
 * Returnerar första granskningsdelskategori med URL-fält (t.ex. webbsida).
 */
export function resolve_default_url_sample_category_id(metadata: unknown): string | null {
    const vocab = resolve_sample_vocab(metadata);
    const categories = vocab.sampleCategories || [];
    for (const entry of categories) {
        const cat = entry as { id?: string; hasUrl?: boolean };
        if (!cat.hasUrl) continue;
        const id = String(cat.id || '').trim();
        if (id) return id;
    }
    return null;
}
