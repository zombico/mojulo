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
// .jsx is included for the F/G carve fence below, which scans app/ as well as lib/
// (lib/ holds zero .jsx, so widening this is a no-op for checks A–E).
const SRC = /\.(jsx?|mjs)$/;

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

  // E: the KERNEL diagram surface — the pure vocab/validator core, the mint tool,
  // and the SVG renderer — must statically import nothing under the creative
  // engine, so a creative-absent install can validate + mint + render a diagram
  // (kernel-diagram-surface.plan.md). create_sketch (creative) and mint_diagram
  // (kernel) both delegate diagram validation to lib/diagram-core, so the two
  // can't drift — enforced FUNCTIONALLY by diagram-core.binding.test.js and
  // STRUCTURALLY here.
  const KERNEL_DIAGRAM_SURFACE = [
    'lib/diagram-core.js',
    'lib/mcp/tools/diagram.js',
    'lib/sketch-svg.js',
  ];
  it('E: the kernel diagram surface imports nothing under the creative engine', () => {
    const offenders = [];
    for (const rel of KERNEL_DIAGRAM_SURFACE) {
      const code = readFileSync(join(CONTROL_ROOT, rel), 'utf8');
      for (const spec of specifiers(code)) {
        const t = resolveSpec(spec, rel);
        if (t && bucketOf(t) === 'creative') offenders.push(`${rel}  →  ${t}`);
      }
    }
    expect(offenders, `kernel diagram surface → creative imports:\n${offenders.join('\n')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The 2.0 carve fence — F and G.
// See lite-template/integration/_0828/mojulo-2.0-pure-creative.plan.md (Phase 1).
//
// 2.0 demotes ONLY the chatbot factory to an optional pack; the rest of the former
// office wing (connected-services / catalysts / triggers / apps / plan / research /
// stash) is RETAINED as always-present orchestration plumbing. Checks A–E cannot see
// that line: they bucket the whole former office wing as one OPS_ENGINE, so an import
// from the RETAINED plumbing into the CARVED factory is intra-bucket and invisible.
// F and G draw the new fence — nothing outside the chatbot factory may import the
// chatbot factory — which is the property that makes the Phase 3 extraction mechanical
// rather than archaeological.
//
// F is a true fence (zero allowlist): the lib/ side of the cut is already clean.
// G is a LEDGER, not a fence: the dashboard still has 20 route files bound to the
// factory, and no phase has moved them yet. Freezing the set stops the coupling from
// growing while Phase 1/3 works it down, and each removal must delete its ledger line.
const CARVE_ENGINE = [
  'lib/deployers/', 'lib/builder/', 'lib/composer/', 'lib/fleet/', 'lib/form-schema-config/',
];
// lib/fleet-scene is deliberately NOT carve-engine: loadFleetScene() returns the HOST
// topology — {ground:{bots,apps}, air:{servers,services}} — and /map + /mcp-skills render
// it. Only its BOTS LAYER is bot-related, and that rides the deployments repository, so it
// is policed by H (the data ledger) rather than by the directory fence.

// The stance (2026-08-28): everything bot-related carves, and is absent unless bots are on.
// "Bot-related" is not only the engine directories — it is also the bot DATA. A retained
// module that reads the deployments table is just as coupled as one that imports a deployer,
// and the engine fence above is blind to it. H is that second fence.
const CARVE_DATA = [
  'lib/db/repositories/deployments',
  'lib/db/repositories/builderSessions',
  'lib/db/repositories/deploymentEvents',
  'lib/db/repositories/botSpaces',
];
const CARVE_PACKS = new Set(['pack_bot_build', 'pack_bot_operate', 'pack_fleet']);

const inCarveDir = (rel) => CARVE_ENGINE.some((p) => rel.startsWith(p));

// Every carve-engine module a file imports (repo-relative), as seen from `rel`.
function carveImports(rel) {
  let code;
  try { code = readFileSync(join(CONTROL_ROOT, rel), 'utf8'); } catch { return []; }
  return specifiers(code)
    .map((s) => resolveSpec(s, rel))
    .filter((t) => t && inCarveDir(t));
}

// Which packs a tool file serves, resolved from the tool names it registers.
const PACK_BY_TOOL = new Map();
for (const pack of PACKS) for (const name of pack.members) PACK_BY_TOOL.set(name, pack.id);
const REGISTERED_TOOL_RE = /name:\s*['"]([a-z_]+)['"]/g;
function packsServed(rel) {
  let code;
  try { code = readFileSync(join(CONTROL_ROOT, rel), 'utf8'); } catch { return new Set(); }
  const out = new Set();
  let m;
  REGISTERED_TOOL_RE.lastIndex = 0;
  while ((m = REGISTERED_TOOL_RE.exec(code))) {
    const id = PACK_BY_TOOL.get(m[1]);
    if (id) out.add(id);
  }
  return out;
}

describe('pack boundary — the 2.0 chatbot-factory carve fence', () => {
  const libFiles = walk(join(CONTROL_ROOT, 'lib'))
    .map((abs) => posix.normalize(abs.slice(CONTROL_ROOT.length + 1)));

  it('F: nothing under lib/ outside the chatbot factory imports the chatbot factory', () => {
    const offenders = [];
    const straddlers = [];
    for (const rel of libFiles) {
      if (inCarveDir(rel)) continue; // the factory may import itself
      const hits = carveImports(rel);
      if (!hits.length) continue;

      // A tool file that registers ONLY carve-pack tools is part of the factory and
      // travels with it — that is a legitimate importer, not a fence breach.
      const served = packsServed(rel);
      const servesCarve = [...served].some((id) => CARVE_PACKS.has(id));
      const servesRetained = [...served].some((id) => !CARVE_PACKS.has(id));
      if (servesCarve && !servesRetained) continue;

      // A file registering BOTH carve and retained tools cannot travel either way:
      // it has to be split before the factory can be extracted.
      if (servesCarve && servesRetained) {
        straddlers.push(`${rel}  serves ${[...served].join(' + ')}`);
        continue;
      }
      for (const t of new Set(hits)) offenders.push(`${rel}  →  ${t}`);
    }
    expect(
      straddlers,
      `tool files registering BOTH carved and retained tools (must be split):\n${straddlers.join('\n')}`,
    ).toEqual([]);
    expect(
      offenders,
      `retained lib/ modules importing the chatbot factory:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  // Frozen 2026-08-28. Every entry is a dashboard route still wired to the factory —
  // a bot-factory SURFACE that travels with @mojulo/chatbot or gets gated behind it.
  // These are edges the plan's "the cut is clean" audit did not see, because that audit
  // swept lib/ and not app/.
  const APP_CARVE_LEDGER = [
    'app/api/builder/stream/route.js',
    'app/api/data/analytics/route.js',
    'app/api/data/conversations/route.js',
    'app/api/data/export/route.js',
    'app/api/data/sql/route.js',
    'app/api/deployments/[id]/build/route.js',
    'app/api/deployments/[id]/cloud-deploy/route.js',
    'app/api/deployments/[id]/connection/route.js',
    'app/api/deployments/[id]/conversations/[conversationId]/route.js',
    'app/api/deployments/[id]/conversations/export/route.js',
    'app/api/deployments/[id]/conversations/route.js',
    'app/api/deployments/[id]/download/route.js',
    'app/api/deployments/[id]/route.js',
    'app/api/deployments/[id]/storage/route.js',
    'app/api/deployments/[id]/submissions/export/route.js',
    'app/api/deployments/[id]/submissions/route.js',
    'app/api/deployments/route.js',
    'app/api/preview/chat/route.js',
    'app/api/preview/extract/route.js',
  ];

  it('G: the app/ → chatbot-factory ledger is exact (no new coupling, no stale lines)', () => {
    const actual = walk(join(CONTROL_ROOT, 'app'))
      .map((abs) => posix.normalize(abs.slice(CONTROL_ROOT.length + 1)))
      .filter((rel) => carveImports(rel).length > 0)
      .sort();
    const frozen = new Set(APP_CARVE_LEDGER);
    const added = actual.filter((rel) => !frozen.has(rel));
    const stale = APP_CARVE_LEDGER.filter((rel) => !actual.includes(rel));
    expect(
      added,
      `NEW app/ routes coupled to the chatbot factory — the carve is supposed to be ` +
        `shrinking, not growing. Move the logic behind a factory tool, or add the line ` +
        `to APP_CARVE_LEDGER with a reason:\n${added.join('\n')}`,
    ).toEqual([]);
    expect(
      stale,
      `APP_CARVE_LEDGER lines whose coupling is gone — delete them (progress!):\n${stale.join('\n')}`,
    ).toEqual([]);
  });

  // ── H: the bot-DATA ledger ────────────────────────────────────────────────
  // The seams the directory fence structurally cannot see. Each entry is retained
  // code reading a bot table, and each one must end up gated so the module works
  // with the chatbot pack ABSENT (bots simply are not there) rather than broken.
  // Entries already in APP_CARVE_LEDGER are excluded — they are accounted for as
  // factory surfaces and travel wholesale; H is only what is left behind.
  //
  //   lib/mcp/session-binding.js   kernel TRANSPORT binding an MCP session to a
  //                                BuilderSession — the deepest seam; the kernel
  //                                itself must stop knowing the concept (Phase 3 ABI).
  //   lib/mcp/tools/catalysts.js   RETAINED catalysts pack reading the bot list.
  //   lib/mcp/tools/meta-context.js RETAINED connected-services reading the bot list.
  //   lib/fleet-scene/loader.js    host-topology scene whose BOTS LAYER must become
  //                                an optional contributor yielding [] when absent.
  //   app/api/registry/bots/…      a bots registry endpoint on the retained registry.
  //   app/api/documents/…          document/RAG surface shared with stashes media —
  //                                split the bot-RAG path from the shared path.
  //   app/api/generate-form/…      form-schema generation keyed on a deployment.
  const BOT_DATA_LEDGER = [
    'app/api/documents/[id]/route.js',
    'app/api/documents/route.js',
    'app/api/generate-form/route.js',
    'app/api/registry/bots/route.js',
    'lib/fleet-scene/loader.js',
    'lib/mcp/session-binding.js',
    'lib/mcp/tools/catalysts.js',
    'lib/mcp/tools/meta-context.js',
  ];

  it('H: the retained-code → bot-data ledger is exact (shrink-only)', () => {
    const carveTravels = new Set(APP_CARVE_LEDGER);
    const all = [...libFiles, ...walk(join(CONTROL_ROOT, 'app'))
      .map((abs) => posix.normalize(abs.slice(CONTROL_ROOT.length + 1)))];
    const actual = all
      .filter((rel) => !inCarveDir(rel) && !carveTravels.has(rel))
      .filter((rel) => {
        const served = packsServed(rel);
        // a pure factory tool file travels with the pack — not a retained seam
        if (served.size && [...served].every((id) => CARVE_PACKS.has(id))) return false;
        let code;
        try { code = readFileSync(join(CONTROL_ROOT, rel), 'utf8'); } catch { return false; }
        return specifiers(code)
          .map((spec) => resolveSpec(spec, rel))
          .some((t) => t && CARVE_DATA.some((d) => t === d || t.startsWith(`${d}.`)));
      })
      .sort();
    const frozen = new Set(BOT_DATA_LEDGER);
    const added = actual.filter((rel) => !frozen.has(rel));
    const stale = BOT_DATA_LEDGER.filter((rel) => !actual.includes(rel));
    expect(
      added,
      `NEW retained code reading bot tables. Everything bot-related is supposed to be ` +
        `carving OUT, not spreading. Gate it behind the chatbot pack, or add the line to ` +
        `BOT_DATA_LEDGER with a reason:\n${added.join('\n')}`,
    ).toEqual([]);
    expect(
      stale,
      `BOT_DATA_LEDGER lines whose bot-data coupling is gone — delete them (progress!):\n${stale.join('\n')}`,
    ).toEqual([]);
  });
});
