import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jest } from '@jest/globals';
import {
    FLUSH_RETRY_BUFFER_MS,
    MAX_CONCURRENT_SUBAGENTS,
    MIN_IDLE_MS,
    STALE_RESET_MS,
    SUBAGENT_HARD_LEAK_MS,
    SUBAGENT_LEAK_MS,
    compute_flush_retry_delay_ms,
    count_open_todos,
    create_default_state,
    maybe_reset_leaked_subagents,
    maybe_reset_leaked_todos,
    maybe_reset_stale,
    normalize_state,
    read_state,
    request_notify,
    subagent_start,
    subagent_stop,
    sync_todos,
    try_flush,
    write_state,
} from '../../scripts/nabu_work_state.mjs';

describe('nabu_work_state', () => {
    /** @type {string} */
    let state_path;

    beforeEach(() => {
        state_path = path.join(os.tmpdir(), `nabu-work-state-${Date.now()}-${Math.random()}.json`);
        process.env.NABU_WORK_STATE_PATH = state_path;
    });

    afterEach(() => {
        delete process.env.NABU_WORK_STATE_PATH;
        fs.rmSync(state_path, { force: true });
        fs.rmSync(`${state_path}.lock`, { force: true });
    });

    test('count_open_todos räknar pending och in_progress', () => {
        expect(count_open_todos([
            { id: '1', status: 'pending' },
            { id: '2', status: 'in_progress' },
            { id: '3', status: 'completed' },
            { id: '4', status: 'cancelled' },
        ])).toBe(2);
    });

    test('try_flush blockeras utan notify_requested', () => {
        const result = try_flush();
        expect(result.sent).toBe(false);
        expect(result.reason).toBe('no_request');
    });

    test('try_flush blockeras när underagenter kör', () => {
        request_notify();
        subagent_start();
        const result = try_flush();
        expect(result.sent).toBe(false);
        expect(result.reason).toBe('pending_subagents');
        expect(result.count).toBe(1);
    });

    test('try_flush blockeras när todos är öppna', () => {
        request_notify();
        sync_todos([
            { id: '1', status: 'in_progress' },
            { id: '2', status: 'completed' },
        ]);
        const result = try_flush();
        expect(result.sent).toBe(false);
        expect(result.reason).toBe('open_todos');
        expect(result.count).toBe(1);
    });

    test('try_flush skickar en gång vid idle och notify_requested', () => {
        request_notify();
        const state = read_state();
        state.notify_requested_at = Date.now() - MIN_IDLE_MS - 1;
        write_state(state);

        const first = try_flush();
        expect(first.sent).toBe(true);

        const second = try_flush();
        expect(second.sent).toBe(false);
        expect(second.reason).toBe('no_request');
    });

    test('upprepade request_notify ger fortfarande bara en flush', () => {
        request_notify();
        request_notify();
        const state = read_state();
        state.notify_requested_at = Date.now() - MIN_IDLE_MS - 1;
        write_state(state);

        const first = try_flush();
        expect(first.sent).toBe(true);
        const second = try_flush();
        expect(second.sent).toBe(false);
    });

    test('subagent_stop minskar räknaren och tillåter flush', () => {
        request_notify();
        subagent_start();
        subagent_stop();
        const state = read_state();
        state.notify_requested_at = Date.now() - MIN_IDLE_MS - 1;
        write_state(state);

        const result = try_flush();
        expect(result.sent).toBe(true);
    });

    test('läckta underagenter nollställs efter SUBAGENT_LEAK_MS', () => {
        request_notify();
        subagent_start();
        subagent_start();
        const state = read_state();
        const stale_at = Date.now() - SUBAGENT_LEAK_MS - 1;
        state.notify_requested_at = stale_at;
        state.last_subagent_activity_at = stale_at;
        write_state(state);

        const blocked = try_flush();
        expect(blocked.sent).toBe(true);
    });

    test('orimligt högt underagent-antal nollställs efter SUBAGENT_LEAK_MS', () => {
        request_notify();
        const state = read_state();
        state.pending_subagents = MAX_CONCURRENT_SUBAGENTS + 1;
        state.notify_requested_at = Date.now() - SUBAGENT_LEAK_MS - 1;
        state.last_subagent_activity_at = Date.now();
        write_state(state);

        const result = try_flush();
        expect(result.sent).toBe(true);
        expect(read_state().pending_subagents).toBe(0);
    });

    test('läckta todos nollställs efter SUBAGENT_LEAK_MS', () => {
        request_notify();
        const state = read_state();
        state.open_todo_count = 2;
        state.notify_requested_at = Date.now() - SUBAGENT_LEAK_MS - 1;
        write_state(state);

        const flushed = try_flush();
        expect(flushed.sent).toBe(true);
        expect(read_state().open_todo_count).toBe(0);
    });

    test('hård timeout nollställer kvarvarande underagenter', () => {
        const state = create_default_state();
        state.notify_requested = true;
        state.notify_requested_at = Date.now() - SUBAGENT_HARD_LEAK_MS - 1;
        state.pending_subagents = 2;
        state.last_subagent_activity_at = Date.now();

        const reset = maybe_reset_leaked_subagents(state);
        expect(reset).toBe(true);
        expect(state.pending_subagents).toBe(0);
    });

    test('pending_subagents kan schemalägga delayed flush', () => {
        request_notify();
        subagent_start();
        const result = try_flush();
        expect(result.sent).toBe(false);
        expect(result.reason).toBe('pending_subagents');
        expect(result.schedule_delayed_flush).toBe(true);
        expect(result.retry_delay_ms).toBe(SUBAGENT_LEAK_MS + FLUSH_RETRY_BUFFER_MS);
    });

    test('debounce blockeras och kan schemalägga delayed flush', () => {
        request_notify();
        const result = try_flush();
        expect(result.sent).toBe(false);
        expect(result.reason).toBe('debounce');
        expect(result.schedule_delayed_flush).toBe(true);
        expect(result.retry_delay_ms).toBeGreaterThan(0);
    });

    test('compute_flush_retry_delay_ms returnerar väntetid per orsak', () => {
        expect(compute_flush_retry_delay_ms({ reason: 'debounce', wait_ms: 1200 }))
            .toBe(1200 + FLUSH_RETRY_BUFFER_MS);
        expect(compute_flush_retry_delay_ms({ reason: 'pending_subagents' }))
            .toBe(SUBAGENT_LEAK_MS + FLUSH_RETRY_BUFFER_MS);
        expect(compute_flush_retry_delay_ms({ reason: 'open_todos' }))
            .toBe(SUBAGENT_LEAK_MS + FLUSH_RETRY_BUFFER_MS);
    });

    test('maybe_reset_stale nollställer fastnade räknare efter timeout', () => {
        const state = create_default_state();
        state.pending_subagents = 2;
        state.open_todo_count = 1;
        state.last_activity_at = Date.now() - STALE_RESET_MS - 1;

        const reset = maybe_reset_stale(state);
        expect(reset).toBe(true);
        expect(state.pending_subagents).toBe(0);
        expect(state.open_todo_count).toBe(0);
    });

    test('maybe_reset_leaked_subagents nollställer när klar-notis väntat tillräckligt', () => {
        const state = create_default_state();
        state.notify_requested = true;
        state.notify_requested_at = Date.now() - SUBAGENT_LEAK_MS - 1;
        state.pending_subagents = 2;

        const reset = maybe_reset_leaked_subagents(state);
        expect(reset).toBe(true);
        expect(state.pending_subagents).toBe(0);
    });

    test('maybe_reset_leaked_todos nollställer när klar-notis väntat tillräckligt', () => {
        const state = create_default_state();
        state.notify_requested = true;
        state.notify_requested_at = Date.now() - SUBAGENT_LEAK_MS - 1;
        state.open_todo_count = 1;

        const reset = maybe_reset_leaked_todos(state);
        expect(reset).toBe(true);
        expect(state.open_todo_count).toBe(0);
    });

    test('normalize_state skyddar mot ogiltig indata', () => {
        const normalized = normalize_state({
            pending_subagents: -3,
            open_todo_count: 'x',
            notify_requested: 1,
        });
        expect(normalized.pending_subagents).toBe(0);
        expect(normalized.open_todo_count).toBe(0);
        expect(normalized.notify_requested).toBe(true);
    });
});
