/**
 * @fileoverview Enhetstester för content_type_detection_analysis.
 * @jest-environment node
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { Page } from 'puppeteer';
import { JSDOM } from 'jsdom';
import { run_content_type_detection_analysis } from '../../server/snapshots/analysis/phase1/content_type_detection_analysis.ts';
import type { AnalysisContext } from '../../server/snapshots/analysis/snapshot_analysis_types.ts';
import { apply_detection_patterns_to_content_types } from '../../shared/rulefile/content_type_detection_pattern_rulefile_apply.ts';

let temp_dir = '';

beforeEach(async () => {
    temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ctd-analysis-'));
});

afterEach(async () => {
    if (temp_dir) {
        await fs.rm(temp_dir, { recursive: true, force: true });
    }
});

function make_page_with_dom(html: string): Page {
    const dom = new JSDOM(html);
    const document_ref = dom.window.document;
    return {
        evaluate: async (fn: (sel: string) => number, selector: string) => {
            try {
                return document_ref.querySelectorAll(selector).length;
            } catch {
                return 0;
            }
        },
        url: () => 'https://example.com/',
    } as unknown as Page;
}

function make_ctx(page: Page, groups: unknown[]): AnalysisContext {
    return {
        page,
        cdp: {} as AnalysisContext['cdp'],
        temp_dir,
        url: 'https://example.com/',
        should_stop: () => false,
        should_skip_phase2: () => false,
        page_state_corrupted: () => false,
        mark_page_state_corrupted: () => {},
        warnings: [],
        shared: { content_type_groups: groups },
        screenshot_budget: { remaining: 0 },
    };
}

describe('content_type_detection_analysis', () => {
    test('detekterar innehållstyp via regexp i source.html', async () => {
        await fs.writeFile(
            path.join(temp_dir, 'source.html'),
            '<html><body><table><tr><td>Rad</td></tr></table></body></html>',
            'utf8'
        );

        const groups = apply_detection_patterns_to_content_types(
            [
                {
                    id: 'text',
                    text: 'Text',
                    types: [{ id: 'tabeller', text: 'Tabeller' }],
                },
            ],
            'web'
        );

        const envelope = await run_content_type_detection_analysis(
            make_ctx(make_page_with_dom('<html><body></body></html>'), groups)
        );

        expect(envelope.status).toBe('success');
        const data = envelope.data as { detectedContentTypeIds: string[] };
        expect(data.detectedContentTypeIds).toContain('tabeller');
    });

    test('detekterar innehållstyp via selector i renderad DOM', async () => {
        await fs.writeFile(path.join(temp_dir, 'source.html'), '<html><body></body></html>', 'utf8');
        const page = make_page_with_dom('<html><body><h1>Rubrik</h1></body></html>');
        const groups = apply_detection_patterns_to_content_types(
            [
                {
                    id: 'text',
                    text: 'Text',
                    types: [{ id: 'rubriker', text: 'Rubriker' }],
                },
            ],
            'web'
        );

        const envelope = await run_content_type_detection_analysis(make_ctx(page, groups));
        const data = envelope.data as { detectedContentTypeIds: string[]; results: Array<{ selectorMatched: boolean }> };
        expect(data.detectedContentTypeIds).toContain('rubriker');
        expect(data.results.some((r) => r.selectorMatched)).toBe(true);
    });

    test('utan regelfilgrupper returnerar tom lista', async () => {
        await fs.writeFile(path.join(temp_dir, 'source.html'), '<html><body><h1>x</h1></body></html>', 'utf8');
        const envelope = await run_content_type_detection_analysis(
            make_ctx(make_page_with_dom('<html><body><h1>x</h1></body></html>'), [])
        );
        expect(envelope.recordCount).toBe(0);
        const data = envelope.data as { detectedContentTypeIds: string[] };
        expect(data.detectedContentTypeIds).toEqual([]);
    });
});
