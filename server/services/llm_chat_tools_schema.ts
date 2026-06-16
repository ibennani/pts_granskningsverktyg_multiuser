/**

 * @file Ollama-verktyg som ger Leffe tillgång till databasen (läs och skriv).

 */



export interface OllamaToolDefinition {

    type: 'function';

    function: {

        name: string;

        description: string;

        parameters: {

            type: 'object';

            properties: Record<string, unknown>;

            required?: string[];

        };

    };

}



export const LLM_CHAT_TOOLS: OllamaToolDefinition[] = [

    {

        type: 'function',

        function: {

            name: 'list_audits',

            description:

                'Lista granskningar (audit) – konkreta tillsynsärenden med resultat. Inte samma sak som regelfiler. Returnerar titel, status, regelfil, datum och earliest_started.',

            parameters: {

                type: 'object',

                properties: {

                    status: {

                        type: 'string',

                        description: 'Valfritt filter: not_started, in_progress, locked, archived'

                    }

                }

            }

        }

    },

    {

        type: 'function',

        function: {

            name: 'get_audit',

            description:

                'Översikt av en granskning (audit): metadata, kopplad regelfil, stickprov och sammanfattning av kravstatus. Använd get_audit_content för observationer och detaljer.',

            parameters: {

                type: 'object',

                properties: {

                    audit_id: { type: 'string', description: 'Granskningens id (UUID)' }

                },

                required: ['audit_id']

            }

        }

    },

    {

        type: 'function',

        function: {

            name: 'get_audit_content',

            description:

                'Hämta innehåll i en granskning: stickprov med kravbedömningar, observationer och kommentarer. Använd vid frågor om brister, observationer eller vad som bedömts i en viss granskning.',

            parameters: {

                type: 'object',

                properties: {

                    audit_id: { type: 'string', description: 'Granskningens id (UUID)' },

                    sample_id: {

                        type: 'string',

                        description: 'Valfritt: begränsa till ett stickprov'

                    },

                    status_filter: {

                        type: 'string',

                        description:

                            'Valfritt filter på kravstatus: failed, passed, partially_audited, not_audited, not_applicable'

                    }

                },

                required: ['audit_id']

            }

        }

    },

    {

        type: 'function',

        function: {

            name: 'list_rule_sets',

            description:

                'Lista regelfiler (rule_set) – mallar med krav. En regelfil kan användas i många granskningar men innehåller inga stickprov eller bedömningar.',

            parameters: { type: 'object', properties: {} }

        }

    },

    {

        type: 'function',

        function: {

            name: 'get_rule_set',

            description:

                'Hämta en regelfil (rule_set): metadata och lista över krav med titlar. Innehåller inte granskningsresultat – för det använd get_audit_content.',

            parameters: {

                type: 'object',

                properties: {

                    rule_set_id: { type: 'string', description: 'Regelfilens id (UUID)' }

                },

                required: ['rule_set_id']

            }

        }

    },

    {

        type: 'function',

        function: {

            name: 'get_statistics',

            description: 'Hämta aggregerad statistik för avslutade granskningar.',

            parameters: { type: 'object', properties: {} }

        }

    },

    {

        type: 'function',

        function: {

            name: 'update_audit_metadata',

            description: 'Uppdatera granskningsmetadata (t.ex. titel, beställare). Skicka bara fält som ska ändras.',

            parameters: {

                type: 'object',

                properties: {

                    audit_id: { type: 'string', description: 'Granskningens id' },

                    metadata: {

                        type: 'object',

                        description: 'Metadatafält att slå ihop med befintliga värden'

                    }

                },

                required: ['audit_id', 'metadata']

            }

        }

    },

    {

        type: 'function',

        function: {

            name: 'update_requirement_result',

            description:

                'Uppdatera bedömning av ett krav i ett stickprov (status och/eller observationstext).',

            parameters: {

                type: 'object',

                properties: {

                    audit_id: { type: 'string' },

                    sample_id: { type: 'string' },

                    requirement_id: { type: 'string' },

                    status: {

                        type: 'string',

                        description: 'passed, failed, not_audited, not_applicable, partially_audited'

                    },

                    observation: { type: 'string', description: 'Observationstext (valfritt)' }

                },

                required: ['audit_id', 'sample_id', 'requirement_id']

            }

        }

    }

];

