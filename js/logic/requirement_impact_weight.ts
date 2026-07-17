/**
 * @fileoverview Läser och beräknar kravvikt för bristindex (samma modell som ScoreCalculator).
 */

export type RequirementImpact = {
    isCritical: boolean;
    primaryScore: number;
    secondaryScore: number;
};

function parse_non_negative_int(value: unknown): number {
    const parsed = parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }
    return parsed;
}

/** Läser impact-fält från ett krav. */
export function read_requirement_impact(requirement: Record<string, unknown>): RequirementImpact {
    const metadata = requirement.metadata as Record<string, unknown> | undefined;
    const impact = metadata?.impact as Record<string, unknown> | undefined;
    return {
        isCritical: impact?.isCritical === true,
        primaryScore: parse_non_negative_int(impact?.primaryScore),
        secondaryScore: parse_non_negative_int(impact?.secondaryScore),
    };
}

/** Beräknar kravets vikt enligt bristindex-modellen. */
export function calculate_requirement_weight(requirement: Record<string, unknown>): number {
    const impact = read_requirement_impact(requirement);
    const is_critical_factor = impact.isCritical ? 1.0 : 0.9;
    const score_component = Math.sqrt(impact.primaryScore + 0.5 * impact.secondaryScore);
    return is_critical_factor * score_component;
}

/** Formaterar vikt för visning i tabell. */
export function format_requirement_weight(weight: number): string {
    if (!Number.isFinite(weight) || weight <= 0) {
        return '0';
    }
    return weight.toFixed(2);
}

/** Uppdaterar impact på ett krav i en regelfilkopia. */
export function apply_requirement_impact_change(
    rule_file_content: Record<string, unknown>,
    requirement_key: string,
    impact: RequirementImpact
): Record<string, unknown> {
    const requirements = (rule_file_content.requirements ?? {}) as Record<string, unknown>;
    const existing = (requirements[requirement_key] ?? {}) as Record<string, unknown>;
    const metadata = { ...(existing.metadata as Record<string, unknown> | undefined) };
    metadata.impact = {
        isCritical: impact.isCritical,
        primaryScore: impact.primaryScore,
        secondaryScore: impact.secondaryScore,
    };
    return {
        ...rule_file_content,
        requirements: {
            ...requirements,
            [requirement_key]: {
                ...existing,
                metadata,
            },
        },
    };
}
