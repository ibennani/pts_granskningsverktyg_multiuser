/**
 * @fileoverview Läser Bilaga 1-omslagsbild som data-URI för PDF-rendering.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COVER_FILENAME = 'appendix1_cover.jpg';

let cached_cover_data_uri: string | null = null;

function resolve_cover_path(): string {
    const module_dir = dirname(fileURLToPath(import.meta.url));
    return join(module_dir, '../../shared/report_assets', COVER_FILENAME);
}

export function get_appendix1_cover_data_uri(): string {
    if (cached_cover_data_uri) return cached_cover_data_uri;
    const cover_path = resolve_cover_path();
    const buffer = readFileSync(cover_path);
    cached_cover_data_uri = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    return cached_cover_data_uri;
}

export function inject_appendix1_cover_image(html_content: string): string {
    const placeholder = '{{APPENDIX1_COVER_SRC}}';
    if (!html_content.includes(placeholder)) return html_content;
    const data_uri = get_appendix1_cover_data_uri();
    return html_content.split(placeholder).join(data_uri);
}
