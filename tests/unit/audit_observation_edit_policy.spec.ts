/**
 * @fileoverview Enhetstester för policy kring redigering av bristbeskrivning.
 */
import { describe, test, expect } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const policy_path = path.join(spec_dir, '../../js/logic/audit_observation_edit_policy.ts');

const { can_edit_observation_detail } = await import(policy_path);

describe('audit_observation_edit_policy', () => {
    test('tillåter redigering för pågående och avslutad granskning', () => {
        expect(can_edit_observation_detail('in_progress')).toBe(true);
        expect(can_edit_observation_detail('locked')).toBe(true);
        expect(can_edit_observation_detail('not_started')).toBe(true);
    });

    test('blockerar redigering för arkiverad granskning', () => {
        expect(can_edit_observation_detail('archived')).toBe(false);
    });
});
