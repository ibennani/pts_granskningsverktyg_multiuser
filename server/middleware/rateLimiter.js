import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Rate limiting: max 15 försök per 5 minuter per IP.
// skipSuccessfulRequests: true innebär att lyckade inloggningar
// inte räknas mot gränsen.
export const auth_rate_limiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'För många inloggningsförsök. Försök igen om 5 minuter.'
    },
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        return req.ip || req.headers['x-forwarded-for'] || 'unknown';
    }
});

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
        if (uid) {
            return `import:user:${uid}`;
        }
        const ip = req.ip || 'unknown';
        return `import:ip:${ipKeyGenerator(ip)}`;
    },
    handler: (_req, res) => {
        res.status(429).json({
            error: 'För många importförsök. Vänta en stund och försök igen.'
        });
    }
});

