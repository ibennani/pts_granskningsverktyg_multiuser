/**
 * @fileoverview Begränsar parallella sidrapport-besök per värdnamn och paus mellan besök.
 */
import { Semaphore } from './semaphore.js';
import {
    get_snapshot_host_cooldown_ms,
    get_snapshot_host_max_concurrency,
} from './audit_snapshot_config.js';

const host_semaphores = new Map<string, Semaphore>();
const host_last_finished_at = new Map<string, number>();

export function normalize_snapshot_capture_hostname(url: string): string {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return 'unknown';
    }
}

function get_host_semaphore(hostname: string): Semaphore {
    let semaphore = host_semaphores.get(hostname);
    if (!semaphore) {
        semaphore = new Semaphore(get_snapshot_host_max_concurrency());
        host_semaphores.set(hostname, semaphore);
    }
    return semaphore;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export async function acquire_snapshot_host_slot(
    url: string
): Promise<{ release: () => void }> {
    const hostname = normalize_snapshot_capture_hostname(url);
    const semaphore = get_host_semaphore(hostname);
    await semaphore.acquire();

    const cooldown_ms = get_snapshot_host_cooldown_ms();
    const last_finished_at = host_last_finished_at.get(hostname) ?? 0;
    const wait_ms = cooldown_ms - (Date.now() - last_finished_at);
    if (wait_ms > 0) {
        await delay(wait_ms);
    }

    return {
        release: () => {
            host_last_finished_at.set(hostname, Date.now());
            semaphore.release();
        },
    };
}

export function reset_snapshot_host_throttle_for_tests(): void {
    host_semaphores.clear();
    host_last_finished_at.clear();
}
