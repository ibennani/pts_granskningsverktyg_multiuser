/**
 * @fileoverview Tester för statistikfilter-dropdowns (placeholder vs enstaka alternativ).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { StatisticsViewComponent } from '../../js/components/StatisticsViewComponent.js';

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

describe('StatisticsViewComponent filter selects', () => {
    let component: StatisticsViewComponent;
    const t = (key: string) => (key === 'statistics_filter_select_prompt' ? 'Välj' : key);

    beforeEach(() => {
        component = new StatisticsViewComponent();
        component.Translation = { t };
        component._monitoring_heading = (raw: string) => raw;
        component._audit_type_heading = (raw: string) => raw;
        component.year_select_ref = document.createElement('select');
        component.year_select_ref.value = '2024';
        component.router = () => {};
    });

    it('visar inte Välj när regelfilstyp-dropdown har ett alternativ', () => {
        const Helpers = make_helpers();
        component._wire_statistics_monitoring_select(Helpers, t, [2024], ['Webb'], 'Webb');

        const options = Array.from(component.monitoring_type_select_ref!.options).map((o) => ({
            value: o.value,
            text: o.textContent
        }));

        expect(options).toEqual([{ value: 'Webb', text: 'Webb' }]);
        expect(component.monitoring_type_select_ref!.value).toBe('Webb');
    });

    it('visar Välj först när regelfilstyp-dropdown har flera alternativ', () => {
        const Helpers = make_helpers();
        component._wire_statistics_monitoring_select(Helpers, t, [2024], ['Webb', 'App'], '');

        const options = Array.from(component.monitoring_type_select_ref!.options).map((o) => ({
            value: o.value,
            text: o.textContent
        }));

        expect(options[0]).toEqual({ value: '', text: 'Välj' });
        expect(options.slice(1)).toEqual([
            { value: 'Webb', text: 'Webb' },
            { value: 'App', text: 'App' }
        ]);
        expect(component.monitoring_type_select_ref!.value).toBe('');
    });

    it('visar inte Välj när granskningstyp-dropdown har ett alternativ', () => {
        const Helpers = make_helpers();
        component._wire_statistics_audit_type_select(
            Helpers,
            t,
            [2024],
            'Webb',
            ['Fullständig'],
            'Fullständig',
            true
        );

        const options = Array.from(component.audit_type_select_ref!.options).map((o) => ({
            value: o.value,
            text: o.textContent
        }));

        expect(options).toEqual([{ value: 'Fullständig', text: 'Fullständig' }]);
        expect(component.audit_type_select_ref!.value).toBe('Fullständig');
    });

    it('visar Välj först när granskningstyp-dropdown har flera alternativ', () => {
        const Helpers = make_helpers();
        component._wire_statistics_audit_type_select(
            Helpers,
            t,
            [2024],
            'Webb',
            ['Fullständig', 'Förenklad'],
            '',
            true
        );

        const options = Array.from(component.audit_type_select_ref!.options).map((o) => ({
            value: o.value,
            text: o.textContent
        }));

        expect(options[0]).toEqual({ value: '', text: 'Välj' });
        expect(options.slice(1)).toEqual([
            { value: 'Fullständig', text: 'Fullständig' },
            { value: 'Förenklad', text: 'Förenklad' }
        ]);
    });
});
