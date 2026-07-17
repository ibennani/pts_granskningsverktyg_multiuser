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
 * Anropar samma flush-skript som notify_done.cmd (en enda sändväg).
 * @param {string} [message]
 */
export function invoke_try_flush(message = '') {
    const script = path.join(REPO_ROOT, 'scripts', 'nabu_try_flush.ps1');
    /** @type {string[]} */
    const args = [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', script,
    ];
    const resolved_message = message.length > 0 ? message : get_done_message();
    if (resolved_message.length > 0) {
        args.push('-Message', resolved_message);
    }
    spawn('powershell.exe', args, {
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
