/**
 * @fileoverview Tillbaka-navigering för Klassificeringar-undersidor.
 */
import type { ClassificationsHubDeps } from './rulefile_classifications_hub_render.js';

export function create_rulefile_classifications_back_row(
    deps: ClassificationsHubDeps,
    on_click?: () => void
): HTMLElement {
    const { Helpers, Translation: { t }, router } = deps;
    const row = Helpers.create_element('div', { class_name: 'audit-settings__back-row' });
    const btn = Helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: { type: 'button' },
        text_content: t('rulefile_classifications_back_to_hub'),
    });
    btn.addEventListener('click', () => {
        if (on_click) {
            on_click();
            return;
        }
        router('rulefile_sections', { section: 'classifications' });
    });
    row.appendChild(btn);
    return row;
}
