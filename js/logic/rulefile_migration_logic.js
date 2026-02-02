// js/logic/rulefile_migration_logic.js

/**
 * Konverterar en regelfil från gammal struktur (direkta fält) till ny struktur (infoBlocks).
 * Denna funktion säkerställer att alla requirements har infoBlocks-struktur och att
 * metadata.blockOrders.infoBlocks är definierat.
 * 
 * @param {object} ruleFileContent - Regelfilens innehåll
 * @param {object} options - Options-objekt med Translation för översättningar
 * @returns {object} - Konverterad regelfil med ny struktur
 */
export function migrate_rulefile_to_new_structure(ruleFileContent, options = {}) {
    if (!ruleFileContent || typeof ruleFileContent !== 'object') {
        console.warn('[MigrationLogic] Invalid ruleFileContent, returning as-is');
        return ruleFileContent;
    }

    const t = options.Translation?.t || ((key) => {
        // Fallback-översättningar om Translation inte finns
        const fallback_map = {
            'requirement_expected_observation': 'Förväntad observation',
            'requirement_instructions': 'Instruktioner',
            'requirement_examples': 'Exempel',
            'requirement_tips': 'Tips',
            'requirement_common_errors': 'Vanliga fel',
            'requirement_exceptions': 'Undantag'
        };
        return fallback_map[key] || key;
    });

    // Skapa en djup kopia för att undvika mutationer
    const migrated_content = JSON.parse(JSON.stringify(ruleFileContent));

    // Säkerställ att metadata.blockOrders.infoBlocks finns
    if (!migrated_content.metadata) {
        migrated_content.metadata = {};
    }
    if (!migrated_content.metadata.blockOrders) {
        migrated_content.metadata.blockOrders = {};
    }
    if (!Array.isArray(migrated_content.metadata.blockOrders.infoBlocks) || 
        migrated_content.metadata.blockOrders.infoBlocks.length === 0) {
        // Standard-ordning för infoBlocks
        migrated_content.metadata.blockOrders.infoBlocks = [
            'expectedObservation',
            'instructions',
            'exceptions',
            'commonErrors',
            'tips',
            'examples'
        ];
    }

    const block_order = migrated_content.metadata.blockOrders.infoBlocks;

    // Mappning från block_id till gamla fältnamn
    const old_field_map = {
        'expectedObservation': 'expectedObservation',
        'instructions': 'instructions',
        'examples': 'examples',
        'tips': 'tips',
        'commonErrors': 'commonErrors',
        'exceptions': 'exceptions'
    };

    // Funktion för att få standardnamn för ett block
    const get_default_block_name = (block_id) => {
        const name_map = {
            'expectedObservation': t('requirement_expected_observation') || 'Förväntad observation',
            'instructions': t('requirement_instructions') || 'Instruktioner',
            'examples': t('requirement_examples') || 'Exempel',
            'tips': t('requirement_tips') || 'Tips',
            'commonErrors': t('requirement_common_errors') || 'Vanliga fel',
            'exceptions': t('requirement_exceptions') || 'Undantag'
        };
        return name_map[block_id] || block_id;
    };

    // Konvertera alla requirements
    if (migrated_content.requirements && typeof migrated_content.requirements === 'object') {
        let converted_count = 0;
        
        Object.values(migrated_content.requirements).forEach(req => {
            if (!req || typeof req !== 'object') return;

            const has_info_blocks = req.infoBlocks && typeof req.infoBlocks === 'object';
            const has_old_fields = req.expectedObservation !== undefined || 
                                   req.instructions !== undefined ||
                                   req.tips !== undefined ||
                                   req.exceptions !== undefined ||
                                   req.commonErrors !== undefined ||
                                   req.examples !== undefined;

            // Om kravet redan har infoBlocks, behåll det
            if (has_info_blocks) {
                return;
            }

            // Om kravet har gamla fält, konvertera till infoBlocks
            if (has_old_fields) {
                req.infoBlocks = {};
                
                block_order.forEach(block_id => {
                    const old_field = old_field_map[block_id];
                    if (old_field && req[old_field] !== undefined) {
                        const field_value = req[old_field];
                        
                        // Hantera både strängar och arrays
                        let text_value = '';
                        if (typeof field_value === 'string') {
                            text_value = field_value;
                        } else if (Array.isArray(field_value)) {
                            text_value = field_value.join('\n\n');
                        } else if (field_value !== null && field_value !== undefined) {
                            text_value = String(field_value);
                        }

                        req.infoBlocks[block_id] = {
                            name: get_default_block_name(block_id),
                            expanded: true,
                            text: text_value
                        };

                        // Ta bort det gamla fältet
                        delete req[old_field];
                    } else {
                        // Skapa tomt block även om det gamla fältet saknas
                        req.infoBlocks[block_id] = {
                            name: get_default_block_name(block_id),
                            expanded: true,
                            text: ''
                        };
                    }
                });

                converted_count++;
            }
        });

        if (converted_count > 0) {
            console.log(`[MigrationLogic] Konverterade ${converted_count} requirements från gammal struktur till ny struktur`);
        }
    }

    return migrated_content;
}
