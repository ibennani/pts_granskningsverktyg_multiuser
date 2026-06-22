/**
 * @fileoverview Enhetstester för t_for_language (språkspecifik översättning utan UI-byte).
 */

import { t_for_language } from '../../js/translation_logic.ts';

describe('t_for_language', () => {
    test('svenska exportförkortning för webb', () => {
        expect(t_for_language('export_media_audit_type_abbrev_webb', 'sv-SE')).toBe('WEBB');
    });

    test('engelska exportförkortning för webb', () => {
        expect(t_for_language('export_media_audit_type_abbrev_webb', 'en-GB')).toBe('WEB');
    });

    test('norska exportförkortning för webb', () => {
        expect(t_for_language('export_media_audit_type_abbrev_webb', 'nb-NO')).toBe('WEB');
    });

    test('pdf-förkortning är PDF i alla språk', () => {
        expect(t_for_language('export_media_audit_type_abbrev_pdf', 'sv-SE')).toBe('PDF');
        expect(t_for_language('export_media_audit_type_abbrev_pdf', 'en-GB')).toBe('PDF');
    });

    test('normaliserar korta språktaggar', () => {
        expect(t_for_language('export_media_audit_type_abbrev_webb', 'sv')).toBe('WEBB');
        expect(t_for_language('export_media_audit_type_abbrev_webb', 'en')).toBe('WEB');
    });
});
