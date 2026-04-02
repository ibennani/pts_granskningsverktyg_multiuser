// server/auth/jwt.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('KONFIGURATIONSFEL: JWT_SECRET måste sättas i .env innan servern startas.');
}
/** Standard 1 h; sätts via JWT_EXPIRES_IN i .env vid behov. */
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

/** Max ålder på JWT (iat) för förnyelse – efter detta krävs ny inloggning. */
const REFRESH_MAX_AGE_SEC = 7 * 24 * 60 * 60;

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

/**
 * Utfärdar ny JWT med samma payload om den gamla är kryptografiskt giltig
 * och utfärdad (iat) inom senaste 7 dygnen — även om access-token gått ut.
 * @param {string} old_token
 * @returns {string | null}
 */
export function refresh_token(old_token) {
    if (!old_token || typeof old_token !== 'string') return null;
    let decoded;
    try {
        decoded = jwt.verify(old_token, JWT_SECRET, { ignoreExpiration: true });
    } catch {
        return null;
    }
    const iat = decoded.iat;
    if (typeof iat !== 'number') return null;
    const now_sec = Math.floor(Date.now() / 1000);
    if (now_sec - iat > REFRESH_MAX_AGE_SEC) return null;
    return sign_token({
        id: decoded.id,
        name: decoded.name,
        is_admin: !!decoded.is_admin
    });
}
