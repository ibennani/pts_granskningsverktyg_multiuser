/**
 * @fileoverview Verifierar snapshot-capture (Puppeteer) mot en URL på servern.
 */
import { capture_page_screenshot } from '../server/services/page_screenshot_service.ts';

const url =
    process.argv[2] ||
    'https://www.apohem.se/sar-bett-stick/sar/sartvatt/ekodes-smart-desinfektion-100-ml';

try {
    const result = await capture_page_screenshot({ url });
    console.log(
        JSON.stringify(
            {
                ok: true,
                page_title: result.page_title,
                png_bytes: result.png_buffer.length,
            },
            null,
            2
        )
    );
} catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ ok: false, error: message }, null, 2));
    process.exit(1);
}
