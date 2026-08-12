/**
 * @fileoverview Laddar initial consent browser-script utan TypeScript-transformering.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'initial_consent_browser_scripts.js'
);

type BrowserCollectInitialConsentCandidates = (
    config: Record<string, unknown>
) => Array<Record<string, unknown>>;

let cached: BrowserCollectInitialConsentCandidates | null = null;

function load_script(): BrowserCollectInitialConsentCandidates {
    if (cached) return cached;
    const source = readFileSync(SCRIPT_PATH, 'utf8').replace(/^export /gm, '');
    const factory = new Function(`${source}\nreturn browser_collect_initial_consent_candidates;`);
    cached = factory() as BrowserCollectInitialConsentCandidates;
    return cached;
}

export const BROWSER_COLLECT_INITIAL_CONSENT_CANDIDATES = load_script();
