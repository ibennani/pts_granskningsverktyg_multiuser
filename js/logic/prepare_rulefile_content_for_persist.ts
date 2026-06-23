/**
 * @file Förbereder regelfilsinnehåll före persist/export (version och dateModified).
 */

import { touch_rulefile_metadata } from '../../shared/rulefile/rulefile_metadata_touch.js';

export type PrepareRulefileContentOptions = {
    bump_version?: boolean;
    reference_date?: Date;
};

/**
 * @param {unknown} content
 * @param {PrepareRulefileContentOptions} [options]
 */
export function prepare_rulefile_content_for_persist(
    content: unknown,
    options: PrepareRulefileContentOptions = {}
): Record<string, unknown> | null {
    return touch_rulefile_metadata(content, {
        bump_version: options.bump_version === true,
        reference_date: options.reference_date
    });
}

export { build_rulefile_download_filename, to_filename_version_suffix } from '../../shared/rulefile/rulefile_filename.js';
