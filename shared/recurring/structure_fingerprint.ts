/**
 * @fileoverview Normaliserad strukturfingerprint för återkommande block.
 */

export type StructureNode = {
    tag: string;
    role: string | null;
    child_tags: string[];
};

const DYNAMIC_ID_RE = /^(?:react|vue|ember|ng)-|^[a-f0-9]{8,}$|^\d{10,}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalize_element_id_for_fingerprint(id: string | null | undefined): string {
    const raw = String(id || '').trim();
    if (!raw) return '';
    if (UUID_RE.test(raw) || DYNAMIC_ID_RE.test(raw)) return '*';
    return raw.toLowerCase();
}

export function build_structure_node_from_eval(data: {
    tagName?: string;
    role?: string | null;
    children?: Array<{ tagName?: string; role?: string | null }>;
}): StructureNode {
    return {
        tag: String(data.tagName || '').toLowerCase(),
        role: data.role ? String(data.role).toLowerCase() : null,
        child_tags: (data.children || []).map((c) => {
            const role = c.role ? `[${String(c.role).toLowerCase()}]` : '';
            return `${String(c.tagName || '').toLowerCase()}${role}`;
        }),
    };
}

export function structure_fingerprint_hash(node: StructureNode): string {
    const payload = JSON.stringify(node);
    let hash = 0;
    for (let i = 0; i < payload.length; i += 1) {
        hash = (hash * 31 + payload.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

export function structure_similarity_score(a: StructureNode, b: StructureNode): number {
    if (a.tag !== b.tag) return 0;
    if (a.role !== b.role) return 0.5;
    const set_a = new Set(a.child_tags);
    const set_b = new Set(b.child_tags);
    const union = new Set([...set_a, ...set_b]);
    if (union.size === 0) return 1;
    let intersection = 0;
    for (const item of set_a) {
        if (set_b.has(item)) intersection += 1;
    }
    return intersection / union.size;
}
