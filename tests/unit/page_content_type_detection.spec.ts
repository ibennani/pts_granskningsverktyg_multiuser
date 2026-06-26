/**
 * @fileoverview Enhetstester för innehållstyp-detektering (regler och Puppeteer-tjänst).
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const set_user_agent_mock = jest.fn(async () => undefined);
const set_extra_http_headers_mock = jest.fn(async () => undefined);
const evaluate_on_new_document_mock = jest.fn(async () => undefined);
const set_viewport_mock = jest.fn(async () => undefined);
const goto_mock = jest.fn(async () => ({ status: () => 200 }));
const evaluate_mock = jest.fn(async () => ['form', 'table']);
const wait_for_network_idle_mock = jest.fn(async () => undefined);
const close_mock = jest.fn(async () => undefined);

jest.unstable_mockModule('puppeteer', () => ({
    default: {
        launch: jest.fn(async () => ({
            newPage: jest.fn(async () => ({
                setUserAgent: set_user_agent_mock,
                setExtraHTTPHeaders: set_extra_http_headers_mock,
                evaluateOnNewDocument: evaluate_on_new_document_mock,
                setViewport: set_viewport_mock,
                goto: goto_mock,
                evaluate: evaluate_mock,
                waitForNetworkIdle: wait_for_network_idle_mock,
            })),
            close: close_mock,
        })),
    },
}));

const {
    content_type_id_matches_signal,
    map_dom_hits_to_content_type_ids,
} = await import('../../server/services/page_content_type_detection_rules.ts');

const { detect_page_content_types } = await import(
    '../../server/services/page_content_type_detection_service.ts'
);

describe('page_content_type_detection_rules', () => {
    test('matchar form och forms men inte information', () => {
        expect(content_type_id_matches_signal('forms', 'form')).toBe(true);
        expect(content_type_id_matches_signal('contact-form', 'form')).toBe(true);
        expect(content_type_id_matches_signal('information', 'form')).toBe(false);
    });

    test('matchar video-content mot video-signal', () => {
        expect(content_type_id_matches_signal('video-content', 'video')).toBe(true);
    });

    test('map_dom_hits filtrerar till tillåtna ID:n', () => {
        const result = map_dom_hits_to_content_type_ids(
            ['forms', 'plain', 'information'],
            ['form']
        );
        expect(result).toEqual(['forms']);
    });

    test('map_dom_hits returnerar sorterad lista utan dubbletter', () => {
        const result = map_dom_hits_to_content_type_ids(
            ['data-table', 'forms'],
            ['form', 'table']
        );
        expect(result).toEqual(['data-table', 'forms']);
    });
});

describe('page_content_type_detection_service', () => {
    beforeEach(() => {
        goto_mock.mockClear();
        evaluate_mock.mockClear();
        close_mock.mockClear();
        evaluate_mock.mockImplementation(async () => ['form']);
    });

    test('returnerar tom lista utan tillåtna ID:n', async () => {
        const result = await detect_page_content_types({
            url: 'https://example.com',
            allowed_content_type_ids: [],
        });
        expect(result.detected_content_type_ids).toEqual([]);
        expect(goto_mock).not.toHaveBeenCalled();
    });

    test('navigerar och returnerar detekterade ID:n', async () => {
        const result = await detect_page_content_types({
            url: 'https://example.com/page',
            allowed_content_type_ids: ['forms', 'information'],
        });
        expect(goto_mock).toHaveBeenCalledWith(
            'https://example.com/page',
            expect.objectContaining({ waitUntil: 'load' })
        );
        expect(result.detected_content_type_ids).toEqual(['forms']);
        expect(close_mock).toHaveBeenCalled();
    });
});
