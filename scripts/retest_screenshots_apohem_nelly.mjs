#!/usr/bin/env node
/**
 * Diagnostik och skärmdump för apohem + nelly.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    launch_capture_browser,
    prepare_capture_page,
    navigate_for_screenshot_capture,
    capture_viewport_png_with_adjustments,
} from '../server/services/page_capture_session.ts';

const out_dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cursor');

const targets = [
    {
        label: 'apohem_product',
        url: 'https://www.apohem.se/sar-bett-stick/sar/sartvatt/ekodes-smart-desinfektion-100-ml',
    },
    {
        label: 'nelly_home',
        url: 'https://www.nelly.com/se/',
    },
];

async function undersized_stats(page) {
    return page.evaluate(() => {
        let count = 0;
        const sample = [];
        for (const img of document.images) {
            const r = img.getBoundingClientRect();
            if (r.width < 48 || r.height < 48) continue;
            if (img.naturalWidth < 2) continue;
            const min_side = Math.min(r.width, r.height);
            const dpr = window.devicePixelRatio || 1;
            const min_expected = Math.max(min_side * 0.72, min_side * dpr * 0.35);
            if (img.naturalWidth < min_expected) {
                count += 1;
                if (sample.length < 5) {
                    sample.push({
                        natural: img.naturalWidth,
                        rect: Math.round(r.width),
                        src: (img.currentSrc || img.src || '').slice(0, 80),
                    });
                }
            }
        }
        return { count, sample };
    });
}

async function image_stats(page) {
    return page.evaluate(() => {
        const broken = [];
        for (const img of document.images) {
            const r = img.getBoundingClientRect();
            if (r.width > 40 && r.height > 40 && img.naturalWidth < 2) {
                broken.push({
                    src: (img.currentSrc || img.src || '').slice(0, 100),
                    rect: { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) },
                    complete: img.complete,
                    loading: img.getAttribute('loading'),
                });
            }
        }
        const large_loaded = Array.from(document.images).filter((img) => {
            const r = img.getBoundingClientRect();
            return r.width > 80 && r.height > 80 && img.naturalWidth > 10;
        }).length;
        return {
            total: document.images.length,
            broken_count: broken.length,
            large_loaded,
            broken_sample: broken.slice(0, 8),
        };
    });
}

const browser = await launch_capture_browser();

for (const target of targets) {
    const page = await browser.newPage();
    await prepare_capture_page(page);
    await navigate_for_screenshot_capture(page, target.url, 60000);
    const before = await image_stats(page);
    const before_undersized = await undersized_stats(page);
    const capture = await capture_viewport_png_with_adjustments(page, target.url);
    const after = await image_stats(page);
    const after_undersized = await undersized_stats(page);
    const out_path = path.join(out_dir, `${target.label}_retest.png`);
    fs.writeFileSync(out_path, capture.png_buffer);
    console.log(
        JSON.stringify(
            {
                label: target.label,
                url: target.url,
                before,
                before_undersized,
                after,
                after_undersized,
                adjustments: capture.adjustments,
                png_bytes: capture.png_buffer.length,
                out_path,
            },
            null,
            2
        )
    );
    await page.close();
}

await browser.close();
