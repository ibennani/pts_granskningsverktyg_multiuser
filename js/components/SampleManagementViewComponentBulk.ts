/**
 * @fileoverview Lägger till den alternativa bulkvägen utan att ändra den manuella samplevyn.
 */
import { SampleManagementViewComponent as BaseSampleManagementViewComponent } from './SampleManagementViewBase.js';
import { show_bulk_sample_url_modal } from './bulk_sample_url_modal.js';

export class SampleManagementViewComponent extends BaseSampleManagementViewComponent {
    override render(): void {
        super.render();
        const plate = this.plate_element_ref;
        const state = this.getState?.() as { auditStatus?: string } | null;
        if (!plate || !state || !this.Helpers) return;
        if (String(state.auditStatus || '') !== 'not_started') return;

        const actions = plate.querySelector('.sample-management-actions');
        if (!(actions instanceof HTMLElement)) return;
        if (actions.querySelector('[data-bulk-sample-url-trigger="true"]')) return;

        const t = this.Translation?.t;
        const translated = t?.('bulk_sample_urls_open');
        const label = translated && translated !== 'bulk_sample_urls_open' && translated !== '**bulk_sample_urls_open**'
            ? translated
            : 'Skapa från URL-lista';
        const button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary'],
            attributes: {
                type: 'button',
                'data-bulk-sample-url-trigger': 'true',
            },
            text_content: label,
        }) as HTMLButtonElement;

        button.addEventListener('click', () => {
            show_bulk_sample_url_modal(
                {
                    getState: this.getState,
                    dispatch: this.dispatch,
                    StoreActionTypes: this.StoreActionTypes,
                    Helpers: this.Helpers,
                    Translation: this.Translation,
                    NotificationComponent: this.NotificationComponent,
                    on_complete: () => this.refresh_sample_list_if_visible(),
                },
                button
            );
        });
        actions.appendChild(button);
    }
}
