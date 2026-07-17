/**
 * @fileoverview Standardvärden för Bilaga 1-sektioner (defaults från mall).
 */
import default_sections_json from '../../shared/report_templates/appendix1_default_sv.json';
import { combine_content_sections_to_body_text } from './appendix1_body_text.js';
import { LEGACY_APPENDIX1_SECTION_KEY_ORDER } from './appendix1_sections_migrate.js';
import type { Appendix1SectionDefinition, Appendix1SectionsMap } from './appendix1_sections_types.js';

/** Legacy nycklar i fast ordning (bakåtkompatibilitet). */
export const APPENDIX1_SECTION_KEYS = LEGACY_APPENDIX1_SECTION_KEY_ORDER;

const DEFAULT_TEMPLATE = default_sections_json as {
    coverImage: string;
    groupingTaxonomyId: string;
    sections: Appendix1SectionDefinition[];
};

function clone_sections_list(sections: Appendix1SectionDefinition[]): Appendix1SectionDefinition[] {
    return JSON.parse(JSON.stringify(sections)) as Appendix1SectionDefinition[];
}

export function get_default_appendix1_sections_list(): Appendix1SectionDefinition[] {
    return clone_sections_list(DEFAULT_TEMPLATE.sections);
}

export function get_default_appendix1_body_text(): string {
    return combine_content_sections_to_body_text(
        get_default_appendix1_sections_list().filter((section) => section.kind !== 'deficiency_group')
    );
}

function definition_to_legacy_section(definition: Appendix1SectionDefinition) {
    return {
        title: definition.title,
        content: definition.content,
        format: definition.format,
    };
}

function sections_list_to_map(sections: Appendix1SectionDefinition[]): Appendix1SectionsMap {
    const defaults = get_default_appendix1_sections_list();
    const override_by_id = new Map(sections.map((section) => [section.id, section]));
    const result = {} as Appendix1SectionsMap;
    for (const key of APPENDIX1_SECTION_KEYS) {
        const section = override_by_id.get(key) ?? defaults.find((entry) => entry.id === key);
        if (section) {
            result[key] = definition_to_legacy_section(section);
        }
    }
    return result;
}

/** @deprecated Använd get_default_appendix1_sections_list. */
export function get_default_appendix1_sections(): Appendix1SectionsMap {
    return sections_list_to_map(get_default_appendix1_sections_list());
}
