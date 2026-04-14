import fs from 'fs/promises';
import path from 'path';

import { jest } from '@jest/globals';

describe('rulefile_backup_fs', () => {
    afterEach(() => {
        jest.resetModules();
        jest.restoreAllMocks();
        delete process.env.GV_BACKUP_DIR;
    });

    test('build_rulefile_overview_index aggregerar snapshot-filer per regelfil', async () => {
        const base = path.join(process.cwd(), 'tmp_test_backup_dir');
        process.env.GV_BACKUP_DIR = base;

        const fake_tree = {
            [path.join(base, '_system')]: ['20260101_120000', '20260102_120000'],
            [path.join(base, '_system', '20260101_120000')]: ['manifest.json', 'rulefiles'],
            [path.join(base, '_system', '20260102_120000')]: ['manifest.json', 'rulefiles'],
            [path.join(base, '_system', '20260101_120000', 'rulefiles', 'published')]: ['a.json'],
            [path.join(base, '_system', '20260101_120000', 'rulefiles', 'drafts')]: [],
            [path.join(base, '_system', '20260101_120000', 'rulefiles', 'working')]: [],
            [path.join(base, '_system', '20260102_120000', 'rulefiles', 'published')]: ['a.json'],
            [path.join(base, '_system', '20260102_120000', 'rulefiles', 'drafts')]: ['a.json'],
            [path.join(base, '_system', '20260102_120000', 'rulefiles', 'working')]: []
        };

        jest.spyOn(fs, 'readdir').mockImplementation(async (p, opts) => {
            const key = String(p);
            const entries = fake_tree[key];
            if (!entries) {
                const err = new Error('ENOENT') ;
                // @ts-ignore
                err.code = 'ENOENT';
                throw err;
            }
            if (opts && opts.withFileTypes) {
                return entries.map((name) => ({
                    name,
                    isDirectory: () => !name.endsWith('.json'),
                    isFile: () => name.endsWith('.json')
                }));
            }
            return entries;
        });

        jest.spyOn(fs, 'readFile').mockImplementation(async (p) => {
            const fp = String(p);
            if (fp.endsWith(path.join('20260101_120000', 'manifest.json'))) {
                return JSON.stringify({
                    type: 'system_snapshot',
                    created_at: '2026-01-01T12:00:00.000Z',
                    rulefiles: [
                        { id: 'rule-a', name: 'Regel A', filename: 'a.json', has_published: true, has_draft: false, has_draft_changes: false }
                    ]
                });
            }
            if (fp.endsWith(path.join('20260102_120000', 'manifest.json'))) {
                return JSON.stringify({
                    type: 'system_snapshot',
                    created_at: '2026-01-02T12:00:00.000Z',
                    rulefiles: [
                        { id: 'rule-a', name: 'Regel A', filename: 'a.json', has_published: true, has_draft: true, has_draft_changes: true }
                    ]
                });
            }
            throw new Error('unexpected readFile');
        });

        jest.spyOn(fs, 'stat').mockImplementation(async (p) => {
            const fp = String(p);
            const is_json = fp.endsWith('.json');
            return {
                isFile: () => is_json,
                size: 123
            };
        });

        const mod = await import('../../server/backup/rulefile_backup_fs.js');
        const items = await mod.build_rulefile_overview_index();

        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(1);
        expect(items[0].ruleSetId).toBe('rule-a');
        expect(items[0].backupFileCount).toBe(3); // 2x published + 1x drafts
        expect(items[0].has_published_in_any_snapshot).toBe(true);
        expect(items[0].has_working_in_any_snapshot).toBe(true);
        expect(items[0].latestSnapshotAt).toBe('2026-01-02T12:00:00.000Z');
    });
});

