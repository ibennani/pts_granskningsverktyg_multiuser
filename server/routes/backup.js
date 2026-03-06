// server/routes/backup.js
import express from 'express';
import { run_backup, get_last_backup_status } from '../backup/audit_backup.js';

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

export default router;
