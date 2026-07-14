/**
 * @fileoverview Delade konstanter för handläggar-Word (observationstexter).
 * Röd ram markerar redigeringszonen vid framtida inläsning.
 */
import { BorderStyle } from 'docx';

/**
 * Färg för handläggarens importblock (#CC0000).
 * Framtida import söker tabellceller där alla fyra kanter har denna border.
 * Använd endast runt H4 + observationstext i handläggar-exporten.
 * Tabellraden sätts med cantSplit och styckena med keepNext så att innehållet inte sidbryts.
 */
export const OBSERVATION_BORDER_COLOR = 'CC0000';

/** Border för en röd tabellcell (importzon per brist). */
export const red_handling_cell_border = {
    top: { style: BorderStyle.SINGLE, size: 6, color: OBSERVATION_BORDER_COLOR },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: OBSERVATION_BORDER_COLOR },
    left: { style: BorderStyle.SINGLE, size: 6, color: OBSERVATION_BORDER_COLOR },
    right: { style: BorderStyle.SINGLE, size: 6, color: OBSERVATION_BORDER_COLOR },
};
