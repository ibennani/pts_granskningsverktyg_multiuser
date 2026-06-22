/**
 * @fileoverview Vite HMR-hjälpare isolerad så Jest kan mocka utan import.meta i .js-filer.
 */

export function vite_register_hmr_dispose(on_dispose: () => void): void {
    if (import.meta.hot) {
        import.meta.hot.dispose(on_dispose);
    }
}
