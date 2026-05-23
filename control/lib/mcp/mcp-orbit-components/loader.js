/**
 * mcp-orbit component loader.
 *
 * Components ship as `.md` files in `<kind>/<ref>.md` under this directory.
 * On server startup, this loader parses every shipped file and writes it
 * into the `mcp_orbit_components` table (source='builtin') via the
 * MCPOrbitComponentRepository. The runtime authoritative source is the
 * table, not disk — but disk is the editable source of truth for the
 * curated library, mirroring the catalyst loader pattern.
 *
 * File format — JSON frontmatter between two `---` fences, then markdown body:
 *
 *   ---
 *   { "ref": "...", "version": "...", ... }
 *   ---
 *
 *   # Body markdown the model reads at composition time.
 *
 * Frontmatter required fields: `ref`, `version`, `summary`. The `kind` is
 * inferred from the parent directory name (not the frontmatter) — the
 * subdirectory layout IS the schema, so a file misplaced under the wrong
 * kind is a loader error, not a silent reclassification.
 *
 * Optional frontmatter: `constraints` (structured composition rules),
 * `knobs` (knobs this component exposes for negotiation), `requires`
 * (e.g. an mcp inventory category), and any other component-specific
 * structured fields — all rolled into `payload_json` on the row.
 *
 * Validation faults are loader bugs (the library is curated, not user input)
 * — we throw with a clear file + field reference so a bad PR fails loudly.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MCPOrbitComponentRepository,
  _COMPONENT_KINDS_FOR_TESTS as COMPONENT_KINDS,
} from '@/lib/db/repositories/mcp-orbit';

const COMPONENT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
const REQUIRED_FIELDS = ['ref', 'version', 'summary'];

function parseComponentFile(filePath, raw) {
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) {
    throw new Error(
      `Component ${filePath} is missing JSON frontmatter (expected '---' fences).`,
    );
  }
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`Component ${filePath} has invalid JSON frontmatter: ${err.message}`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (!meta[field] || typeof meta[field] !== 'string') {
      throw new Error(`Component ${filePath} is missing required string field '${field}'.`);
    }
  }
  const body = raw.slice(match[0].length).trim();
  if (!body) {
    throw new Error(`Component ${filePath} has an empty body — the prose is the component's value.`);
  }
  return { meta, body };
}

function listKindDirs(rootDir) {
  let entries;
  try {
    entries = readdirSync(rootDir);
  } catch {
    return [];
  }
  return entries.filter((name) => {
    const full = join(rootDir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      return false;
    }
    return s.isDirectory() && COMPONENT_KINDS.includes(name);
  });
}

/**
 * Walk the component directory tree and return parsed component objects
 * suitable for handing to MCPOrbitComponentRepository.upsert.
 *
 * Pulled out so tests can assert on parse output without touching the DB.
 */
export function discoverComponents(rootDir = COMPONENT_DIR) {
  const out = [];
  for (const kind of listKindDirs(rootDir)) {
    const kindDir = join(rootDir, kind);
    const files = readdirSync(kindDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const filePath = join(kindDir, file);
      const raw = readFileSync(filePath, 'utf8');
      const { meta, body } = parseComponentFile(filePath, raw);
      // The filename's basename must equal the frontmatter `ref` so the file
      // path itself is a stable typed identifier (no rename drift between
      // disk and store).
      const baseRef = file.replace(/\.md$/, '');
      if (baseRef !== meta.ref) {
        throw new Error(
          `Component ${filePath}: filename ref '${baseRef}' does not match frontmatter ref '${meta.ref}'.`,
        );
      }
      const { ref, version, summary, ...rest } = meta;
      out.push({
        kind,
        ref,
        version,
        body_md: body,
        payload: { summary, ...rest },
        source: 'builtin',
        _file: filePath,
      });
    }
  }
  return out;
}

let _seeded = false;

/**
 * Seed every shipped component into the store. Idempotent: drops all
 * builtin rows first, then re-upserts. Custom rows (when register_* ships
 * in v1) are untouched.
 *
 * Called by ensureToolsRegistered at server startup. Tests can call it
 * directly against an in-memory DB.
 */
export function seedComponents({ rootDir = COMPONENT_DIR, force = false } = {}) {
  if (_seeded && !force) return { skipped: true, inserted: 0 };
  const components = discoverComponents(rootDir);
  MCPOrbitComponentRepository.deleteAllBuiltins();
  for (const c of components) {
    MCPOrbitComponentRepository.upsert({
      kind: c.kind,
      ref: c.ref,
      version: c.version,
      body_md: c.body_md,
      payload: c.payload,
      source: 'builtin',
    });
  }
  _seeded = true;
  return { skipped: false, inserted: components.length };
}

// Test seam — let the test suite reset the once-flag without resetting the
// whole module.
export function _resetSeededForTests() {
  _seeded = false;
}

export { COMPONENT_DIR as _COMPONENT_DIR_FOR_TESTS, parseComponentFile as _parseComponentFileForTests };
