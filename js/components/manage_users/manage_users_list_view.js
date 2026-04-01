/**
 * @fileoverview Tabell och fokusåterställning för listan Hantera användare.
 */

/**
 * @param {object} deps
 * @param {HTMLElement | null} deps.table_root
 * @param {object | null} deps.table_component
 * @param {object} deps.Helpers
 * @param {() => (key: string, opts?: object) => string} deps.get_t_func
 * @param {unknown[]} deps.users
 * @param {string} deps.user_filter_query
 * @param {unknown} deps.fetch_users_error
 * @param {{ columnIndex: number, direction: string }} deps.sort_state
 * @param {(user: object) => string} deps.get_display_name
 * @param {() => void} deps.reset_table_focus_skip_if_requested
 * @param {(user: object) => void} deps.on_manage_user_click
 * @param {(columnIndex: number, direction: string) => void} deps.on_sort_change
 */
export function render_manage_users_table_view(deps) {
    const table_root = deps.table_root;
    const table_component = deps.table_component;
    const Helpers = deps.Helpers;
    if (!table_root || !table_component || !Helpers) return;

    const t = deps.get_t_func();

    deps.reset_table_focus_skip_if_requested();

    const raw_users = Array.isArray(deps.users) ? deps.users : [];
    const query_raw = deps.user_filter_query || '';
    const query = query_raw.trim().toLowerCase();
    const has_filter = query.length > 0;
    const data = !has_filter
        ? raw_users
        : raw_users.filter((user) => {
            const username = (user && user.username ? String(user.username) : '').trim().toLowerCase();
            const display_name = deps.get_display_name(user).toString().trim().toLowerCase();
            if (!query) return true;
            return username.includes(query) || display_name.includes(query);
        });
    const fetch_err = deps.fetch_users_error;
    const is_forbidden = fetch_err && fetch_err.status === 403;
    const is_load_error = fetch_err && !is_forbidden;
    const empty_message = is_forbidden
        ? t('manage_users_error_forbidden')
        : is_load_error
            ? t('manage_users_error_load_failed')
            : (has_filter ? t('manage_users_filter_no_results') : t('manage_users_empty'));

    const columns = [
        {
            headerLabel: t('manage_users_col_username'),
            getContent: (user) => user.username || '',
            getSortValue: (user) => user.username || ''
        },
        {
            headerLabel: t('manage_users_col_name'),
            getContent: (user) => deps.get_display_name(user),
            getSortValue: (user) => deps.get_display_name(user)
        },
        {
            headerLabel: t('manage_users_col_is_admin'),
            getContent: (user) => (user.is_admin ? t('yes') : t('no')),
            getSortValue: (user) => (user.is_admin ? 1 : 0)
        },
        {
            headerLabel: t('manage_users_col_actions'),
            isAction: true,
            getContent: (user) => {
                const container = Helpers.create_element('div', { class_name: 'manage-users-actions-cell' });

                const display_name = deps.get_display_name(user);

                const manage_btn = Helpers.create_element('button', {
                    class_name: ['button', 'button-secondary', 'manage-users-manage-button'],
                    text_content: t('manage_users_action_manage_user'),
                    attributes: {
                        type: 'button',
                        'aria-label': `${t('manage_users_action_manage_user')} ${t('manage_users_action_for')} ${display_name}`,
                        'data-user-id': String(user.id)
                    }
                });
                manage_btn.addEventListener('click', () => {
                    deps.on_manage_user_click(user);
                });

                container.appendChild(manage_btn);
                return container;
            }
        }
    ];

    table_component.render({
        root: table_root,
        columns,
        data,
        emptyMessage: empty_message,
        ariaLabel: t('manage_users_table_aria_label'),
        wrapperClassName: 'generic-table-wrapper manage-users-table-wrapper',
        tableClassName: 'generic-table manage-users-table',
        sortState: deps.sort_state,
        onSort: (column_index, direction) => {
            deps.on_sort_change(column_index, direction);
        },
        t
    });
}

/**
 * @param {HTMLElement | null} root
 * @param {() => object | null} consume_return_focus_info — returnerar info och nollställer, om root finns
 */
export function restore_manage_users_list_focus_if_needed(root, consume_return_focus_info) {
    if (!root) return;

    const info = consume_return_focus_info();
    if (!info) return;

    try {
        let el = null;
        if (info.type === 'manage' && info.user_id) {
            const user_id_str = String(info.user_id).replace(/"/g, '\\"');
            el = root.querySelector(`.manage-users-manage-button[data-user-id="${user_id_str}"]`);
        }

        if (el && typeof el.focus === 'function' && document.contains(el)) {
            const focus_element = () => {
                if (!document.contains(el)) return;
                try {
                    el.focus({ preventScroll: true });
                } catch (e) {
                    el.focus();
                }
            };

            const raf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';
            if (raf) {
                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(focus_element);
                });
            } else {
                setTimeout(focus_element, 0);
            }
        }
    } catch (e) {
        // Ignorera fokusfel
    }
}
