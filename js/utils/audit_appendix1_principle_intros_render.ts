/**
 * @fileoverview Granskningsinställningar för Bilaga 1-inledningar per princip (kapitel 3.x).
 */
import { generate_deficiency_sections_from_taxonomy, read_rulefile_appendix1_grouping_taxonomy_id } from '../logic/appendix1_sections.js';
import {
    read_audit_principle_intro_overrides,
    resolve_principle_intro_content,
} from '../logic/appendix1_principle_intro.js';
import type { AuditSettingsRenderDeps } from '../components/audit_settings_render.js';
import { audit_settings_back_label_key } from '../components/audit_settings_render.js';

type PrincipleIntroHost = {
    working_intros: Record<string, string>;
    textarea_refs: Map<string, HTMLTextAreaElement>;
};

export function create_principle_intro_host(): PrincipleIntroHost {
    return {
        working_intros: {},
        textarea_refs: new Map(),
    };
}

export function render_audit_settings_principle_intros_section(
    deps: AuditSettingsRenderDeps,
    plate: HTMLElement,
    options: {
        state: Record<string, unknown>;
        readonly: boolean;
        return_to: 'overview' | 'settings';
        intro_host: PrincipleIntroHost;
        on_save: (overrides: Record<string, string>) => void | Promise<void>;
        on_back: () => void;
    }
): void {
    const { Helpers: helpers, Translation: { t } } = deps;
    const { state, readonly, return_to, intro_host, on_save, on_back } = options;
    const back_label_key = audit_settings_back_label_key(return_to);
    const rule_file = (state.ruleFileContent || {}) as Record<string, unknown>;
    const taxonomy_id = read_rulefile_appendix1_grouping_taxonomy_id(rule_file);
    const sections = generate_deficiency_sections_from_taxonomy(rule_file, t);
    const saved_overrides = read_audit_principle_intro_overrides(
        state.auditMetadata as { appendix1PrincipleIntroOverrides?: unknown } | undefined
    );

    plate.appendChild(
        helpers.create_element('h1', {
            attributes: { id: 'audit-settings-principle-intros-heading' },
            text_content: t('audit_settings_principle_intros_heading'),
        })
    );
    plate.appendChild(
        helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('audit_settings_principle_intros_intro'),
        })
    );
    plate.appendChild(
        helpers.create_element('hr', {
            class_name: 'audit-settings__section-divider',
            attributes: { 'aria-hidden': 'true' },
        })
    );

    if (sections.length === 0) {
        plate.appendChild(
            helpers.create_element('p', {
                class_name: 'metadata-empty',
                text_content: t('audit_settings_principle_intros_empty'),
            })
        );
    } else {
        const form = helpers.create_element('div', {
            class_name: 'audit-settings__principle-intros-form',
        });
        intro_host.textarea_refs.clear();
        intro_host.working_intros = { ...saved_overrides };

        sections.forEach((section, index) => {
            if (!section.conceptId) return;
            const concept_id = section.conceptId;
            const field = helpers.create_element('div', {
                class_name: 'form-group audit-settings__principle-intro-field',
            });
            const textarea_id = `audit-settings-principle-intro-${concept_id}-${index}`;
            field.appendChild(
                helpers.create_element('label', {
                    attributes: { for: textarea_id },
                    text_content: t('audit_settings_principle_intro_label', {
                        title: section.title || concept_id,
                    }),
                })
            );
            const initial_text = Object.prototype.hasOwnProperty.call(saved_overrides, concept_id)
                ? saved_overrides[concept_id] ?? ''
                : resolve_principle_intro_content(
                      { ruleFileContent: rule_file, auditMetadata: state.auditMetadata as Record<string, unknown> },
                      rule_file,
                      taxonomy_id,
                      concept_id
                  );
            intro_host.working_intros[concept_id] = initial_text;

            if (readonly) {
                field.appendChild(
                    helpers.create_element('p', {
                        class_name: 'audit-settings__readonly-intro',
                        text_content: initial_text,
                    })
                );
            } else {
                const textarea = helpers.create_element('textarea', {
                    class_name: 'form-control audit-settings__principle-intro-textarea',
                    attributes: { id: textarea_id, rows: '8', name: `principleIntro-${concept_id}` },
                }) as HTMLTextAreaElement;
                textarea.value = initial_text;
                textarea.addEventListener('input', () => {
                    intro_host.working_intros[concept_id] = textarea.value;
                });
                intro_host.textarea_refs.set(concept_id, textarea);
                field.appendChild(textarea);
            }
            form.appendChild(field);
        });
        plate.appendChild(form);

        if (!readonly) {
            const actions = helpers.create_element('div', { class_name: 'form-actions' });
            const save_btn = helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                attributes: { type: 'button' },
                text_content: t('audit_settings_principle_intros_save'),
            });
            save_btn.addEventListener('click', () => {
                void on_save({ ...intro_host.working_intros });
            });
            const back_btn = helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                attributes: { type: 'button' },
                text_content: t(back_label_key),
            });
            back_btn.addEventListener('click', on_back);
            actions.append(save_btn, back_btn);
            plate.appendChild(actions);
            return;
        }
    }

    const back_row = helpers.create_element('div', { class_name: 'audit-settings__back-row' });
    const back_btn = helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: { type: 'button' },
        text_content: t(back_label_key),
    });
    back_btn.addEventListener('click', on_back);
    back_row.appendChild(back_btn);
    plate.appendChild(back_row);
}
