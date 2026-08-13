/**
 * @fileoverview Tillgänglig UI-sektion för deterministiskt identifierat återkommande innehåll.
 */
import {
    fetch_recurring_component_proposals,
    type RecurringProposal,
    type RecurringProposalPreview,
} from '../api/recurring_component_proposal_api.js';
import { resolve_recurring_sample_target } from '../../shared/sample/recurring_sample_type_resolver.js';
import { resolve_content_types } from '../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { sync_to_server_now } from '../logic/server_sync.js';

type Host = {
    getState: () => any;
    dispatch: (action: any) => void;
    StoreActionTypes: Record<string, string>;
    Helpers: any;
    Translation: any;
    NotificationComponent?: { show_global_message?: (message: string, type?: string) => void };
    on_changed?: () => void;
};

const LABELS: Record<RecurringProposal['proposalType'], string> = {
    header: 'Sidhuvud',
    menu: 'Meny',
    footer: 'Sidfot',
    cookie: 'Cookiebanner',
    section_navigation: 'Sektionsnavigation',
    other_recurring: 'Annat återkommande innehåll',
};

function default_content_types(metadata: any): string[] {
    const groups = resolve_content_types(metadata) as Array<{ types?: Array<{ id?: string; defaultSelected?: boolean }> }>;
    const ids: string[] = [];
    for (const group of groups) {
        for (const type of group.types || []) {
            const id = String(type?.id || '').trim();
            if (id && type?.defaultSelected === true) ids.push(id);
        }
    }
    return ids;
}

function content_type_label_map(metadata: any): Map<string, string> {
    const result = new Map<string, string>();
    const groups = resolve_content_types(metadata) as Array<{ types?: Array<{ id?: string; text?: string }> }>;
    for (const group of groups) {
        for (const type of group.types || []) {
            const id = String(type?.id || '').trim();
            if (id) result.set(id, String(type?.text || id));
        }
    }
    return result;
}

function create_text(tag: string, text: string, class_name?: string): HTMLElement {
    const el = document.createElement(tag);
    if (class_name) el.className = class_name;
    el.textContent = text;
    return el;
}

function describe_preview(preview: RecurringProposalPreview | null | undefined, state: any): HTMLElement {
    const wrapper = document.createElement('div');
    if (!preview) {
        wrapper.appendChild(create_text('p', 'Ingen separat områdesmätning finns för detta förslag.'));
        return wrapper;
    }
    const sample = (state?.samples || []).find((item: any) => String(item?.id) === preview.sampleId);
    wrapper.appendChild(create_text('p', `Representativ sida: ${String(sample?.description || preview.sampleId)}.`));
    const box = preview.boundingBox;
    if (box) {
        wrapper.appendChild(create_text(
            'p',
            `Identifierat område: x ${Math.round(Number(box.x || 0))}, y ${Math.round(Number(box.y || 0))}, bredd ${Math.round(Number(box.width || 0))} CSS-pixlar, höjd ${Math.round(Number(box.height || 0))} CSS-pixlar.`
        ));
    }
    const counts = preview.counts || {};
    const parts = [
        ['länkar', counts.links],
        ['knappar', counts.buttons],
        ['inmatningsfält', counts.fields],
        ['rubriker', counts.headings],
        ['navigationsområden', counts.navigations],
    ].filter(([, value]) => Number.isFinite(Number(value)))
        .map(([label, value]) => `${Number(value)} ${label}`);
    if (parts.length) wrapper.appendChild(create_text('p', `Blocket innehåller ${parts.join(', ')}.`));

    const labels = content_type_label_map(state?.ruleFileContent?.metadata);
    const type_names = (preview.detectedContentTypeIds || []).map((id) => labels.get(id) || id);
    if (type_names.length) wrapper.appendChild(create_text('p', `Identifierade innehållstyper i blocket: ${type_names.join(', ')}.`));
    return wrapper;
}

function existing_proposal_types(state: any): Set<string> {
    return new Set(
        (state?.samples || [])
            .map((sample: any) => String(sample?.recurringSource?.proposalType || '').trim())
            .filter(Boolean)
    );
}

function create_recurring_sample(host: Host, proposal: RecurringProposal, preview: RecurringProposalPreview | null): boolean {
    const state = host.getState?.();
    const metadata = state?.ruleFileContent?.metadata;
    const target = resolve_recurring_sample_target(metadata, proposal.proposalType);
    if (!target) return false;
    const detected = preview?.detectedContentTypeIds || [];
    const selected = [...new Set([...default_content_types(metadata), ...detected])];
    const id = host.Helpers?.generate_uuid_v4?.() || crypto.randomUUID();
    host.dispatch({
        type: host.StoreActionTypes.ADD_SAMPLE,
        payload: {
            id,
            sampleCategory: target.sampleCategory,
            sampleType: target.sampleType,
            description: LABELS[proposal.proposalType],
            url: '',
            selectedContentTypes: selected,
            attachedMediaFilenames: [],
            requirementResults: {},
            recurringSource: {
                source: 'deterministic-recurring-analysis',
                proposalType: proposal.proposalType,
                score: proposal.score,
                confidence: proposal.confidence,
                sampleIds: proposal.sampleIds,
                representativeSampleId: proposal.representativeSampleId,
                representativeCaptureId: proposal.representativeCaptureId,
                ownership: proposal.ownership,
            },
        },
    });
    return true;
}

export async function render_recurring_proposal_section(host: Host, section: HTMLElement): Promise<void> {
    const state = host.getState?.();
    const audit_id = String(state?.auditId || '').trim();
    if (!audit_id) return;
    section.innerHTML = '';
    section.appendChild(create_text('h2', 'Återkommande innehåll'));
    const status = create_text('p', 'Analyserar färdiga sidrapporter…');
    status.setAttribute('role', 'status');
    section.appendChild(status);

    try {
        const result = await fetch_recurring_component_proposals(audit_id);
        status.textContent = `${result.pagesAnalyzed} färdiga sidrapporter har jämförts.`;
        if (!result.proposals.length) {
            section.appendChild(create_text('p', 'Inga tillräckligt säkra återkommande block har identifierats ännu.'));
            return;
        }
        const existing = existing_proposal_types(host.getState?.());
        const list = document.createElement('div');
        list.className = 'recurring-proposal-list';
        section.appendChild(list);

        for (const proposal of result.proposals) {
            if (existing.has(proposal.proposalType)) continue;
            const card = document.createElement('section');
            card.className = 'recurring-proposal-card';
            const title = create_text('h3', LABELS[proposal.proposalType]);
            card.appendChild(title);
            card.appendChild(create_text(
                'p',
                `Identifierat på ${proposal.occurrenceCount} av ${proposal.pageCount} analyserade sidor. Bedömningsstyrka: ${proposal.confidence === 'high' ? 'hög' : proposal.confidence === 'medium' ? 'medel' : 'låg'} (${proposal.score}/100).`
            ));

            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = 'Förhandsgranska identifierat område';
            details.appendChild(summary);
            details.appendChild(describe_preview(result.previews?.[proposal.proposalType], host.getState?.()));
            card.appendChild(details);

            const actions = document.createElement('div');
            actions.className = 'recurring-proposal-actions';
            const target = resolve_recurring_sample_target(host.getState?.()?.ruleFileContent?.metadata, proposal.proposalType);
            const create = document.createElement('button');
            create.type = 'button';
            create.className = 'button button-primary';
            create.textContent = 'Skapa granskningsdel';
            if (!target) {
                create.disabled = true;
                create.setAttribute('aria-describedby', `recurring-no-target-${proposal.proposalType}`);
                const notice = create_text('p', 'Ingen motsvarande granskningsdelstyp finns i den aktiva regelfilen.', 'field-hint');
                notice.id = `recurring-no-target-${proposal.proposalType}`;
                card.appendChild(notice);
            }
            create.addEventListener('click', async () => {
                const ok = create_recurring_sample(host, proposal, result.previews?.[proposal.proposalType] || null);
                if (!ok) return;
                create.disabled = true;
                try {
                    await sync_to_server_now(host.getState, host.dispatch);
                } catch {
                    // Lokalt state är fortfarande uppdaterat; ordinarie sync kan försöka igen.
                }
                host.NotificationComponent?.show_global_message?.(`${LABELS[proposal.proposalType]} skapades som granskningsdel.`, 'success');
                card.remove();
                host.on_changed?.();
            });

            const dismiss = document.createElement('button');
            dismiss.type = 'button';
            dismiss.className = 'button button-default';
            dismiss.textContent = 'Dölj förslag';
            dismiss.addEventListener('click', () => card.remove());
            actions.append(create, dismiss);
            card.appendChild(actions);
            list.appendChild(card);
        }
    } catch (error) {
        status.textContent = `Återkommande innehåll kunde inte analyseras: ${error instanceof Error ? error.message : String(error)}`;
    }
}
