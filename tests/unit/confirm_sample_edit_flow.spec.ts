import { jest } from '@jest/globals';
import { ConfirmSampleEditViewComponent } from '../../js/components/ConfirmSampleEditViewComponent.ts';

describe('ConfirmSampleEditViewComponent flöde', () => {
    test('Släng återställer stickprov och rensar staged changes', () => {
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

