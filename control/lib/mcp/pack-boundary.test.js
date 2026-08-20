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
import { PACKS } from '@/lib/mcp/packs';

const CONTROL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Engine buckets (dir prefixes, repo-relative, trailing slash so `fleet/` ≠ `fleet-scene/`).
// lib/visual-language is a single zero-import pure-config module (presentation-theme
// CSS-var presets) shared by both wings (cook, figure, motion) — kernel-grade
// vocabulary, not the render engine. Per the model/render principle it is NOT bucketed
// as creative (install-capabilities.plan.md P3b).
const CREATIVE_ENGINE = ['lib/graph/', 'lib/motion/', 'lib/preview/'];
// lib/outcomes is the cook/gather/publish WRITER layer (pack_stash = office). Its
// report-kind writers are render-free; its one render bridge (resolvers/sketch.js)
// loads the creative renderers lazily, so it carries no static creative import.
// Its pure path helper was relocated to the kernel (lib/outcomes-paths.js). See
// install-capabilities.plan.md P3b.
const OPS_ENGINE = [
  'lib/deployers/', 'lib/builder/', 'lib/composer/', 'lib/fleet/', 'lib/fleet-scene/',
  'lib/connected-services/', 'lib/triggers/', 'lib/apps/', 'lib/app-mcp-scaffold/',
  'lib/runtime-adapters/', 'lib/form-schema-config/', 'lib/outcomes/',
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

  // C: the office deliberation surfaces (pack_plan / pack_research) must not
  // statically import the creative engine, so an ops-only install can load them
  // (install-capabilities.plan.md P3). The pure plan/research→sketch mapper now
  // lives in the kernel (lib/sketch-derive). research-sweep is deliberately NOT
  // here yet — run_experiment_sweep genuinely samples a creative physics view and
  // needs the lazy+advisory bridge (P3b).
  const DELIBERATION_SURFACES = [
    'lib/mcp/tools/plan-mode.js',
    'lib/mcp/tools/research-mode.js',
    'lib/mcp/tools/research-sweep.js', // run_experiment_sweep loads its mechanics-view lazily (P3b)
  ];
  it('C: office deliberation surfaces stay off the creative engine', () => {
    const offenders = [];
    for (const rel of DELIBERATION_SURFACES) {
      const code = readFileSync(join(CONTROL_ROOT, rel), 'utf8');
      for (const spec of specifiers(code)) {
        const t = resolveSpec(spec, rel);
        if (t && bucketOf(t) === 'creative') offenders.push(`${rel}  →  ${t}`);
      }
    }
    expect(offenders, `deliberation→creative imports:\n${offenders.join('\n')}`).toEqual([]);
  });

  // D: the general form of C — ops must be clean of the ENTIRE creative concern
  // (both sim AND render). Every tool file that registers an office-pack tool must
  // carry no static import of the creative engine; any creative touch an office
  // capability needs (a rendered preview, a physics sample) rides a lazy `import()`
  // + advisory, which the static-import scan (correctly) does not see. Wing is
  // resolved from packs.js membership, so this generalizes beyond the C hardcode.
  const WING_BY_TOOL = new Map();
  for (const pack of PACKS) for (const name of pack.members) WING_BY_TOOL.set(name, pack.wing);
  const TOOL_NAME_RE = /name:\s*['"]([a-z_]+)['"]/g;
  it('D: no office tool file statically imports the creative engine (sim or render)', () => {
    const toolsDir = join(CONTROL_ROOT, 'lib/mcp/tools');
    const files = walk(toolsDir).map((abs) => posix.normalize(abs.slice(CONTROL_ROOT.length + 1)));
    const offenders = [];
    for (const rel of files) {
      const code = readFileSync(join(CONTROL_ROOT, rel), 'utf8');
      // wings this file serves, from the tool names it registers
      const wings = new Set();
      let m;
      TOOL_NAME_RE.lastIndex = 0;
      while ((m = TOOL_NAME_RE.exec(code))) {
        const w = WING_BY_TOOL.get(m[1]);
        if (w) wings.add(w);
      }
      if (!wings.has('office')) continue; // not an office file (or unclassifiable) — skip
      for (const spec of specifiers(code)) {
        const t = resolveSpec(spec, rel);
        if (t && bucketOf(t) === 'creative') {
          offenders.push(`${rel} (office${wings.has('studio') ? '+studio' : ''})  →  ${t}`);
        }
      }
    }
    expect(offenders, `office tool files importing creative:\n${offenders.join('\n')}`).toEqual([]);
  });
});
