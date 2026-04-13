/**
 * Avregistrerar alla service workers för aktuell origin och tar bort alla cache-lager
 * i Cache Storage API. Används vid omladdning efter ny deploy så att VitePWA/Workbox
 * inte levererar gamla förhandscachade JS/CSS/HTML.
 *
 * @returns {Promise<void>}
 */
export async function clear_same_origin_sw_and_caches() {
    if (typeof navigator === 'undefined') {
        return;
    }
    try {
        if (navigator.serviceWorker?.getRegistrations) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((reg) => reg.unregister()));
        }
    } catch (_) {
        /* ignoreras medvetet */
    }
    try {
        if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
            const names = await caches.keys();
            await Promise.all(names.map((name) => caches.delete(name)));
        }
    } catch (_) {
        /* ignoreras medvetet */
    }
}
