/**
 * Skriver om `public/build-info.js` med aktuell tid (Europe/Stockholm via format_build_info_object).
 * Körs manuellt: `npm run uppdatera:byggstämpel` — ingår inte i `npm run build`.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inject_dist_build_metadata } from './inject_dist_build_metadata.js';

const project_root = join(dirname(fileURLToPath(import.meta.url)), '..');
const public_dir = join(project_root, 'public');

inject_dist_build_metadata(public_dir);
console.warn('[uppdatera:byggstämpel] Skrev public/build-info.js (committa innan deploy om ändringen ska gälla).');
