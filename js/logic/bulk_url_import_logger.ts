/**
 * @fileoverview Loggning för bulkimport av URL-lista (konsol och UI-sink).
 */
import { consoleManager } from '../utils/console_manager.js';

export type BulkUrlImportLogLevel = 'info' | 'warn' | 'error';

export type BulkUrlImportLogEvent = {
    level: BulkUrlImportLogLevel;
    message: string;
    row_id?: string;
    url?: string;
};

export type BulkUrlImportLogSink = (event: BulkUrlImportLogEvent) => void;

/**
 * Formaterar en loggrad med klockslag (Europe/Stockholm via sv-SE locale).
 */
export function format_bulk_url_import_log_line(event: BulkUrlImportLogEvent): string {
    const time = new Intl.DateTimeFormat('sv-SE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Europe/Stockholm',
    }).format(new Date());
    return `${time} ${event.message}`;
}

/**
 * Skickar logg till sink och konsol (endast utvecklingsläge via consoleManager).
 */
export function emit_bulk_url_import_log(
    sink: BulkUrlImportLogSink | undefined,
    message: string,
    options: Omit<BulkUrlImportLogEvent, 'message'> = { level: 'info' }
): void {
    const event: BulkUrlImportLogEvent = { ...options, message };
    sink?.(event);
    const prefix = `[bulk_url_import] ${format_bulk_url_import_log_line(event)}`;
    if (event.level === 'error' || event.level === 'warn') {
        consoleManager.warn(prefix);
        return;
    }
    consoleManager.log(prefix);
}
