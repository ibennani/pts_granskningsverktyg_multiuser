/**
 * @fileoverview Redirect från borttagen Inställningar-vy till Åtgärder.
 */
type Deps = {
    router: (view: string, params?: Record<string, string>) => void;
    params?: Record<string, string>;
};

export class AuditSettingsViewComponent {
    private deps: Deps | null = null;

    async init({ deps }: { root: HTMLElement; deps: Deps }): Promise<void> {
        this.deps = deps;
    }

    render(): void {
        if (!this.deps) return;
        const section = String(this.deps.params?.section ?? '').trim();
        if (section === 'summary' || section === 'principle_intros') {
            this.deps.router('audit_actions', {
                section: 'appendix_templates',
                appendix: '1',
                edit: 'true',
            });
            return;
        }
        this.deps.router('audit_actions', { section: 'information' });
    }

    destroy(): void {
        this.deps = null;
    }
}
