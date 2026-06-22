/**
 * Skriver `build-info.js` och uppdaterar `index.html` i `dist` med byggstämpel.
 * Anropas från Vite `closeBundle` före vite-plugin-pwa så att Workbox-precache
 * får samma `index.html`-innehåll som på disk (navigateFallback kräver precache).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format_build_info_object } from '../js/utils/build_time_format.js';

/**
 * @param {string} dist_dir – absolut eller projektrelativ sökväg till `dist`
 * @returns {void}
 */
export function inject_dist_build_metadata (dist_dir) {
  const build_info = format_build_info_object(new Date(), { include_seconds: false });

  const build_info_content = `// Auto-generated build info
window.BUILD_INFO = ${JSON.stringify(build_info, null, 2)};
`;

  const build_info_path = join(dist_dir, 'build-info.js');
  writeFileSync(build_info_path, build_info_content, 'utf8');

  const formatted_timestamp = `Byggt ${build_info.date} kl ${build_info.time}`;
  const build_version = String(new Date(build_info.timestamp).getTime());
  const index_path = join(dist_dir, 'index.html');
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
