// orchestrator-api/src/index.js
import express from 'express';
import pg from 'pg';
import axios from 'axios';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { GoogleAuth } from 'google-auth-library';
import * as metrics from './metrics.js';

const app = express();

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// 1. Middleware: JSON parsing MUST be first
app.use(express.json());

// Config
const JULES_API_KEY = process.env.JULES_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const PORT = process.env.PORT || 3000;

// Initialize database (optional - graceful fallback)
let db = null;
if (DATABASE_URL) {
  db = new pg.Pool({ connectionString: DATABASE_URL });
  console.log('Database configured');
}

// Metrics Endpoint
app.get('/api/v1/metrics', async (req, res) => {
  res.set('Content-Type', metrics.registerContentType);
  res.end(await metrics.getMetrics());
});

// Jules API client (Simple Auth for Stability)
const julesClient = axios.create({
  baseURL: 'https://jules.googleapis.com/v1alpha',
  headers: { 
    'Content-Type': 'application/json'
  }
});

// Add auth interceptor
julesClient.interceptors.request.use((config) => {
  if (JULES_API_KEY) {
    config.headers.Authorization = 'Bearer ' + JULES_API_KEY;
  }
  console.log('[Jules Client] Requesting ' + config.url);
  return config;
});

// GitHub API client
const githubClient = axios.create({
  baseURL: 'https://api.github.com',
  headers: { 
    'Accept': 'application/vnd.github+json'
  }
});

githubClient.interceptors.request.use((config) => {
  if (GITHUB_TOKEN) {
    config.headers.Authorization = 'Bearer ' + GITHUB_TOKEN;
  }
  return config;
});

// Root Endpoint (Service Metadata)
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Jules MCP Server',
    version: '1.5.0',
    deployedBy: 'Gemini-Final',
    capabilities: ['sessions', 'tasks', 'orchestration', 'mcp-protocol'],
    timestamp: new Date().toISOString()
  });
});

// Health Check
app.get(['/health', '/api/v1/health'], async (req, res) => {
  res.json({ 
    status: 'ok',
    version: '1.5.0',
    services: {
      database: db ? 'configured' : 'optional',
      julesApi: 'configured',
      githubApi: GITHUB_TOKEN ? 'configured' : 'not_configured'
    },
    timestamp: new Date().toISOString() 
  });
});

// MCP Tools List
app.get('/mcp/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: "jules_create_session",
        description: "Create a new Jules coding session",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Session name" },
            source: { type: "string", description: "Source repository (e.g., github.com/owner/repo)" }
          },
          required: ["source"]
        }
      },
      {
        name: "jules_list_sessions",
        description: "List active Jules sessions",
        inputSchema: {
          type: "object",
          properties: {
            pageSize: { type: "number" }
          }
        }
      },
      {
        name: "jules_get_session",
        description: "Get details of a specific session",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string" }
          },
          required: ["sessionId"]
        }
      }
    ]
  });
});

// MCP Tool Execution with input validation
app.post('/mcp/execute', async (req, res) => {
  const startTime = Date.now();
  console.log(`[${req.requestId}] MCP Execution Request`);

  const { name, arguments: args, tool, parameters } = req.body;

  // Support both MCP formats
  const toolName = name || tool;
  const toolArgs = args || parameters || {};

  // Input validation
  if (!toolName) {
    console.error(`[${req.requestId}] MCP Error: Missing tool name`);
    return res.status(400).json({
        error: 'Tool name required (use "name" or "tool" field)',
        requestId: req.requestId,
        hint: 'Ensure Content-Type is application/json'
    });
  }

  // Validate tool name format (alphanumeric and underscores only)
  if (!/^[a-z_][a-z0-9_]*$/i.test(toolName)) {
    return res.status(400).json({
      error: 'Invalid tool name format',
      requestId: req.requestId,
      hint: 'Tool names must be alphanumeric with underscores'
    });
  }
  
  try {
    let result;
    if (toolName === 'jules_create_session') {
      const response = await julesClient.post('/sessions', toolArgs);
      result = response.data;
    } else if (toolName === 'jules_list_sessions') {
      const response = await julesClient.get('/sessions');
      result = response.data;
    } else if (toolName === 'jules_get_session') {
      const response = await julesClient.get('/sessions/' + toolArgs.sessionId);
      result = response.data;
    } else {
      return res.status(404).json({ error: 'Tool ' + toolName + ' not found' });
    }
    
    res.json({ 
      success: true,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      result 
    });
  } catch (error) {
    console.error('MCP Execute Error (' + toolName + '):', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

// WebSocket Setup
const server = createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('WebSocket client connected');
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected');
  });
});

function broadcast(data) {
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
}

// GitHub Webhook Receiver
app.post('/api/v1/webhooks/github', async (req, res) => {
  const event = req.headers['x-github-event'];
  console.log('Received GitHub webhook: ' + event);
  
  broadcast({
    type: 'github_webhook',
    event,
    payload: req.body,
    timestamp: new Date().toISOString()
  });
  
  res.status(200).json({ received: true });
});

// Start server
server.listen(PORT, () => {
  console.log('Jules Orchestrator API running on port ' + PORT);
  console.log('Version: 1.5.0');
});