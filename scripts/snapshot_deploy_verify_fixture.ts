/**
 * @fileoverview Isolerad granskning för deploy-verifiering av sidrapporter.
 * Får aldrig återanvända audit_id eller sample_id från riktiga granskningar.
 */
import type pg from 'pg';

export const SNAPSHOT_DEPLOY_VERIFY_AUDIT_ID = 'f0000000-0000-4000-8000-000000000001';
export const SNAPSHOT_DEPLOY_VERIFY_SAMPLE_ID = 'f0000000-0000-4000-8000-000000000002';

const FIXTURE_METADATA = {
    caseName: '__deploy_snapshot_verify__',
    deploySnapshotVerify: true,
};

const FIXTURE_SAMPLE = {
    id: SNAPSHOT_DEPLOY_VERIFY_SAMPLE_ID,
    description: 'Deploy-verifiering (intern, ej användargranskning)',
    url: 'https://example.com/deploy-snapshot-verify',
    sampleCategory: '',
    requirementResults: {},
};

async function fetch_rule_set_for_fixture(client: pg.Client): Promise<{
    id: string;
    content: unknown;
}> {
    const result = await client.query<{ id: string; content: unknown }>(
        `SELECT id, COALESCE(published_content, content) AS content
         FROM rule_sets
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1`
    );
    const row = result.rows[0];
    if (!row?.id) {
        throw new Error('Ingen regelfil hittades för deploy-verifiering');
    }
    return row;
}

export async function ensure_snapshot_deploy_verify_context(
    client: pg.Client
): Promise<{ audit_id: string; sample_id: string }> {
    const existing = await client.query(
        'SELECT id FROM audits WHERE id = $1',
        [SNAPSHOT_DEPLOY_VERIFY_AUDIT_ID]
    );
    if (existing.rows.length === 0) {
        const rule_set = await fetch_rule_set_for_fixture(client);
        await client.query(
            `INSERT INTO audits (
                id, rule_set_id, rule_file_content, status, metadata, samples, last_updated_by
            ) VALUES ($1, $2, $3, 'not_started', $4::jsonb, $5::jsonb, 'deploy-verify')`,
            [
                SNAPSHOT_DEPLOY_VERIFY_AUDIT_ID,
                rule_set.id,
                JSON.stringify(rule_set.content),
                JSON.stringify(FIXTURE_METADATA),
                JSON.stringify([FIXTURE_SAMPLE]),
            ]
        );
    }
    return {
        audit_id: SNAPSHOT_DEPLOY_VERIFY_AUDIT_ID,
        sample_id: SNAPSHOT_DEPLOY_VERIFY_SAMPLE_ID,
    };
}
