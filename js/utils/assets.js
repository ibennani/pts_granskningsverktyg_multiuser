import { app_runtime_refs } from './app_runtime_refs.js';

/** Base path för deploy under /v2 (sökväg måste matcha så att CSS/assets laddas rätt). */
const DEPLOY_BASE_PATH = '/v2';

/**
 * Returnerar appens rot-sökväg (base) så att CSS och andra assets hamnar rätt.
 * - Vid deploy under /v2 (t.ex. https://host/v2 eller https://host/v2/audit/1): returnerar "/v2/".
 * - Lokalt eller vid root: returnerar "/".
 */
export function get_app_base() {
    if (typeof window === 'undefined' || !window.location) return '/';
    const pathname = (window.location.pathname || '/').split('#')[0].split('?')[0].replace(/\/+$/, '') || '/';
    if (pathname === DEPLOY_BASE_PATH || pathname.startsWith(DEPLOY_BASE_PATH + '/')) return DEPLOY_BASE_PATH + '/';
    return '/';
}

/**
 * Löser en relativ eller absolut CSS/asset-sökväg mot appens rot.
 * Fungerar både lokalt (base "/") och vid deploy under /v2 (base "/v2/").
 */
export function resolve_asset_href(href) {
    if (typeof window === 'undefined' || !window.location || !href) return href;
    if (href.startsWith('http:') || href.startsWith('https:') || href.startsWith('//')) return href;
    const base = get_app_base();
    if (href.startsWith('/')) return base === '/' ? href : base.replace(/\/$/, '') + href;
    const relative = href.startsWith('./') ? href.slice(2) : href;
    return base + relative;
}

export function load_css(href, options = {}) {
    return new Promise((resolve, reject) => {
        const resolved_href = resolve_asset_href(href);
        if (document.querySelector(`link[href="${resolved_href}"]`)) {
            resolve();
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = resolved_href;

        // Timeout för CSS-laddning
        const timeout = options.timeout || 10000; // 10 sekunder default
        const timeoutId = setTimeout(() => {
            reject(new Error(`CSS load timeout: ${href}`));
            // Ta bort länken om den inte laddades i tid
            if (link.parentNode) {
                link.parentNode.removeChild(link);
            }
        }, timeout);

        link.onload = () => {
            clearTimeout(timeoutId);
            resolve();
        };

        link.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error(`Failed to load CSS: ${href}`));
        };

        document.head.appendChild(link);
    });
}

// Förbättrad CSS-laddningsfunktion med retry-logik
export async function load_css_with_retry(href, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await load_css(href, options);
            return; // Framgång!
        } catch (error) {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn(`CSS load attempt ${attempt}/${maxRetries} failed for ${href}:`, error.message);

            if (attempt === maxRetries) {
                // Sista försöket misslyckades
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn(`All CSS load attempts failed for ${href}. Component may render without proper styling.`);
                throw error;
            }

            // Vänta innan nästa försök
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}

// Säker CSS-laddning med användarvarning vid fel
export async function load_css_safely(href, componentName = 'Unknown', options = {}) {
    try {
        await load_css_with_retry(href, options);
    } catch (error) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn(`[${componentName}] Critical CSS loading failed:`, error);

        // Visa varning till användaren om styling kan vara fel
        if (app_runtime_refs.notification_component?.show_global_message) {
            const message = `Varning: Vissa stilar för ${componentName} kunde inte laddas korrekt.`;
            app_runtime_refs.notification_component.show_global_message(message, 'warning');
        }

        // Kasta felet vidare så att komponenten kan hantera det
        throw error;
    }
}

