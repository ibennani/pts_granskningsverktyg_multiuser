-- Granskningsverktyget - initial schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rule_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    content JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
    CREATE TYPE audit_status AS ENUM ('not_started', 'in_progress', 'locked', 'archived');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_set_id UUID REFERENCES rule_sets(id) ON DELETE SET NULL,
    status audit_status DEFAULT 'not_started',
    metadata JSONB DEFAULT '{}',
    samples JSONB DEFAULT '[]',
    version INTEGER DEFAULT 1,
    last_updated_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bootstrap admin user (om ingen admin finns)
INSERT INTO users (name, is_admin)
SELECT 'Admin', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE is_admin = true LIMIT 1);
