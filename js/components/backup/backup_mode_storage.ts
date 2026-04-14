export type BackupMode = 'audits' | 'rulefiles';

export function load_backup_mode_from_storage(): BackupMode {
    try {
        const v = sessionStorage.getItem('gv_backup_mode');
        if (v === 'rulefiles' || v === 'audits') return v;
    } catch (_) {}
    return 'audits';
}

export function save_backup_mode_to_storage(mode: BackupMode) {
    try {
        sessionStorage.setItem('gv_backup_mode', mode);
    } catch (_) {}
}

