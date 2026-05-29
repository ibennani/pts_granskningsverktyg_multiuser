#!/usr/bin/env node
/**
 * SSH-tunnel: lokal port → Postgres på deploy-servern (127.0.0.1:5432 där).
 * Håller tunneln vid liv och återansluter vid nätverksfel.
 */
import 'dotenv/config';
import net from 'node:net';
import { Client } from 'ssh2';

const raw_host = process.env.DEPLOY_HOST || 'ux-granskningsverktyg.pts.ad';
const host_parts = raw_host.includes('@') ? raw_host.split('@') : [null, raw_host];
const ssh_user = host_parts[0] || process.env.DEPLOY_USER || process.env.USERNAME || process.env.USER || 'granskning';
const host = host_parts[1] || raw_host;
const ssh_password = process.env.DEPLOY_SSH_PASSWORD || '';
const local_port = Number.parseInt(process.env.GV_DB_TUNNEL_LOCAL_PORT || '5433', 10);
const remote_db_host = process.env.GV_DB_TUNNEL_REMOTE_HOST || '127.0.0.1';
const remote_db_port = Number.parseInt(process.env.GV_DB_TUNNEL_REMOTE_PORT || '5432', 10);
const ready_timeout_ms = Number.parseInt(process.env.DEPLOY_SSH_READY_TIMEOUT_MS || '90000', 10);
const reconnect_ms = Number.parseInt(process.env.GV_DB_TUNNEL_RECONNECT_MS || '3000', 10);

/** @type {net.Server|null} */
let local_server = null;
/** @type {Client|null} */
let ssh_client = null;
/** @type {NodeJS.Timeout|null} */
let reconnect_timer = null;
let shutting_down = false;
let tunnel_ready_logged = false;

function log(msg) {
    console.info(`[TUNNEL] ${msg}`);
}

function fail(msg) {
    console.error(`[TUNNEL] ${msg}`);
    process.exit(1);
}

function attach_bidirectional_pipe(local_socket, stream) {
    const cleanup = () => {
        if (!local_socket.destroyed) {
            local_socket.destroy();
        }
        if (stream && !stream.destroyed && typeof stream.destroy === 'function') {
            stream.destroy();
        }
    };
    local_socket.on('error', cleanup);
    stream.on('error', cleanup);
    local_socket.pipe(stream);
    stream.pipe(local_socket);
}

function close_local_server() {
    if (!local_server) return;
    try {
        local_server.close();
    } catch (_) {
        /* ignoreras */
    }
    local_server = null;
}

function start_local_server() {
    if (local_server) return;

    local_server = net.createServer((local_socket) => {
        local_socket.on('error', () => {
            if (!local_socket.destroyed) local_socket.destroy();
        });

        if (!ssh_client) {
            local_socket.destroy();
            return;
        }

        ssh_client.forwardOut(
            local_socket.remoteAddress || '127.0.0.1',
            local_socket.remotePort || 0,
            remote_db_host,
            remote_db_port,
            (err, stream) => {
                if (err) {
                    local_socket.destroy();
                    return;
                }
                attach_bidirectional_pipe(local_socket, stream);
            }
        );
    });

    local_server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            log(`Port ${local_port} används redan – antar att tunneln redan kör.`);
            process.exit(0);
        }
        log(`Lokal lyssnare fel: ${err.message}`);
        close_local_server();
        schedule_reconnect();
    });

    local_server.listen(local_port, '127.0.0.1', () => {
        log(`Lyssnar på 127.0.0.1:${local_port} → ${host}:${remote_db_port}`);
        if (!tunnel_ready_logged) {
            log('Tunnel klar.');
            tunnel_ready_logged = true;
        }
    });
}

function schedule_reconnect() {
    if (shutting_down || reconnect_timer) return;
    log(`Återansluter om ${reconnect_ms / 1000} s…`);
    reconnect_timer = setTimeout(() => {
        reconnect_timer = null;
        connect_ssh();
    }, reconnect_ms);
}

function teardown_ssh() {
    if (ssh_client) {
        try {
            ssh_client.end();
        } catch (_) {
            /* ignoreras */
        }
        ssh_client = null;
    }
}

function connect_ssh() {
    if (shutting_down) return;

    if (!ssh_password) {
        fail('DEPLOY_SSH_PASSWORD saknas i .env – behövs för automatisk tunnel.');
    }

    teardown_ssh();
    ssh_client = new Client();

    ssh_client.on('ready', () => {
        start_local_server();
    });

    ssh_client.on('error', (err) => {
        log(`SSH-fel: ${err.message}`);
        teardown_ssh();
        close_local_server();
        schedule_reconnect();
    });

    ssh_client.on('close', () => {
        if (shutting_down) return;
        log('SSH-anslutning stängd.');
        teardown_ssh();
        close_local_server();
        schedule_reconnect();
    });

    ssh_client.connect({
        host,
        username: ssh_user,
        password: ssh_password,
        tryKeyboard: true,
        readyTimeout: ready_timeout_ms,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3
    });
}

function shutdown() {
    shutting_down = true;
    if (reconnect_timer) {
        clearTimeout(reconnect_timer);
        reconnect_timer = null;
    }
    close_local_server();
    teardown_ssh();
    process.exit(0);
}

process.on('uncaughtException', (err) => {
    log(`Oväntat fel: ${err.message}`);
    teardown_ssh();
    close_local_server();
    schedule_reconnect();
});

process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    log(`Ohanterat promise-fel: ${msg}`);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

connect_ssh();
