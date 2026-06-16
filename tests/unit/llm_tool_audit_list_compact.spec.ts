/**
 * @jest-environment node
 */
import { describe, test, expect } from '@jest/globals';
import { build_audit_list_payload } from '../../server/services/llm_tool_audit_list_compact.ts';

describe('build_audit_list_payload', () => {
    test('väljer tidigast startad granskning och sorterar listan', () => {
        const payload = build_audit_list_payload([
            {
                id: 'b',
                status: 'in_progress',
                metadata: { title: 'Sen', startTime: '2024-06-01T10:00:00Z' },
                created_at: '2024-06-01T09:00:00Z',
                updated_at: '2024-06-02T09:00:00Z'
            },
            {
                id: 'a',
                status: 'locked',
                metadata: { title: 'Tidig' },
                created_at: '2024-01-15T08:00:00Z',
                updated_at: '2024-02-01T09:00:00Z'
            }
        ]);
        expect(payload.earliest_started?.id).toBe('a');
        expect(payload.audits[0]?.id).toBe('a');
        expect(payload.count).toBe(2);
    });
});
