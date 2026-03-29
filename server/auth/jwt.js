// server/auth/jwt.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('KONFIGURATIONSFEL: JWT_SECRET måste sättas i .env innan servern startas.');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Signera en JWT med användardata.
 * @param {{ id: string, name: string, is_admin: boolean }} payload
 * @returns {string}
 */
export function sign_token(payload) {
    return jwt.sign(
        { id: payload.id, name: payload.name, is_admin: payload.is_admin },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Verifiera JWT och returnera payload.
 * @param {string} token
 * @returns {{ id: string, name: string, is_admin: boolean } | null}
 */
export function verify_token(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return {
            id: decoded.id,
            name: decoded.name,
            is_admin: !!decoded.is_admin
        };
    } catch {
        return null;
    }
}
