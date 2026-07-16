/**
 * Arbetsregister för uppskjuten Nabu-klar-notis.
 * Spårar underagenter och öppna todos; skickar webhook högst en gång när kön är tom.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_IDLE_MS = 8000;
export const STALE_RESET_MS = 30 * 60 * 1000;
export const DELAYED_FLUSH_SECONDS = 10;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');

/** @typedef {{ version: number, pending_subagents: number, open_todo_count: number, notify_requested: boolean, delayed_flush_scheduled: boolean, last_activity_at: number }} NabuWorkState */

/**
 * @param {string} [repo_root]
 * @returns {{ state_path: string, lock_path: string, cursor_dir: string }}
 */
export function get_state_paths(repo_root = DEFAULT_REPO_ROOT) {
    const override = process.env.NABU_WORK_STATE_PATH;
    if (override) {
        const state_path = path.resolve(override);
        return {
            state_path,
            lock_path: `${state_path}.lock`,
            cursor_dir: path.dirname(state_path),
        };
    }
    const cursor_dir = path.join(repo_root, '.cursor');
    return {
        state_path: path.join(cursor_dir, 'nabu_work_state.json'),
        lock_path: path.join(cursor_dir, 'nabu_work_state.lock'),
        cursor_dir,
    };
}

/** @returns {NabuWorkState} */
export function create_default_state() {
    return {
        version: 1,
        pending_subagents: 0,
        open_todo_count: 0,
        notify_requested: false,
        delayed_flush_scheduled: false,
        last_activity_at: Date.now(),
    };
}

/**
 * @param {unknown} raw
 * @returns {NabuWorkState}
 */
export function normalize_state(raw) {
    const base = create_default_state();
    if (!raw || typeof raw !== 'object') {
        return base;
    }
    const obj = /** @type {Record<string, unknown>} */ (raw);
    return {
        version: 1,
        pending_subagents: Math.max(0, Number(obj.pending_subagents) || 0),
        open_todo_count: Math.max(0, Number(obj.open_todo_count) || 0),
        notify_requested: Boolean(obj.notify_requested),
        delayed_flush_scheduled: Boolean(obj.delayed_flush_scheduled),
        last_activity_at: Number(obj.last_activity_at) || Date.now(),
    };
}

/**
 * @param {string} [repo_root]
 * @returns {NabuWorkState}
 */
export function read_state(repo_root) {
    const { state_path } = get_state_paths(repo_root);
    if (!fs.existsSync(state_path)) {
        return create_default_state();
    }
    try {
        const raw = JSON.parse(fs.readFileSync(state_path, 'utf8'));
        return normalize_state(raw);
    } catch {
        return create_default_state();
    }
}

/**
 * @param {NabuWorkState} state
 * @param {string} [repo_root]
 */
export function write_state(state, repo_root) {
    const { state_path, cursor_dir } = get_state_paths(repo_root);
    fs.mkdirSync(cursor_dir, { recursive: true });
    const tmp = `${state_path}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, state_path);
}

/**
 * @param {(state: NabuWorkState) => unknown} fn
 * @param {string} [repo_root]
 * @returns {unknown}
 */
export function with_state_lock(fn, repo_root) {
    const { lock_path } = get_state_paths(repo_root);
    fs.mkdirSync(path.dirname(lock_path), { recursive: true });
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        try {
            const fd = fs.openSync(lock_path, 'wx');
            fs.closeSync(fd);
            try {
                const state = read_state(repo_root);
                const result = fn(state);
                write_state(state, repo_root);
                return result;
            } finally {
                fs.unlinkSync(lock_path);
            }
        } catch (err) {
            if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'EEXIST') {
                throw err;
            }
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
    throw new Error('[nabu_work_state] Kunde inte låsa state-filen inom tidsgräns.');
}

/**
 * @param {NabuWorkState} state
 * @returns {boolean}
 */
export function maybe_reset_stale(state) {
    const has_pending = state.pending_subagents > 0 || state.open_todo_count > 0;
    if (!has_pending) {
        return false;
    }
    const idle = Date.now() - state.last_activity_at;
    if (idle < STALE_RESET_MS) {
        return false;
    }
    state.pending_subagents = 0;
    state.open_todo_count = 0;
    state.delayed_flush_scheduled = false;
    state.last_activity_at = Date.now();
    return true;
}

/**
 * @param {unknown} todos
 * @returns {number}
 */
export function count_open_todos(todos) {
    if (!Array.isArray(todos)) {
        return 0;
    }
    return todos.filter((todo) => {
        if (!todo || typeof todo !== 'object') {
            return false;
        }
        const status = /** @type {{ status?: string }} */ (todo).status;
        return status === 'pending' || status === 'in_progress';
    }).length;
}

/**
 * @param {string} [repo_root]
 */
export function init_session_state(repo_root) {
    with_state_lock((state) => {
        maybe_reset_stale(state);
        const has_pending = state.pending_subagents > 0 || state.open_todo_count > 0;
        if (!has_pending) {
            state.notify_requested = false;
            state.delayed_flush_scheduled = false;
        }
        state.last_activity_at = Date.now();
    }, repo_root);
}

/**
 * @param {string} [repo_root]
 */
export function request_notify(repo_root) {
    with_state_lock((state) => {
        state.notify_requested = true;
        state.last_activity_at = Date.now();
    }, repo_root);
}

/**
 * @param {string} [repo_root]
 */
export function subagent_start(repo_root) {
    with_state_lock((state) => {
        state.pending_subagents += 1;
        state.last_activity_at = Date.now();
    }, repo_root);
}

/**
 * @param {string} [repo_root]
 */
export function subagent_stop(repo_root) {
    with_state_lock((state) => {
        state.pending_subagents = Math.max(0, state.pending_subagents - 1);
        state.last_activity_at = Date.now();
    }, repo_root);
}

/**
 * @param {unknown} todos
 * @param {string} [repo_root]
 */
export function sync_todos(todos, repo_root) {
    with_state_lock((state) => {
        state.open_todo_count = count_open_todos(todos);
        state.last_activity_at = Date.now();
    }, repo_root);
}

/**
 * @typedef {{ sent: boolean, reason?: string, wait_ms?: number, count?: number, schedule_delayed_flush?: boolean }} FlushResult
 */

/**
 * @param {string} [repo_root]
 * @returns {FlushResult}
 */
export function try_flush(repo_root) {
    return /** @type {FlushResult} */ (with_state_lock((state) => {
        maybe_reset_stale(state);

        if (!state.notify_requested) {
            return { sent: false, reason: 'no_request' };
        }
        if (state.pending_subagents > 0) {
            return { sent: false, reason: 'pending_subagents', count: state.pending_subagents };
        }
        if (state.open_todo_count > 0) {
            return { sent: false, reason: 'open_todos', count: state.open_todo_count };
        }

        const idle_ms = Date.now() - state.last_activity_at;
        if (idle_ms < MIN_IDLE_MS) {
            const wait_ms = MIN_IDLE_MS - idle_ms;
            let schedule_delayed_flush = false;
            if (!state.delayed_flush_scheduled) {
                state.delayed_flush_scheduled = true;
                schedule_delayed_flush = true;
            }
            return {
                sent: false,
                reason: 'debounce',
                wait_ms,
                schedule_delayed_flush,
            };
        }

        state.notify_requested = false;
        state.delayed_flush_scheduled = false;
        return { sent: true };
    }, repo_root));
}

/**
 * @param {string} [repo_root]
 */
export function clear_delayed_flush_scheduled(repo_root) {
    with_state_lock((state) => {
        state.delayed_flush_scheduled = false;
    }, repo_root);
}

/**
 * @param {string[]} argv
 */
function run_cli(argv) {
    const command = argv[0];
    if (!command) {
        console.error('[nabu_work_state] Ange kommando: init-session, request-notify, try-flush, subagent-start, subagent-stop, sync-todos');
        process.exit(1);
    }

    if (command === 'init-session') {
        init_session_state();
        return;
    }
    if (command === 'request-notify') {
        request_notify();
        return;
    }
    if (command === 'subagent-start') {
        subagent_start();
        return;
    }
    if (command === 'subagent-stop') {
        subagent_stop();
        return;
    }
    if (command === 'try-flush') {
        const result = try_flush();
        process.stdout.write(`${JSON.stringify(result)}\n`);
        return;
    }
    if (command === 'sync-todos') {
        const raw = argv[1];
        if (!raw) {
            console.error('[nabu_work_state] sync-todos kräver JSON-array som argument.');
            process.exit(1);
        }
        let todos;
        try {
            todos = JSON.parse(raw);
        } catch {
            console.error('[nabu_work_state] Ogiltig JSON för sync-todos.');
            process.exit(1);
        }
        sync_todos(todos);
        const result = try_flush();
        process.stdout.write(`${JSON.stringify(result)}\n`);
        return;
    }
    if (command === 'subagent-stop-and-flush') {
        subagent_stop();
        const result = try_flush();
        process.stdout.write(`${JSON.stringify(result)}\n`);
        return;
    }
    if (command === 'clear-delayed-flush-scheduled') {
        clear_delayed_flush_scheduled();
        return;
    }

    console.error(`[nabu_work_state] Okänt kommando: ${command}`);
    process.exit(1);
}

const is_main = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (is_main) {
    run_cli(process.argv.slice(2));
}
