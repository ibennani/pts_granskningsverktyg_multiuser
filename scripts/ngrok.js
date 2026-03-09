// scripts/ngrok.js – startar ngrok med URL från NGROK_URL (eller .env)
import 'dotenv/config';
import { spawn } from 'child_process';

const url = (process.env.NGROK_URL || '').trim();
const port = 11434;

if (!url) {
    console.warn('[ngrok] NGROK_URL är inte satt i .env – ngrok körs utan --url.');
}

const args = url ? ['http', '--url=' + url, String(port)] : ['http', String(port)];
const proc = spawn('ngrok', args, { stdio: 'inherit', shell: true });
proc.on('error', (err) => {
    console.error('[ngrok] Kunde inte starta ngrok:', err.message);
    process.exit(1);
});
proc.on('exit', (code) => {
    process.exit(code ?? 0);
});
