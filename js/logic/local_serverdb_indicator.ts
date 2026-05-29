/**
 * Visuell markör när Leffe körs lokalt mot serverns databas (npm run dev:serverdb).
 * @module js/logic/local_serverdb_indicator
 */
/// <reference types="vite/client" />

const VIEWPORT_CLASS = 'local-serverdb-viewport';

export function is_local_serverdb_dev_instance(): boolean {
    return import.meta.env.VITE_LOCAL_SERVERDB === '1';
}

/** Sätter klass på html så CSS kan rita röd viewport-ram. */
export function apply_local_serverdb_viewport_indicator(): void {
    if (typeof document === 'undefined') return;
    if (!is_local_serverdb_dev_instance()) return;
    document.documentElement.classList.add(VIEWPORT_CLASS);
}
