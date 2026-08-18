/**
 * Hjälpfunktioner för att hitta och återställa duplicerade bristbeskrivningar per granskningsdel.
 */

export type SampleObservationRef = {
    sample_id: string;
    sample_label: string;
    req_key: string;
    check_id: string;
    pc_id: string;
    text: string;
};

export type DuplicateObservationGroup = {
    key: string;
    text: string;
    entries: SampleObservationRef[];
};

type SampleLike = {
    id?: unknown;
    description?: unknown;
    url?: unknown;
    requirementResults?: Record<string, {
        checkResults?: Record<string, {
            overallStatus?: string;
            passCriteria?: Record<string, Record<string, unknown> | string>;
        }>;
    }> | null;
};

function sample_label(sample: SampleLike): string {
    const desc = typeof sample.description === 'string' ? sample.description.trim() : '';
    if (desc) return desc;
    const url = typeof sample.url === 'string' ? sample.url.trim() : '';
    if (url) return url;
    return String(sample.id ?? '');
}

export function collect_sample_observations(samples: SampleLike[] | null | undefined): SampleObservationRef[] {
    const hits: SampleObservationRef[] = [];
    for (const sample of samples || []) {
        const sample_id = String(sample.id ?? '');
        const label = sample_label(sample);
        const results = sample.requirementResults || {};
        for (const [req_key, req_result] of Object.entries(results)) {
            const check_results = req_result?.checkResults || {};
            for (const [check_id, check_result] of Object.entries(check_results)) {
                const pcs = check_result?.passCriteria || {};
                for (const [pc_id, pc_result] of Object.entries(pcs)) {
                    const text = typeof pc_result === 'object' && pc_result !== null
                        ? pc_result.observationDetail
                        : undefined;
                    if (typeof text !== 'string' || !text.trim()) continue;
                    hits.push({
                        sample_id,
                        sample_label: label,
                        req_key,
                        check_id,
                        pc_id,
                        text: text.trim(),
                    });
                }
            }
        }
    }
    return hits;
}

export function find_duplicate_observation_groups(samples: SampleLike[] | null | undefined): DuplicateObservationGroup[] {
    const by_key = new Map<string, SampleObservationRef[]>();
    for (const hit of collect_sample_observations(samples)) {
        const key = `${hit.req_key}::${hit.check_id}::${hit.pc_id}`;
        if (!by_key.has(key)) by_key.set(key, []);
        by_key.get(key)!.push(hit);
    }
    const groups: DuplicateObservationGroup[] = [];
    for (const [key, entries] of by_key.entries()) {
        if (entries.length < 2) continue;
        const unique_texts = new Set(entries.map((e) => e.text));
        if (unique_texts.size !== 1) continue;
        groups.push({ key, text: entries[0].text, entries });
    }
    return groups;
}

function get_observation_text(
    samples: SampleLike[],
    sample_id: string,
    req_key: string,
    check_id: string,
    pc_id: string
): string {
    const sample = samples.find((s) => String(s.id) === String(sample_id));
    const pc = sample?.requirementResults?.[req_key]?.checkResults?.[check_id]?.passCriteria?.[pc_id];
    const text = typeof pc === 'object' && pc !== null ? pc.observationDetail : undefined;
    return typeof text === 'string' ? text.trim() : '';
}

function set_observation_text(
    samples: SampleLike[],
    sample_id: string,
    req_key: string,
    check_id: string,
    pc_id: string,
    text: string
): boolean {
    const sample = samples.find((s) => String(s.id) === String(sample_id));
    const req_result = sample?.requirementResults?.[req_key];
    if (!req_result) return false;
    if (!req_result.checkResults) req_result.checkResults = {};
    let chk = req_result.checkResults[check_id];
    if (!chk) {
        req_result.checkResults[check_id] = {
            overallStatus: 'not_audited',
            passCriteria: {
                [pc_id]: {
                    status: 'not_audited',
                    observationDetail: text,
                    timestamp: null,
                    attachedMediaFilenames: []
                }
            }
        };
        return true;
    }
    if (!chk.passCriteria || typeof chk.passCriteria !== 'object') {
        chk.passCriteria = {};
    }
    let pc = chk.passCriteria[pc_id];
    if (!pc || typeof pc !== 'object') {
        const status = typeof pc === 'string' ? pc : 'not_audited';
        chk.passCriteria[pc_id] = {
            status,
            observationDetail: text,
            timestamp: null,
            attachedMediaFilenames: []
        };
        return true;
    }
    const prev = typeof pc.observationDetail === 'string' ? pc.observationDetail : '';
    if (prev === text) return false;
    pc.observationDetail = text;
    return true;
}

export type ObservationRestorePatch = {
    sample_id: string;
    sample_label: string;
    req_key: string;
    check_id: string;
    pc_id: string;
    current_text: string;
    backup_text: string;
};

export function build_full_observation_restore_patches(
    current_samples: SampleLike[],
    backup_samples: SampleLike[]
): ObservationRestorePatch[] {
    const patches: ObservationRestorePatch[] = [];
    const current_by_id = new Map(current_samples.map((sample) => [String(sample.id ?? ''), sample]));

    for (const backup_sample of backup_samples) {
        const sample_id = String(backup_sample.id ?? '');
        const current_sample = current_by_id.get(sample_id);
        if (!current_sample) continue;

        const backup_results = backup_sample.requirementResults || {};
        for (const [req_key, req_result] of Object.entries(backup_results)) {
            const check_results = req_result?.checkResults || {};
            for (const [check_id, check_result] of Object.entries(check_results)) {
                const pcs = check_result?.passCriteria || {};
                for (const [pc_id] of Object.entries(pcs)) {
                    const backup_text = get_observation_text(
                        backup_samples,
                        sample_id,
                        req_key,
                        check_id,
                        pc_id
                    );
                    const current_text = get_observation_text(
                        current_samples,
                        sample_id,
                        req_key,
                        check_id,
                        pc_id
                    );
                    if (backup_text === current_text) continue;
                    const pc = current_sample?.requirementResults?.[req_key]
                        ?.checkResults?.[check_id]?.passCriteria?.[pc_id];
                    if (!pc || typeof pc !== 'object') continue;
                    patches.push({
                        sample_id,
                        sample_label: sample_label(current_sample),
                        req_key,
                        check_id,
                        pc_id,
                        current_text,
                        backup_text,
                    });
                }
            }
        }
    }

    return patches;
}

/**
 * Återställer observationer där nuvarande data har samma text i flera delar men backup hade skilda texter.
 */
export function build_observation_restore_patches(
    current_samples: SampleLike[],
    backup_samples: SampleLike[]
): ObservationRestorePatch[] {
    const patches: ObservationRestorePatch[] = [];
    const duplicate_groups = find_duplicate_observation_groups(current_samples);

    for (const group of duplicate_groups) {
        const backup_texts = group.entries.map((entry) => ({
            entry,
            backup_text: get_observation_text(
                backup_samples,
                entry.sample_id,
                entry.req_key,
                entry.check_id,
                entry.pc_id
            ),
        }));
        const unique_backup_texts = new Set(
            backup_texts.map((item) => item.backup_text).filter((text) => text.length > 0)
        );
        if (unique_backup_texts.size <= 1 && backup_texts.every((item) => item.backup_text === group.text)) {
            continue;
        }
        for (const item of backup_texts) {
            if (!item.backup_text || item.backup_text === item.entry.text) continue;
            patches.push({
                sample_id: item.entry.sample_id,
                sample_label: item.entry.sample_label,
                req_key: item.entry.req_key,
                check_id: item.entry.check_id,
                pc_id: item.entry.pc_id,
                current_text: item.entry.text,
                backup_text: item.backup_text,
            });
        }
    }
    return patches;
}

export function apply_observation_restore_patches(
    samples: SampleLike[],
    patches: ObservationRestorePatch[]
): number {
    let applied = 0;
    for (const patch of patches) {
        const changed = set_observation_text(
            samples,
            patch.sample_id,
            patch.req_key,
            patch.check_id,
            patch.pc_id,
            patch.backup_text
        );
        if (changed) applied += 1;
    }
    return applied;
}
