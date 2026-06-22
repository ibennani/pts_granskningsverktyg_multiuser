/**
 * @fileoverview Grupperad granskningslista med expanderbara grupprader.
 */

import {
    render_audit_grouped_list,
    type AuditGroupedListRenderOpts
} from './audit_grouped_list_render.js';
import { type AuditRowForGrouping, type AuditListGroupMode } from '../logic/audit_list_case_grouping.js';
import './generic_table_component.css';

type SortState = { columnIndex: number; direction: 'asc' | 'desc' };

type RenderOpts = Omit<AuditGroupedListRenderOpts, 'root' | 'pending_sort_focus_index' | 'on_pending_sort_focus_done'> & {
    root?: HTMLElement;
    audits: AuditRowForGrouping[];
    groupMode?: AuditListGroupMode;
    sortState?: SortState;
};

export class AuditGroupedListComponent {
    root: HTMLElement | null = null;
    deps: Record<string, unknown> | null = null;
    Helpers: { create_element: (...args: unknown[]) => HTMLElement } | null = null;
    Translation: { t: (key: string, replacements?: Record<string, unknown>) => string } | null = null;
    _expanded_group_keys = new Set<string>();
    _last_group_mode: AuditListGroupMode | null = null;
    _pending_sort_focus_index: number | undefined;

    async init({ deps }: { deps: Record<string, unknown> }): Promise<void> {
        this.deps = deps;
        this.Helpers = deps.Helpers as typeof this.Helpers;
        this.Translation = deps.Translation as typeof this.Translation;
    }

    render(opts: RenderOpts): void {
        const root_el = opts.root ?? this.root;
        const Helpers = this.Helpers;
        const Translation = this.Translation;
        if (!root_el || !Helpers || !Translation) return;

        const group_mode: AuditListGroupMode = opts.groupMode === 'auditor' ? 'auditor' : 'case';
        if (this._last_group_mode !== group_mode) {
            this._expanded_group_keys.clear();
            this._last_group_mode = group_mode;
        }

        const wrapped_on_sort = opts.onSort
            ? (columnIndex: number, direction: 'asc' | 'desc') => {
                this._pending_sort_focus_index = columnIndex;
                opts.onSort?.(columnIndex, direction);
            }
            : undefined;

        render_audit_grouped_list(
            {
                Helpers,
                Translation,
                expanded_group_keys: this._expanded_group_keys
            },
            {
                ...opts,
                root: root_el,
                groupMode: group_mode,
                onSort: wrapped_on_sort,
                pending_sort_focus_index: this._pending_sort_focus_index,
                on_pending_sort_focus_done: () => {
                    this._pending_sort_focus_index = undefined;
                }
            }
        );
    }

    destroy(): void {
        this._expanded_group_keys.clear();
        this._last_group_mode = null;
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        this.Helpers = null;
        this.Translation = null;
    }
}
