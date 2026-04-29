/**
 * @file DOM-uppbyggnad för globala notiser (kritisk och vanlig).
 */

/**
 * @returns {string}
 */
function default_ok_label() {
    return typeof window.Translation?.t === 'function' ? window.Translation.t('ok') : 'Ok';
}

/**
 * @returns {string}
 */
function default_close_aria_label() {
    return typeof window.Translation?.t === 'function'
        ? window.Translation.t('global_message_dismiss_aria_label')
        : 'Stäng notisen';
}

/**
 * @param {HTMLElement} element
 * @param {string} message
 * @param {{ label?: string, callback: () => void }|null} action
 * @param {() => void} on_action_click
 */
export function mount_critical_message_dom(element, message, action, on_action_click) {
    element.innerHTML = '';
    element.appendChild(document.createTextNode(message));
    if (action && typeof action.callback === 'function') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'global-message-action-btn button button-default';
        btn.textContent = action.label || default_ok_label();
        btn.addEventListener('click', on_action_click);
        element.appendChild(document.createTextNode(' '));
        element.appendChild(btn);
    }
}

/**
 * @param {HTMLElement} element
 * @param {string} message
 * @param {{ label?: string, callback: () => void }|null} action
 * @param {() => void} on_action_click
 * @param {() => void} on_close_click
 */
export function mount_regular_message_dom(element, message, action, on_action_click, on_close_click) {
    element.innerHTML = '';
    const text_wrap = document.createElement('span');
    text_wrap.className = 'global-message-text';
    text_wrap.textContent = message;
    element.appendChild(text_wrap);
    if (action && typeof action.callback === 'function') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'global-message-action-btn';
        btn.textContent = action.label || default_ok_label();
        btn.addEventListener('click', on_action_click);
        element.appendChild(btn);
    }
    const close_btn = document.createElement('button');
    close_btn.type = 'button';
    close_btn.className = 'global-message-close-btn';
    close_btn.setAttribute('aria-label', default_close_aria_label());
    close_btn.appendChild(document.createTextNode('\u00D7'));
    close_btn.addEventListener('click', on_close_click);
    element.appendChild(close_btn);
}

/**
 * Roll, CSS-klasser och synlighet för en visad notis.
 * @param {HTMLElement} element
 * @param {string} type
 * @param {boolean} is_critical
 */
export function apply_visible_message_presentation(element, type, is_critical) {
    if (type === 'error' || type === 'warning' || is_critical) {
        element.setAttribute('role', 'alert');
    } else {
        element.removeAttribute('role');
    }
    element.className = '';
    element.classList.add('global-message-content');
    element.classList.add(`message-${type}`);
    element.removeAttribute('hidden');
}
