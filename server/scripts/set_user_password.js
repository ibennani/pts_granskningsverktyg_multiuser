import 'dotenv/config';
import readline from 'readline';
import bcrypt from 'bcrypt';
import { query } from '../db.js';

function ask_question(prompt) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function main() {
    try {
        const name_arg = process.argv.find((a) => a.startsWith('--name=')) || '';
        const password_arg = process.argv.find((a) => a.startsWith('--password=')) || '';
        let name = name_arg.split('=')[1] || '';
        let password = password_arg.split('=')[1] || '';

        if (!name) {
            name = (await ask_question('Användarnamn: ')).trim();
        }
        if (!password) {
            password = (await ask_question('Nytt lösenord: ')).trim();
        }

        if (!name) {
            console.error('Ett användarnamn krävs.');
            process.exit(1);
        }
        if (!password || password.length < 8) {
            console.error('Lösenordet måste vara minst 8 tecken.');
            process.exit(1);
        }

        const hash = await bcrypt.hash(password, 10);
        const result = await query(
            'UPDATE users SET password = $1 WHERE username = $2 RETURNING id, username, name, is_admin',
            [hash, name]
        );

        if (result.rows.length === 0) {
            console.error(`Ingen användare med användarnamn "${name}" hittades.`);
            process.exit(1);
        }

        const user = result.rows[0];
        console.log('Lösenord uppdaterat för användare:', user.username || user.name, user.id, 'is_admin:', user.is_admin);
        process.exit(0);
    } catch (err) {
        console.error('[set_user_password] Fel:', err?.message || err);
        process.exit(1);
    }
}

main();

