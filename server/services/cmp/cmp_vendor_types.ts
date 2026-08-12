/**
 * @fileoverview Typer för CMP-leverantörspaket vid sidrapporter.
 */

export type CmpVendorPackage = {
    id: string;
    network_suffixes?: readonly string[];
    network_path_substrings?: readonly string[];
    accept_button_selectors?: readonly string[];
    banner_container_selectors?: readonly string[];
    hide_selectors?: readonly string[];
    exact_cookie_names?: readonly string[];
    exact_local_storage_keys?: readonly string[];
    cookie_name_regexes?: readonly RegExp[];
    local_storage_regexes?: readonly RegExp[];
};
