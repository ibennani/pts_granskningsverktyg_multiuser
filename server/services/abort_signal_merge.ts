/**
 * @file Kombinerar flera avbrottssignaler (klient kopplar från, tidsgräns).
 */

export function merge_abort_signals(signals: AbortSignal[]): AbortSignal {
    const active = signals.filter((signal) => signal);
    if (active.length === 0) {
        throw new Error('Minst en avbrottssignal krävs.');
    }
    if (active.length === 1) {
        return active[0];
    }
    const any_fn = (AbortSignal as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
    if (typeof any_fn === 'function') {
        return any_fn(active);
    }
    const controller = new AbortController();
    const on_abort = (signal: AbortSignal) => {
        if (signal.reason) {
            controller.abort(signal.reason);
        } else {
            controller.abort();
        }
    };
    for (const signal of active) {
        if (signal.aborted) {
            on_abort(signal);
            break;
        }
        signal.addEventListener('abort', () => on_abort(signal), { once: true });
    }
    return controller.signal;
}
