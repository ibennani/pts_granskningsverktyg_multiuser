import {
    readdirSync,
    statSync,
} from 'node:fs';
import { join, extname } from 'node:path';

const DEFAULT_EXCLUDED_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'coverage',
    '.cursor',
    'terminals',
    '.vscode',
    '.idea',
    '.cache',
]);

const APP_DIRECTORIES = new Set(['js', 'css']);
const APP_FILE_EXTENSIONS = new Set(['.html', '.js', '.css']);

export function get_latest_project_mtime(options = {}) {
    const root_dir = options.rootDir;
    if (!root_dir) {
        throw new Error('get_latest_project_mtime kräver rootDir');
    }

    const extra_excluded_dirs = options.excludeDirs || [];
    const excluded_dirs = new Set([...DEFAULT_EXCLUDED_DIRS, ...extra_excluded_dirs]);

    let latest_mtime = null;

    function walk(current_dir, relative_dir = '') {
        let entries;
        try {
            entries = readdirSync(current_dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const name = entry.name;

            if (name === '.' || name === '..') {
                continue;
            }

            const full_path = join(current_dir, name);
            const next_relative_dir = relative_dir ? `${relative_dir}/${name}` : name;

            if (entry.isDirectory()) {
                if (excluded_dirs.has(name)) {
                    continue;
                }

                // På toppnivå: gå bara in i js/ och css/ för applikationen
                if (!relative_dir && !APP_DIRECTORIES.has(name)) {
                    continue;
                }

                walk(full_path, next_relative_dir);
                continue;
            }

            if (entry.isSymbolicLink && entry.isSymbolicLink()) {
                continue;
            }

            let stats;
            try {
                stats = statSync(full_path);
            } catch {
                continue;
            }

            if (!stats.isFile()) {
                continue;
            }

            const is_index_html_at_root = !relative_dir && name === 'index.html';

            // Ignorera build-info.js så att den inte triggar om sig själv
            if (name === 'build-info.js') {
                continue;
            }
            const ext = extname(name).toLowerCase();

            // Endast själva appen: index.html + filer i js/ och css/ med .html/.js/.css
            if (!is_index_html_at_root) {
                if (!APP_FILE_EXTENSIONS.has(ext)) {
                    continue;
                }
            }

            const mtime = stats.mtime;
            if (!latest_mtime || mtime > latest_mtime) {
                latest_mtime = mtime;
            }
        }
    }

    // Räkna alltid in index.html om den finns
    walk(root_dir, '');

    return latest_mtime || null;
}

