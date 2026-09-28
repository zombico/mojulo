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
 *      creative-engine module; the cook layer (lib/outcomes) imports neither.
 *   B. no SINGLE file (anywhere under lib/, e.g. an MCP tool handler) imports BOTH engines. This is
 *      the operator-world guard: that tool straddled both packs by direct import and was removed;
 *      nothing may reintroduce the shape. Cross-pack composition rides kernel-stored refs, not
 *      imports (see the plan's "Composition" section).
 *
 * Tests, spikes, and generated files are exempt — they legitimately reach across for coverage.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, posix } from 'node:path';
import { PACKS } from '@/lib/mcp/packs';

const CONTROL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Engine buckets (dir prefixes, repo-relative, trailing slash so `fleet/` ≠ `fleet-scene/`).
// lib/visual-language is a single zero-import pure-config module (presentation-theme
// CSS-var presets) shared by both wings (cook, figure, motion) — kernel-grade
// vocabulary, not the render engine. Per the model/render principle it is NOT bucketed
// as creative (install-capabilities.plan.md P3b).
// lib/preview is NOT creative: build-preview-config.js turns bot-wizard state into the bot
// runtime's /context shape for the wizard's live preview. It is bot-factory code, bucketed with
// the ops engines below and fenced by the carve (CARVE_ENGINE).
const CREATIVE_ENGINE = ['lib/graph/', 'lib/motion/'];
const OPS_ENGINE = [
  'lib/deployers/', 'lib/builder/', 'lib/composer/', 'lib/fleet/', 'lib/fleet-scene/',
  'lib/connected-services/', 'lib/triggers/', 'lib/apps/', 'lib/app-mcp-scaffold/',
  'lib/runtime-adapters/', 'lib/form-schema-config/', 'lib/preview/',
];
// lib/outcomes is the COOK layer: the writers that cook / forge_publications file outcome
// folders with (pack_stash). It is not ops: no automation or bot engine uses it, and it was
// only bucketed there because pack_stash sits in the office wing. It is not the creative
// engine either: its report-kind writers are render-free and its one render bridge
// (resolvers/sketch.js) loads the creative renderers lazily, so the office tool that imports
// it (cook.js) still loads without the renderers (check D). Its own bucket keeps that
// property explicit: check A requires it to import neither engine statically. Its pure path
// helper lives in the kernel (lib/outcomes-paths.js).
const COOK_LAYER = ['lib/outcomes/'];

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
  if (COOK_LAYER.some((p) => rel.startsWith(p))) return 'cook';
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
      if (from === 'cook' && (t.bucket === 'creative' || t.bucket === 'ops')) {
        crossEngine.push(`${rel}  →  ${t.rel}`);
      }
    }
    if (touchesCreative && touchesOps) straddlers.push(rel);
  }

  it('A: creative and ops engines do not import each other, and the cook layer imports neither', () => {
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
// G is a LEDGER, not a fence: the dashboard still has route files bound to the
// factory, and no phase has moved them yet. Freezing the set stops the coupling from
// growing while Phase 1/3 works it down, and each removal must delete its ledger line.
// H (bot data) and I (bot-only files outside the engine directories) are ledgers too.
// In 3.0 the factory leaves mojulo for its own project, and these lists are its carve list.
const CARVE_ENGINE = [
  'lib/deployers/', 'lib/builder/', 'lib/composer/', 'lib/fleet/', 'lib/form-schema-config/',
  'lib/preview/',
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
  'lib/db/repositories/mcpJobs',
];
const CARVE_PACKS = new Set(['pack_bot_build', 'pack_bot_operate', 'pack_fleet']);

// The bot-only modules OUTSIDE the engine directories (listed 2026-09-27 for the 3.0 carve-out).
// The directory fence cannot see a single file, so a retained module could import one of these
// without any check noticing. Each is used only by the chatbot factory and leaves mojulo with
// it. I (below) fences them; G counts the app/ routes bound to them.
// Deliberately NOT listed:
//   - lib/fleet-scene/loader.js — host topology for /map and /mcp-skills; it stays, and only its
//     bots layer leaves (policed by H through the deployments repository);
//   - the shared infrastructure mojulo keeps and the factory's own project copies: api keys and
//     deployment-auth, llm-providers, envelope-schema, storage, lazy-deps, the embedder, and the
//     documents repository's read side (the stash media route still reads legacy doc_ rows);
//   - the four bot tool modules (build, jobs-tools, operate, fleet): packsServed() finds them
//     through CARVE_PACKS.
const CARVE_FILES = [
  'lib/agent-chat/relay.js', // the chat_turn relay body of the builder web chat
  'lib/agent-ui/signal-bus.js', // chat signals and decisions for a live builder turn
  'lib/audit-logger-new.js', // the builder stream's audit log
  'lib/auth/gate.js', // requireLLMKey for the wizard and chat-builder pages
  'lib/auth/service.js', // getCurrentUser; only bot routes call it
  'lib/config-builder.js', // wizard state to bot config and back
  'lib/db/repositories/appSettings.js', // holds builder_driver_mode only
  'lib/db/repositories/mcpJobs.js', // the mcp_jobs table (also in CARVE_DATA)
  'lib/document-parser.js', // officeparser / pdf2json for bot documents
  'lib/embedder/chunker.js', // bot RAG chunking
  'lib/embedder/preview-rag.js', // the wizard preview's RAG
  'lib/form-structure-schema.js', // generate-form's schema
  'lib/mcp/jobs.js', // async jobs for process_documents / save_modular_bot
  'lib/mcp/session-binding.js', // binds an MCP session to a BuilderSession
  'lib/mcp/tools/agent-ui.js', // emit_chat_signal / request_chat_decision, for chat_turn only
  'lib/net/public-fetch.js', // the SSRF guard of upload_document_from_url
  'lib/rate-limiter.js', // rate limits of the bot routes
  'lib/resolve-api-key.js', // LLM key resolution for deployments and previews
  'lib/version/bot-image.js', // the pinned mojulo-bot image
];

const noExt = (rel) => rel.replace(/\.(jsx?|mjs)$/, '');
const CARVE_FILE_BY_KEY = new Map(CARVE_FILES.map((rel) => [noExt(rel), rel]));
const inCarveDir = (rel) => CARVE_ENGINE.some((p) => rel.startsWith(p));
const isCarveFile = (rel) => CARVE_FILE_BY_KEY.has(noExt(rel));
const inCarve = (rel) => inCarveDir(rel) || isCarveFile(rel);

// Every module a file imports (repo-relative), as seen from `rel`.
function importTargets(rel) {
  let code;
  try { code = readFileSync(join(CONTROL_ROOT, rel), 'utf8'); } catch { return []; }
  return specifiers(code)
    .map((s) => resolveSpec(s, rel))
    .filter(Boolean);
}
// Every carve-engine module a file imports: the directory fence (F).
const carveDirImports = (rel) => importTargets(rel).filter(inCarveDir);
// Every carve module a file imports, engine directory or listed file (G).
const carveImports = (rel) => importTargets(rel).filter(inCarve);

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
      if (inCarve(rel)) continue; // the factory may import itself
      const hits = carveDirImports(rel);
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

  // ── I: the bot-only files outside the engine directories ─────────────────
  // CARVE_FILES is exact both ways: every line names a file that exists, and the only retained
  // lib/ modules that import one are the frozen seams below. A seam is a retained module that
  // still reaches bot-only code and has to be cut (not moved) when the factory leaves:
  //   lib/version/local.js  getBotImagePin() for version / check_for_updates.
  // Shrink-only, like G and H: a line whose coupling is gone is deleted.
  // The scan reads static imports only. registerAllTools() in lib/mcp/server.js reaches the bot
  // tool modules (agent-ui.js among them) through dynamic import(), which this scan cannot see;
  // lib/mcp/carve-boundary.test.js traces what a boot actually loads.
  const CARVE_FILE_SEAMS = [
    'lib/version/local.js  →  lib/version/bot-image.js',
  ];

  it('I: the bot-only files are ledgered exactly, and retained lib/ reaches them only through frozen seams', () => {
    const missing = CARVE_FILES.filter((rel) => !existsSync(join(CONTROL_ROOT, rel)));
    expect(
      missing,
      `CARVE_FILES lines naming a file that no longer exists — delete them:\n${missing.join('\n')}`,
    ).toEqual([]);

    const actual = [];
    for (const rel of libFiles) {
      if (inCarve(rel)) continue; // the factory may import itself
      const served = packsServed(rel);
      // a pure factory tool module travels with the pack — not a retained seam
      if (served.size && [...served].every((id) => CARVE_PACKS.has(id))) continue;
      const hits = new Set(importTargets(rel).filter(isCarveFile).map((t) => CARVE_FILE_BY_KEY.get(noExt(t))));
      for (const t of hits) actual.push(`${rel}  →  ${t}`);
    }
    actual.sort();
    const frozen = new Set(CARVE_FILE_SEAMS);
    const added = actual.filter((edge) => !frozen.has(edge));
    const stale = CARVE_FILE_SEAMS.filter((edge) => !actual.includes(edge));
    expect(
      added,
      `NEW retained lib/ modules importing bot-only code. Everything bot-related is carving OUT. ` +
        `Import the shared module instead, or add the edge to CARVE_FILE_SEAMS with a reason:\n${added.join('\n')}`,
    ).toEqual([]);
    expect(
      stale,
      `CARVE_FILE_SEAMS lines whose coupling is gone — delete them (progress!):\n${stale.join('\n')}`,
    ).toEqual([]);
  });

  // Frozen 2026-08-28. Every entry is a dashboard route still wired to the factory —
  // a bot-factory SURFACE that travels with @mojulo/chatbot or gets gated behind it.
  // These are edges the plan's "the cut is clean" audit did not see, because that audit
  // swept lib/ and not app/.
  // Extended 2026-09-27 when CARVE_FILES joined the fence: the agent-ui respond route, the
  // document and form-generation routes, the builder-driver setting, the RAG vectorizer and the
  // two layouts behind requireLLMKey are bound to bot-only files, not to an engine directory.
  const APP_CARVE_LEDGER = [
    'app/api/agent-ui/respond/route.js',
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
    'app/api/documents/route.js',
    'app/api/generate-form/route.js',
    'app/api/preview/chat/route.js',
    'app/api/preview/extract/route.js',
    'app/api/settings/app/route.js',
    'app/api/vectorize-rag/route.js',
    'app/bot-factory/modular/layout.js',
    'app/chat-builder/layout.js',
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
  // factory surfaces and travel wholesale — and so are CARVE_FILES, which leave with
  // the factory; H is only what is left behind.
  //
  //   lib/mcp/tools/catalysts.js   RETAINED catalysts pack reading the bot list.
  //   lib/mcp/tools/meta-context.js RETAINED connected-services reading the bot list.
  //   lib/fleet-scene/loader.js    host-topology scene whose BOTS LAYER must become
  //                                an optional contributor yielding [] when absent.
  //   app/api/registry/bots/…      a bots registry endpoint on the retained registry.
  //   app/api/documents/[id]/…     the bot document library's per-document route.
  // Left 2026-09-27: lib/mcp/session-binding.js (bot-only, now in CARVE_FILES) and the
  // documents and generate-form collection routes (now in APP_CARVE_LEDGER).
  const BOT_DATA_LEDGER = [
    'app/api/documents/[id]/route.js',
    'app/api/registry/bots/route.js',
    'lib/fleet-scene/loader.js',
    'lib/mcp/tools/catalysts.js',
    'lib/mcp/tools/meta-context.js',
  ];

  it('H: the retained-code → bot-data ledger is exact (shrink-only)', () => {
    const carveTravels = new Set(APP_CARVE_LEDGER);
    const all = [...libFiles, ...walk(join(CONTROL_ROOT, 'app'))
      .map((abs) => posix.normalize(abs.slice(CONTROL_ROOT.length + 1)))];
    const actual = all
      .filter((rel) => !inCarve(rel) && !carveTravels.has(rel))
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
