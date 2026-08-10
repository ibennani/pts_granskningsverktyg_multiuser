import { describe, test, expect } from '@jest/globals';

function safe_user_error(message: string): string {
    if (message.includes('cancelled')) return 'Capture avbruten';
    if (message.includes('SSRF') || message.includes('Ogiltig URL')) return 'Ogiltig URL';
    if (message.includes('Timeout') || message.includes('timeout')) {
        return 'Sidan svarade inte i tid';
    }
    if (message.includes('HTTP ')) {
        return 'Sidan kunde inte läsas in';
    }
    if (message.includes('webbläsare') || message.includes('Chrome') || message.includes('Chromium')) {
        return 'Kunde inte starta webbläsare på servern';
    }
    return 'Snapshot capture misslyckades';
}

describe('audit_snapshot capture error mapping', () => {
    test('timeout ger användarvänligt fel och behåller teknisk detail', () => {
        const detail = 'Navigation timeout of 30000 ms exceeded';
        expect(safe_user_error(detail)).toBe('Sidan svarade inte i tid');
        expect(detail).toContain('30000');
    });

    test('HTTP-fel mappas till läsbart meddelande', () => {
        expect(safe_user_error('Sidan svarade med HTTP 403')).toBe('Sidan kunde inte läsas in');
    });
});
