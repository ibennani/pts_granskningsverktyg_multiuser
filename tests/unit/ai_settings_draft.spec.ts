import {
    read_ai_settings_draft,
    write_ai_settings_draft,
    clear_ai_settings_draft,
    AI_SETTINGS_DRAFT_STORAGE_KEY
} from '../../js/components/ai_settings_draft.ts';
import {
    merge_ai_settings_for_render,
    resolve_enabled_from_saved_and_draft
} from '../../js/components/ai_settings_view_state.ts';
import { AI_SETTINGS_DEFAULTS } from '../../js/components/ai_settings_view_helpers.ts';

describe('ai_settings_draft', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    test('skriver och läser utkast från sessionStorage', () => {
        write_ai_settings_draft({
            schemaVersion: 1,
            updatedAt: Date.now(),
            enabled: true,
            provider: 'ollama',
            base_url: 'http://127.0.0.1:11434',
            model: 'qwen2.5:7b',
            timeout_ms: 60000,
            discovered_models: ['qwen2.5:7b'],
            selected_model: 'qwen2.5:7b',
            test_result: { ok: true, status: 'ok', message: '', models: ['qwen2.5:7b'], model_available: true }
        });
        const draft = read_ai_settings_draft();
        expect(draft?.enabled).toBe(true);
        expect(draft?.base_url).toBe('http://127.0.0.1:11434');
        expect(sessionStorage.getItem(AI_SETTINGS_DRAFT_STORAGE_KEY)).toBeTruthy();
    });

    test('clear_ai_settings_draft tar bort utkast', () => {
        write_ai_settings_draft({
            schemaVersion: 1,
            updatedAt: Date.now(),
            enabled: false,
            provider: 'ollama',
            base_url: '',
            model: '',
            timeout_ms: 60000,
            discovered_models: [],
            selected_model: '',
            test_result: null
        });
        clear_ai_settings_draft();
        expect(read_ai_settings_draft()).toBeNull();
    });
});

describe('ai_settings_view_state', () => {
    test('resolve_enabled_from_saved_and_draft använder DB utan utkast', () => {
        const saved = { ...AI_SETTINGS_DEFAULTS, enabled: false };
        expect(resolve_enabled_from_saved_and_draft(saved, null, null)).toBe(false);
    });

    test('resolve_enabled_from_saved_and_draft använder utkast vid omladdning', () => {
        const saved = { ...AI_SETTINGS_DEFAULTS, enabled: false };
        const draft = {
            schemaVersion: 1,
            updatedAt: 1,
            enabled: true,
            provider: 'ollama',
            base_url: 'http://127.0.0.1:11434',
            model: '',
            timeout_ms: 60000,
            discovered_models: [],
            selected_model: '',
            test_result: null
        };
        expect(resolve_enabled_from_saved_and_draft(saved, draft, null)).toBe(true);
    });

    test('merge_ai_settings_for_render slår ihop sparade värden med utkast', () => {
        const saved = { ...AI_SETTINGS_DEFAULTS, enabled: false, base_url: 'http://old' };
        const draft = {
            schemaVersion: 1,
            updatedAt: 1,
            enabled: true,
            provider: 'ollama',
            base_url: 'http://127.0.0.1:11434',
            model: 'qwen2.5:7b',
            timeout_ms: 45000,
            discovered_models: [],
            selected_model: '',
            test_result: null
        };
        expect(merge_ai_settings_for_render(saved, draft).base_url).toBe('http://127.0.0.1:11434');
        expect(merge_ai_settings_for_render(saved, null).base_url).toBe('http://old');
    });
});
