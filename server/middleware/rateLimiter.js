import rateLimit from 'express-rate-limit';

export const login_rate_limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        res.status(429).json({ error: 'För många inloggningsförsök, försök igen om 15 minuter' });
    }
});

