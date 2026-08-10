/**
 * Arbetsregister för uppskjuten Nabu-klar-notis.
 * Spårar underagenter och öppna todos; skickar webhook högst en gång när kön är tom.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_IDLE_MS = 3000;
export const STALE_RESET_MS = 30 * 60 * 1000;
export const SUBAGENT_LEAK_MS = 8000;
export const SUBAGENT_HARD_LEAK_MS = 16000;
export const MAX_CONCURRENT_SUBAGENTS = 4;
export const DELAYED_FLUSH_SECONDS = 10;
export const FLUSH_RETRY_BUFFER_MS = 500;
/** Max väntetid i notify_done innan vi ger upp (synkron retry i nabu_try_flush.ps1). */
export const SYNC_FLUSH_MAX_MS = 25000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');

/** @typedef {{ version: number, pending_subagents: number, open_todo_count: number, notify_requested: boolean, notify_requested_at: number, delayed_flush_scheduled: boolean, last_activity_at: number, last_subagent_activity_at: number }} NabuWorkState */

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
        notify_requested_at: 0,
        delayed_flush_scheduled: false,
        last_activity_at: Date.now(),
        last_subagent_activity_at: 0,
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
        notify_requested_at: Math.max(0, Number(obj.notify_requested_at) || 0),
        delayed_flush_scheduled: Boolean(obj.delayed_flush_scheduled),
        last_activity_at: Number(obj.last_activity_at) || Date.now(),
        last_subagent_activity_at: Math.max(0, Number(obj.last_subagent_activity_at) || 0),
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
    const content = `${JSON.stringify(state, null, 2)}\n`;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
        try {
            fs.writeFileSync(state_path, content, 'utf8');
            return;
        } catch (err) {
            const code = /** @type {NodeJS.ErrnoException} */ (err).code;
            if (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') {
                Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
                continue;
            }
            throw err;
        }
    }
    const tmp = `${state_path}.tmp`;
    fs.writeFileSync(tmp, content, 'utf8');
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
 * Nollställer kvarvarande underagent-räknare utan aktiv klar-notis (läckta hooks).
 * @param {NabuWorkState} state
 * @returns {boolean}
 */
export function maybe_reset_orphaned_subagents(state) {
    if (state.pending_subagents === 0) {
        return false;
    }
    if (state.notify_requested) {
        return false;
    }
    const activity_at = state.last_subagent_activity_at || state.last_activity_at;
    if (Date.now() - activity_at < SUBAGENT_LEAK_MS) {
        return false;
    }
    state.pending_subagents = 0;
    return true;
}

/**
 * Nollställer läckta underagent-räknare när klar-notis väntat tillräckligt länge.
 * @param {NabuWorkState} state
 * @returns {boolean}
 */
export function maybe_reset_leaked_subagents(state) {
    if (!state.notify_requested || state.pending_subagents === 0) {
        return false;
    }
    if (state.open_todo_count > 0) {
        return false;
    }
    const requested_at = state.notify_requested_at || state.last_activity_at;
    const waited_ms = Date.now() - requested_at;
    if (waited_ms < SUBAGENT_LEAK_MS) {
        return false;
    }
    if (state.pending_subagents > MAX_CONCURRENT_SUBAGENTS) {
        state.pending_subagents = 0;
        return true;
    }
    if (waited_ms >= SUBAGENT_HARD_LEAK_MS) {
        state.pending_subagents = 0;
        return true;
    }
    const subagent_after_notify = state.last_subagent_activity_at > requested_at;
    if (subagent_after_notify && Date.now() - state.last_subagent_activity_at < SUBAGENT_LEAK_MS) {
        return false;
    }
    state.pending_subagents = 0;
    return true;
}

/**
 * Nollställer fastnat todo-antal när klar-notis väntat tillräckligt länge.
 * @param {NabuWorkState} state
 * @returns {boolean}
 */
export function maybe_reset_leaked_todos(state) {
    if (!state.notify_requested || state.open_todo_count === 0) {
        return false;
    }
    if (state.pending_subagents > 0) {
        return false;
    }
    const requested_at = state.notify_requested_at || state.last_activity_at;
    if (Date.now() - requested_at < SUBAGENT_LEAK_MS) {
        return false;
    }
    state.open_todo_count = 0;
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
        maybe_reset_orphaned_subagents(state);
        maybe_reset_leaked_subagents(state);
        maybe_reset_leaked_todos(state);
    }, repo_root);
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} [details]
 * @param {string} [repo_root]
 */
export function append_debug_log(event, details = {}, repo_root) {
    const { cursor_dir } = get_state_paths(repo_root);
    const log_path = path.join(cursor_dir, 'nabu_notify_debug.log');
    const line = `${new Date().toISOString()} ${event} ${JSON.stringify(details)}\n`;
    try {
        fs.mkdirSync(cursor_dir, { recursive: true });
        fs.appendFileSync(log_path, line, 'utf8');
    } catch {
        // Debug-logg ska aldrig stoppa notisflödet.
    }
}

/**
 * @param {FlushResult} result
 * @returns {number}
 */
export function compute_flush_retry_delay_ms(result) {
    if (result.reason === 'debounce' && typeof result.wait_ms === 'number') {
        return result.wait_ms + FLUSH_RETRY_BUFFER_MS;
    }
    if (result.reason === 'pending_subagents' || result.reason === 'open_todos') {
        return SUBAGENT_LEAK_MS + FLUSH_RETRY_BUFFER_MS;
    }
    return DELAYED_FLUSH_SECONDS * 1000;
}

/**
 * @param {string} [repo_root]
 */
export function request_notify(repo_root) {
    with_state_lock((state) => {
        const now = Date.now();
        state.notify_requested = true;
        if (!state.notify_requested_at) {
            state.notify_requested_at = now;
        }
        state.delayed_flush_scheduled = false;
        state.last_activity_at = now;
    }, repo_root);
    append_debug_log('request_notify', {}, repo_root);
}

/**
 * Återställer klar-notis om webhook-sändning misslyckades efter try_flush.
 * @param {string} [repo_root]
 */
export function requeue_notify(repo_root) {
    with_state_lock((state) => {
        const now = Date.now();
        state.notify_requested = true;
        if (!state.notify_requested_at) {
            state.notify_requested_at = now;
        }
        state.delayed_flush_scheduled = false;
        state.last_activity_at = now;
    }, repo_root);
    append_debug_log('requeue_notify', {}, repo_root);
}

/**
 * @param {string} [repo_root]
 */
export function subagent_start(repo_root) {
    with_state_lock((state) => {
        const now = Date.now();
        state.pending_subagents += 1;
        state.last_activity_at = now;
        state.last_subagent_activity_at = now;
    }, repo_root);
}

/**
 * @param {string} [repo_root]
 */
export function subagent_stop(repo_root) {
    with_state_lock((state) => {
        const now = Date.now();
        state.pending_subagents = Math.max(0, state.pending_subagents - 1);
        state.last_activity_at = now;
        state.last_subagent_activity_at = now;
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
 * @typedef {{ sent: boolean, reason?: string, wait_ms?: number, count?: number, schedule_delayed_flush?: boolean, retry_delay_ms?: number }} FlushResult
 */

/**
 * @param {string} [repo_root]
 * @returns {FlushResult}
 */
function should_schedule_delayed_flush(state) {
    if (state.delayed_flush_scheduled) {
        return false;
    }
    state.delayed_flush_scheduled = true;
    return true;
}

function build_flush_result(state, partial) {
    /** @type {FlushResult} */
    const result = { ...partial };
    if (result.schedule_delayed_flush) {
        result.retry_delay_ms = compute_flush_retry_delay_ms(result);
    }
    append_debug_log('try_flush', {
        sent: result.sent ?? false,
        reason: result.reason ?? null,
        pending_subagents: state.pending_subagents,
        open_todo_count: state.open_todo_count,
        notify_requested: state.notify_requested,
        retry_delay_ms: result.retry_delay_ms ?? null,
    });
    return result;
}

export function try_flush(repo_root) {
    return /** @type {FlushResult} */ (with_state_lock((state) => {
        maybe_reset_stale(state);
        maybe_reset_orphaned_subagents(state);
        maybe_reset_leaked_subagents(state);
        maybe_reset_leaked_todos(state);

        if (!state.notify_requested) {
            return build_flush_result(state, { sent: false, reason: 'no_request' });
        }
        if (state.pending_subagents > 0) {
            return build_flush_result(state, {
                sent: false,
                reason: 'pending_subagents',
                count: state.pending_subagents,
                schedule_delayed_flush: should_schedule_delayed_flush(state),
            });
        }
        if (state.open_todo_count > 0) {
            return build_flush_result(state, {
                sent: false,
                reason: 'open_todos',
                count: state.open_todo_count,
                schedule_delayed_flush: should_schedule_delayed_flush(state),
            });
        }

        const debounce_base = state.notify_requested_at || state.last_activity_at;
        const idle_ms = Date.now() - debounce_base;
        if (idle_ms < MIN_IDLE_MS) {
            const wait_ms = MIN_IDLE_MS - idle_ms;
            return build_flush_result(state, {
                sent: false,
                reason: 'debounce',
                wait_ms,
                schedule_delayed_flush: should_schedule_delayed_flush(state),
            });
        }

        state.notify_requested = false;
        state.notify_requested_at = 0;
        state.delayed_flush_scheduled = false;
        return build_flush_result(state, { sent: true });
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
    if (command === 'requeue-notify') {
        requeue_notify();
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
