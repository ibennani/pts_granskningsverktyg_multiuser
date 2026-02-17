/**
 * LayoutManager
 *
 * Ansvarar för att hålla layouten uppdaterad vid storleksändringar.
 * Innehållet ligger alltid mot sidans överkant utan extra marginal.
 */

export const LayoutManager = {
    init() {
        this.appContainer = document.getElementById('app-container');

        if (!this.appContainer) {
            console.warn('LayoutManager: #app-container hittades inte.');
            return;
        }

        this.updateLayout = this.updateLayout.bind(this);
        window.addEventListener('resize', this.updateLayout);

        this.resizeObserver = new ResizeObserver(() => {
            this.updateLayout();
        });
        this.resizeObserver.observe(this.appContainer);

        requestAnimationFrame(this.updateLayout);
    },

    updateLayout() {
        if (!this.appContainer) return;
        this.appContainer.style.marginTop = '0';
    },

    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        window.removeEventListener('resize', this.updateLayout);
    }
};
