/**
 * @file Validering och maskering för LLM-inställningar.
 */

export type LlmProvider = 'ollama' | 'openai';

export interface LlmSettingsRow {
    provider: LlmProvider;
    base_url: string;
    model: string;
    api_key: string | null;
    enabled: boolean;
    timeout_ms: number;
    updated_at: string | null;
    updated_by_user_id: string | null;
}

export interface LlmSettingsPublic {
    provider: LlmProvider;
    base_url: string;
    model: string;
    enabled: boolean;
    timeout_ms: number;
    api_key_configured: boolean;
    api_key_masked: string | null;
    updated_at: string | null;
    updated_by_user_id: string | null;
}

const OLLAMA_ALLOWED_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'ollama-final',
    'host.docker.internal'
]);

const OPENAI_ALLOWED_HOSTS = new Set(['api.openai.com']);

function is_private_ipv4(hostname: string): boolean {
    const parts = hostname.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
}

export function is_allowed_hostname(provider: LlmProvider, hostname: string): boolean {
    const host = hostname.toLowerCase();
    if (provider === 'ollama') {
        return OLLAMA_ALLOWED_HOSTS.has(host) || is_private_ipv4(host);
    }
    if (provider === 'openai') {
        return OPENAI_ALLOWED_HOSTS.has(host);
    }
    return false;
}

export function validate_provider(value: unknown): LlmProvider {
    const provider = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (provider === 'ollama' || provider === 'openai') return provider;
    throw new Error('Ogiltig leverantör. Välj Ollama eller OpenAI.');
}

export function validate_base_url(provider: LlmProvider, value: unknown): string {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) throw new Error('Bas-URL krävs.');
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        throw new Error('Bas-URL måste vara en giltig adress (t.ex. http://127.0.0.1:11434).');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Bas-URL måste börja med http:// eller https://.');
    }
    if (parsed.username || parsed.password) {
        throw new Error('Bas-URL får inte innehålla användarnamn eller lösenord.');
    }
    if (!is_allowed_hostname(provider, parsed.hostname)) {
        throw new Error('Bas-URL pekar på en otillåten värd för vald leverantör.');
    }
    return parsed.toString().replace(/\/$/, '');
}

export function validate_model(value: unknown): string {
    const model = typeof value === 'string' ? value.trim() : '';
    if (!model) throw new Error('Modellnamn krävs.');
    if (model.length > 256) throw new Error('Modellnamnet är för långt.');
    return model;
}

export function validate_timeout_ms(value: unknown): number {
    const num = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
    if (!Number.isInteger(num) || num < 1000 || num > 600000) {
        throw new Error('Timeout måste vara mellan 1 000 och 600 000 millisekunder.');
    }
    return num;
}

export function mask_api_key(api_key: string | null | undefined): { configured: boolean; masked: string | null } {
    if (!api_key || !String(api_key).trim()) {
        return { configured: false, masked: null };
    }
    const key = String(api_key).trim();
    if (key.length <= 4) {
        return { configured: true, masked: '****' };
    }
    return { configured: true, masked: `****${key.slice(-4)}` };
}

export function to_public_settings(row: LlmSettingsRow): LlmSettingsPublic {
    const masked = mask_api_key(row.api_key);
    return {
        provider: row.provider,
        base_url: row.base_url,
        model: row.model,
        enabled: row.enabled,
        timeout_ms: row.timeout_ms,
        api_key_configured: masked.configured,
        api_key_masked: masked.masked,
        updated_at: row.updated_at,
        updated_by_user_id: row.updated_by_user_id
    };
}
