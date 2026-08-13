/**
 * @fileoverview Lägger till bulk-URL och deterministiska recurring-förslag utan att ändra den manuella samplevyn.
 */
import { SampleManagementViewComponent as BaseSampleManagementViewComponent } from './SampleManagementViewBase.js';
import { show_bulk_sample_url_modal } from './bulk_sample_url_modal.js';
import { render_recurring_proposal_section } from './recurring_proposal_section.js';

export class SampleManagementViewComponent extends BaseSampleManagementViewComponent {
    private recurring_render_generation = 0;

    override render(): void {
        super.render();
        const plate = this.plate_element_ref;
        const state = this.getState?.() as { auditStatus?: string; auditId?: string } | null;
        if (!plate || !state || !this.Helpers) return;

        const actions = plate.querySelector('.sample-management-actions');
        if (actions instanceof HTMLElement && String(state.auditStatus || '') === 'not_started') {
            if (!actions.querySelector('[data-bulk-sample-url-trigger="true"]')) {
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

        const status = String(state.auditStatus || '');
        if (!state.auditId || status === 'locked' || status === 'completed') return;
        const section = document.createElement('section');
        section.className = 'recurring-proposal-section';
        section.dataset.recurringProposalSection = 'true';
        plate.appendChild(section);
        const generation = ++this.recurring_render_generation;
        void render_recurring_proposal_section(
            {
                getState: this.getState,
                dispatch: this.dispatch,
                StoreActionTypes: this.StoreActionTypes,
                Helpers: this.Helpers,
                Translation: this.Translation,
                NotificationComponent: this.NotificationComponent,
                on_changed: () => this.refresh_sample_list_if_visible(),
            },
            section
        ).then(() => {
            if (generation !== this.recurring_render_generation) section.remove();
        });
    }
}
