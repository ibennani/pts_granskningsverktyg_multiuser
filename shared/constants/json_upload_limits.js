/**
 * Max storlek för JSON-body (API) och uppladdade JSON-filer i klienten.
 * Måste vara samma som express.json-limit och ideally alignat med reverse proxy (se docs).
 */
export {
    FILE_MAX_BYTES as JSON_MAX_UPLOAD_BYTES,
    format_file_max_size_label as format_json_max_upload_size_label,
} from './file_size_limits.js';
