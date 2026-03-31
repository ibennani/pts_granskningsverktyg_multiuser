import { RequirementsListViewComponent } from './RequirementsListViewComponent.js';

export class AllRequirementsViewComponent {
    constructor() {
        this.inner_component = null;
    }

    async init({ root, deps }) {
        this.inner_component = RequirementsListViewComponent;
        await this.inner_component.init({
            root,
            deps: {
                ...deps,
                mode: 'all'
            }
        });
    }

    async render() {
        if (this.inner_component && typeof this.inner_component.render === 'function') {
            await this.inner_component.render();
        }
    }

    destroy() {
        if (this.inner_component && typeof this.inner_component.destroy === 'function') {
            this.inner_component.destroy();
        }
        this.inner_component = null;
    }
}
