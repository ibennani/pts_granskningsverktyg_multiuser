/**
 * @fileoverview Läser analys-sammanfattning från snapshot temp eller arkiv.
 */
import fs from 'fs/promises';
import path from 'path';
import {
    get_snapshot_archive_path,
    get_snapshot_temp_capture_dir,
} from '../snapshots/audit_snapshot_storage.js';
import { open_snapshot_archive_entry } from '../snapshots/audit_snapshot_archive_read.js';
import {
    classify_sample_page_type,
    type SamplePageTypeClassification,
} from '../../shared/logic/sample_page_type_classifier.js';
import { load_audit_rule_file_content } from './audit_snapshot_rulefile_loader.js';

export type SnapshotAnalysisSummary = {
    captureId: string;
    source: 'temp' | 'archive' | null;
    contentTypes: unknown | null;
    pageBlocks: unknown | null;
    menuNavigation: unknown | null;
    initialConsent: unknown | null;
    analysisIndex: unknown | null;
    pageTypeClassification: SamplePageTypeClassification | null;
};

async function read_json_file(full_path: string): Promise<unknown | null> {
    try {
        const raw = await fs.readFile(full_path, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function read_json_from_archive(
    archive_path: string,
    entry_path: string
): Promise<unknown | null> {
    try {
        const raw = await open_snapshot_archive_entry(archive_path, entry_path);
        if (!raw) return null;
        return JSON.parse(raw.toString('utf8'));
    } catch {
        return null;
    }
}

async function read_analysis_json(
    base_dir: string | null,
    archive_path: string | null,
    entry_path: string
): Promise<unknown | null> {
    if (base_dir) {
        const from_temp = await read_json_file(path.join(base_dir, entry_path));
        if (from_temp !== null) {
            return from_temp;
        }
    }
    if (archive_path) {
        return await read_json_from_archive(archive_path, entry_path);
    }
    return null;
}

async function read_text_from_sources(
    base_dir: string | null,
    archive_path: string | null,
    entry_path: string
): Promise<string> {
    if (base_dir) {
        try {
            return await fs.readFile(path.join(base_dir, entry_path), 'utf8');
        } catch {
            // fortsätt
        }
    }
    if (archive_path) {
        const raw = await open_snapshot_archive_entry(archive_path, entry_path);
        if (raw) {
            return raw.toString('utf8');
        }
    }
    return '';
}

function metadata_record(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

async function build_page_type_classification(
    audit_id: string,
    base_dir: string | null,
    archive_path: string | null
): Promise<SamplePageTypeClassification | null> {
    const rule_file = await load_audit_rule_file_content(audit_id);
    if (!rule_file) {
        return null;
    }

    const metadata_json = await read_analysis_json(base_dir, archive_path, 'metadata.json');
    const meta = metadata_record(metadata_json);
    const html = await read_text_from_sources(base_dir, archive_path, 'source.html');

    let h1_text = '';
    const h1_match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1_match?.[1]) {
        h1_text = h1_match[1].replace(/<[^>]+>/g, ' ').trim();
    }

    return classify_sample_page_type({
        final_url: String(meta.finalUrl || meta.requestedUrl || ''),
        page_title: String(meta.pageTitle || ''),
        h1_text,
        html,
        rule_file_content: rule_file,
    });
}

export async function build_snapshot_analysis_summary(
    audit_id: string,
    capture_id: string
): Promise<SnapshotAnalysisSummary | null> {
    const temp_dir = get_snapshot_temp_capture_dir(audit_id, capture_id);
    let base_dir: string | null = null;
    try {
        await fs.access(temp_dir);
        base_dir = temp_dir;
    } catch {
        base_dir = null;
    }

    const archive_path = get_snapshot_archive_path(audit_id, capture_id);
    let archive_available = false;
    try {
        await fs.access(archive_path);
        archive_available = true;
    } catch {
        archive_available = false;
    }

    if (!base_dir && !archive_available) {
        return null;
    }

    const archive_ref = archive_available ? archive_path : null;
    const source: SnapshotAnalysisSummary['source'] = base_dir ? 'temp' : 'archive';

    const [contentTypes, pageBlocks, menuNavigation, initialConsent, analysisIndex] =
        await Promise.all([
            read_analysis_json(base_dir, archive_ref, 'analysis/content-types.json'),
            read_analysis_json(base_dir, archive_ref, 'analysis/phase1/page-blocks.json'),
            read_analysis_json(base_dir, archive_ref, 'analysis/phase1/menu-navigation.json'),
            read_analysis_json(base_dir, archive_ref, 'analysis/phase1/initial-consent.json'),
            read_analysis_json(base_dir, archive_ref, 'analysis/index.json'),
        ]);

    const pageTypeClassification = await build_page_type_classification(
        audit_id,
        base_dir,
        archive_ref
    );

    return {
        captureId: capture_id,
        source,
        contentTypes,
        pageBlocks,
        menuNavigation,
        initialConsent,
        analysisIndex,
        pageTypeClassification,
    };
}
