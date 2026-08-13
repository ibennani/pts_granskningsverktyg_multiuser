/**
 * @fileoverview Hjälpfunktioner för utklipp av återkommande block ur sidrapportsskärmdump.
 */
import { CAPTURE_DEVICE_SCALE_FACTOR } from '../services/page_capture_session.js';

export type BlockBoundingBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type PageBlockCandidateLike = {
    candidateType?: string;
    structureFingerprint?: string;
    rootIdentity?: string;
    boundingBox?: BlockBoundingBox | null;
};

export type RecurringBlockMatchInput = {
    candidateType: string;
    structureFingerprint: string;
    rootIdentity?: string;
};

export type DeviceCropRegion = {
    left: number;
    top: number;
    width: number;
    height: number;
};

export function find_page_block_candidate(
    candidates: PageBlockCandidateLike[],
    target: RecurringBlockMatchInput
): PageBlockCandidateLike | null {
    const candidate_type = String(target.candidateType || '').trim();
    const fingerprint = String(target.structureFingerprint || '').trim();
    const root_identity = String(target.rootIdentity || '').trim();

    const same_type = candidates.filter(
        (row) => String(row.candidateType || '').trim() === candidate_type
    );
    if (same_type.length === 0) return null;

    if (fingerprint) {
        const exact = same_type.find(
            (row) => String(row.structureFingerprint || '').trim() === fingerprint
        );
        if (exact?.boundingBox) return exact;
    }

    if (root_identity) {
        const by_root = same_type.find(
            (row) => String(row.rootIdentity || '').trim() === root_identity
        );
        if (by_root?.boundingBox) return by_root;
    }

    return same_type.find((row) => row.boundingBox) ?? null;
}

export function compute_device_crop_region(
    bbox: BlockBoundingBox,
    image_width: number,
    image_height: number,
    device_scale_factor = CAPTURE_DEVICE_SCALE_FACTOR
): DeviceCropRegion | null {
    const scale = Number.isFinite(device_scale_factor) && device_scale_factor > 0
        ? device_scale_factor
        : CAPTURE_DEVICE_SCALE_FACTOR;

    let left = Math.floor(bbox.x * scale);
    let top = Math.floor(bbox.y * scale);
    let width = Math.ceil(bbox.width * scale);
    let height = Math.ceil(bbox.height * scale);

    if (width < 1 || height < 1) return null;

    if (left < 0) {
        width += left;
        left = 0;
    }
    if (top < 0) {
        height += top;
        top = 0;
    }

    if (left >= image_width || top >= image_height) return null;

    width = Math.min(width, image_width - left);
    height = Math.min(height, image_height - top);

    if (width < 1 || height < 1) return null;

    return { left, top, width, height };
}
