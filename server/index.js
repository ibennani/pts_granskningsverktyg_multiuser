// server/index.js
import 'dotenv/config';
import http from 'http';
import express from 'express';
import { query } from './db.js';
import { init_ws } from './ws.js';
process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled rejection at', promise, 'reason:', reason);
});
import cron from 'node-cron';
import usersRouter from './routes/users.js';
import rulesRouter from './routes/rules.js';
import auditsRouter from './routes/audits.js';
import { run_backup } from './backup/audit_backup.js';

const app = express();
const PORT = process.env.API_PORT || 3000;
const http_server = http.createServer(app);

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
    if (req.path === '/api/debug-delete') {
        return res.json({ debug: true, method: req.method, path: req.path });
    }
    next();
});

app.use('/api/users', usersRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/audits', auditsRouter);

app.get('/api/health', async (_req, res) => {
    try {
        await query('SELECT 1');
        res.json({ ok: true, timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(503).json({ ok: false, error: 'Databas ej tillgänglig', detail: err.message });
    }
});

// Diagnostik för felsökning av 500 – returnerar status utan känslig info
app.get('/api/debug-status', async (_req, res) => {
    try {
        await query('SELECT 1');
        const cols = await query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'audits' AND column_name = 'rule_file_content'
        `);
        res.json({
            ok: true,
            db: 'connected',
            migration_rule_file_content: cols.rows.length > 0,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(503).json({
            ok: false,
            db: 'error',
            detail: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.use((err, _req, res, _next) => {
    console.error('[Server] Ohanterat fel i route:', err);
    res.status(500).json({ error: 'Ett serverfel inträffade' });
});

init_ws(http_server);

cron.schedule('0 12,18 * * *', () => {
    run_backup().then((s) => {
        console.log('[Server] Backup kördes:', s?.audits_processed, 'granskningar,', s?.new_files, 'nya filer');
    }).catch((err) => {
        console.warn('[Server] Backup misslyckades:', err.message);
    });
});

http_server.listen(PORT, () => {
    console.log(`[Server] Kör på port ${PORT}`);
});
