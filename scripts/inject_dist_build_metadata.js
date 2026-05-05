/**
 * Skriver `build-info.js` och vid behov uppdaterar `index.html` i angiven katalog.
 * Vid normalt bygge används fryst innehåll i `public/build-info.js`; denna funktion
 * körs bara när du uttryckligen kör `npm run uppdatera:byggstämpel`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format_build_info_object } from '../js/utils/build_time_format.js';

/**
 * @param {string} target_dir – katalog där `build-info.js` skrivs (t.ex. `public` eller `dist`)
 * @param {{ at?: Date }} [options] – `at`: ögonblick att visa (standard: nu)
 * @returns {void}
 */
export function inject_dist_build_metadata (target_dir, options = {}) {
  const at =
    options.at instanceof Date && !Number.isNaN(options.at.getTime())
      ? options.at
      : new Date();
  const build_info = format_build_info_object(at, { include_seconds: false });

  const build_info_content = `// Fryst bygginfo – uppdateras med: npm run uppdatera:byggstämpel
window.BUILD_INFO = ${JSON.stringify(build_info, null, 2)};
`;

  const build_info_path = join(target_dir, 'build-info.js');
  writeFileSync(build_info_path, build_info_content, 'utf8');

  const formatted_timestamp = `Byggt ${build_info.date} kl ${build_info.time}`;
  const build_version = String(new Date(build_info.timestamp).getTime());
  const index_path = join(target_dir, 'index.html');
  if (!existsSync(index_path)) {
    return;
  }
  let index_html = readFileSync(index_path, 'utf8');
  index_html = index_html.replace(
    /<div id="build-timestamp">[\s\S]*?<\/div>/,
    `<div id="build-timestamp">${formatted_timestamp}</div>`
  );
  index_html = index_html.replace(
    /(src=")(build-info\.js)(")/,
    `$1$2?v=${build_version}$3`
  );
  writeFileSync(index_path, index_html, 'utf8');
}
