import { marked } from 'marked';

// Export shared marked instance so components can configure renderers per use.
export { marked };

/**
 * Automatiskt detekterar och konverterar kod-liknande text till kodblock för att bevara radbrytningar.
 * Detekterar text som innehåller HTML-taggar på separata rader men inte redan är i ett kodblock.
 * 
 * @param {string} markdownText - Markdown-texten att bearbeta
 * @returns {string} - Bearbetad markdown-text med kod-liknande text konverterad till kodblock
 */
export function auto_convert_code_like_to_codeblocks(markdownText) {
    if (!markdownText || typeof markdownText !== 'string') {
        return markdownText || '';
    }
    
    // Matchar HTML-taggar som börjar med < följt av bokstäver (t.ex. <Table>, <caption>, <TR>, etc.)
    const htmlTagPattern = /^<[A-Za-z][A-Za-z0-9]*[^>]*>/;
    
    // Dela upp texten i delar baserat på befintliga kodblock
    const codeBlockRegex = /```[\s\S]*?```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    // Hitta alla befintliga kodblock och spara dem
    while ((match = codeBlockRegex.exec(markdownText)) !== null) {
        // Lägg till texten före kodblocket
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: markdownText.substring(lastIndex, match.index) });
        }
        // Lägg till kodblocket
        parts.push({ type: 'codeblock', content: match[0] });
        lastIndex = match.index + match[0].length;
    }
    
    // Lägg till eventuell återstående text efter sista kodblocket
    if (lastIndex < markdownText.length) {
        parts.push({ type: 'text', content: markdownText.substring(lastIndex) });
    }
    
    // Om inga kodblock hittades, behandla hela texten som text
    if (parts.length === 0) {
        parts.push({ type: 'text', content: markdownText });
    }
    
    // Bearbeta varje textdel för att detektera kod-liknande innehåll
    const processedParts = [];
    for (const part of parts) {
        if (part.type === 'codeblock') {
            // Behåll kodblock som de är
            processedParts.push(part.content);
        } else {
            // Bearbeta textdelen för att hitta kod-liknande innehåll
            const lines = part.content.split('\n');
            let codeLikeBuffer = [];
            let processedLines = [];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                
                // Kontrollera om raden innehåller HTML-taggar (börjar med < och följs av bokstäver)
                // Matchar både <Table> och <caption> etc.
                if (trimmedLine && htmlTagPattern.test(trimmedLine)) {
                    codeLikeBuffer.push(line);
                } else if (trimmedLine === '' && codeLikeBuffer.length > 0) {
                    // Om raden är tom men vi har en buffer, behåll bufferten (tomma rader kan vara del av kodstrukturen)
                    codeLikeBuffer.push(line);
                } else {
                    // Om vi har en buffer med kod-liknande text, konvertera den till kodblock
                    if (codeLikeBuffer.length >= 2) {
                        processedLines.push('```');
                        processedLines.push(...codeLikeBuffer);
                        processedLines.push('```');
                        codeLikeBuffer = [];
                    } else if (codeLikeBuffer.length > 0) {
                        // Lägg till bufferten som vanlig text om den inte är tillräckligt lång
                        processedLines.push(...codeLikeBuffer);
                        codeLikeBuffer = [];
                    }
                    processedLines.push(line);
                }
            }
            
            // Hantera eventuell kvarvarande buffer
            if (codeLikeBuffer.length >= 2) {
                processedLines.push('```');
                processedLines.push(...codeLikeBuffer);
                processedLines.push('```');
            } else if (codeLikeBuffer.length > 0) {
                processedLines.push(...codeLikeBuffer);
            }
            
            processedParts.push(processedLines.join('\n'));
        }
    }
    
    return processedParts.join('');
}
