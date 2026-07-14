/**
 * @file Tolerant läsning och persist-normalisering av vocabulary-fält i regelfilsmetadata.
 * Gäller fristående regelfiler — inbäddad ruleFileContent i granskningar ska inte normaliseras vid persist.
 */

import { apply_detection_patterns_for_rulefile_metadata } from './content_type_detection_pattern_rulefile_apply.js';

export type RulefileMetadataVocabularyNormalizeMode = 'read' | 'persist';

type MetadataRecord = Record<string, unknown>;

export type SampleVocabShape = {
    sampleCategories: unknown[];
    sampleTypes: unknown[];
};

function as_metadata(metadata: unknown): MetadataRecord {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
        return metadata as MetadataRecord;
    }
    return {};
}

function vocab_object(metadata: MetadataRecord): MetadataRecord | undefined {
    const vocab = metadata.vocabularies;
    if (vocab && typeof vocab === 'object' && !Array.isArray(vocab)) {
        return vocab as MetadataRecord;
    }
    return undefined;
}

function clone_array(value: unknown): unknown[] {
    return Array.isArray(value) ? (JSON.parse(JSON.stringify(value)) as unknown[]) : [];
}

function pick_vocabulary_array(flat: unknown, from_vocab: unknown): unknown[] {
    const flat_arr = Array.isArray(flat) ? flat : null;
    const vocab_arr = Array.isArray(from_vocab) ? from_vocab : null;
    if (flat_arr && vocab_arr && JSON.stringify(flat_arr) !== JSON.stringify(vocab_arr)) {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn('[rulefile_metadata_vocabularies] vocabulary conflict; using flat metadata field');
        }
        return clone_array(flat_arr);
    }
    if (flat_arr) return clone_array(flat_arr);
    if (vocab_arr) return clone_array(vocab_arr);
    return [];
}

export function resolve_page_types(metadata: unknown): unknown[] {
    const meta = as_metadata(metadata);
    return pick_vocabulary_array(meta.pageTypes, vocab_object(meta)?.pageTypes);
}

export function resolve_content_types(metadata: unknown): unknown[] {
    const meta = as_metadata(metadata);
    return pick_vocabulary_array(meta.contentTypes, vocab_object(meta)?.contentTypes);
}

export function resolve_taxonomies(metadata: unknown): unknown[] {
    const meta = as_metadata(metadata);
    return pick_vocabulary_array(meta.taxonomies, vocab_object(meta)?.taxonomies);
}

export function resolve_sample_vocab(metadata: unknown): SampleVocabShape {
    const meta = as_metadata(metadata);
    const vocab = vocab_object(meta);
    const samples =
        meta.samples && typeof meta.samples === 'object' && !Array.isArray(meta.samples)
            ? (meta.samples as MetadataRecord)
            : {};
    const vocab_samples =
        vocab?.sampleTypes && typeof vocab.sampleTypes === 'object' && !Array.isArray(vocab.sampleTypes)
            ? (vocab.sampleTypes as MetadataRecord)
            : {};

    let sample_categories = pick_vocabulary_array(samples.sampleCategories, vocab_samples.sampleCategories);
    const sample_types_raw = samples.sampleTypes ?? vocab_samples.sampleTypes;
    let sample_types: unknown[] = [];

    if (
        sample_types_raw &&
        typeof sample_types_raw === 'object' &&
        !Array.isArray(sample_types_raw)
    ) {
        const block = sample_types_raw as MetadataRecord;
        if (Array.isArray(block.sampleTypes)) {
            sample_types = clone_array(block.sampleTypes);
        }
        if (sample_categories.length === 0 && Array.isArray(block.sampleCategories)) {
            sample_categories = clone_array(block.sampleCategories);
        }
    } else if (Array.isArray(sample_types_raw)) {
        sample_types = clone_array(sample_types_raw);
    }

    return { sampleCategories: sample_categories, sampleTypes: sample_types };
}

function apply_canonical_vocab_fields(metadata: MetadataRecord, options: { mode?: RulefileMetadataVocabularyNormalizeMode } = {}): MetadataRecord {
    const next = { ...metadata };
    next.pageTypes = resolve_page_types(next);
    next.contentTypes = resolve_content_types(next);
    next.taxonomies = resolve_taxonomies(next);
    const sample_vocab = resolve_sample_vocab(next);
    const samples =
        next.samples && typeof next.samples === 'object' && !Array.isArray(next.samples)
            ? { ...(next.samples as MetadataRecord) }
            : {};
    samples.sampleCategories = sample_vocab.sampleCategories;
    samples.sampleTypes = sample_vocab.sampleTypes;
    next.samples = samples;
    delete next.vocabularies;

    if (options.mode === 'persist') {
        return apply_detection_patterns_for_rulefile_metadata(next);
    }

    return next;
}

/**
 * Normaliserar vocabulary till platta metadata-fält. Använd endast på fristående regelfiler.
 */
export function normalize_rulefile_metadata_vocabularies(
    metadata: unknown,
    options: { mode?: RulefileMetadataVocabularyNormalizeMode } = {}
): MetadataRecord {
    void options.mode;
    const cloned = JSON.parse(JSON.stringify(as_metadata(metadata))) as MetadataRecord;
    return apply_canonical_vocab_fields(cloned, options);
}

export function normalize_rulefile_content_vocabularies_for_persist(
    content: unknown
): Record<string, unknown> | null {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
        return null;
    }
    const root = content as Record<string, unknown>;
    return {
        ...root,
        metadata: normalize_rulefile_metadata_vocabularies(root.metadata, { mode: 'persist' })
    };
}
