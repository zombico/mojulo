#!/usr/bin/env node
/**
 * Generate a minimal mojulo app that exercises one primitive end-to-end via
 * agent-routed inference. No hosted LLM API keys required — the Claude Code
 * agent IS the inference engine (run-inference-worker catalyst).
 *
 * Usage:
 *   node scripts/gen-app.js --name <name> --primitive <type> [--out <dir>] [--wire]
 *
 * Primitives:
 *   document-store          File/document namespace (Drive, Notion, Dropbox…)
 *   structured-record-store Typed records (Linear, HubSpot, Airtable…)
 *   messaging-channel       Broadcast channel (Slack, Discord, Teams…)
 *   message-thread          Directed email threads (Gmail, Outlook…)
 *
 * Flags:
 *   --name <n>      App slug — letters, digits, dashes (required)
 *   --primitive <t> Which primitive to wire (required)
 *   --out <path>    Absolute output directory (default: data/apps/<name>)
 *   --wire          Bake MOJULO_CONTROL_PLANE_URL/KEY into the app's .env
 *                   using the current process.env.CONTROL_PLANE_MCP_KEY
 *
 * After generation:
 *   1. cd <out> && npm install            (install app-mcp deps)
 *   2. start_app in Claude Code, or:
 *        APP_MCP_BEARER=<from .env> node app-mcp/server.js &
 *        node server.js
 *   3. In your Claude Code session run:
 *        /loop /get_catalyst run-inference-worker
 *   4. POST http://localhost:<port>/infer  {"text":"<your input>"}
 */

import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installScaffold } from '../lib/app-mcp-scaffold/install.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const VALID_PRIMITIVES = [
  'document-store',
  'structured-record-store',
  'messaging-channel',
  'message-thread',
];

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { name: null, primitive: null, out: null, wire: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) result.name = args[++i];
    else if (args[i] === '--primitive' && args[i + 1]) result.primitive = args[++i];
    else if (args[i] === '--out' && args[i + 1]) result.out = args[++i];
    else if (args[i] === '--wire') result.wire = true;
  }
  return result;
}

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error(
    'Usage: node scripts/gen-app.js --name <name> --primitive <type> [--out <dir>] [--wire]\n' +
    `Primitives: ${VALID_PRIMITIVES.join(', ')}`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Per-primitive protocol context strings
// ---------------------------------------------------------------------------

const PRIMITIVE_CONTEXTS = {
  'document-store': `\
You are acting as a document-store primitive reader. The user has submitted text content \
from a document-store source (e.g. Drive, Notion, Dropbox). Your job is to extract key \
information from the submitted text and return a structured answer. \
Include a short summary in the 'answer' field describing the document's main topic and \
any notable metadata you can infer (title, type, approximate length, key themes).`,

  'structured-record-store': `\
You are acting as a structured-record-store primitive reader. The user has submitted a \
JSON record from a structured-record-store source (e.g. Linear issue, HubSpot contact, \
Airtable row). Your job is to interpret the record and return a structured answer. \
In the 'answer' field, describe the record type, its status or stage if present, and \
the single most important action that should be taken on it next.`,

  'messaging-channel': `\
You are acting as a messaging-channel primitive reader. The user has submitted a message \
from a broadcast channel (e.g. Slack, Discord, Teams). Your job is to interpret the \
message and return a structured answer. In the 'answer' field, summarise the message \
intent and suggest up to two concise follow-up responses that would be appropriate to \
post in the channel. Keep each suggestion under 20 words.`,

  'message-thread': `\
You are acting as a message-thread primitive reader. The user has submitted an email \
thread (subject + body). Your job is to draft a reply and return it as the 'answer'. \
The reply must be ready to send: professional, concise (≤120 words), and directly \
address the main ask in the thread. Do not include a greeting line.`,
};

// ---------------------------------------------------------------------------
// Generated app server.js (primitive-aware, no external npm deps)
// ---------------------------------------------------------------------------

function serverTemplate(name, primitive) {
  const protocolCtx = PRIMITIVE_CONTEXTS[primitive]
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`');

  return `\
// ${name} — minimal mojulo app exercising the ${primitive} primitive.
// Agent-routed inference: no LLM API keys required in this process.
// The Claude Code worker (run-inference-worker catalyst) fulfils requests.
//
// POST /infer  { "text": "<your input>" }
// GET  /       → app info + readiness

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env before touching process.env
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dirname, '.env'), 'utf8');
  for (const line of env.split('\\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\\s*=\\s*(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env absent — rely on process.env */ }

const { runProtocolEnvelope } = await import('./app-mcp/lib/envelope-client.js');

const PORT = Number(process.env.APP_PORT || 0);
const HOST = process.env.APP_HOST || '127.0.0.1';

const CONTROL_PLANE_URL = process.env.MOJULO_CONTROL_PLANE_URL || 'http://127.0.0.1:3001';
const CONTROL_PLANE_KEY = process.env.MOJULO_CONTROL_PLANE_KEY || '';
const APP_REF           = process.env.MOJULO_APP_REF || 'local:${name}';

const PRIMITIVE = '${primitive}';
const PROTOCOL_CONTEXT = \`${protocolCtx}\`;

// Minimal JSON body reader
async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');

  // GET / — readiness + info
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({
      app: '${name}',
      primitive: PRIMITIVE,
      inference: 'agent-routed',
      worker_hint: 'Run /loop /get_catalyst run-inference-worker in Claude Code',
      endpoints: { infer: 'POST /infer  { "text": "<your input>" }' },
    }, null, 2));
  }

  // POST /infer — main primitive exercise endpoint
  if (req.method === 'POST' && url.pathname === '/infer') {
    let body;
    try { body = await readBody(req); }
    catch (err) {
      res.writeHead(err.status || 400, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      res.writeHead(400, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'body.text is required' }));
    }

    if (!CONTROL_PLANE_KEY) {
      res.writeHead(503, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'MOJULO_CONTROL_PLANE_KEY not set. Add it to .env or pass --wire when generating.',
      }));
    }

    try {
      const result = await runProtocolEnvelope({
        baseUrl: CONTROL_PLANE_URL,
        bearer: CONTROL_PLANE_KEY,
        callerRef: APP_REF,
        inputs: { text },
        protocol_context: PROTOCOL_CONTEXT,
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ primitive: PRIMITIVE, ...result }));
    } catch (err) {
      const status = err.code === 'NO_AGENT_WORKER' ? 503
                   : err.code === 'INFERENCE_TIMEOUT' ? 504
                   : err.code === 'INFERENCE_CANCELLED' ? 422
                   : 500;
      res.writeHead(status, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message, code: err.code }));
    }
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, HOST, () => {
  const addr = server.address();
  const url = \`http://\${addr.address}:\${addr.port}\`;
  console.log(\`[\${PRIMITIVE}] \${url}\`);
  // Runner watches for this line to discover the app URL.
  console.log(\`APP_URL=\${url}\`);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
`;
}

// ---------------------------------------------------------------------------
// Generated package.json for the app root (not the sidecar)
// ---------------------------------------------------------------------------

function packageJsonTemplate(name) {
  return JSON.stringify(
    {
      name: `${name}-app`,
      version: '0.1.0',
      private: true,
      type: 'module',
      description: `Minimal mojulo app — generated by gen-app.js`,
      scripts: { start: 'node server.js' },
    },
    null,
    2,
  ) + '\n';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { name, primitive, out, wire } = parseArgs(process.argv);

  if (!name) usage('--name is required');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(name)) usage('--name must be alphanumeric with optional dashes');
  if (!primitive) usage('--primitive is required');
  if (!VALID_PRIMITIVES.includes(primitive)) usage(`unknown primitive "${primitive}"`);

  const scriptDir = resolve(__dirname, '..');         // control/
  const defaultOut = resolve(scriptDir, 'data', 'apps', name);
  const targetDir = out ? resolve(out) : defaultOut;

  console.log(`\n📦 Generating ${name} (${primitive})`);
  console.log(`   Output: ${targetDir}`);

  // 1. Create output directory
  if (existsSync(targetDir)) {
    console.warn(`   ⚠️  Directory already exists — scaffold will reuse existing .env/bearer`);
  } else {
    mkdirSync(targetDir, { recursive: true });
    console.log('   ✓ Created output directory');
  }

  // 2. Write package.json
  writeFileSync(resolve(targetDir, 'package.json'), packageJsonTemplate(name));
  console.log('   ✓ Wrote package.json');

  // 3. Write server.js
  writeFileSync(resolve(targetDir, 'server.js'), serverTemplate(name, primitive));
  console.log('   ✓ Wrote server.js');

  // 4. Install app-mcp scaffold (idempotent)
  const materializationRef = `generic:${targetDir}`;
  const scaffoldResult = installScaffold({
    targetDir,
    appName: name,
    materializationRef,
    declaredPurpose: `Minimal ${primitive} primitive demo — agent-routed inference`,
    wireControlPlaneKey: wire,
  });
  console.log(
    scaffoldResult.reused
      ? '   ✓ Scaffold reused (already installed)'
      : '   ✓ Scaffold installed (app-mcp/)',
  );
  if (scaffoldResult.bearerGenerated) {
    console.log(`   ✓ APP_MCP_BEARER minted → ${scaffoldResult.envPath}`);
  }
  if (wire) {
    if (scaffoldResult.controlPlaneKeyWired) {
      console.log('   ✓ MOJULO_CONTROL_PLANE_KEY wired into .env');
    } else {
      console.warn(
        '   ⚠️  --wire requested but CONTROL_PLANE_MCP_KEY not set in environment — ' +
        'add MOJULO_CONTROL_PLANE_KEY to the app .env manually',
      );
    }
  }

  // 5. Print next steps
  console.log('\n── Next steps ──────────────────────────────────────────────');
  console.log(`  1. cd ${targetDir}`);
  if (!wire) {
    console.log('  2. Add to .env:');
    console.log('       MOJULO_CONTROL_PLANE_URL=http://127.0.0.1:3001');
    console.log('       MOJULO_CONTROL_PLANE_KEY=<value of CONTROL_PLANE_MCP_KEY from control/.env>');
  }
  console.log(`  ${wire ? 2 : 3}. npm install`);
  console.log(`  ${wire ? 3 : 4}. Via Claude Code: start_app({ artifact_ref: "${targetDir}", app_name: "${name}", materialization_ref: "${materializationRef}" })`);
  console.log(`     Or manually: APP_MCP_BEARER=$(grep APP_MCP_BEARER .env | cut -d= -f2) node app-mcp/server.js & npm start`);
  console.log(`  ${wire ? 4 : 5}. In Claude Code: /loop /get_catalyst run-inference-worker`);
  console.log(`  ${wire ? 5 : 6}. curl -X POST http://localhost:<port>/infer -H 'content-type: application/json' -d '{"text":"hello"}'`);
  console.log('─────────────────────────────────────────────────────────────\n');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
