import {
    mask_api_key,
    validate_base_url,
    validate_model,
    validate_provider,
    validate_timeout_ms
} from '../../server/services/llm_settings_validation.ts';

describe('llm_settings_validation', () => {
    test('validate_provider accepterar ollama och openai', () => {
        expect(validate_provider('ollama')).toBe('ollama');
        expect(validate_provider('OpenAI')).toBe('openai');
    });

    test('validate_provider avvisar okänd leverantör', () => {
        expect(() => validate_provider('anthropic')).toThrow(/leverantör/i);
    });

    test('validate_base_url tillåter lokal Ollama', () => {
        expect(validate_base_url('ollama', 'http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434');
        expect(validate_base_url('ollama', 'http://ollama-final:11434/')).toBe('http://ollama-final:11434');
    });

    test('validate_base_url avvisar otillåten värd för Ollama', () => {
        expect(() => validate_base_url('ollama', 'https://example.com')).toThrow(/värd/i);
    });

    test('validate_model kräver icke-tom sträng', () => {
        expect(validate_model('qwen2.5:7b')).toBe('qwen2.5:7b');
        expect(() => validate_model('   ')).toThrow(/modell/i);
    });

    test('validate_timeout_ms inom intervall', () => {
        expect(validate_timeout_ms(60000)).toBe(60000);
        expect(() => validate_timeout_ms(500)).toThrow(/timeout/i);
    });

    test('mask_api_key maskerar sparad nyckel', () => {
        expect(mask_api_key(null)).toEqual({ configured: false, masked: null });
        expect(mask_api_key('sk-abcd1234')).toEqual({ configured: true, masked: '****1234' });
    });
});
