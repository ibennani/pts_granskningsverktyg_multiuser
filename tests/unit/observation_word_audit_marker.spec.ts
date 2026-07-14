/**
 * Tester för dold ärendemarkering i handläggar-Word.
 */
import { describe, test, expect } from '@jest/globals';
import JSZip from 'jszip';
import {
    build_observation_word_audit_marker_from_audit,
    embed_observation_word_audit_marker_in_docx,
    read_observation_word_audit_marker_from_docx,
    validate_observation_word_audit_marker,
} from '../../shared/export/observation_word_audit_marker.ts';

async function create_empty_docx_buffer(): Promise<ArrayBuffer> {
    const zip = new JSZip();
    zip.file(
        '[Content_Types].xml',
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
    );
    zip.file(
        '_rels/.rels',
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
    );
    return zip.generateAsync({ type: 'arraybuffer' });
}

describe('observation_word_audit_marker', () => {
    test('build_observation_word_audit_marker_from_audit läser auditId och metadata', () => {
        const marker = build_observation_word_audit_marker_from_audit({
            auditId: 'abc-123',
            auditMetadata: { caseNumber: 'PTS 2024/1', actorName: 'Exempel AB' },
        });

        expect(marker).toEqual({
            version: '1',
            audit_id: 'abc-123',
            case_number: 'PTS 2024/1',
            actor_name: 'Exempel AB',
        });
    });

    test('embed och read roundtrip i docx', async () => {
        const base_docx = await create_empty_docx_buffer();
        const marker = {
            version: '1',
            audit_id: 'audit-99',
            case_number: '2024-99',
            actor_name: 'Aktör X',
        };

        const marked = await embed_observation_word_audit_marker_in_docx(base_docx, marker);
        const read_back = await read_observation_word_audit_marker_from_docx(marked);

        expect(read_back).toEqual(marker);
    });

    test.each([
        ['A & B Co', '2024-1'],
        ['AT&T', '2024-2'],
        ["O'Reilly", '2024-3'],
        ['Åäö & Söner', '2024-4'],
    ])('embed och read roundtrip med specialtecken i aktör (%s)', async (actor_name, case_number) => {
        const base_docx = await create_empty_docx_buffer();
        const marker = {
            version: '1',
            audit_id: 'audit-special',
            case_number,
            actor_name,
        };

        const marked = await embed_observation_word_audit_marker_in_docx(base_docx, marker);
        const read_back = await read_observation_word_audit_marker_from_docx(marked);

        expect(read_back).toEqual(marker);
    });

    test('validate godkänner matchande auditId', () => {
        const audit = {
            auditId: 'same-id',
            auditMetadata: { caseNumber: 'A', actorName: 'B' },
        };
        const result = validate_observation_word_audit_marker(audit, {
            version: '1',
            audit_id: 'same-id',
            case_number: 'X',
            actor_name: 'Y',
        });
        expect(result.ok).toBe(true);
    });

    test('validate godkänner matchande diarienummer och aktör utan auditId', () => {
        const audit = {
            auditMetadata: { caseNumber: '2024-1', actorName: 'Bolaget' },
        };
        const result = validate_observation_word_audit_marker(audit, {
            version: '1',
            audit_id: '',
            case_number: '2024-1',
            actor_name: 'Bolaget',
        });
        expect(result.ok).toBe(true);
    });

    test('validate godkänner matchande aktör med & i namn', () => {
        const audit = {
            auditMetadata: { caseNumber: '2024-5', actorName: 'A & B Co' },
        };
        const result = validate_observation_word_audit_marker(audit, {
            version: '1',
            audit_id: '',
            case_number: '2024-5',
            actor_name: 'A & B Co',
        });
        expect(result.ok).toBe(true);
    });

    test('validate avvisar fel granskning', () => {
        const audit = {
            auditId: 'audit-a',
            auditMetadata: { caseNumber: '111', actorName: 'Aktör A' },
        };
        const result = validate_observation_word_audit_marker(audit, {
            version: '1',
            audit_id: 'audit-b',
            case_number: '222',
            actor_name: 'Aktör B',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error_key).toBe('observation_word_import_error_wrong_audit');
            expect(result.params).toEqual({
                audit_case: '111',
                audit_actor: 'Aktör A',
            });
        }
    });

    test('validate avvisar fil utan markering med samma felnyckel som fel granskning', () => {
        const result = validate_observation_word_audit_marker(
            {
                auditId: 'x',
                auditMetadata: { caseNumber: 'DNR-1', actorName: 'Aktör X' },
            },
            null
        );
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error_key).toBe('observation_word_import_error_wrong_audit');
            expect(result.params).toEqual({
                audit_case: 'DNR-1',
                audit_actor: 'Aktör X',
            });
        }
    });
});
