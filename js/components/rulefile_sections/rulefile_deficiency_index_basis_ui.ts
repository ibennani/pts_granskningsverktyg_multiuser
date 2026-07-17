/**
 * @fileoverview Tabellvy med inline-redigering av kravvikt underlag för bristindex.
 */
import { build_requirement_rows } from './rulefile_requirement_mapping_ui.js';
import {
    append_classifications_table_filter_to_layout,
    append_classifications_table_scroll_area,
    attach_classifications_table_row_filter,
    create_classifications_table,
    create_classifications_table_layout,
    type ClassificationsTableColumn,
} from './rulefile_classifications_table_ui.js';
import {
    apply_requirement_impact_change,
    calculate_requirement_weight,
    format_requirement_weight,
    read_requirement_impact,
    type RequirementImpact,
} from '../../logic/requirement_impact_weight.js';
import { create_rulefile_classifications_back_row } from './rulefile_classifications_nav.js';

export type DeficiencyIndexBasisCtx = {
    Helpers: { create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    router: (view: string, params?: Record<string, string>) => void;
};

type ImpactChangeHandler = (requirement_key: string, impact: RequirementImpact) => void;

function build_number_input(
    Helpers: DeficiencyIndexBasisCtx['Helpers'],
    options: {
        id: string;
        value: number;
        labelled_by: string;
    }
): HTMLInputElement {
    const input = Helpers.create_element('input', {
        class_name: 'form-control deficiency-index-basis-number-input',
        attributes: {
            id: options.id,
            type: 'number',
            min: '0',
            step: '1',
            'aria-labelledby': options.labelled_by,
        },
    }) as HTMLInputElement;
    input.value = String(options.value);
    return input;
}

function build_critical_checkbox(
    Helpers: DeficiencyIndexBasisCtx['Helpers'],
    options: {
        id: string;
        checked: boolean;
        label_text: string;
    }
): HTMLElement {
    const wrapper = Helpers.create_element('div', {
        class_name: 'deficiency-index-basis-critical-cell',
    });
    const input = Helpers.create_element('input', {
        class_name: 'form-check-input',
        attributes: {
            id: options.id,
            type: 'checkbox',
        },
    }) as HTMLInputElement;
    if (options.checked) {
        input.checked = true;
    }
    wrapper.appendChild(input);
    wrapper.appendChild(
        Helpers.create_element('label', {
            class_name: 'visually-hidden',
            attributes: { for: options.id },
            text_content: options.label_text,
        })
    );
    return wrapper;
}

function read_impact_from_row(row_element: HTMLElement): RequirementImpact {
    const critical_input = row_element.querySelector<HTMLInputElement>(
        '.deficiency-index-basis-critical-cell input[type="checkbox"]'
    );
    const primary_input = row_element.querySelector<HTMLInputElement>(
        'input.deficiency-index-basis-primary-input'
    );
    const secondary_input = row_element.querySelector<HTMLInputElement>(
        'input.deficiency-index-basis-secondary-input'
    );
    const primary_score = parseInt(primary_input?.value ?? '0', 10);
    const secondary_score = parseInt(secondary_input?.value ?? '0', 10);
    return {
        isCritical: critical_input?.checked === true,
        primaryScore: Number.isFinite(primary_score) && primary_score >= 0 ? primary_score : 0,
        secondaryScore: Number.isFinite(secondary_score) && secondary_score >= 0 ? secondary_score : 0,
    };
}

function update_weight_cell(row_element: HTMLElement): void {
    const weight_cell = row_element.querySelector('.deficiency-index-basis-weight-value');
    if (!weight_cell) return;
    const impact = read_impact_from_row(row_element);
    const weight = calculate_requirement_weight({ metadata: { impact } });
    weight_cell.textContent = format_requirement_weight(weight);
}

function attach_row_change_handlers(
    row_element: HTMLElement,
    requirement_key: string,
    on_change: ImpactChangeHandler
): void {
    const notify = () => {
        update_weight_cell(row_element);
        on_change(requirement_key, read_impact_from_row(row_element));
    };
    row_element.querySelectorAll('input').forEach((input) => {
        input.addEventListener('input', notify);
    });
}

function build_table_row_cells(
    ctx: DeficiencyIndexBasisCtx,
    row: { key: string; display_label: string; requirement: Record<string, unknown> },
    header_ids: Record<string, string>,
    t: (key: string) => string
) {
    const { Helpers } = ctx;
    const impact = read_requirement_impact(row.requirement);
    const row_id = `deficiency-index-basis-row-${row.key}`;

    const critical_cell = Helpers.create_element('td', {
        class_name: 'deficiency-index-basis-critical-cell',
    });
    critical_cell.appendChild(
        build_critical_checkbox(Helpers, {
            id: `${row_id}-critical`,
            checked: impact.isCritical,
            label_text: `${t('rulefile_classifications_deficiency_index_basis_critical_column')} ${row.display_label}`,
        })
    );

    const primary_cell = Helpers.create_element('td', {
        class_name: 'deficiency-index-basis-primary-cell',
    });
    const primary_input = build_number_input(Helpers, {
        id: `${row_id}-primary`,
        value: impact.primaryScore,
        labelled_by: header_ids.primary,
    });
    primary_input.classList.add('deficiency-index-basis-primary-input');
    primary_cell.appendChild(primary_input);

    const secondary_cell = Helpers.create_element('td', {
        class_name: 'deficiency-index-basis-secondary-cell',
    });
    const secondary_input = build_number_input(Helpers, {
        id: `${row_id}-secondary`,
        value: impact.secondaryScore,
        labelled_by: header_ids.secondary,
    });
    secondary_input.classList.add('deficiency-index-basis-secondary-input');
    secondary_cell.appendChild(secondary_input);

    const weight_cell = Helpers.create_element('td', {
        class_name: 'deficiency-index-basis-weight-cell',
    });
    weight_cell.appendChild(
        Helpers.create_element('span', {
            class_name: 'deficiency-index-basis-weight-value',
            text_content: format_requirement_weight(calculate_requirement_weight(row.requirement)),
        })
    );

    return {
        key: row.key,
        row_header_class: 'deficiency-index-basis-row-header',
        row_header_text: row.display_label,
        cells: [critical_cell, primary_cell, secondary_cell, weight_cell],
    };
}

function append_hint_to_panel(
    ctx: DeficiencyIndexBasisCtx,
    panel: HTMLElement,
    t: (key: string, opts?: Record<string, unknown>) => string
): void {
    panel.appendChild(
        ctx.Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: t('rulefile_classifications_deficiency_index_basis_weight_hint'),
        })
    );
}

/**
 * Renderar tabell med inline-redigering. Returnerar apply_changes för persistens.
 */
export function render_deficiency_index_basis_ui(
    ctx: DeficiencyIndexBasisCtx,
    container: HTMLElement,
    rule_file_content: Record<string, unknown>,
    on_change?: () => void
): { apply_changes: () => Record<string, unknown> } {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    container.innerHTML = '';
    const part_panel = Helpers.create_element('div', {
        class_name: 'classifications-part-panel',
    });
    append_hint_to_panel(ctx, part_panel, t);

    const rows = build_requirement_rows(rule_file_content.requirements);
    const layout = create_classifications_table_layout(Helpers);
    layout.classList.add('deficiency-index-basis-layout');

    const filter_input = append_classifications_table_filter_to_layout(layout, ctx, rows.length, {
        label_key: 'rulefile_classifications_deficiency_index_basis_filter_label',
        id_prefix: 'deficiency-index-basis-filter',
    });

    let working_rulefile = rule_file_content;
    const pending_impacts = new Map<string, RequirementImpact>();
    const handle_impact_change: ImpactChangeHandler = (requirement_key, impact) => {
        pending_impacts.set(requirement_key, impact);
        on_change?.();
    };

    const header_ids = {
        critical: 'deficiency-index-basis-col-critical',
        primary: 'deficiency-index-basis-col-primary',
        secondary: 'deficiency-index-basis-col-secondary',
        total_score: 'deficiency-index-basis-col-total-score',
    };

    const columns: ClassificationsTableColumn[] = [
        {
            text: t('rulefile_classifications_mapping_requirement_column'),
            class_name: 'deficiency-index-basis-requirement-header',
        },
        {
            text: t('rulefile_classifications_deficiency_index_basis_critical_column'),
            class_name: 'deficiency-index-basis-critical-header',
        },
        { text: t('primary_score'), class_name: 'deficiency-index-basis-primary-header' },
        { text: t('secondary_score'), class_name: 'deficiency-index-basis-secondary-header' },
        {
            text: t('rulefile_classifications_deficiency_index_basis_weight_column'),
            class_name: 'deficiency-index-basis-weight-header',
        },
    ];

    const table_rows = rows.map((row) => build_table_row_cells(ctx, row, header_ids, t));
    const { table, row_elements } = create_classifications_table(ctx, {
        caption: t('rulefile_classifications_deficiency_index_basis_table_caption'),
        extra_table_classes: 'deficiency-index-basis-table',
        columns,
        rows: table_rows,
    });

    const header_cells = table.querySelectorAll('thead th');
    if (header_cells[1]) header_cells[1].id = header_ids.critical;
    if (header_cells[2]) header_cells[2].id = header_ids.primary;
    if (header_cells[3]) header_cells[3].id = header_ids.secondary;
    if (header_cells[4]) header_cells[4].id = header_ids.total_score;

    row_elements.forEach((row_element, index) => {
        attach_row_change_handlers(row_element, rows[index].key, handle_impact_change);
    });

    append_classifications_table_scroll_area(
        layout,
        Helpers,
        table,
        'deficiency-index-basis-scroll-wrapper'
    );
    part_panel.appendChild(layout);
    container.appendChild(part_panel);

    if (filter_input) {
        attach_classifications_table_row_filter(filter_input, row_elements);
    }

    container.appendChild(create_rulefile_classifications_back_row(ctx));

    return {
        apply_changes: () => {
            if (pending_impacts.size === 0) {
                return working_rulefile;
            }
            let next = working_rulefile;
            pending_impacts.forEach((impact, requirement_key) => {
                next = apply_requirement_impact_change(next, requirement_key, impact);
            });
            working_rulefile = next;
            pending_impacts.clear();
            return next;
        },
    };
}
