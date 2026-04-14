import { get_base_url, get_auth_headers } from '../../api/client.js';

export function build_audit_overview_columns({
    Helpers,
    Translation,
    t,
    get_status_label,
    on_show_backups,
    on_go_to_audit
}: {
    Helpers: any;
    Translation: any;
    t: (key: string, replacements?: Record<string, any>) => string;
    get_status_label: (status: string) => string;
    on_show_backups: (audit_id: string) => void;
    on_go_to_audit: (audit_id: string) => void;
}) {
    const lang = Translation?.get_current_language_code?.() || 'sv-SE';
    const format_datetime = (iso: string | null) => {
        if (!iso || !Helpers?.format_iso_to_local_datetime) return '';
        return Helpers.format_iso_to_local_datetime(iso, lang);
    };

    return [
        {
            headerLabel: t('backup_overview_col_case_number'),
            getSortValue: (row: any) => (row.caseNumber ?? '').toString().trim(),
            getContent: (row: any) => (row.caseNumber ?? '').toString().trim() || '—'
        },
        {
            headerLabel: t('backup_overview_col_actor'),
            getSortValue: (row: any) => (row.actorName ?? '').toString().trim(),
            getContent: (row: any) => {
                const raw_actor_name = (row.actorName ?? '').toString().trim();
                const fallback_name = t('unknown_actor') || '—';
                const actor_name = raw_actor_name || fallback_name;
                const is_deleted = row?.status === 'deleted';

                if (is_deleted) {
                    return Helpers.create_element('span', {
                        text_content: t('backup_actor_display_deleted', { name: actor_name })
                    });
                }

                const a = Helpers.create_element('a', {
                    text_content: actor_name,
                    attributes: { href: `#audit_overview?auditId=${row.auditId ?? ''}` }
                });
                a.addEventListener('click', (e: Event) => {
                    e.preventDefault();
                    if (row.auditId !== null && row.auditId !== undefined) {
                        on_go_to_audit(String(row.auditId));
                    }
                });
                return a;
            }
        },
        {
            headerLabel: t('backup_overview_col_status'),
            getSortValue: (row: any) => (row.status ?? '').toString(),
            getContent: (row: any) => {
                const label = get_status_label(String(row.status || '')) || '—';
                if (row.status === 'deleted') {
                    return Helpers.create_element('span', {
                        class_name: 'backup-status-deleted',
                        text_content: label
                    });
                }
                return label;
            }
        },
        {
            headerLabel: t('backup_overview_col_latest_backup'),
            getSortValue: (row: any) => row.latestBackupAt ? Date.parse(row.latestBackupAt) || 0 : 0,
            getContent: (row: any) => format_datetime(row.latestBackupAt) || '—'
        },
        {
            headerLabel: t('backup_overview_col_backup_count'),
            getSortValue: (row: any) => (row.backupCount !== null && row.backupCount !== undefined) ? Number(row.backupCount) : 0,
            getContent: (row: any) => (row.backupCount !== null && row.backupCount !== undefined ? String(row.backupCount) : '0')
        },
        {
            headerLabel: t('backup_overview_col_actions'),
            isAction: true,
            getContent: (row: any) => {
                const btn = Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small'],
                    text_content: t('backup_overview_show_backups_button'),
                    attributes: { type: 'button' }
                });
                btn.addEventListener('click', () => on_show_backups(String(row.auditId || '')));
                return btn;
            }
        }
    ];
}

export function build_audit_detail_columns({
    Helpers,
    Translation,
    t,
    get_status_label,
    overview_row,
    on_restore,
    on_download
}: {
    Helpers: any;
    Translation: any;
    t: (key: string, replacements?: Record<string, any>) => string;
    get_status_label: (status: string) => string;
    overview_row: any;
    on_restore: (row: any) => void;
    on_download: (filename: string) => void;
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
    const get_summary_text = (row: any) => {
        const s = row.summarySamples;
        const r = row.summaryRequirements;
        if (s !== null && s !== undefined && r !== null && r !== undefined) return t('backup_detail_summary', { samples: s, requirements: r });
        if (s !== null && s !== undefined) return t('backup_detail_summary_samples_only', { samples: s });
        if (r !== null && r !== undefined) return t('backup_detail_summary_requirements_only', { requirements: r });
        return '—';
    };

    return [
        {
            headerLabel: t('backup_detail_col_datetime'),
            getSortValue: (row: any) => row.createdAt ? Date.parse(row.createdAt) || 0 : 0,
            getContent: (row: any) => format_datetime(row.createdAt) || row.createdAt || '—'
        },
        {
            headerLabel: t('backup_detail_col_file_size'),
            getSortValue: (row: any) => (row.fileSizeBytes !== null && row.fileSizeBytes !== undefined) ? Number(row.fileSizeBytes) : 0,
            getContent: (row: any) => format_file_size(row.fileSizeBytes)
        },
        {
            headerLabel: t('backup_overview_col_status'),
            getSortValue: () => (overview_row?.status ?? '').toString(),
            getContent: () => get_status_label(String(overview_row?.status || '')) || '—'
        },
        {
            headerLabel: t('backup_detail_col_progress'),
            getSortValue: (row: any) => (row.progressPercent !== null && row.progressPercent !== undefined) ? Number(row.progressPercent) : -1,
            getContent: (row: any) => {
                const audited = row.progressAudited;
                const total = row.progressTotal;
                if (audited === null || audited === undefined || total === null || total === undefined || total === 0) return '—';
                const pct = (100 * audited) / total;
                const pctStr = pct.toFixed(1).replace('.', ',');
                return `${audited} / ${total} (${pctStr} %)`;
            }
        },
        {
            headerLabel: t('backup_detail_col_actions'),
            isAction: true,
            getContent: (row: any) => {
                const wrapper = Helpers.create_element('div', { class_name: 'backup-detail-actions-cell' });
                const restore_btn = Helpers.create_element('button', {
                    class_name: ['button', 'button-success', 'button-small', 'generic-table-action-cell', 'backup-btn-with-icon'],
                    attributes: { type: 'button' }
                });
                restore_btn.appendChild(Helpers.create_element('span', { class_name: 'backup-btn-label', text_content: t('backup_restore_button') }));
                if (Helpers.get_icon_svg) {
                    const icon_span = Helpers.create_element('span', {
                        html_content: Helpers.get_icon_svg('update', ['currentColor'], 18),
                        attributes: { 'aria-hidden': 'true' }
                    });
                    icon_span.classList.add('backup-btn-icon');
                    restore_btn.appendChild(icon_span);
                }
                restore_btn.addEventListener('click', () => on_restore(row));

                const download_a = Helpers.create_element('a', {
                    class_name: ['button', 'button-default', 'button-small', 'generic-table-action-cell', 'backup-btn-with-icon'],
                    attributes: { href: '#' }
                });
                download_a.appendChild(Helpers.create_element('span', { class_name: 'backup-btn-label', text_content: t('backup_detail_download_button') }));
                if (Helpers.get_icon_svg) {
                    const dl_icon = Helpers.create_element('span', {
                        html_content: Helpers.get_icon_svg('download', ['currentColor'], 18),
                        attributes: { 'aria-hidden': 'true' }
                    });
                    dl_icon.classList.add('backup-btn-icon');
                    download_a.appendChild(dl_icon);
                }
                download_a.addEventListener('click', (e: Event) => {
                    e.preventDefault();
                    on_download(String(row?.filename || ''));
                });
                wrapper.appendChild(restore_btn);
                wrapper.appendChild(download_a);
                return wrapper;
            }
        }
    ];
}

export async function download_audit_backup_json({ audit_id, filename }: { audit_id: string; filename: string }) {
    const base = get_base_url();
    const url = `${base}/backup/files/${encodeURIComponent(audit_id)}/${encodeURIComponent(filename)}`;
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
    a.download = filename;
    a.setAttribute('aria-hidden', 'true');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(object_url);
}

