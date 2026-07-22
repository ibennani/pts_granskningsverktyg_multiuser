/**
 * @fileoverview Tester för initial navigering till statistik utan URL-parametrar (menylänk).
 */

import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client_module_path = path.join(__dirname, '../../js/api/client.js');
const score_analysis_module_path = path.join(
    __dirname,
    '../../js/components/ScoreAnalysisComponent.js'
);

const get_audit_statistics_summary = jest.fn();

jest.unstable_mockModule(client_module_path, () => ({
    get_audit_statistics_summary
}));

jest.unstable_mockModule(score_analysis_module_path, () => ({
    ScoreAnalysisComponent: {
        destroy: jest.fn()
    }
}));

type StatisticsViewComponentClass = typeof import('../../js/components/StatisticsViewComponent.js').StatisticsViewComponent;

let StatisticsViewComponent: StatisticsViewComponentClass;

function make_helpers() {
    return {
        create_element: (tag: string, opts: Record<string, unknown> = {}) => {
            const el = document.createElement(tag);
            if (opts.class_name) {
                const classes = Array.isArray(opts.class_name)
                    ? opts.class_name
                    : [opts.class_name];
                el.className = classes.join(' ');
            }
            if (opts.id) el.id = String(opts.id);
            if (opts.text_content) el.textContent = String(opts.text_content);
            const attrs = opts.attributes as Record<string, string> | undefined;
            if (attrs) {
                Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
            }
            return el;
        }
    };
}

function audit_slice(completed_count = 3) {
    return {
        completed_count,
        median_duration_weeks: null,
        monitoring_type_top_failed: [],
        principle_median_deficiency: {},
        principle_labels: {},
        grouping_taxonomy_id: '',
        grouping_taxonomy_label: '',
        total_median_deficiency: null,
        median_sample_count: null,
        worst_sample_type: null,
        monitoring_sampletype_chart: []
    };
}

function monitoring_entry(audit_keys: string[]) {
    const per_audit_type: Record<string, ReturnType<typeof audit_slice>> = {};
    audit_keys.forEach((k) => {
        per_audit_type[k] = audit_slice();
    });
    return {
        audit_type_labels_ordered: audit_keys,
        per_audit_type
    };
}

function summary_payload(
    year: number,
    monitoring_keys: string[],
    audit_keys_by_monitoring: Record<string, string[]>
) {
    const per_monitoring_type: Record<string, ReturnType<typeof monitoring_entry>> = {};
    monitoring_keys.forEach((mk) => {
        per_monitoring_type[mk] = monitoring_entry(audit_keys_by_monitoring[mk] || []);
    });
    return {
        available_years: [year],
        per_year: {
            [String(year)]: {
                monitoring_type_labels_ordered: monitoring_keys,
                per_monitoring_type
            }
        }
    };
}

function option_snapshot(select: HTMLSelectElement | null) {
    return Array.from(select?.options || []).map((o) => ({
        value: o.value,
        text: o.textContent
    }));
}

beforeAll(async () => {
    ({ StatisticsViewComponent } = await import('../../js/components/StatisticsViewComponent.js'));
});

describe('StatisticsViewComponent initial menu navigation', () => {
    let component: InstanceType<StatisticsViewComponentClass>;
    let root: HTMLElement;

    const t = (key: string, vars?: Record<string, string>) => {
        if (key === 'statistics_filter_select_prompt') return 'Välj';
        if (key === 'statistics_summary_under_year') {
            return `Under ${vars?.year || ''}`;
        }
        if (key === 'statistics_summary_completed_plural') {
            return `${vars?.count || '0'} avslutade granskningar`;
        }
        return key;
    };

    beforeEach(async () => {
        get_audit_statistics_summary.mockReset();
        root = document.createElement('div');
        document.body.appendChild(root);
        component = new StatisticsViewComponent();
        await component.init({
            root,
            deps: {
                Translation: { t },
                Helpers: make_helpers(),
                router: jest.fn(),
                params: {}
            }
        });
    });

    afterEach(() => {
        component.destroy();
        root.remove();
    });

    it('visar statistik direkt utan Välj när regelfil- och granskningstyp har ett alternativ vardera', async () => {
        get_audit_statistics_summary.mockResolvedValue(
            summary_payload(2024, ['Webb'], { Webb: ['Fullständig'] })
        );

        await component.render();

        const monitoring_options = option_snapshot(component.monitoring_type_select_ref);
        const audit_options = option_snapshot(component.audit_type_select_ref);

        expect(monitoring_options).toEqual([{ value: 'Webb', text: 'Webb' }]);
        expect(audit_options).toEqual([{ value: 'Fullständig', text: 'Fullständig' }]);
        expect(component.monitoring_type_select_ref?.value).toBe('Webb');
        expect(component.audit_type_select_ref?.value).toBe('Fullständig');
        expect(root.querySelector('#statistics-summary-heading')).not.toBeNull();
        expect(root.querySelector('.statistics-filters-await')).toBeNull();
    });

    it('visar Välj och döljer statistik när flera regelfilstyper finns utan URL-parametrar', async () => {
        get_audit_statistics_summary.mockResolvedValue(
            summary_payload(2024, ['Webb', 'App'], {
                Webb: ['Fullständig'],
                App: ['Förenklad']
            })
        );

        await component.render();

        const monitoring_options = option_snapshot(component.monitoring_type_select_ref);

        expect(monitoring_options[0]).toEqual({ value: '', text: 'Välj' });
        expect(component.monitoring_type_select_ref?.value).toBe('');
        expect(root.querySelector('#statistics-summary-heading')).toBeNull();
        expect(root.querySelector('.statistics-filters-await')).not.toBeNull();
    });

    it('auto-väljer regelfilstyp men visar Välj för granskningstyp när bara granskningstyp har flera val', async () => {
        get_audit_statistics_summary.mockResolvedValue(
            summary_payload(2024, ['Webb'], { Webb: ['Fullständig', 'Förenklad'] })
        );

        await component.render();

        const monitoring_options = option_snapshot(component.monitoring_type_select_ref);
        const audit_options = option_snapshot(component.audit_type_select_ref);

        expect(monitoring_options).toEqual([{ value: 'Webb', text: 'Webb' }]);
        expect(audit_options[0]).toEqual({ value: '', text: 'Välj' });
        expect(component.monitoring_type_select_ref?.value).toBe('Webb');
        expect(component.audit_type_select_ref?.value).toBe('');
        expect(root.querySelector('#statistics-summary-heading')).toBeNull();
        expect(root.querySelector('.statistics-filters-await')).not.toBeNull();
    });

    it('auto-väljer enda året utan Välj-alternativ i årsdropdown', async () => {
        get_audit_statistics_summary.mockResolvedValue(
            summary_payload(2024, ['Webb'], { Webb: ['Fullständig'] })
        );

        await component.render();

        const year_options = option_snapshot(component.year_select_ref);

        expect(year_options).toEqual([{ value: '2024', text: '2024' }]);
        expect(component.year_select_ref?.value).toBe('2024');
    });
});
