/**
 * @fileoverview Kör en full sidrapport-capture mot testdatabasen och verifierar ready + warnings_json.
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import pg from 'pg';
import { initialize_snapshot_job_service, start_snapshot_capture } from '../server/services/audit_snapshot_job_service.ts';
import { get_audit_snapshot_by_id } from '../server/repositories/audit_snapshot_repository.ts';

const DEFAULT_URL =
    'https://www.apohem.se/sar-bett-stick/sar/sartvatt/ekodes-smart-desinfektion-100-ml';

type TestContext = {
    audit_id: string;
    sample_id: string;
    url: string;
};

async function resolve_test_context(client: pg.Client): Promise<TestContext> {
    const failed = await client.query<TestContext>(
        `SELECT audit_id, sample_id, requested_url AS url
         FROM audit_snapshots
         WHERE status = 'failed'
         ORDER BY created_at DESC
         LIMIT 1`
    );
    if (failed.rows[0]) {
        return failed.rows[0];
    }
    const any_row = await client.query<TestContext>(
        `SELECT audit_id, sample_id, requested_url AS url
         FROM audit_snapshots
         ORDER BY created_at DESC
         LIMIT 1`
    );
    if (!any_row.rows[0]) {
        throw new Error('Ingen audit_snapshots-rad hittades för E2E-test');
    }
    return any_row.rows[0];
}

async function wait_for_terminal_status(
    audit_id: string,
    capture_id: string,
    timeout_ms: number
): Promise<NonNullable<Awaited<ReturnType<typeof get_audit_snapshot_by_id>>>> {
    const started = Date.now();
    while (Date.now() - started < timeout_ms) {
        const row = await get_audit_snapshot_by_id(audit_id, capture_id);
        if (row && (row.status === 'ready' || row.status === 'failed' || row.status === 'cancelled')) {
            return row;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(`Timeout efter ${timeout_ms} ms – sidrapporten blev inte klar`);
}

async function main(): Promise<void> {
    const url = process.argv[2] || DEFAULT_URL;
    const client = new pg.Client({
        connectionString:
            process.env.DATABASE_URL || 'postgresql://granskning:granskning@localhost:5432/granskningsverktyget',
    });
    await client.connect();
    let audit_id = '';
    let capture_id = '';
    try {
        const ctx = await resolve_test_context(client);
        audit_id = ctx.audit_id;
        capture_id = randomUUID();

        await initialize_snapshot_job_service();

        await start_snapshot_capture(ctx.audit_id, {
            captureId: capture_id,
            sampleId: ctx.sample_id,
            url,
            attachScreenshotToSample: false,
        });

        const row = await wait_for_terminal_status(ctx.audit_id, capture_id, 180_000);
        if (row.status !== 'ready') {
            throw new Error(
                `Förväntade status ready, fick ${row.status}: ${row.error ?? 'okänt fel'}`
            );
        }

        console.log(
            JSON.stringify(
                {
                    ok: true,
                    capture_id,
                    audit_id: ctx.audit_id,
                    snapshot_status: row.status,
                    warning_count: row.warning_count,
                    warnings_json_present: row.warnings_json !== null && row.warnings_json !== undefined,
                    page_title: row.page_title,
                    size_bytes: row.size_bytes,
                },
                null,
                2
            )
        );
    } finally {
        await client.end();
    }
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ ok: false, error: message }, null, 2));
    process.exit(1);
});
