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
import { pluginProfileActive, profileEdit } from '../plugin-profile.js';

// Under the Claude plugin profile (../plugin-profile.js) the host cards drop what that build does
// not have: the CDN page (every card), and the Grok card's paint-worker and native-video moves (no
// image handoff to bind a painted render back through) and its image-render pack.
const PROFILE_ADAPTER_EDITS = {
  // The Claude Code card: that build writes no CDN page, so the web box's handoff is the file.
  'claude-code': {
    body: [[
      /the page door is your Artifact tool — publish `world\.cdn\.html`[\s\S]*?the default build is the file that works with no network\. /,
      "your Artifact tool's page CSP refuses inline `data:` scripts at any size, so the self-contained `world.html` this build writes loads and draws nothing there: hand over the file instead. ",
    ]],
  },
  'generic': {
    body: [[" (`cdn: true` writes `world.cdn.html`, which loads three.js from the pinned jsdelivr CDN, for a page door whose CSP refuses inline scripts)", '']],
  },
  'codex': {
    body: [["; `cdn: true` writes `world.cdn.html`, which loads three.js from the pinned jsdelivr CDN instead.", '.']],
  },
  'grok-build': {
    summary: [['native image_gen/image_edit is the paint worker (recipe stays sovereign); ', '']],
    body: [
      ['Native image (`image_gen` / `image_edit`) is the look. Mojulo is the recipe', 'Mojulo is the recipe'],
      [
        /2\. \*\*You are the paint worker\.\*\*[^\n]*/,
        "2. **Recipes, not renders.** A PNG, GLB or WAV is a derived file bound to its recipe; the recipe stays sovereign. The eyes gate is the operator's — see `docs/bicycles.md`; do not invent a gate here.",
      ],
      [
        '3. **Two motion systems.** `forge_motion` is deterministic (turntable, traversal that can prove a level). Native video (`image_to_video` / `reference_to_video`) is cinema. Do not substitute one for the other.',
        '3. **Motion is deterministic.** `forge_motion` renders turntables and traversals that can prove a level.',
      ],
      // The image-render pack is not in this build.
      ['The heavy ones (connected services, stash, image render, game,', 'The heavy ones (connected services, stash, game,'],
    ],
  },
};

function profiled(adapter, field) {
  const edits = pluginProfileActive() && PROFILE_ADAPTER_EDITS[adapter.id]?.[field];
  return edits ? profileEdit(adapter[field], edits, `adapter.${adapter.id}.${field}`) : adapter[field];
}
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
      summary: profiled(adapter, 'summary'),
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
  return pluginProfileActive() && PROFILE_ADAPTER_EDITS[id]
    ? { ...rest, summary: profiled(adapter, 'summary'), body: profiled(adapter, 'body') }
    : rest;
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
