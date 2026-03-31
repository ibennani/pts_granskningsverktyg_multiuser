import '@testing-library/jest-dom';
import { expect, afterEach } from '@jest/globals';
import { setImmediate as nodeSetImmediate } from 'node:timers';
import axeCore from 'jest-axe';

const { toHaveNoViolations } = axeCore;

expect.extend(toHaveNoViolations);

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
