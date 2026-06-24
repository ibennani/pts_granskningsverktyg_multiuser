/**
 * @fileoverview Fristående skript för att ta fullsidsskärmdump av en URL med Puppeteer.
 *
 * Kör: npm run capture-screenshot
 * eller: npx tsx scripts/capture_page_screenshot.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture_page_screenshot } from '../server/services/page_screenshot_service.js';
import { assert_public_http_url } from '../server/utils/ssrf_url_guard.js';

// --- Enkla variabler att byta ---
const TARGET_URL = 'https://example.com';
const OUTPUT_FILENAME = 'exempel_skarmavbild.png';

async function main(): Promise<void> {
    let safe_url;
    try {
        safe_url = assert_public_http_url(TARGET_URL);
    } catch (err) {
        console.error('[capture-screenshot] Ogiltig URL:', err instanceof Error ? err.message : err);
        process.exit(1);
    }

    console.log(`[capture-screenshot] Tar fullsidsskärmdump av ${safe_url.href} …`);

    try {
        const { png_buffer, page_title } = await capture_page_screenshot({ url: safe_url.href });
        const script_dir = path.dirname(fileURLToPath(import.meta.url));
        const output_path = path.resolve(script_dir, '..', OUTPUT_FILENAME);
        await fs.writeFile(output_path, png_buffer);
        console.log(`[capture-screenshot] Klar. Sidtitel: "${page_title}"`);
        console.log(`[capture-screenshot] Sparad som: ${output_path} (${png_buffer.length} byte)`);
    } catch (err) {
        console.error('[capture-screenshot] Misslyckades:', err instanceof Error ? err.message : err);
        process.exit(1);
    }
}

main();
