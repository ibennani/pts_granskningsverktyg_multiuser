/**
 * @fileoverview Visar nya innehållstyper från färdiga sidrapporter utan att ändra granskarens urval automatiskt.
 */
import type { RecurringProposalResponse } from '../api/recurring_component_proposal_api.js';
import { resolve_content_types } from '../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { sync_to_server_now } from '../logic/server_sync.js';

type Host = {
    getState: () => any;
    dispatch: (action: any) => void;
    StoreActionTypes: Record<string, string>;
    NotificationComponent?: { show_global_message?: (message: string, type?: string) => void };
    on_changed?: () => void;
};

type ContentTypeInfo = { id: string; text: string; description: string };

function content_type_info(metadata: any): Map<string, ContentTypeInfo> {
    const result = new Map<string, ContentTypeInfo>();
    const groups = resolve_content_types(metadata) as Array<{
        types?: Array<{ id?: string; text?: string; description?: string }>;
    }>;
    for (const group of groups) {
        for (const type of group.types || []) {
            const id = String(type?.id || '').trim();
            if (!id) continue;
            result.set(id, {
                id,
                text: String(type?.text || id),
                description: String(type?.description || '').trim(),
            });
        }
    }
    return result;
}

function make(tag: string, text?: string, class_name?: string): HTMLElement {
    const el = document.createElement(tag);
    if (class_name) el.className = class_name;
    if (text !== undefined) el.textContent = text;
    return el;
}

async function update_sample(host: Host, sample: any, updated: Record<string, unknown>): Promise<void> {
    await host.dispatch({
        type: host.StoreActionTypes.UPDATE_SAMPLE,
        payload: {
            sampleId: sample.id,
            updatedSampleData: updated,
        },
    });
    try {
        await sync_to_server_now(host.getState, host.dispatch);
    } catch {
        // Ordinarie synk kan försöka igen. Lokalt state är redan uppdaterat.
    }
}

export async function append_detected_content_type_suggestions(
    host: Host,
    result: RecurringProposalResponse,
    parent: HTMLElement
): Promise<number> {
    const state = host.getState?.();
    const info = content_type_info(state?.ruleFileContent?.metadata);
    const sample_by_id = new Map((state?.samples || []).map((sample: any) => [String(sample?.id || ''), sample]));
    const suggestions: Array<{ sample: any; ids: string[] }> = [];

    for (const [sample_id, detected_ids] of Object.entries(result.detectedContentTypesBySample || {})) {
        const sample = sample_by_id.get(String(sample_id));
        if (!sample || !String(sample?.url || '').trim()) continue;
        const selected = new Set((sample.selectedContentTypes || []).map((id: unknown) => String(id)));
        const ignored = new Set((sample.ignoredDetectedContentTypeIds || []).map((id: unknown) => String(id)));
        const ids = [...new Set((detected_ids || []).map((id) => String(id).trim()).filter(Boolean))]
            .filter((id) => !selected.has(id) && !ignored.has(id) && info.has(id));
        if (ids.length) suggestions.push({ sample, ids });
    }

    if (!suggestions.length) return 0;

    const section = make('section', undefined, 'detected-content-type-suggestions');
    section.appendChild(make('h3', 'Nya innehållstyper identifierade'));
    section.appendChild(make(
        'p',
        'Sidrapporterna har identifierat innehållstyper som inte är valda på motsvarande granskningsdel. Inget läggs till förrän ett val bekräftas.'
    ));
    parent.appendChild(section);

    for (const suggestion of suggestions) {
        const sample_section = make('section', undefined, 'detected-content-type-suggestion');
        sample_section.appendChild(make('h4', String(suggestion.sample.description || suggestion.sample.url || 'Granskningsdel')));
        const form = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = 'Välj innehållstyper att lägga till';
        form.appendChild(legend);

        const checkboxes: HTMLInputElement[] = [];
        for (const id of suggestion.ids) {
            const type = info.get(id)!;
            const row = make('div', undefined, 'checkbox-row');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.value = id;
            checkbox.id = `detected-content-${String(suggestion.sample.id)}-${id}`.replace(/[^a-zA-Z0-9_-]/g, '-');
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = type.text;
            row.append(checkbox, label);
            if (type.description) {
                const description = make('p', type.description, 'field-hint');
                description.id = `${checkbox.id}-description`;
                checkbox.setAttribute('aria-describedby', description.id);
                row.appendChild(description);
            }
            form.appendChild(row);
            checkboxes.push(checkbox);
        }
        sample_section.appendChild(form);

        const actions = make('div', undefined, 'detected-content-type-actions');
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'button button-primary';
        add.textContent = 'Lägg till valda';
        add.addEventListener('click', async () => {
            const chosen = checkboxes.filter((item) => item.checked).map((item) => item.value);
            if (!chosen.length) return;
            const latest = host.getState?.()?.samples?.find((item: any) => String(item?.id) === String(suggestion.sample.id)) || suggestion.sample;
            const selected = [...new Set([...(latest.selectedContentTypes || []), ...chosen])];
            const ignored = (latest.ignoredDetectedContentTypeIds || []).filter((id: string) => !chosen.includes(String(id)));
            add.disabled = true;
            await update_sample(host, latest, {
                selectedContentTypes: selected,
                ignoredDetectedContentTypeIds: ignored,
            });
            host.NotificationComponent?.show_global_message?.('Valda innehållstyper har lagts till.', 'success');
            sample_section.remove();
            host.on_changed?.();
        });

        const ignore = document.createElement('button');
        ignore.type = 'button';
        ignore.className = 'button button-default';
        ignore.textContent = 'Ignorera dessa förslag';
        ignore.addEventListener('click', async () => {
            const latest = host.getState?.()?.samples?.find((item: any) => String(item?.id) === String(suggestion.sample.id)) || suggestion.sample;
            const ignored = [...new Set([...(latest.ignoredDetectedContentTypeIds || []), ...suggestion.ids])];
            ignore.disabled = true;
            await update_sample(host, latest, { ignoredDetectedContentTypeIds: ignored });
            sample_section.remove();
            host.on_changed?.();
        });
        actions.append(add, ignore);
        sample_section.appendChild(actions);
        section.appendChild(sample_section);
    }

    return suggestions.length;
}
