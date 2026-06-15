import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { test_llm_connection, get_llm_availability, send_llm_chat } from '../../server/services/llm_proxy_service.ts';

describe('llm_proxy_service', () => {
    const saved = {
        provider: 'ollama' as const,
        base_url: 'http://127.0.0.1:11434',
        model: 'qwen2.5:7b',
        api_key: null,
        enabled: true,
        timeout_ms: 5000,
        updated_at: null,
        updated_by_user_id: null
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('test_llm_connection returnerar modeller vid lyckat anrop', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ models: [{ name: 'qwen2.5:7b' }, { name: 'llama3' }] })
        }) as unknown as typeof fetch;

        const result = await test_llm_connection(saved, {
            base_url: 'http://127.0.0.1:11434',
            model: 'qwen2.5:7b'
        });

        expect(result.ok).toBe(true);
        expect(result.status).toBe('connected');
        expect(result.models).toContain('qwen2.5:7b');
        expect(result.model_available).toBe(true);
    });

    test('test_llm_connection markerar otillgänglig modell', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ models: [{ name: 'llama3' }] })
        }) as unknown as typeof fetch;

        const result = await test_llm_connection(saved, {
            base_url: 'http://127.0.0.1:11434',
            model: 'qwen2.5:7b'
        });

        expect(result.ok).toBe(true);
        expect(result.model_available).toBe(false);
    });

    test('test_llm_connection hanterar nätverksfel', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

        const result = await test_llm_connection(saved, {
            base_url: 'http://127.0.0.1:11434'
        });

        expect(result.ok).toBe(false);
        expect(result.status).toBe('unreachable');
        expect(result.message).toMatch(/ECONNREFUSED/);
    });

    test('get_llm_availability returnerar false när AI är av', async () => {
        const result = await get_llm_availability({ ...saved, enabled: false });
        expect(result.available).toBe(false);
        expect(result.enabled).toBe(false);
    });

    test('get_llm_availability returnerar true vid lyckad anslutning även om modellnamn skiljer', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ models: [{ name: 'llama3' }] })
        }) as unknown as typeof fetch;

        const result = await get_llm_availability({ ...saved, model: 'qwen2.5:7b' });
        expect(result.available).toBe(true);
        expect(result.enabled).toBe(true);
    });

    test('send_llm_chat returnerar svar från Ollama', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ message: { content: 'Hej från Leffe' } })
        }) as unknown as typeof fetch;

        const result = await send_llm_chat(saved, [{ role: 'user', content: 'Hej' }]);
        expect(result.content).toBe('Hej från Leffe');
    });
});
