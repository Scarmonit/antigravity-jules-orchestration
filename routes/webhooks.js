import express from 'express';
import { handleWebhook as handleRenderWebhook } from '../lib/render-autofix.js';

export default function createWebhookRoutes({ createJulesSession, julesRequest }) {
    const router = express.Router();

    // Render webhook for build failure auto-fix
    router.post('/render', async (req, res, next) => {
        console.log('[Webhook] Received Render webhook');

        try {
            const result = await handleRenderWebhook(
                req,
                createJulesSession,
                (sessionId, msg) => julesRequest('POST', `/sessions/${sessionId}:sendMessage`, msg)
            );

            res.status(result.status || 200).json(result);
        } catch (error) {
            console.error('[Webhook] Error:', error.message);
            next(error);
        }
    });

    return router;
}
