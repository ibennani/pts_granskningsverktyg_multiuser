/**
 * @fileoverview Kontrollerar om webbläsaren rapporterar uppkoppling (navigator.onLine).
 */

/**
 * Returnerar true om webbläsaren rapporterar online, annars false.
 */
export function is_browser_online(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine !== false;
}
