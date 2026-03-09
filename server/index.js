// server/index.js
import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { query } from './db.js';
import { init_ws } from './ws.js';
process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled rejection at', promise, 'reason:', reason);
});
import { requireAuth } from './auth/middleware.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import rulesRouter from './routes/rules.js';
import auditsRouter from './routes/audits.js';
import backupRouter from './routes/backup.js';
import { get_last_backup_status, start_backup_scheduler } from './backup/audit_backup.js';

const app = express();
const PORT = process.env.API_PORT || 3000;
const http_server = http.createServer(app);

app.use(helmet());

const public_app_url = (process.env.PUBLIC_APP_URL || '').trim();
const allowed_origins_env = (process.env.ALLOWED_ORIGINS || '').trim();
const allowed_origins = allowed_origins_env
    ? allowed_origins_env.split(',').map((s) => s.trim()).filter(Boolean)
    : public_app_url
        ? [public_app_url]
        : (() => {
            console.warn('[Server] ALLOWED_ORIGINS och PUBLIC_APP_URL är inte satta – tillåter http://localhost:5173 som fallback.');
            return ['http://localhost:5173'];
        })();

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowed_origins.includes(origin)) return cb(null, true);
        return cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
    if (req.path === '/api/debug-delete') {
        return res.json({ debug: true, method: req.method, path: req.path });
    }
    next();
});

app.use('/api/auth', authRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/rules', requireAuth, rulesRouter);
app.use('/api/audits', requireAuth, auditsRouter);
app.use('/api/backup', requireAuth, backupRouter);

app.get('/api/health', async (_req, res) => {
    try {
        await query('SELECT 1');
        const backup_status = get_last_backup_status();
        res.json({
            ok: true,
            timestamp: new Date().toISOString(),
            backup: backup_status ? {
                last_run: backup_status.last_run,
                audits_processed: backup_status.audits_processed,
                new_files: backup_status.new_files
            } : null
        });
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

start_backup_scheduler().catch((err) => {
    console.warn('[Server] Kunde inte starta backup-schema:', err.message);
});

http_server.listen(PORT, () => {
    console.log(`[Server] Kör på port ${PORT}`);
});
