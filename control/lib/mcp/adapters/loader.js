/**
 * Host adapter loader — symmetric to lib/mcp/catalysts/loader.js.
 *
 * Host adapters decouple the catalyst's portable workflow recipe (mapping
 * intent, idempotency, pitfalls) from the host-specific materialization
 * (Claude Code skill files, Codex automations, generic workflow scripts).
 * Each adapter lives as a .md file in this directory with JSON frontmatter
 * declaring its `id`, its `artifactTarget`, the scheduling mechanism, and a
 * `supportsClientInfoHint` list that lets the MCP server auto-bind an adapter
 * based on the connecting client's `clientInfo.name`.
 *
 * Catalysts are host-neutral. Adapters are host-specific. `get_catalyst`
 * composes them: `CATALYST_CORE_PREAMBLE + <adapter body> + <catalyst body>`.
 *
 * Authoring is repo-side only (curated library) — validation faults are loader
 * bugs and throw with a clear file + field reference.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
const ADAPTER_DIR = moduleDir(import.meta.url, 'lib/mcp/adapters');

const REQUIRED_FIELDS = ['id', 'name', 'summary', 'artifactTarget'];
const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

let _catalog = null;

function parseAdapterFile(filePath, raw) {
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) {
    throw new Error(
      `Adapter ${filePath} is missing JSON frontmatter (expected '---' fences).`
    );
  }
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`Adapter ${filePath} has invalid JSON frontmatter: ${err.message}`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (!meta[field] || typeof meta[field] !== 'string') {
      throw new Error(`Adapter ${filePath} is missing required string field '${field}'.`);
    }
  }
  const body = raw.slice(match[0].length).trim();
  if (!body) {
    throw new Error(`Adapter ${filePath} has an empty body — the prose is what binds to a catalyst.`);
  }
  return {
    id: meta.id,
    name: meta.name,
    summary: meta.summary,
    version: meta.version ?? 1,
    artifactTarget: meta.artifactTarget,
    schedulingMechanism: meta.schedulingMechanism || null,
    secretsPosture: meta.secretsPosture || null,
    supportsClientInfoHint: Array.isArray(meta.supportsClientInfoHint)
      ? meta.supportsClientInfoHint.map((s) => String(s).toLowerCase())
      : [],
    body,
  };
}

function loadCatalog() {
  const files = readdirSync(ADAPTER_DIR).filter((f) => f.endsWith('.md'));
  const adapters = new Map();
  for (const file of files) {
    const filePath = join(ADAPTER_DIR, file);
    const raw = readFileSync(filePath, 'utf8');
    const adapter = parseAdapterFile(filePath, raw);
    if (adapters.has(adapter.id)) {
      throw new Error(
        `Adapter id collision: '${adapter.id}' is declared in both ${adapters.get(adapter.id)._file} and ${file}.`
      );
    }
    adapter._file = file;
    adapters.set(adapter.id, adapter);
  }
  return adapters;
}

export function getAdapterCatalog() {
  if (!_catalog) _catalog = loadCatalog();
  return _catalog;
}

export function listAdapters() {
  const catalog = getAdapterCatalog();
  const out = [];
  for (const adapter of catalog.values()) {
    out.push({
      id: adapter.id,
      name: adapter.name,
      summary: adapter.summary,
      artifactTarget: adapter.artifactTarget,
      schedulingMechanism: adapter.schedulingMechanism,
      secretsPosture: adapter.secretsPosture,
    });
  }
  return out;
}

export function getAdapter(id) {
  const adapter = getAdapterCatalog().get(id);
  if (!adapter) return null;
  const { _file, ...rest } = adapter;
  return rest;
}

/**
 * Pick an adapter id given an optional explicit host parameter and an optional
 * clientInfo.name from MCP initialize. Resolution order:
 *
 *   1. Explicit `host` matches an adapter id → that adapter wins.
 *   2. `clientInfo.name` matches any adapter's `supportsClientInfoHint` (case-
 *      insensitive substring or exact) → that adapter wins.
 *   3. Fall back to 'generic'.
 *
 * Returns the adapter id, never null — 'generic' is the safety net. Callers
 * that need the adapter object should chain through getAdapter().
 */
export function resolveAdapterId({ host, clientName } = {}) {
  const catalog = getAdapterCatalog();

  if (host && typeof host === 'string') {
    if (catalog.has(host)) return host;
  }

  if (clientName && typeof clientName === 'string') {
    const lower = clientName.toLowerCase();
    for (const adapter of catalog.values()) {
      for (const hint of adapter.supportsClientInfoHint) {
        if (lower === hint || lower.includes(hint)) return adapter.id;
      }
    }
  }

  return 'generic';
}

// Test seam — let the test suite point at a fixture directory.
export function _resetCatalogForTests(catalog) {
  _catalog = catalog || null;
}

export { ADAPTER_DIR as _ADAPTER_DIR_FOR_TESTS, parseAdapterFile as _parseAdapterFileForTests };
