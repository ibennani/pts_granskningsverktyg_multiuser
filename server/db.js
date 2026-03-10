// server/db.js
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://granskning:granskning@localhost:5432/granskningsverktyget',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    maxLifetimeSeconds: 300
});

pool.on('error', (err) => {
    console.error('[DB] Pool error (anslutning tas bort från poolen):', err.message);
});

const is_connection_error = (err) => {
    const msg = (err?.message || '').toLowerCase();
    const code = err?.code || '';
    return (
        code === 'ECONNRESET' ||
        code === 'ECONNREFUSED' ||
        code === 'ETIMEDOUT' ||
        code === 'ENOTFOUND' ||
        msg.includes('connection terminated') ||
        msg.includes('connection closed') ||
        msg.includes('socket hang up')
    );
};

export async function query(text, params) {
    const client = await pool.connect();
    let released = false;
    const do_release = (destroy = false) => {
        if (!released) {
            released = true;
            client.release(destroy);
        }
    };
    try {
        await client.query("SET timezone = 'UTC'");
        return await client.query(text, params);
    } catch (err) {
        do_release(true);
        if (is_connection_error(err)) {
            const retry_client = await pool.connect();
            try {
                await retry_client.query("SET timezone = 'UTC'");
                return await retry_client.query(text, params);
            } finally {
                retry_client.release();
            }
        }
        throw err;
    } finally {
        do_release();
    }
}

export { pool };
