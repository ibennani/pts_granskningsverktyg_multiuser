/**
 * @fileoverview Verifierar att DOM-lyssnare anropar ChecklistHandler-instansen (inte containern).
 */

import { createChecklistHandler } from '../../js/components/requirement_audit/ChecklistHandler.js';

function create_mock_lock_helpers() {
    const calls = [];
    return {
        calls,
        helpers: {
            tryAcquireLock: (...args) => {
                calls.push(args);
                return Promise.resolve({ ok: true });
            },
            releaseLock: () => Promise.resolve({ ok: true }),
            getRemoteLock: () => null,
            ensureClientLockId: () => 'client-lock-1',
            isRemoteLockHeldByOtherUser: () => false,
            makeObservationDetailPartKey: () => 'part-key-1'
        }
    };
}

describe('ChecklistHandler DOM-lyssnare', () => {
    test('focusin på textarea triggar tryAcquireLock via container-lyssnare', async () => {
        const handler = createChecklistHandler();
        const container = document.createElement('div');
        const { helpers, calls } = create_mock_lock_helpers();

        container.innerHTML = `
            <div class="check-item" data-check-id="c1">
                <div class="pass-criterion-item" data-pc-id="p1">
                    <textarea class="pc-observation-detail-textarea"></textarea>
                </div>
            </div>
        `;

        handler.init(container, {}, {
            lockHelpers: helpers,
            getAuditId: () => 'audit-1',
            getSampleId: () => 's1',
            getRequirementMapKey: () => 'req1'
        });

        const textarea = container.querySelector('textarea');
        textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 50));

        expect(calls.length).toBe(1);
        handler.destroy();
    });
});
