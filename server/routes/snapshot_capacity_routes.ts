/**
 * @fileoverview API för global snapshot-kapacitet.
 */
import express, { type Request, type Response, type Router } from 'express';
import { build_snapshot_capacity } from '../services/snapshot_capacity_service.js';

export function register_snapshot_capacity_routes(router: Router): void {
    router.get('/capacity', async (_req: Request, res: Response) => {
        try {
            const capacity = await build_snapshot_capacity();
            return res.json(capacity);
        } catch (err) {
            console.error('[snapshots] GET capacity error:', err);
            return res.status(500).json({ error: 'Kunde inte hämta snapshot-kapacitet' });
        }
    });
}

export function create_snapshot_capacity_router(): Router {
    const router = express.Router();
    register_snapshot_capacity_routes(router);
    return router;
}
