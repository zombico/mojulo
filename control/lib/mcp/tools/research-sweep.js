/**
 * run_experiment_sweep — variations in one call (Workflows).
 *
 * Three forms. `{ ref, path, values }` varies any stored recipe at one JSON Pointer: a new sketch per value, all in one
 * new folder (variationSweep below). `{ ref, concept, n }` is a mangekyou order (lib/graph/mangekyou/): n visual
 * variants of the design in words, routed to the department that owns it, pass after pass (mangekyouSweep below).
 * `{ research_ref, base, param, values }` is the mechanics experiment, below.
 *
 * A parameter sweep is what every quantitative question actually is ("what happens to X as
 * I vary Y?"), and before this verb it lived as N manual mints + N manual binds with the
 * discipline documented only in the numerical-experiment-notebook catalyst. This tool
 * formalizes that loop in one deterministic call: per swept value it mints the science
 * view, derives SI outcomes from the measure channel, and binds one provenance-carrying
 * `experiment` item; then it auto-plots param-vs-outcome (experimentsToChartManifest — a
 * pure derive, sibling of the research hub-spoke) and binds the figure as a `sketch` item.
 * The book ends the call holding the whole experiment: hypothesis-ready inputs, N
 * reproducible runs, one comparative figure.
 *
 * v0 sweeps mechanics-view DYNAMICS recipes only — the SI-honest, single-body scenarios
 * the sampler accepts. Orbit scenarios are presets with nothing numeric to sweep; the
 * non-SI views are excluded by the same honesty boundary get_exhibit's read-back enforces. Gates run
 * up front (session, param allowlist, scenario measurable via a dry sample of the base
 * recipe) so a sweep never half-binds into the book on a bad recipe.
 *
 * Coupling: imports research-mode's bind handler (same ring, same gate the agent would
 * hit), the mechanics mint, and the graph-side sampler/derive. Nothing here is imported
 * by plan mode or the views — the one-way discipline holds.
 */

import { registerTool } from '@/lib/mcp/server';
import { ResearchRepository } from '@/lib/db/repositories/research';
import { bindResearchItemHandler } from '@/lib/mcp/tools/research-mode';
// mintMechanicsView + the physics sampler are loaded lazily in the handler (see
// loadMechanics below) so this office/research tool carries no static dependency
// on the creative render engine.
import { mintSketch } from '@/lib/mcp/tools/sketches';
import { experimentsToChartManifest } from '@/lib/sketch-derive';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { applyManifestPatch, parsePointer } from '@/lib/mcp/tools/manifest-patch';

// Lazy creative-side loader (P3b): mint + sample a mechanics-view. Absent creative
// install → advisory, so run_experiment_sweep neither lists nor loads render code.
async function loadMechanics() {
  try {
    const [tool, view] = await Promise.all([
      import('@/lib/mcp/tools/mechanics-view'),
      import('@/lib/graph/views/science/mechanics-view'),
    ]);
    return {
      mintMechanicsView: tool.mintMechanicsView,
      sampleMechanicsPhysics: view.sampleMechanicsPhysics,
      MEASURABLE_MECHANICS_SCENARIOS: view.MEASURABLE_MECHANICS_SCENARIOS,
    };
  } catch {
    throw new Error('run_experiment_sweep sweeps a creative mechanics-view (render engine), which is not installed on this host.');
  }
}

// the sweepable knobs — the numeric params the dynamics rules actually read (mirrors
// sampleMechanicsPhysics's P). Sweeping anything else would mint N identical worlds.
const SWEEPABLE_PARAMS = new Set(['v0', 'angle', 'g', 'mu', 'length', 'height', 'mass', 'k', 'amplitude', 'radius', 'curl', 'spin', 'diameter', 'density']);

const MIN_POINTS = 2;
const MAX_POINTS = 12;

// per-run outcomes, all derived from the SI series (never the render path). flightTime is
// the rule's T (period for looping scenarios); range is horizontal displacement.
const OUTCOMES = {
  flightTime: (m) => +m.T.toFixed(6),
  range: (m) => {
    const first = m.samples[0].pos, last = m.samples[m.samples.length - 1].pos;
    return +Math.hypot(last[0] - first[0], last[1] - first[1]).toFixed(6);
  },
  maxHeight: (m) => +Math.max(...m.samples.map((s) => s.pos[2])).toFixed(6),
  maxSpeed: (m) => +Math.max(...m.samples.map((s) => s.speed)).toFixed(6),
  // lateral bend off the aim line (flight: the Magnus curl; planar scenarios read 0).
  curl: (m) => +Math.max(...m.samples.map((s) => Math.abs(s.pos[1]))).toFixed(6),
};
const OUTCOME_UNITS = { flightTime: 's', range: 'm', maxHeight: 'm', maxSpeed: 'm/s', curl: 'm' };

/** The value at a JSON Pointer in `doc`, or undefined. */
function valueAt(doc, segments) {
  let node = doc;
  for (const seg of segments) {
    if (node === null || typeof node !== 'object') return undefined;
    node = node[Array.isArray(node) ? Number(seg) : seg];
  }
  return node;
}

/**
 * Variations: one stored recipe varied over one value. Per value the stored manifest is copied, the value is set at the
 * JSON Pointer `path`, and the copy is minted through create_sketch's own gates as a new sketch; the variants land in one
 * new folder, which the gallery shows together. The source sketch is never written. A kind gates in its own mint, so
 * the sweep stops at the first variant its gate refuses and answers what it minted and what was refused.
 */
async function variationSweep({ ref, path, values, title }) {
  const base = SketchRepository.getByRef(ref);
  if (!base) throw new Error(`No sketch exists at ref '${ref}'`);
  const manifest = base.manifest;
  if (!manifest || typeof manifest !== 'object') throw new Error(`'${ref}' has no stored manifest to vary`);
  // loaded here, not at the top: this office file carries no static creative import (pack-boundary.test.js)
  const [{ isBeatsKind }, { isVoiceRegisterKind }] = await Promise.all([import('@/lib/graph/beats/beats-manifest'), import('@/lib/graph/voice/voice-register')]);
  if (isBeatsKind(manifest.kind) || isVoiceRegisterKind(manifest.kind)) {
    throw new Error(`'${ref}' is a ${manifest.kind}; vary it with its own tool (update_beats / create_voice), which validates it`);
  }
  const segments = parsePointer(path, 'run_experiment_sweep');
  const was = valueAt(manifest, segments);
  if (was === undefined) throw new Error(`'${ref}' has nothing at '${path}': a sweep varies a value the recipe already sets`);
  if (!Array.isArray(values) || values.length < MIN_POINTS || values.length > MAX_POINTS) {
    throw new Error(`values must be ${MIN_POINTS}–${MAX_POINTS} values (got ${Array.isArray(values) ? values.length : 'none'})`);
  }
  const keys = values.map((v) => JSON.stringify(v));
  if (new Set(keys).size !== keys.length) throw new Error('values repeat: each value mints one variant');
  const { createSketchHandler } = await import('@/lib/mcp/tools/sketch-mint');
  const name = title ?? `${base.title} · ${path}`;
  const folder = SketchFolderRepository.create({ name: name.slice(0, 120) });
  const variants = [];
  for (const [i, value] of values.entries()) {
    const next = applyManifestPatch(manifest, [{ op: 'set', path, value }]).manifest;
    try {
      const made = await createSketchHandler({ title: `${base.title} · ${path} = ${keys[i]}`.slice(0, 200), manifest: next, folder_ref: folder.ref });
      variants.push({ value, ref: made.ref, url: made.url });
    } catch (err) {
      return { ok: false, from: ref, path, was, folder_ref: folder.ref, variants, refused: { value, error: err.message },
        note: `Minted ${variants.length} of ${values.length}; the variant at ${keys[i]} was refused by its kind's gate. Nothing after it was minted.` };
    }
  }
  return { ok: true, from: ref, path, was, folder_ref: folder.ref, variants,
    note: `${variants.length} variants of '${ref}' in folder ${folder.ref}; '${ref}' is unchanged. Keep one with update_sketch on its ref.` };
}

/** The folders a design's variations are filed in start with this, so a later order finds what was shown. */
const folderPrefix = (ref) => `mk-${ref}-`;

/** The stored manifest at a ref, or a refusal that names the role it was given for. */
function storedManifest(ref, role) {
  if (typeof ref !== 'string' || !ref) throw new Error(`\`${role}\` holds sketch refs`);
  const row = SketchRepository.getByRef(ref);
  if (!row) throw new Error(`No sketch exists at ref '${ref}' (${role})`);
  if (!row.manifest || typeof row.manifest !== 'object') throw new Error(`'${ref}' has no stored manifest (${role})`);
  return row;
}

/**
 * A MANGEKYOU ORDER through the variations door: the design at `ref` (narrowed by `at`), a concept in words, n, and
 * optionally its principles, kept and rejected variants of a pass before. The order is rolled here, when it is
 * authored (never in the library), and answered with its roll, its team and its context. `mint` (default) mints each
 * variant through create_sketch's gates into one new folder, the gallery being the contact sheet, and stands a reserve
 * variant in for one its kind refuses; `mint: false` answers the patches alone, for a department to hold. The design
 * is never written.
 */
async function mangekyouSweep(input) {
  const { ref, concept, n, at, principles, keep = [], reject = [], spread, roll, mint = true, title, by = 'user' } = input;
  const base = storedManifest(ref, 'ref');
  const [{ isBeatsKind }, { isVoiceRegisterKind }, { turnMangekyou, rollOrder }] = await Promise.all([
    import('@/lib/graph/beats/beats-manifest'), import('@/lib/graph/voice/voice-register'), import('@/lib/graph/mangekyou/index.js')]);
  if (isBeatsKind(base.manifest.kind) || isVoiceRegisterKind(base.manifest.kind)) {
    throw new Error(`'${ref}' is a ${base.manifest.kind}; vary it with its own tool (update_beats / create_voice), which validates it`);
  }
  if (concept !== undefined && typeof concept !== 'string') throw new Error('`concept` is the variation asked for, in words');
  if (!Array.isArray(keep) || !Array.isArray(reject)) throw new Error('`keep` and `reject` are lists of variant refs from a pass before');
  if (roll !== undefined && (!Number.isInteger(roll) || roll < 1)) throw new Error('`roll` replays an order: the roll a pass answered');
  if (typeof by !== 'string' || !by) throw new Error("`by` is who asks: 'user', or the department working its chapter");
  const kept = keep.map((r) => storedManifest(r, 'keep').manifest);
  const rejected = reject.map((r) => storedManifest(r, 'reject').manifest);
  // what this design's earlier orders showed (their folders are named for it), but what is kept or rejected now; a
  // replay (`roll` given) is the order it replays, so it looks away from nothing new
  const named = new Set([...keep, ...reject]);
  const seen = roll !== undefined ? [] : SketchRepository.inFoldersStartingWith(folderPrefix(ref)).filter((row) => !named.has(row.ref)).map((row) => row.manifest).filter(Boolean);
  // a shape asked of a made thing is picked again by its outline (drawn, not guessed): the pool drawn wider for it
  const steer = mint && OUTLINED_KINDS.has(base.manifest.kind);
  const turned = turnMangekyou({ manifest: base.manifest, concept, n, at, principles, kept, rejected, seen, spread, roll: roll ?? rollOrder(), by,
    ...(steer ? { reserve: 2 * (n ?? 4) } : {}) });
  const order = { ...turned.order, from: { ref, title: base.title, kind: base.manifest.kind ?? null }, keep, reject };
  const keepVia = order.team.keep === 'design_game' ? `design_game({ ref: '${ref}', patch })` : `update_sketch({ ref: '${ref}', patch })`;
  const next = `Next pass: run_experiment_sweep({ ref: '${ref}', concept, keep: [refs you like], reject: [refs you do not] }). `
    + `Take one onto the design: ${keepVia} with its patch. Same order again: pass back roll ${order.roll}.`;
  const said = (v) => ({ id: v.id, says: v.says, moves: v.moves, patch: v.patch, distance: v.distance });
  if (!mint) return { ok: true, from: ref, order, variants: turned.variants.map(said), spread: turned.spread, next };

  const { createSketchHandler } = await import('@/lib/mcp/tools/sketch-mint');
  const name = (title ?? `${base.title} · ${concept ?? 'variations'}`).slice(0, 120);
  const folder = SketchFolderRepository.create({ name, ref: `${folderPrefix(ref)}${rollOrder().toString(36)}` });
  const variants = [], refused = [];
  const shapes = steer && turned.order.concept.weights.silhouette >= 0.5 ? await outlineStore(base) : null;
  let queue = [...turned.variants], reserve = [...turned.reserve];
  if (shapes) {
    // the outline picks among all the candidates: the n farthest apart in shape first, the rest standing by in order
    const all = [...queue, ...reserve], byId = new Map(all.map((v) => [v.id, v]));
    for (const v of all) await shapes.add(v.id, v.manifest);
    const ranked = shapes.pick(all.map((v) => v.id), queue.length).map((id) => byId.get(id));
    queue = ranked.slice(0, queue.length); reserve = ranked.slice(queue.length);
  } else reserve = reserve.slice(0, turned.variants.length);
  while (queue.length && variants.length < turned.variants.length) {
    const v = queue.shift();
    try {
      const made = await createSketchHandler({ title: `${base.title} · ${v.id} · ${v.says}`.slice(0, 200), manifest: v.manifest, folder_ref: folder.ref });
      variants.push({ ...said(v), ref: made.ref, url: made.url });
    } catch (err) {
      refused.push({ id: v.id, says: v.says, error: err.message });
      if (reserve.length) queue.push(reserve.shift());
    }
  }
  const outlines = await outlinesOf(base, variants, shapes);
  return { ok: variants.length > 0, from: ref, order, folder_ref: folder.ref, variants, ...(refused.length ? { refused } : {}), spread: turned.spread,
    ...(outlines ? { outlines } : {}),
    note: `${variants.length} variants of '${ref}' in folder ${folder.ref}, routed to ${order.team.name.toLowerCase()} (${order.team.why}); '${ref}' is unchanged. The eyes gate is the gallery's: look before you keep.`,
    next };
}

// the kinds whose outline the gate reads: a made thing the World draws whole and quickly (a prop, a layered body, a
// scad part), never a place, whose outline is its ground
const OUTLINED_KINDS = new Set(['workbench', 'layered', 'scad']);
const SAME_OUTLINE = 0.95;

/** The outline gate over the variants minted (lib/graph/mangekyou/outline.js): each drawn as the World draws it and
 * compared flat from three sides; advisory, and absent for a kind it does not read or a scene that does not resolve. */
/** Outlines drawn once each: the design's at once, a candidate's when it is added; `pick` the ids farthest apart in
 * shape, `masks` what was drawn. Null when the scene does not resolve (the pick falls back to the parameters'). */
async function outlineStore(base) {
  try {
    const [{ resolveWorldScene }, { meshOfFaces, outlineMasks, pickByOutline }] = await Promise.all([import('@/lib/graph/worlds/world-scene.js'), import('@/lib/graph/mangekyou/outline.js')]);
    const draw = async (ref, manifest) => { const mesh = meshOfFaces((await resolveWorldScene({ ref, kind: manifest.kind, manifest })).payload?.faces); return mesh.faces.length ? outlineMasks(mesh) : null; };
    const masks = { design: await draw(base.ref, base.manifest) };
    if (!masks.design) return null;
    return {
      masks,
      async add(id, manifest) { try { const m = await draw(id, manifest); if (m) masks[id] = m; } catch { /* a candidate its scene refuses: no outline, picked last */ } },
      pick: (ids, n) => pickByOutline(masks, ids, n, masks.design),
    };
  } catch { return null; }
}

async function outlinesOf(base, variants, shapes = null) {
  if (!OUTLINED_KINDS.has(base.manifest.kind) || variants.length < 1) return null;
  try {
    const store = shapes ?? await outlineStore(base);
    if (!store) return null;
    for (const v of variants) if (!store.masks[v.id]) await store.add(v.id, SketchRepository.getByRef(v.ref).manifest);
    const { outlinesApart } = await import('@/lib/graph/mangekyou/outline.js');
    const ids = ['design', ...variants.map((v) => v.id)].filter((id) => store.masks[id]);
    const gate = { ...outlinesApart(Object.fromEntries(ids.map((id) => [id, {}])), { masks: store.masks }), ...(shapes ? { steered: true } : {}) };
    // a variant whose outline is the design's all but exactly: another coat, not another shape
    const shared = Object.entries(gate.from ?? {}).filter(([, iou]) => iou >= SAME_OUTLINE).map(([id]) => id);
    return { ...gate, pairs: gate.pairs.slice(0, 3),
      says: gate.ok ? (shared.length ? `the variants' outlines differ from each other; ${shared.join(', ')} keep the design's outline (another coat, not another shape)` : 'every variant a shape of its own')
        : `${gate.mostAlike.a} and ${gate.mostAlike.b} read as one outline (${gate.mostAlike.iou}): a silhouette pass may want \`spread: 'wild'\` or a concept that names shape` };
  } catch { return null; }
}

const MANGEKYOU_KEYS = ['concept', 'n', 'at', 'principles', 'keep', 'reject', 'spread', 'roll', 'mint', 'by'];

export async function runExperimentSweepHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('run_experiment_sweep requires { ref, concept, n } (variations in words), { ref, path, values } (one value swept) or { research_ref, base, param, values } (a mechanics experiment)');
  }
  if (input.ref !== undefined) {
    if (typeof input.ref !== 'string' || !input.ref) throw new Error('`ref` is a sketch ref');
    if (input.research_ref !== undefined || input.base !== undefined) throw new Error('`ref` varies a stored recipe; `research_ref` + `base` run a mechanics experiment. Pass one form.');
    if (input.path === undefined && input.values === undefined) return mangekyouSweep(input);
    const stray = MANGEKYOU_KEYS.filter((k) => input[k] !== undefined);
    if (stray.length) throw new Error(`{ ref, path, values } sweeps one value; ${stray.join(', ')} belong to { ref, concept, n } (variations in words). Pass one form.`);
    return variationSweep(input);
  }
  const { research_ref, base, param, values, outcome } = input;
  if (!research_ref || typeof research_ref !== 'string') throw new Error('research_ref is required');
  const session = ResearchRepository.getSession(research_ref);
  if (!session) throw new Error(`Research session '${research_ref}' not found.`);
  if (!base || typeof base !== 'object') throw new Error('base is required — a mechanics-view recipe object ({ scenario, … })');
  if (base.kind !== undefined && base.kind !== 'mechanics-view') {
    throw new Error(`run_experiment_sweep v0 sweeps mechanics-view recipes only (got kind '${base.kind}').`);
  }
  if (!SWEEPABLE_PARAMS.has(param)) {
    throw new Error(`param '${param}' is not sweepable. Sweepable params: ${[...SWEEPABLE_PARAMS].join(', ')}.`);
  }
  const vals = Array.isArray(values) ? values.filter((v) => Number.isFinite(+v)).map(Number) : [];
  if (vals.length < MIN_POINTS || vals.length > MAX_POINTS) {
    throw new Error(`values must be ${MIN_POINTS}–${MAX_POINTS} finite numbers (got ${vals.length}).`);
  }
  const plotOutcome = outcome === undefined ? 'flightTime' : outcome;
  if (!OUTCOMES[plotOutcome]) {
    throw new Error(`outcome '${outcome}' is unknown. Outcomes: ${Object.keys(OUTCOMES).join(', ')}.`);
  }

  const { mintMechanicsView, sampleMechanicsPhysics, MEASURABLE_MECHANICS_SCENARIOS } = await loadMechanics();

  // dry gate: the base recipe must be measurable BEFORE anything binds (rejects machines /
  // engines / compare here, with the sampler's own message).
  sampleMechanicsPhysics({ ...base, [param]: vals[0] });

  const scenario = MEASURABLE_MECHANICS_SCENARIOS.includes(base.scenario) ? base.scenario : 'projectile';
  const table = [];
  for (let index = 0; index < vals.length; index++) {
    const value = vals[index];
    const minted = mintMechanicsView({ ...base, [param]: value, title: `${scenario} — ${param}=${value}` });
    const measured = sampleMechanicsPhysics(minted.recipe);
    const outcomes = Object.fromEntries(Object.entries(OUTCOMES).map(([k, fn]) => [k, fn(measured)]));
    const bound = await bindResearchItemHandler({
      research_ref,
      kind: 'experiment',
      title: `${scenario} — ${param}=${value}`,
      media_ref: minted.ref,
      metadata: { recipe: minted.recipe, stats: minted.stats, series: { param, value, index }, outcomes },
    });
    table.push({ value, ref: minted.ref, item_id: bound.item_id, outcomes });
  }

  // auto-plot: param vs the chosen outcome, minted and bound as the sweep's figure.
  const chartTitle = `${scenario}: ${plotOutcome} vs ${param}`;
  const manifest = experimentsToChartManifest({
    title: chartTitle,
    param,
    outcome: plotOutcome,
    unitY: OUTCOME_UNITS[plotOutcome],
    points: table.map((row) => ({ x: row.value, y: row.outcomes[plotOutcome] })),
  });
  const { ref: chartRef } = mintSketch({ title: chartTitle, manifest });
  const chartBound = await bindResearchItemHandler({
    research_ref,
    kind: 'sketch',
    title: chartTitle,
    media_ref: chartRef,
    metadata: { series: { param, outcome: plotOutcome, points: table.length } },
  });

  return {
    ok: true,
    research_ref,
    scenario,
    param,
    outcome: plotOutcome,
    table,
    chart: { sketch_ref: chartRef, sketch_url: `/sketches/${encodeURIComponent(chartRef)}`, item_id: chartBound.item_id },
    message: `Swept ${param} over ${vals.length} points — ${vals.length} experiment items + 1 figure bound to '${session.title}'. Bind your comparative analysis as a summary, then synthesize_abstract({ review: true }).`,
  };
}

export function registerResearchSweepTools() {
  registerTool({
    name: 'run_experiment_sweep',
    description:
      "Variations of one thing in a call; `ref` is unchanged, the variants minted into one new folder. `{ ref, concept, n }`: "
      + "n visual takes on any design in words ('darker corrupted elites'): colour, size, silhouette, surface, detail; "
      + 'freshly rolled, dispersed, routed to its department; `at` narrows, `principles` lock or bound, `keep`/`reject` '
      + 'refs make the next pass, `mint: false` answers patches. `{ ref, path, values }`: one value at a JSON Pointer, '
      + '2–12 values. `{ research_ref, base, param, values }`: a mechanics-view experiment, per value a world and its SI '
      + 'outcomes bound into the research session, then a plot of param vs `outcome`.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The sketch to vary (variations).' },
        concept: { type: 'string', description: 'The variation, in words.' },
        n: { type: 'integer', description: 'Variants, 1–12 (4).' },
        at: { type: 'string', description: 'JSON Pointer narrowing the design.' },
        principles: { type: 'object', description: '{ lock, palette, bounds, axes, words, notes }.' },
        keep: { type: 'array', items: { type: 'string' }, description: 'Variant refs to turn from.' },
        reject: { type: 'array', items: { type: 'string' }, description: 'Variant refs to move from.' },
        spread: { type: ['string', 'number'], description: 'near | wide | wild, or 0–3.' },
        roll: { type: 'integer', description: 'Replays an order.' },
        mint: { type: 'boolean', description: 'false: patches only.' },
        by: { type: 'string', description: "'user' or a department." },
        path: { type: 'string', description: 'JSON Pointer to the value to vary; the recipe must already set it.' },
        title: { type: 'string', description: 'Folder name.' },
        research_ref: { type: 'string', description: 'The research session to bind the experiment into.' },
        base: { type: 'object', description: "The mechanics-view recipe held constant, e.g. { scenario: 'projectile', v0: 18, angle: 45 }." },
        param: { type: 'string', enum: ['v0', 'angle', 'g', 'mu', 'length', 'height', 'mass', 'k', 'amplitude', 'radius', 'curl', 'spin', 'diameter', 'density'], description: 'The mechanics knob to vary.' },
        values: { type: 'array', description: '2–12 values, one variant each.' },
        outcome: { type: 'string', enum: ['flightTime', 'range', 'maxHeight', 'maxSpeed', 'curl'], description: "What the experiment's plot charts (default 'flightTime')." },
      },
    },
    handler: runExperimentSweepHandler,
  });
}
