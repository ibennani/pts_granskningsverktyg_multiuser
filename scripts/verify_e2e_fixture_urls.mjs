/**
 * @fileoverview Verifierar docs/e2e-fixture-urls.md mot router-vyer och hash-alias.
 * Kör via `npm run check:fixture-urls` (ingår i `npm run check`).
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const VIEW_INDEX = path.join(ROOT, 'js/logic/view_components_index.js');
const URL_CODEC = path.join(ROOT, 'js/logic/router_url_codec.js');
const FIXTURE_DOC = path.join(ROOT, 'docs/e2e-fixture-urls.md');

/** Vyer som måste finnas i fixture-tabellen (E2E/MCP-kritiska). */
const REQUIRED_CANONICAL_IN_DOC = [
    'start',
    'audit',
    'metadata',
    'audit_actions',
    'all_requirements',
    'requirement_audit',
    'audit_rules',
    'login',
    'manage_users',
    'rulefile_edit_requirement'
];

function read_router_views() {
    const text = fs.readFileSync(VIEW_INDEX, 'utf8');
    const views = new Set();
    const re = /case\s+'([^']+)':/g;
    let match;
    while ((match = re.exec(text)) !== null) {
        views.add(match[1]);
    }
    return views;
}

function read_compact_map() {
    const text = fs.readFileSync(URL_CODEC, 'utf8');
    const block = text.match(/CANONICAL_VIEW_TO_COMPACT = Object\.freeze\(\{([\s\S]*?)\}\);/);
    if (!block) {
        throw new Error('Kunde inte läsa CANONICAL_VIEW_TO_COMPACT i router_url_codec.js');
    }
    const canonical_to_compact = new Map();
    const compact_to_canonical = new Map();
    const entry_re = /(\w+):\s+'([^']+)'/g;
    let match;
    while ((match = entry_re.exec(block[1])) !== null) {
        canonical_to_compact.set(match[1], match[2]);
        compact_to_canonical.set(match[2], match[1]);
    }
    return { canonical_to_compact, compact_to_canonical };
}

function extract_hash_slug(cell) {
    const hit = cell.match(/#([a-z_]+)/);
    return hit ? hit[1] : null;
}

function parse_fixture_table_rows(markdown) {
    const section = markdown.match(/## Vyer[\s\S]*?(?=\n## |\n$)/);
    if (!section) {
        throw new Error('Saknar avsnittet ## Vyer i docs/e2e-fixture-urls.md');
    }
    const rows = [];
    for (const line of section[0].split('\n')) {
        if (!line.startsWith('|') || line.includes('---') || line.includes('Hash-URL')) continue;
        const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
        if (cells.length < 3) continue;
        rows.push({
            label: cells[0],
            hash_slug: extract_hash_slug(cells[1]),
            compact_slug: extract_hash_slug(cells[2])
        });
    }
    return rows;
}

function slug_to_canonical(slug, compact_to_canonical, router_views) {
    if (compact_to_canonical.has(slug)) {
        return compact_to_canonical.get(slug);
    }
    if (router_views.has(slug)) {
        return slug;
    }
    return null;
}

function verify_fixture_doc() {
    const router_views = read_router_views();
    const { canonical_to_compact, compact_to_canonical } = read_compact_map();
    const markdown = fs.readFileSync(FIXTURE_DOC, 'utf8');
    const rows = parse_fixture_table_rows(markdown);
    const issues = [];
    const documented_canonical = new Set();

    for (const row of rows) {
        if (!row.hash_slug) continue;
        const canonical = slug_to_canonical(row.hash_slug, compact_to_canonical, router_views);
        if (!canonical) {
            issues.push(`Okänd hash-vy i fixture-tabellen (${row.label}): #${row.hash_slug}`);
            continue;
        }
        documented_canonical.add(canonical);

        if (row.compact_slug) {
            const expected = canonical_to_compact.get(canonical);
            if (!expected) {
                issues.push(`Fixture anger kompakt #${row.compact_slug} för ${canonical}, men router saknar alias`);
            } else if (row.compact_slug !== expected) {
                issues.push(
                    `Fel kompakt alias för ${canonical}: dokumenterat #${row.compact_slug}, router har #${expected}`
                );
            }
            const compact_canonical = compact_to_canonical.get(row.compact_slug);
            if (compact_canonical && compact_canonical !== canonical) {
                issues.push(
                    `Kompakt #${row.compact_slug} pekar på ${compact_canonical}, men hash-raden avser ${canonical}`
                );
            }
        }
    }

    for (const required of REQUIRED_CANONICAL_IN_DOC) {
        if (!documented_canonical.has(required)) {
            issues.push(`Saknar obligatorisk vy i fixture-tabellen: ${required}`);
        }
        if (!router_views.has(required)) {
            issues.push(`Obligatorisk vy finns inte i router: ${required}`);
        }
    }

    return issues;
}

const issues = verify_fixture_doc();
if (issues.length) {
    console.error('verify_e2e_fixture_urls: fel hittades:\n' + issues.join('\n'));
    process.exit(1);
}

console.log('OK: docs/e2e-fixture-urls.md stämmer med router-vyer och hash-alias.');
