/**
 * @file Väljer slutgiltig svarstext från Ollama (content eller thinking som reserv).
 */

/** Returnerar content om det finns, annars thinking (vanligt hos vissa tanke-modeller). */
export function resolve_chat_reply_text(content: string, thinking: string): string {
    const trimmed_content = (content || '').trim();
    if (trimmed_content) return trimmed_content;
    return (thinking || '').trim();
}
