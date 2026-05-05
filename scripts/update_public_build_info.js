/**
 * Skriver om `public/build-info.js` med vald tid (Europe/Stockholm via format_build_info_object).
 * Körs manuellt: `npm run uppdatera:byggstämpel` — ingår inte i `npm run build`.
 *
 * Valfritt: `npm run uppdatera:byggstämpel -- --till=2026-05-05T17:46:34.766Z` (ISO 8601).
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inject_dist_build_metadata } from './inject_dist_build_metadata.js';

const project_root = join(dirname(fileURLToPath(import.meta.url)), '..');
const public_dir = join(project_root, 'public');

const till_arg = process.argv.find((a) => a.startsWith('--till='));
let at = new Date();
if (till_arg) {
  const raw = till_arg.slice('--till='.length).trim();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    console.error('[uppdatera:byggstämpel] Ogiltigt datum till --till=', raw);
    process.exit(1);
  }
  at = parsed;
}

inject_dist_build_metadata(public_dir, { at });
console.warn('[uppdatera:byggstämpel] Skrev public/build-info.js (committa innan deploy om ändringen ska gälla).');
