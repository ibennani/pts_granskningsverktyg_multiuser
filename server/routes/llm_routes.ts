/**
 * @file LLM-endpoints: tillgänglighet och chatt för inloggade användare, inställningar för admin.
 */

import express from 'express';
import { requireAdmin } from '../auth/middleware.js';
import { get_settings_for_api, get_settings_for_proxy, save_settings } from '../services/llm_settings_service.js';
import {
    get_llm_availability,
    get_llm_status,
    send_llm_chat,
    test_llm_connection
} from '../services/llm_proxy_service.js';
import { pipe_ollama_agent_stream } from '../services/llm_ollama_agent.js';
import { resolve_chat_timeout_ms, format_llm_chat_error } from '../services/llm_chat_timeout.js';
import { merge_abort_signals } from '../services/abort_signal_merge.js';
import { validate_chat_messages } from '../services/llm_chat_validation.js';
import { normalize_client_context } from '../services/llm_tool_context.js';
import type { Request, Response } from 'express';

type AuthedRequest = Request & {
    user?: { id: string; name?: string; is_admin?: boolean };
};

const router = express.Router();

router.get('/availability', async (_req: Request, res: Response) => {
    try {
        const saved = await get_settings_for_proxy();
        const availability = await get_llm_availability(saved);
        res.json({ ok: true, ...availability });
    } catch (err) {
        console.error('[llm] GET availability error:', err);
        res.status(500).json({ ok: false, available: false, enabled: false });
    }
});

router.post('/chat', async (req: Request, res: Response) => {
    try {
        const saved = await get_settings_for_proxy();
        const messages = validate_chat_messages(req.body?.messages);
        const result = await send_llm_chat(saved, messages);
        res.json({ ok: true, ...result });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Kunde inte skicka chattmeddelande';
        console.warn('[llm] POST chat error:', message);
        res.status(400).json({ error: message });
    }
});

router.post('/chat/stream', async (req: Request, res: Response) => {
    const client_abort = new AbortController();
    res.on('close', () => {
        if (!res.writableFinished) {
            client_abort.abort();
        }
    });
    try {
        const authed = req as AuthedRequest;
        if (!authed.user?.id || !authed.user?.name) {
            return res.status(401).json({ error: 'Inloggning krävs' });
        }
        const saved = await get_settings_for_proxy();
        const messages = validate_chat_messages(req.body?.messages);
        const timeout_ms = resolve_chat_timeout_ms(saved.timeout_ms);
        const abort_signal = merge_abort_signals([
            client_abort.signal,
            AbortSignal.timeout(timeout_ms)
        ]);
        await pipe_ollama_agent_stream(
            saved,
            messages,
            {
                user: {
                    id: authed.user.id,
                    name: authed.user.name,
                    is_admin: authed.user.is_admin === true
                },
                client: normalize_client_context(req.body?.context)
            },
            res,
            abort_signal
        );
    } catch (err) {
        const message = format_llm_chat_error(err);
        console.warn('[llm] POST chat/stream error:', message);
        if (res.headersSent) {
            res.end();
            return;
        }
        res.status(400).json({ error: message });
    }
});

router.use(requireAdmin);

router.get('/settings', async (_req: Request, res: Response) => {
    try {
        const settings = await get_settings_for_api();
        res.json({ ok: true, ...settings });
    } catch (err) {
        console.error('[llm] GET settings error:', err);
        res.status(500).json({ error: 'Kunde inte läsa AI-inställningar' });
    }
});

router.put('/settings', async (req: AuthedRequest, res: Response) => {
    try {
        const user_id = req.user?.id ?? null;
        const settings = await save_settings(req.body || {}, user_id);
        res.json({ ok: true, ...settings });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Kunde inte spara AI-inställningar';
        console.warn('[llm] PUT settings error:', message);
        res.status(400).json({ error: message });
    }
});

router.post('/settings/test', async (req: Request, res: Response) => {
    try {
        const saved = await get_settings_for_proxy();
        const result = await test_llm_connection(saved, req.body || {});
        res.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Anslutningstest misslyckades';
        console.warn('[llm] POST settings/test error:', message);
        res.status(400).json({ error: message });
    }
});

router.get('/status', async (_req: Request, res: Response) => {
    try {
        const saved = await get_settings_for_proxy();
        const result = await get_llm_status(saved);
        res.json({
            ...result,
            enabled: saved.enabled,
            configured_model: saved.model
        });
    } catch (err) {
        console.error('[llm] GET status error:', err);
        res.status(500).json({ error: 'Kunde inte hämta AI-status' });
    }
});

export default router;
