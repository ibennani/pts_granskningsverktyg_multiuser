import 'dotenv/config';
import { query } from '../db.js';

async function main() {
    const result = await query(
        'SELECT id, username, name, is_admin, created_at FROM users ORDER BY name'
    );
    console.log(JSON.stringify(result.rows, null, 2));
    process.exit(0);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
