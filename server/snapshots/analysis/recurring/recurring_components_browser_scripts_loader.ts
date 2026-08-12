/**
 * @fileoverview Laddar recurring browser-script utan TS-transformering.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'recurring_components_browser_scripts.js'
);

type Collector = () => Array<Record<string, unknown>>;
let cached: Collector | null = null;

function load_collector(): Collector {
    if (cached) return cached;
    const source = readFileSync(SCRIPT_PATH, 'utf8').replace(/^export /gm, '');
    const factory = new Function(`${source}\nreturn browser_collect_recurring_component_candidates;`);
    cached = factory() as Collector;
    return cached;
}

export const BROWSER_COLLECT_RECURRING_COMPONENT_CANDIDATES = load_collector();
