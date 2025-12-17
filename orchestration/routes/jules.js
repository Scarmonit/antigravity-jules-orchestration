/**
 * Jules API Routes
 * Express routes for Antigravity-Jules integration
 */

const express = require('express');
const router = express.Router();
const { createSession, listSessions } = require('../../scripts/jules-auto');

/**
 * Middleware: Verify Jules API key
 * IMPORTANT: Must be defined BEFORE routes to protect all endpoints
 */
router.use((req, res, next) => {
  const apiKey = req.headers['x-jules-api-key'] || process.env.JULES_API_KEY;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'X-Jules-API-Key header or JULES_API_KEY environment variable required'
    });
  }

  // Store API key on request object (not mutating global process.env)
  req.julesApiKey = apiKey;
  next();
});

/**
 * POST /api/jules/create
 * Create a new Jules coding session
 */
router.post('/create', async (req, res) => {
  try {
    const { repository, task, branch, autoApprove } = req.body;

    // Validate required parameters
    if (!repository) {
      return res.status(400).json({
        error: 'Missing required parameter: repository',
        message: 'Repository must be provided in owner/repo format'
      });
    }

    if (!task) {
      return res.status(400).json({
        error: 'Missing required parameter: task',
        message: 'Task description must be provided'
      });
    }

    // Create session configuration
    const config = {
      repository,
      task,
      branch: branch || 'main',
      autoApprove: autoApprove || false
    };

    console.log('🚀 Creating Jules session via API:', config);

    // Call Jules API wrapper
    const session = await createSession(config);

    res.status(201).json({
      success: true,
      session,
      message: 'Jules session created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating Jules session:', error);
    res.status(500).json({
      error: 'Failed to create session',
      message: error.message
    });
  }
});

/**
 * GET /api/jules/list
 * List all active Jules sessions
 */
router.get('/list', async (req, res) => {
  try {
    console.log('📋 Fetching active Jules sessions...');

    const sessions = await listSessions();

    res.status(200).json({
      success: true,
      sessions: sessions.sessions || [],
      count: sessions.sessions?.length || 0
    });

  } catch (error) {
    console.error('❌ Error listing Jules sessions:', error);
    res.status(500).json({
      error: 'Failed to list sessions',
      message: error.message
    });
  }
});

/**
 * GET /api/jules/status/:sessionId
 * Get status of a specific Jules session
 */
router.get('/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing required parameter: sessionId'
      });
    }

    console.log(`🔍 Fetching status for session: ${sessionId}`);

    // This would call Jules API to get session status
    // For now, return a placeholder
    res.status(200).json({
      success: true,
      sessionId,
      status: 'active',
      message: 'Session status endpoint - implementation pending'
    });

  } catch (error) {
    console.error('❌ Error getting session status:', error);
    res.status(500).json({
      error: 'Failed to get session status',
      message: error.message
    });
  }
});

module.exports = router;
