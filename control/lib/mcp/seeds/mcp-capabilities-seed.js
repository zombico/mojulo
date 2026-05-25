/**
 * Seed migration for meta_mcp_capabilities — ships the four curated vendor
 * bodies (gmail, notion, linear, gdrive) as starter rows on first install.
 *
 * Honestly attributed: `source_urls[0]` is `mojulo://CHANGELOG#v0.5.0` so
 * the provenance is "this body is mojulo's curated v0.5.0 baseline,"
 * deliberately distinct from `'research'` provenance for rows the agent
 * writes via the research-mcp-vendor catalyst. `discovered_at` is fixed at
 * the v0.5.0 release date sentinel — NOT boot time, because the body was
 * last refreshed at release, not today.
 *
 * Idempotent per-provider: if any capability row exists (current or
 * superseded) for a given provider_ref, the seed for that provider is
 * skipped. Re-running across boots is safe; agent-authored research rows
 * are never overwritten.
 *
 * Called lazily from registerCapabilitiesTools at MCP server startup, not
 * from DB init() — so tests get an empty providers/capabilities table by
 * default and can opt in by calling seedMcpCapabilities() explicitly.
 *
 * See lite-template/integration/MCP_DECURATION_PLAN.md.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CapabilitiesRepository } from '@/lib/db/repositories/mcp-capabilities';

const SEEDS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'mcp-capabilities');
const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
const SOURCES_BLOCK = /<!--\s*sources([\s\S]*?)-->/;
const URL_LINE = /^\s*-\s*(\S+)/gm;

// v0.5.0 release sentinel — UTC 2026-05-25. Fixed so seed `discovered_at`
// honestly reports when the body was last refreshed by mojulo (at release),
// not boot time.
const V0_5_0_RELEASE_UNIX = Math.floor(Date.UTC(2026, 4, 25, 0, 0, 0) / 1000);
const SOURCE_MOJULO_PREFIX = 'mojulo://CHANGELOG#v0.5.0';

// Hardcoded display names — the four shipped seeds are curated, not
// agent-research. Future research-mcp-vendor catalyst calls supply
// display_name themselves. First-writer-wins means leaving this null
// would lock in null forever, so we set it explicitly here.
const DISPLAY_NAMES = {
  gmail: 'Gmail',
  notion: 'Notion',
  linear: 'Linear',
  google_drive: 'Google Drive',
  slack: 'Slack',
};

function parseSeedFile(filePath, raw) {
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) {
    throw new Error(`Seed ${filePath}: missing JSON frontmatter ('---' fences).`);
  }
  let frontmatter;
  try {
    frontmatter = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`Seed ${filePath}: invalid JSON frontmatter — ${err.message}`);
  }
  const body = raw.slice(match[0].length);
  return { frontmatter, body };
}

function extractSourceUrls(body) {
  const block = body.match(SOURCES_BLOCK);
  if (!block) return [];
  const urls = [];
  URL_LINE.lastIndex = 0;
  let m;
  while ((m = URL_LINE.exec(block[1])) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

let _seeded = false;

/**
 * Seed every shipped vendor body into meta_mcp_capabilities. Idempotent
 * per-provider: skips any provider that already has a capability row
 * (current or superseded) — never overwrites agent-authored research.
 *
 * Returns `{ skipped, inserted, providers }` — `providers` is the list of
 * provider_refs that received a seed row in this call.
 */
export function seedMcpCapabilities({ rootDir = SEEDS_DIR, force = false } = {}) {
  if (_seeded && !force) return { skipped: true, inserted: 0, providers: [] };

  let entries;
  try {
    entries = readdirSync(rootDir);
  } catch {
    _seeded = true;
    return { skipped: false, inserted: 0, providers: [] };
  }

  const files = entries.filter((f) => f.endsWith('.md'));
  const inserted = [];
  for (const file of files) {
    const providerRef = file.replace(/\.md$/, '');

    // Skip if any row exists for this provider — never overwrite agent
    // research rows with a seed.
    const existing = CapabilitiesRepository.listForProvider(providerRef);
    if (existing.length > 0) continue;

    const filePath = join(rootDir, file);
    const raw = readFileSync(filePath, 'utf8');
    const { frontmatter, body } = parseSeedFile(filePath, raw);

    const versionTag = frontmatter?.capabilities?.apiVersion ?? null;
    const vendorSourceUrls = extractSourceUrls(body);
    const sourceUrls = [SOURCE_MOJULO_PREFIX, ...vendorSourceUrls];
    const displayName = DISPLAY_NAMES[providerRef] ?? null;

    CapabilitiesRepository.insert({
      providerRef,
      displayName,
      versionTag: typeof versionTag === 'string' ? versionTag : null,
      bodyMd: raw,
      sourceUrls,
      discoveredAt: V0_5_0_RELEASE_UNIX,
    });
    inserted.push(providerRef);
  }

  _seeded = true;
  return { skipped: false, inserted: inserted.length, providers: inserted };
}

/**
 * Index the freshly-seeded vendor bodies into the meta_embeddings sidecar.
 * Called by the production tool registration after seedMcpCapabilities()
 * returns; the seed function itself stays sync so the existing repository
 * tests keep working unchanged. No-op (returns silently) when there's
 * nothing to index or MOJULO_SEMANTIC_INDEX_DISABLED=1.
 */
export async function indexSeededCapabilities(providerRefs) {
  if (process.env.MOJULO_SEMANTIC_INDEX_DISABLED === '1') return { indexed: 0 };
  if (!Array.isArray(providerRefs) || providerRefs.length === 0) {
    return { indexed: 0 };
  }
  const { EmbeddingsRepository } = await import(
    '../../db/repositories/embeddings.js'
  );
  const items = [];
  for (const providerRef of providerRefs) {
    const row = CapabilitiesRepository.getCurrent(providerRef);
    if (!row) continue;
    items.push({
      sourceKind: 'mcp_capability',
      sourceRef: providerRef,
      bodyText: row.bodyMd,
    });
  }
  if (items.length === 0) return { indexed: 0 };
  const embedded = await EmbeddingsRepository.embedMany(items);
  const { getDb: gd } = await import('../../db/index.js');
  const db = gd();
  let indexed = 0;
  db.transaction(() => {
    for (const e of embedded) {
      const res = EmbeddingsRepository.upsertSync({
        sourceKind: e.sourceKind,
        sourceRef: e.sourceRef,
        bodyText: e.bodyText,
        hash: e.hash,
        vector: e.vector,
      });
      if (res.written) indexed += 1;
    }
  })();
  return { indexed };
}

// Test seams.
export function _resetSeededForTests() {
  _seeded = false;
}

export const _internals = {
  parseSeedFile,
  extractSourceUrls,
  V0_5_0_RELEASE_UNIX,
  SOURCE_MOJULO_PREFIX,
  DISPLAY_NAMES,
  SEEDS_DIR,
};
