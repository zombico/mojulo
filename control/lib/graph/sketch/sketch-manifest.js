/**
 * Sketch manifest shape — what create_sketch accepts and what
 * /sketches/<ref> renders.
 *
 * Two drawable vocabularies share one manifest:
 *
 *   - stations[] + edges[] — the original flow vocabulary (boxes + arrows).
 *       Station kinds:  input | mcp_tool | filesystem | db_row
 *       Edge `via`:     'right' | 'left' | 'top' | 'bottom'
 *       Edge `pulse`:   optional traveling token(s) along the edge — the
 *                       "A pings B" primitive ({ count?, period?, size?,
 *                       color?, dir? }), rendered with native <animateMotion>.
 *   - marks[]              — the low-level chart vocabulary added for the
 *       chart-concept expansion. Mark kinds include rect | circle | wedge |
 *       line | polyline | polygon | blob | solid | volume | partition | array | mandalaArrangement | horizontalStack | mandalaField | fluidField | swirlField | rBrush | blobPla | visionPane | cubieLattice | text.
 *       Charts (stacked bar, donut, KPI tile, ...) are
 *       *recipes* composed from these marks — see the sketch_vocab cards in
 *       lib/graph/sketch-vocab/, retrieved via semantic_search by /sketch.
 *
 * A manifest is valid with stations, marks, or both (at least one non-empty).
 * Both old (stations-only) and new (marks/grid/z) manifests validate, so the
 * curated /graph map and existing scratch sketches stay pixel-identical.
 *
 * Positioning: nodes carry explicit x/y/w/h. The optional `grid` + per-node
 * `cell` is sugar — expandGridLayout() resolves a cell to x/y/w/h *before*
 * validation + storage, so the renderer never sees a cell. `z` (optional
 * number) is the paint-order key (ascending; generalizes the legacy
 * layer:'air' rank). See lib/graph/sketch-vocab/grid-layout.md +
 * z-layering.md and app-system/0528/sketch-chart-vocab/PLAN.md.
 */

import {
  isImageOutcomesKind,
  normalizeImageOutcomesManifest,
} from '../image-outcomes/manifest.js';

// The diagram vocabulary + validators + grid expansion now live in the kernel
// module @/lib/diagram-core; this file keeps the KIND DISPATCH (image-outcomes /
// world / diagram) and the concern-bucket + render-mode resolvers, and re-exports
// the diagram surface so existing importers are unchanged. See
// lib/mcp/kernel-diagram-surface.plan.md.
import { isFiniteNumber, validateDiagramManifest } from '@/lib/diagram-core';

export {
  STATION_KINDS,
  EDGE_VIA_VALUES,
  PULSE_DIRS,
  MARK_KINDS,
  SIGNAGE_VARIANTS,
  SIGNAGE_SLOTS,
  validateDiagramManifest,
  expandGridLayout,
  expandSequence,
  expandGantt,
  expandSwimlanes,
  expandBoundaries,
  lowerDiagramKinds,
} from '@/lib/diagram-core';

export function validateSketchManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, errors: ['manifest must be an object'] };
  }
  // Image-outcomes kinds carry their own normalizer (forms/panels, not
  // stations/marks). See lib/graph/image-outcomes/image-outcomes.plan.md.
  if (isImageOutcomesKind(manifest.kind)) {
    try {
      normalizeImageOutcomesManifest(manifest);
      return { ok: true, errors: [] };
    } catch (err) {
      return { ok: false, errors: [err.message] };
    }
  }
  // Seeded interior world kinds are tiny generator recipes ({ seed, … } or an
  // explicit { rooms }), not a stations/marks diagram — kind-dispatched here so
  // create_sketch can mint one. See worlds/world-kinds.js.
  if (manifest.kind === 'floorplan' || manifest.kind === 'restaurant') {
    const errors = [];
    if (!manifest.title || typeof manifest.title !== 'string') {
      errors.push('manifest.title is required (string)');
    }
    const hasSeedForm = isFiniteNumber(manifest.seed) || Array.isArray(manifest.rooms);
    if (!hasSeedForm) {
      errors.push(`kind '${manifest.kind}' needs a seed (integer) or an explicit rooms[] plan`);
    }
    return { ok: errors.length === 0, errors };
  }
  // Everything else is a box-and-arrow / chart diagram — the kernel core.
  return validateDiagramManifest(manifest);
}


// --- Concern bucket: which tuned renderer owns this sketch -------------------
//
// A sketch is one primitive (one row) regardless of which concern claims it —
// bind_stash, plan/research references, diff_sketches, folders, and today's
// renderer dispatch on `manifest.kind` all behave identically. The bucket
// decides which of two SIBLING concerns the sketch belongs to, each its own
// tuned, opinionated surface:
//
//   diagram      — Sketches: diagrams, flows, charts, scientific explanation
//                  (the /sketches concern)
//   illustration — Mojulo Maker: a landscape or complicated figure in a
//                  perspective / css3d / painterly context — something you LOOK AT
//                  (the /maker/illustrations concern)
//   world        — Mojulo Maker: a traversable three.js cityscape / hub — something
//                  you MOVE THROUGH (the /maker/worlds concern)
//   object       — Mojulo Maker: a single orbit-only 3D artifact or study — a
//                  workbench part, an assembler composition, a polygomer, a
//                  planet, a science/math view — something you TURN and look at
//                  (the /maker/objects concern). Same three.js /world renderer
//                  as `world`; the split is walkable vs orbit-only, mirrored
//                  from the `walk` flag in worlds/world-kinds.js.
//   beats        — Mojulo Maker: a synthesized musical artifact — something you
//                  LISTEN TO (the /maker/beats shelf; beats.plan.md)
//   game         — Mojulo Arcade: a playable standalone game (create_game) —
//                  something you PLAY (the /arcade concern; game-developer.plan.md)
//
// The bucket is derived purely from `manifest.kind`; the optional
// `sketches.bucket` column overrides the derived value for the rare edge case
// (e.g. a structural manji-tree the operator wants kept in Sketches). The two
// concerns share the renderer today and are expected to diverge into separately
// tuned renderers over time — the bucket is the seam they split along.

export const BUCKETS = ['diagram', 'illustration', 'world', 'object', 'beats', 'voice', 'game'];
const BUCKET_SET = new Set(BUCKETS);

// Kinds that render in a perspective / css3d / painterly context — the
// illustration set (Maker). Everything else (no kind, charts, flows) is a
// diagram (Sketches). The three.js kinds are NOT here — they classify into the
// `world` bucket (walkable: fractal-city, transportation-hub, …) or the
// `object` bucket (orbit-only: workbench, assembler, views, …) below, keyed off
// WALKABLE_WORLD_KINDS / OBJECT_RENDER_KINDS so renderer mode and concern
// bucket stay aligned.
export const ILLUSTRATION_KINDS = [
  'manji-tree',
  'painted-landscape',
  'carved-solid',
  'figure',
  'css3d-turntable',
  'room',
  'subway-station',
  // Director-layer scaffolds for external image generation
  // (image-outcomes.plan.md): looked-at artifacts, Maker concern.
  'image-outcome',
  'sequential-art',
  'character-sheet',
  'sprite-sheet',
  // Publication cover: illustration + title + subtext + metadata composited to
  // cover.png, bound onto a publication (cover-composition.plan.md).
  'cover',
  // Motion comic: the click-gated comic presentation — panels pieced out
  // event by event in a fixed box (motion-comic.plan.md). Looked-at (and
  // clicked-through), so it lives with the Maker illustrations; its render
  // face is the /play iframe below, not /svg.
  'motion-comic',
];
const ILLUSTRATION_KIND_SET = new Set(ILLUSTRATION_KINDS);

export function isBucket(value) {
  return typeof value === 'string' && BUCKET_SET.has(value);
}

// A polygomer: a 3D manji-tree carrying lathe monomers (a top-level `lathes[]`
// array or in-tree `kind:'lathe'` leaf nodes). Only lathes lower to baked world
// faces (worlds/polygomer-world.js), so this is the exact membership test for
// the turnable-World form; a 2D structural manji-tree, or a 3D one with no
// lathes (bars/vajra wireframe only), has no face-lowerable mass and stays an
// SVG still.
function hasLatheLeaf(node) {
  if (Array.isArray(node)) return node.some(hasLatheLeaf);
  if (!node || typeof node !== 'object') return false;
  if (node.kind === 'lathe') return true;
  return Object.values(node).some(hasLatheLeaf);
}

export function isPolygomerManjiTree(manifest) {
  if (!manifest || typeof manifest !== 'object' || manifest.kind !== 'manji-tree') return false;
  if (manifest.dimensions !== '3d') return false;
  if (Array.isArray(manifest.lathes) && manifest.lathes.length > 0) return true;
  return hasLatheLeaf(manifest.tree);
}

// Concern bucket, in priority order: a walkable world is its own concern
// (moved-through), an orbit-only 3D artifact is the object concern (turned),
// then the still illustration set (looked-at), else a diagram. The kind sets
// are declared just below in this module; classifyBucket is only ever called at
// query time (well after module init), so the forward reference is safe and
// keeps the render-kind lists the single source of truth for membership.
export function classifyBucket(manifest) {
  const kind = manifest && typeof manifest === 'object' ? manifest.kind : undefined;
  if (WALKABLE_WORLD_SET.has(kind)) return 'world';
  if (OBJECT_RENDER_SET.has(kind) || isPolygomerManjiTree(manifest)) return 'object';
  if (BEATS_RENDER_SET.has(kind)) return 'beats';   // heard, not looked at — the Maker beats shelf
  if (VOICE_RENDER_SET.has(kind)) return 'voice';   // spoken, not looked at — the Maker voice shelf
  if (kind === 'game') return 'game';               // played, not looked at — the Arcade concern
  return ILLUSTRATION_KIND_SET.has(kind) ? 'illustration' : 'diagram';
}

// --- Renderer dispatch: which UI renderer draws a sketch ---------------------
//
// Distinct from the concern bucket (which list owns it). Some illustration kinds
// are NOT CreationMap diagrams and must never fall through to <CreationMap> (it
// assumes a `viewBox` + nodes/edges and throws on a scene manifest). Every UI
// surface that previews a sketch dispatches on this so the split stays in one
// place instead of drifting per call site:
//   svg     — server-rasterized; show via the /svg endpoint as an <img>
//   world   — traversable three.js (WebGL) canvas; show via /world in an <iframe>
//   scene   — live preserve-3d HTML, preset shots; show via /scene in an <iframe>
//   diagram — the CreationMap vector renderer (flows / charts / maps)
//
// world vs scene is the "moved through" vs "looked at" split: box-world kinds
// (cities, hubs) are navigable in three.js (depth-buffered, frustum-culled — the
// DOM compositor stalls on the same geometry under a moving camera), while the
// turntable stays a preset-shot CSS-3D scene.
export const SVG_RENDER_KINDS = ['manji-tree', 'painted-landscape', 'carved-solid', 'image-outcome', 'sequential-art', 'character-sheet', 'sprite-sheet', 'cover'];
// 'planetary' is orbit-only — it has NO CSS-3D /scene fallback (the body in a celestial
// sphere only reads under a free-orbit camera), so unlike the box-world kinds it does not
// bake a /scene PNG gallery thumbnail (a documented v1 gap; see planetary.plan.md).
// 'vehicle-instance' is a meta-fabricator family-instance preview (a sampled/authored
// vehicle on the workbench's measured studio grid). Like 'planetary' it is orbit-only —
// it renders through /world (assembleInstanceStudio → emitThreeWorld) and has no CSS-3D
// /scene path, so it bakes no /scene PNG gallery thumbnail.
// The EDUCATION module — math explainers (the sibling family to the science views). Each is an
// orbit-only World built on the same primitives (faces / tracers / fields / deform / surface): one idea,
// a few scenarios, usually a degenerate control. Advanced (linear algebra → complex analysis) and
// high-school (geometry / trig / algebra / calculus) tiers. Discoverable as a set via this constant.
export const EDUCATION_VIEW_KINDS = [
  // advanced
  'transform-view', 'field-flow-view', 'surface-view', 'series-view', 'probability-view', 'complex-view',
  // high-school
  'trig-circle-view', 'pythagoras-view', 'quadratic-view', 'complete-square-view', 'conics-view', 'derivative-view', 'ftc-view',
  'heat-sphere-view',
];
// The world/object split within the three.js /world renderer. Both lists render
// identically (render mode 'world'); the split is the CONCERN axis — walkable
// (moved through, first-person) vs orbit-only (turned and looked at) — and it
// mirrors the `walk` flag on each kind's descriptor in worlds/world-kinds.js.
// Three walk-flagged kinds deliberately stay OUT of WALKABLE_WORLD_KINDS
// because another concern owns them: 'painted-landscape' (illustration, SVG
// still by default), 'subway-station' (illustration, CSS-3D scene), 'room'
// (illustration; walkable only via the world route's ROOM_FALLBACK).
// 'controllable' carries no registry walk flag (locomotion is per-entity, from
// the manifest's rules) but is a LIVE moved-through stage — action worlds and
// game levels — so it belongs to the world concern.
export const WALKABLE_WORLD_KINDS = ['fractal-city', 'condo-complex', 'school-complex', 'transportation-hub', 'subway-building', 'floorplan', 'restaurant', 'edifice', 'dungeon', 'math-structure', 'koenigsberg', 'controllable'];
// Orbit-only single artifacts and studies — the /maker/objects concern. The
// polygomer manji-tree joins via isPolygomerManjiTree (its 2D/structural form
// stays an illustration SVG).
export const OBJECT_RENDER_KINDS = ['workbench', 'assembler', 'planetary', 'vehicle-instance', 'molecule-view', 'dna-view', 'dna-process', 'energy-cycle', 'cellular-view', 'atom-view', 'mechanics-view', 'orbit-view', 'comet-view', 'field-view', 'fluid-view', 'ocean-view', 'windmill-view', 'double-slit-view', 'black-hole-view', 'galaxy-view', 'star-birth-view', 'pulsar-view', 'plasma-globe-view', 'lightning-storm-view', 'wavepacket-view', 'fission-view', 'cascade-view', 'fusion-view', 'cherenkov-view', 'reactor-view', 'atmosphere-view', 'saturn-view', 'star-surface-view', 'gravity-wave-view', 'parallel-transport-view', 'transformer-view', 'vector-match-view', ...EDUCATION_VIEW_KINDS];
export const WORLD_RENDER_KINDS = [...WALKABLE_WORLD_KINDS, ...OBJECT_RENDER_KINDS];
export const SCENE_RENDER_KINDS = ['css3d-turntable', 'subway-station'];
// Beats artifacts (beats.plan.md) — heard, not looked at. Rendered as a live
// self-contained audio-player page at /api/sketches/<ref>/beats in an <iframe>.
export const BEATS_RENDER_KINDS = ['beats-ambient', 'beats-composition', 'beats-pattern', 'beats-sfx'];
// Voice registers (voice-worker.plan.md) — recipes for how a voice sounds;
// no in-plane render at all (an external worker speaks them). The /maker/voice
// shelf shows the recipe itself: axes, resolved blend weights, worker handoff.
export const VOICE_RENDER_KINDS = ['voice-register'];
const SVG_RENDER_SET = new Set(SVG_RENDER_KINDS);
const WALKABLE_WORLD_SET = new Set(WALKABLE_WORLD_KINDS);
const OBJECT_RENDER_SET = new Set(OBJECT_RENDER_KINDS);
const WORLD_RENDER_SET = new Set(WORLD_RENDER_KINDS);
const SCENE_RENDER_SET = new Set(SCENE_RENDER_KINDS);
const BEATS_RENDER_SET = new Set(BEATS_RENDER_KINDS);
const VOICE_RENDER_SET = new Set(VOICE_RENDER_KINDS);

export function sketchRenderMode(manifest) {
  const kind = manifest && typeof manifest === 'object' ? manifest.kind : undefined;
  if (WORLD_RENDER_SET.has(kind)) return 'world';
  // A polygomer manji-tree is a turnable World (registered in world-kinds.js);
  // the structural 2D manji-tree stays an SVG still below.
  if (isPolygomerManjiTree(manifest)) return 'world';
  if (SCENE_RENDER_SET.has(kind)) return 'scene';
  if (SVG_RENDER_SET.has(kind)) return 'svg';
  if (BEATS_RENDER_SET.has(kind)) return 'beats';
  if (VOICE_RENDER_SET.has(kind)) return 'voice';   // spoken, not looked at
  if (kind === 'game') return 'game';   // played, not looked at — the game shell (create_game)
  if (kind === 'motion-comic') return 'play';   // clicked-through — the /play presentation player
  return 'diagram';
}
