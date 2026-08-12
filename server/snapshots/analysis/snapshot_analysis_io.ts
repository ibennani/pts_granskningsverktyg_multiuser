/**
 * @fileoverview Skrivning av analysfiler till temp_dir.
 */
import fs from 'fs/promises';
import path from 'path';
import type {
    AnalysisIndex,
    AnalysisModuleEnvelope,
} from './snapshot_analysis_types.js';

export async function write_analysis_json(
    temp_dir: string,
    rel_path: string,
    data: unknown
): Promise<void> {
    const full = path.join(temp_dir, rel_path);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, JSON.stringify(data, null, 2), 'utf8');
}

export async function write_analysis_module_result(
    temp_dir: string,
    rel_path: string,
    envelope: AnalysisModuleEnvelope
): Promise<void> {
    await write_analysis_json(temp_dir, rel_path, envelope);
}

export async function write_analysis_png(
    temp_dir: string,
    rel_path: string,
    buffer: Buffer
): Promise<void> {
    const full = path.join(temp_dir, rel_path);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
}

export async function write_analysis_index(
    temp_dir: string,
    index: AnalysisIndex
): Promise<void> {
    await write_analysis_json(temp_dir, 'analysis/index.json', index);
}

export async function write_dom_snapshot_schema(
    temp_dir: string,
    computed_style_properties: string[]
): Promise<void> {
    await write_analysis_json(temp_dir, 'analysis/dom-snapshot-schema.json', {
        computedStyleProperties: computed_style_properties,
    });
}
