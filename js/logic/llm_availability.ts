/**
 * @file Klientcache för om AI-chatt är tillgänglig (aktiverad och fungerande anslutning).
 */

import { get_auth_token, get_llm_availability } from '../api/client.js';

const AVAILABILITY_TTL_MS = 120_000;
const AVAILABILITY_CHANGED_EVENT = 'gv:llm_availability_changed';
export const LLM_CHAT_AVAILABLE_STORAGE_KEY = 'gv_llm_chat_available';

interface AvailabilityCache {
    available: boolean;
    fetched_at: number;
}

let cache: AvailabilityCache | null = null;
let refresh_in_flight: Promise<boolean> | null = null;
let last_fetch_failed = false;

function dispatch_availability_changed(available: boolean): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent(AVAILABILITY_CHANGED_EVENT, { detail: { available } })
    );
}

function write_stored_llm_chat_available(available: boolean): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(LLM_CHAT_AVAILABLE_STORAGE_KEY, available ? '1' : '0');
}

function read_stored_llm_chat_available(): boolean {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(LLM_CHAT_AVAILABLE_STORAGE_KEY) === '1';
}

export function apply_llm_chat_available_from_user(user: { llm_chat_available?: unknown } | null | undefined): void {
    if (!user || user.llm_chat_available === undefined) return;
    const available = user.llm_chat_available === true;
    write_stored_llm_chat_available(available);
    const previous = cache?.available;
    cache = { available, fetched_at: Date.now() };
    if (previous !== available) {
        dispatch_availability_changed(available);
    }
}

export function is_llm_chat_available(): boolean {
    if (cache?.available === true) return true;
    return read_stored_llm_chat_available();
}

export function invalidate_llm_availability_cache(): void {
    cache = null;
    last_fetch_failed = false;
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(LLM_CHAT_AVAILABLE_STORAGE_KEY);
    }
}

async function fetch_llm_availability(): Promise<boolean> {
    if (typeof window !== 'undefined' && !get_auth_token()) {
        return false;
    }
    try {
        const result = await get_llm_availability();
        const available = result?.available === true;
        const previous = cache?.available;
        cache = { available, fetched_at: Date.now() };
        write_stored_llm_chat_available(available);
        last_fetch_failed = false;
        if (previous !== available) {
            dispatch_availability_changed(available);
        }
        return available;
    } catch {
        last_fetch_failed = true;
        return read_stored_llm_chat_available();
    }
}

export async function refresh_llm_availability(force = false): Promise<boolean> {
    if (!force && !last_fetch_failed && cache && Date.now() - cache.fetched_at < AVAILABILITY_TTL_MS) {
        return cache.available;
    }
    if (refresh_in_flight) {
        return refresh_in_flight;
    }
    refresh_in_flight = fetch_llm_availability().finally(() => {
        refresh_in_flight = null;
    });
    return refresh_in_flight;
}

export { AVAILABILITY_CHANGED_EVENT };
