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

import { registerTool } from '@/lib/mcp/server';
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
import { validateWaveManji, validateWaveManjiFieldRefs, waveManjiScriptIds } from '@/lib/graph/polygonizer/wave-manji.js';
import { validateLathes } from '@/lib/graph/polygonizer/lathe.js';
import { validateVajras } from '@/lib/graph/polygonizer/vajra.js';
import { validateTaijis } from '@/lib/graph/polygonizer/taiji.js';
import { validatePlants, expandPlants, estimatePlantSegments } from '@/lib/graph/polygonizer/plant.js';
import { validateFields } from '@/lib/graph/polygonizer/fields.js';

export function mintManjiTree({ title, tree, dimensions, camera, roomBasis, viewBox, showSlotMarkers, ref, folderRef, connections, physics, waveFields, waveManji, lathes, vajras, taijis, plants, fields } = {}) {
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
    ...(vajras !== undefined ? { vajras } : {}),
    ...(allTaijis.length > 0 ? { taijis: allTaijis } : {}),
    ...(plants !== undefined ? { plants } : {}),
    ...(fields !== undefined ? { fields } : {}),
    ...(physics !== undefined ? { physics } : {}),
    ...(title ? { title } : {}),
  };

  let sketch;
  try {
    sketch = SketchRepository.create({ title, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    svgUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/svg?inline=1`,
  };
}

export async function createManjiTreeHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_manji_tree requires { title, tree, dimensions }');
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
  });
}

export function registerManjiTreeTools() {
  registerTool({
    name: 'create_manji_tree',
    description:
      "Mint a vector-space illustration by authoring a manji-program tree directly — the polygonizer's manji-driven IR. The substrate validates the tree against the cardinal-lattice grammar (`validateManjiTree` for 2D, `validateManjiTree3D` for 3D), persists it, and serves a rendered SVG at `/api/sketches/<ref>/svg?inline=1`. For 3D trees, every point is projected through pure-mandala's existing two-point perspective camera before render — you author in cardinal 3D world space and get a perspective illustration back. The manji-tree IR is enumerable, validation is binary, and recursion is fractal: macro-to-micro nested cardinal manjis terminating in named marks. Reach for this when you want to compose an illustration structurally (positional reality + slot grammar) without going through the recipe-compiler family-specific paths.\n\nTree node shape (one of):\n  • `{ programRef: 'snowflake-sixfold', anchor?, scale?, children? }` — library-backed (2D only; refs into mandala-patterns).\n  • `{ inlineProgram: cardinalManjiOutput, anchor?, scale?, children? }` — raw 2D/3D manji program.\n  • 2D inline preset: `{ spine: { bar1, bar2 }, slotPattern: { id, params }, slotLabels, centerSlotId?, anchor?, scale?, children? }`.\n  • 3D inline preset: `{ spine: { bar1, bar2, bar3 }, slots: [{ id, position: { x, y, z } }], anchor?, scale?, children? }`.\n  • Terminal mark: `{ kind: 'line' | 'polygon' | 'dot' | 'brick-fill' | 'hatch' | 'stipple' | 'wash' | 'wisp', anchor?, scale? }`.\n\nChild binding: `{ slot: 'arm-0', slotScale?: number, node: <tree node> }`.\n\nBar spec: `{ axis: 'N-S' | 'E-W' | 'Zenith-Nadir', tails?: { [cardinal]: 'open' | 'closed' | <cardinal> }, lengthScale?: number }`. Cardinal alphabet for tails: N, S, E, W, Zenith, Nadir, or aliases `open` / `closed`. Validation throws on free angles — every bar and fold is line-pinned to a cardinal axis.\n\nConnections (3D ONLY — a sibling primitive to the manji tree): pass `connections: [...]` to draw 1px sine/cosine curves between two named points on the tree. Each entry: `{ from, to, sag?, relativeSag?, wavelengths?, plane?, samples?, style? }` where `from` and `to` are endpoint paths of the form `<node-id>/slot/<slot-id>` or `<node-id>/bar/<axis>/<point-name>` (axis ∈ {N-S, E-W, Zenith-Nadir}; point-name ∈ {center, negEnd, posEnd, negTip, posTip}). Endpoint paths require authored `id` fields on the tree nodes you want to reference. Substrate resolves paths at render time, so moving a manji moves anything connected to it. Sag precedence (most specific wins): `sag` (absolute world units) > `relativeSag` (fraction of span — portable across endpoint distances, use this in shelf cards) > physics auto-sag. Positive sag bulges with gravity (catenary/hang); negative sag bulges against (arc/trajectory). `wavelengths` defaults to 0.5 (single half-cycle); use higher values for vibrating-string overlays. `plane` overrides the displacement direction (default = gravity projected perpendicular to the segment). `style: { stroke, width }` controls SVG appearance.\n\nLimb-chains (3D ONLY — IN-TREE leaf-mark, sibling to connections/wave-fields/wave-manji/lathes): place `{ kind: 'limb-chain', origin, fold, segments }` as a CHILD of a manji-tree node (under `children`, not a top-level array) to grow a forward-kinematic joint chain from a slot. The chain emits new slots on its enclosing manji at each segment's tip, so downstream consumers (connection tubes, lathes, adornments) reference the FK-emerged joints by `self/slot/<name>` paths exactly like hand-authored landmarks. This is the substrate's figure-authoring primitive — five X-tip slots + four limb-chains = nineteen addressable landmarks with one shoulder/hip rotation per limb instead of twenty-three hand-rigged positions.\n\nSpec: `{ kind: 'limb-chain', origin: 'self/slot/<id>', fold: [x,y,z], segments: [{ length, emit, rotations? | bend?, bendAxis?, hinge?, hingeAxis?, direction? }, ...] }`. `origin` resolves to a world position on the enclosing manji's slot list. `fold` is the unit vector for segment 0's direction (each subsequent segment continues from the previous tip in the running fold direction, modified by rotations). Each segment carries `length` (world units, scaled with parent worldScale) and `emit` (slot id appended to the parent manji's slot list with the FK-computed world position).\n\nSegment rotation, in precedence order:\n  1. `direction: [x,y,z]` — explicit world-direction override; replaces the rotation chain for that segment (use for foot-chain heel-back-then-toe-forward direction flips).\n  2. `rotations: [{axis, angle}, ...]` — composed cardinal-axis rotations applied IN ORDER to the running fold-vector. `axis` is `'N-S'` (= world Y, lateral abduction), `'E-W'` (= world X, sagittal flexion), `'Zenith-Nadir'` (= world Z, axial yaw), `'binormal'` (perpendicular to fold + world-forward — anatomical flexion direction that auto-tracks the running fold), or explicit `[x,y,z]`. `angle` is degrees. Order matters; rotations are non-commutative.\n  3. `bend: number` + `bendAxis?` — legacy single-rotation shorthand (one axis, one angle).\n\nHinge constraint (`hinge: true`, optional `hingeAxis: 'binormal' | cardinal | [x,y,z]`): marks the segment as a 1-DOF anatomical joint — elbow, knee, ankle-flex. The validator REFUSES segments that combine `bend` with `rotations`, that have multiple rotation entries, or whose rotation axis conflicts with the declared `hingeAxis`. The walker forces single-axis rotation around the hinge axis (default `'binormal'`, which gives anatomical sagittal-plane flexion regardless of the proximal segment's orientation). Use hinge on elbow/knee/ankle-flex to prevent disfiguration — the substrate refuses to author backward-bending joints. Positive `bend` = flexion toward the proximal segment; same direction parameter works correctly for arms hanging or raised, legs forward or backward.\n\nAuthoring discipline: limb-chains appear in the parent's `children` array BEFORE any leaf mark that references their emitted slots — chains emit at walk-time in document order, so a connection tube authored before its chain fails validation with an unknown-slot error.\n\nNode rotation (3D ONLY — manji-node-level transform): any 3D manji node accepts `rotation: [{axis, angle}, ...]` and optional `rotationPivot: {x, y, z}` (local-frame point, defaults to local origin). Rotations are composed in order around the pivot in the node's local space BEFORE the world transform (anchor + scale + reflect). Axis values match limb-chain rotation axes (cardinal labels or vectors). Rotates ALL of the node's slot positions as one unit.\n\nThe figure substrate calls this \"the X-center rotational hub\" — one rotation parameter rotates the whole figure (head/torso/shoulders/hips/limbs) as a unit. Common uses: forward lean for running (`rotation: [{axis: 'E-W', angle: 18}], rotationPivot: {x:0, y:0, z:0}` — pivot at feet, body tilts forward); spinal twist (`Zenith-Nadir` rotation pivot at waist); side-bend (`N-S` rotation).\n\nLocal-frame chains: a manji node's rotation propagates to its limb-chain children — the chain's `fold` AND each segment's rotation axes (including cardinal labels) are transformed by the parent's rotation BEFORE the FK walk. Effect: when the body tilts forward, the legs auto-tilt with it (not vertical from rotated hips), and chain-relative cardinal axes ('E-W' for a hip rotation) mean \"the body's lateral axis after the parent's rotation\" rather than world's. Pose authoring is portable across whole-figure orientations.\n\nFigure substrate pattern (a curated authoring shape, not a primitive — uses limb-chains + hinges + optional node rotation): a humanoid figure card is a manji node with a Zenith-Nadir spine bar, eleven declared slots (`head-crown`, `head-base`, `neck-base`, `torso-top`, `torso-base`, `pelvis-top`, `pelvis-floor`, `shoulder-l`, `shoulder-r`, `hip-l`, `hip-r`), six limb-chain children (left arm, right arm, left leg, right leg, left foot, right foot), three lathes (head, torso, pelvis surfaces of revolution along the spine), and tube connections between adjacent landmarks. The chains emit twelve more slots (`elbow-l/r`, `wrist-l/r`, `knee-l/r`, `ankle-l/r`, `heel-l/r`, `toe-l/r`) for a total of twenty-three addressable landmarks — the canonical figure vocabulary that adornment cards bind against (`figure-halo` on `head-crown`, `figure-orb` on `wrist-r`, `figure-cape` across `shoulder-l/r` + `ankle-l/r`).\n\nThe pose lives in the limb-chain rotations: shoulder/hip rotations on segment 0 (first arm/leg segment), hinge bends on segment 1 (elbow/knee), ankle rotations on segment 0 of each foot chain. The eight figure-posture shelf cards (`standing-figure-canonical`, `seated-figure-formal`, `kneeling-figure-supplicant`, `reclining-figure-classical`, `contrapposto-figure-canonical`, `figure-orans`, `figure-walking`, `figure-praying-bowed`) ship the canonical landmark layouts; `semantic_search({ kinds: ['manji_program'] })` with figure intents surfaces them. Adornment cards (`figure-halo`, `figure-orb`, `figure-cape`) attach as slot-bound children on a figure's emerged slots — same composition path as any other slot binding. Whole-figure pose changes (running lean, twist) use node-level `rotation` at the figure's invocation; per-limb pose changes use chain rotations and hinge bends.\n\nCalling shelf-card surface presets by name: a `programRef`-bearing node like `{ programRef: 'calm-water' }` resolves to its card's `manjiProgram`. When the card is a container preset — `manjiProgram` has children but no spine and no slots (the shape Wave 1.5 surface cards landed in) — the walker INLINES the card's children at the calling node's position, leaving the host's enclosing-manji id in scope as `self`. Cards declare a slot-name contract through their `self/slot/<id>` corner paths (e.g. `self/slot/NW`/`NE`/`SE`/`SW` for the 4-corner surface family). If the host's slots match those names, invocation is one line. If the host's slot names differ, attach `pathBindings: { '<card-path>': '<host-path>', ... }` to the programRef node and the substrate rewrites each matched endpoint at inline time. Example: `{ slot: 'fill', node: { programRef: 'calm-water', pathBindings: { 'self/slot/NW': 'world/slot/water-NW', /* ... */ } } }`. Matching is exact-string; unbound paths fall through unchanged.\n\nWave fields (3D ONLY — a sibling primitive to connections, raised to 2D): pass `waveFields: [...]` to draw a height-field over a 4-corner quad as a 1px crest-line grid. Each entry: `{ corners, waves?, displacement?, samples?, style? }`. `corners` is an ordered array of 4 endpoint paths (same grammar as connections) defining the quad CCW from `(u=0,v=0)`: `[ne, nw, sw, se]`-style — corner at parameter `(0,0)`, `(1,0)`, `(1,1)`, `(0,1)`. `waves` is an array of components, each `{ amplitude, cycles: { u, v }, phase? }` — `amplitude` in world units of displacement, `cycles` is the number of full sine cycles across the field in each parameter direction (model-friendly: 2 cycles = 2 visible humps; resizing the quad keeps the wave structure intact). `phase` defaults to 0. Components SUM linearly — long swell + chop + capillary in one field. **Empty `waves` array (or omitted) renders a FLAT quad** as a crest-line grid; this is the “flat is still good” default for floors. `displacement` overrides the displacement direction (default = `physics.gravity`, so a horizontal field lifts/lowers along it). `samples: { u: number, v: number }` controls grid density (default 16×16; minimum 2 per axis). `style: { stroke, width }` controls SVG appearance. Use cases: a hall floor with no waves (flat grid); the same hall floor with one low-amplitude long-wavelength component (subtle uneven stone); an ocean wide-shot with summed swell + chop + capillary components.\n\nPhysics (3D ONLY, scene-global): `physics: { gravity, gravityStrength, defaultSagFactor }`. `gravity` is a `{x,y,z}` unit vector (default `(0,0,-1)`, world-Z down). `gravityStrength` multiplies the auto-sag (default 1; set lower for lunar feel, higher to slacken). `defaultSagFactor` is the proportion-of-span at unit strength (default 0.12). One Earth per scene — per-connection / per-wave-field physics overrides are not supported; use explicit `sag` / `plane` on individual lines and `displacement` on individual fields to override locally.\n\nWave manji (3D ONLY — a sibling primitive to connections and wave-fields): pass `waveManji: [...]` to draw closed-loop printer scripts that wind around a singularity. Where connections are 1D *open* curves between two pins and wave-fields are 2D *open* surfaces over four pins, wave manji are 1D *closed* — loops with periodic boundary, anchored to a singularity point. The printer runs a named modulation script that emits one or more polylines per pass. Each entry: `{ singularity, script, bending?, plane?, params?, seed?, density?, samples?, style? }`. `singularity` is either an endpoint path (same grammar as connections) or a `{x,y,z}` point — it's the center the loops wind around. `script` is one of: `${waveManjiScriptIds().join(', ')}`. `bending` is the benevolent-attractor intensity (default 1.0) — stronger bending tightens the form toward the singularity, weaker bending lets it disperse outward; each script has a stable basin where its character holds. `plane` is the loop's plane normal (default = scene gravity direction; the loop lives in the plane perpendicular to it). `params` is a script-specific override bag (see archetype params below). `seed` is a string or number that feeds a deterministic PRNG for stochastic archetypes (cloud); same seed = same instance. `density` overrides the script's default pass count for density-driven archetypes (rasengan, cloud). `samples` controls polyline resolution per loop (default 64; minimum 8). `style: { stroke, width }` controls SVG appearance.\n\nArchetype params (all optional, each archetype's `params` bag):\n  • ouroboros — `{ radius (default 1.0), phase (default 0) }`. Single closed loop, zero modulation.\n  • mandala — `{ N (default 6), radius (default 1.0), lobeDepth (default 0.15), phase (default 0) }`. N-fold rotational symmetry; a single n=N cosine harmonic carves N evenly-spaced lobes that align across passes.\n  • wind-chime — `{ N (default 8), centerRadius (default 1.0), subRadius (default 0.2), phase (default 0) }`. N small loops arranged radially around the singularity in the spec's plane.\n  • rasengan — `{ initialRadius (default 0.1), maxRadius (default 1.0; scaled by 1/bending), phaseStep (default 0.45), passes (default 30; overridden by density), harmonics (default []) }`. Outward spiral with phase rotation per pass; bending caps the outer reach. The loop's plane is fixed; the form is disc-like.\n  • rasengan-sphere — `{ initialRadius (default 0.1), maxRadius (default 1.0; scaled by 1/bending), phaseStep (default 0.45), totalTilt (default π), tiltAxis (default 'uHat'; accepts 'uHat' | 'vHat' | {x,y,z} unit vector), passes (default 40; overridden by density), harmonics (default []) }`. Same expansion and phase rotation as rasengan, plus per-pass tilt of the loop basis around an in-plane axis using Rodrigues' formula. The singularity stays fixed; only (uHat, vHat) rotate per pass, so successive loops cover a volumetric form rather than a flat disc. `totalTilt = π` gives a half-sweep (lens/lemon read); `totalTilt = 2π` gives a full sweep (loops return to original orientation).\n  • smoke-ring — `{ N (default 24), mainRadius (default 1.0), tubeRadius (default 0.2; scaled by 1/bending), phase (default 0) }`. Toroidal: cross-section loops swept around a main ring, each in its own perpendicular plane.\n  • celtic — `{ p (default 2), q (default 3), R (default 0.7), r (default 0.3; scaled by 1/bending), samples (default 256) }`. (p, q) torus knot as one continuous closed curve; coprime (p, q) produces the endless / Tibetan-knot family.\n  • cloud — `{ initialRadius (default 0.2), maxRadius (default 1.5), perturbAmplitude (default 0.08), harmonicStrength (default 0.05), passes (default 24; overridden by density) }`. Stochastic outward expansion with growing harmonic content; bending damps perturbation.\n  • tusk — `{ initialRadius (default 0.15), growthFactor (default φ ≈ 1.618), phaseStep (default 'golden' = the Golden Angle ≈ 2.4 rad; accepts numeric), precess (default true), precessionRatio (default 1/8; precessionStep = phaseStep × ratio), tiltAxis (default 'uHat'; accepts 'uHat' | 'vHat' | {x,y,z}), passes (default 16; overridden by density), harmonics (default []) }`. Golden-spin archetype: logarithmic golden-spiral radial growth (radius multiplies by φ per full revolution), Golden Angle phase rotation per pass, and per-pass plane precession at an irrational ratio of phaseStep. No two passes share angle, radius, AND plane within the run — the printable analog of Steel Ball Run's 'infinite rotation.' Bending dampens the exponential growth: tighter bending → slower spiral.\n  • helix — `{ N (default 6), radius (default 1.0), lobeDepth (default 0.15), pitch (default 0.1; scaled by 1/bending), phaseStep (default 0; accepts 'golden'), axis (default 'normal'; accepts 'normal' | 'uHat' | 'vHat' | {x,y,z} unit vector), passes (default 24; overridden by density) }`. Per-pass center translation along `axis` plus per-pass phase advance — the printed trail spirals as it climbs. With N>0 and lobeDepth>0 the cross-section is an N-fold lobed ring (twisted column read); with N=0 or lobeDepth=0 it's a smooth spring/coil. The stack is centered on the singularity (extent = pitch × (passes − 1)). Two-modulation analog of tusk: phase rotation + axial translation instead of phase rotation + plane precession.\n\nNamed angle constant: any archetype with a `phaseStep` parameter accepts the literal string `'golden'` (resolves to 2π × (1 − 1/φ) ≈ 137.5°). This is the maximally-non-repeating angular distribution — the same proportion plants use for leaf phyllotaxis. Use it on rasengan or rasengan-sphere to give those archetypes a Golden-Spin quality without changing any other parameter.\n\nWave manji share `physics` with connections and wave-fields — the singularity bending intensity *competes* with scene gravity, so a strongly-bent wave manji ignores ambient forcing while a weakly-bent one drifts with the scene. No envelope primitive needed.\n\nFields (3D ONLY — declared scalar fields the manifest's primitives can reference for position-dependent parameters): pass `fields: { <id>: <decl> }` to declare named scalars that vary with position. Each declaration's `kind` ∈ { 'constant', 'radial', 'gradient' }. A parameter that accepts field references takes either a literal number or `{ field: '<id>' }`; the substrate evaluates the referenced field at the primitive's natural sample point and substitutes the resulting scalar. Currently consumed by `waveManji[].bending` — when authored as a field reference, the field is evaluated at the wave manji's singularity position, so the same field can give different bending intensities to wave-manji at different positions. Field kinds:\n  • `{ kind: 'constant', value: <number> }` — returns `value` everywhere.\n  • `{ kind: 'radial', center, innerRadius, innerValue, outerRadius, outerValue, beyond? }` — distance-from `center` (endpoint path or `{x,y,z}`); linearly interpolated from `innerValue` at `innerRadius` to `outerValue` at `outerRadius`. `beyond` controls extrapolation past the outer ring: 'clamp' (default, stays at `outerValue`) or 'extrapolate' (continues the linear ramp).\n  • `{ kind: 'gradient', from, fromValue, to, toValue, beyond? }` — projects the query point onto the from→to axis and lerps from `fromValue` to `toValue` along that axis. `beyond` controls extrapolation past either endpoint.\nFields make scene-level forcing literally position-dependent — see waveform-physics-design.md §6 (\"Scene coupling\").",
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title for the resulting sketch artifact.',
        },
        tree: {
          type: 'object',
          additionalProperties: true,
          description:
            'Root manji-tree node. See the description for shape options (library-ref, inline preset 2D/3D, inline raw program, or terminal mark). Validation runs server-side via `validateManjiTree` / `validateManjiTree3D` depending on `dimensions`.',
        },
        dimensions: {
          type: 'string',
          enum: ['2d', '3d'],
          default: '2d',
          description:
            '`2d` walks via `walkManjiTree` and renders in unit-space. `3d` walks via `walkManjiTree3D`, projects every point through pure-mandala\'s `projectTwoPoint` perspective camera, and renders the result. Defaults to `2d`.',
        },
        camera: {
          type: 'object',
          additionalProperties: true,
          description:
            '3D only. Camera primitive consumed by `projectTwoPoint`: `{ vanishingPoints: { left: [x,y], right: [x,y] }, verticalAxis: [x,y] }`. Defaults to substrate defaults when omitted.',
        },
        roomBasis: {
          type: 'object',
          additionalProperties: true,
          description:
            '3D only. Room basis consumed by `projectTwoPoint`: `{ xRange, yRange, frontY, backY, frontLeft, frontRight, depthReach, verticalUnit, verticalDepthShrink }`. Defaults to substrate defaults when omitted.',
        },
        viewBox: {
          type: 'object',
          additionalProperties: false,
          properties: {
            width: { type: 'number', minimum: 1 },
            height: { type: 'number', minimum: 1 },
          },
          description:
            'Optional explicit viewport size used by the SVG renderer (2D mode fits content into this box; 3D mode mostly ignores it since projected coordinates determine the viewBox naturally).',
        },
        showSlotMarkers: {
          type: 'boolean',
          default: true,
          description:
            'When true (default), the renderer overlays small markers at the root node\'s slot world positions — useful for debugging / operator review. Set to false for a cleaner illustration.',
        },
        ref: {
          type: 'string',
          description:
            'Optional stable sketch ref (1-64 chars of [A-Za-z0-9_-]). If omitted, a `sk_<10-char>` ref is generated.',
        },
        folder_ref: {
          type: 'string',
          description:
            'Optional folder ref to file the sketch under. Pass null to leave it at root.',
        },
        connections: {
          type: 'array',
          description:
            '3D only. Sine/cosine curves drawn between two named tree points. Endpoint paths target authored node ids; the substrate resolves them to world XYZ at render time. See the tool description for the path grammar and per-line shape parameters.',
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              from: { type: 'string', description: "Endpoint path: '<node-id>/slot/<slot-id>' or '<node-id>/bar/<axis>/<point-name>'." },
              to:   { type: 'string', description: "Endpoint path (same grammar as `from`)." },
              sag:  { type: 'number', description: 'Signed peak displacement in world units (absolute). Positive = bulge with gravity; negative = bulge against. Wins over `relativeSag` and physics auto-sag.' },
              relativeSag: { type: 'number', description: 'Signed peak displacement as a fraction of the segment span. Portable across endpoint distances — a card declaring `relativeSag: -0.25` reads as an arc at any span. Used when `sag` is not provided; overrides physics auto-sag.' },
              wavelengths: { type: 'number', description: 'Full sine cycles across span. Default 0.5 (single half-cycle / arc / catenary). Use higher values for vibrating-string overlays.' },
              plane: {
                type: 'object',
                description: 'Optional bulge-direction override. Default = gravity projected perpendicular to the segment.',
                additionalProperties: false,
                properties: {
                  x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' },
                },
              },
              samples: { type: 'number', description: 'Polyline resolution. Default 48; minimum 8.' },
              style: {
                type: 'object',
                additionalProperties: true,
                description: 'Render-time appearance. Default stroke `#222`, width 1.2.',
                properties: {
                  stroke: { type: 'string' },
                  width:  { type: 'number' },
                },
              },
            },
            required: ['from', 'to'],
          },
        },
        waveFields: {
          type: 'array',
          description:
            '3D only. 2D height fields over a 4-corner quad, rendered as a 1px crest-line grid. Empty `waves` array means a flat quad (the floor stays flat); add components to lift it into a wavy surface (ocean, water, uneven ground). See the tool description for full schema.',
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              corners: {
                type: 'array',
                minItems: 4,
                maxItems: 4,
                items: { type: 'string', description: "Endpoint path: '<node-id>/slot/<slot-id>' or '<node-id>/bar/<axis>/<point-name>'." },
                description: 'Ordered array of 4 corner endpoint paths, CCW from (u=0,v=0).',
              },
              waves: {
                type: 'array',
                description: 'Sine components that SUM into the field height. Empty = flat surface.',
                items: {
                  type: 'object',
                  additionalProperties: true,
                  properties: {
                    amplitude: { type: 'number', description: 'World-unit displacement magnitude for this component.' },
                    cycles: {
                      type: 'object',
                      additionalProperties: false,
                      description: 'Full sine cycles across the field in each parameter direction.',
                      properties: { u: { type: 'number' }, v: { type: 'number' } },
                    },
                    phase: { type: 'number', description: 'Optional radian offset (default 0).' },
                  },
                  required: ['amplitude'],
                },
              },
              displacement: {
                type: 'object',
                additionalProperties: false,
                description: 'Optional override of the displacement direction. Default = physics.gravity.',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              samples: {
                type: 'object',
                additionalProperties: false,
                description: 'Grid density (default 16×16; minimum 2 per axis).',
                properties: { u: { type: 'number' }, v: { type: 'number' } },
              },
              style: {
                type: 'object',
                additionalProperties: true,
                description: 'Render-time appearance. Default stroke `#888`, width 0.5.',
                properties: { stroke: { type: 'string' }, width: { type: 'number' } },
              },
            },
            required: ['corners'],
          },
        },
        waveManji: {
          type: 'array',
          description:
            '3D only. Closed-loop printer scripts winding around a singularity (sibling to connections and wave-fields). Each entry runs a named modulation script (ouroboros, mandala, wind-chime, rasengan, smoke-ring, celtic, cloud) and emits one or more polylines. See the tool description for archetype-specific params, the bending-intensity semantics, and the singularity / plane / seed / density knobs.',
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              singularity: {
                description: "Endpoint path '<node-id>/slot/<slot-id>' or '<node-id>/bar/<axis>/<point-name>', OR a {x,y,z} point in world space.",
              },
              script: {
                type: 'string',
                enum: waveManjiScriptIds(),
                description: 'Modulation archetype name. See tool description for each script\'s defaults and params.',
              },
              bending: {
                description: "Benevolent-attractor intensity. Accepts either a number (default 1.0) or a field reference `{ field: '<id>' }` that resolves through `manifest.fields` and is evaluated at the singularity position. Stronger bending tightens the form toward the singularity.",
              },
              plane: {
                type: 'object',
                additionalProperties: false,
                description: "Optional loop-plane normal. Default = scene gravity direction.",
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              params: {
                type: 'object',
                additionalProperties: true,
                description: 'Script-specific parameter overrides. See tool description for each archetype\'s param bag.',
              },
              seed: { description: 'Deterministic seed (string or number) for stochastic archetypes (cloud).' },
              density: { type: 'number', description: 'Override the script\'s default pass count (relevant for rasengan, cloud).' },
              samples: { type: 'number', description: 'Polyline resolution per loop. Default 64; minimum 8.' },
              style: {
                type: 'object',
                additionalProperties: true,
                description: 'Render-time appearance. Default stroke `#222`, width 1.0.',
                properties: { stroke: { type: 'string' }, width: { type: 'number' } },
              },
            },
            required: ['singularity', 'script'],
          },
        },
        fields: {
          type: 'object',
          additionalProperties: true,
          description:
            "3D only. Declared scalar fields the manifest's primitives can reference for position-dependent parameters. Each entry is `<id>: <decl>` where `<decl>` carries a `kind` ∈ { 'constant', 'radial', 'gradient' }. `constant` is `{ kind, value }`. `radial` is `{ kind, center, innerRadius, innerValue, outerRadius, outerValue, beyond? }` — `center` is an endpoint path string or `{x,y,z}`, `beyond` ∈ { 'clamp' (default), 'extrapolate' }. `gradient` is `{ kind, from, fromValue, to, toValue, beyond? }` — interpolates linearly along the from→to axis. Currently consumed by `waveManji[].bending` when authored as `{ field: '<id>' }`; future primitives will widen the same way.",
        },
        lathes: {
          type: 'array',
          description:
            "3D only. Surface-of-revolution primitives — bowls, vases, columns, chalices, balusters. Each lathe sweeps a 1D profile waveform around an axis between two endpoint paths, emitting cross-section polylines that get depth-sorted and painted. Optional N-fold angular harmonics carve flutes / chisel marks into the surface. Each entry: `{ axisFrom, axisTo, profile, harmonics?, crossSections?, samples?, style? }`. `axisFrom` / `axisTo` are endpoint paths (same grammar as connections) OR `{x,y,z}` points; they define the rotation axis from t=0 to t=1. `profile` is a non-empty array of `{ t, radius }` control points sorted by t — the radius at each cross-section is linearly interpolated between control points (one entry = constant radius = cylinder). `harmonics` is an array of `{ n, amplitude, phase? }` — each component adds `amplitude * cos(n * theta + phase)` to the cross-section radius, so n=24 with negative amplitude carves 24 inward flutes (Doric column), n=6 with positive amplitude bulges 6 outward lobes. `crossSections` is the density along the axis (default 24; minimum 2). `samples` is the polyline resolution per cross-section (default 36; minimum 8). `style: { stroke, width }` controls the default WIREFRAME (ring) appearance; set `style: { fill: 'vexar', fillColor: '#hex' }` instead for a LIT SHADED SOLID (Lambert-shaded quad faces, back-to-front depth-sorted) — this is how you render BALL-AND-STICK molecules / lattices as solids rather than rings (a ball = a dome profile `[{t:0,radius:0},{t:0.5,radius:R},{t:1,radius:0}]` about a short axis through the atom centre; a rod = a constant-radius lathe between two atom centres). Lighting comes from the manifest's optional `light: { direction:[x,y,z], ambient, diffuse }` (a soft over-the-shoulder key by default).",
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              axisFrom: { description: "Top of axis. Endpoint path or {x,y,z}." },
              axisTo:   { description: "Bottom of axis. Endpoint path or {x,y,z}." },
              profile: {
                type: 'array',
                description: 'Control points for the radius-along-axis curve. Linearly interpolated between adjacent entries.',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['t', 'radius'],
                  properties: {
                    t: { type: 'number', description: 'Axis parameter, 0 at axisFrom, 1 at axisTo.' },
                    radius: { type: 'number', description: 'Cross-section radius in world units at this t.' },
                  },
                },
              },
              harmonics: {
                type: 'array',
                description: 'Optional N-fold angular harmonics. Each component adds `amplitude * cos(n * theta + phase)` to the cross-section radius.',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['n', 'amplitude'],
                  properties: {
                    n: { type: 'integer', minimum: 1, description: 'Harmonic order (lobe count).' },
                    amplitude: { type: 'number', description: 'Radial displacement amplitude (negative carves inward).' },
                    phase: { type: 'number', description: 'Optional radian offset, default 0.' },
                  },
                },
              },
              crossSections: { type: 'number', description: 'Density along the axis. Default 24; minimum 2.' },
              samples: { type: 'number', description: 'Polyline resolution per cross-section. Default 36; minimum 8.' },
              style: {
                type: 'object',
                additionalProperties: true,
                description: 'Render-time appearance. Default stroke `#777`, width 0.5.',
                properties: { stroke: { type: 'string' }, width: { type: 'number' } },
              },
            },
            required: ['axisFrom', 'axisTo', 'profile'],
          },
        },
        vajras: {
          type: 'array',
          description:
            "3D only. The 3-point RELATIONAL primitive — an atomic bond `o-o-o` between a small center hub and two larger outer spheres. The form is two sideways LIGHTBULBS with their screw ends facing each other: each prong is a fat outer sphere (the BULB, radius = outer bead) smooth-unioned (polynomial smin of width `blend`) with a thin constant-radius neck (the SCREW, radius = center bead) running inward to the hub; the two necks meet at the center. The bond is the iso-surface of that relational volume field — the widest mass lives at the OUTER beads, the center is the thin pinch. `blend` rounds the concave bulb↔neck shoulder (0 = sharp). A vajra is OMNIDIRECTIONAL (the three points may sit anywhere in 3D) and its canonical output is WAVE-SPACE: a stack of golden rings (iso-surface cross-sections along a spine that runs pole-to-pole through both bulbs). It paints no world-space surface of its own — a later skin/drape pass consumes the rings, or a wrapping wave reads the volume. Each entry: `{ proximal, center, distal, beads?, blend?, isoOffset?, extraction?, crossSections?, samples?, style? }`. `proximal` / `center` / `distal` are endpoint paths (same grammar as connections) OR `{x,y,z}` points. `beads` is `{ proximal?: {radius}, center?: {radius}, distal?: {radius} }` — outer = bulb radius, center = neck/screw radius (defaults proximal/distal 1, center 0.5). `blend` is the shoulder-rounding width in world units (default 0 = sharp shoulder). `isoOffset` inflates a shell (default 0 = skins flush to the spheres). `extraction` ∈ { 'field' (march the iso-surface; default), 'sweep' (cheap bendable-lathe approximation) }. `crossSections` is the ring count along the spine (default 24; min 2). `samples` is the vertices per ring (default 36; min 8). `style: { stroke, width }` controls SVG appearance (default gold `#c9a23a`).",
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              proximal: { description: 'Outer bead A. Endpoint path or {x,y,z}.' },
              center: { description: 'Center hub / guideline. Endpoint path or {x,y,z}.' },
              distal: { description: 'Outer bead B. Endpoint path or {x,y,z}.' },
              beads: {
                type: 'object',
                additionalProperties: false,
                description: 'Per-bead sphere radii. Outer beads default larger than the center hub.',
                properties: {
                  proximal: { type: 'object', properties: { radius: { type: 'number' } } },
                  center: { type: 'object', properties: { radius: { type: 'number' } } },
                  distal: { type: 'object', properties: { radius: { type: 'number' } } },
                },
              },
              blend: { type: 'number', minimum: 0, description: 'Bulbousness (smin width, world units). 0 = straight tangent cone.' },
              isoOffset: { type: 'number', description: 'Iso-surface offset. 0 = flush to spheres; >0 inflates a shell.' },
              extraction: { type: 'string', enum: ['field', 'sweep'], description: "Ring extraction. 'field' marches the iso-surface (default); 'sweep' is a cheap bendable-lathe approximation." },
              crossSections: { type: 'number', description: 'Ring count along the spine. Default 24; minimum 2.' },
              samples: { type: 'number', description: 'Vertices per ring. Default 36; minimum 8.' },
              style: {
                type: 'object',
                additionalProperties: true,
                description: 'Render-time appearance. Default gold stroke `#c9a23a`, width 0.5.',
                properties: { stroke: { type: 'string' }, width: { type: 'number' } },
              },
            },
            required: ['proximal', 'center', 'distal'],
          },
        },
        taijis: {
          type: 'array',
          description:
            "3D only. The CHIRALITY primitive — the structural dual of the vajra. Where a vajra is a MIRROR-symmetric bond, a taiji is a ROTATION-symmetric (handed) COUPLING of two opposites that orbit a shared axis, each carrying the seed of its other (the yin-yang ☯). Its defining invariant is CHIRALITY: a SIGNED `twist` of the dividing surface along the yin→yang axis — `twist > 0` is right-handed, `twist < 0` left-handed, `twist = 0` is the achiral degenerate (a straight-extruded glyph with NO handedness). The form is a spine walked yin→yang where every cross-section perpendicular to the axis is the taijitu glyph ROTATED by `2π·twist·t`: stacking those rotating dividers sweeps a HELICOID, and the two glyph eyes sweep the two pole-STRANDS (a double helix). Like the vajra its output is WAVE-SPACE and it paints no world surface of its own; chirality is invisible in the (rotationally symmetric) envelope and lives entirely in the partition + strands. Composition: a taiji's axis can BE a vajra's bond line (bind `yin`/`center`/`yang` to a vajra's `<id>-proximal`/`<id>-center`/`<id>-distal` slots) — the vajra says which points are bonded, the taiji says which way the bond spins. A single taiji IS a double helix as a relation (no longer two coincidentally-paired helix wave-manji). Each entry: `{ yin, yang, center?, twist?, radius?, profile?, crossSections?, samples?, showEnvelope?, style? }`. `yin` / `yang` are the two poles — endpoint paths (same grammar as connections) OR `{x,y,z}` points. `center` is the hub/crossing (endpoint path or `{x,y,z}`; defaults to the midpoint of the poles; when off the yin–yang line it bends the axis into a quadratic Bézier, like the vajra's center). `twist` is the SIGNED number of turns from yin to yang — sign = chirality (default 0.5 = a single S read end-on; 1 = a full turn). `radius` is the lobe radius around the axis (default 1). `profile` ∈ { 'spindle' (teardrop tips at both poles; default), 'capsule' (constant radius) }. `crossSections` is the partition-slice count along the axis (default 24; min 2). `samples` is the vertices per partition divider (default 48; min 8). `showEnvelope` also emits the outer bounding rings (default false). `style: { partitionStroke, envelopeStroke, yinStroke, yangStroke, width, strandWidth }` controls SVG appearance (defaults: partition `#9aa0bd`, yin strand `#4cc9c0`, yang strand `#e9c46a`).",
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              yin: { description: 'Pole A (the yin tip). Endpoint path or {x,y,z}.' },
              yang: { description: 'Pole B (the yang tip). Endpoint path or {x,y,z}.' },
              center: { description: 'Hub / crossing. Endpoint path or {x,y,z}. Defaults to the midpoint of the poles; off-line bends the axis.' },
              twist: { type: 'number', description: 'SIGNED turns from yin to yang. Sign = chirality (>0 right-handed, <0 left-handed, 0 = achiral). Default 0.5.' },
              radius: { type: 'number', minimum: 0, description: 'Lobe radius around the axis. Default 1.' },
              profile: { type: 'string', enum: ['spindle', 'capsule'], description: "Axial envelope. 'spindle' tapers to teardrop tips (default); 'capsule' is constant radius." },
              crossSections: { type: 'number', description: 'Partition slices along the axis. Default 24; minimum 2.' },
              samples: { type: 'number', description: 'Vertices per partition divider. Default 48; minimum 8.' },
              showEnvelope: { type: 'boolean', description: 'Also emit the outer bounding rings. Default false.' },
              style: {
                type: 'object',
                additionalProperties: true,
                description: 'Render-time appearance. Strands two-toned (yin teal, yang gold) over a silver partition mesh.',
                properties: {
                  partitionStroke: { type: 'string' },
                  envelopeStroke: { type: 'string' },
                  yinStroke: { type: 'string' },
                  yangStroke: { type: 'string' },
                  width: { type: 'number' },
                  strandWidth: { type: 'number' },
                },
              },
            },
            required: ['yin', 'yang'],
          },
        },
        plants: {
          type: 'array',
          description:
            "3D only. A generative MACRO that draws a whole plant from a few numbers by compiling to taiji specs at mint time — NOT a new render primitive. The wave-form of a plant falls out of the taiji: a SPINDLE taiji is a leaf/petal (teardrop tips; the rotating partition reads as venation), a CAPSULE taiji is a stem/rachis/tongue-leaf (blunt, constant width; the partition reads as nodes/banding). A plant places those by two DETERMINISTIC rules — golden-angle divergence around the growth axis (no two leaves stack) + self-similar `taper` per node (the fractal shrink). Fully deterministic; no seed. Each entry: `{ form?, base?, tip?, center?, normal?, count?, divergence?, leafProfile?, leafTwist?, leafLength?, leafWidth?, stemRadius?, stemTwist?, taper?, arch?, discCount?, discRadius?, crossSections?, samples?, style? }`. `form` ∈ { 'shoot' (vertical stem + spiral leaves; default), 'frond' (arching rachis + alternating pinnae — a fern frond), 'flower' (petals radiating from `center` in the plane ⊥ `center`→`tip`, plus an optional golden-angle disc of `discCount` florets — a sunflower head), 'rosette' (upright capsule tongue-leaves fanned from a base — snake-plant/agave), 'tree' (RECURSIVE branching: a tapering trunk that forks into `branches` children per node, each a scaled/rotated copy recursing to `depth`, with optional leaf clusters at the twig tips — a tree or bush), 'disc' (the golden-spiral radial PACKING — N small waveforms placed on a disc by the 137.5° angle: a sunflower seed-head, a succulent crown, or — with `length` > 0 — a prolate ovoid PINECONE), 'grove' (a landscape REPEATER — scatters `count` trees across a `region` with deterministic natural variation (size/height/depth/lean/twist/cluster/green shade) on an optional sinusoidal ground; the per-tree `tree` template carries any tree knobs incl. wigs/conifers; bounded for the browser) }. PAINT (the wave→world lowering): `paint` ∈ { 'silhouette' (DEFAULT — each form filled as a solid swept-envelope shape, real VOLUME and LIGHTER than wireframe), 'fibers' (silhouette + twist-leaning fibers, painterly imperfect-cel matter for a hero plant), 'lines' (wireframe vein/banding line-art) }. BROWSER BUDGET (enforced): a plant emits many taijis, and each taiji's cost is ~crossSections×samples line segments (silhouette ≈ 2·crossSections, far cheaper). `detail` ∈ { 'low', 'medium' (default), 'high' } picks the mesh, but a plant that would exceed ~6000 segments AUTO-DROPS to 'low' unless you pin detail/crossSections/samples — so the default path is always renderable; the whole scene is hard-capped (a too-heavy manifest throws at mint with the fix). Use 'high' only for a single close-up. Tree-only knobs: `depth` (default 4), `branches` (default 2), `branchAngle` (default 35), `lengthRatio`/`radiusRatio` (self-similarity, 0.72/0.62), `crook` (gnarl, 0.12), `upBias` (gravitropism, 0.12), `foliage` ('leaves' = individual leaves; 'cluster'/'wig' = a round puff per twig; 'conifer'/'pine'/'fir' = layered tapered pine mass per twig; false = bare winter tree), `leafCount` (5), `clusterSize` (0.7), `foliageTiers` (4). Thick OLD tree recipe: big `stemRadius` (~0.6) + high `radiusRatio` (~0.8) + high `crook` (~0.25) + wide `branchAngle` (~50). Pine recipe: `foliage:'pine'`, lower `branches` (1-2), `foliageTiers` 4-6, and a narrow `branchAngle` (~18-28). Disc-only knobs: `radius`, `dome` (paraboloid bulge), `length` (>0 → pinecone ovoid), `elementProfile`, `elementSize`, `elementTwist`, `discCount`-style `count`. Branch/element counts are bounded — a spec compiling past ~600 taijis is rejected at mint. `base`/`tip` are inline `{x,y,z}` growth-axis poles (v1 is inline-only; endpoint paths are a follow-up); for `flower`, `center` is the bloom center and `base`→`tip` (or `center`→`tip`) is the facing normal. `count` is the number of leaves/pinnae/petals (default 13). `divergence` is turns per node (default the golden 0.382 ≈ 137.5°; 0.5 = distichous, 0.333 = tristichous). `leafProfile` ∈ { 'spindle' (pointed; default), 'capsule' (blunt/tongue) }. `leafTwist` is per-leaf curl, `stemTwist` the stem's signed chirality/grain. `leafLength`/`leafWidth`/`stemRadius` are base sizes; `taper` (default 0.93) is the per-node shrink ratio (the self-similarity ratio); `arch` bends each leaf/the rachis (sets the taiji `center` off-axis → Bézier). `crossSections`/`samples` pass through to every emitted taiji. `style: { stem: {...}, leaf: {...} }` carries taiji style palettes (partitionStroke / yinStroke / yangStroke / width / strandWidth). The compiled taijis merge with any hand-authored `taijis`, render through the same wave-space paint pass, and are bounded (≤ 600 taijis per plant).",
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              form: { type: 'string', enum: ['shoot', 'frond', 'flower', 'rosette', 'tree', 'disc', 'grove'], description: "Plant archetype. Default 'shoot'. 'tree' is recursive branching; 'disc' is the golden-spiral radial packing (sunflower head / seed-head / pinecone); 'grove' scatters many varied trees across a region (a landscape / forest repeater)." },
              detail: { type: 'string', enum: ['low', 'medium', 'high'], description: "Mesh density per emitted taiji. Default 'medium'. AUTO-LIGHTENS: if a plant would exceed ~6000 line segments and you haven't pinned detail/crossSections/samples, it silently drops to 'low' so the SVG stays browser-renderable. Set 'high' only for a single close-up; explicit crossSections/samples override everything." },
              paint: { type: 'string', enum: ['lines', 'silhouette', 'fibers', 'brush'], description: "How the forms are PAINTED (the wave→world lowering). 'silhouette' (DEFAULT) = each form filled as a solid swept-envelope shape (real volume, LIGHTER than wireframe). 'fibers' = silhouette + loaded fibers that lean with the taiji twist (painterly hero plants; heavier). 'brush' = thin strand strokes (a brushy / sketchy look, not filled shapes). 'lines' = wireframe line-art." },
              depth: { type: 'number', description: 'tree only — recursion levels (1–7). Default 4.' },
              branches: { type: 'number', description: 'tree only — children per fork (1–5). Default 2.' },
              branchAngle: { type: 'number', description: 'tree only — degrees each child diverges from its parent axis. Default 35.' },
              lengthRatio: { type: 'number', description: 'tree only — child length / parent length (self-similarity). Default 0.72.' },
              radiusRatio: { type: 'number', description: 'tree only — child radius / parent radius (taper). Default 0.62.' },
              crook: { type: 'number', description: 'tree only — per-segment bend / gnarl (off-axis taiji center). Default 0.12.' },
              upBias: { type: 'number', description: 'tree only — gravitropism: how strongly branches lean back toward the trunk axis. Default 0.12.' },
              foliage: { type: ['boolean', 'string'], enum: [true, false, 'leaves', 'cluster', 'wig', 'conifer', 'pine', 'fir'], description: "tree only — foliage at the twig tips. true/'leaves' = individual leaves (detailed, leafCount each); 'cluster' (alias 'wig') = ONE round foliage-puff blob per twig (far fewer objects); 'conifer'/'pine'/'fir' = stacked tapered evergreen mass per twig; false = bare winter tree. Default 'leaves'." },
              leafCount: { type: 'number', description: "tree only — leaves per terminal twig in 'leaves' mode. Default 5 (ignored by 'cluster')." },
              clusterSize: { type: 'number', minimum: 0, description: "tree only — radius of each 'cluster' foliage blob. Default 0.7." },
              foliageTiers: { type: 'number', minimum: 1, maximum: 8, description: "tree only, conifer foliage — number of stacked tapered evergreen mass tiers per twig. Default 4." },
              radius: { type: 'number', minimum: 0, description: 'disc only — disc / ovoid radius. Default 2.' },
              dome: { type: 'number', description: 'disc only — paraboloid bulge toward the normal (0 = flat seed-head, >0 = domed sunflower). Default 0.' },
              length: { type: 'number', minimum: 0, description: 'disc only — when >0, the flat disc becomes a prolate OVOID of this axial length (a pinecone / seed-cone); elements read as overlapping scales. Default 0.' },
              elementProfile: { type: 'string', enum: ['spindle', 'capsule'], description: "disc only — per-element shape. Default 'spindle' for a flat disc, 'capsule' for an ovoid (scales)." },
              elementSize: { type: 'number', minimum: 0, description: 'disc only — size of each packed element. Defaults scale with radius.' },
              elementTwist: { type: 'number', description: 'disc only — per-element taiji twist. Default 0.' },
              region: { type: 'object', additionalProperties: true, description: 'grove only — scatter footprint `{ width, depth }` (world units) centered on `base`. Default 14×14.', properties: { width: { type: 'number' }, depth: { type: 'number' } } },
              variation: { type: 'number', minimum: 0, maximum: 1, description: 'grove only — 0..1 amount of natural per-tree variation. 0 = identical clones; higher mixes STRUCTURE (branch count, recursion depth), THICKNESS (trunk girth + taper), FOLIAGE COVER (cluster mass + leaf count), plus position jitter, height, lean, branch angle, twist, and green shade. Deterministic (index-hashed, no seed). Default 0.35; try 0.5–0.6 for an obviously mixed stand.' },
              sizeRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, description: 'grove only — [min, max] height multiplier across trees. Default [0.75, 1.3].' },
              groundAmplitude: { type: 'number', description: 'grove only — sinusoidal ground relief so trees sit on gentle hills (0 = flat). Compose with a manifest `waveFields` floor for the actual painted ground. Default 0.' },
              tree: { type: 'object', additionalProperties: true, description: "grove only — the per-tree TEMPLATE: any `tree` knobs (depth, branches, habit, foliage, clusterSize, paint, plus `height`) applied to every tree before variation. Default a small wig tree (depth 3, branches 2, foliage 'cluster', height 5)." },
              base: { description: 'Growth-axis base (root). Inline {x,y,z}. Default {0,0,0}.' },
              tip: { description: 'Growth-axis tip (apex) — for flower, the facing direction. Inline {x,y,z}. Default {0,0,6}.' },
              center: { description: "Flower bloom center (alias for base on 'flower'). Inline {x,y,z}." },
              normal: { description: 'Optional flower facing normal {x,y,z} (else derived from center→tip).' },
              count: { type: 'number', description: 'Leaves / pinnae / petals. Default 13.' },
              divergence: { type: 'number', description: 'Turns per node. Default 0.382 (golden angle ≈ 137.5°). 0.5 = distichous.' },
              leafProfile: { type: 'string', enum: ['spindle', 'capsule'], description: "Leaf shape. 'spindle' = pointed (default); 'capsule' = blunt/tongue." },
              leafTwist: { type: 'number', description: 'Per-leaf curl (taiji twist). Default 0.1.' },
              leafLength: { type: 'number', minimum: 0, description: 'Base leaf/petal length. Default 1.8.' },
              leafWidth: { type: 'number', minimum: 0, description: 'Base leaf/petal half-width (taiji radius). Default 0.42.' },
              stemRadius: { type: 'number', minimum: 0, description: 'Stem/rachis girth. Default 0.16.' },
              stemTwist: { type: 'number', description: "Stem signed chirality/grain (taiji twist). Default 2." },
              taper: { type: 'number', description: 'Per-node shrink ratio (self-similarity). Default 0.93.' },
              arch: { type: 'number', description: 'Leaf/rachis bend (off-axis taiji center → Bézier). Default 0.25.' },
              discCount: { type: 'number', description: "flower only — count of golden-angle disc florets (sunflower head). Default 0." },
              discRadius: { type: 'number', description: 'flower only — disc radius. Default ~1.4× the inner petal radius.' },
              crossSections: { type: 'number', description: 'Passthrough to every emitted taiji (partition slices).' },
              samples: { type: 'number', description: 'Passthrough to every emitted taiji (vertices per divider).' },
              style: {
                type: 'object',
                additionalProperties: true,
                description: 'Taiji style palettes: `{ stem: {...}, leaf: {...} }` with partitionStroke / yinStroke / yangStroke / width / strandWidth.',
                properties: {
                  stem: { type: 'object', additionalProperties: true },
                  leaf: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
        physics: {
          type: 'object',
          additionalProperties: false,
          description:
            '3D only. Scene-global physics used to derive default sag for connections, the default displacement direction for wave fields, and the default loop plane for wave manji. One Earth per scene; per-line / per-field overrides go on the individual spec.',
          properties: {
            gravity: {
              type: 'object',
              additionalProperties: false,
              description: 'Unit vector for gravity. Defaults to {x:0,y:0,z:-1} (world-Z down).',
              properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
            },
            gravityStrength: { type: 'number', description: 'Scalar multiplier on auto-sag. Default 1.' },
            defaultSagFactor: { type: 'number', description: 'Default peak displacement as a proportion of span at unit strength. Default 0.12.' },
          },
        },
      },
      required: ['title', 'tree'],
    },
    handler: createManjiTreeHandler,
  });
}
