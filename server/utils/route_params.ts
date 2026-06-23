/**
 * @fileoverview Hjälpare för Express 5 route-parametrar (string | string[]).
 */

/** Normaliserar en route-parameter till en sträng. */
export function single_route_param(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
        return String(value[0] ?? '');
    }
    return String(value ?? '');
}
