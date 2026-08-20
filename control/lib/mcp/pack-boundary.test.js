/**
 * Pack-boundary guard — the dependency-direction fence for the kernel + two-pack split.
 * See lib/mcp/install-capabilities.plan.md (P1).
 *
 * Invariant: the two capability ENGINES stay orthogonal. Creative-engine code and ops-engine code
 * never import each other; both may depend only on the KERNEL (lib/db, lib/mcp, and the shared
 * top-level helpers). This is the property that lets each pack iterate — and eventually install —
 * independently. The audit that motivated the split found 0 engine↔engine edges; this test keeps it
 * that way.
 *
 * Two checks:
 *   A. no creative-engine file imports an ops-engine module, and no ops-engine file imports a
 *      creative-engine module.
 *   B. no SINGLE file (anywhere under lib/, e.g. an MCP tool handler) imports BOTH engines. This is
 *      the operator-world guard: that tool straddled both packs by direct import and was removed;
 *      nothing may reintroduce the shape. Cross-pack composition rides kernel-stored refs, not
 *      imports (see the plan's "Composition" section).
 *
 * Tests, spikes, and generated files are exempt — they legitimately reach across for coverage.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, posix } from 'node:path';

const CONTROL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Engine buckets (dir prefixes, repo-relative, trailing slash so `fleet/` ≠ `fleet-scene/`).
const CREATIVE_ENGINE = ['lib/graph/', 'lib/motion/', 'lib/outcomes/', 'lib/visual-language/', 'lib/preview/'];
const OPS_ENGINE = [
  'lib/deployers/', 'lib/builder/', 'lib/composer/', 'lib/fleet/', 'lib/fleet-scene/',
  'lib/connected-services/', 'lib/triggers/', 'lib/apps/', 'lib/app-mcp-scaffold/',
  'lib/runtime-adapters/', 'lib/form-schema-config/',
];

const EXCLUDE = /(\.test\.|\.spike|\.gen\.|\.integration\.)/;
const SRC = /\.(js|mjs)$/;

function walk(absDir, out = []) {
  for (const name of readdirSync(absDir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const abs = join(absDir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (SRC.test(name) && !EXCLUDE.test(name)) out.push(abs);
  }
  return out;
}

// Extract every static import/export-from/require specifier from a source file.
const SPEC_RE = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
function specifiers(code) {
  const out = [];
  let m;
  while ((m = SPEC_RE.exec(code))) out.push(m[1] || m[2] || m[3]);
  return out;
}

// Normalize a specifier (as seen from repo-relative `fromRel`) to a repo-relative path, or null if external.
function resolveSpec(spec, fromRel) {
  if (spec.startsWith('@/')) return spec.slice(2);
  if (spec.startsWith('.')) return posix.normalize(posix.join(posix.dirname(fromRel), spec));
  return null; // bare module (node:, three, etc.)
}

const bucketOf = (rel) => {
  if (CREATIVE_ENGINE.some((p) => rel.startsWith(p))) return 'creative';
  if (OPS_ENGINE.some((p) => rel.startsWith(p))) return 'ops';
  return 'kernel';
};

describe('pack boundary — engine orthogonality (kernel + ops/creative)', () => {
  const files = walk(join(CONTROL_ROOT, 'lib')).map((abs) => posix.normalize(abs.slice(CONTROL_ROOT.length + 1)));

  const crossEngine = []; // Check A
  const straddlers = []; // Check B

  for (const rel of files) {
    let code;
    try { code = readFileSync(join(CONTROL_ROOT, rel), 'utf8'); } catch { continue; }
    const targets = specifiers(code)
      .map((s) => resolveSpec(s, rel))
      .filter(Boolean)
      .map((t) => ({ rel: t, bucket: bucketOf(t) }));

    const from = bucketOf(rel);
    const touchesCreative = targets.some((t) => t.bucket === 'creative');
    const touchesOps = targets.some((t) => t.bucket === 'ops');

    for (const t of targets) {
      if (from === 'creative' && t.bucket === 'ops') crossEngine.push(`${rel}  →  ${t.rel}`);
      if (from === 'ops' && t.bucket === 'creative') crossEngine.push(`${rel}  →  ${t.rel}`);
    }
    if (touchesCreative && touchesOps) straddlers.push(rel);
  }

  it('A: creative and ops engines do not import each other', () => {
    expect(crossEngine, `cross-engine imports:\n${crossEngine.join('\n')}`).toEqual([]);
  });

  it('B: no single file imports both engines (the operator-world guard)', () => {
    expect(straddlers, `files importing BOTH engines:\n${straddlers.join('\n')}`).toEqual([]);
  });
});
