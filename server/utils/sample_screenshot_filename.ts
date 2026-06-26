/**
 * @fileoverview Bygger filnamn för automatisk granskningsdelsskärmdump.
 */
import { sanitize_media_filename } from '../../shared/media/sanitize_media_filename.js';

const FALLBACK_PAGE_TITLE = 'sida';

/**
 * Bygger filnamn: {sidtitel}_{suffix}.png
 */
export function build_sample_screenshot_filename(page_title: string, filename_suffix: string): string {
    const safe_title = sanitize_media_filename(page_title.trim() || FALLBACK_PAGE_TITLE) || FALLBACK_PAGE_TITLE;
    const safe_suffix = sanitize_media_filename(filename_suffix.trim()) || 'skarmavbild';
    const combined = `${safe_title}_${safe_suffix}.png`;
    return sanitize_media_filename(combined) || `${FALLBACK_PAGE_TITLE}_skarmavbild.png`;
}
