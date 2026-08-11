/**
 * @fileoverview Om skärmavbild ska bifogas till granskningsdelen vid sidrapport.
 */

export function sample_has_attached_images(attached_media_filenames: unknown): boolean {
    if (!Array.isArray(attached_media_filenames)) {
        return false;
    }
    return attached_media_filenames.some((filename) => String(filename).trim().length > 0);
}

export function should_attach_screenshot_when_creating_sidrapport(sample: {
    attachedMediaFilenames?: unknown;
}): boolean {
    return !sample_has_attached_images(sample.attachedMediaFilenames);
}
