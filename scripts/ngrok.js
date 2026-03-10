// scripts/ngrok.js – dödar befintlig ngrok och startar om med URL från NGROK_URL (eller .env)
import 'dotenv/config';
import { spawn } from 'child_process';

const url = (process.env.NGROK_URL || '').trim();
const port = 11434;

if (!url) {
    console.warn('[ngrok] NGROK_URL är inte satt i .env – ngrok körs utan --url.');
}

function kill_existing_ngrok(done) {
    const is_win = process.platform === 'win32';
    const kill_proc = is_win
        ? spawn('taskkill', ['/f', '/im', 'ngrok.exe'], { stdio: 'ignore' })
        : spawn('sh', ['-c', 'pkill -f ngrok || true'], { stdio: 'ignore' });
    kill_proc.on('close', () => {
        setTimeout(done, 500);
    });
    kill_proc.on('error', () => setTimeout(done, 500));
}

function start_ngrok() {
    const args = url ? ['http', '--url=' + url, String(port)] : ['http', String(port)];
    const proc = spawn('ngrok', args, { stdio: 'inherit', shell: true });
    proc.on('error', (err) => {
        console.warn('[ngrok] Ngrok startades inte (saknas i PATH eller ej installerat). Dev fortsätter utan ngrok.');
        keep_alive();
    });
    proc.on('exit', (code) => {
        const sigterm = code === 0 || code === 143 || code === null;
        if (sigterm) {
            process.exit(code ?? 0);
        } else {
            keep_alive();
        }
    });
}

function keep_alive() {
    setInterval(() => {}, 60000);
}

kill_existing_ngrok(start_ngrok);
