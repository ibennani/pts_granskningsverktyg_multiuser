/**
 * @fileoverview Verifierar att ChecklistHandler-delegater syns på instanser (inte skuggas av TS-fält).
 */

import { ChecklistHandler, ChecklistHandlerClass, createChecklistHandler } from '../../js/components/requirement_audit/ChecklistHandler.js';

describe('ChecklistHandler delegater på instans', () => {
    test('singleton och nya instanser har build_initial_dom och update_dom från prototyp', () => {
        expect(typeof ChecklistHandlerClass.prototype.build_initial_dom).toBe('function');
        expect(typeof ChecklistHandler.build_initial_dom).toBe('function');
        expect(typeof createChecklistHandler().build_initial_dom).toBe('function');
        expect(typeof ChecklistHandler.update_dom).toBe('function');
        expect(Object.prototype.hasOwnProperty.call(ChecklistHandler, 'build_initial_dom')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(ChecklistHandler, 'update_dom')).toBe(false);
    });

    test('eventhanterare från delegater är funktioner på singleton', () => {
        expect(typeof ChecklistHandler.handle_checklist_click).toBe('function');
        expect(Object.prototype.hasOwnProperty.call(ChecklistHandler, 'handle_checklist_click')).toBe(false);
    });
});
