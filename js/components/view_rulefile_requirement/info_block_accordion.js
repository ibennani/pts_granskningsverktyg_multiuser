/**
 * @fileoverview Accordion för infoblock i visningsvyn av regelfilskrav.
 * Innehåll renderas endast när blocket är expanderat.
 */

import {
    EXPANDABLE_PANEL_EXPANDED_CLASS,
    animate_expandable_panel,
    apply_instant_expanded_panel_state
} from '../../utils/expandable_panel_transition.js';

/**
 * @param {Object} params
 * @param {Object} params.Helpers
 * @param {HTMLElement} params.parent
 * @param {string} params.block_id
 * @param {{ name?: string, text?: string, expanded?: boolean }} params.block
 * @param {function(string): string} params.parse_markdown
 */
export function append_info_block_accordion_section({ Helpers, parent, block_id, block, parse_markdown }) {
    const initially_open = block.expanded !== false;
    const panel_id = `info-block-panel-${block_id}`;
    const heading_id = `info-block-heading-${block_id}`;

    const section_div = Helpers.create_element('div', { class_name: 'audit-section info-block-section' });

    const header_button = Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'info-block-header'],
        attributes: {
            type: 'button',
            'aria-controls': panel_id,
            'aria-expanded': initially_open ? 'true' : 'false'
        }
    });
    const header_inner = Helpers.create_element('span', { class_name: 'info-block-header__inner' });
    header_inner.append(
        Helpers.create_element('h2', {
            class_name: 'info-block-header__title',
            attributes: { id: heading_id },
            text_content: block.name || block_id
        }),
        Helpers.create_element('span', {
            class_name: 'info-block-header__chevron',
            attributes: { 'aria-hidden': 'true' }
        })
    );
    header_button.appendChild(header_inner);
    section_div.appendChild(header_button);

    const panel_host = Helpers.create_element('div', {
        class_name: 'info-block-panel-host',
        attributes: {
            id: panel_id,
            role: 'region',
            'aria-labelledby': heading_id
        }
    });
    panel_host.hidden = !initially_open;

    const expandable_panel = Helpers.create_element('div', {
        class_name: ['expandable-panel', 'info-block-panel']
    });
    const panel_inner = Helpers.create_element('div', {
        class_name: ['expandable-panel__inner', 'audit-section-content', 'markdown-content', 'info-block-content']
    });
    expandable_panel.appendChild(panel_inner);
    panel_host.appendChild(expandable_panel);
    section_div.appendChild(panel_host);

    const mount_content = () => {
        if (panel_inner.childElementCount > 0) return;
        panel_inner.innerHTML = parse_markdown(block.text);
    };

    const unmount_content = () => {
        panel_inner.replaceChildren();
    };

    const run_toggle = async () => {
        if (section_div.getAttribute('data-animating') === 'true') return;

        const will_open = !section_div.classList.contains('info-block-section--open');
        section_div.setAttribute('data-animating', 'true');
        try {
            if (will_open) {
                mount_content();
                section_div.classList.add('info-block-section--open');
                header_button.setAttribute('aria-expanded', 'true');
                await animate_expandable_panel(expandable_panel, panel_host, true, EXPANDABLE_PANEL_EXPANDED_CLASS);
                return;
            }

            section_div.classList.remove('info-block-section--open');
            header_button.setAttribute('aria-expanded', 'false');
            await animate_expandable_panel(expandable_panel, panel_host, false, EXPANDABLE_PANEL_EXPANDED_CLASS);
            unmount_content();
        } finally {
            section_div.removeAttribute('data-animating');
        }
    };

    header_button.addEventListener('click', () => {
        void run_toggle();
    });

    if (initially_open) {
        section_div.classList.add('info-block-section--open');
        mount_content();
        apply_instant_expanded_panel_state(expandable_panel, panel_host, true, EXPANDABLE_PANEL_EXPANDED_CLASS);
    }

    parent.appendChild(section_div);
}
