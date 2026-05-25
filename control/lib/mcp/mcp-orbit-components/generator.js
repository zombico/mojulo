/**
 * mcp-orbit provider-artifact generator.
 *
 * Server-side, deterministic, no LLM in the path. Takes:
 *   - a primitive ref (`document-store`, `issue-tracker`, ...)
 *   - a composition role (`source` | `destination`)
 *   - a capability snapshot for one MCP (server name, introspection time,
 *     tools list with names and input schemas, snapshot confidence)
 *   - an explicit affordance → tool binding map with per-binding confidence
 *
 * Loads the primitive's frontmatter (the affordance contract for the role)
 * and the role-specific template, fills slots from the snapshot + bindings,
 * and returns a session-scoped "provider artifact" markdown body plus a
 * structured binding manifest the caller can persist alongside the
 * composition row.
 *
 * The generator is deterministic by design — if it took LLM judgment,
 * provenance ("why did this composition bind to `search_files` instead of
 * `list_recent_files`?") would become unanswerable. Heuristic binding belongs
 * to a separate layer; this module just renders.
 *
 * Template slot vocabulary (all `{{...}}`):
 *   - {{server}}, {{introspected_at}}, {{snapshot_confidence}}
 *   - {{tool:<affordance>}}              → bound tool name, or "<UNBOUND>"
 *   - {{confidence:<affordance>}}        → bound confidence label, or "—"
 *   - {{schema:<affordance>}}            → JSON.stringify of input schema, or
 *                                          "(no schema available)"
 *   - {{unbound_affordances}}            → comma-separated list with support hints
 *   - {{if-bound:<affordance>}}...{{/if-bound:<affordance>}}     → conditional
 *   - {{if-unbound:<affordance>}}...{{/if-unbound:<affordance>}} → conditional
 *
 * Conditionals are flat (no nesting) and matched by exact affordance name.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRIMITIVE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'primitive');
const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
const VALID_ROLES = ['source', 'destination'];

const UNBOUND_PLACEHOLDER = '<UNBOUND>';
const UNBOUND_CONFIDENCE = '—';
const NO_SCHEMA = '(no schema available)';

function parsePrimitiveFile(filePath, raw) {
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) {
    throw new Error(`Primitive ${filePath} is missing JSON frontmatter (expected '---' fences).`);
  }
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`Primitive ${filePath} has invalid JSON frontmatter: ${err.message}`);
  }
  for (const field of ['ref', 'version', 'summary']) {
    if (typeof meta[field] !== 'string' || !meta[field]) {
      throw new Error(`Primitive ${filePath} is missing required string field '${field}'.`);
    }
  }
  if (!meta.affordances || typeof meta.affordances !== 'object') {
    throw new Error(`Primitive ${filePath} is missing required 'affordances' map.`);
  }
  return meta;
}

function loadPrimitive(primitive, rootDir) {
  const path = join(rootDir, `${primitive}.md`);
  const raw = readFileSync(path, 'utf8');
  return parsePrimitiveFile(path, raw);
}

function loadTemplate(primitive, role, rootDir) {
  const path = join(rootDir, `${primitive}.${role}.template.md`);
  return readFileSync(path, 'utf8');
}

function indexToolsByName(snapshot) {
  const tools = snapshot?.tools || [];
  const out = new Map();
  for (const t of tools) {
    if (t && typeof t.name === 'string') out.set(t.name, t);
  }
  return out;
}

function extractToolSchema(tool) {
  if (!tool) return null;
  // MCP spec uses `inputSchema`; some snapshots may use the snake-case form.
  return tool.inputSchema || tool.input_schema || null;
}

function buildManifest({ role, primitiveMeta, bindings, toolsByName }) {
  const declared = primitiveMeta.affordances[role] || [];
  const bound = [];
  const unbound = [];
  for (const aff of declared) {
    const b = bindings?.[aff.name];
    if (b && typeof b.tool === 'string') {
      if (toolsByName.has(b.tool)) {
        const tool = toolsByName.get(b.tool);
        bound.push({
          affordance: aff.name,
          tool: b.tool,
          confidence: b.confidence || 'agent-inferred',
          schema: extractToolSchema(tool),
        });
      } else {
        // Binding points to a tool the snapshot doesn't contain — soft fail,
        // surface as unbound with a reason so the caller can see the mismatch.
        unbound.push({
          affordance: aff.name,
          support: aff.support,
          reason: `bound to '${b.tool}' but that tool is not in the snapshot`,
        });
      }
    } else {
      unbound.push({ affordance: aff.name, support: aff.support });
    }
  }
  return { bound, unbound, declaredCount: declared.length };
}

function fillConditionals(template, manifest) {
  const boundSet = new Set(manifest.bound.map((b) => b.affordance));
  const ifBound = /\{\{if-bound:([a-z0-9-]+)\}\}([\s\S]*?)\{\{\/if-bound:\1\}\}/g;
  const ifUnbound = /\{\{if-unbound:([a-z0-9-]+)\}\}([\s\S]*?)\{\{\/if-unbound:\1\}\}/g;
  let out = template.replace(ifBound, (_, aff, content) =>
    boundSet.has(aff) ? content : '',
  );
  out = out.replace(ifUnbound, (_, aff, content) =>
    boundSet.has(aff) ? '' : content,
  );
  return out;
}

function formatUnboundList(unbound) {
  if (!unbound.length) return '_(none — all declared affordances are bound)_';
  return unbound
    .map(
      (u) =>
        `\`${u.affordance}\` (support: ${u.support || 'unknown'}${u.reason ? `; ${u.reason}` : ''})`,
    )
    .join(', ');
}

function fillSubstitutions(template, { snapshot, manifest }) {
  const boundByAff = new Map(manifest.bound.map((b) => [b.affordance, b]));
  let out = template;
  out = out.replaceAll('{{server}}', String(snapshot.server || ''));
  out = out.replaceAll('{{introspected_at}}', String(snapshot.introspected_at || ''));
  out = out.replaceAll(
    '{{snapshot_confidence}}',
    String(snapshot.introspection_confidence || 'unknown'),
  );
  out = out.replace(/\{\{tool:([a-z0-9-]+)\}\}/g, (_, aff) => {
    const b = boundByAff.get(aff);
    return b ? b.tool : UNBOUND_PLACEHOLDER;
  });
  out = out.replace(/\{\{confidence:([a-z0-9-]+)\}\}/g, (_, aff) => {
    const b = boundByAff.get(aff);
    return b ? b.confidence : UNBOUND_CONFIDENCE;
  });
  out = out.replace(/\{\{schema:([a-z0-9-]+)\}\}/g, (_, aff) => {
    const b = boundByAff.get(aff);
    if (!b || !b.schema) return NO_SCHEMA;
    return JSON.stringify(b.schema, null, 2);
  });
  out = out.replaceAll('{{unbound_affordances}}', formatUnboundList(manifest.unbound));
  return out;
}

/**
 * Generate a provider artifact from a primitive + role + snapshot + bindings.
 *
 * @param {object} input
 * @param {string} input.primitive - Primitive ref (e.g. 'document-store').
 * @param {'source'|'destination'} input.role - Composition role.
 * @param {object} input.snapshot - Capability snapshot for one MCP.
 * @param {string} input.snapshot.server - MCP server name (e.g. 'claude_ai_Google_Drive').
 * @param {string} input.snapshot.introspected_at - ISO timestamp.
 * @param {Array<{name:string, description?:string, inputSchema?:object}>} input.snapshot.tools
 * @param {string} [input.snapshot.introspection_confidence] - 'tools_list_full' | 'names_only' | 'agent_inferred'
 * @param {Record<string, {tool:string, confidence?:string}>} [input.bindings] - Affordance → tool map.
 * @param {string} [input.rootDir] - Override primitive directory (for tests).
 * @returns {{
 *   primitive: string,
 *   role: string,
 *   server: string,
 *   introspectedAt: string,
 *   snapshotConfidence: string|null,
 *   body: string,
 *   manifest: { bound: Array, unbound: Array, declaredCount: number }
 * }}
 */
export function generateProviderArtifact(input) {
  const { primitive, role, snapshot, bindings = {}, rootDir = PRIMITIVE_DIR } = input || {};
  if (!primitive || typeof primitive !== 'string') {
    throw new Error('primitive (string) is required');
  }
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`role must be one of: ${VALID_ROLES.join(', ')}`);
  }
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.server) {
    throw new Error(
      'snapshot { server, introspected_at, tools, introspection_confidence } is required',
    );
  }
  const primitiveMeta = loadPrimitive(primitive, rootDir);
  if (!primitiveMeta.affordances[role]) {
    throw new Error(
      `Primitive '${primitive}' does not declare affordances for role '${role}'.`,
    );
  }
  const template = loadTemplate(primitive, role, rootDir);
  const toolsByName = indexToolsByName(snapshot);
  const manifest = buildManifest({ role, primitiveMeta, bindings, toolsByName });

  let body = fillConditionals(template, manifest);
  body = fillSubstitutions(body, { snapshot, manifest });

  return {
    primitive: `${primitiveMeta.ref}@${primitiveMeta.version}`,
    role,
    server: snapshot.server,
    introspectedAt: snapshot.introspected_at,
    snapshotConfidence: snapshot.introspection_confidence || null,
    body,
    manifest,
  };
}

// Test seam — expose internals so unit tests can assert on each stage
// without running the full generate path.
export const _internals = {
  parsePrimitiveFile,
  loadPrimitive,
  loadTemplate,
  indexToolsByName,
  buildManifest,
  fillConditionals,
  fillSubstitutions,
  formatUnboundList,
  PRIMITIVE_DIR,
};
