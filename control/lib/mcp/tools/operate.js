/**
 * MCP Ring 2 — operate / read tools.
 *
 * Lets the user's Claude reason over deployed bot state without exposing new
 * HTTP endpoints from the control plane. Reads either hit local SQLite
 * (deployment metadata) or pass through bot-proxy to the bot's own SQLite
 * (conversations, submissions, chain verification) — preserving the
 * "conversation data never leaves the bot's SQLite" invariant.
 */

import { promises as fsp } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DeploymentRepository } from '@/lib/db/repositories/deployments';
import { fetchFromBot } from '@/lib/deployers/bot-proxy';
import { registerTool } from '@/lib/mcp/server';

function summarizeDeployment(d) {
  if (!d) return null;
  return {
    id: d.id,
    botName: d.botName,
    status: d.status,
    url: d.url || null,
    lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
    configHash: d.configHash || null,
    lastBuiltHash: d.lastBuiltHash || null,
    ragMode: d.ragMode,
    embeddingChunkCount: d.embeddingChunkCount,
    cloud: d.cloudProvider
      ? {
          provider: d.cloudProvider,
          status: d.cloudStatus,
          url: d.cloudUrl,
          appName: d.cloudAppName,
          lastDeployedAt: d.cloudLastDeployedAt ? d.cloudLastDeployedAt.toISOString() : null,
        }
      : null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

async function listDeploymentsHandler(input, _ctx) {
  const { status, mode, limit = 50, offset = 0 } = input || {};
  const all = await DeploymentRepository.list();
  let filtered = all;
  if (status) {
    filtered = filtered.filter((d) => d.status === status);
  }
  if (mode === 'cloud') {
    filtered = filtered.filter((d) => !!d.cloudProvider);
  } else if (mode === 'local') {
    filtered = filtered.filter((d) => !d.cloudProvider);
  }
  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit).map(summarizeDeployment);
  return { total, limit, offset, deployments: page };
}

function redactConfigCredentials(config) {
  if (!config || typeof config !== 'object') return config;
  const llm = config.llm;
  if (!llm || typeof llm !== 'object') return config;
  const redactedLlm = {};
  for (const [key, providerConfig] of Object.entries(llm)) {
    // `provider` is a scalar discriminator ("anthropic" | "openai" | ...).
    // The per-provider entries are the objects that carry credentials.
    if (!providerConfig || typeof providerConfig !== 'object') {
      redactedLlm[key] = providerConfig;
      continue;
    }
    const next = { ...providerConfig };
    if ('apiKey' in next) next.apiKey = next.apiKey ? '[redacted]' : '';
    if ('accessKeyId' in next && next.accessKeyId) next.accessKeyId = '[redacted]';
    if ('secretAccessKey' in next && next.secretAccessKey) next.secretAccessKey = '[redacted]';
    redactedLlm[key] = next;
  }
  return { ...config, llm: redactedLlm };
}

async function getDeploymentHandler(input, _ctx) {
  const { id } = input || {};
  if (!id) throw new Error('id is required');
  const dep = await DeploymentRepository.findById(id);
  if (!dep) throw new Error(`Deployment not found: ${id}`);
  const summary = summarizeDeployment(dep);
  return {
    ...summary,
    config: redactConfigCredentials(dep.config),
    botSummary: dep.config?.botSummary || null,
    documentIds: dep.documentIds,
  };
}

async function loadConnectedDeployment(id) {
  if (!id) throw new Error('id is required');
  const dep = await DeploymentRepository.findById(id);
  if (!dep) throw new Error(`Deployment not found: ${id}`);
  if (!dep.url) throw new Error(`Deployment ${id} has no URL — bot is not connected`);
  return dep;
}

async function proxyJson(dep, path, opts) {
  let response;
  try {
    response = await fetchFromBot(dep, path, opts);
  } catch (err) {
    throw new Error(`Could not reach bot: ${err.message || err.name}`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Bot returned ${response.status}: ${text.slice(0, 200)}`
    );
  }
  await DeploymentRepository.touchLastSeen(dep.id).catch(() => {});
  return response.json();
}

// Both list and full-dump flows hit /api/conversations/export rather than
// /api/conversations. The list endpoint has a guardrail that returns 0 rows
// unless conversationId / startDate / endDate is provided, which surfaced as
// "0 results but the bot clearly has conversations" through MCP.
async function fetchExport(dep, { startDate, endDate }) {
  const qs = new URLSearchParams();
  if (startDate) qs.set('startDate', String(startDate));
  if (endDate) qs.set('endDate', String(endDate));
  const path = `/api/conversations/export${qs.toString() ? `?${qs.toString()}` : ''}`;
  return proxyJson(dep, path, { timeoutMs: 60000 });
}

async function queryConversationsHandler(input, _ctx) {
  const { id, since, until } = input || {};
  const dep = await loadConnectedDeployment(id);
  const data = await fetchExport(dep, { startDate: since, endDate: until });
  const conversations = (Array.isArray(data) ? data : []).map((c) => ({
    conversationId: c.conversationId,
    startedAt: c.startedAt,
    lastActivity: c.lastActivity,
    turnCount: c.turnCount,
  }));
  return { botName: dep.botName, total: conversations.length, conversations };
}

// The bot's /api/conversations/:id endpoint emits raw snake_case columns, while
// /api/conversations/export hand-maps to camelCase. Normalize the by-id turn
// shape so consumers see one casing across both tools.
function normalizeTurn(t) {
  if (!t || typeof t !== 'object') return t;
  return {
    id: t.id,
    conversationId: t.conversation_id,
    turn: t.turn,
    timestamp: t.timestamp,
    userPrompt: t.user_prompt,
    llmResponse: t.llm_response,
    machineState: t.machine_state,
    ragContext: t.rag_context,
    contentHash: t.content_hash,
    chainHash: t.chain_hash,
    eventType: t.event_type,
    handoffHash: t.handoff_hash,
  };
}

async function getConversationHandler(input, _ctx) {
  const { id, conversationId } = input || {};
  if (!conversationId) throw new Error('conversationId is required');
  const dep = await loadConnectedDeployment(id);
  const data = await proxyJson(dep, `/api/conversations/${encodeURIComponent(conversationId)}`);
  return {
    ...data,
    turns: Array.isArray(data?.turns) ? data.turns.map(normalizeTurn) : data?.turns,
  };
}

async function exportConversationsHandler(input, _ctx) {
  const { id, startDate, endDate } = input || {};
  const dep = await loadConnectedDeployment(id);
  const data = await fetchExport(dep, { startDate, endDate });
  return { botName: dep.botName, conversations: data };
}

async function querySubmissionsHandler(input, _ctx) {
  const { id, limit, offset, since, until } = input || {};
  const dep = await loadConnectedDeployment(id);
  const qs = new URLSearchParams();
  if (limit != null) qs.set('limit', String(limit));
  if (offset != null) qs.set('offset', String(offset));
  if (since) qs.set('since', String(since));
  if (until) qs.set('until', String(until));
  const path = `/api/forms${qs.toString() ? `?${qs.toString()}` : ''}`;
  const data = await proxyJson(dep, path);
  return { botName: dep.botName, ...data };
}

async function verifyChainHandler(input, _ctx) {
  const { id, conversationId } = input || {};
  if (!conversationId) throw new Error('conversationId is required');
  const dep = await loadConnectedDeployment(id);
  return proxyJson(dep, `/verify/${encodeURIComponent(conversationId)}`);
}

// Value-prefix patterns that mark a string as a secret to mask. Container
// .env values only — control-plane LLM keys live encrypted in api_keys and
// never get written to disk in plaintext by build flows (the mojulo-config
// bin manages them). The list intentionally errs toward common providers
// the user might paste into a bot .env after unzip.
const SECRET_VALUE_PREFIXES = [
  'sk-ant-',         // Anthropic
  'sk-proj-',        // OpenAI project
  'sk-',             // OpenAI / generic OAI-style
  'AKIA',            // AWS access key
  'ASIA',            // AWS temp access key
  'bot_',            // mojulo MOJULO_API_KEY (auto-generated per deploy)
  'fo1_',            // Fly.io
  'ghp_',            // GitHub personal access token
  'gho_',            // GitHub OAuth
  'github_pat_',     // GitHub PAT (newer)
  'xoxb-',           // Slack bot token
  'xoxp-',           // Slack user token
  'ya29.',           // Google OAuth access token
];

function looksLikeSecret(value) {
  if (!value || typeof value !== 'string') return false;
  return SECRET_VALUE_PREFIXES.some((p) => value.startsWith(p));
}

function maskSecret(value) {
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function parseEnvText(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith('#')) continue;
    const eq = stripped.indexOf('=');
    if (eq === -1) continue;
    const key = stripped.slice(0, eq).trim();
    let value = stripped.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out.push({ key, value });
  }
  return out;
}

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

async function resolveBotEnvPath({ deploymentId, envPath }) {
  if (envPath) {
    const resolved = path.resolve(expandHome(envPath));
    const base = path.basename(resolved);
    if (!base.startsWith('.env')) {
      throw new Error(
        `inspect_bot_env refuses to read non-.env files. Got basename "${base}".`
      );
    }
    return resolved;
  }
  if (!deploymentId) {
    throw new Error('inspect_bot_env requires either deploymentId or envPath');
  }
  const dep = await DeploymentRepository.findById(deploymentId);
  if (!dep) throw new Error(`Deployment not found: ${deploymentId}`);
  const artifactsDir =
    process.env.ARTIFACTS_DIR || path.join(process.cwd(), 'data', 'artifacts');
  // Staging dir convention from lib/deployers/docker.js — preserved
  // alongside the .zip after a successful build.
  return path.join(artifactsDir, `${dep.botName}-${deploymentId}`, '.env');
}

async function inspectBotEnvHandler(input, _ctx) {
  const target = await resolveBotEnvPath({
    deploymentId: input?.deploymentId,
    envPath: input?.path,
  });
  let text;
  try {
    text = await fsp.readFile(target, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `No .env file at ${target}. If the user unzipped the artifact elsewhere, pass the .env path explicitly.`
      );
    }
    throw err;
  }
  const raw = parseEnvText(text);
  const vars = raw.map(({ key, value }) => {
    if (looksLikeSecret(value)) {
      return {
        key,
        value: maskSecret(value),
        masked: true,
        valueLength: value.length,
      };
    }
    return { key, value, masked: false };
  });
  const maskedCount = vars.filter((v) => v.masked).length;
  return {
    path: target,
    vars,
    maskedCount,
    note: maskedCount
      ? 'Sensitive values are masked. Do not ask the user to paste the unmasked secret back into this conversation — read the user-visible config from disk via the user, not via the agent context.'
      : 'No sensitive values detected. If the user expected a secret to be present (e.g. an LLM provider key), they may still need to paste one into this .env before `docker compose up`.',
  };
}

export function registerOperateTools() {
  // Deployment metadata — always available. No transcript data, just rows
  // from the control plane's deployments table.
  registerTool({
    name: 'list_deployments',
    description:
      'List bots known to the control plane. Returns id, name, status, URL, connection state, and cloud metadata. Filter by status (saved | building | ready | stale | build_failed) or mode (local | cloud).',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by deployment status.' },
        mode: { type: 'string', enum: ['local', 'cloud'], description: 'Filter by local-only or cloud-deployed bots.' },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        offset: { type: 'integer', minimum: 0, default: 0 },
      },
    },
    handler: listDeploymentsHandler,
  });

  registerTool({
    name: 'get_deployment',
    description:
      'Get the full deployment row for one bot: identity, enabled protocols, generated configs, document ids, and cloud state. Reads from the control plane SQLite only — no proxy to the bot.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deployment id.' },
      },
      required: ['id'],
    },
    handler: getDeploymentHandler,
  });

  // Read the artifact .env safely. Sensitive values (Anthropic / OpenAI /
  // AWS / Fly / GitHub / Slack tokens + the auto-generated MOJULO_API_KEY)
  // come back masked. Use this instead of `cat .env` whenever you need to
  // know what's in a bot's environment — see SERVER_INSTRUCTIONS and the
  // "Secrets handling" section of forward_context.
  registerTool({
    name: 'inspect_bot_env',
    description:
      "Read a bot's container .env safely. Returns parsed `{ key, value, masked }` entries — sensitive values (Anthropic / OpenAI / AWS / Fly / GitHub / Slack tokens + the auto-generated MOJULO_API_KEY) come through masked first-4…last-4; non-sensitive values (LLM_PROVIDER, ports, non-secret webhook URLs) come through clear. Use this — NOT `cat .env` via Bash/Read — so raw values never enter agent context. Pass `deploymentId` (resolves under MOJULO_HOME) or an explicit `path` (basename must start with `.env`).",
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: {
          type: 'string',
          description: 'Deployment id. Resolves to the artifact staging .env under MOJULO_HOME.',
        },
        path: {
          type: 'string',
          description:
            'Explicit .env path (basename must start with .env). Use when the user unzipped the artifact outside the staging dir.',
        },
      },
    },
    handler: inspectBotEnvHandler,
  });

  // Transcript-touching tools. The proxy reads keep conversation data inside
  // the bot's SQLite — the model sees them but the control-plane DB never does.
  registerTool({
    name: 'query_conversations',
    description:
      'List conversation summaries on a connected bot (one entry per conversation — id, started_at, last_activity, turn_count). Proxies through to the bot — conversation rows live in the bot SQLite, never the control plane. Optional since / until ISO bounds filter on the first-turn timestamp. Use get_conversation for the full turn list, or export_conversations to pull every turn in one shot.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deployment id.' },
        since: { type: 'string', description: 'ISO timestamp lower bound on first-turn timestamp.' },
        until: { type: 'string', description: 'ISO timestamp upper bound on first-turn timestamp.' },
      },
      required: ['id'],
    },
    handler: queryConversationsHandler,
  });

  registerTool({
    name: 'get_conversation',
    description:
      'Get the full turn list for one conversation on a connected bot. Proxies through to the bot.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deployment id.' },
        conversationId: { type: 'string', description: 'Conversation id on the bot.' },
      },
      required: ['id', 'conversationId'],
    },
    handler: getConversationHandler,
  });

  registerTool({
    name: 'export_conversations',
    description:
      'Bulk export full conversations on a connected bot, including every turn. Optional startDate / endDate ISO bounds filter on the conversation\'s first turn. Returns one entry per conversation with the full turn list nested under each — use sparingly on bots with many conversations.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deployment id.' },
        startDate: { type: 'string', description: 'ISO timestamp lower bound on first-turn timestamp.' },
        endDate: { type: 'string', description: 'ISO timestamp upper bound on first-turn timestamp.' },
      },
      required: ['id'],
    },
    handler: exportConversationsHandler,
  });

  registerTool({
    name: 'query_submissions',
    description:
      'List form-gathering submissions on a connected bot. Proxies through to the bot.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deployment id.' },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
        offset: { type: 'integer', minimum: 0 },
        since: { type: 'string' },
        until: { type: 'string' },
      },
      required: ['id'],
    },
    handler: querySubmissionsHandler,
  });

  registerTool({
    name: 'verify_chain',
    description:
      'Walk the tamper-evident hash chain for one conversation. Returns the verification result from the bot. See docs/turn-hashing.md for the chain semantics.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deployment id.' },
        conversationId: { type: 'string', description: 'Conversation id on the bot.' },
      },
      required: ['id', 'conversationId'],
    },
    handler: verifyChainHandler,
  });
}
