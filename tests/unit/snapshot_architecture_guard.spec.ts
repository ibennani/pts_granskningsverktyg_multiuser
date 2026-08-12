/**
 * @fileoverview Arkitekturvakter för snapshot-analys.
 */
import { describe, test, expect } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('snapshot architecture guards', () => {
    test('page_screenshot_service importerar inte analysmoduler', async () => {
        const content = await fs.readFile(
            path.join(root, 'server/services/page_screenshot_service.ts'),
            'utf8'
        );
        expect(content).not.toContain('snapshot_analysis');
        expect(content).not.toContain('snapshots/analysis');
    });

    test('page_snapshot_capture_service importerar analysrunner', async () => {
        const content = await fs.readFile(
            path.join(root, 'server/services/page_snapshot_capture_service.ts'),
            'utf8'
        );
        expect(content).toContain('run_snapshot_analysis');
        expect(content).toContain('restore_baseline_viewport');
    });

    test('sidrapport-retake använder fullrapport-API, inte snabb titel eller skärmdump', async () => {
        const retake_content = await fs.readFile(
            path.join(root, 'js/logic/audit_sidrapport_retake.ts'),
            'utf8'
        );
        expect(retake_content).toContain('start_audit_snapshot_capture');
        expect(retake_content).not.toContain('fetch-page-title');
        expect(retake_content).not.toContain('capture-screenshot');

        const toolbar_content = await fs.readFile(
            path.join(root, 'js/utils/audit_actions_snapshots_toolbar.ts'),
            'utf8'
        );
        expect(toolbar_content).toContain('start_sidrapport_retake_for_sample');
        expect(toolbar_content).not.toContain('fetch-page-title');
        expect(toolbar_content).not.toContain('capture-screenshot');
    });

    test('fas 2 är påslagen som standard i analyskonfiguration', async () => {
        const content = await fs.readFile(
            path.join(root, 'server/snapshots/analysis/snapshot_analysis_config.ts'),
            'utf8'
        );
        expect(content).toMatch(
            /get_snapshot_analysis_phase2_enabled[\s\S]*read_bool_env\('GV_SNAPSHOT_ANALYSIS_PHASE2_ENABLED',\s*true\)/
        );
    });
});
