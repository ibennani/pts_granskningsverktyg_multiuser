/**
 * @file Gränskontroll för JSON-nästling och nodantal (delad mellan Node och webbläsare).
 * Får inte importera DOM, window, sessionStorage eller CSS.
 */

export const JSON_STRUCTURE_MAX_DEPTH = 50;
export const JSON_STRUCTURE_MAX_NODES = 200000;

/**
 * @param {unknown} root
 * @param {{ maxDepth?: number, maxNodes?: number }} [options]
 * @returns {{ ok: true, maxDepthReached: number, nodeCount: number } | { ok: false, reason: 'too_deep' | 'too_many_nodes' }}
 */
export function check_json_structure_depth_and_size(root, options = {}) {
    const maxDepth = options.maxDepth ?? JSON_STRUCTURE_MAX_DEPTH;
    const maxNodes = options.maxNodes ?? JSON_STRUCTURE_MAX_NODES;

    const stack = [{ v: root, d: 0 }];
    let nodeCount = 0;
    let maxDepthReached = 0;

    while (stack.length > 0) {
        const { v, d } = stack.pop();
        nodeCount++;
        if (nodeCount > maxNodes) {
            return { ok: false, reason: 'too_many_nodes' };
        }
        if (d > maxDepthReached) {
            maxDepthReached = d;
        }
        if (d > maxDepth) {
            return { ok: false, reason: 'too_deep' };
        }

        if (v !== null && typeof v === 'object') {
            if (Array.isArray(v)) {
                for (let i = v.length - 1; i >= 0; i--) {
                    stack.push({ v: v[i], d: d + 1 });
                }
            } else {
                const keys = Object.keys(v);
                for (let i = keys.length - 1; i >= 0; i--) {
                    stack.push({ v: v[keys[i]], d: d + 1 });
                }
            }
        }
    }

    return { ok: true, maxDepthReached, nodeCount };
}
