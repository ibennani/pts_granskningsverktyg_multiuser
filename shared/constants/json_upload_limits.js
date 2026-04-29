/**
 * Max storlek för JSON-body (API) och uppladdade JSON-filer i klienten.
 * Måste vara samma som express.json-limit och ideally alignat med reverse proxy (se docs).
 */
export const JSON_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
