/**
 * @file Filnamn för nedladdning av regelfiler (suffix och basnamn).
 */

/**
 * @param {unknown} version_string
 * @returns {string|null}
 */
export function to_filename_version_suffix(version_string) {
    const match =
        typeof version_string === 'string'
            ? version_string.match(/^(\d{4})\.(\d{1,2})\.r(\d+)$/)
            : null;
    if (!match) return null;
    const year = match[1];
    const month = parseInt(match[2], 10);
    const release = match[3];
    return `${year}_${month}_r${release}`;
}

/**
 * @param {unknown} title
 * @param {unknown} version_string
 * @returns {string}
 */
export function build_rulefile_download_filename(title, version_string) {
    const default_extension = '.json';
    const version_suffix = to_filename_version_suffix(version_string);
    const safe_suffix = version_suffix ? `_${version_suffix}` : '';

    let base_name = (title || 'rulefile').toString().trim();
    base_name = base_name.replace(/\s+/g, '_');
    base_name = base_name.replace(/[\\/:*?"<>|]/g, '');

    return `${base_name}${safe_suffix}${default_extension}`;
}
