import '@testing-library/jest-dom';
import { expect, afterEach, beforeAll } from '@jest/globals';
import { webcrypto } from 'node:crypto';
import { inject_deficiency_score_bar_gradient_styles } from '../js/logic/deficiency_color_scale.ts';
import { setImmediate as nodeSetImmediate } from 'node:timers';
import axeCore from 'jest-axe';

/** jsdom saknar Web Crypto som export_integrity m.fl. förlitar sig på. */
if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const { toHaveNoViolations } = axeCore;

expect.extend(toHaveNoViolations);

beforeAll(() => {
    inject_deficiency_score_bar_gradient_styles();
});

/**
 * Låter köade macrotasks (t.ex. setTimeout(0) i state/notify_listeners) avslutas
 * innan nästa test, så att Jest-workerprocesser kan stängas utan varning.
 * (global setImmediate saknas i jsdom; använder Nodes implementation.)
 */
afterEach(
    () =>
        new Promise((resolve) => {
            nodeSetImmediate(() => {
                nodeSetImmediate(resolve);
            });
        })
);
