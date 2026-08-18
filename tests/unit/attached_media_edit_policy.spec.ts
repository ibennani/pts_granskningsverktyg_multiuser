/**
 * @fileoverview Tester för tillfällig policy kring redigera bifogad media.
 */

import { describe, it, expect } from '@jest/globals';
import {
    TEMP_ALLOW_EDIT_ATTACHED_MEDIA_WHEN_AUDIT_CLOSED,
    should_show_edit_attached_media_button
} from '../../js/logic/attached_media_edit_policy.ts';

describe('should_show_edit_attached_media_button', () => {
    it('visar knappen i avslutad granskning medan tillfällig flagga är aktiv', () => {
        expect(TEMP_ALLOW_EDIT_ATTACHED_MEDIA_WHEN_AUDIT_CLOSED).toBe(true);
        expect(should_show_edit_attached_media_button(true)).toBe(true);
    });

    it('visar knappen i pågående granskning', () => {
        expect(should_show_edit_attached_media_button(false)).toBe(true);
    });
});
