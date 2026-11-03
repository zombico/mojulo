/**
 * create_manji_tree — operator agent authors a manji-program tree directly
 * and gets back a `/sketches/<ref>` URL that serves the rendered SVG.
 *
 * This is the *aggressive embed* path from the polygonizer-manji-tree plan:
 * the LLM bypasses recipe-compiler entirely and authors at the manji-tree
 * IR. The substrate validates the tree (`validateManjiTree` /
 * `validateManjiTree3D`), persists it to SketchRepository with
 * `manifest.kind === 'manji-tree'`, and serves a rendered SVG via the
 * existing `/api/sketches/[ref]/svg` route (which dispatches on manifest
 * kind).
 *
 * No new persistence layer, no new URL pattern — manji-trees ride the
 * sketch artifact system. The discriminator is the manifest's `kind`
 * field; everything else (browse UI, picture-book inlining, ref scheme,
 * folder support) comes for free.
 *
 * Manifest shape (what gets stored):
 *   {
 *     kind: 'manji-tree',
 *     dimensions: '2d' | '3d',
 *     tree: ManjiTreeNode,
 *     camera?: cameraPrimitive,
 *     roomBasis?: roomBasis,
 *     viewBox?: { width, height },
 *     title?: string,
 *     showSlotMarkers?: boolean,
 *     connections?: [{ from, to, sag?, wavelengths?, plane?, samples?, style? }],
 *                                       // 3D only — sine/cosine curves
 *                                       // between two named manji points.
 *                                       // See line-between.js.
 *     waveFields?: [{ corners, waves?, displacement?, samples?, style? }],
 *                                       // 3D only — 2D height fields
 *                                       // over a 4-corner quad. Empty
 *                                       // `waves` = flat surface; add
 *                                       // components to lift a floor or
 *                                       // build an ocean. See wave-field.js.
 *     physics?: { gravity, gravityStrength, defaultSagFactor },
 *                                       // 3D only — scene-global field
 *                                       // used to derive default sag
 *                                       // and the wave-field displacement
 *                                       // direction.
 *   }
 */

import { pluginProfileActive } from '@/lib/mcp/plugin-profile';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import {
  validateManjiTree,
  validateManjiTree3D,
  walkManjiTree3D,
  validateLeafMarkEndpoints,
  collectMergedFields,
  validateStructureManjiFieldRefs,
} from '@/lib/graph/polygonizer/manji-program.js';
import { resolveManjiProgramRef } from '@/lib/graph/polygonizer/mandala-patterns.js';
import { validateConnections } from '@/lib/graph/polygonizer/line-between.js';
import { validateWaveFields, validateWaveFieldsFieldRefs } from '@/lib/graph/polygonizer/wave-field.js';
import { validateWaveManji, validateWaveManjiFieldRefs } from '@/lib/graph/polygonizer/wave-manji.js';
import { validateLathes, LATHE_DETAIL_MAX } from '@/lib/graph/polygonizer/lathe.js';
import { validateVajras } from '@/lib/graph/polygonizer/vajra.js';
import { validateTaijis } from '@/lib/graph/polygonizer/taiji.js';
import { validatePlants, expandPlants, estimatePlantSegments } from '@/lib/graph/polygonizer/plant.js';
import { validateFields } from '@/lib/graph/polygonizer/fields.js';

export function mintManjiTree({ title, tree, dimensions, camera, roomBasis, viewBox, showSlotMarkers, ref, folderRef, connections, physics, waveFields, waveManji, lathes, vajras, taijis, plants, fields, detail, drapes } = {}) {
  if (!title || typeof title !== 'string') {
    throw new Error('`title` is required (string)');
  }
  if (!tree || typeof tree !== 'object' || Array.isArray(tree)) {
    throw new Error('`tree` is required (object, the root manji-tree node)');
  }
  const dim = dimensions === '3d' ? '3d' : '2d';
  if (ref !== undefined) {
    if (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
      throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
    }
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (typeof folderRef !== 'string' || !folderRef) {
      throw new Error('`folderRef` must be a non-empty string or null if provided');
    }
    const folder = SketchFolderRepository.getByRef(folderRef);
    if (!folder) {
      throw new Error(`Folder '${folderRef}' not found`);
    }
  }
  if (connections !== undefined && !Array.isArray(connections)) {
    throw new Error('`connections` must be an array of line specs when provided');
  }
  if (connections && connections.length > 0 && dim !== '3d') {
    throw new Error('`connections` are 3D only — pass `dimensions: "3d"` or omit connections');
  }
  if (waveFields !== undefined && !Array.isArray(waveFields)) {
    throw new Error('`waveFields` must be an array of field specs when provided');
  }
  if (waveFields && waveFields.length > 0 && dim !== '3d') {
    throw new Error('`waveFields` are 3D only — pass `dimensions: "3d"` or omit waveFields');
  }
  if (waveManji !== undefined && !Array.isArray(waveManji)) {
    throw new Error('`waveManji` must be an array of wave manji specs when provided');
  }
  if (waveManji && waveManji.length > 0 && dim !== '3d') {
    throw new Error('`waveManji` are 3D only — pass `dimensions: "3d"` or omit waveManji');
  }
  if (lathes !== undefined && !Array.isArray(lathes)) {
    throw new Error('`lathes` must be an array of lathe specs when provided');
  }
  if (drapes !== undefined) {
    if (!Array.isArray(drapes)) throw new Error('`drapes` must be an array of drape specs when provided');
    if (drapes.length > 0 && dim !== '3d') throw new Error('`drapes` are 3D only — pass `dimensions: "3d"` or omit drapes');
    for (const [i, d] of drapes.entries()) {
      if (!d || typeof d !== 'object' || !Array.isArray(d.anchor) || d.anchor.length !== 2) {
        throw new Error(`\`drapes[${i}]\` needs an \`anchor\` of exactly two points (endpoint paths or {x,y,z}) — the pinned top edge`);
      }
    }
  }
  if (lathes && lathes.length > 0 && dim !== '3d') {
    throw new Error('`lathes` are 3D only — pass `dimensions: "3d"` or omit lathes');
  }
  if (vajras !== undefined && !Array.isArray(vajras)) {
    throw new Error('`vajras` must be an array of vajra specs when provided');
  }
  if (vajras && vajras.length > 0 && dim !== '3d') {
    throw new Error('`vajras` are 3D only — pass `dimensions: "3d"` or omit vajras');
  }
  if (taijis !== undefined && !Array.isArray(taijis)) {
    throw new Error('`taijis` must be an array of taiji specs when provided');
  }
  if (taijis && taijis.length > 0 && dim !== '3d') {
    throw new Error('`taijis` are 3D only — pass `dimensions: "3d"` or omit taijis');
  }
  if (plants !== undefined && !Array.isArray(plants)) {
    throw new Error('`plants` must be an array of plant specs when provided');
  }
  if (plants && plants.length > 0 && dim !== '3d') {
    throw new Error('`plants` are 3D only — pass `dimensions: "3d"` or omit plants');
  }
  if (fields !== undefined && fields !== null) {
    if (typeof fields !== 'object' || Array.isArray(fields)) {
      throw new Error('`fields` must be an object keyed by field id when provided');
    }
    if (Object.keys(fields).length > 0 && dim !== '3d') {
      throw new Error('`fields` are 3D only — pass `dimensions: "3d"` or omit fields');
    }
  }

  // A `plant` is a generative MACRO that compiles to taiji specs at mint
  // time (golden-angle phyllotaxis + self-similar taper). Validate the
  // high-level spec, then expand and merge into the taijis the downstream
  // taiji pipeline already renders — no new render path. See plant.js.
  if (plants && plants.length > 0) {
    const plantErrors = validatePlants(plants);
    if (plantErrors.length) {
      throw new Error(`Invalid manji-tree plants:\n - ${plantErrors.join('\n - ')}`);
    }
  }
  const allTaijis = [
    ...(Array.isArray(taijis) ? taijis : []),
    ...expandPlants(plants),
  ];

  // Browser-budget backstop: plants auto-pick a light mesh, but a hand-authored
  // taiji pile (or many plants) could still produce an SVG too heavy to render.
  // Reject past a generous segment ceiling with an actionable message rather
  // than silently shipping a multi-megabyte, sluggish page.
  const SCENE_SEGMENT_BUDGET = 30000;
  const sceneSegments = estimatePlantSegments(allTaijis);
  if (sceneSegments > SCENE_SEGMENT_BUDGET) {
    throw new Error(
      `manji-tree too heavy to render in a browser: ~${sceneSegments} line segments `
      + `(budget ${SCENE_SEGMENT_BUDGET}). Lower plant detail ('low'), reduce count / `
      + `depth / discCount, thin hand-authored taijis (crossSections × samples), or split the scene.`,
    );
  }

  const validator = dim === '3d' ? validateManjiTree3D : validateManjiTree;
  const errors = validator(tree, resolveManjiProgramRef);
  if (errors.length) {
    throw new Error(`Invalid manji-tree (${dim}):\n - ${errors.join('\n - ')}`);
  }

  // Validate connection + wave-field endpoint paths at mint time so bad
  // refs surface here, not at SVG-render time. One walk feeds three
  // validators: top-level `connections[]` / `waveFields[]` arrays, and
  // in-tree leaf marks (`kind: 'connection' | 'wave-field'`) emitted by
  // the walker with each leaf's captured `selfId`.
  // Validate structure-manji scalar field refs against host-declared
  // fields BEFORE the walk so the walker's evaluateScalarOrFieldRef
  // calls succeed. This is the v1 restriction enforcement: structure
  // scalars can only see host-declared fields, not card-emitted ones.
  if (dim === '3d') {
    const structFieldErrors = validateStructureManjiFieldRefs(tree, fields);
    if (structFieldErrors.length) {
      throw new Error(`Invalid manji-tree structure field references:\n - ${structFieldErrors.join('\n - ')}`);
    }
  }
  if (
    (connections && connections.length > 0) ||
    (waveFields && waveFields.length > 0) ||
    (waveManji && waveManji.length > 0) ||
    (lathes && lathes.length > 0) ||
    (vajras && vajras.length > 0) ||
    (allTaijis.length > 0) ||
    dim === '3d'
  ) {
    // Walk with host-declared fields available for walk-time structure
    // scalar resolution. The walker builds a lazy resolver internally
    // so endpoint paths inside field declarations resolve against
    // ancestor nodes as the walk progresses. Card-emitted fields are
    // not yet available; structure scalars can only reference
    // host-declared fields per the v1 restriction.
    const emitted = dim === '3d'
      ? walkManjiTree3D(tree, resolveManjiProgramRef, { fields })
      : [];
    if (connections && connections.length > 0) {
      const connErrors = validateConnections(connections, emitted, physics);
      if (connErrors.length) {
        throw new Error(`Invalid manji-tree connections:\n - ${connErrors.join('\n - ')}`);
      }
    }
    if (waveFields && waveFields.length > 0) {
      const fieldErrors = validateWaveFields(waveFields, emitted);
      if (fieldErrors.length) {
        throw new Error(`Invalid manji-tree wave fields:\n - ${fieldErrors.join('\n - ')}`);
      }
    }
    if (waveManji && waveManji.length > 0) {
      const wmErrors = validateWaveManji(waveManji, emitted);
      if (wmErrors.length) {
        throw new Error(`Invalid manji-tree wave manji:\n - ${wmErrors.join('\n - ')}`);
      }
    }
    if (lathes && lathes.length > 0) {
      const latheErrors = validateLathes(lathes, emitted);
      if (latheErrors.length) {
        throw new Error(`Invalid manji-tree lathes:\n - ${latheErrors.join('\n - ')}`);
      }
    }
    if (vajras && vajras.length > 0) {
      const vajraErrors = validateVajras(vajras, emitted);
      if (vajraErrors.length) {
        throw new Error(`Invalid manji-tree vajras:\n - ${vajraErrors.join('\n - ')}`);
      }
    }
    if (allTaijis.length > 0) {
      const taijiErrors = validateTaijis(allTaijis, emitted);
      if (taijiErrors.length) {
        throw new Error(`Invalid manji-tree taijis:\n - ${taijiErrors.join('\n - ')}`);
      }
    }
    // Merge card-declared fields (emitted by the walker as side-channel
    // cardField records) with the host manifest's `fields` block. Host
    // wins on overlap; inter-card collisions are surfaced as errors and
    // throw before render. See lite-template/integration/0605/shelf-cards-declare-fields.plan.md.
    const { merged: mergedFields, errors: collisionErrors } = collectMergedFields(emitted, fields);
    if (collisionErrors.length) {
      throw new Error(`Invalid manji-tree fields:\n - ${collisionErrors.join('\n - ')}`);
    }
    if (Object.keys(mergedFields).length > 0) {
      const fieldErrors = validateFields(mergedFields, emitted);
      if (fieldErrors.length) {
        throw new Error(`Invalid manji-tree fields:\n - ${fieldErrors.join('\n - ')}`);
      }
    }
    // Cross-check: every wave-manji bending field-ref must point at a
    // declared field id (host OR card-declared). Runs after both shape
    // validations pass.
    if (waveManji && waveManji.length > 0) {
      const refErrors = validateWaveManjiFieldRefs(waveManji, mergedFields);
      if (refErrors.length) {
        throw new Error(`Invalid manji-tree field references:\n - ${refErrors.join('\n - ')}`);
      }
    }
    // Same cross-check for wave-field heightField refs.
    if (waveFields && waveFields.length > 0) {
      const refErrors = validateWaveFieldsFieldRefs(waveFields, mergedFields);
      if (refErrors.length) {
        throw new Error(`Invalid manji-tree field references:\n - ${refErrors.join('\n - ')}`);
      }
    }
    // In-tree leaf marks — only present when dimensions=3d (walker emits
    // them); 2D path will never produce any so the call is a no-op.
    if (dim === '3d') {
      const leafErrors = validateLeafMarkEndpoints(emitted);
      if (leafErrors.length) {
        throw new Error(`Invalid manji-tree leaf marks:\n - ${leafErrors.join('\n - ')}`);
      }
    }
  }

  const manifest = {
    kind: 'manji-tree',
    dimensions: dim,
    tree,
    ...(camera !== undefined ? { camera } : {}),
    ...(roomBasis !== undefined ? { roomBasis } : {}),
    ...(viewBox !== undefined ? { viewBox } : {}),
    ...(showSlotMarkers !== undefined ? { showSlotMarkers } : {}),
    ...(connections !== undefined ? { connections } : {}),
    ...(waveFields !== undefined ? { waveFields } : {}),
    ...(waveManji !== undefined ? { waveManji } : {}),
    ...(lathes !== undefined ? { lathes } : {}),
    ...(drapes !== undefined ? { drapes } : {}),
    ...(vajras !== undefined ? { vajras } : {}),
    ...(allTaijis.length > 0 ? { taijis: allTaijis } : {}),
    ...(plants !== undefined ? { plants } : {}),
    ...(fields !== undefined ? { fields } : {}),
    ...(physics !== undefined ? { physics } : {}),
    // The resolution dial (applyLatheDetail): weighted per-lathe articulation
    // under a face budget. Stored only when it does something (> 1).
    ...(Number.isFinite(Number(detail)) && Number(detail) > 1
      ? { detail: Math.min(Number(detail), LATHE_DETAIL_MAX) }
      : {}),
    ...(title ? { title } : {}),
  };

  const sketch = SketchRepository.create({ title, manifest, ref, folderRef: folderRef ?? null });

  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    svgUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/svg?inline=1`,
  };
}

// sketch_polygomer — a part-graph grammar over create_manji_tree. Each part is a
// named simple volume (a lathe shape) bonded by explicit endpoints; the tool
// generates the slots + lathes so the agent authors PARTS, not slot bookkeeping.
// The conversational, composable authoring door for creatures/objects as 3D models.
const POLY_SHAPES = {
  bulb: (g) => [{ t: 0, radius: g * 0.5 }, { t: 0.45, radius: g }, { t: 1, radius: g * 0.6 }],
  dome: (g) => [{ t: 0, radius: g * 0.15 }, { t: 0.5, radius: g }, { t: 1, radius: g * 0.85 }],
  sphere: (g) => [{ t: 0, radius: g * 0.2 }, { t: 0.5, radius: g }, { t: 1, radius: g * 0.2 }],
  // A TRUE round ball: a many-point semicircle profile (radius = g·√(1−(2t−1)²)), densened near the
  // poles so the surface curves closed instead of coming to a cone point. Use this (not `sphere`,
  // which is a slim bicone) for round heads / creature bodies / Kirby-style mascots. See platformer.plan.md.
  ball: (g) => [
    { t: 0, radius: g * 0.02 }, { t: 0.06, radius: g * 0.475 }, { t: 0.12, radius: g * 0.65 },
    { t: 0.2, radius: g * 0.8 }, { t: 0.3, radius: g * 0.917 }, { t: 0.4, radius: g * 0.98 },
    { t: 0.5, radius: g }, { t: 0.6, radius: g * 0.98 }, { t: 0.7, radius: g * 0.917 },
    { t: 0.8, radius: g * 0.8 }, { t: 0.88, radius: g * 0.65 }, { t: 0.94, radius: g * 0.475 },
    { t: 1, radius: g * 0.02 },
  ],
  bead: (g) => [{ t: 0, radius: g * 0.2 }, { t: 0.5, radius: g }, { t: 1, radius: g * 0.2 }],
  // A full EGG — an ovoid, widest at mid-span, closing tangent to the axis at
  // both poles: radius = g·√(1 − |2t−1|³). Rounder-shouldered than `ball` (a
  // true sphere) and blunter than `sphere` (a slim bicone). Its `half: true`
  // form is the FOOT/PAW shape — see the halving note below.
  egg: (g) => [
    { t: 0, radius: g * 0.02 }, { t: 0.01, radius: g * 0.243 }, { t: 0.025, radius: g * 0.378 },
    { t: 0.045, radius: g * 0.496 }, { t: 0.07, radius: g * 0.603 }, { t: 0.105, radius: g * 0.712 },
    { t: 0.15, radius: g * 0.811 }, { t: 0.20, radius: g * 0.885 }, { t: 0.26, radius: g * 0.943 },
    { t: 0.32, radius: g * 0.976 }, { t: 0.38, radius: g * 0.993 }, { t: 0.44, radius: g * 0.999 },
    { t: 0.5, radius: g }, { t: 0.56, radius: g * 0.999 }, { t: 0.62, radius: g * 0.993 },
    { t: 0.68, radius: g * 0.976 }, { t: 0.74, radius: g * 0.943 }, { t: 0.80, radius: g * 0.885 },
    { t: 0.85, radius: g * 0.811 }, { t: 0.895, radius: g * 0.712 }, { t: 0.93, radius: g * 0.603 },
    { t: 0.955, radius: g * 0.496 }, { t: 0.975, radius: g * 0.378 }, { t: 0.99, radius: g * 0.243 },
    { t: 1, radius: g * 0.02 },
  ],
  cone: (g, taper) => [{ t: 0, radius: g }, { t: 1, radius: Math.max(0.02, g * taper) }],
  stalk: (g) => [{ t: 0, radius: g }, { t: 0.85, radius: g * 0.8 }, { t: 1, radius: g * 0.55 }],
  drum: (g) => [{ t: 0, radius: g * 0.85 }, { t: 0.5, radius: g }, { t: 1, radius: g * 0.85 }],
  barrel: (g) => [{ t: 0, radius: g * 0.7 }, { t: 0.5, radius: g }, { t: 1, radius: g * 0.7 }],
  bell: (g) => [{ t: 0, radius: g * 0.35 }, { t: 1, radius: g }],
  disc: (g) => [{ t: 0, radius: g }, { t: 1, radius: g * 0.95 }],
  tube: (g) => [{ t: 0.5, radius: g }],
};

// ─── `half: true` — halving as a MODIFIER, not a dozen `half-*` shape names ───
//
// Every parts-door shape is a lathe profile over t ∈ [0,1]. Halving clips that
// profile to its `to`-side half and remaps it back onto [0,1], so the cut lands
// at `from` and the shape's own free end stays at `to`. One rule, thirteen
// shapes: half-ball is a hemisphere, half-barrel a belly-cut cask, half-cone a
// frustum, half-egg the foot/paw. Flip which physical end is flat by swapping
// `from`/`to` — the cut always follows `from`.
//
// Note this is an AXIAL half (the cut plane is perpendicular to the axis) — the
// only half a surface of revolution can express. A LENGTHWISE half (half-pipe,
// trough, D-section, a flat sole under a foot) is a clip plane PARALLEL to the
// axis, which no primitive does today; it would be a change to `sampleLathe`.
function radiusAt(profile, t) {
  if (t <= profile[0].t) return profile[0].radius;
  const last = profile[profile.length - 1];
  if (t >= last.t) return last.radius;
  for (let k = 0; k + 1 < profile.length; k += 1) {
    const a = profile[k];
    const b = profile[k + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      return span < 1e-12 ? a.radius : a.radius + ((t - a.t) / span) * (b.radius - a.radius);
    }
  }
  return last.radius;
}

export function halveProfile(profile) {
  const kept = profile
    .filter((p) => p.t > 0.5)
    .map((p) => ({ t: Number(((p.t - 0.5) * 2).toFixed(6)), radius: p.radius }));
  return [{ t: 0, radius: radiusAt(profile, 0.5) }, ...kept];
}

// `half-egg` stays callable by name — it is the halved `egg`, and the shape an
// agent reaches for when it wants a foot without thinking about the modifier.
POLY_SHAPES['half-egg'] = (g) => halveProfile(POLY_SHAPES.egg(g));

const POLY_SHAPE_NAMES = Object.keys(POLY_SHAPES);

function rotXY(p, c, th) {
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * Math.cos(th) - dy * Math.sin(th), c[1] + dx * Math.sin(th) + dy * Math.cos(th), p[2]];
}

// A part → one or more {from,to} placements (radial ring / mirror copies).
function expandPlacements(part) {
  const base = { from: part.from, to: part.to };
  if (part.radial && Number.isFinite(part.radial.count) && part.radial.count > 1) {
    const c = Array.isArray(part.radial.center) ? part.radial.center : [0, 0];
    const n = Math.floor(part.radial.count);
    return Array.from({ length: n }, (_, k) => {
      const th = (2 * Math.PI * k) / n;
      return { from: rotXY(part.from, c, th), to: rotXY(part.to, c, th) };
    });
  }
  if (part.mirror === 'x' || part.mirror === 'y' || part.mirror === 'xy') {
    const out = [base];
    const flip = (p, ax) => [ax.includes('x') ? -p[0] : p[0], ax.includes('y') ? -p[1] : p[1], p[2]];
    out.push({ from: flip(part.from, part.mirror), to: flip(part.to, part.mirror) });
    return out;
  }
  return [base];
}

export async function sketchPolygomerHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('mint_solid kind "manji-tree" via "parts" requires { title, spec: { parts } }');
  const { title, parts, physics, ref, folder_ref: folderRef, detail } = input;
  if (!title || typeof title !== 'string') throw new Error('`title` is required (string)');
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('`parts` must be a non-empty array of { shape, from, to } specs');

  const slots = [];
  const addSlot = (pos) => {
    const id = `s${slots.length}`;
    slots.push({ id, position: { x: pos[0], y: pos[1], z: pos[2] } });
    return `world/slot/${id}`;
  };
  const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n));

  const lathes = [];
  parts.forEach((part, i) => {
    if (!part || typeof part !== 'object') throw new Error(`parts[${i}]: must be an object`);
    const shape = POLY_SHAPES[part.shape];
    if (!shape) throw new Error(`parts[${i}].shape: must be one of ${POLY_SHAPE_NAMES.join(', ')} — got '${part.shape}'`);
    if (!isVec3(part.from) || !isVec3(part.to)) throw new Error(`parts[${i}] ('${part.shape}') needs from:[x,y,z] and to:[x,y,z]`);
    const g = Number.isFinite(part.girth) ? part.girth : 0.3;
    const taper = Number.isFinite(part.taper) ? part.taper : 0.15;
    if (part.half !== undefined && typeof part.half !== 'boolean') {
      throw new Error(`parts[${i}].half: must be a boolean (true = the \`to\`-side half, flat cut at \`from\`)`);
    }
    const profile = part.half ? halveProfile(shape(g, taper)) : shape(g, taper);
    const stroke = typeof part.tint === 'string' ? part.tint : '#5a6b6a';
    for (const pl of expandPlacements(part)) {
      lathes.push({
        axisFrom: addSlot(pl.from),
        axisTo: addSlot(pl.to),
        profile,
        crossSections: Number.isInteger(part.crossSections) ? part.crossSections : 18,
        samples: Number.isInteger(part.samples) ? part.samples : 26,
        style: { stroke, width: 0.5 },
      });
    }
  });

  const tree = {
    id: 'world',
    spine: { bar1: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 0.06 } },
    anchor: { x: 0, y: 0, z: 0 },
    slots,
  };
  const result = mintManjiTree({
    title,
    dimensions: '3d',
    tree,
    lathes,
    showSlotMarkers: false,
    physics: physics || { gravity: { x: 0, y: 0, z: -1 }, gravityStrength: 1, defaultSagFactor: 0.12 },
    ref,
    folderRef,
    detail,
  });
  return {
    ...result,
    parts: lathes.length,
    // The Claude plugin profile has no skin step (lib/mcp/plugin-profile.js): the scaffold exports as it is.
    next: `Open svgUrl and check the massing (adjust in place: update_sketch({ ref: "${result.ref}", manifest }) — full replace, validated by the render contract). Then: ${pluginProfileActive() ? '' : `get_skin_packet({ ref: "${result.ref}" }) → paint the scaffold → skin_polygomer → `}export_model → /model.glb (turnable 3D).`,
  };
}

export async function createManjiTreeHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('mint_solid kind "manji-tree" requires { title, spec: { tree, dimensions } }');
  }
  const {
    title,
    tree,
    dimensions,
    camera,
    roomBasis,
    viewBox,
    showSlotMarkers,
    ref,
    folder_ref: folderRef,
    connections,
    physics,
    waveFields,
    waveManji,
    lathes,
    vajras,
    taijis,
    plants,
    fields,
    detail,
    drapes,
  } = input;
  return mintManjiTree({
    title,
    tree,
    dimensions,
    camera,
    roomBasis,
    viewBox,
    showSlotMarkers,
    ref,
    folderRef,
    connections,
    physics,
    waveFields,
    waveManji,
    lathes,
    vajras,
    taijis,
    plants,
    fields,
    detail,
    drapes,
  });
}
