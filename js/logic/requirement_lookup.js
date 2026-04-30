/**
 * Re-export från TypeScript-källan så att rena .js-moduler och Jest hittar `requirement_lookup.js` på disk.
 * Vite löser ofta `*.js` direkt mot `*.ts` via extensionAlias; filen tillfredsställer verify_js_only_imports.
 */
export * from './requirement_lookup.ts';
