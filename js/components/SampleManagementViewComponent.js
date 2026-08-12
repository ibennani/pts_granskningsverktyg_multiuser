/**
 * Brygga och liten utökning av samplehanteringen.
 * Den manuella SampleManagementViewComponent.ts lämnas oförändrad; denna klass
 * lägger bara till den alternativa vägen "Skapa från URL-lista".
 */
import { SampleManagementViewComponent as BaseSampleManagementViewComponent } from './SampleManagementViewComponent.ts';
import { show_bulk_sample_url_modal } from './bulk_sample_url_modal.js';

export class SampleManagementViewComponent extends BaseSampleManagementViewComponent {
    render() {
        super.render();
        const plate = this.plate_element_ref;
        const state = this.getState?.();
        if (!plate || !state || !this.Helpers) return;
        if (String(state.auditStatus || '') !== 'not_started') return;
        const actions = plate.querySelector('.sample-management-actions');
        if (!actions || actions.querySelector('[data-bulk-sample-url-trigger="true"]')) return;

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
        });
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
