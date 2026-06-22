/**
 * @fileoverview Enhetstester för granskningsstatus vid flik-/serversynk.
 */
import { describe, test, expect } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const status_sync_path = path.join(spec_dir, '../../js/logic/audit_status_sync.ts');

const {
    audit_status_rank,
    server_status_should_win_over_local,
    should_reload_audit_from_server
} = await import(status_sync_path);

describe('audit_status_sync', () => {
    test('låst vinner över pågår', () => {
        expect(audit_status_rank('locked')).toBeGreaterThan(audit_status_rank('in_progress'));
        expect(server_status_should_win_over_local('in_progress', 'locked')).toBe(true);
        expect(server_status_should_win_over_local('locked', 'in_progress')).toBe(false);
    });

    test('omladdning vid högre version eller samma version med annan status', () => {
        expect(should_reload_audit_from_server('in_progress', 'locked', 5, 8)).toBe(true);
        expect(should_reload_audit_from_server('in_progress', 'locked', 8, 8)).toBe(true);
        expect(should_reload_audit_from_server('in_progress', 'in_progress', 8, 8)).toBe(false);
    });
});
