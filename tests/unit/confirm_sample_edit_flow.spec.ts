import { jest } from '@jest/globals';
import { ConfirmSampleEditViewComponent } from '../../js/components/ConfirmSampleEditViewComponent.ts';

function create_helpers() {
    return {
        create_element: (tag: string, opts: Record<string, unknown> = {}) => {
            const el = document.createElement(tag);
            if (opts.class_name) {
                const classes = Array.isArray(opts.class_name) ? opts.class_name : [opts.class_name];
                el.className = classes.join(' ');
            }
            if (typeof opts.text_content === 'string') {
                el.textContent = opts.text_content;
            }
            if (typeof opts.html_content === 'string') {
                el.innerHTML = opts.html_content;
            }
            return el;
        },
        build_save_button_html_content: (label: string) => label
    };
}

describe('ConfirmSampleEditViewComponent flöde', () => {
    test('render visar ändrade fält som definition list med nuvarande och ändras till', () => {
        const root = document.createElement('div');
        const comp = new ConfirmSampleEditViewComponent();
        const pending = {
            sampleId: 's1',
            updatedSampleData: {},
            originalSampleData: {},
            analysis: {
                added_reqs: [],
                removed_reqs: [],
                data_will_be_lost: false,
                changed_fields: [{
                    key: 'description',
                    oldValue: 'Apohem – apotek | Apohem',
                    newValue: 'Apohem startsida'
                }],
                content_types_diff: { added: [], removed: [] }
            }
        };

        const labels: Record<string, string> = {
            description: 'Beskrivning (granskningsdelens namn)',
            sample_edit_confirm_changed_fields_header: 'Ändrade uppgifter om granskningsdelen',
            sample_edit_confirm_field_current_label: 'Nuvarande',
            sample_edit_confirm_field_new_label: 'Ändras till',
            sample_edit_confirm_action_button: 'Bekräfta och spara ändringar',
            sample_edit_discard_action_button: 'Släng ändringar och återgå'
        };

        comp.init({
            root,
            deps: {
                router: jest.fn(),
                getState: () => ({ pendingSampleChanges: pending, ruleFileContent: { requirements: {} } }),
                dispatch: jest.fn(),
                StoreActionTypes: {},
                Translation: { t: (k: string) => labels[k] || k },
                Helpers: create_helpers(),
                NotificationComponent: { show_global_message: jest.fn(), clear_global_message: jest.fn() }
            }
        } as any);

        comp.render();

        expect(root.querySelector('.sample-edit-field-changes')).not.toBeNull();
        expect(root.querySelector('.sample-edit-field-change__name')?.textContent)
            .toBe('Beskrivning (granskningsdelens namn)');
        const pair_labels = Array.from(root.querySelectorAll('.sample-edit-field-change__pair dt'))
            .map((el) => el.textContent);
        expect(pair_labels).toEqual(['Nuvarande', 'Ändras till']);
        const values = Array.from(root.querySelectorAll('.sample-edit-field-change__pair dd'))
            .map((el) => el.textContent);
        expect(values).toEqual(['Apohem – apotek | Apohem', 'Apohem startsida']);
    });

    test('Släng återställer granskningsdel och rensar staged changes', () => {
        const comp = new ConfirmSampleEditViewComponent();
        const dispatch = jest.fn();
        const router = jest.fn();
        const pending = {
            sampleId: 's1',
            updatedSampleData: { selectedContentTypes: ['a'] },
            originalSampleData: { selectedContentTypes: [] },
            analysis: { added_reqs: [], removed_reqs: [], data_will_be_lost: false, changed_fields: [], content_types_diff: { added: [], removed: [] } }
        };

        comp.init({
            root: document.createElement('div'),
            deps: {
                router,
                getState: () => ({ pendingSampleChanges: pending }),
                dispatch,
                StoreActionTypes: { UPDATE_SAMPLE: 'UPDATE_SAMPLE', CLEAR_STAGED_SAMPLE_CHANGES: 'CLEAR_STAGED_SAMPLE_CHANGES' },
                Translation: { t: (k: string) => k },
                Helpers: { create_element: () => document.createElement('div') },
                NotificationComponent: { show_global_message: jest.fn(), clear_global_message: jest.fn() }
            }
        } as any);

        comp.handle_discard_and_return();

        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'UPDATE_SAMPLE',
            payload: expect.objectContaining({
                sampleId: 's1',
                updatedSampleData: pending.originalSampleData
            })
        }));
        expect(dispatch).toHaveBeenCalledWith({ type: 'CLEAR_STAGED_SAMPLE_CHANGES' });
        expect(router).toHaveBeenCalledWith('sample_management');
    });
});

