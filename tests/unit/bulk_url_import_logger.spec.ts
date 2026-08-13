/**
 * @fileoverview Enhetstester för bulk_url_import_logger.
 */
import { describe, test, expect } from '@jest/globals';
import {
    emit_bulk_url_import_log,
    format_bulk_url_import_log_line,
    type BulkUrlImportLogEvent,
} from '../../js/logic/bulk_url_import_logger.ts';

describe('bulk_url_import_logger', () => {
    test('format_bulk_url_import_log_line inkluderar meddelande', () => {
        const line = format_bulk_url_import_log_line({
            level: 'info',
            message: 'Testrad',
        });
        expect(line).toMatch(/^\d{2}:\d{2}:\d{2} Testrad$/);
    });

    test('emit_bulk_url_import_log anropar sink', () => {
        const events: BulkUrlImportLogEvent[] = [];
        emit_bulk_url_import_log((event) => events.push(event), 'Steg klar', {
            level: 'info',
            url: 'https://example.com',
        });
        expect(events).toHaveLength(1);
        expect(events[0]?.message).toBe('Steg klar');
        expect(events[0]?.url).toBe('https://example.com');
    });
});
