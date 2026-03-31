// js/components/ArchivedRequirementsViewComponent.js

export class ArchivedRequirementsViewComponent {
    constructor() {
        this.root = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this.plate_element_ref = null;
    }

    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;

        this.plate_element_ref = null;
    }

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        const state = this.getState();
        const archived = Array.isArray(state.archivedRequirementResults) ? state.archivedRequirementResults : [];

        this.root.innerHTML = '';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate' });
        this.root.appendChild(this.plate_element_ref);

        if (this.NotificationComponent?.append_global_message_areas_to) {
            this.NotificationComponent.append_global_message_areas_to(this.plate_element_ref);
        }

        this.plate_element_ref.appendChild(this.Helpers.create_element('h1', { text_content: t('archived_requirements_title') }));

        if (archived.length === 0) {
            this.plate_element_ref.appendChild(this.Helpers.create_element('p', {
                class_name: 'view-intro-text',
                text_content: t('archived_requirements_empty_text')
            }));
            const back_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                text_content: t('back_to_audit_overview')
            });
            back_btn.addEventListener('click', () => this.router('audit_overview'));
            this.plate_element_ref.appendChild(back_btn);
            return;
        }

        this.plate_element_ref.appendChild(this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('archived_requirements_intro')
        }));

        const list = this.Helpers.create_element('ul', { class_name: 'item-list', style: { listStyle: 'none', padding: 0 } });

        archived.forEach(entry => {
            const li = this.Helpers.create_element('li', { class_name: 'item-list-item' });
            const title_parts = [];
            if (entry.title) {
                title_parts.push(entry.title);
            }
            if (entry.reference) {
                title_parts.push(`(${entry.reference})`);
            }
            const heading_text = title_parts.join(' ');
            const heading = this.Helpers.create_element('h2', { text_content: heading_text || String(entry.requirementId || '') });
            li.appendChild(heading);

            const meta_p = this.Helpers.create_element('p', { class_name: 'text-muted' });
            const samples_count = Array.isArray(entry.samples) ? entry.samples.length : 0;
            const version_text = entry.originalRuleVersion ? entry.originalRuleVersion : t('archived_requirements_version_unknown');

            let archived_at_text = '';
            if (typeof entry.archivedAt === 'string') {
                const d = new Date(entry.archivedAt);
                if (!Number.isNaN(d.getTime())) {
                    const year = d.getFullYear();
                    const month = (d.getMonth() + 1).toString().padStart(2, '0');
                    const day = d.getDate().toString().padStart(2, '0');
                    archived_at_text = `${year}-${month}-${day}`;
                }
            }

            meta_p.textContent = t('archived_requirements_meta', {
                samples: samples_count,
                version: version_text,
                archivedAt: archived_at_text
            });
            li.appendChild(meta_p);

            list.appendChild(li);
        });

        this.plate_element_ref.appendChild(list);

        const actions = this.Helpers.create_element('div', { class_name: 'form-actions', style: { marginTop: '1.5rem' } });
        const back_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('back_to_audit_overview')
        });
        back_button.addEventListener('click', () => this.router('audit_overview'));
        actions.appendChild(back_button);
        this.plate_element_ref.appendChild(actions);
    }

    destroy() {
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.plate_element_ref = null;
        this.root = null;
        this.deps = null;
    }
}
