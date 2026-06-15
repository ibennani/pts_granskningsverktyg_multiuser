/**
 * @file Lagring och hantering av globala LLM-inställningar.
 */

import { query } from '../db.js';
import {
    type LlmProvider,
    type LlmSettingsPublic,
    type LlmSettingsRow,
    to_public_settings,
    validate_base_url,
    validate_model,
    validate_provider,
    validate_timeout_ms
} from './llm_settings_validation.js';

export interface LlmSettingsUpdateInput {
    provider?: unknown;
    base_url?: unknown;
    model?: unknown;
    enabled?: unknown;
    timeout_ms?: unknown;
    api_key?: unknown;
}

export interface LlmSettingsInternal extends LlmSettingsRow {}

function env_default_base_url(): string {
    const from_env = (process.env.OLLAMA_BASE_URL || '').trim();
    return from_env || 'http://127.0.0.1:11434';
}

function map_row(raw: Record<string, unknown>): LlmSettingsRow {
    return {
        provider: (raw.provider as LlmProvider) || 'ollama',
        base_url: String(raw.base_url || env_default_base_url()),
        model: String(raw.model || ''),
        api_key: raw.api_key != null ? String(raw.api_key) : null,
        enabled: raw.enabled === true,
        timeout_ms: Number(raw.timeout_ms) || 60000,
        updated_at: raw.updated_at != null ? String(raw.updated_at) : null,
        updated_by_user_id: raw.updated_by_user_id != null ? String(raw.updated_by_user_id) : null
    };
}

async function ensure_settings_row(): Promise<LlmSettingsRow> {
    const existing = await query('SELECT * FROM system_llm_settings WHERE id = 1');
    if (existing.rows.length > 0) {
        return map_row(existing.rows[0] as Record<string, unknown>);
    }
    const base_url = env_default_base_url();
    await query(
        `INSERT INTO system_llm_settings (id, provider, base_url, model, enabled, timeout_ms)
         VALUES (1, 'ollama', $1, '', false, 60000)
         ON CONFLICT (id) DO NOTHING`,
        [base_url]
    );
    const after = await query('SELECT * FROM system_llm_settings WHERE id = 1');
    if (after.rows.length === 0) {
        return {
            provider: 'ollama',
            base_url,
            model: '',
            api_key: null,
            enabled: false,
            timeout_ms: 60000,
            updated_at: null,
            updated_by_user_id: null
        };
    }
    return map_row(after.rows[0] as Record<string, unknown>);
}

export async function get_settings_for_api(): Promise<LlmSettingsPublic> {
    const row = await ensure_settings_row();
    return to_public_settings(row);
}

export async function get_settings_for_proxy(): Promise<LlmSettingsInternal> {
    return ensure_settings_row();
}

function parse_enabled(value: unknown, current: boolean): boolean {
    if (value === undefined) return current;
    return value === true || value === 'true' || value === 1 || value === '1';
}

export async function save_settings(
    updates: LlmSettingsUpdateInput,
    user_id: string | null
): Promise<LlmSettingsPublic> {
    const current = await ensure_settings_row();
    const provider = updates.provider !== undefined ? validate_provider(updates.provider) : current.provider;
    const base_url = updates.base_url !== undefined ? validate_base_url(provider, updates.base_url) : current.base_url;
    const model = updates.model !== undefined ? validate_model(updates.model) : current.model;
    const timeout_ms = updates.timeout_ms !== undefined ? validate_timeout_ms(updates.timeout_ms) : current.timeout_ms;
    const enabled = parse_enabled(updates.enabled, current.enabled);

    let api_key = current.api_key;
    if (updates.api_key !== undefined) {
        const next_key = typeof updates.api_key === 'string' ? updates.api_key.trim() : '';
        if (next_key) api_key = next_key;
    }

    await query(
        `UPDATE system_llm_settings
         SET provider = $1, base_url = $2, model = $3, api_key = $4, enabled = $5,
             timeout_ms = $6, updated_at = CURRENT_TIMESTAMP, updated_by_user_id = $7
         WHERE id = 1`,
        [provider, base_url, model, api_key, enabled, timeout_ms, user_id]
    );
    return get_settings_for_api();
}
