/**
 * @fileoverview Tester för Excel-bristbladets tabellnamn.
 */

import { describe, expect, test } from '@jest/globals';
import { populate_deficiencies_excel_sheet } from '../../js/export/excel_deficiencies_sheet.ts';

describe('excel_deficiencies_sheet', () => {
    test('populate_deficiencies_excel_sheet sanerar både name och displayName', () => {
        let captured_table: Record<string, unknown> | null = null;
        const sheet = {
            addTable: (opts: Record<string, unknown>) => {
                captured_table = opts;
            },
            getRow: () => ({
                getCell: () => ({}),
                eachCell: () => {}
            }),
            eachRow: () => {},
            getColumn: () => ({ width: 10 }),
            views: []
        };

        populate_deficiencies_excel_sheet(
            sheet,
            [],
            [{ header: 'Id', key: 'id', width: 8 }],
            'Audit report',
            2
        );

        expect(captured_table).not.toBeNull();
        expect(captured_table?.name).toBe('Auditreport');
        expect(captured_table?.displayName).toBe('Auditreport');
        expect(String(captured_table?.displayName)).not.toContain(' ');
    });
});
