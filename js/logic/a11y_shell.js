/**
 * Tillgänglighet: skiplänk, landmärken och huvudrubrik-id.
 */

/**
 * Sätter id på första h1 i vyn för skiplänk.
 * @param {HTMLElement|null} root
 */
export function ensure_skip_link_target(root) {
    if (!root) return;
    const prev = document.getElementById('main-content-heading');
    if (prev) prev.removeAttribute('id');
    const h1 = root.querySelector('h1');
    if (h1) {
        h1.id = 'main-content-heading';
        if (h1.getAttribute('tabindex') === null) {
            h1.setAttribute('tabindex', '-1');
        }
    }
}

export function setup_skip_link_click_handler() {
    const skip_link = document.querySelector('.skip-link');
    if (!skip_link || skip_link.hasAttribute('data-skip-handler-bound')) return;
    skip_link.setAttribute('data-skip-handler-bound', 'true');
    skip_link.addEventListener('click', (e) => {
        e.preventDefault();
        const main_root = document.getElementById('app-main-view-root');
        const first_h1 = main_root?.querySelector('h1');
        if (first_h1) {
            if (first_h1.getAttribute('tabindex') === null) {
                first_h1.setAttribute('tabindex', '-1');
            }
            first_h1.focus({ preventScroll: false });
            first_h1.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
    });
}

/**
 * @param {string} [_view_name]
 * @param {object} [_params]
 */
export function update_landmarks_and_skip_link(_view_name, _params) {
    const t = typeof window.Translation !== 'undefined' && typeof window.Translation.t === 'function'
        ? window.Translation.t.bind(window.Translation)
        : (key) => key;

    const skip_link = document.querySelector('.skip-link');
    if (skip_link) {
        skip_link.textContent = t('skip_to_content');
    }

    const main_el = document.getElementById('app-main-view-root');
    if (main_el) {
        main_el.removeAttribute('aria-label');
        main_el.removeAttribute('aria-labelledby');

        const root_for_heading = main_el || document;
        const heading = root_for_heading.querySelector('#main-content-heading') || root_for_heading.querySelector('h1');
        if (heading && heading.id) {
            main_el.setAttribute('aria-labelledby', heading.id);
        } else {
            main_el.setAttribute('aria-label', t('landmark_main_default'));
        }
    }

    const top_container = document.getElementById('global-action-bar-top');
    if (top_container) {
        top_container.removeAttribute('aria-label');
        top_container.removeAttribute('aria-hidden');
    }
    const bottom_container = document.getElementById('global-action-bar-bottom');
    if (bottom_container) {
        bottom_container.removeAttribute('aria-label');
        bottom_container.removeAttribute('aria-hidden');
    }

    const right_sidebar = document.getElementById('app-right-sidebar-root');
    if (right_sidebar) {
        const sidebar_has_content = right_sidebar.childElementCount > 0;
        if (sidebar_has_content) {
            right_sidebar.setAttribute('aria-label', t('landmark_sidebar'));
            right_sidebar.removeAttribute('aria-hidden');
        } else {
            right_sidebar.removeAttribute('aria-label');
            right_sidebar.setAttribute('aria-hidden', 'true');
        }
    }
}
