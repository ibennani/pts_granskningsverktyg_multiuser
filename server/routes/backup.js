// server/routes/backup.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { run_backup, get_last_backup_status, get_backup_status_from_fs, get_backup_dir, get_backup_settings, save_backup_settings, start_backup_scheduler, save_backup_for_audit } from '../backup/audit_backup.js';
import { build_full_state } from './audits.js';
import { query } from '../db.js';
import { calculate_overall_audit_progress } from '../../js/audit_logic.js';
const router = express.Router();

// Nedladdning av backup-fil – alla inloggade användare
router.get('/files/:auditId/:filename', async (req, res) => {
    const { auditId, filename } = req.params;
    if (!filename || !auditId) {
        return res.status(400).json({ error: 'Saknar auditId eller filnamn' });
    }
    const decoded_filename = decodeURIComponent(filename);
    if (decoded_filename.includes('..') || path.normalize(decoded_filename) !== decoded_filename) {
        return res.status(400).json({ error: 'Ogiltigt filnamn' });
    }
    try {
        const backup_dir = get_backup_dir();
        const file_path = path.join(backup_dir, auditId, decoded_filename);
        await fs.access(file_path);
        res.setHeader('Content-Disposition', `attachment; filename="${decoded_filename.replace(/"/g, '\\"')}"`);
        res.setHeader('Content-Type', 'application/json');
        const buffer = await fs.readFile(file_path);
        res.send(buffer);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(404).json({ error: 'Filen hittades inte' });
        }
        console.warn('[backup] Nedladdning misslyckades:', err.message);
        res.status(500).json({ error: 'Kunde inte ladda ner filen' });
    }
});

// Manuell körning av backup – alla inloggade användare
router.post('/run', async (_req, res) => {
    try {
        const status = await run_backup();
        res.json({ ok: true, ...status });
    } catch (err) {
        console.warn('[backup] Manuell körning misslyckades:', err.message);
        res.status(500).json({ error: 'Backup misslyckades', detail: err.message });
    }
});

router.get('/status', async (_req, res) => {
    let status = get_last_backup_status();
    if (!status) {
        try {
            status = await get_backup_status_from_fs();
        } catch (err) {
            console.warn('[backup] get_backup_status_from_fs:', err.message);
        }
    }
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

const ALLOWED_RUNS = [1, 2, 3, 4, 6, 8, 12, 24];

// Uppdatera backup-inställningar – alla inloggade användare
router.put('/settings', async (req, res) => {
    try {
        const body = req.body || {};
        const has_retention = body.retention_days !== undefined;
        const has_schedule = body.runs_per_day !== undefined || body.first_run_hour !== undefined || body.last_run_hour !== undefined;
        if (!has_retention && !has_schedule) {
            return res.status(400).json({
                error: 'Saknar giltiga inställningar. Skicka retention_days och/eller runs_per_day, first_run_hour, last_run_hour.'
            });
        }

        const current = await get_backup_settings();
        const updates = { ...current };

        if (body.retention_days !== undefined) {
            const num = typeof body.retention_days === 'number' ? body.retention_days : parseInt(body.retention_days, 10);
            if (!Number.isInteger(num) || num < 1 || num > 365) {
                return res.status(400).json({ error: 'retention_days måste vara ett tal mellan 1 och 365' });
            }
            updates.retention_days = num;
        }
        if (body.runs_per_day !== undefined) {
            const num = typeof body.runs_per_day === 'number' ? body.runs_per_day : parseInt(body.runs_per_day, 10);
            if (!Number.isInteger(num) || num < 1 || num > 24 || !ALLOWED_RUNS.includes(num)) {
                return res.status(400).json({ error: 'runs_per_day måste vara 1, 2, 3, 4, 6, 8, 12 eller 24' });
            }
            updates.runs_per_day = num;
        }
        if (body.first_run_hour !== undefined) {
            const num = typeof body.first_run_hour === 'number' ? body.first_run_hour : parseInt(body.first_run_hour, 10);
            if (!Number.isInteger(num) || num < 0 || num > 23) {
                return res.status(400).json({ error: 'first_run_hour måste vara 0–23' });
            }
            updates.first_run_hour = num;
        }
        if (body.last_run_hour !== undefined) {
            const num = typeof body.last_run_hour === 'number' ? body.last_run_hour : parseInt(body.last_run_hour, 10);
            if (!Number.isInteger(num) || num < 0 || num > 23) {
                return res.status(400).json({ error: 'last_run_hour måste vara 0–23' });
            }
            updates.last_run_hour = num;
        }

        await save_backup_settings(updates);
        await start_backup_scheduler();
        const updated = await get_backup_settings();
        res.json({ ok: true, ...updated });
    } catch (err) {
        console.warn('[backup] PUT settings error:', err.message);
        const detail = err.code === 'EACCES' ? 'Saknar skrivrättighet till backup-katalogen.' : err.message;
        res.status(500).json({ error: 'Kunde inte spara inställningar', detail });
    }
});

router.post('/save-audit', async (req, res) => {
    try {
        const audit_id = req.body?.auditId || req.body?.audit_id;
        if (!audit_id) {
            return res.status(400).json({ error: 'auditId krävs' });
        }
        const auditResult = await query('SELECT * FROM audits WHERE id = $1', [audit_id]);
        if (auditResult.rows.length === 0) {
            return res.status(404).json({ error: 'Granskning hittades inte' });
        }
        const audit = auditResult.rows[0];
        let ruleSet = null;
        if (audit.rule_set_id) {
            const rs = await query('SELECT * FROM rule_sets WHERE id = $1', [audit.rule_set_id]);
            ruleSet = rs.rows[0] || null;
        }
        const full_state = build_full_state(audit, ruleSet);
        await save_backup_for_audit(full_state, { backup_suffix_key: 'filename_manual_save_suffix' });
        res.json({ ok: true });
    } catch (err) {
        console.warn('[backup] save-audit error:', err.message);
        res.status(500).json({ error: 'Kunde inte spara säkerhetskopian', detail: err.message });
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
                status: row && row.status != null ? row.status : 'deleted',
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
            let file_size_bytes = null;
            let summary_samples = null;
            let summary_requirements = null;
            let progress_percent = null;
            let progress_audited = null;
            let progress_total = null;
            try {
                const stat = await fs.stat(fp);
                created_at = stat.mtime != null ? stat.mtime.toISOString() : null;
                const size = stat.size;
                file_size_bytes = typeof size === 'number' && !Number.isNaN(size) ? size : null;
            } catch {
                // Ignorera om vi inte kan läsa stat
            }
            try {
                const raw = await fs.readFile(fp, 'utf8');
                const data = JSON.parse(raw);
                const samples = Array.isArray(data.samples) ? data.samples : [];
                const ruleContent = data.ruleFileContent;
                const reqs = ruleContent && typeof ruleContent === 'object' && ruleContent.requirements && typeof ruleContent.requirements === 'object'
                    ? ruleContent.requirements
                    : {};
                summary_samples = samples.length;
                summary_requirements = Object.keys(reqs).length;
                try {
                    const progress = calculate_overall_audit_progress(data);
                    progress_percent = progress.total > 0
                        ? Math.round((100 * progress.audited) / progress.total)
                        : null;
                    progress_audited = progress.audited;
                    progress_total = progress.total;
                } catch {
                    progress_percent = null;
                    progress_audited = null;
                    progress_total = null;
                }
            } catch (err) {
                // Filen kunde inte läsas eller är ogiltig JSON – behåll null för sammanfattning
                if (process.env.NODE_ENV === 'development') {
                    console.warn('[backup] Kunde inte parsa backup för sammanfattning:', fp, err?.message);
                }
            }
            const lower = fname.toLowerCase();
            const is_archive = lower.includes('_arkiv') || lower.includes('_archive');
            items.push({
                filename: fname,
                url: `/backup/files/${auditId}/${encodeURIComponent(fname)}`,
                createdAt: created_at,
                isArchive: is_archive,
                fileSizeBytes: file_size_bytes,
                summarySamples: summary_samples,
                summaryRequirements: summary_requirements,
                progressPercent: progress_percent,
                progressAudited: progress_audited,
                progressTotal: progress_total
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
