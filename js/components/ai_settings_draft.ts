/**
 * @file Osparade AI-inställningar i sessionStorage (ej samma som DB eller DraftManager).
 */

import type { LlmTestResult } from './ai_settings_view_helpers.ts';

export const AI_SETTINGS_DRAFT_STORAGE_KEY = 'draft:ai_settings:v1';
export const AI_SETTINGS_DRAFT_DEBOUNCE_MS = 250;

const SCHEMA_VERSION = 1;

export interface AiSettingsDraft {
    schemaVersion: number;
    updatedAt: number;
    enabled: boolean;
    provider: string;
    base_url: string;
    model: string;
    timeout_ms: number;
    discovered_models: string[];
    selected_model: string;
    test_result: LlmTestResult | null;
}

function safe_parse(raw: string | null): AiSettingsDraft | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as AiSettingsDraft;
        if (parsed?.schemaVersion !== SCHEMA_VERSION) return null;
        if (typeof parsed.enabled !== 'boolean') return null;
        return parsed;
    } catch {
        return null;
    }
}

export function read_ai_settings_draft(): AiSettingsDraft | null {
    if (typeof sessionStorage === 'undefined') return null;
    return safe_parse(sessionStorage.getItem(AI_SETTINGS_DRAFT_STORAGE_KEY));
}

export function write_ai_settings_draft(draft: AiSettingsDraft): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(AI_SETTINGS_DRAFT_STORAGE_KEY, JSON.stringify({
        ...draft,
        schemaVersion: SCHEMA_VERSION,
        updatedAt: Date.now()
    }));
}

export function clear_ai_settings_draft(): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(AI_SETTINGS_DRAFT_STORAGE_KEY);
}
