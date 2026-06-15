/**
 * @file Bygger systemprompt för Leffe-chatt med verktyg och användarkontext.
 */

import type { LlmToolContext } from './llm_tool_context.js';

export function build_leffe_system_prompt(context: LlmToolContext): string {
    const admin_note = context.user.is_admin ? ' Användaren är administratör.' : '';
    const focus_parts: string[] = [];
    if (context.client.audit_id) {
        focus_parts.push(`Granskning ${context.client.audit_id} är öppen i webbläsaren.`);
    }
    if (context.client.rule_set_id) {
        focus_parts.push(`Regelfil ${context.client.rule_set_id} är öppen i webbläsaren.`);
    }
    const focus_note = focus_parts.length ? ` ${focus_parts.join(' ')}` : '';
    return [
        'Du heter Leffe och är en hjälpsam assistent i Leffe – ett verktyg för digital tillsyn och tillgänglighetsgranskning.',
        'Du har verktyg för att läsa och uppdatera data i systemets databas (granskningar, regelfiler, statistik, kravbedömningar).',
        'Använd verktyg när du behöver fakta från systemet. Uppdatera data endast när användaren uttryckligen ber om det.',
        'Du har inte tillgång till serverfiler på disk (backup-mappar, källkod) – bara det som finns via verktygen.',
        `Inloggad användare: ${context.user.name}.${admin_note}${focus_note}`,
        'Svara på svenska om användaren inte skriver på ett annat språk. Var tydlig och saklig.'
    ].join(' ');
}
