import {
    merge_model_names,
    get_connection_test_status_text,
    normalize_discovered_models,
    resolve_model_selection_after_discovery
} from '../../js/components/ai_settings_view_helpers.ts';

describe('ai_settings_view_helpers', () => {
    test('merge_model_names slår ihop hittade och sparad modell utan dubbletter', () => {
        expect(merge_model_names(['qwen2.5:7b', 'llama3'], 'qwen2.5:7b')).toEqual(['llama3', 'qwen2.5:7b']);
        expect(merge_model_names([], 'qwen2.5:7b')).toEqual(['qwen2.5:7b']);
    });

    test('get_connection_test_status_text returnerar kort status vid test', () => {
        const t = (key: string) => key;
        expect(get_connection_test_status_text(t, true, null)).toBe('ai_settings_testing');
        expect(get_connection_test_status_text(t, false, { ok: true, status: 'ok', message: '', models: [], model_available: true }))
            .toBe('ai_settings_test_connection_ok');
        expect(get_connection_test_status_text(t, false, { ok: false, status: 'error', message: 'x', models: [], model_available: null }))
            .toBe('ai_settings_test_connection_failed');
        expect(get_connection_test_status_text(t, false, null)).toBe('');
    });

    test('normalize_discovered_models sorterar och tar bort dubbletter', () => {
        expect(normalize_discovered_models(['b', 'a', 'b'])).toEqual(['a', 'b']);
    });

    test('resolve_model_selection_after_discovery behåller val i ny lista', () => {
        expect(resolve_model_selection_after_discovery(['a', 'b'], 'b')).toEqual({
            discovered_models: ['a', 'b'],
            selected_model: 'b'
        });
    });

    test('resolve_model_selection_after_discovery väljer enda modellen automatiskt', () => {
        expect(resolve_model_selection_after_discovery(['qwen2.5:7b'], '')).toEqual({
            discovered_models: ['qwen2.5:7b'],
            selected_model: 'qwen2.5:7b'
        });
    });

    test('resolve_model_selection_after_discovery rensar val som saknas i ny lista', () => {
        expect(resolve_model_selection_after_discovery(['gemma4:12b', 'qwen2.5-coder:14b'], 'llama3')).toEqual({
            discovered_models: ['gemma4:12b', 'qwen2.5-coder:14b'],
            selected_model: ''
        });
    });
});
