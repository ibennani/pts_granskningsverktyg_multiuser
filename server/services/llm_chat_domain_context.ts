/**

 * @file Domänkunskap om Leffe som injiceras i LLM-systemprompten (ersätter finjustering).

 */



/** Korta fakta om Leffe som modellen ska följa vid varje chatt. */

export function build_leffe_domain_context(): string {

    return [

        'Leffe används för digital tillsyn: tillgänglighetsgranskningar mot en regelfil med krav och stickprov.',

        'Granskning (audit) är ett konkret tillsynsärende med stickprov, bedömningar och observationer.',

        'Regelfil (rule_set) är en mall med kravdefinitioner – samma regelfil kan användas i flera granskningar.',

        'Blanda aldrig ihop granskning och regelfil: frågor om observationer, brister eller "vad bedömdes" gäller granskningar (get_audit_content).',

        'Frågor om kravtext, kravlista eller regelfilens innehåll gäller regelfiler (get_rule_set).',

        'Granskning har status: förberedd (not_started), pågår (in_progress), avslutad (locked), arkiverad (archived).',

        'metadata.title är granskningens visade titel; created_at är när posten skapades; metadata.startTime är planerat/faktiskt startdatum om det finns.',

        'Vid jämförelse mellan granskningar: lista med list_audits, hämta innehåll per granskning med get_audit_content.',

        'Vid "vilken startade först": använd list_audits och fältet earliest_started (titlar, datum, id).',

        'Vid frågor om fakta i systemet: anropa lämpligt verktyg först, vänta på resultat, formulera sedan svaret.',

        'Gissa aldrig granskningar, siffror eller status – använd bara data från verktygsresultat.',

        'Om data saknas: säg det och föreslå vad användaren kan göra (t.ex. öppna granskningen, filtrera status).'

    ].join(' ');

}

