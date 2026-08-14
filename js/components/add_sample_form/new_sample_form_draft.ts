import { app_session_storage } from '../../utils/scoped_browser_storage.js';
/**
 * @fileoverview SessionStorage-utkast för formuläret "lägg till ny granskningsdel".
 * Sparas lokalt tills användaren sparar granskningsdelen eller rensar formuläret.
 */

export type NewSampleFormDraft = {
    pendingSampleId?: string;
    sampleCategory?: string | null;
    sampleType?: string | null;
    description?: string;
    url?: string;
    selectedContentTypes?: string[];
    attachedMediaFilenames?: string[];
    urlAutoScreenshotFilename?: string | null;
};

const KEY_PREFIX = 'gv_new_sample_form_draft';

export function get_new_sample_draft_storage_key(state: {
    auditId?: string | null;
    ruleFileContent?: { metadata?: { id?: string } } | null;
} | null | undefined): string {
    const audit_id = state?.auditId;
    if (audit_id) {
        return `${KEY_PREFIX}_audit_${String(audit_id)}`;
    }
    const rule_id = state?.ruleFileContent?.metadata?.id;
    return `${KEY_PREFIX}_rule_${String(rule_id || 'local')}`;
}

export function load_new_sample_form_draft(storage_key: string): NewSampleFormDraft | null {
    try {
        const raw = app_session_storage.getItem(storage_key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as NewSampleFormDraft | null;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            app_session_storage.removeItem(storage_key);
            return null;
        }
        return parsed;
    } catch {
        try {
            app_session_storage.removeItem(storage_key);
        } catch {
            // ignoreras medvetet
        }
        return null;
    }
}

export function save_new_sample_form_draft(storage_key: string, draft: NewSampleFormDraft): void {
    try {
        app_session_storage.setItem(storage_key, JSON.stringify(draft));
    } catch {
        // ignoreras medvetet (t.ex. privat läge)
    }
}

export function clear_new_sample_form_draft(storage_key: string): void {
    try {
        app_session_storage.removeItem(storage_key);
    } catch {
        // ignoreras medvetet
    }
}
