/**
 * Singleton-referenser som sätts från main.js vid uppstart.
 * Ersätter tidigare window-exponering av modal- och notifieringsinstanser.
 */

export const app_runtime_refs = {
    notification_component: null,
    modal_component: null
};
