import { RequirementsListViewComponent } from './RequirementsListViewComponent.js';

export const AllRequirementsViewComponent = {
    async init({ root, deps }) {
        // Wrapper that delegates to RequirementsListViewComponent with mode: 'all'
        this.inner_component = RequirementsListViewComponent;
        await this.inner_component.init({
            root,
            deps: {
                ...deps,
                mode: 'all'
            }
        });
    },

    async render() {
        if (this.inner_component && typeof this.inner_component.render === 'function') {
            await this.inner_component.render();
        }
    },

    destroy() {
        if (this.inner_component && typeof this.inner_component.destroy === 'function') {
            this.inner_component.destroy();
        }
        this.inner_component = null;
    }
};
