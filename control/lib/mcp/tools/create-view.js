/**
 * create_view / get_view_vocab — the consolidated study-object entry point.
 *
 * Instead of one closed `create_*_view` tool per subject (43 of them: the
 * science / math / bio families), `create_view` takes a KIND (the enum) + a
 * PARAMS object and dispatches to the same mint the retired tool wrapped. The
 * per-kind depiction prose, routing phrases, and parameter manual live in the
 * kind's view-vocab card (lib/graph/views/view-vocab/<kind>.md), indexed
 * under source_kind='view_vocab' — semantic_search to find, get_view_vocab to
 * read. Errors teach: unknown kind → the kind list; a failed mint → a pointer
 * at the kind's card.
 *
 * The retired `create_*_view` names remain callable as UNLISTED aliases
 * (listed:false — they resolve in tools/call but don't ride tools/list), so
 * compiled plans / skills that persisted them keep executing. Drop after one
 * release. Stored manifests and the render path are untouched — each view
 * file keeps its mint + handler; only its registerTool block retired.
 * See tool-list-drawerization.plan.md.
 */

import { registerTool } from '@/lib/mcp/server';
import { getViewVocabCatalog } from '@/lib/graph/views/view-vocab/loader';
import { bookViewKinds } from '@/lib/graph/views/recipe-book/registry';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createAtmosphereViewHandler } from '@/lib/mcp/tools/atmosphere-view';
import { createAtomViewHandler } from '@/lib/mcp/tools/atom-view';
import { createBlackHoleViewHandler } from '@/lib/mcp/tools/black-hole-view';
import { createCascadeViewHandler } from '@/lib/mcp/tools/cascade-view';
import { createCellularViewHandler } from '@/lib/mcp/tools/cellular-view';
import { createCherenkovViewHandler } from '@/lib/mcp/tools/cherenkov-view';
import { createCometViewHandler } from '@/lib/mcp/tools/comet-view';
import { createCompleteSquareViewHandler } from '@/lib/mcp/tools/complete-square-view';
import { createComplexViewHandler } from '@/lib/mcp/tools/complex-view';
import { createConicsViewHandler } from '@/lib/mcp/tools/conics-view';
import { createDerivativeViewHandler } from '@/lib/mcp/tools/derivative-view';
import { createDnaViewHandler } from '@/lib/mcp/tools/dna-view';
import { createDoubleSlitViewHandler } from '@/lib/mcp/tools/double-slit-view';
import { createFieldFlowViewHandler } from '@/lib/mcp/tools/field-flow-view';
import { createFieldViewHandler } from '@/lib/mcp/tools/field-view';
import { createFissionViewHandler } from '@/lib/mcp/tools/fission-view';
import { createFluidViewHandler } from '@/lib/mcp/tools/fluid-view';
import { createFtcViewHandler } from '@/lib/mcp/tools/ftc-view';
import { createFusionViewHandler } from '@/lib/mcp/tools/fusion-view';
import { createGalaxyViewHandler } from '@/lib/mcp/tools/galaxy-view';
import { createGravityWaveViewHandler } from '@/lib/mcp/tools/gravity-wave-view';
import { createHeatSphereViewHandler } from '@/lib/mcp/tools/heat-sphere-view';
import { createHydroViewHandler } from '@/lib/mcp/tools/hydro-view';
import { createStarSurfaceViewHandler } from '@/lib/mcp/tools/star-surface-view';
import { createLightningStormViewHandler } from '@/lib/mcp/tools/lightning-storm-view';
import { createMechanicsViewHandler } from '@/lib/mcp/tools/mechanics-view';
import { createMoleculeViewHandler } from '@/lib/mcp/tools/molecule-view';
import { createOceanViewHandler } from '@/lib/mcp/tools/ocean-view';
import { createBeachViewHandler } from '@/lib/mcp/tools/beach-view';
import { createRiverViewHandler } from '@/lib/mcp/tools/river-view';
import { createOrbitViewHandler } from '@/lib/mcp/tools/orbit-view';
import { createParallelTransportViewHandler } from '@/lib/mcp/tools/parallel-transport-view';
import { createPlasmaGlobeViewHandler } from '@/lib/mcp/tools/plasma-globe-view';
import { createProbabilityViewHandler } from '@/lib/mcp/tools/probability-view';
import { createPulsarViewHandler } from '@/lib/mcp/tools/pulsar-view';
import { createPythagorasViewHandler } from '@/lib/mcp/tools/pythagoras-view';
import { createQuadraticViewHandler } from '@/lib/mcp/tools/quadratic-view';
import { createReactorViewHandler } from '@/lib/mcp/tools/reactor-view';
import { createRocketViewHandler } from '@/lib/mcp/tools/rocket-view';
import { createAirplaneViewHandler } from '@/lib/mcp/tools/airplane-view';
import { createSaturnViewHandler } from '@/lib/mcp/tools/saturn-view';
import { createSeriesViewHandler } from '@/lib/mcp/tools/series-view';
import { createStarBirthViewHandler } from '@/lib/mcp/tools/star-birth-view';
import { createSurfaceViewHandler } from '@/lib/mcp/tools/surface-view';
import { createTransformViewHandler } from '@/lib/mcp/tools/transform-view';
import { createTransformerViewHandler } from '@/lib/mcp/tools/transformer-view';
import { createTrigCircleViewHandler } from '@/lib/mcp/tools/trig-circle-view';
import { createVectorMatchViewHandler } from '@/lib/mcp/tools/vector-match-view';
import { createWavepacketViewHandler } from '@/lib/mcp/tools/wavepacket-view';
import { createWindmillViewHandler } from '@/lib/mcp/tools/windmill-view';
// Animated bio PROCESS explainers — folded in from the standalone create_dna_process /
// create_energy_cycle tools (mint-solid-consolidation.plan.md Tier 2 sibling).
import { createDnaProcessHandler } from '@/lib/mcp/tools/dna-process';
import { createEnergyCycleHandler } from '@/lib/mcp/tools/energy-cycle';

// kind → { family, retired tool name, original handler }. The handler keeps
// each view's own param whitelisting/validation; create_view is pure dispatch.
export const VIEW_KINDS = {
  'atmosphere': { family: 'science', retired: 'create_atmosphere_view', handler: createAtmosphereViewHandler },
  'atom': { family: 'science', retired: 'create_atom_view', handler: createAtomViewHandler },
  'beach': { family: 'science', handler: createBeachViewHandler },   // born inside create_view — no retired alias
  'black-hole': { family: 'science', retired: 'create_black_hole_view', handler: createBlackHoleViewHandler },
  'cascade': { family: 'science', retired: 'create_cascade_view', handler: createCascadeViewHandler },
  'cellular': { family: 'bio', retired: 'create_cellular_view', handler: createCellularViewHandler },
  'cherenkov': { family: 'science', retired: 'create_cherenkov_view', handler: createCherenkovViewHandler },
  'comet': { family: 'science', retired: 'create_comet_view', handler: createCometViewHandler },
  'complete-square': { family: 'math', retired: 'create_complete_square_view', handler: createCompleteSquareViewHandler },
  'complex': { family: 'math', retired: 'create_complex_view', handler: createComplexViewHandler },
  'conics': { family: 'math', retired: 'create_conics_view', handler: createConicsViewHandler },
  'derivative': { family: 'math', retired: 'create_derivative_view', handler: createDerivativeViewHandler },
  'dna': { family: 'bio', retired: 'create_dna_view', handler: createDnaViewHandler },
  'double-slit': { family: 'science', retired: 'create_double_slit_view', handler: createDoubleSlitViewHandler },
  'field-flow': { family: 'math', retired: 'create_field_flow_view', handler: createFieldFlowViewHandler },
  'field': { family: 'science', retired: 'create_field_view', handler: createFieldViewHandler },
  'fission': { family: 'science', retired: 'create_fission_view', handler: createFissionViewHandler },
  'fluid': { family: 'science', retired: 'create_fluid_view', handler: createFluidViewHandler },
  'ftc': { family: 'math', retired: 'create_ftc_view', handler: createFtcViewHandler },
  'heat-sphere': { family: 'math', retired: 'create_heat_sphere_view', handler: createHeatSphereViewHandler },
  'hydro': { family: 'science', handler: createHydroViewHandler },   // born inside create_view — no retired alias
  'fusion': { family: 'science', retired: 'create_fusion_view', handler: createFusionViewHandler },
  'galaxy': { family: 'science', retired: 'create_galaxy_view', handler: createGalaxyViewHandler },
  'gravity-wave': { family: 'science', retired: 'create_gravity_wave_view', handler: createGravityWaveViewHandler },
  'lightning-storm': { family: 'science', retired: 'create_lightning_storm_view', handler: createLightningStormViewHandler },
  'mechanics': { family: 'science', retired: 'create_mechanics_view', handler: createMechanicsViewHandler },
  'molecule': { family: 'bio', retired: 'create_molecule_view', handler: createMoleculeViewHandler },
  'ocean': { family: 'science', retired: 'create_ocean_view', handler: createOceanViewHandler },
  'orbit': { family: 'science', retired: 'create_orbit_view', handler: createOrbitViewHandler },
  'parallel-transport': { family: 'science', retired: 'create_parallel_transport_view', handler: createParallelTransportViewHandler },
  'plasma-globe': { family: 'science', retired: 'create_plasma_globe_view', handler: createPlasmaGlobeViewHandler },
  'probability': { family: 'math', retired: 'create_probability_view', handler: createProbabilityViewHandler },
  'pulsar': { family: 'science', retired: 'create_pulsar_view', handler: createPulsarViewHandler },
  'pythagoras': { family: 'math', retired: 'create_pythagoras_view', handler: createPythagorasViewHandler },
  'quadratic': { family: 'math', retired: 'create_quadratic_view', handler: createQuadraticViewHandler },
  'reactor': { family: 'science', retired: 'create_reactor_view', handler: createReactorViewHandler },
  'river': { family: 'science', handler: createRiverViewHandler },   // born inside create_view — no retired alias
  'rocket': { family: 'science', handler: createRocketViewHandler },   // born inside create_view — no retired alias
  'airplane': { family: 'science', handler: createAirplaneViewHandler },   // born inside create_view — no retired alias
  'saturn': { family: 'science', retired: 'create_saturn_view', handler: createSaturnViewHandler },
  'star-surface': { family: 'science', retired: 'create_star_surface_view', handler: createStarSurfaceViewHandler },
  'series': { family: 'math', retired: 'create_series_view', handler: createSeriesViewHandler },
  'star-birth': { family: 'science', retired: 'create_star_birth_view', handler: createStarBirthViewHandler },
  'surface': { family: 'math', retired: 'create_surface_view', handler: createSurfaceViewHandler },
  'transform': { family: 'math', retired: 'create_transform_view', handler: createTransformViewHandler },
  'transformer': { family: 'math', retired: 'create_transformer_view', handler: createTransformerViewHandler },
  'trig-circle': { family: 'math', retired: 'create_trig_circle_view', handler: createTrigCircleViewHandler },
  'vector-match': { family: 'math', retired: 'create_vector_match_view', handler: createVectorMatchViewHandler },
  'wavepacket': { family: 'science', retired: 'create_wavepacket_view', handler: createWavepacketViewHandler },
  'windmill': { family: 'science', retired: 'create_windmill_view', handler: createWindmillViewHandler },
  // Animated bio PROCESS explainers (a live orbit World, not a still) — the
  // time-based siblings of the static bio kinds (dna / cellular / molecule).
  'dna-process': { family: 'bio', retired: 'create_dna_process', handler: createDnaProcessHandler },
  'energy-cycle': { family: 'bio', retired: 'create_energy_cycle', handler: createEnergyCycleHandler },
};

// Core kinds + any attached recipe-book Door-2 kinds (recipe-book.plan.md).
// A FUNCTION, not a const: the book snapshot is published by ensureBookLoaded
// during MCP init, before registerCreateViewTools() runs — but the empty-book
// case must also stay correct if this module loads first. Core wins id
// collisions (a clone must not shadow a shipped kind).
function kindList() {
  return [...Object.keys(VIEW_KINDS), ...[...bookViewKinds().keys()].filter((id) => !VIEW_KINDS[id])];
}

// Generic mint for a book kind — the per-kind mint file collapsed into one
// path (mintSaturnView et al. keep their bespoke files; book kinds share
// this). The builder's own plan() is the validator: it runs BEFORE the row is
// stored, so a bad recipe fails the mint, not the render.
function mintBookView(bk, merged) {
  const { title, ref, folder_ref: folderRef, ...params } = merged;
  const manifest = { kind: bk.manifestKind, ...params, ...(title ? { title } : {}) };
  // ctx carries the injected toolkit (recipe-book/toolkit.js) — Tier-2
  // builders need it to validate; Tier-0 builders ignore the argument.
  const planned = (bk.plan ?? bk.assemble)(manifest, { title, toolkit: bk.toolkit });
  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || bk.title, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: planned && typeof planned === 'object' && planned.stats ? planned.stats : {},
  };
}

function resolveKindEntry(kind) {
  if (VIEW_KINDS[kind]) return VIEW_KINDS[kind];
  const bk = bookViewKinds().get(kind);
  if (!bk) return null;
  return { family: bk.family, book: true, handler: async (merged) => mintBookView(bk, merged) };
}

export async function createViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_view requires an object: { kind, params?, title?, ... }');
  }
  const { kind, params, title, viewBox, scene, ref, folder_ref: folderRef } = input;
  const entry = resolveKindEntry(kind);
  if (!entry) {
    throw new Error(
      `create_view: unknown kind '${kind}'. Known kinds: ${kindList().join(', ')}. ` +
        `Find one by intent via semantic_search({ kinds: ['view_vocab'] }), then read its ` +
        `parameter manual via get_view_vocab({ id: '<kind>' }).`,
    );
  }
  const merged = { ...(params && typeof params === 'object' ? params : {}) };
  if (title !== undefined) merged.title = title;
  if (viewBox !== undefined) merged.viewBox = viewBox;
  if (scene !== undefined) merged.scene = scene;
  if (ref !== undefined) merged.ref = ref;
  if (folderRef !== undefined) merged.folder_ref = folderRef;
  try {
    return await entry.handler(merged);
  } catch (err) {
    // Error-as-drawer: a failed mint points at the kind's parameter manual.
    throw new Error(
      `${err.message} — parameter manual: get_view_vocab({ id: '${kind}' }).`,
    );
  }
}

export async function getViewVocabHandler(input) {
  const { id, family } = input && typeof input === 'object' ? input : {};
  const catalog = getViewVocabCatalog();
  if (id) {
    const card = catalog.get(id);
    if (!card) {
      throw new Error(
        `get_view_vocab: unknown card '${id}'. Known: ${[...catalog.keys()].join(', ')}`,
      );
    }
    // _telemetrySignal: orientation-gap hit signal (stripped from the wire by
    // instrumentedInvoke); the miss path above throws and is caught as an
    // error-row drawer miss by the same cut.
    return { ok: true, card, _telemetrySignal: { id_requested: true, found: true } };
  }
  let cards = [...catalog.values()];
  if (family) cards = cards.filter((c) => c.family === family);
  return {
    ok: true,
    cards: cards.map(({ id: cid, name, family: fam, entry, summary, when }) => ({
      id: cid, name, family: fam, entry, summary, when,
    })),
    _telemetrySignal: { id_requested: false, found: true },
  };
}

export function registerCreateViewTools() {
  registerTool({
    name: 'create_view',
    description:
      'Mint an animated 3D STUDY OBJECT — a science / math / bio explainer served as a live World at '
      + '`/api/sketches/<ref>/world` (orbit camera; tiny deterministic recipe stored, regenerated on render). '
      + 'One tool, many kinds: physics (fission, fusion, double-slit, black-hole, galaxy, orbit, mechanics, '
      + 'ocean, …), math explainers (derivative, conics, trig-circle, complex, …), biology (dna, cellular, '
      + 'molecule). Pick `kind` from the enum; per-kind parameters go in `params` — find a kind by intent '
      + "via semantic_search({ kinds: ['view_vocab'] }) and read its parameter manual via "
      + 'get_view_vocab({ id: \'<kind>\' }) before passing params. Reach for "show/teach me <phenomenon>", '
      + '"an animated demo of X", "a 3D explainer for my student".',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: kindList(), description: 'Which study object. Parameter manual: get_view_vocab({ id: kind }).' },
        params: { type: 'object', description: `The kind's own knobs (see its view-vocab card). Validated by the kind's mint; a failed mint returns the card pointer.` },
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#05040a" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: ['kind'],
    },
    handler: createViewHandler,
  });

  registerTool({
    name: 'get_view_vocab',
    description:
      'Read a view-vocab card in full — the depiction prose + routing phrases + parameter manual for one '
      + '`create_view` kind or `compose_world` base (family \'world\'). Pass `id` for one card; omit for the '
      + 'index rows { id, name, family, entry, summary, when } (optional `family` filter: science / math / bio / '
      + "world). Discover cards by intent via semantic_search({ kinds: ['view_vocab'] }); this reader returns "
      + 'the full body. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Card id (= the create_view kind or compose_world base).' },
        family: { type: 'string', enum: ['science', 'math', 'bio', 'world'], description: 'Optional list filter.' },
      },
      required: [],
    },
    handler: getViewVocabHandler,
  });

  // Deprecated per-kind creators — resolve in tools/call, hidden from tools/list.
  // (kinds born inside create_view carry no `retired` alias and are skipped.)
  for (const [kind, entry] of Object.entries(VIEW_KINDS)) {
    if (!entry.retired) continue;
    registerTool({
      name: entry.retired,
      listed: false,
      description: `Deprecated alias — use create_view({ kind: '${kind}', params }) (manual: get_view_vocab({ id: '${kind}' })).`,
      inputSchema: { type: 'object', properties: {}, required: [] },
      handler: entry.handler,
    });
  }
}
