import { RequirementsListViewComponent } from './RequirementsListViewComponent.js';

export const RequirementListComponent = {
    async init({ root, deps }) {
        // Wrapper that delegates to RequirementsListViewComponent with mode: 'sample'
        this.inner_component = RequirementsListViewComponent;
        await this.inner_component.init({
            root,
            deps: {
                ...deps,
                mode: 'sample'
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
