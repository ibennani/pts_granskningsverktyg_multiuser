#!/usr/bin/env node
/**
 * Kopierar alla användare (inkl. lösenordshash) från prod-databasen v2
 * till testserverns databas på samma Postgres-instans.
 *
 * Användning:
 *   npm run copy:v2-users-to-test-server
 */
import 'dotenv/config';

process.env.DEPLOY_USER = process.env.DEPLOY_USER || 'localiliben';
process.env.DEPLOY_SSH_HOSTNAME = process.env.DEPLOY_SSH_HOSTNAME || 'ux-granskningsverktyg.pts.ad';

const PROD_DB = process.env.GV_PROD_DB_NAME || 'granskningsverktyget';
const TEST_DB = process.env.GV_TEST_SERVER_DB_NAME || 'granskningsverktyget_test';
const DB_CONTAINER = process.env.GV_DB_CONTAINER || 'granskningsverktyget-db';
const DB_USER = process.env.GV_DB_USER || 'granskning';

const { exec, disconnect } = await import('./deploy-utils.js');

const clear_test_users_sql = 'DELETE FROM password_reset_tokens; DELETE FROM rule_edit_locks; DELETE FROM audit_edit_locks; DELETE FROM users;';

const remote_cmd = [
    `docker exec ${DB_CONTAINER} pg_dump -U ${DB_USER} -d ${PROD_DB} -t public.users --data-only --column-inserts -f /tmp/users_v2_copy.sql`,
    `docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${TEST_DB} -v ON_ERROR_STOP=1 -c ${JSON.stringify(clear_test_users_sql)}`,
    `docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${TEST_DB} -v ON_ERROR_STOP=1 -f /tmp/users_v2_copy.sql`,
    `docker exec ${DB_CONTAINER} rm -f /tmp/users_v2_copy.sql`,
    `docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${TEST_DB} -t -c "SELECT COUNT(*) AS users FROM users;"`,
    `docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${PROD_DB} -t -c "SELECT COUNT(*) AS users FROM users;"`
].join(' && ');

async function main() {
    try {
        console.log(`[copy:v2-users-to-test-server] Kopierar användare ${PROD_DB} → ${TEST_DB}...`);
        await exec(remote_cmd, { cwd: false });
        console.log('[copy:v2-users-to-test-server] Klart. Inloggningsuppgifter matchar nu v2.');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[copy:v2-users-to-test-server] Fel:', err.message);
    process.exit(1);
});
