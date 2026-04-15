// server/ws.js – WebSocket för realtidsnotiser (t.ex. regelfil ändrad)
import { WebSocketServer } from 'ws';

let broadcast_fn = () => {};

/**
 * Accepterar uppgradering till /ws (direkt mot Node), /v2/ws (om proxy inte skriver om path),
 * samt /ws?... med queryparametrar.
 * @param {string|undefined} req_url
 * @returns {boolean}
 */
function is_websocket_upgrade_path(req_url) {
    if (!req_url || typeof req_url !== 'string') return false;
    const path = req_url.split('?')[0];
    return path === '/ws' || path === '/v2/ws';
}

/**
 * Initierar WebSocket-server kopplad till HTTP-servern.
 * @param {import('http').Server} http_server
 */
export function init_ws(http_server) {
    const wss = new WebSocketServer({ noServer: true });

    http_server.on('upgrade', (req, socket, head) => {
        if (is_websocket_upgrade_path(req.url)) {
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit('connection', ws, req);
            });
        }
    });

    const clients = new Set();
    wss.on('connection', (ws) => {
        clients.add(ws);
        ws.on('close', () => clients.delete(ws));
    });

    broadcast_fn = (data) => {
        const msg = typeof data === 'string' ? data : JSON.stringify(data);
        clients.forEach((c) => {
            if (c.readyState === 1) c.send(msg);
        });
    };
}

/**
 * Skickar meddelande till alla anslutna klienter.
 * @param {object} data - Objekt som skickas som JSON
 */
export function broadcast(data) {
    broadcast_fn(data);
}
