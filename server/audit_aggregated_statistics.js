/**
 * Aggregerad statistik för avslutade granskningar (server).
 * Använder samma kravstatus som i audit_logic.
 */
import {
    calculate_requirement_status,
    get_relevant_requirements_for_sample
} from '../js/audit_logic.js';
import { calculateQualityScore } from '../js/logic/ScoreCalculator.js';

/** Ordning för WCAG 2.2 POUR-principer (samma som i ScoreCalculator). */
export const WCAG_PRINCIPLE_IDS = ['perceivable', 'operable', 'understandable', 'robust'];

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
/** Klienten ersätter med översatt etikett. */
export const MONITORING_LABEL_FALLBACK_SENTINEL = '__GV_STATS_MONITORING_FALLBACK__';

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
    const cats =
        rule_content?.metadata?.vocabularies?.sampleTypes?.sampleCategories ||
        rule_content?.metadata?.samples?.sampleCategories ||
        [];
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
 */
function parse_rule_file_content(row) {
    const c = row.rule_file_content;
    if (c === null || c === undefined) return null;
    if (typeof c === 'string') {
        try {
            return JSON.parse(c);
        } catch {
            return null;
        }
    }
    return c;
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
 * @param {Map<string, { audit_count: number, fail_counts: Map<string, number>, req_defs: Map<string, object|null> }>} by_monitoring
 * @returns {object[]}
 */
function monitoring_sections_payload(by_monitoring) {
    const labels = [...by_monitoring.keys()].sort((a, b) => a.localeCompare(b, 'sv'));
    return labels
        .map((label) => {
            const mon = by_monitoring.get(label);
            return {
                monitoring_type_label: label,
                audits_in_type: mon.audit_count,
                top_requirements: all_failed_requirements_for_monitoring(mon)
            };
        })
        .filter((sec) => sec.top_requirements.length > 0);
}

/**
 * @param {Map<string, number>|undefined} language_counts
 * @returns {{ language: string, count: number }[]}
 */

/**
 * Median bristindex (0–100) per WCAG-princip för valt år.
 * @param {Record<string, number[]>|undefined} principle_scores
 * @returns {Record<string, number|null>}
 */
function principle_median_deficiency_payload(principle_scores) {
    /** @type {Record<string, number|null>} */
    const out = {};
    for (const id of WCAG_PRINCIPLE_IDS) {
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
 * @returns {{ durations: number[], principle_scores: Record<string, number[]>, total_scores: number[], sample_counts: number[], by_sample_type_scores: Map<string, number[]>, sample_type_labels: Map<string, string> }}
 */
function create_empty_monitoring_year_detail() {
    return {
        durations: [],
        principle_scores: Object.fromEntries(WCAG_PRINCIPLE_IDS.map((id) => [id, []])),
        total_scores: [],
        sample_counts: [],
        by_sample_type_scores: new Map(),
        sample_type_labels: new Map()
    };
}

/**
 * @param {{ monitoring_detail?: Map<string, ReturnType<typeof create_empty_monitoring_year_detail>> }} yb
 * @param {string} label
 */
function ensure_monitoring_year_detail(yb, label) {
    if (!yb.monitoring_detail) yb.monitoring_detail = new Map();
    if (!yb.monitoring_detail.has(label)) {
        yb.monitoring_detail.set(label, create_empty_monitoring_year_detail());
    }
    return yb.monitoring_detail.get(label);
}

/**
 * Svar för en regelfilstyp inom ett år: endast rader vars monitoring_label === label
 * (via monitoring_detail, by_monitoring och by_monitoring_sampletype_scores för samma nyckel).
 * @param {object} bucket
 * @param {string} label
 * @param {{ audit_count: number, fail_counts: Map<string, number>, req_defs: Map<string, object|null> }} mon
 * @returns {object|null}
 */
function stats_payload_slice_for_monitoring_type(bucket, label, mon) {
    const md = bucket.monitoring_detail?.get(label);
    if (!md) return null;
    const med = median_sorted(md.durations);
    const median_duration_weeks = med === null ? null : Math.round(med);
    const top_req = all_failed_requirements_for_monitoring(mon);
    const monitoring_type_top_failed =
        top_req.length > 0
            ? [{ monitoring_type_label: label, audits_in_type: mon.audit_count, top_requirements: top_req }]
            : [];
    const principle_median_deficiency = principle_median_deficiency_payload(md.principle_scores);
    const total_med = median_sorted(md.total_scores || []);
    const total_median_deficiency =
        total_med === null ? null : Math.round(total_med * 10) / 10;
    const sample_med = median_sorted(md.sample_counts || []);
    const median_sample_count = sample_med === null ? null : Math.round(sample_med * 10) / 10;
    const worst_sample_type_raw = worst_sample_type_payload(md.by_sample_type_scores);
    const worst_sample_type =
        worst_sample_type_raw && worst_sample_type_raw.sample_type
            ? {
                  ...worst_sample_type_raw,
                  sample_type_label:
                      (md.sample_type_labels && md.sample_type_labels.get(worst_sample_type_raw.sample_type)) ||
                      worst_sample_type_raw.sample_type
              }
            : null;
    const mon_chart_map = bucket.by_monitoring_sampletype_scores?.get(label);
    const monitoring_sampletype_chart = mon_chart_map
        ? monitoring_sampletype_chart_payload(new Map([[label, mon_chart_map]]))
        : [];
    return {
        completed_count: mon.audit_count,
        median_duration_weeks,
        monitoring_type_top_failed,
        principle_median_deficiency,
        total_median_deficiency,
        median_sample_count,
        worst_sample_type,
        monitoring_sampletype_chart
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
 * @param {{ durations: number[], by_monitoring: Map<string, object>, principle_scores?: Record<string, number[]>, total_scores?: number[], sample_counts?: number[], by_sample_type_scores?: Map<string, number[]>, by_monitoring_sampletype_scores?: Map<string, Map<string, { label: string, values: number[] }>> }} bucket
 * @param {object[]} all_rows
 * @returns {object}
 */
function stats_payload_for_year(year, bucket, all_rows) {
    const completed_count = all_rows.filter((r) => calendar_year_completed(r) === year).length;
    const med = median_sorted(bucket.durations);
    const median_duration_weeks = med === null ? null : Math.round(med);
    const monitoring_type_top_failed = monitoring_sections_payload(bucket.by_monitoring);
    const principle_median_deficiency = principle_median_deficiency_payload(bucket.principle_scores);
    const total_med = median_sorted(bucket.total_scores || []);
    const total_median_deficiency =
        total_med === null ? null : Math.round(total_med * 10) / 10;
    const sample_med = median_sorted(bucket.sample_counts || []);
    const median_sample_count = sample_med === null ? null : Math.round(sample_med * 10) / 10;
    const worst_sample_type_raw = worst_sample_type_payload(bucket.by_sample_type_scores);
    const worst_sample_type =
        worst_sample_type_raw && worst_sample_type_raw.sample_type
            ? {
                  ...worst_sample_type_raw,
                  sample_type_label:
                      (bucket.sample_type_labels && bucket.sample_type_labels.get(worst_sample_type_raw.sample_type)) ||
                      worst_sample_type_raw.sample_type
              }
            : null;
    const monitoring_sampletype_chart = monitoring_sampletype_chart_payload(bucket.by_monitoring_sampletype_scores);
    const monitoring_type_labels_ordered = [...bucket.by_monitoring.keys()].sort((a, b) =>
        a.localeCompare(b, 'sv')
    );
    /** @type {Record<string, object>} */
    const per_monitoring_type = {};
    for (const label of monitoring_type_labels_ordered) {
        const mon = bucket.by_monitoring.get(label);
        const slice = stats_payload_slice_for_monitoring_type(bucket, label, mon);
        if (slice) per_monitoring_type[label] = slice;
    }
    return {
        completed_count,
        median_duration_weeks,
        monitoring_type_top_failed,
        principle_median_deficiency,
        total_median_deficiency,
        median_sample_count,
        worst_sample_type,
        monitoring_sampletype_chart,
        per_monitoring_type,
        monitoring_type_labels_ordered
    };
}

/**
 * @param {Map<string, { audit_count: number, fail_counts: Map<string, number>, req_defs: Map<string, object|null> }>} mon_map
 * @param {string} label
 * @returns {{ audit_count: number, fail_counts: Map<string, number>, req_defs: Map<string, object|null> }}
 */
function ensure_monitoring_bucket(mon_map, label) {
    if (!mon_map.has(label)) {
        mon_map.set(label, {
            audit_count: 0,
            fail_counts: new Map(),
            req_defs: new Map()
        });
    }
    return mon_map.get(label);
}

/**
 * Bygger JSON-svar för GET /audits/statistics/summary utifrån databasrader.
 * @param {object[]} rows — rader med status locked/archived, metadata, samples, rule_file_content, created_at, updated_at
 * @returns {{ available_years: number[], per_year: Record<string, object> }}
 */
export function build_statistics_from_audit_rows(rows) {
    /** @type {Map<number, { durations: number[], by_monitoring: Map<string, { audit_count: number, fail_counts: Map<string, number>, req_defs: Map<string, object|null> }>, principle_scores: Record<string, number[]>, total_scores: number[], sample_counts: number[], by_sample_type_scores: Map<string, number[]>, sample_type_labels: Map<string, string>, by_monitoring_sampletype_scores: Map<string, Map<string, { label: string, values: number[] }>> }>} */
    const by_year = new Map();

    for (const row of rows) {
        const year = calendar_year_completed(row);
        if (year === null || year < 1900) continue;

        if (!by_year.has(year)) {
            by_year.set(year, {
                durations: [],
                by_monitoring: new Map(),
                principle_scores: Object.fromEntries(WCAG_PRINCIPLE_IDS.map((id) => [id, []])),
                total_scores: [],
                sample_counts: [],
                by_sample_type_scores: new Map(),
                sample_type_labels: new Map(),
                by_monitoring_sampletype_scores: new Map(),
                monitoring_detail: new Map()
            });
        }
        const yb = by_year.get(year);

        const rule = parse_rule_file_content(row);
        const samples = Array.isArray(row.samples) ? row.samples : [];
        const monitoring_label = get_monitoring_type_label(rule);
        const msub = ensure_monitoring_year_detail(yb, monitoring_label);

        const dur = duration_weeks_for_audit(row);
        if (dur !== null) {
            yb.durations.push(dur);
            msub.durations.push(dur);
        }

        yb.sample_counts.push(samples.length);
        msub.sample_counts.push(samples.length);
        if (rule && samples.length) {
            for (const sample of samples) {
                const st = sample_type_key(sample);
                if (!st) continue;
                const one = calculateQualityScore({ ruleFileContent: rule, samples: [sample] });
                const v = one && typeof one.totalScore === 'number' && !Number.isNaN(one.totalScore) ? one.totalScore : null;
                if (v === null) continue;
                if (!yb.by_sample_type_scores.has(st)) yb.by_sample_type_scores.set(st, []);
                yb.by_sample_type_scores.get(st).push(v);
                if (!msub.by_sample_type_scores.has(st)) msub.by_sample_type_scores.set(st, []);
                msub.by_sample_type_scores.get(st).push(v);

                if (!yb.by_monitoring_sampletype_scores.has(monitoring_label)) {
                    yb.by_monitoring_sampletype_scores.set(monitoring_label, new Map());
                }
                const mon = yb.by_monitoring_sampletype_scores.get(monitoring_label);
                if (!mon.has(st)) {
                    const lbl = sample_type_label(rule, st);
                    mon.set(st, { label: lbl, values: [] });
                    if (!yb.sample_type_labels.has(st) && lbl) yb.sample_type_labels.set(st, lbl);
                    if (!msub.sample_type_labels.has(st) && lbl) msub.sample_type_labels.set(st, lbl);
                }
                mon.get(st).values.push(v);
            }
        }
        if (rule && rule.requirements && Object.keys(rule.requirements).length > 0) {
            const qs = calculateQualityScore({ ruleFileContent: rule, samples });
            if (qs && qs.principles) {
                const ts = typeof qs.totalScore === 'number' && !Number.isNaN(qs.totalScore) ? qs.totalScore : null;
                if (ts !== null) {
                    yb.total_scores.push(ts);
                    msub.total_scores.push(ts);
                }
                for (const id of WCAG_PRINCIPLE_IDS) {
                    const p = qs.principles[id];
                    const v = p && typeof p.score === 'number' && !Number.isNaN(p.score) ? p.score : null;
                    if (v !== null) {
                        yb.principle_scores[id].push(v);
                        msub.principle_scores[id].push(v);
                    }
                }
            }
        }
        const mon = ensure_monitoring_bucket(yb.by_monitoring, monitoring_label);
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
        per_year[String(year)] = stats_payload_for_year(year, by_year.get(year), rows);
    }
    return { available_years, per_year };
}
