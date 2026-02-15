// server/index.js
import express from 'express';
import { query } from './db.js';
import usersRouter from './routes/users.js';
import rulesRouter from './routes/rules.js';
import auditsRouter from './routes/audits.js';

const app = express();
const PORT = process.env.API_PORT || 3000;

app.use(express.json({ limit: '10mb' }));

app.use('/api/users', usersRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/audits', auditsRouter);

app.get('/api/health', async (_req, res) => {
    try {
        await query('SELECT 1');
        res.json({ ok: true, timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(503).json({ ok: false, error: 'Databas ej tillgänglig' });
    }
});

app.listen(PORT, () => {
    console.log(`[Server] Kör på port ${PORT}`);
});
