/**
 * Gemensamma hjälpfunktioner för Nabu Cursor-hooks.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * @returns {Record<string, unknown>}
 */
export function read_hook_input() {
    try {
        const raw = fs.readFileSync(0, 'utf8');
        if (!raw.trim()) {
            return {};
        }
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

/**
 * @returns {string}
 */
export function get_done_message() {
    const from_env = process.env.NABU_TASK_LABEL?.trim();
    let task = from_env || '';
    if (!task) {
        const task_path = path.join(REPO_ROOT, '.cursor', 'nabu_task_context.txt');
        if (fs.existsSync(task_path)) {
            task = fs.readFileSync(task_path, 'utf8').trim();
        }
    }
    if (task.length > 200) {
        task = task.slice(0, 200);
    }
    const em = '\u2014';
    if (task.length > 0) {
        return `Nu är jag klar ${em} ${task}`;
    }
    return 'Nu är jag klar';
}

/**
 * @param {import('../../scripts/nabu_work_state.mjs').FlushResult} result
 */
export function handle_flush_result(result) {
    if (result.sent) {
        send_webhook(get_done_message());
        return;
    }
    if (result.schedule_delayed_flush) {
        schedule_delayed_flush(get_done_message());
    }
}

/**
 * @param {string} message
 */
export function send_webhook(message) {
    const script = path.join(REPO_ROOT, 'scripts', 'nabu_send_webhook.ps1');
    spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', script,
        '-Message', message,
    ], {
        cwd: REPO_ROOT,
        stdio: 'ignore',
        detached: true,
    }).unref();
}

/**
 * @param {string} message
 */
export function schedule_delayed_flush(message) {
    const script = path.join(REPO_ROOT, 'scripts', 'nabu_delayed_flush.ps1');
    spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', script,
        '-Message', message,
    ], {
        cwd: REPO_ROOT,
        stdio: 'ignore',
        detached: true,
    }).unref();
}

/**
 * @param {unknown} hook_input
 * @returns {unknown[] | null}
 */
export function extract_todos_from_hook(hook_input) {
    if (!hook_input || typeof hook_input !== 'object') {
        return null;
    }
    const input = /** @type {Record<string, unknown>} */ (hook_input);
    const tool_input = input.tool_input ?? input.toolInput ?? input.input;
    if (!tool_input || typeof tool_input !== 'object') {
        return null;
    }
    const todos = /** @type {{ todos?: unknown }} */ (tool_input).todos;
    return Array.isArray(todos) ? todos : null;
}
