-- Globala LLM-inställningar (en rad per Leffe-instans)

CREATE TABLE IF NOT EXISTS system_llm_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    provider VARCHAR(32) NOT NULL DEFAULT 'ollama',
    base_url VARCHAR(512) NOT NULL DEFAULT 'http://127.0.0.1:11434',
    model VARCHAR(256) NOT NULL DEFAULT '',
    api_key TEXT DEFAULT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    timeout_ms INTEGER NOT NULL DEFAULT 60000,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO system_llm_settings (id, provider, base_url, model, enabled, timeout_ms)
VALUES (1, 'ollama', 'http://127.0.0.1:11434', '', false, 60000)
ON CONFLICT (id) DO NOTHING;
