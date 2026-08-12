/**
 * @fileoverview Slår ihop CMP-leverantörspaket till listor för blockering och dismiss.
 */
import type { CmpVendorPackage } from './cmp_vendor_types.js';

export function collect_network_suffixes(vendors: readonly CmpVendorPackage[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const vendor of vendors) {
        for (const suffix of vendor.network_suffixes ?? []) {
            if (!seen.has(suffix)) {
                seen.add(suffix);
                result.push(suffix);
            }
        }
    }
    return result;
}

export function collect_path_substrings(
    vendors: readonly CmpVendorPackage[],
    generic: readonly string[]
): string[] {
    const seen = new Set<string>(generic);
    const result = [...generic];
    for (const vendor of vendors) {
        for (const part of vendor.network_path_substrings ?? []) {
            if (!seen.has(part)) {
                seen.add(part);
                result.push(part);
            }
        }
    }
    return result;
}

export function collect_selectors(
    vendors: readonly CmpVendorPackage[],
    field: 'accept_button_selectors' | 'banner_container_selectors' | 'hide_selectors',
    generic: readonly string[]
): string[] {
    const seen = new Set<string>(generic);
    const result = [...generic];
    for (const vendor of vendors) {
        for (const selector of vendor[field] ?? []) {
            if (!seen.has(selector)) {
                seen.add(selector);
                result.push(selector);
            }
        }
    }
    return result;
}

export function collect_exact_cookie_names(
    vendors: readonly CmpVendorPackage[]
): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const vendor of vendors) {
        for (const name of vendor.exact_cookie_names ?? []) {
            if (!seen.has(name)) {
                seen.add(name);
                result.push(name);
            }
        }
    }
    return result;
}

export function collect_exact_local_storage_keys(
    vendors: readonly CmpVendorPackage[]
): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const vendor of vendors) {
        for (const key of vendor.exact_local_storage_keys ?? []) {
            if (!seen.has(key)) {
                seen.add(key);
                result.push(key);
            }
        }
    }
    return result;
}

export function collect_cookie_name_regexes(
    vendors: readonly CmpVendorPackage[],
    generic: readonly RegExp[]
): RegExp[] {
    const keys = new Set(generic.map((r) => r.source));
    const result = [...generic];
    for (const vendor of vendors) {
        for (const regex of vendor.cookie_name_regexes ?? []) {
            if (!keys.has(regex.source)) {
                keys.add(regex.source);
                result.push(regex);
            }
        }
    }
    return result;
}

export function collect_local_storage_regexes(
    vendors: readonly CmpVendorPackage[],
    generic: readonly RegExp[]
): RegExp[] {
    const keys = new Set(generic.map((r) => r.source));
    const result = [...generic];
    for (const vendor of vendors) {
        for (const regex of vendor.local_storage_regexes ?? []) {
            if (!keys.has(regex.source)) {
                keys.add(regex.source);
                result.push(regex);
            }
        }
    }
    return result;
}
