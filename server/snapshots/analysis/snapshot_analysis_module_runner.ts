/**
 * @fileoverview Kör en enskild analysmodul med felisolering.
 */
import type { SnapshotWarning } from '../page_snapshot_cdp.js';
import { write_analysis_module_result } from './snapshot_analysis_io.js';
import type {
    AnalysisContext,
    AnalysisModuleDef,
    AnalysisModuleEnvelope,
} from './snapshot_analysis_types.js';

export async function run_analysis_module(
    def: AnalysisModuleDef,
    ctx: AnalysisContext
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    if (ctx.should_stop()) {
        return skip_envelope(def, 'stopped-before-start');
    }
    if (ctx.page_state_corrupted() && def.phase === 2) {
        return skip_envelope(def, 'page-state-corrupted');
    }
    try {
        const envelope = await def.run(ctx);
        await write_analysis_module_result(ctx.temp_dir, def.output_path, envelope);
        return envelope;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.warnings.push({
            code: 'analysis_module_failed',
            message: `Analysis module ${def.name} failed: ${message}`,
        });
        const failed: AnalysisModuleEnvelope = {
            module: def.name,
            version: def.version,
            phase: def.phase,
            status: 'failed',
            durationMs: Date.now() - started,
            recordCount: 0,
            truncated: false,
            skipReason: message,
            warnings: [message],
            data: null,
        };
        await write_analysis_module_result(ctx.temp_dir, def.output_path, failed);
        return failed;
    }
}

function skip_envelope(def: AnalysisModuleDef, reason: string): AnalysisModuleEnvelope {
    return {
        module: def.name,
        version: def.version,
        phase: def.phase,
        status: 'skipped',
        durationMs: 0,
        recordCount: 0,
        truncated: false,
        skipReason: reason,
        warnings: [],
        data: null,
    };
}

export type { SnapshotWarning };
