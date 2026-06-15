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
            description: 'Lista granskningar i databasen med status, titel och bristindex.',
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
            description: 'Hämta detaljer om en granskning: metadata, stickprov och sammanfattning av kravresultat.',
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
            name: 'list_rule_sets',
            description: 'Lista regelfiler i databasen med titel och versionsinformation.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_rule_set',
            description: 'Hämta metadata och kravöversikt för en regelfil.',
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
