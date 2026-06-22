// scripts/ngrok.js – startar ngrok via @ngrok/ngrok (ingen separat installation krävs)
// Kräver NGROK_AUTHTOKEN i .env. Valfritt: NGROK_URL (t.ex. https://din-subdomain.ngrok-free.app) för fast adress.
import 'dotenv/config';
import ngrok from '@ngrok/ngrok';

const port = 11434;
const url_raw = (process.env.NGROK_URL || '').trim();
const authtoken = (process.env.NGROK_AUTHTOKEN || '').trim();

function get_domain() {
    if (!url_raw) return undefined;
    try {
        return new URL(url_raw).hostname;
    } catch {
        return url_raw;
    }
}

async function run() {
    if (!authtoken) {
        console.warn('[ngrok] NGROK_AUTHTOKEN är inte satt i .env. Lägg till din token från https://dashboard.ngrok.com/get-started/your-authtoken');
        keep_alive();
        return;
    }

    const domain = get_domain();
    if (!domain && url_raw) {
        console.warn('[ngrok] NGROK_URL kunde inte tolkas som domän – använd t.ex. https://din-subdomain.ngrok-free.app');
    }
    if (!domain) {
        console.warn('[ngrok] NGROK_URL är inte satt – ngrok använder slumpad URL (fungerar fint).');
    }

    try {
        const opts = {
            addr: port,
            authtoken_from_env: true,
            ...(domain && { domain })
        };
        const listener = await ngrok.forward(opts);
        console.log('[ngrok] Ingress aktiverad:', listener.url());
        process.stdin.resume();
        setInterval(() => {}, 60000);
    } catch (err) {
        console.warn('[ngrok] Ngrok startades inte:', err?.message || err);
        keep_alive();
    }
}

function keep_alive() {
    setInterval(() => {}, 60000);
}

run();
