/**
 * @fileoverview Bilagornas malltexter under Åtgärder — samma vy som regelfil Rapportmall, med resolved data.
 */
import './audit_settings_view_component.css';
import { resolve_appendix1_deficiency_view_data_for_audit } from '../logic/appendix1_deficiency_view_data.js';
import { resolve_appendix1_body_text } from '../logic/appendix1_sections.js';
import { resolve_appendix2_excel_labels_for_audit } from '../logic/audit_appendix_overrides.js';
import { resolve_appendix3_screenshots_template } from '../logic/appendix3_screenshots_template.js';
import {
    render_rulefile_appendix_templates_hub,
    create_rulefile_appendix_edit_button,
    type RulefileAppendixTemplatesRenderDeps,
} from './rulefile_sections/rulefile_appendix_templates_render.js';
import {
    render_rulefile_appendix1_template_section,
    render_rulefile_appendix2_template_section,
    render_rulefile_appendix3_template_section,
} from './rulefile_sections/rulefile_sections_type_views.js';

export type AuditAppendixTemplatesRenderDeps = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        get_icon_svg?: (name: string) => string;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    router: (view: string, params?: Record<string, string>) => void;
};

function audit_appendix_router(
    deps: AuditAppendixTemplatesRenderDeps,
    _view: string,
    params?: Record<string, string>
): void {
    const { section: _ignored_section, ...rest } = params ?? {};
    deps.router('audit_actions', { section: 'appendix_templates', ...rest });
}

function build_rulefile_appendix_deps(deps: AuditAppendixTemplatesRenderDeps): RulefileAppendixTemplatesRenderDeps {
    return {
        Helpers: deps.Helpers,
        Translation: deps.Translation,
        router: (view: string, params?: Record<string, string>) => {
            audit_appendix_router(deps, view, params);
        },
    };
}

function build_view_ctx(
    deps: AuditAppendixTemplatesRenderDeps,
    state: Record<string, unknown>
) {
    return {
        Helpers: deps.Helpers,
        Translation: deps.Translation,
        router: (view: string, params?: Record<string, string>) => {
            audit_appendix_router(deps, view, params);
        },
        getState: () => state,
    };
}

function appendix2_labels_from_resolved(
    resolved: ReturnType<typeof resolve_appendix2_excel_labels_for_audit>
) {
    return {
        sheetNames: resolved.sheet_names,
        generalInfo: Object.entries(resolved.general_info_labels).map(([key, label]) => ({ key, label })),
        deficiencyColumns: Object.entries(resolved.deficiency_column_labels).map(([key, label]) => ({
            key,
            label,
        })),
    };
}

/** Hub med länkar till Bilaga 1–3 (samma som regelfil). */
export function render_audit_appendix_templates_hub(
    deps: AuditAppendixTemplatesRenderDeps,
    section: HTMLElement
): void {
    render_rulefile_appendix_templates_hub(build_rulefile_appendix_deps(deps), section);
}

/** @deprecated Använd create_rulefile_appendix_edit_button via build_rulefile_appendix_deps. */
export function create_audit_appendix_edit_button(
    deps: AuditAppendixTemplatesRenderDeps,
    appendix: '1' | '2' | '3',
    aria_key: string
): HTMLButtonElement {
    return create_rulefile_appendix_edit_button(
        build_rulefile_appendix_deps(deps),
        appendix,
        aria_key
    );
}

export function render_audit_appendix1_view_section(
    deps: AuditAppendixTemplatesRenderDeps,
    state: Record<string, unknown>,
    options: { can_edit: boolean } = { can_edit: false }
): HTMLElement {
    const rulefile_deps = build_rulefile_appendix_deps(deps);
    const page_header_action = options.can_edit
        ? create_rulefile_appendix_edit_button(
              rulefile_deps,
              '1',
              'rulefile_sections_edit_appendix1_aria'
          )
        : undefined;

    const t = deps.Translation.t;
    return render_rulefile_appendix1_template_section(
        build_view_ctx(deps, state),
        (state.ruleFileContent as Record<string, unknown>) || {},
        {
            body_text: resolve_appendix1_body_text(state),
            page_header_action,
            deficiency_intros_hint_key: 'audit_appendix1_deficiency_intros_hint',
            deficiency_view_data: resolve_appendix1_deficiency_view_data_for_audit(state, t),
        }
    );
}

export function render_audit_appendix2_view_section(
    deps: AuditAppendixTemplatesRenderDeps,
    state: Record<string, unknown>
): HTMLElement {
    const resolved = resolve_appendix2_excel_labels_for_audit(state);
    return render_rulefile_appendix2_template_section(
        build_view_ctx(deps, state),
        (state.ruleFileContent as Record<string, unknown>) || {},
        { labels: appendix2_labels_from_resolved(resolved) }
    );
}

export function render_audit_appendix3_view_section(
    deps: AuditAppendixTemplatesRenderDeps,
    state: Record<string, unknown>,
    options: { can_edit: boolean } = { can_edit: false }
): HTMLElement {
    const template = resolve_appendix3_screenshots_template(state);
    const rulefile_deps = build_rulefile_appendix_deps(deps);
    const page_header_action = options.can_edit
        ? create_rulefile_appendix_edit_button(
              rulefile_deps,
              '3',
              'rulefile_sections_edit_appendix3_aria'
          )
        : undefined;

    return render_rulefile_appendix3_template_section(
        build_view_ctx(deps, state),
        (state.ruleFileContent as Record<string, unknown>) || {},
        {
            intro_text: template.introText,
            page_header_action,
        }
    );
}
