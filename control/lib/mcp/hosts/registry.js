/**
 * Host profile registry — one record per agent harness, read by every surface
 * that has to know something host-specific.
 *
 * Sibling to [../adapters/loader.js](../adapters/loader.js), deliberately NOT
 * merged into it. An adapter card answers "where do artifacts live on this
 * host" and is served to the connecting agent; a host profile answers "how do
 * we DETECT and WIRE this host, and what can its runtime do". The two split on
 * cardinality, not taste: Claude Desktop is a wirable host with no adapter card
 * of its own (it resolves `claude-code`), and `generic` is an adapter with no
 * host to detect. Folding profiles into card frontmatter would have forced a
 * phantom desktop card into `list_adapters` and into `resolveAdapterId()`'s
 * substring matching, where a new `"claude"` hint could silently re-resolve
 * live sessions. Two files per host, no blast radius.
 *
 * Consumers:
 *   - [../../../scripts/mcp-init.mjs](../../../scripts/mcp-init.mjs) — detection,
 *     wiring (dispatched on `wire.format`), the manual-snippet list, `--host`.
 *   - [../server.js](../server.js) — `clientDefersSchemas()` reads
 *     `capabilities.defersToolSchemas` instead of comparing against a vendor id.
 *
 * Adding a host is a JSON file plus (usually) an adapter card. No JS edit.
 * Curated repo-side only — nothing loads profiles from $MOJULO_HOME, same
 * posture as catalysts and adapters.
 *
 * Schema (v1). Unknown keys are preserved; missing optional keys read as null.
 *   id            string   registry key; also the `--host <id>` value.
 *   adapterId     string?  adapter card this host resolves to, or null.
 *   order         number   detection/listing order (stable output).
 *   detect        object   { configPath?, probe?, appPaths? } — any hit detects.
 *   wire          object   { format, ...format-specific fields }. `manual` is the
 *                          honest default for a host whose config format is not
 *                          verified: detect it, print its snippet, write nothing.
 *   manual        string   paste-able snippet when no writer runs.
 *   capabilities  object   runtime traits (see capability keys below).
 *   handoff       object?  how an export reaches the operator on this host — the
 *                          door table [handoff.js](./handoff.js) reads. Optional
 *                          on a planted fixture, present on every shipped profile.
 *                            verified  'field' | 'docs' | 'inferred' (required)
 *                            local     { page, file } — the operator's own machine
 *                            box       { name, page, file, pageMaxBytes?,
 *                                        fileMaxBytes?, downloadExtensions?,
 *                                        cdns?, egress, ephemeral } — the host's
 *                                        remote box, when it has one
 *                          `page` ∈ HANDOFF_PAGE_DOORS, `file` ∈ HANDOFF_FILE_DOORS.
 *                          clientInfo cannot tell a host's local surface from
 *                          its box (Claude Code local / web / Desktop all say
 *                          "claude"), so one profile carries both rows and the
 *                          note names both when the surface is unknown.
 *
 * Paths accept `~`, `%APPDATA%`, `%LOCALAPPDATA%`, and per-platform maps
 * ({ darwin, win32, linux }) — resolved by expandPath().
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { moduleDir } from '../../module-dir.js';

const HOSTS_DIR = moduleDir(import.meta.url, 'lib/mcp/hosts');

const REQUIRED_FIELDS = ['id', 'wire', 'manual'];
const WIRE_FORMATS = new Set(['toml-append', 'json-patch', 'cli-shellout', 'manual']);

/** Handoff door vocabularies (remote-worker exports). A door is what the HOST
 * does with a page or a file; the server never publishes anything itself. */
export const HANDOFF_PAGE_DOORS = new Set(['dashboard', 'artifact', 'mcp-app', 'hosted-publish', 'local-preview', 'file-card', 'none']);
export const HANDOFF_FILE_DOORS = new Set(['local', 'artifact-download', 'git', 'file-card', 'none']);
export const HANDOFF_VERIFIED = new Set(['field', 'docs', 'inferred']);

function validateHandoff(file, handoff) {
  if (handoff == null) return null;
  if (typeof handoff !== 'object') throw new Error(`Host profile ${file}: handoff must be an object.`);
  if (!HANDOFF_VERIFIED.has(handoff.verified)) {
    throw new Error(`Host profile ${file}: handoff.verified must be one of ${[...HANDOFF_VERIFIED].join(', ')}.`);
  }
  if (!handoff.local && !handoff.box) throw new Error(`Host profile ${file}: handoff needs a local and/or a box row.`);
  for (const key of ['local', 'box']) {
    const row = handoff[key];
    if (row == null) continue;
    if (!HANDOFF_PAGE_DOORS.has(row.page)) throw new Error(`Host profile ${file}: handoff.${key}.page '${row.page}' is not a known page door.`);
    if (!HANDOFF_FILE_DOORS.has(row.file)) throw new Error(`Host profile ${file}: handoff.${key}.file '${row.file}' is not a known file door.`);
    if (key === 'box') {
      if (!row.name) throw new Error(`Host profile ${file}: handoff.box.name is required (the note names the box).`);
      if (typeof row.ephemeral !== 'boolean') throw new Error(`Host profile ${file}: handoff.box.ephemeral must be a boolean.`);
    }
  }
  return handoff;
}

/** Capability defaults. A profile that declares nothing behaves like today's
 * unknown host: opinionated packs, no declared cap, no headless runtime. */
const CAPABILITY_DEFAULTS = {
  defersToolSchemas: false,
  maxOutputBytes: null,
  nativeImageGen: false,
  scheduler: null,
  skillsDir: null,
  headlessRuntime: null,
};

let _catalog = null;

function parseProfile(file, raw) {
  let profile;
  try {
    profile = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Host profile ${file} is not valid JSON: ${err.message}`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (!profile[field]) throw new Error(`Host profile ${file} is missing required field '${field}'.`);
  }
  if (!WIRE_FORMATS.has(profile.wire.format)) {
    throw new Error(
      `Host profile ${file} declares unknown wire.format '${profile.wire.format}' — expected one of ${[...WIRE_FORMATS].join(', ')}.`
    );
  }
  return {
    adapterId: null,
    order: 99,
    detect: {},
    ...profile,
    capabilities: { ...CAPABILITY_DEFAULTS, ...(profile.capabilities || {}) },
    handoff: validateHandoff(file, profile.handoff),
    _file: file,
  };
}

function loadCatalog() {
  const files = readdirSync(HOSTS_DIR).filter((f) => f.endsWith('.json'));
  const profiles = [];
  for (const file of files) {
    const profile = parseProfile(file, readFileSync(join(HOSTS_DIR, file), 'utf8'));
    if (profiles.some((p) => p.id === profile.id)) {
      throw new Error(`Host profile id collision: '${profile.id}' declared twice.`);
    }
    profiles.push(profile);
  }
  profiles.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return profiles;
}

export function listHostProfiles() {
  if (!_catalog) _catalog = loadCatalog();
  return _catalog;
}

export function getHostProfile(id) {
  return listHostProfiles().find((p) => p.id === id) || null;
}

/** Profile whose `adapterId` matches — the bridge from a resolved adapter
 * (clientInfo.name → adapter id) back to the host's declared runtime traits. */
export function hostProfileForAdapter(adapterId) {
  if (!adapterId) return null;
  return listHostProfiles().find((p) => p.adapterId === adapterId) || null;
}

/** Capabilities for a resolved adapter id; defaults for anything unmapped, so
 * an unknown host reads exactly like today's fallback rather than throwing. */
export function hostCapabilities(adapterId) {
  const profile = hostProfileForAdapter(adapterId);
  return profile ? profile.capabilities : { ...CAPABILITY_DEFAULTS };
}

/** Door table for a host profile id, or null when the host is unknown or
 * declares none — the caller falls back to the generic file:// sentence. */
export function hostHandoff(hostId) {
  const profile = hostId ? getHostProfile(hostId) : null;
  return profile?.handoff || null;
}

/** Expand `~`, Windows env tokens, and per-platform maps into a real path.
 * Returns null when the profile declares no path for this platform. */
export function expandPath(value, { platform = process.platform, home = os.homedir() } = {}) {
  if (!value) return null;
  const raw = typeof value === 'object' ? value[platform] || value.default || null : value;
  if (!raw) return null;
  return raw
    .replace(/^~(?=\/|\\|$)/, home)
    .replace(/%APPDATA%/gi, process.env.APPDATA || join(home, 'AppData', 'Roaming'))
    .replace(/%LOCALAPPDATA%/gi, process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'));
}

// Test seam — profiles are read once and cached; a test that drops a fixture
// file into this directory calls this to make the next read see it.
export function _resetHostProfilesForTests() {
  _catalog = null;
}
