export type BackupMode = 'audits' | 'rulefiles';

export function load_backup_mode_from_storage(): BackupMode {
    try {
        const v = sessionStorage.getItem('gv_backup_mode');
        if (v === 'rulefiles' || v === 'audits') return v;
    } catch {
        // sessionStorage otillgängligt (t.ex. privat läge) — standardläge audits
    }
    return 'audits';
}

export function save_backup_mode_to_storage(mode: BackupMode) {
    try {
        sessionStorage.setItem('gv_backup_mode', mode);
    } catch {
        // sessionStorage otillgängligt (t.ex. privat läge) — standardläge audits
    }
}

