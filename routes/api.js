import express from 'express';
import { cacheMiddleware } from '../middleware/cacheMiddleware.js';

export default function createApiRoutes({ sessionMonitor }) {
    const router = express.Router();

    // Get active sessions
    router.get('/sessions/active', cacheMiddleware, async (req, res, next) => {
        try {
            if (!sessionMonitor) {
                return res.status(503).json({ error: 'Monitor not initialized' });
            }
            const active = await sessionMonitor.getActiveSessions();
            res.json({ sessions: active, count: active.length });
        } catch (error) {
            next(error);
        }
    });

    // Get session statistics
    router.get('/sessions/stats', cacheMiddleware, async (req, res, next) => {
        try {
            if (!sessionMonitor) {
                return res.status(503).json({ error: 'Monitor not initialized' });
            }
            const stats = await sessionMonitor.getStats();
            res.json(stats);
        } catch (error) {
            next(error);
        }
    });

    // Get session timeline
    router.get('/sessions/:id/timeline', async (req, res, next) => {
        try {
            if (!sessionMonitor) {
                return res.status(503).json({ error: 'Monitor not initialized' });
            }
            const timeline = await sessionMonitor.getSessionTimeline(req.params.id);
            res.json(timeline);
        } catch (error) {
            next(error);
        }
    });

    return router;
}
