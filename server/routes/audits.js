/**
 * Brygga: server (Node/tsx) importerar med .js; källan är TypeScript.
 * Exporterar default-router och build_full_state för backup m.m.
 */
export { build_full_state } from './audit_build_state.js';
import auditsRouter from './audits_routes.js';
export default auditsRouter;
