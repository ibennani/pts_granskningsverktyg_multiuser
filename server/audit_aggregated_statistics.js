/**
 * Aggregerad statistik för avslutade granskningar (server).
 * Använder samma kravstatus som i audit_logic.
 */
import {
    calculate_requirement_status,
    get_relevant_requirements_for_sample
} from '../js/audit_logic.ts';
import { calculateQualityScore } from '../js/logic/ScoreCalculator.js';
import {
    resolve_grouping_taxonomy_id,
    resolve_audit_type_display_label,
    read_audit_type_id,
} from '../shared/audit/audit_type_metadata.js';
import {
    apply_audit_type_overlay_to_rule_content,
    snapshot_lacks_audit_types,
} from '../shared/audit/audit_type_catalog.js';
import { build_default_published_audit_types_content } from '../shared/audit/audit_type_rule_set_resolve.js';
import { resolve_sample_vocab } from '../shared/rulefile/rulefile_metadata_vocabularies.js';
import {
    resolve_taxonomy_by_id,
    resolve_taxonomy_concepts,
    WCAG_PRINCIPLE_FALLBACK_ORDER
} from '../shared/classification/taxonomy_grouping.js';

/** Fallback-ordning om inga begrepp har samlats in (bakåtkompatibilitet). */
export const WCAG_PRINCIPLE_IDS = [...WCAG_PRINCIPLE_FALLBACK_ORDER];

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
/** Klienten ersätter med översatt etikett. */
export const MONITORING_LABEL_FALLBACK_SENTINEL = '__GV_STATS_MONITORING_FALLBACK__';
export const AUDIT_TYPE_FALLBACK_SENTINEL = '__GV_STATS_AUDIT_TYPE_FALLBACK__';

/** @param {number[]} values */
function median_sorted(values) {
    if (!values.length) return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    if (s.length % 2 === 1) return s[mid];
    return (s[mid - 1] + s[mid]) / 2;
}

/**
 * @param {object|null} sample
 * @returns {string}
 */
function sample_type_key(sample) {
    const raw = sample?.sampleType;
    if (typeof raw !== 'string') return '';
    return raw.trim();
}

/**
 * @param {object|null} rule_content
 * @param {string} sample_type_id
 * @returns {string}
 */
function sample_type_label(rule_content, sample_type_id) {
    const id = String(sample_type_id || '').trim();
    if (!id) return '';
    const cats = resolve_sample_vocab(rule_content?.metadata).sampleCategories;
    if (Array.isArray(cats)) {
        for (const cat of cats) {
            const subs = Array.isArray(cat?.categories) ? cat.categories : [];
            for (const sub of subs) {
                if (String(sub?.id || '').trim() === id) {
                    const text = typeof sub?.text === 'string' ? sub.text.trim() : '';
                    if (text) return text;
                }
            }
        }
    }
    return id;
}

/**
 * @param {object} row
 * @returns {number|null}
 */
export function calendar_year_completed(row) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const end = meta.endTime;
    if (typeof end === 'string' && /^\d{4}/.test(end)) {
        return parseInt(end.slice(0, 4), 10);
    }
    const u = row.updated_at;
    if (!u) return null;
    const d = new Date(u);
    return isNaN(d.getTime()) ? null : d.getFullYear();
}

/**
 * @param {object} row
 * @returns {number|null}
 */
export function duration_weeks_for_audit(row) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const startRaw = meta.startTime || row.created_at;
    const endRaw = meta.endTime || row.updated_at;
    if (!startRaw || !endRaw) return null;
    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return null;
    return (end - start) / MS_PER_WEEK;
}

/**
 * @param {string} s
 * @returns {boolean}
 */
function is_internal_requirement_id(s) {
    if (!s) return false;
    if (s.startsWith('krav_')) return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Plockar inledande kriterienummer (siffror avskilda med punkt) från standardReference.text,
 * t.ex. "9.2.1.1 Keyboard" → "9.2.1.1". Om ingen sådan sekvens finns i början returneras hela trimmade strängen.
 * @param {string} ref_text
 * @returns {string}
 */
function leading_criterion_number_from_ref_text(ref_text) {
    const s = String(ref_text ?? '').trim();
    if (!s) return '';
    const m = s.match(/^\d+(?:\.\d+)*/);
    return m ? m[0] : s;
}

/**
 * Första position av å/ä/ö före givet index (för att inte klippa ren svensk titel).
 * @param {string} s
 * @param {number} end
 * @returns {boolean}
 */
function has_scandinavian_letter_before(s, end) {
    return /[åäöÅÄÖ]/.test(s.slice(0, end));
}

/**
 * Tar bort inledande engelsk WCAG-korttext om titeln därefter börjar med svensk formulering
 * (t.ex. "Info and Relationships Information och …" → "Information och …",
 * "Three Flashes … Tre blinkningar …" → "Tre blinkningar …").
 * @param {string} title
 * @returns {string}
 */
export function collapse_bilingual_requirement_title(title) {
    const t = String(title ?? '').trim();
    if (!t) return '';
    const lower = t.toLowerCase();
    const needle = 'information och';
    const pos = lower.indexOf(needle);
    if (pos > 0) return t.slice(pos).trim();

    // Engelsk fras följt av svensk titel som börjar med vanliga WCAG-formuleringar (ordgräns).
    const sw_after_english =
        /\s(Tre|Två|Fyra|Minsta|Etiketter|Ledtexter|Synligt|Synliga|Dold|Dolt|Ingen|Inga|Tillräckligt|Förutsägbar|Tydlig|Tydliga|Konsekvent|Fokus|Rubrik|Rubriker|Ordning|Uppmärksamhet|Åter|Ändring|Över)(?=\s|$|[.,;:])/u;
    const m = sw_after_english.exec(t);
    if (m && m.index > 0 && !has_scandinavian_letter_before(t, m.index)) {
        return t.slice(m.index + 1).trim();
    }
    return t;
}

/**
 * Visningsnamn för statistik: inledande kriterienummer ur standardReference.text + kravets titel (oförändrad).
 * Saknas titel används referens eller nyckel som sista utväg.
 * @param {object|null} req
 * @returns {string}
 */
export function requirement_stats_display_name(req) {
    if (!req || typeof req !== 'object') return '';
    const title = String(req.title ?? '').trim();
    const raw_ref = (req.standardReference?.text && String(req.standardReference.text).trim()) || '';
    const ref = raw_ref ? leading_criterion_number_from_ref_text(raw_ref) : '';
    const raw_key = String(req.key ?? req.id ?? '').trim();
    if (ref && title) return `${ref} ${title}`.trim();
    if (title) return title;
    if (ref) return ref;
    if (raw_key && !is_internal_requirement_id(raw_key)) return raw_key;
    return raw_key || '';
}

/**
 * @param {object|null} rule_content
 * @returns {string}
 */
export function get_monitoring_type_label(rule_content) {
    if (!rule_content || typeof rule_content !== 'object') return MONITORING_LABEL_FALLBACK_SENTINEL;
    const m = rule_content.metadata && rule_content.metadata.monitoringType;
    if (!m || typeof m !== 'object') return MONITORING_LABEL_FALLBACK_SENTINEL;
    const text = typeof m.text === 'string' ? m.text.trim() : '';
    const typ = typeof m.type === 'string' ? m.type.trim() : '';
    if (text) return text;
    if (typ) return typ;
    return MONITORING_LABEL_FALLBACK_SENTINEL;
}

/**
 * @param {object} row
 * @param {object|null} [rule_content]
 * @returns {string}
 */
export function get_audit_type_label(row, rule_content = null) {
    const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const label = resolve_audit_type_display_label(meta, rule_content);
    if (label) return label;
    return AUDIT_TYPE_FALLBACK_SENTINEL;
}

/**
 * @param {unknown} value
 * @returns {object|null}
 */
function parse_json_value(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Effektiv regelfil för statistik: snapshot, rule_set-fallback och granskningstyp-overlay.
 * @param {object} row
 * @returns {object|null}
 */
export function resolve_rule_for_statistics_row(row) {
    const snapshot = parse_json_value(row?.rule_file_content);
    const rule_set_content = parse_json_value(row?.rule_set_content);
    const published = parse_json_value(row?.rule_set_published_content);
    let rule = snapshot ?? rule_set_content;
    if (!rule) return null;
    const published_for_overlay = published ?? rule_set_content;
    rule = apply_audit_type_overlay_to_rule_content(rule, published_for_overlay);
    if (snapshot_lacks_audit_types(rule)) {
        rule = apply_audit_type_overlay_to_rule_content(
            rule,
            build_default_published_audit_types_content()
        );
    }
    return rule;
}

/**
 * @param {object} rule_content
 * @param {string} key
 * @returns {object|null}
 */
function find_requirement_object(rule_content, key) {
    const reqs = rule_content?.requirements;
    if (!reqs || typeof reqs !== 'object') return null;
    if (reqs[key]) return reqs[key];
    return Object.values(reqs).find((r) => r && String(r.key || r.id) === String(key)) || null;
}

/**
 * @param {object} rule_content
 * @param {object[]} samples
 * @returns {Set<string>}
 */
function failed_requirement_keys_in_audit(rule_content, samples) {
    const failed = new Set();
    if (!rule_content || !Array.isArray(samples)) return failed;
    for (const sample of samples) {
        const relevant = get_relevant_requirements_for_sample(rule_content, sample);
        for (const req_def of relevant) {
            const rid = req_def.key || req_def.id;
            const status = calculate_requirement_status(
                req_def,
                sample.requirementResults?.[rid]
            );
            if (status === 'failed') failed.add(String(rid));
        }
    }
    return failed;
}

/**
 * @param {object} row
 * @returns {object|null}
 * @deprecated Använd resolve_rule_for_statistics_row
 */
function parse_rule_file_content(row) {
    return resolve_rule_for_statistics_row(row);
}

/**
 * Jämförrelse för kravnummer (t.ex. 9.1.3.1): referens först, annars nyckel/id.
 * @param {object|null} req
 * @param {string} req_key_fallback
 * @returns {string}
 */
export function requirement_number_sort_key_for_stats(req, req_key_fallback) {
    const ref = req?.standardReference?.text;
    if (typeof ref === 'string' && ref.trim() !== '') {
        return leading_criterion_number_from_ref_text(ref);
    }
    const k = req && (req.key !== undefined && req.key !== null ? req.key : req.id);
    if (k !== undefined && k !== null && String(k).trim() !== '') return String(k).trim();
    return String(req_key_fallback ?? '');
}

/**
 * Alla underkända krav för en regelfilstyp, sorterade på andel sedan kravnummer.
 * @param {{ audit_count: number, fail_counts: Map<string, number>, req_defs: Map<string, object|null> }} mon
 * @returns {object[]}
 */
function all_failed_requirements_for_monitoring(mon) {
    const audits = mon.audit_count || 0;
    const rows = [...mon.fail_counts.entries()].map(([req_key, n]) => {
        const req = mon.req_defs.get(req_key);
        const audit_fail_rate_percent = audits > 0 ? Math.round((100 * n) / audits) : 0;
        return { req_key, n, audit_fail_rate_percent, req };
    });
    rows.sort((a, b) => {
        if (b.audit_fail_rate_percent !== a.audit_fail_rate_percent) {
            return b.audit_fail_rate_percent - a.audit_fail_rate_percent;
        }
        const ka = requirement_number_sort_key_for_stats(a.req, a.req_key);
        const kb = requirement_number_sort_key_for_stats(b.req, b.req_key);
        return ka.localeCompare(kb, 'sv', { numeric: true });
    });
    return rows.map((row) => ({
        requirement_name: requirement_stats_display_name(row.req) || row.req_key,
        audit_count: row.n,
        audit_fail_rate_percent: row.audit_fail_rate_percent
    }));
}

/**
 * Median bristindex (0–100) per taxonomibegrepp för valt år.
 * @param {Record<string, number[]>|undefined} principle_scores
 * @returns {Record<string, number|null>}
 */
function principle_median_deficiency_payload(principle_scores) {
    /** @type {Record<string, number|null>} */
    const out = {};
    const ids = Object.keys(principle_scores || {});
    for (const id of ids) {
        const arr = principle_scores?.[id];
        if (!Array.isArray(arr) || arr.length === 0) {
            out[id] = null;
            continue;
        }
        const med = median_sorted(arr);
        out[id] = med === null ? null : Math.round(med * 10) / 10;
    }
    return out;
}

/** @returns {Record<string, number[]>} */
function create_empty_principle_scores() {
    return {};
}

/**
 * Lägger till ett bristindex-värde per begrepp från ScoreCalculator.
 * @param {Record<string, number[]>} principle_scores
 * @param {Record<string, { score?: number }>|undefined} principles
 */
function append_principle_scores(principle_scores, principles) {
    if (!principles || typeof principles !== 'object') return;
    for (const [id, entry] of Object.entries(principles)) {
        const value = entry && typeof entry.score === 'number' && !Number.isNaN(entry.score)
            ? entry.score
            : null;
        if (value === null) continue;
        if (!Array.isArray(principle_scores[id])) principle_scores[id] = [];
        principle_scores[id].push(value);
    }
}

/**
 * @param {Map<string, number[]>|undefined} by_sample_type_scores
 * @returns {{ sample_type: string, median_deficiency: number }|null}
 */
function worst_sample_type_payload(by_sample_type_scores) {
    if (!by_sample_type_scores || !(by_sample_type_scores instanceof Map)) return null;
    const rows = [];
    for (const [sample_type, values] of by_sample_type_scores.entries()) {
        if (!Array.isArray(values) || values.length === 0) continue;
        const med = median_sorted(values);
        if (med === null) continue;
        rows.push({
            sample_type,
            median_deficiency: Math.round(med * 10) / 10
        });
    }
    if (rows.length === 0) return null;
    rows.sort((a, b) => {
        if (b.median_deficiency !== a.median_deficiency) return b.median_deficiency - a.median_deficiency;
        return String(a.sample_type || '').localeCompare(String(b.sample_type || ''), 'sv');
    });
    return rows[0];
}

/**
 * @returns {{ durations: number[], principle_scores: Record<string, number[]>, total_scores: number[], sample_counts: number[], by_sample_type_scores: Map<string, number[]>, sample_type_labels: Map<string, string>, grouping_taxonomy_id: string, sample_rule_content: object|null }}
 */
function create_empty_monitoring_audit_detail() {
    return {
        durations: [],
        principle_scores: create_empty_principle_scores(),
        total_scores: [],
        sample_counts: [],
        by_sample_type_scores: new Map(),
        sample_type_labels: new Map(),
        grouping_taxonomy_id: '',
        sample_rule_content: null,
        display_label: '',
    };
}

/**
 * @param {object} yb
 * @param {string} monitoring_label
 * @param {string} audit_type_id
 */
function ensure_monitoring_audit_detail(yb, monitoring_label, audit_type_id) {
    if (!yb.monitoring_audit_detail) yb.monitoring_audit_detail = new Map();
    if (!yb.monitoring_audit_detail.has(monitoring_label)) {
        yb.monitoring_audit_detail.set(monitoring_label, new Map());
    }
    const by_audit = yb.monitoring_audit_detail.get(monitoring_label);
    if (!by_audit.has(audit_type_id)) {
        by_audit.set(audit_type_id, create_empty_monitoring_audit_detail());
    }
    return by_audit.get(audit_type_id);
}

/**
 * @param {object} yb
 * @param {string} monitoring_label
 * @param {string} audit_type_id
 */
function ensure_monitoring_audit_fail_bucket(yb, monitoring_label, audit_type_id) {
    if (!yb.by_monitoring_audit_type) yb.by_monitoring_audit_type = new Map();
    if (!yb.by_monitoring_audit_type.has(monitoring_label)) {
        yb.by_monitoring_audit_type.set(monitoring_label, new Map());
    }
    const by_audit = yb.by_monitoring_audit_type.get(monitoring_label);
    if (!by_audit.has(audit_type_id)) {
        by_audit.set(audit_type_id, {
            audit_count: 0,
            fail_counts: new Map(),
            req_defs: new Map()
        });
    }
    return by_audit.get(audit_type_id);
}

/**
 * @param {object} yb
 * @param {string} monitoring_label
 * @param {string} audit_type_id
 * @param {string} sample_type_id
 * @param {string} sample_label
 */
function ensure_monitoring_audit_sampletype_scores(
    yb,
    monitoring_label,
    audit_type_id,
    sample_type_id,
    sample_label
) {
    if (!yb.by_monitoring_audit_sampletype_scores) {
        yb.by_monitoring_audit_sampletype_scores = new Map();
    }
    if (!yb.by_monitoring_audit_sampletype_scores.has(monitoring_label)) {
        yb.by_monitoring_audit_sampletype_scores.set(monitoring_label, new Map());
    }
    const by_audit = yb.by_monitoring_audit_sampletype_scores.get(monitoring_label);
    if (!by_audit.has(audit_type_id)) {
        by_audit.set(audit_type_id, new Map());
    }
    const by_type = by_audit.get(audit_type_id);
    if (!by_type.has(sample_type_id)) {
        by_type.set(sample_type_id, { label: sample_label, values: [] });
    }
    return by_type.get(sample_type_id);
}

/**
 * @param {object|null} rule_content
 * @param {string} taxonomy_id
 * @returns {string}
 */
function grouping_taxonomy_label(rule_content, taxonomy_id) {
    const tax = resolve_taxonomy_by_id(rule_content?.metadata, taxonomy_id);
    const label = typeof tax?.label === 'string' ? tax.label.trim() : '';
    if (label) return label;
    return String(taxonomy_id || '').trim();
}

/**
 * @param {object|null} rule_content
 * @param {string} taxonomy_id
 * @returns {Record<string, string>}
 */
function principle_labels_payload(rule_content, taxonomy_id) {
    const concepts = resolve_taxonomy_concepts(rule_content?.metadata, taxonomy_id, (key) => key);
    /** @type {Record<string, string>} */
    const out = {};
    for (const concept of concepts) {
        if (!concept.id) continue;
        out[concept.id] = concept.label || concept.id;
    }
    return out;
}

/**
 * @param {ReturnType<typeof create_empty_monitoring_audit_detail>} detail
 * @param {{ audit_count: number, fail_counts: Map<string, number>, req_defs: Map<string, object|null> }} mon
 * @param {Map<string, { label: string, values: number[] }>|undefined} sampletype_map
 * @returns {object|null}
 */
function stats_payload_slice_for_monitoring_audit_type(detail, mon, sampletype_map) {
    if (!detail || !mon) return null;
    const med = median_sorted(detail.durations);
    const median_duration_weeks = med === null ? null : Math.round(med);
    const top_req = all_failed_requirements_for_monitoring(mon);
    const monitoring_type_top_failed =
        top_req.length > 0
            ? [{ monitoring_type_label: '', audits_in_type: mon.audit_count, top_requirements: top_req }]
            : [];
    const principle_median_deficiency = principle_median_deficiency_payload(detail.principle_scores);
    const total_med = median_sorted(detail.total_scores || []);
    const total_median_deficiency =
        total_med === null ? null : Math.round(total_med * 10) / 10;
    const sample_med = median_sorted(detail.sample_counts || []);
    const median_sample_count = sample_med === null ? null : Math.round(sample_med * 10) / 10;
    const worst_sample_type_raw = worst_sample_type_payload(detail.by_sample_type_scores);
    const worst_sample_type =
        worst_sample_type_raw && worst_sample_type_raw.sample_type
            ? {
                  ...worst_sample_type_raw,
                  sample_type_label:
                      (detail.sample_type_labels &&
                          detail.sample_type_labels.get(worst_sample_type_raw.sample_type)) ||
                      worst_sample_type_raw.sample_type
              }
            : null;
    const monitoring_sampletype_chart = sampletype_map
        ? monitoring_sampletype_chart_payload(new Map([['', sampletype_map]]))
        : [];
    const taxonomy_id = detail.grouping_taxonomy_id || '';
    const rule_content = detail.sample_rule_content;
    return {
        completed_count: mon.audit_count,
        median_duration_weeks,
        monitoring_type_top_failed,
        principle_median_deficiency,
        total_median_deficiency,
        median_sample_count,
        worst_sample_type,
        monitoring_sampletype_chart,
        grouping_taxonomy_id: taxonomy_id,
        grouping_taxonomy_label: grouping_taxonomy_label(rule_content, taxonomy_id),
        principle_labels: principle_labels_payload(rule_content, taxonomy_id)
    };
}

function monitoring_sampletype_chart_payload(by_monitoring) {
    if (!by_monitoring || !(by_monitoring instanceof Map)) return [];
    const labels = [...by_monitoring.keys()].sort((a, b) => a.localeCompare(b, 'sv'));
    return labels.map((label) => {
        const by_type = by_monitoring.get(label);
        const rows = [];
        for (const [type_id, obj] of by_type.entries()) {
            const med = median_sorted(obj.values || []);
            if (med === null) continue;
            rows.push({
                sample_type_id: type_id,
                sample_type_label: obj.label || type_id,
                median_deficiency: Math.round(med * 10) / 10
            });
        }
        rows.sort((a, b) => {
            if (b.median_deficiency !== a.median_deficiency) return b.median_deficiency - a.median_deficiency;
            return String(a.sample_type_label || '').localeCompare(String(b.sample_type_label || ''), 'sv');
        });
        return { monitoring_type_label: label, sample_types: rows };
    }).filter((sec) => (sec.sample_types || []).length > 0);
}

/**
 * @param {number} year
 * @param {object} bucket
 * @returns {object}
 */
function stats_payload_for_year(year, bucket) {
    void year;
    const monitoring_type_labels_ordered = [...(bucket.monitoring_audit_detail?.keys() || [])].sort((a, b) =>
        a.localeCompare(b, 'sv')
    );
    /** @type {Record<string, object>} */
    const per_monitoring_type = {};
    for (const monitoring_label of monitoring_type_labels_ordered) {
        const audit_detail_map = bucket.monitoring_audit_detail.get(monitoring_label);
        const audit_type_ids_ordered = [...audit_detail_map.keys()].sort((a, b) => {
            const label_a = audit_detail_map.get(a)?.display_label || a;
            const label_b = audit_detail_map.get(b)?.display_label || b;
            return String(label_a).localeCompare(String(label_b), 'sv');
        });
        /** @type {Record<string, object>} */
        const per_audit_type = {};
        for (const audit_type_id of audit_type_ids_ordered) {
            const detail = audit_detail_map.get(audit_type_id);
            const audit_type_label = detail?.display_label || audit_type_id;
            const mon = bucket.by_monitoring_audit_type?.get(monitoring_label)?.get(audit_type_id);
            const sampletype_map = bucket.by_monitoring_audit_sampletype_scores
                ?.get(monitoring_label)
                ?.get(audit_type_id);
            const slice = stats_payload_slice_for_monitoring_audit_type(detail, mon, sampletype_map);
            if (slice) per_audit_type[audit_type_label] = slice;
        }
        per_monitoring_type[monitoring_label] = {
            audit_type_labels_ordered: audit_type_ids_ordered.map(
                (id) => audit_detail_map.get(id)?.display_label || id
            ),
            per_audit_type
        };
    }
    return {
        monitoring_type_labels_ordered,
        per_monitoring_type
    };
}

/**
 * Bygger JSON-svar för GET /audits/statistics/summary utifrån databasrader.
 * @param {object[]} rows — rader med status locked/archived/in_progress, metadata, samples, rule_file_content, created_at, updated_at
 * @returns {{ available_years: number[], per_year: Record<string, object> }}
 */
export function build_statistics_from_audit_rows(rows) {
    /** @type {Map<number, object>} */
    const by_year = new Map();

    for (const row of rows) {
        const year = calendar_year_completed(row);
        if (year === null || year < 1900) continue;

        if (!by_year.has(year)) {
            by_year.set(year, {
                monitoring_audit_detail: new Map(),
                by_monitoring_audit_type: new Map(),
                by_monitoring_audit_sampletype_scores: new Map()
            });
        }
        const yb = by_year.get(year);

        const rule = parse_rule_file_content(row);
        const samples = Array.isArray(row.samples) ? row.samples : [];
        const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const taxonomy_id = resolve_grouping_taxonomy_id(rule, meta);
        const monitoring_label = get_monitoring_type_label(rule);
        const audit_type_id = read_audit_type_id(meta) || AUDIT_TYPE_FALLBACK_SENTINEL;
        const audit_type_label = get_audit_type_label(row, rule);
        const detail = ensure_monitoring_audit_detail(yb, monitoring_label, audit_type_id);
        if (audit_type_id === AUDIT_TYPE_FALLBACK_SENTINEL) {
            detail.display_label = AUDIT_TYPE_FALLBACK_SENTINEL;
        } else if (audit_type_label && !detail.display_label) {
            detail.display_label = audit_type_label;
        }
        if (!detail.grouping_taxonomy_id && taxonomy_id) {
            detail.grouping_taxonomy_id = taxonomy_id;
        }
        if (rule && !detail.sample_rule_content) {
            detail.sample_rule_content = rule;
        }

        const dur = duration_weeks_for_audit(row);
        if (dur !== null) {
            detail.durations.push(dur);
        }

        detail.sample_counts.push(samples.length);
        if (rule && samples.length) {
            for (const sample of samples) {
                const st = sample_type_key(sample);
                if (!st) continue;
                const one = calculateQualityScore({
                    ruleFileContent: rule,
                    samples: [sample],
                    groupingTaxonomyId: taxonomy_id
                });
                const v =
                    one && typeof one.totalScore === 'number' && !Number.isNaN(one.totalScore)
                        ? one.totalScore
                        : null;
                if (v === null) continue;
                if (!detail.by_sample_type_scores.has(st)) detail.by_sample_type_scores.set(st, []);
                detail.by_sample_type_scores.get(st).push(v);
                const lbl = sample_type_label(rule, st);
                if (!detail.sample_type_labels.has(st) && lbl) detail.sample_type_labels.set(st, lbl);
                const sampletype_entry = ensure_monitoring_audit_sampletype_scores(
                    yb,
                    monitoring_label,
                    audit_type_id,
                    st,
                    lbl
                );
                sampletype_entry.values.push(v);
            }
        }
        if (rule && rule.requirements && Object.keys(rule.requirements).length > 0) {
            const qs = calculateQualityScore({
                ruleFileContent: rule,
                samples,
                groupingTaxonomyId: taxonomy_id
            });
            if (qs && qs.principles) {
                const ts =
                    typeof qs.totalScore === 'number' && !Number.isNaN(qs.totalScore) ? qs.totalScore : null;
                if (ts !== null) {
                    detail.total_scores.push(ts);
                }
                append_principle_scores(detail.principle_scores, qs.principles);
            }
        }
        const mon = ensure_monitoring_audit_fail_bucket(yb, monitoring_label, audit_type_id);
        mon.audit_count += 1;

        if (rule && samples.length) {
            const failed_keys = failed_requirement_keys_in_audit(rule, samples);
            for (const k of failed_keys) {
                mon.fail_counts.set(k, (mon.fail_counts.get(k) || 0) + 1);
                if (!mon.req_defs.has(k)) {
                    mon.req_defs.set(k, find_requirement_object(rule, k));
                }
            }
        }
    }

    const available_years = [...by_year.keys()].sort((a, b) => b - a);
    /** @type {Record<string, object>} */
    const per_year = {};
    for (const year of available_years) {
        per_year[String(year)] = stats_payload_for_year(year, by_year.get(year));
    }
    return { available_years, per_year };
}
