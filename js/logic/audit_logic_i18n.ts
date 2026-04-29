/**
 * @fileoverview Översättningsåtkomst för audit_logic-moduler utan cirkulära importer.
 */

import { get_translation_t } from '../utils/translation_access.js';

export function get_audit_translation_t(): (key: string, opts?: object) => string {
    const raw = get_translation_t() as (key: string, opts?: object) => string;
    return (key, opts) => raw(key, opts ?? {});
}
