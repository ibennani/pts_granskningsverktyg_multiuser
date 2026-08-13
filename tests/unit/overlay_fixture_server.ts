/**
 * @fileoverview Lokal HTTP-server för overlay-fixtures.
 */
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
export const OVERLAY_FIXTURE_DIR = path.join(spec_dir, '../fixtures/overlays');

export async function start_overlay_fixture_server(): Promise<{
    base_url: string;
    close: () => Promise<void>;
}> {
    const server = http.createServer(async (req, res) => {
        const rel = req.url === '/' ? '/newsletter.html' : String(req.url || '/newsletter.html');
        const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
        const file_path = path.join(OVERLAY_FIXTURE_DIR, safe.replace(/^\//, ''));
        try {
            const body = await fs.readFile(file_path, 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(body);
        } catch {
            res.writeHead(404);
            res.end('Not found');
        }
    });

    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    return {
        base_url: `http://127.0.0.1:${port}`,
        close: () =>
            new Promise((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            }),
    };
}
