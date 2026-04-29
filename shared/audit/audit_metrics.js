/**
 * Audit-metrik som kan delas mellan server och frontend.
 */

/**
 * Räknar hur många “kört fast”-texter som finns i stickprovens kravresultat.
 * Funktionen är ren och får inte bero på DOM, window eller server-API.
 * @param {Array} samples
 * @returns {number}
 */
export function count_stuck_in_samples(samples) {
    if (!Array.isArray(samples)) return 0;
    let n = 0;
    samples.forEach((sample) => {
        const results = sample?.requirementResults || {};
        Object.values(results).forEach((r) => {
            const t = (r?.stuckProblemDescription || '').trim();
            if (t !== '') n += 1;
        });
    });
    return n;
}

