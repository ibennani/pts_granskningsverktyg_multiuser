import { create_rule_table_columns } from '../../utils/rule_table_columns.js';
import { get_base_url, get_auth_headers } from '../../api/client.js';
import { build_rulefile_backup_download_filename } from '../../logic/backup_download_filename';

export type RulefileBackupOverviewRow = {
    ruleSetId: string;
    name: string;
    filename: string;
    latestSnapshotAt: string | null;
    backupFileCount: number;
    /** `metadata.version` vid senaste backup-tillfället (t.ex. 2025.2.r4). */
    latestBackedMetadataVersion?: string | null;
    has_published_in_any_snapshot?: boolean;
    has_working_in_any_snapshot?: boolean;
    /** Sätts av servern när DB-slagning lyckats: regeln finns inte längre i rule_sets. */
    ruleSetDeletedFromDb?: boolean;
    /** Aktuellt från databasen (för visningsetikett). */
    is_published?: boolean;
    production_base_id?: string | null;
    version_display?: string | null;
};

export type RulefileBackupHistoryRow = {
    snapshotDir: string;
    createdAt: string | null;
    category: 'published' | 'drafts' | 'working';
    filename: string;
    fileSizeBytes: number | null;
    /** `metadata.version` från JSON-filen (t.ex. 2025.2.r16). */
    metadataVersion?: string | null;
    /** `metadata.language` från JSON-filen (t.ex. sv-SE, en-GB). */
    metadataLanguage?: string | null;
};

export function build_rulefile_table_columns({
    Helpers,
    Translation,
    t,
    on_show_history
}: {
    Helpers: any;
    Translation: any;
    t: (key: string, replacements?: Record<string, any>) => string;
    on_show_history: (rule_set_id: string) => void;
}) {
    const cols = create_rule_table_columns(
        {
            t,
            Helpers,
            Translation,
            production_rules_with_base_ids: [],
            is_draft_table: false
        },
        {
            onEditRule: undefined,
            onDownloadRule: undefined,
            onDeleteRule: undefined,
            onPublishRule: undefined,
            onCopyRule: undefined,
            onPublishProductionRule: undefined
        }
    );

    const version_col = {
        headerLabel: t('backup_rulefile_col_latest_version'),
        getSortValue: (row: RulefileBackupOverviewRow) => (row.latestBackedMetadataVersion ?? '').toString(),
        getContent: (row: RulefileBackupOverviewRow) => {
            const v = (row.latestBackedMetadataVersion ?? '').toString().trim();
            return v || '—';
        }
    };

    // Byt ut action-kolumnen mot en enda knapp: "Visa säkerhetskopior".
    // Namnkolumnen från create_rule_table_columns använder `row.id`; backup-rader har `ruleSetId`.
    const out: any[] = [];
    cols.forEach((c: any, col_index: number) => {
        if (c?.isAction) {
            out.push({
                headerLabel: t('backup_overview_col_actions'),
                isAction: true,
                getContent: (row: any) => {
                    const btn = Helpers.create_element('button', {
                        class_name: ['button', 'button-default', 'button-small'],
                        text_content: t('backup_overview_show_backups_button'),
                        attributes: { type: 'button' }
                    });
                    btn.addEventListener('click', () => on_show_history(String(row?.ruleSetId || row?.id || '')));
                    return btn;
                }
            });
            return;
        }
        if (col_index === 0 && typeof c?.getContent === 'function') {
            out.push({
                ...c,
                getSortValue: (row: RulefileBackupOverviewRow) =>
                    (row.name || `Regelfil ${row.ruleSetId}`).toString().trim(),
                getContent: (row: RulefileBackupOverviewRow) => {
                    const id = row?.ruleSetId;
                    const rule_name = (row.name || `Regelfil ${id}`).trim();
                    const is_deleted = row.ruleSetDeletedFromDb === true;
                    const is_production_row = !!row.production_base_id;
                    const is_published = row.is_published === true;

                    let link_text = rule_name;
                    if (is_deleted) {
                        link_text = `${rule_name} (${t('backup_status_deleted')})`;
                        return Helpers.create_element('span', {
                            class_name: 'backup-rulefile-overview-name backup-rulefile-overview-name--deleted',
                            text_content: link_text
                        });
                    }
                    if (is_published && !is_production_row) {
                        link_text = `${rule_name} (${t('rulefile_status_published_label')})`;
                    } else {
                        link_text = `${rule_name} (${t('rulefile_status_production_label')})`;
                    }
                    const link = Helpers.create_element('a', {
                        class_name: 'generic-table-audit-link',
                        text_content: link_text,
                        attributes: {
                            href: '#edit_rulefile_main',
                            'aria-label': t('audit_edit_rule_aria', { name: link_text }),
                            'data-rule-id': String(id ?? '')
                        }
                    });
                    return link;
                }
            });
            out.push(version_col);
            return;
        }
        out.push(c);
    });
    return out;
}

export function build_rulefile_history_columns({
    Helpers,
    Translation,
    t,
    on_download
}: {
    Helpers: any;
    Translation: any;
    t: (key: string, replacements?: Record<string, any>) => string;
    on_download: (row: RulefileBackupHistoryRow) => void;
}) {
    const lang = Translation?.get_current_language_code?.() || 'sv-SE';
    const format_datetime = (iso: string | null) => {
        if (!iso || !Helpers?.format_iso_to_local_datetime) return '';
        return Helpers.format_iso_to_local_datetime(iso, lang);
    };
    const format_file_size = (bytes: number | null) => {
        if (bytes === null || bytes === undefined || typeof bytes !== 'number') return '—';
        if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(1).replace('.', ',') + ' KB';
        return bytes + ' B';
    };
    const type_label = (cat: RulefileBackupHistoryRow['category']) => {
        if (cat === 'published') return t('backup_rulefile_type_published');
        if (cat === 'drafts') return t('backup_rulefile_type_draft');
        return t('backup_rulefile_type_working');
    };

    return [
        {
            headerLabel: t('backup_detail_col_datetime'),
            getSortValue: (row: RulefileBackupHistoryRow) => row.createdAt ? Date.parse(row.createdAt) || 0 : 0,
            getContent: (row: RulefileBackupHistoryRow) => format_datetime(row.createdAt) || row.createdAt || '—'
        },
        {
            headerLabel: t('backup_detail_col_type'),
            getSortValue: (row: RulefileBackupHistoryRow) => row.category,
            getContent: (row: RulefileBackupHistoryRow) => type_label(row.category)
        },
        {
            headerLabel: t('backup_detail_col_file_size'),
            getSortValue: (row: RulefileBackupHistoryRow) => (row.fileSizeBytes !== null && row.fileSizeBytes !== undefined) ? Number(row.fileSizeBytes) : 0,
            getContent: (row: RulefileBackupHistoryRow) => format_file_size(row.fileSizeBytes)
        },
        {
            headerLabel: t('backup_rulefile_col_version'),
            getSortValue: (row: RulefileBackupHistoryRow) => (row.metadataVersion ?? '').toString(),
            getContent: (row: RulefileBackupHistoryRow) => {
                const v = (row.metadataVersion ?? '').toString().trim();
                return v || '—';
            }
        },
        {
            headerLabel: t('backup_detail_col_actions'),
            isAction: true,
            getContent: (row: RulefileBackupHistoryRow) => {
                const btn = Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small'],
                    text_content: t('backup_detail_download_button'),
                    attributes: { type: 'button' }
                });
                btn.addEventListener('click', () => on_download(row));
                return btn;
            }
        }
    ];
}

export async function download_rulefile_snapshot_json(row: RulefileBackupHistoryRow) {
    const base = get_base_url();
    const url = `${base}/backup/system-files/${encodeURIComponent(row.snapshotDir)}/${encodeURIComponent(row.category)}/${encodeURIComponent(row.filename)}`;
    const res = await fetch(url, { cache: 'no-store', headers: get_auth_headers() });
    if (!res.ok) {
        const msg = (await res.json().catch(() => ({} as any))).error || res.statusText;
        const err: any = new Error(msg || 'Kunde inte ladda ner filen');
        err.status = res.status;
        throw err;
    }
    const blob = await res.blob();
    const object_url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = object_url;
    a.download = build_rulefile_backup_download_filename(row);
    a.setAttribute('aria-hidden', 'true');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(object_url);
}

