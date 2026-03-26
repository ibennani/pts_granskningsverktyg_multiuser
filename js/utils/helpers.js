// js/utils/helpers.js
'use-strict';

export function generate_uuid_v4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function get_current_user_name() {
    if (typeof window === 'undefined') return '';
    return (window.__GV_CURRENT_USER_NAME__ ||
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gv_current_user_name'))) || '';
}

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
        let timeoutId;
        
        link.onload = () => {
            clearTimeout(timeoutId);
            resolve();
        };
        
        link.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error(`Failed to load CSS: ${href}`));
        };
        
        // Timeout-hantering
        timeoutId = setTimeout(() => {
            reject(new Error(`CSS load timeout: ${href}`));
            // Ta bort länken om den inte laddades i tid
            if (link.parentNode) {
                link.parentNode.removeChild(link);
            }
        }, timeout);
        
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
        if (window.NotificationComponent?.show_global_message) {
            const message = `Varning: Vissa stilar för ${componentName} kunde inte laddas korrekt.`;
            window.NotificationComponent.show_global_message(message, 'warning');
        }
        
        // Kasta felet vidare så att komponenten kan hantera det
        throw error;
    }
}

/**
 * Tidsstämplar från servern (PostgreSQL TIMESTAMP) kommer utan tidszon.
 * Tolka dem som UTC så att toLocaleString() visar rätt lokal tid.
 */
function ensure_utc_for_parsing(iso_string) {
    if (typeof iso_string !== 'string') return iso_string;
    const s = iso_string.trim();
    if (!s) return s;
    if (/Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) return s;
    if (/\d{4}-\d{2}-\d{2}[T \t]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/i.test(s)) return s + 'Z';
    return s;
}

/**
 * @param {string} iso_string - ISO-datum/tid (ev. utan tidszon, tolkas som UTC).
 * @param {string} [lang_code='en-GB'] - Locale för formatering.
 * @param {{ showSeconds?: boolean }} [opts] - showSeconds: false för att inte visa sekunder (standard true).
 */
export function format_iso_to_local_datetime(iso_string, lang_code = 'en-GB', opts = {}) {
    if (!iso_string) return '';
    try {
        const to_parse = ensure_utc_for_parsing(iso_string);
        const date = new Date(to_parse);
        const t_func = (typeof window.Translation?.t === 'function') ? window.Translation.t : (key) => `**${key}**`;
        if (isNaN(date.getTime())) return t_func('invalid_date_format');

        const options = {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
            hour12: false
        };
        if (opts.showSeconds !== false) options.second = '2-digit';

        return date.toLocaleString(lang_code, options);

    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn("Error formatting date:", iso_string, e);
        const t_func = (typeof window.Translation?.t === 'function') ? window.Translation.t : (key) => `**${key}**`;
        return t_func('date_formatting_error');
    }
}

/**
 * Formaterar ISO-sträng till lokalt datum utan klockslag (för t.ex. start/sluttid i översikt och Excel).
 */
export function format_iso_to_local_date(iso_string, lang_code = 'en-GB') {
    if (!iso_string) return '';
    try {
        const to_parse = ensure_utc_for_parsing(iso_string);
        const date = new Date(to_parse);
        const t_func = (typeof window.Translation?.t === 'function') ? window.Translation.t : (key) => `**${key}**`;
        if (isNaN(date.getTime())) return t_func('invalid_date_format');

        return date.toLocaleDateString(lang_code, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn("Error formatting date:", iso_string, e);
        const t_func = (typeof window.Translation?.t === 'function') ? window.Translation.t : (key) => `**${key}**`;
        return t_func('date_formatting_error');
    }
}

export function format_iso_to_relative_time(iso_string, lang_code = 'en-GB') {
    if (!iso_string) return '';
    const t = (typeof window.Translation?.t === 'function') ? window.Translation.t : (key) => `**${key}**`;
    
    try {
        const to_parse = ensure_utc_for_parsing(iso_string);
        const date = new Date(to_parse);
        if (isNaN(date.getTime())) return t('invalid_date_format');

        const now = new Date();
        const today_start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday_start = new Date(today_start);
        yesterday_start.setDate(yesterday_start.getDate() - 1);
        const day_before_yesterday_start = new Date(today_start);
        day_before_yesterday_start.setDate(day_before_yesterday_start.getDate() - 2);

        const timeString = date.toLocaleTimeString(lang_code, { hour: '2-digit', minute: '2-digit', hour12: false });

        if (date >= today_start) {
            return t('relative_time_today') + `, ${timeString}`;
        }
        if (date >= yesterday_start) {
            return t('relative_time_yesterday') + `, ${timeString}`;
        }
        if (date >= day_before_yesterday_start) {
            return t('relative_time_day_before_yesterday') + `, ${timeString}`;
        }

        const date_part = date.toLocaleDateString(lang_code, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        return t('relative_time_date_format', { date: date_part });

    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn("Error formatting relative date:", iso_string, e);
        return t('date_formatting_error');
    }
}


export function get_current_iso_datetime_utc() {
    return new Date().toISOString();
}

export function escape_html(unsafe_input) {
    const safe_string = String(unsafe_input || '');
    if (safe_string === '[object Object]') {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn(`[Helpers.escape_html] Received an object that could not be converted to a meaningful string. Input was:`, unsafe_input);
        return '';
    }
    return safe_string
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Sanerar vanlig textinmatning (ej HTML) genom att trimma, ta bort farliga script-taggar
 * och säkerställa att resultatet alltid är en sträng.
 * Denna funktion ska användas för vanliga formulärfält där vi inte ska tolka HTML.
 * @param {string} input
 * @param {{ trim?: boolean }} options
 * @returns {string}
 */
export function sanitize_plain_input(input, options = {}) {
    const { trim = true } = options;
    if (typeof input !== 'string') return '';
    const without_scripts = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    return trim ? without_scripts.trim() : without_scripts;
}

/**
 * Sanerar en array av vanliga textvärden (ej HTML) med samma regler som sanitize_plain_input.
 * @param {string[]} values
 * @param {{ trim?: boolean }} options
 * @returns {string[]}
 */
export function sanitize_plain_array(values, options = {}) {
    if (!Array.isArray(values)) return [];
    return values.map(v => sanitize_plain_input(v, options));
}

/**
 * Returnerar HTML för extern-länk-ikon (mellanslag + ikon med aria-label).
 * Används i slutet av länkar som öppnas i ny flik.
 * Ikonen är en ruta med pil utåt (samma stil som Noun Project "new tab").
 * @param {function} t - Översättningsfunktion (t('opens_in_new_tab'))
 * @returns {string} HTML-sträng
 */
export function get_external_link_icon_html(t) {
    const aria_label = (typeof t === 'function') ? t('opens_in_new_tab') : '(Öppnas i ny flik)';
    const svg_icon = get_icon_svg('visit_url', ['currentColor'], 12);
    return ` <span class="external-link-icon" aria-label="${escape_html(aria_label)}" role="img">${svg_icon}</span>`;
}

export function sanitize_html(html_string) {
    if (typeof html_string !== 'string' || !html_string) return '';
    
    // Create a temporary div to parse HTML safely
    const temp_div = document.createElement('div');
    temp_div.innerHTML = html_string;
    
    // Remove dangerous elements and attributes
    const dangerous_elements = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'];
    dangerous_elements.forEach(tag => {
        temp_div.querySelectorAll(tag).forEach(el => el.remove());
    });
    
    // Remove dangerous attributes
    const dangerous_attributes = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'];
    temp_div.querySelectorAll('*').forEach(el => {
        dangerous_attributes.forEach(attr => {
            if (el.hasAttribute(attr)) {
                el.removeAttribute(attr);
            }
        });
        // Ensure all links open in new tab safely and add external link icon
        if (el.tagName === 'A') {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
            const t = (typeof window.Translation?.t === 'function') ? window.Translation.t : (k) => (k === 'opens_in_new_tab' ? '(Öppnas i ny flik)' : k);
            el.innerHTML = (el.innerHTML || '').trim() + get_external_link_icon_html(t);
        }
    });
    
    return temp_div.innerHTML;
}

export function safe_set_inner_html(element, content, options = {}) {
    if (!element || typeof content !== 'string') return;
    
    const { allow_html = false, sanitize = true } = options;
    
    if (allow_html && sanitize) {
        element.innerHTML = sanitize_html(content);
    } else if (allow_html) {
        element.innerHTML = content;
    } else {
        element.textContent = content;
    }
}

export function create_element(tag_name, options = {}) {
    const element = document.createElement(tag_name);
    if (options.class_name) {
        const classes = Array.isArray(options.class_name) ? options.class_name : options.class_name.split(' ');
        classes.filter(Boolean).forEach(c => element.classList.add(c));
    }
    if (options.id) element.id = options.id;
    if (options.hasOwnProperty('value')) element.value = options.value;
    if (options.text_content) element.textContent = options.text_content;
    if (options.html_content) element.innerHTML = options.html_content;
    if (options.attributes) {
        for (const attr in options.attributes) {
            element.setAttribute(attr, options.attributes[attr]);
        }
    }
    if (options.event_listeners) {
        for (const type in options.event_listeners) {
            element.addEventListener(type, options.event_listeners[type]);
        }
    }
    if (options.children) {
        options.children.forEach(child => { if (child) element.appendChild(child); });
    }
    if (options.style) {
        if (typeof options.style === 'object' && options.style !== null) {
            Object.assign(element.style, options.style);
        } else if (typeof options.style === 'string') {
            element.style.cssText = options.style;
        }
    }
    return element;
}

export function get_icon_svg(icon_name, colors = [], size = 24) {
    const fill_color = colors[0] || 'currentColor';
    let svg_path = '';
    const base_paths = {
        'arrow_back': `<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>`,
        'arrow_forward': `<path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>`,
        'arrow_forward_alt': `<path d="m11.59 7.41-1.42 1.42L12.17 10.83l-2 2 .59.59 2-2 2 2 .59-.59-2-2 2-2-.59-.59-2 2-2-2zM20 12l-8 8-1.41-1.41L16.17 13H4v-2h12.17l-5.58-5.59L12 4l8 8z"/>`,
        'list': `<path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>`,
        'add': `<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>`,
        'save': `<path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>`,
        'edit': `<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>`,
        'delete': `<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>`,
        'publish': `<path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>`,
        'lock_audit': `<path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>`,
        'unlock_audit': `<path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.71 1.39-3.1 3.1-3.1S13.81 4.29 15 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>`,
        'export': `<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5v-2z"/>`,
        'light_mode': `<path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/>`,
        'dark_mode': `<path d="M10 2c-1.82 0-3.53.5-5 1.35C7.99 5.08 10 8.3 10 12s-2.01 6.92-5 8.65C6.47 21.5 8.18 22 10 22c5.52 0 10-4.48 10-10S15.52 2 10 2z"/>`,
        'upload_file': `<path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>`,
        'start_new': `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>`,
        'load_existing': `<path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>`,
        'visit_url': `<path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>`,
        'audit_sample': `<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>`,
        'thumb_up': `<path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>`,
        'thumb_down': `<path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79-.44-1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>`,
        'check_circle': `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>`,
        'cancel': `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>`,
        'check': `<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>`,
        'close': `<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>`,
        'update': `<path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>`,
        'info': `<path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>`,
        'visibility': '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm-3-5c0-1.66 1.34-3 3-3s3 1.34 3 3-1.34 3-3 3-3-1.34-3-3z"/>',
        'image': '<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>',
        'videocam': '<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>',
        'warning': '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>',
        'content_copy': '<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>',
        'settings': '<path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .43-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61L19.14 12.94zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>',
        'download': '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>',
        // Textmask (••••) med trollspö för lösenordsgenerering
        'password_magic': `
            <path d="M5 17a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
            <path d="M14.5 4.5 13 3l-1.5 1.5L13 6zM19 3l-1.2-.7-.3-1.3-.9.9L15.4 1l.3 1.3L14.5 3l1.3.3.7 1.2.7-1.2z"/>
            <path d="M9 14.5 10.5 16 18 8.5 16.5 7z"/>
        `
    };

    if (icon_name === 'arrow_upward') {
        svg_path = `<path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.59 5.58L20 12l-8-8-8 8z"/>`;
    } else if (icon_name === 'arrow_downward') {
        svg_path = `<path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.59-5.58L4 12l8 8 8-8z"/>`;
    } else {
        svg_path = base_paths[icon_name];
    }
    if (!svg_path) return '';
    return `<svg xmlns="http://www.w3.org/2000/svg" height="${size}" width="${size}" viewBox="0 0 24 24" fill="${fill_color}" aria-hidden="true">${svg_path}</svg>`;
}

export function add_protocol_if_missing(url_string) {
    if (typeof url_string !== 'string' || !url_string.trim()) return '';
    const trimmed_url = url_string.trim();
    return /^(?:f|ht)tps?:\/\//i.test(trimmed_url) ? trimmed_url : `https://${trimmed_url}`;
}

/**
 * Generell trimning för textarea-innehåll: trimmar varje rad, tar bort tomrader först och sist.
 * Tomrader mitt i texten bevaras.
 */
export function trim_textarea_preserve_lines(value) {
    if (typeof value !== 'string') return value;
    const lines = value.split('\n').map(line => line.trim());
    while (lines.length > 0 && lines[0] === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    return lines.join('\n');
}

export function init_auto_resize_for_textarea(textarea_element) {
    if (!textarea_element || textarea_element.tagName.toLowerCase() !== 'textarea') return;
    const _perform_resize = () => {
        textarea_element.style.height = 'auto';
        textarea_element.style.height = `${textarea_element.scrollHeight}px`;
    };
    textarea_element.addEventListener('input', _perform_resize);
    setTimeout(_perform_resize, 0);
}

export function sanitize_and_linkify_html(raw_html_string) {
    if (typeof raw_html_string !== 'string' || !raw_html_string) return '';
    const template = document.createElement('template');
    template.innerHTML = raw_html_string;
    const content = template.content;
    content.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());
    content.querySelectorAll('a').forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        const t = (typeof window.Translation?.t === 'function') ? window.Translation.t : (k) => (k === 'opens_in_new_tab' ? '(Öppnas i ny flik)' : k);
        link.innerHTML = (link.innerHTML || '').trim() + get_external_link_icon_html(t);
    });
    const temp_div = document.createElement('div');
    temp_div.appendChild(content);
    return temp_div.innerHTML;
}

export function natural_sort(a, b) {
    const re = /(\d+)/g;
    const a_parts = String(a).split(re);
    const b_parts = String(b).split(re);
    const len = Math.max(a_parts.length, b_parts.length);
    for (let i = 0; i < len; i++) {
        const a_part = a_parts[i] || '';
        const b_part = b_parts[i] || '';
        const a_num = parseInt(a_part, 10);
        const b_num = parseInt(b_part, 10);
        if (!isNaN(a_num) && !isNaN(b_num)) {
            if (a_num < b_num) return -1;
            if (a_num > b_num) return 1;
        } else {
            if (a_part < b_part) return -1;
            if (a_part > b_part) return 1;
        }
    }
    return 0;
}

export function format_number_locally(number, lang_code = 'en-GB', options = {}) {
    if (typeof number !== 'number' || isNaN(number)) {
        return '---';
    }

    const defaultOptions = {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
        return new Intl.NumberFormat(lang_code, finalOptions).format(number);
    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn(`[Helpers] Error formatting number for locale "${lang_code}":`, e);
        return number.toFixed(finalOptions.maximumFractionDigits);
    }
}

export function sanitize_id_for_css_selector(id_string) {
    if (typeof id_string !== 'string') return '';
    return id_string.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/**
 * Hjälpfunktion för att avgöra om aktuell regelfil kan redigeras.
 * En regelfil är redigerbar endast när vi är i regelfilsredigeringsläge
 * och den inte är markerad som publicerad i state.
 * @param {object} state - Hela appens state från getState()
 * @returns {boolean}
 */
export function can_edit_rulefile(state) {
    if (!state || typeof state !== 'object') return false;
    if (state.auditStatus !== 'rulefile_editing') return false;
    if (state.ruleFileIsPublished === true) return false;
    return true;
}

