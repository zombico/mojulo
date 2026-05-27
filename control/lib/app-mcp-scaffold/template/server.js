// App-MCP sidecar — HTTP + bearer transport, MCP JSON-RPC dispatch.
//
// Each materialized app ships a copy of this file. The runner spawns it
// alongside `npm start` on app launch; mojulo's connecting agent then sees
// the app's MCP tools alongside vendor MCPs in declared inventory.
//
// Configuration (read from process.env, populated by the runner from .env):
//   APP_MCP_BEARER   — required; bearer token the connecting agent presents
//   APP_MCP_PORT     — optional; runner allocates one if absent (default 0)
//   APP_MCP_HOST     — optional; defaults to 127.0.0.1 (loopback only)
//
// MCP protocol surface implemented:
//   initialize, ping, tools/list, tools/call, notifications/initialized
//
// Add app-specific tools by following _agent_extend.md.

import { createServer } from 'node:http';
import { describeTool } from './tools/describe.js';
import { healthTool } from './tools/health.js';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'mojulo-app-mcp';
const SERVER_VERSION = '0.1.0';

const BEARER = process.env.APP_MCP_BEARER;
const HOST = process.env.APP_MCP_HOST || '127.0.0.1';
const PORT = Number(process.env.APP_MCP_PORT || 0);

if (!BEARER) {
  console.error(
    '[app-mcp] APP_MCP_BEARER not set — refusing to start. The runner injects this from the artifact\'s .env at start_app time.',
  );
  process.exit(1);
}

// Tool registry. Insertion order is what tools/list returns — keep describe
// first so a connecting agent sees the orientation tool at the top.
const registeredTools = new Map();
function registerTool(tool) {
  if (!tool || !tool.name || typeof tool.handler !== 'function') {
    throw new Error('registerTool requires { name, description, inputSchema, handler }');
  }
  registeredTools.set(tool.name, tool);
}

registerTool(describeTool);
registerTool(healthTool);

// AGENT EXTENSION POINT — see _agent_extend.md. Import your tools and call
// registerTool() here. Example:
//   import { listExtractionsTool } from './tools/list-extractions.js';
//   registerTool(listExtractionsTool);

// Exposed so describe.js can enumerate without re-importing this module.
export function listRegisteredTools() {
  return Array.from(registeredTools.values()).map((t) => ({
    name: t.name,
    description: t.description || '',
    inputSchema: t.inputSchema || { type: 'object', properties: {} },
  }));
}

function jsonRpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

async function dispatch(message) {
  if (!message || message.jsonrpc !== '2.0') {
    return jsonRpcError(message?.id ?? null, ErrorCodes.INVALID_REQUEST, 'Invalid JSON-RPC request');
  }
  const isNotification = message.id === undefined || message.id === null;
  try {
    switch (message.method) {
      case 'initialize':
        return isNotification
          ? null
          : jsonRpcResult(message.id, {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: { tools: { listChanged: false } },
              serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
            });
      case 'notifications/initialized':
      case 'initialized':
        return null;
      case 'ping':
        return isNotification ? null : jsonRpcResult(message.id, {});
      case 'tools/list':
        return jsonRpcResult(message.id, { tools: listRegisteredTools() });
      case 'tools/call': {
        const params = message.params || {};
        const tool = registeredTools.get(params.name);
        if (!tool) {
          return jsonRpcError(
            message.id,
            ErrorCodes.METHOD_NOT_FOUND,
            `Unknown tool: ${params.name}`,
          );
        }
        try {
          const result = await tool.handler(params.arguments || {});
          return jsonRpcResult(message.id, toMcpToolResult(result));
        } catch (err) {
          return jsonRpcResult(message.id, {
            content: [{ type: 'text', text: err.message || 'Tool execution failed' }],
            isError: true,
          });
        }
      }
      default:
        if (isNotification) return null;
        return jsonRpcError(
          message.id,
          ErrorCodes.METHOD_NOT_FOUND,
          `Method not found: ${message.method}`,
        );
    }
  } catch (err) {
    console.error('[app-mcp] dispatch error:', err);
    if (isNotification) return null;
    return jsonRpcError(message.id, ErrorCodes.INTERNAL_ERROR, err.message || 'Internal error');
  }
}

function toMcpToolResult(result) {
  if (result && typeof result === 'object' && Array.isArray(result.content)) return result;
  const text = typeof result === 'string' ? result : JSON.stringify(result ?? {}, null, 2);
  return { content: [{ type: 'text', text }] };
}

function checkAuth(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return false;
  return header.slice('Bearer '.length).trim() === BEARER;
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  // CORS preflight: deny by default — sidecar serves the mojulo agent only,
  // not arbitrary browsers. The app's own SPA reaches the LLM primitive via
  // the control plane, not via this sidecar.
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ error: 'POST only' }));
  }
  if (!checkAuth(req)) {
    res.statusCode = 401;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    return res.end(
      JSON.stringify(jsonRpcError(null, ErrorCodes.PARSE_ERROR, 'Invalid JSON')),
    );
  }
  const reply = await dispatch(body);
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  if (reply === null) return res.end(); // notification — no body
  res.end(JSON.stringify(reply));
});

server.listen(PORT, HOST, () => {
  const addr = server.address();
  // Print the resolved URL on stdout so the runner can parse it back without
  // racing the OS port allocation. Format is intentionally minimal: the
  // runner does a startsWith match, not a regex.
  const url = `http://${addr.address}:${addr.port}`;
  console.log(`[app-mcp] listening on ${url}`);
  // Also surface a stable line the runner watches for ready-state.
  console.log(`APP_MCP_URL=${url}`);
});

// Graceful shutdown on SIGTERM (runner stops via signal).
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}
