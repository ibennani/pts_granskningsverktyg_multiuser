// server/routes/backup.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { run_backup, get_last_backup_status, get_backup_dir, get_backup_settings, save_backup_settings } from '../backup/audit_backup.js';
import { query } from '../db.js';

const router = express.Router();

router.post('/run', async (_req, res) => {
    try {
        const status = await run_backup();
        res.json({ ok: true, ...status });
    } catch (err) {
        console.warn('[backup] Manuell körning misslyckades:', err.message);
        res.status(500).json({ error: 'Backup misslyckades', detail: err.message });
    }
});

router.get('/status', (_req, res) => {
    const status = get_last_backup_status();
    res.json(status ? { ok: true, ...status } : { ok: true, last_run: null });
});

router.get('/settings', async (_req, res) => {
    try {
        const settings = await get_backup_settings();
        res.json({ ok: true, ...settings });
    } catch (err) {
        console.warn('[backup] GET settings error:', err.message);
        res.status(500).json({ error: 'Kunde inte läsa inställningar' });
    }
});

router.put('/settings', async (req, res) => {
    try {
        const { retention_days } = req.body || {};
        const num = typeof retention_days === 'number' ? retention_days : parseInt(retention_days, 10);
        if (!Number.isInteger(num) || num < 1 || num > 365) {
            return res.status(400).json({ error: 'retention_days måste vara ett tal mellan 1 och 365' });
        }
        const current = await get_backup_settings();
        await save_backup_settings({ ...current, retention_days: num });
        const updated = await get_backup_settings();
        res.json({ ok: true, ...updated });
    } catch (err) {
        console.warn('[backup] PUT settings error:', err.message);
        res.status(500).json({ error: 'Kunde inte spara inställningar', detail: err.message });
    }
});

// Lista alla granskningar som har backuper i backup-katalogen.
router.get('/list', async (_req, res) => {
    try {
        const backup_dir = get_backup_dir();
        let dir_entries;
        try {
            dir_entries = await fs.readdir(backup_dir, { withFileTypes: true });
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.json([]);
            }
            console.warn('[backup] Kunde inte läsa backup-katalogen:', err.message);
            return res.status(500).json({ error: 'Kunde inte läsa backup-katalogen' });
        }

        const audit_ids = dir_entries
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
            .filter((name) => typeof name === 'string' && name.length > 0);

        if (audit_ids.length === 0) {
            return res.json([]);
        }

        const dbResult = await query(
            'SELECT id, metadata, status FROM audits WHERE id = ANY($1::uuid[])',
            [audit_ids]
        );
        const meta_by_id = new Map();
        dbResult.rows.forEach((row) => {
            meta_by_id.set(row.id, row);
        });

        const items = [];

        for (const audit_id of audit_ids) {
            const audit_path = path.join(backup_dir, audit_id);
            let files;
            try {
                files = await fs.readdir(audit_path);
            } catch {
                continue;
            }
            const json_files = files.filter((f) => f.endsWith('.json'));
            if (json_files.length === 0) continue;

            let latest_mtime = null;
            let has_archive = false;

            for (const fname of json_files) {
                const fp = path.join(audit_path, fname);
                try {
                    const stat = await fs.stat(fp);
                    if (!latest_mtime || stat.mtimeMs > latest_mtime) {
                        latest_mtime = stat.mtimeMs;
                    }
                } catch {
                    // Ignorera filer som inte går att läsa metadata för
                }
                const lower = fname.toLowerCase();
                if (lower.includes('_arkiv') || lower.includes('_archive')) {
                    has_archive = true;
                }
            }

            const row = meta_by_id.get(audit_id) || {};
            const metadata = row.metadata || {};

            items.push({
                auditId: audit_id,
                caseNumber: metadata.caseNumber || null,
                actorName: metadata.actorName || null,
                status: row.status || null,
                latestBackupAt: latest_mtime ? new Date(latest_mtime).toISOString() : null,
                backupCount: json_files.length,
                hasArchive: has_archive
            });
        }

        res.json(items);
    } catch (err) {
        console.error('[backup] list error:', err);
        res.status(500).json({ error: 'Kunde inte hämta backup-lista' });
    }
});

// Lista alla backup-filer för en specifik granskning.
router.get('/:auditId', async (req, res) => {
    const { auditId } = req.params;
    try {
        const backup_dir = get_backup_dir();
        const audit_path = path.join(backup_dir, auditId);
        let files;
        try {
            files = await fs.readdir(audit_path);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.json([]);
            }
            console.warn('[backup] Kunde inte läsa backup-mapp för', auditId, ':', err.message);
            return res.status(500).json({ error: 'Kunde inte läsa backup-mapp för granskning' });
        }

        const json_files = files.filter((f) => f.endsWith('.json'));
        const items = [];

        for (const fname of json_files) {
            const fp = path.join(audit_path, fname);
            let created_at = null;
            try {
                const stat = await fs.stat(fp);
                created_at = stat.mtime.toISOString();
            } catch {
                // Ignorera tidsstämpel om vi inte kan läsa den
            }
            const lower = fname.toLowerCase();
            const is_archive = lower.includes('_arkiv') || lower.includes('_archive');
            items.push({
                filename: fname,
                url: `/backup/${auditId}/${encodeURIComponent(fname)}`,
                createdAt: created_at,
                isArchive: is_archive
            });
        }

        items.sort((a, b) => {
            if (!a.createdAt && !b.createdAt) return 0;
            if (!a.createdAt) return 1;
            if (!b.createdAt) return -1;
            return b.createdAt.localeCompare(a.createdAt);
        });

        res.json(items);
    } catch (err) {
        console.error('[backup] list for audit error:', err);
        res.status(500).json({ error: 'Kunde inte hämta backuper för granskning' });
    }
});

export default router;
