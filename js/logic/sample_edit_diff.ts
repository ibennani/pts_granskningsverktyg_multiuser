export type SampleLike = {
    sampleCategory?: string | null;
    sampleType?: string | null;
    description?: string | null;
    url?: string | null;
    selectedContentTypes?: string[] | null;
};

export type SampleEditComparable = SampleLike & {
    attachedMediaFilenames?: unknown;
};

export type SampleEditChangeKind = 'none' | 'media_only' | 'other';

export type ChangedField = {
    key: 'sampleCategory' | 'sampleType' | 'description' | 'url';
    oldValue: string;
    newValue: string;
};

export type ContentTypesDiff = {
    added: string[];
    removed: string[];
};

export type SampleEditFieldDiff = {
    changed_fields: ChangedField[];
    content_types_diff: ContentTypesDiff;
};

function normalize_text(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v);
}

function normalize_list(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.map((x) => String(x)).filter(Boolean);
}

function normalize_media_list(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.map((filename) => String(filename).trim()).filter(Boolean);
}

function sets_equal(left: string[], right: string[]): boolean {
    const a = new Set(left);
    const b = new Set(right);
    return a.size === b.size && [...a].every((value) => b.has(value));
}

/** Avgör om granskningsdelsändringen är tom, enbart media eller något annat. */
export function classify_sample_edit_change(
    baseline: SampleEditComparable | null | undefined,
    updated: SampleEditComparable | null | undefined
): SampleEditChangeKind {
    if (!baseline || !updated) return 'other';

    const same_text =
        normalize_text(baseline.sampleCategory) === normalize_text(updated.sampleCategory) &&
        normalize_text(baseline.sampleType) === normalize_text(updated.sampleType) &&
        normalize_text(baseline.description) === normalize_text(updated.description) &&
        normalize_text(baseline.url) === normalize_text(updated.url);
    const same_ct = sets_equal(
        normalize_list(baseline.selectedContentTypes),
        normalize_list(updated.selectedContentTypes)
    );
    const baseline_media = normalize_media_list(baseline.attachedMediaFilenames);
    const updated_media = normalize_media_list(updated.attachedMediaFilenames);
    const same_media =
        baseline_media.length === updated_media.length &&
        baseline_media.every((value, index) => value === updated_media[index]);

    if (same_text && same_ct && same_media) return 'none';
    if (same_text && same_ct && !same_media) return 'media_only';
    return 'other';
}

/** Sant om analysen visar tillagda eller borttagna innehållstyper. */
export function sample_edit_analysis_has_content_type_changes(analysis: {
    content_types_diff?: ContentTypesDiff | null;
} | null | undefined): boolean {
    const diff = analysis?.content_types_diff;
    const added = Array.isArray(diff?.added) ? diff.added : [];
    const removed = Array.isArray(diff?.removed) ? diff.removed : [];
    return added.length > 0 || removed.length > 0;
}

export function compute_sample_edit_field_diff({
    old_sample,
    new_sample,
    resolve_sample_category_label,
    resolve_sample_type_label,
    resolve_content_type_label
}: {
    old_sample: SampleLike;
    new_sample: SampleLike;
    resolve_sample_category_label: (id: string) => string;
    resolve_sample_type_label: (id: string) => string;
    resolve_content_type_label: (id: string) => string;
}): SampleEditFieldDiff {
    const changed_fields: ChangedField[] = [];

    const old_cat = normalize_text(old_sample.sampleCategory);
    const new_cat = normalize_text(new_sample.sampleCategory);
    if (old_cat !== new_cat) {
        changed_fields.push({
            key: 'sampleCategory',
            oldValue: old_cat ? resolve_sample_category_label(old_cat) : '',
            newValue: new_cat ? resolve_sample_category_label(new_cat) : ''
        });
    }

    const old_type = normalize_text(old_sample.sampleType);
    const new_type = normalize_text(new_sample.sampleType);
    if (old_type !== new_type) {
        changed_fields.push({
            key: 'sampleType',
            oldValue: old_type ? resolve_sample_type_label(old_type) : '',
            newValue: new_type ? resolve_sample_type_label(new_type) : ''
        });
    }

    const old_desc = normalize_text(old_sample.description);
    const new_desc = normalize_text(new_sample.description);
    if (old_desc !== new_desc) {
        changed_fields.push({ key: 'description', oldValue: old_desc, newValue: new_desc });
    }

    const old_url = normalize_text(old_sample.url);
    const new_url = normalize_text(new_sample.url);
    if (old_url !== new_url) {
        changed_fields.push({ key: 'url', oldValue: old_url, newValue: new_url });
    }

    const old_ct = new Set(normalize_list(old_sample.selectedContentTypes));
    const new_ct = new Set(normalize_list(new_sample.selectedContentTypes));
    const added_ids = [...new_ct].filter((id) => !old_ct.has(id));
    const removed_ids = [...old_ct].filter((id) => !new_ct.has(id));

    const content_types_diff: ContentTypesDiff = {
        added: added_ids.map(resolve_content_type_label).filter(Boolean),
        removed: removed_ids.map(resolve_content_type_label).filter(Boolean)
    };

    return { changed_fields, content_types_diff };
}

