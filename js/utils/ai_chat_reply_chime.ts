/**
 * Kort pling när AI-chattens svar är klart. Använder Web Audio API utan externa ljudfiler.
 */

let audio_context: AudioContext | null = null;

function get_audio_context(): AudioContext | null {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
        return null;
    }
    if (!audio_context) {
        audio_context = new AudioContext();
    }
    return audio_context;
}

/** Anropas vid användarinteraktion så att ljud får spelas när svaret kommer senare. */
export function unlock_ai_chat_reply_audio(): void {
    const ctx = get_audio_context();
    if (!ctx || ctx.state !== 'suspended') return;
    ctx.resume().catch(() => {});
}

function schedule_chime_tone(
    ctx: AudioContext,
    gain: GainNode,
    frequency_hz: number,
    start_at: number,
    duration_s: number
): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency_hz, start_at);
    osc.connect(gain);
    osc.start(start_at);
    osc.stop(start_at + duration_s);
}

function play_chime_on_context(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    schedule_chime_tone(ctx, gain, 880, now, 0.22);
    schedule_chime_tone(ctx, gain, 1318.5, now + 0.1, 0.35);
}

/** Spelar ett kort pling-ljud när ett chatsvar är färdigt. */
export function play_ai_chat_reply_chime(): void {
    try {
        const ctx = get_audio_context();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => play_chime_on_context(ctx)).catch(() => {});
            return;
        }
        play_chime_on_context(ctx);
    } catch {
        // Ljud är valfritt – tyst fel om webbläsaren blockerar.
    }
}
