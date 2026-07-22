/**
 * Enhetstester för aria-label på återställ-knapp i backup-detaljtabell.
 */
import { describe, test, expect } from '@jest/globals';
import { build_audit_detail_columns } from '../../js/components/backup/backup_audit_tables.ts';

function create_helpers() {
    return {
        create_element: (tag: string, opts: Record<string, unknown> = {}) => {
            const el = document.createElement(tag);
            const class_name = opts.class_name;
            if (typeof class_name === 'string') {
                el.className = class_name;
            } else if (Array.isArray(class_name)) {
                el.className = class_name.join(' ');
            }
            if (typeof opts.text_content === 'string') {
                el.textContent = opts.text_content;
            }
            const attrs = opts.attributes as Record<string, string> | undefined;
            if (attrs) {
                for (const [key, value] of Object.entries(attrs)) {
                    el.setAttribute(key, value);
                }
            }
            return el;
        },
        get_icon_svg: () => '<svg></svg>',
    };
}

describe('backup_audit_tables aria-label', () => {
    test('Återställ-knapp har aria-label med ärendenummer och visningsnamn', () => {
        const Helpers = create_helpers();
        const columns = build_audit_detail_columns({
            Helpers,
            Translation: {},
            t: (key: string, opts?: Record<string, unknown>) => {
                if (key === 'backup_restore_button_aria') {
                    return `Återställ backup för ${opts?.caseNumber} ${opts?.displayName}`;
                }
                return key;
            },
            get_status_label: () => 'Pågående',
            overview_row: { caseNumber: '2024-1', actorName: 'Exempel AB' },
            on_restore: () => undefined,
            on_download: async () => undefined,
        });

        const actions_col = columns.find((col) => col.isAction);
        const cell = actions_col?.getContent?.({ filename: 'backup.json' }) as HTMLElement;
        const restore_btn = cell.querySelector('button') as HTMLButtonElement;
        expect(restore_btn.getAttribute('aria-label')).toBe('Återställ backup för 2024-1 Exempel AB');
    });
});
