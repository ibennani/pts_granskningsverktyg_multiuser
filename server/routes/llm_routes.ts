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
import { validate_chat_messages } from '../services/llm_chat_validation.js';
import type { Request, Response } from 'express';

type AuthedRequest = Request & { user?: { id: string; is_admin?: boolean } };

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
