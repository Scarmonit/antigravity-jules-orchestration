import express from 'express';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const PORT = process.env.PORT || 3323;
const JULES_API_KEY = process.env.JULES_API_KEY;
const VERSION = '1.4.0';

const app = express();
app.use(express.json());

// CORS middleware for browser clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Root endpoint - service metadata
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Jules MCP Server',
    version: VERSION,
    timestamp: new Date().toISOString(),
    capabilities: ['sessions', 'tasks', 'orchestration', 'mcp-protocol', 'sources'],
    authMethod: 'api-key',
    endpoints: {
      health: '/health',
      tools: '/mcp/tools',
      execute: '/mcp/execute'
    }
  });
});

// Health check endpoint (required by Render)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKeyConfigured: !!JULES_API_KEY,
    version: VERSION,
    timestamp: new Date().toISOString()
  });
});

// Extended health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    version: VERSION,
    services: {
      julesApi: JULES_API_KEY ? 'configured' : 'not configured',
      database: 'not required'
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// MCP Protocol - List available tools
app.get('/mcp/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: 'jules_list_sources',
        description: 'List all connected GitHub repositories (sources)',
        parameters: {}
      },
      {
        name: 'jules_create_session',
        description: 'Create a new Jules coding session for autonomous development',
        parameters: {
          prompt: { type: 'string', required: true, description: 'Task description/prompt for Jules' },
          source: { type: 'string', required: true, description: 'Source name (e.g., sources/github/owner/repo)' },
          branch: { type: 'string', required: false, description: 'Starting branch (default: repo default)' },
          title: { type: 'string', required: false, description: 'Session title' },
          requirePlanApproval: { type: 'boolean', required: false, description: 'Require approval before execution' },
          automationMode: { type: 'string', required: false, description: 'AUTO_CREATE_PR or NONE' }
        }
      },
      {
        name: 'jules_list_sessions',
        description: 'List all Jules sessions',
        parameters: {}
      },
      {
        name: 'jules_get_session',
        description: 'Get details of a specific session',
        parameters: {
          sessionId: { type: 'string', required: true, description: 'Session ID to retrieve' }
        }
      },
      {
        name: 'jules_send_message',
        description: 'Send a message to an existing Jules session',
        parameters: {
          sessionId: { type: 'string', required: true, description: 'Session ID' },
          message: { type: 'string', required: true, description: 'Message to send' }
        }
      },
      {
        name: 'jules_approve_plan',
        description: 'Approve a session plan to allow execution',
        parameters: {
          sessionId: { type: 'string', required: true, description: 'Session ID to approve' }
        }
      },
      {
        name: 'jules_get_activities',
        description: 'Get activities/events for a session',
        parameters: {
          sessionId: { type: 'string', required: true, description: 'Session ID' }
        }
      }
    ]
  });
});

// MCP Protocol - Execute tool
app.post('/mcp/execute', async (req, res) => {
  const { tool, parameters = {} } = req.body;

  if (!tool) {
    return res.status(400).json({ error: 'Tool name required' });
  }

  if (!JULES_API_KEY) {
    return res.status(500).json({ error: 'JULES_API_KEY not configured' });
  }

  console.log('[MCP] Executing tool:', tool, parameters);

  try {
    let result;
    switch (tool) {
      case 'jules_list_sources':
        result = await julesRequest('GET', '/sources');
        break;
      case 'jules_create_session':
        result = await createJulesSession(parameters);
        break;
      case 'jules_list_sessions':
        result = await julesRequest('GET', '/sessions');
        break;
      case 'jules_get_session':
        result = await julesRequest('GET', '/sessions/' + parameters.sessionId);
        break;
      case 'jules_send_message':
        result = await julesRequest('POST', '/sessions/' + parameters.sessionId + ':sendMessage', {
          message: parameters.message
        });
        break;
      case 'jules_approve_plan':
        result = await julesRequest('POST', '/sessions/' + parameters.sessionId + ':approvePlan', {});
        break;
      case 'jules_get_activities':
        result = await julesRequest('GET', '/sessions/' + parameters.sessionId + '/activities');
        break;
      default:
        return res.status(400).json({ error: 'Unknown tool: ' + tool });
    }
    console.log('[MCP] Tool', tool, 'completed successfully');
    res.json({ success: true, result });
  } catch (error) {
    console.error('[MCP] Tool', tool, 'failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Jules API helper - make authenticated request
function julesRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'jules.googleapis.com',
      port: 443,
      path: '/v1alpha' + path,
      method: method,
      headers: {
        'X-Goog-Api-Key': JULES_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    console.log('[Jules API]', method, path);

    const req = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          console.error('[Jules API] Error', response.statusCode + ':', data);
          reject(new Error('Jules API error: ' + response.statusCode + ' - ' + data));
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Jules API] Request error:', err.message);
      reject(err);
    });

    if (body) {
      const jsonBody = JSON.stringify(body);
      req.setHeader('Content-Length', Buffer.byteLength(jsonBody));
      req.write(jsonBody);
    }
    req.end();
  });
}

// Create a new Jules session with correct API schema
async function createJulesSession(config) {
  const sessionData = {
    prompt: config.prompt,
    sourceContext: {
      source: config.source
    }
  };

  // Add optional fields
  if (config.branch) {
    sessionData.sourceContext.githubRepoContext = {
      startingBranch: config.branch
    };
  }
  if (config.title) {
    sessionData.title = config.title;
  }
  if (config.requirePlanApproval !== undefined) {
    sessionData.requirePlanApproval = config.requirePlanApproval;
  }
  if (config.automationMode) {
    sessionData.automationMode = config.automationMode;
  }

  console.log('[Jules API] Creating session:', JSON.stringify(sessionData, null, 2));
  return await julesRequest('POST', '/sessions', sessionData);
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('Jules MCP Server v' + VERSION + ' running on port ' + PORT);
  console.log('Health check: http://localhost:' + PORT + '/health');
  console.log('MCP Tools: http://localhost:' + PORT + '/mcp/tools');
  console.log('Jules API Key configured: ' + (JULES_API_KEY ? 'Yes' : 'No'));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
