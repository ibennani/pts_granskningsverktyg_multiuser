/**
 * @fileoverview CI-vakt: förbjud rå vocabulary-läsning utanför accessors och validering.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from '@jest/globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const js_root = path.resolve(__dirname, '../../js');

const ALLOWED_RAW_VOCABULARY_FILES = new Set([
    'validation_logic.ts'
]);

const FORBIDDEN_PATTERNS = [
    /vocabularies\.contentTypes/,
    /vocabularies\.pageTypes/,
    /vocabularies\.taxonomies/,
    /vocabularies\.sampleTypes/,
    /\?\.vocabularies/,
    /vocabularies\s*\|\|/
];

function list_source_files(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            if (entry === 'i18n') continue;
            list_source_files(full, acc);
            continue;
        }
        if (/\.(js|ts)$/.test(entry)) {
            acc.push(full);
        }
    }
    return acc;
}

describe('vocabulary_raw_read_guard', () => {
    it('inga rå vocabulary-fallbacks i js/ utanför tillåtna filer', () => {
        const violations: string[] = [];
        for (const file of list_source_files(js_root)) {
            const rel = path.relative(js_root, file).replace(/\\/g, '/');
            if (ALLOWED_RAW_VOCABULARY_FILES.has(rel)) continue;
            const content = readFileSync(file, 'utf8');
            for (const pattern of FORBIDDEN_PATTERNS) {
                if (pattern.test(content)) {
                    violations.push(`${rel}: ${pattern}`);
                }
            }
        }
        expect(violations).toEqual([]);
    });
});
