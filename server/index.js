// server/index.js
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import logger from './utils/logger.js';
import { query } from './db.js';
import { init_ws } from './ws.js';
import { requireAuth } from './auth/middleware.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import rulesRouter from './routes/rules.js';
import auditsRouter from './routes/audits.js';
import backupRouter from './routes/backup.js';
import { get_last_backup_status, start_backup_scheduler } from './backup/audit_backup.js';
import { JSON_MAX_UPLOAD_BYTES } from '../js/constants/json_upload_limits.js';

process.on('uncaughtException', (err) => {
    logger.error({ err }, '[Server] Uncaught exception');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error({ err: reason, promise }, '[Server] Unhandled rejection');
});

const app = express();
const PORT = process.env.API_PORT || 3000;
const http_server = http.createServer(app);

app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
    const nonce = randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;
    res.setHeader('Content-Security-Policy',
        `default-src 'self'; ` +
        `script-src 'self' 'nonce-${nonce}'; ` +
        `style-src 'self' 'unsafe-inline'; ` +
        `img-src 'self' data:; ` +
        `connect-src 'self'; ` +
        `font-src 'self' data:; ` +
        `object-src 'none'; ` +
        `base-uri 'self'; ` +
        `form-action 'self'; ` +
        `worker-src 'self';`
    );
    next();
});
// Kör bakom Nginx reverse proxy i drift – krävs för korrekt hantering av X-Forwarded-For
// (t.ex. express-rate-limit) och för att undvika onödiga ValidationError-loggar.
app.set('trust proxy', 1);

const public_app_url = (process.env.PUBLIC_APP_URL || '').trim();
const allowed_origins_env = (process.env.ALLOWED_ORIGINS || '').trim();
const allowed_origins = allowed_origins_env
    ? allowed_origins_env.split(',').map((s) => s.trim()).filter(Boolean)
    : public_app_url
        ? [public_app_url]
        : (() => {
            logger.warn('[Server] ALLOWED_ORIGINS och PUBLIC_APP_URL är inte satta – tillåter http://localhost:5173 som fallback.');
            return ['http://localhost:5173'];
        })();

app.use(cors({
    origin: (req, cb) => {
        const origin = req && req.get ? req.get('Origin') : null;
        if (!origin) return cb(null, true);
        if (allowed_origins.includes(origin)) return cb(null, origin);
        // När PUBLIC_APP_URL/ALLOWED_ORIGINS inte är satta: tillåt om anropet kommer från samma host (t.ex. Nginx proxy)
        try {
            const originUrl = new URL(origin);
            const hostHeader = req.get('Host');
            const originHostname = originUrl.hostname;
            const requestHostname = hostHeader ? hostHeader.split(':')[0].trim() : '';
            if (requestHostname && originHostname === requestHostname) return cb(null, origin);
        } catch (_) { /* ignore */ }
        return cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
}));

// Samma tak som klientens uppladdningsgräns och dokumentation (10 MiB)
app.use(express.json({ limit: JSON_MAX_UPLOAD_BYTES }));

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

// Status för lokal Ollama (används av Open WebUI för t.ex. Qwen) – så du kan verifiera att du kör lokalt
app.get('/api/ollama-status', async (_req, res) => {
    const ollama_url = 'http://127.0.0.1:11434';
    try {
        const r = await fetch(`${ollama_url}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (!r.ok) {
            return res.json({
                ollama: 'unreachable',
                message: 'Ollama svarar inte (port 11434). Starta Docker-containrarna med npm run dev.',
                open_webui_url: 'http://localhost:3080'
            });
        }
        const data = await r.json();
        const models = (data.models || []).map((m) => m.name || m.model);
        res.json({
            ollama: 'local',
            message: 'Lokal Ollama är aktiv. Open WebUI på localhost:3080 använder denna instans (t.ex. Qwen).',
            open_webui_url: 'http://localhost:3080',
            models: models.slice(0, 20)
        });
    } catch (err) {
        res.json({
            ollama: 'unreachable',
            message: 'Ollama nås inte (kontrollera att Docker-containrarna körs).',
            open_webui_url: 'http://localhost:3080',
            error: err.message
        });
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
    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
        return res.status(413).json({ error: 'Begäran överskrider maxstorlek (10 MB).' });
    }
    logger.error({ err }, '[Server] Ohanterat fel i route');
    res.status(500).json({ error: 'Ett serverfel inträffade' });
});

init_ws(http_server);

start_backup_scheduler().catch((err) => {
    logger.warn({ err: err.message }, '[Server] Kunde inte starta backup-schema');
});

http_server.listen(PORT, () => {
    logger.info({ port: PORT }, '[Server] Kör');
});
