// server/auth/middleware.js
import { verify_token } from './jwt.js';

/**
 * Kräver giltig JWT i Authorization: Bearer <token>. Sätter req.user.
 */
export function requireAuth(req, res, next) {
    const auth_header = req.headers.authorization;
    if (!auth_header || !auth_header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token krävs (Authorization: Bearer <token>)' });
    }
    const token = auth_header.slice(7).trim();
    const user = verify_token(token);
    if (!user) {
        return res.status(401).json({ error: 'Ogiltig eller utgången token' });
    }
    req.user = user;
    next();
}

/**
 * Kräver att användaren är admin (is_admin === true). Anropa efter requireAuth.
 */
export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Autentisering krävs' });
    }
    if (req.user.is_admin !== true) {
        return res.status(403).json({ error: 'Endast administratörer har åtkomst' });
    }
    next();
}
