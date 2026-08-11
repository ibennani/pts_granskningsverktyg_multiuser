/**
 * @fileoverview Knapp och laddningsstatus för «Ta ny sidrapport» i sidrapportslistan.
 */
import { is_sidrapport_retake_in_progress } from '../logic/audit_sidrapport_retake.js';
import { get_icon_svg as default_get_icon_svg } from '../ui/icons.js';

type RetakeRow = {
    sampleId: string;
    pendingAttempt?: { status: string } | null;
};

type RetakeButtonHelpers = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
};

export function is_sidrapport_retake_busy(
    row: RetakeRow,
    in_flight_sample_ids?: ReadonlySet<string>
): boolean {
    if (in_flight_sample_ids?.has(String(row.sampleId))) {
        return true;
    }
    return is_sidrapport_retake_in_progress(row);
}

function resolve_loader_svg(helpers: RetakeButtonHelpers): string {
    const get_icon = helpers.get_icon_svg ?? default_get_icon_svg;
    return get_icon('loader', ['currentColor'], 16);
}

function render_sidrapport_retake_creating_status(
    helpers: RetakeButtonHelpers,
    t: (key: string, opts?: Record<string, unknown>) => string
): HTMLElement {
    const status = helpers.create_element('span', {
        class_name: [
            'audit-sidrapport-retake-status',
            'button',
            'button-success',
            'button-small',
            'generic-table-action-cell',
        ],
        attributes: {
            role: 'status',
            'aria-live': 'polite',
            'aria-atomic': 'true',
        },
    });

    status.appendChild(
        helpers.create_element('span', {
            class_name: 'audit-sidrapport-retake-status__label',
            text_content: t('audit_sidrapport_retake_creating'),
        })
    );

    const spinner = helpers.create_element('span', {
        class_name: 'audit-sidrapport-retake-status__spinner',
        attributes: { 'aria-hidden': 'true' },
    });
    spinner.innerHTML = resolve_loader_svg(helpers);
    status.appendChild(spinner);

    return status;
}

function render_sidrapport_retake_button(
    helpers: RetakeButtonHelpers,
    t: (key: string, opts?: Record<string, unknown>) => string,
    sample_label: string,
    on_retake: () => void
): HTMLButtonElement {
    const button = helpers.create_element('button', {
        class_name: ['button', 'button-success', 'button-small', 'generic-table-action-cell'],
        attributes: {
            type: 'button',
            'aria-label': t('audit_sidrapport_retake_for_sample', { sample: sample_label }),
        },
        text_content: t('audit_sidrapport_retake_button'),
    }) as HTMLButtonElement;

    button.addEventListener('click', () => {
        on_retake();
    });

    return button;
}

export function render_sidrapport_retake_control(
    helpers: RetakeButtonHelpers,
    t: (key: string, opts?: Record<string, unknown>) => string,
    sample_label: string,
    is_busy: boolean,
    on_retake: () => void
): HTMLElement {
    if (is_busy) {
        return render_sidrapport_retake_creating_status(helpers, t);
    }
    return render_sidrapport_retake_button(helpers, t, sample_label, on_retake);
}
