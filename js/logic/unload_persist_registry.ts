/**
 * @fileoverview Synkrona hooks som körs före serversynk vid pagehide / dold flik.
 */

export type UnloadPersistReason = 'pagehide' | 'beforeunload' | 'visibilitychange';

type UnloadPersistHook = (reason: UnloadPersistReason) => void;

const hooks = new Map<string, UnloadPersistHook>();

export function register_unload_persist_hook(id: string, hook: UnloadPersistHook): void {
    if (!id || typeof hook !== 'function') return;
    hooks.set(id, hook);
}

export function unregister_unload_persist_hook(id: string): void {
    if (!id) return;
    hooks.delete(id);
}

export function run_unload_persist_hooks(reason: UnloadPersistReason): void {
    hooks.forEach((hook) => {
        try {
            hook(reason);
        } catch (error: unknown) {
            if (typeof window !== 'undefined' && window.ConsoleManager?.warn) {
                window.ConsoleManager.warn('[UnloadPersist] Hook failed:', error);
            }
        }
    });
}

/** Endast för enhetstester. */
export function clear_unload_persist_hooks_for_testing(): void {
    hooks.clear();
}
