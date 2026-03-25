import rateLimit from 'express-rate-limit';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 15;

/** Begränsar upprepade tunga JSON-importanrop (granskning/regelfil) per användare eller IP. */
const IMPORT_WINDOW_MS = 60 * 1000;
const IMPORT_MAX_PER_WINDOW = 30;

export const import_payload_rate_limiter = rateLimit({
    windowMs: IMPORT_WINDOW_MS,
    limit: IMPORT_MAX_PER_WINDOW,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const uid = req.user && req.user.id != null ? String(req.user.id) : '';
        return uid ? `import:user:${uid}` : `import:ip:${req.ip || 'unknown'}`;
    },
    handler: (_req, res) => {
        res.status(429).json({
            error: 'För många importförsök. Vänta en stund och försök igen.'
        });
    }
});

export const login_rate_limiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        res.status(429).json({ error: 'För många inloggningsförsök, försök igen om 15 minuter' });
    }
});

