import { parse_bulk_sample_urls } from '../../js/logic/bulk_sample_url_input.ts';
import { classify_page_type, resolve_sample_type_id_for_classification } from '../../shared/sample/page_type_classifier.ts';
import { build_recurring_component_proposals, recurring_candidate_similarity } from '../../shared/recurring/recurring_component_compare.ts';
import { resolve_recurring_sample_target } from '../../shared/sample/recurring_sample_type_resolver.ts';

describe('deterministiskt granskningsdelsflöde', () => {
    test('URL-lista normaliserar protokoll och markerar dubbletter', () => {
        const rows = parse_bulk_sample_urls('example.com\nhttps://example.com/\nhttps://example.org/a#x');
        expect(rows[0]?.status).toBe('valid');
        expect(rows[0]?.normalizedUrl).toBe('https://example.com/');
        expect(rows[1]?.status).toBe('duplicate');
        expect(rows[2]?.normalizedUrl).toBe('https://example.org/a');
    });

    test('startsida klassificeras starkt men generisk sida lämnas okänd', () => {
        const home = classify_page_type({ requestedUrl: 'https://example.com/' });
        expect(home.kind).toBe('home');
        expect(home.confidence).toBe('high');

        const generic = classify_page_type({
            requestedUrl: 'https://example.com/sida',
            pageTitle: 'Information'
        });
        expect(generic.kind).toBe('unknown');
        expect(generic.confidence).toBe('none');
    });

    test('okänd sidtyp väljs aldrig automatiskt i regelfilen', () => {
        const unknown = classify_page_type({ requestedUrl: 'https://example.com/sida', pageTitle: 'Info' });
        expect(resolve_sample_type_id_for_classification(unknown, [
            { id: 'start', text: 'Startsida' },
            { id: 'info', text: 'Informationssida' }
        ])).toBeNull();
    });

    test('identiska recurring-fingerprints ger full likhet', () => {
        expect(recurring_candidate_similarity(
            { candidateType: 'header', structureFingerprint: 'abc' },
            { candidateType: 'header', structureFingerprint: 'abc' }
        )).toBe(1);
        expect(recurring_candidate_similarity(
            { candidateType: 'header', structureFingerprint: 'abc' },
            { candidateType: 'footer', structureFingerprint: 'abc' }
        )).toBe(0);
    });

    test('headerförslag kräver repetition och exkluderar meny som separat ägare', () => {
        const proposals = build_recurring_component_proposals([
            {
                sampleId: 'a',
                candidates: [{
                    candidateType: 'header',
                    score: 95,
                    structureFingerprint: 'same',
                    matchedSignals: ['semantic-header']
                }]
            },
            {
                sampleId: 'b',
                candidates: [{
                    candidateType: 'header',
                    score: 95,
                    structureFingerprint: 'same',
                    matchedSignals: ['semantic-header']
                }]
            }
        ]);
        const header = proposals.find((proposal) => proposal.proposalType === 'header');
        expect(header).toBeTruthy();
        expect(header?.ownership.excludeOwners).toEqual(['menu']);
    });

    test('cookiebanner kan föreslås från initial observation utan två synliga banners', () => {
        const proposals = build_recurring_component_proposals([
            { sampleId: 'a', consentUiFound: true },
            { sampleId: 'b', consentUiFound: false }
        ]);
        expect(proposals.some((proposal) => proposal.proposalType === 'cookie')).toBe(true);
    });

    test('recurring-typ mappas till icke-URL-kategori i aktiv regelfil', () => {
        const metadata = {
            samples: {
                sampleCategories: [
                    {
                        id: 'web',
                        text: 'Webbsidor',
                        hasUrl: true,
                        categories: [{ id: 'start', text: 'Startsida' }]
                    },
                    {
                        id: 'recurring',
                        text: 'Återkommande innehåll',
                        hasUrl: false,
                        categories: [
                            { id: 'header', text: 'Sidhuvud' },
                            { id: 'footer', text: 'Sidfot' },
                            { id: 'menu', text: 'Meny' }
                        ]
                    }
                ]
            }
        };
        expect(resolve_recurring_sample_target(metadata, 'header')).toEqual({
            sampleCategory: 'recurring',
            sampleType: 'header',
            categoryLabel: 'Återkommande innehåll',
            typeLabel: 'Sidhuvud'
        });
    });
});
