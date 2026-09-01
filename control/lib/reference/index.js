/**
 * Visual Reference — the harness as the vision adapter.
 *
 * A vision-capable harness (Claude Code / Codex / …) reads a photo it ALREADY
 * sees, decomposes it into mojulo's own generative dials, and files the result
 * as a reusable "reference + insights" artifact in a stash. There is no vision
 * key, no vision API call, and no pixels-for-understanding crossing the MCP
 * boundary — only the model's structured read. This mirrors the App paradigm's
 * posture (inference parked back on the agent) applied to vision.
 *
 * The capability is extraction-target-polymorphic: the same mechanism aimed at
 * different dummies. Only two things vary per target — the dial-set the model
 * writes into, and the "what's lost" caveats:
 *
 *   - scene → camera / roomBasis      → a perspective-frame cage (sketch marks)
 *   - pose  → figure pose dials        → a posed figure dummy (kind: 'figure')
 *
 * Everything else is shared: the stash item, the `insights` block, the fidelity
 * dial (thematic/gesture vs faithful), the single-shot/multi-pass lifecycle.
 *
 * This module owns the CONTENT (the two extraction protocols — the "how to
 * look") and the pure lowering (insights → cage manifest). The DB orchestration
 * (mint stash, create cage sketch, gather item) lives in the tool handler.
 *
 * See lite-template/integration/0612/visual-reference.plan.md.
 */

import { validateSketchManifest } from '@/lib/graph/sketch/sketch-manifest';
import {
  HEARTBEATS,
  SPLATCHES,
  SCENES,
  SKIES,
  CAMERAS,
  STRUCTURE_GLYPHS,
  validatePaintedLandscape,
} from '@/lib/graph/polygonizer/painted-landscape.js';
import { solvePoseFromXManji } from './pose-solve.js';
import { OBJECT_PROTOCOL, lowerObjectCage, fuseObjectInsights, summarizeObject } from './object-lower.js';
import { resolveSceneCamera, depthAtRow, rowAtDepth, equalAreaBands, foreshorteningRatio } from './scene-camera.js';

// Named figure views → azimuth degrees (matches figure-render's view convention).
const VIEW_AZ = { frontal: 0, 'three-quarter': 38, lateral: 90, left: -90, back: 180 };
function viewToAz(v) {
  if (Number.isFinite(v)) return v;
  if (typeof v === 'string' && VIEW_AZ[v] != null) return VIEW_AZ[v];
  return 0;
}

/**
 * Resolve the pose dials for a pose reference. Preferred input is an X-manji
 * (`insights.xmanji.landmarks` + `view`): the substrate SOLVES the dials against
 * the locked armature (direction "B" — see pose-solve.js). `insights.dials` is an
 * escape hatch when the model already has joint angles. Returns the dials plus a
 * `solve` report (error + which DOFs were depth-frozen) so the caller can surface
 * the fit quality and the multi-pass cue.
 */
export function resolvePoseDials(insights = {}) {
  const xm = insights.xmanji;
  if (xm && xm.landmarks && typeof xm.landmarks === 'object' && !Array.isArray(xm.landmarks)) {
    const view = viewToAz(xm.view !== undefined ? xm.view : insights.view);
    const { dof, error, frozen } = solvePoseFromXManji(xm.landmarks, { view });
    return { dials: dof, view, solve: { source: 'xmanji', error, frozen, view } };
  }
  const dials = insights.dials || insights.pose;
  if (!dials || typeof dials !== 'object' || Array.isArray(dials)) {
    throw new Error('pose reference requires insights.xmanji.landmarks (preferred) or insights.dials');
  }
  return { dials, view: insights.view, solve: { source: 'dials' } };
}

export const REFERENCE_TARGETS = ['scene', 'pose', 'landscape', 'object'];

// Per-target default fidelity. Every target leans THEMATIC/GESTURE — recover the
// scaffold's attitude, let the substrate fill the rest; `faithful` is the opt-in.
export const DEFAULT_FIDELITY = { scene: 'thematic', pose: 'gesture', landscape: 'thematic', object: 'blocky' };

// ---------------------------------------------------------------------------
// The extraction protocols (the heart — content, not plumbing). Each is the
// "how to look" a vision harness reads BEFORE it fills capture_reference args:
// which key lines to read off the image, which dials to map them onto, how
// tightly to quantize at the chosen fidelity, the expressive ceiling, and which
// second view resolves which single-photo ambiguity.
// ---------------------------------------------------------------------------

const SCENE_PROTOCOL = {
  target: 'scene',
  summary:
    "Read a scene/room/street photo's PERSPECTIVE — not its texture. A photograph is not a two-point drawing: it has a HORIZON and however many recession directions the scene contains. Recover the horizon, the PRINCIPAL recession, the near edge of the ground, and where your read stops — that maps every image row to a ground depth, which is what lets you place things by AREA instead of by eye. Throw away surface; keep the cage.",
  key_lines: [
    'HORIZON first: the eye-level row, where the ground plane\'s points at infinity land. In an outdoor photo the sea/land horizon IS it. Report its pixel Y (`camera.horizonY`).',
    'PRINCIPAL RECESSION: follow the dominant set of parallel edges running AWAY from you (the street, the corridor, the room\'s long axis) to where they meet on the horizon. Report it as `camera.vanishingPoint: [x,y]`. Usually one point is all a photograph gives you — a frontal street canyon has BOTH façade rows converging on the same point, and that is ONE-POINT, not a defective two-point.',
    'SECOND RECESSION only if it is really there — a second edge family running to its own point on the horizon (a corner-on building). Then `camera.form:"two-point"` + `camera.vanishingPoints.left/right`. Two-point is a DRAWING construction; it is optional here and strictly downstream of the depth mapping.',
    'NEAR EDGE: the closest ground you can see, as `roomBasis.frontLeft` (and `frontRight` if readable). Every depth is measured from this row.',
    'FAR ROW — where your read STOPS (`roomBasis.farRow`). The horizon is infinitely far, so a photograph never shows the whole plane; the last row whose ground you can honestly read is a DECLARATION. It sets every band width, so guessing it silently is how a read goes confidently wrong.',
    'AREA, NOT COUNT: depth goes as 1/(row - horizon), so equal pixel bands are wildly unequal ground. The band beside the vanishing point can hold more street than the entire foreground. Set `roomBasis.bands` and read the cage\'s rulings BEFORE you count anything into the distance.',
    'SCALE: relative by default and that is usually enough. Ground it only from something in the frame or named by the operator — `roomBasis.scaleAnchor: { kind:"width", pixels, world }` (a known across-frame width) or `{ kind:"depth", world }`. Never from a remembered typical value for the object class.',
  ],
  dial_schema: {
    'camera.form': "'one-point' (DEFAULT for a photograph — one recession direction) | 'two-point' (a second edge family really is present).",
    'camera.vanishingPoint': '[x, y] — the PRINCIPAL recession point, on the horizon. The one-point dial.',
    'camera.vanishingPoints.left/right': '[x, y] screen pixels on the horizon (may be off-frame). Two-point only.',
    'camera.horizonY': 'number — horizon line Y in pixels.',
    'roomBasis.farRow': 'number — the last image row whose ground you can honestly read. Required for the depth bands; never defaulted.',
    'roomBasis.bands': 'number — how many EQUAL-AREA depth bands to rule onto the cage (default 5).',
    'roomBasis.scaleAnchor': '{ kind:"width", pixels, world } | { kind:"depth", world } — optional grounding. Absent = relative, and honest.',
    'camera.verticalAxis': '[x, y] unit vector, default [0, -1] (up).',
    'roomBasis.frontLeft / frontRight': '[x, y] near floor corners in pixels.',
    'roomBasis.depthReach': '0.08–0.88, vanishing-point influence falloff (default 0.46).',
    'roomBasis.verticalUnit': 'px per world-height unit (default 26).',
    'roomBasis.xRange / yRange': 'world-space [min,max] extents (defaults [-18,18] / [-28,8]).',
    'roomBasis.worldExtent': 'OPTIONAL { width, depth, height } in real units — only if the operator grounds a dimension.',
    'viewBox': 'OPTIONAL { width, height } — the pixel space your coordinates are measured in (used to draw the cage).',
  },
  fidelity_contract: {
    thematic:
      'DEFAULT. Recover rough horizon + VP spread + relative depth; let palette/structure/walls come from substrate vocabulary. Loose knobs, generative fill.',
    faithful:
      'Measure the ACTUAL VP pixel positions and floor convergence and pin them. Then re-render the cage, Read it back, and check the convergence lines land where the photo\'s do; nudge depthReach/VP and repeat.',
  },
  ceiling: [
    'AFFINE — no lens intrinsics, no focal length. Wide-angle / fisheye barrel curvature is FLATTENED (straight lines that bow in the photo go straight). A stepped-back long-lens shot reads well; a close-up phone wide-angle is the worst case.',
    'VPs sit ON the horizon (eye-level) — no bird\'s-eye / worm\'s-eye in the recipe path. A tilted camera puts the verticals\' own vanishing point off the horizon and this model does not represent it.',
    'The GROUND PLANE is assumed flat and level. A hill, a camber, or a stepped street breaks the 1/(row-horizon) depth mapping and every area derived from it.',
    'DEPTH BANDS assume a constant-width corridor. A widening plaza or a fork needs its width read per band, not once.',
    'OCCLUSION is worse here than for an object: in a canyon you see FAÇADES, not footprints. Ground behind the first row of buildings is invisible, so far-band budgets are INFERRED, not read — say which bands you actually saw.',
    'Scale is RELATIVE unless something in the frame or the operator grounds it; a single photo cannot recover absolute metres.',
  ],
  multipass_hint:
    'Single photo = affine cage with relative-scale guesses. A SECOND viewpoint of the same scene lets you triangulate true depth/scale — call capture_reference again with the same stash_ref to refine. Sanity check: render the cage from a different angle; if it looks wrong, the depth was guessed wrong → ask for another photo.',
  capture_call:
    "capture_reference({ target:'scene', fidelity, insights:{ camera:{ form?, vanishingPoint | vanishingPoints, horizonY }, roomBasis:{ frontLeft, frontRight?, farRow, bands?, scaleAnchor?, verticalUnit? }, viewBox?, scale, thematic, caveats }, stash_ref? })",
};

const POSE_PROTOCOL = {
  target: 'pose',
  summary:
    "Read a human photo's GESTURE by TRACING its X-manji — the figure's stick-skeleton (head, central axis, shoulder bar, hip bar, the anatomical X, and the limb lines). You place 2D landmark points; you do NOT guess joint angles. capture_reference SOLVES the pose dials from your X-manji against the locked armature (fixed bone lengths + clamped limits), so a clean trace beats hand-tuned degrees.",
  key_lines: [
    'TRACE these landmarks as 2D points, one per joint: headTop, neckHub, navel, pelvisHub; shoulderL/R, elbowL/R, wristL/R; hipL/R, kneeL/R, ankleL/R. (Place as many as the photo shows; more landmarks = a tighter solve.)',
    "COORDINATES are ANATOMICAL and un-mirrored: x = the figure's RIGHT side is +x (so a front-facing subject's image-left maps to +x), y = UP. Units are arbitrary — the solver normalizes scale + position; only the GESTURE matters.",
    'The X: the shoulder bar (shoulderL↔shoulderR) and hip bar (hipL↔hipR) tilting OPPOSITE each other is contrapposto / line-of-action — trace those tilts faithfully, they carry the spine drives.',
    "VIEW: report the azimuth you traced at — `xmanji.view` as a number (0 = front, 90 = profile/side, 38 = three-quarter). The solver freezes the DOFs unobservable at that view (see ceiling).",
  ],
  input_schema: {
    'insights.xmanji.landmarks': '{ <nodeKey>: { x, y } } — your traced 2D points (anatomical coords, y up). Keys from the list above.',
    'insights.xmanji.view': 'number — azimuth (deg) you traced at. Default 0 (front).',
    'insights.proto': 'OPTIONAL { sex, height, … } — the pose is body-AGNOSTIC (locked armature; only flesh changes). Apply any body.',
    '(advanced) insights.dials': 'OPTIONAL escape hatch — supply joint dials directly instead of an X-manji, if you already have them. Prefer the X-manji.',
  },
  fidelity_contract: {
    gesture:
      'DEFAULT. Trace the bars + limb lines roughly — the attitude (reach, contrapposto, slump). The solver + the L2 prior fill in the smallest pose that fits.',
    faithful:
      'Place every landmark carefully and trace a SECOND view (front + side) so the solver can unfreeze the depth DOFs. Then render the cage, Read it, and re-trace where it disagrees.',
  },
  ceiling: [
    'SINGLE-VIEW DEPTH is under-determined: at a frontal trace the forward/back bend (spine.sagittal), head nod, and any limb folding TOWARD the camera (a forearm/knee bending forward) live in the invisible axis — the solver FREEZES them at neutral rather than inventing them. A second (side) view unlocks them.',
    'Limb ROLL (axial twist) is not solved from one view; it defaults.',
    'The X-manji trace captures LIMB GESTURE only — there are no hand/finger/foot/ankle landmarks in a stick skeleton, so this solve never recovers hand expression, wrist flex, finger curl, ankle/toe, axial roll, or the pelvis/shoulder-girdle transverse rotation (degenerate with the spine twist at one view). Those DOFs DO exist on the figure primitive (create_figure pose: wristL/R {flex,deviation}, fingersL/R, ankleL/R, toeL/R, hipL/R.roll, pelvis, shoulders) — set them directly on the solved dials when the pose needs them; the trace just won’t infer them for you.',
  ],
  multipass_hint:
    'A FRONT X-manji nails the in-plane gesture; a SIDE X-manji disambiguates the depth/fold it could not see. Trace a second view and call capture_reference again with the same stash_ref to ground the pose. capture_reference returns the solve error + which DOFs it froze — if the froze list holds the articulation you care about, that is your cue to add the side view.',
  capture_call:
    "capture_reference({ target:'pose', fidelity, insights:{ xmanji:{ landmarks:{ shoulderR:{x,y}, ... }, view }, proto?, gesture?, caveats? }, stash_ref? })",
};

// --- landscape vocabulary catalogues (built live from the glyph registries) ---
// The painted-landscape cards are the single source of truth; mirroring them into
// the protocol means a new heartbeat/splatch/scene card shows up here for free.
function heartbeatLines() {
  return Object.entries(HEARTBEATS).map(
    ([id, r]) => `    • ${id} [${r.engine || 'sine-stack'}] — ${r.intent}`,
  );
}
function splatchLines() {
  return Object.entries(SPLATCHES).map(([id, s]) => `    • ${id} — ${s.intent} (seeds: ${s.seeds.join(', ')})`);
}
function sceneLines() {
  return Object.entries(SCENES).map(([id, s]) => `    • ${id} — ${s.intent}`);
}
function structureLines() {
  return Object.entries(STRUCTURE_GLYPHS).map(([id, g]) => `    • ${id} — ${g.intent}`);
}
function cameraLines() {
  return Object.entries(CAMERAS).map(([id, c]) => `    • ${id} — ${c.intent}`);
}
function skyLines() {
  return Object.entries(SKIES).map(([id, s]) => `    • ${id} — ${s.intent}`);
}

const LANDSCAPE_PROTOCOL = {
  target: 'landscape',
  summary:
    "Read a landscape photo's GESTURE — its dominant landform motion, depth, and palette — and estimate the closed-vocabulary RECIPE (the \"mandala map\") that recreates it: a painted-landscape glyph pick. Use SCALE and POSITIONING to infer the main gesture (the terrain rhythm + camera), inventory the elements (biome fill, structures, sky), and quantize the colour to a named palette. The substrate then RENDERS your map — the cage you get back is a candidate recreation, not just a diagram. Throw away the pixels; keep the recipe.",
  key_lines: [
    'GESTURE (the main move): read the dominant landform RHYTHM. Are the ridges/swells PERIODIC — regular repeating crests, terraced steps, ocean swell (→ a [sine-stack] heartbeat) — or IRREGULAR/fractal — bumpy, natural, scales-with-distance terrain (→ an [fbm] heartbeat)? Then read its AMPLITUDE (gentle rolling vs steep). Pick the ONE heartbeat whose engine + intent matches. This is the gesture.',
    'POSITIONING / CAMERA: find the HORIZON band (eye-level). A HIGH horizon means you look DOWN on the land (survey / top-down camera); a LOW horizon means you look UP (hero / low-angle). Read how fast elements shrink with distance (foreshortening). Pick the `camera` glyph that frames it; omit to use the default survey projection.',
    'PALETTE: sample the THREE dominant colours — deepest shadow, mid-ground body, brightest highlight. Pick the `splatch` whose seed colours / intent sit nearest. The palette is DERIVED (a 4-stop ramp from 3 seeds), so match the MOOD, not the exact hex; use `paletteOverrides` only to pin a stubborn hue.',
    'ELEMENTS (the inventory): what populates the land? Foliage / trees → a `scene` biome (cones, canopies, boulders, tufts in near/mid/far) or the `forest` layer for a treed slope. Built things — ruins, monuments, a village → a `structures` glyph. Bare water / dunes / fields read straight from heartbeat + splatch, so leave elements off.',
    'SKY & LIGHT: time of day from sky colour + shadow direction sets `light: { x, y, z }` (a NEGATIVE z is night). Cloud cover, a visible sun, stars/moon → a named `sky` preset (or `sky: { clouds, sun, ... }`). The sky derivation rides the same light vector, so one `light.z` spans midday → dusk → night.',
    'BUILT STRUCTURES (optional, beyond nature): the land may carry built form, read as MASSING + SPANS, not facades. (a) A BRIDGE / causeway / viaduct → `bridges: [{ from:[x,y], to:[x,y], archHeight?, pierEvery?, clearance? }]`; endpoints are WORLD coords (x −12→12 left→right, y −24→6 far→near), the deck arches between them on regularly-spaced piers, palette-harmonized. (b) A BUILT-UP shore / town / city → `city: true` + `cityDensity` 0–1 (how much buildable ground fills with massed buildings that inherit the terrain slope). (c) A BAY / lake / water INLET → switch from `heartbeat` to an `elevation` block `{ fields, field, waterLevel }`: compose a height field that DIPS below `waterLevel` in the inlet, and the substrate floods it with a depth-tinted water sheet.',
  ],
  dial_schema: {
    heartbeat: 'REQUIRED — named geometry recipe (the gesture). One id from the heartbeats catalogue.',
    splatch: 'REQUIRED — named palette (3 seeds → 4-stop ramp). One id from the splatches catalogue.',
    scene: 'OPTIONAL — biome fill id (forest/coast/alpine/meadow…). The way nature reads as a place.',
    structures: 'OPTIONAL — architectural scatter id (ruins / monuments / village). Omit for pure nature.',
    forest: 'OPTIONAL — generative tree layer: true, a density 0–1, or { density, treeline, size }.',
    sky: 'OPTIONAL — a sky-card id, false (flat), or { hazeStrength, clouds, sun, stars, moon }.',
    camera: 'OPTIONAL — camera-glyph id locking the projection (wide / hero / overhead). Omit for default survey.',
    light: 'OPTIONAL — { x, y, z } light direction; z drives the day→night arc (negative = night).',
    bridges: 'OPTIONAL — span structures: [{ from:[x,y], to:[x,y], archHeight?, deckWidth?, clearance?, pierEvery? }]. Arched deck on piers. Renders in the WORLD/3D view, NOT the flat SVG cage.',
    city: 'OPTIONAL — true to mass buildings on buildable ground (they ride the terrain slope). WORLD/3D view only.',
    cityDensity: 'OPTIONAL — 0–1, how densely city massing fills buildable ground (default 0.6).',
    farmland: 'OPTIONAL — true to texture dry land as cultivated fields. WORLD/3D view only.',
    elevation: 'OPTIONAL (advanced) — replace `heartbeat` with a composed height field { fields, field, waterLevel } for BAYS / lakes / inlets; water floods below waterLevel. Renders in SVG + World. Field decls are { kind: constant|radial|gradient, … } over {x,y,z} points; `field` names the one that drives terrain.',
    renderStyle: "OPTIONAL — 'painterly' (default) | 'topographic' | 'wireframe'.",
    seed: 'OPTIONAL — any non-empty string for within-recipe variation (element + wave placement).',
    gesture: 'OPTIONAL — a short prose note on the main gesture you read (stored in the caption).',
    caveats: 'OPTIONAL — string[] of what the recipe cannot capture from this photo.',
  },
  vocabulary: {
    heartbeats: heartbeatLines(),
    splatches: splatchLines(),
    scenes: sceneLines(),
    structures: structureLines(),
    cameras: cameraLines(),
    skies: skyLines(),
  },
  fidelity_contract: {
    thematic:
      'DEFAULT. Match the GESTURE + mood + biome; let the seed place exact ridges and elements. Name a heartbeat + splatch (+ a scene if it should read as a place) and stop.',
    faithful:
      'Tune element counts via the scene affinity / forest density, pin the camera + light, add paletteOverrides for a stubborn hue — then render the cage, Read it back, and nudge the picks until the gesture + palette land.',
  },
  ceiling: [
    'CLOSED VOCABULARY: this recreates the GESTURE + biome + palette + light, NOT the pixels. It cannot reproduce a specific real place, a particular building, photographic texture, or any object outside the glyph cards. If the photo\'s subject is a named landmark, you get its FAMILY, not its identity.',
    'Palette is a DERIVED 4-stop ramp from 3 seed colours — exact hues approximate; reach for paletteOverrides only when a hue must be pinned.',
    'Element POSITIONS are SEEDED, not traced — you choose the biome + counts + bands, the substrate places them. Re-seed for a different arrangement; you cannot place an individual tree.',
    'Affine two-point camera (same ceiling as `scene`): no lens curvature, VPs on the horizon, no true bird\'s-eye in the recipe path.',
    'BUILT FORM IS COARSE: bridges are arched-deck-on-piers only (no truss / cable-stayed / suspension); `city` is MASSING that rides the terrain, not facades / setbacks / a named skyline. For a faithful skyline or a landmark span, mint create_fractal_city / create_transportation_hub as a SEPARATE sketch — but those carry NO terrain underneath; the substrate has no path compositing a real city onto painted terrain in one image.',
    'WHERE BUILT FORM RENDERS: bridges, `city` massing, and `farmland` appear in the WORLD / 3D view of the cage (open it from cage_url), NOT in the flat SVG. Bays (`elevation` + `waterLevel`) render in BOTH. The flat SVG cage shows terrain + palette + scene biome + the box/obelisk `structures` glyphs.',
    'REPLAY CAVEAT: create_painted_landscape CANNOT author bridges / city / elevation (its tool schema stops at the glyph families). Those live only in the stored insights — re-mint from the stash insights, not by re-typing a create_painted_landscape call.',
  ],
  multipass_hint:
    'One wide photo nails the gesture + palette + camera. A DETAIL CROP (or a second framing) refines what the wide shot quantized coarsely — element density, structure type, a stubborn hue. Call capture_reference again with the same stash_ref to layer the refinement. After each pass, Read the cage_url and compare it to the photo: the gesture is right when the silhouette + depth + mood match, even though no pixel does.',
  capture_call:
    "capture_reference({ target:'landscape', fidelity, insights:{ heartbeat, splatch, scene?, structures?, forest?, sky?, camera?, light?, bridges?, city?, cityDensity?, elevation?, renderStyle?, seed?, gesture?, caveats? }, stash_ref? })",
};

const PROTOCOLS = { scene: SCENE_PROTOCOL, pose: POSE_PROTOCOL, landscape: LANDSCAPE_PROTOCOL, object: OBJECT_PROTOCOL };

export function getReferenceProtocol(target) {
  const proto = PROTOCOLS[target];
  if (!proto) {
    throw new Error(`target must be one of ${REFERENCE_TARGETS.join(' | ')} (got '${target}')`);
  }
  return proto;
}

// ---------------------------------------------------------------------------
// Lowering — insights → a cage manifest. Pure functions, no DB.
// ---------------------------------------------------------------------------

function isPair(v) {
  return Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]);
}
function num(v, d) {
  return Number.isFinite(v) ? v : d;
}
const isNum = (v) => Number.isFinite(v);

/**
 * SCENE cage → a plain sketch (default renderer) that draws the perspective
 * frame: horizon, the near floor edge, the two receding edges converging on the
 * vanishing points, and VP markers. Every input (VPs, horizon, floor corners)
 * is already in screen pixels, so the cage is a faithful diagram of the
 * extracted camera. The viewBox is sized to CONTAIN the (usually off-frame)
 * vanishing points so the convergence is visible. Returns a manifest with NO
 * `kind` so /api/sketches/<ref>/svg routes it to the default renderer.
 */
export function lowerSceneCage(insights = {}, title = 'Scene reference') {
  const cam = insights.camera || {};
  const rb = insights.roomBasis || {};
  const vp = cam.vanishingPoints || {};
  const vpOne = isPair(cam.vanishingPoint) ? cam.vanishingPoint : null;
  const vpL = isPair(vp.left) ? vp.left : null;
  const vpR = isPair(vp.right) ? vp.right : null;
  const horizonY = num(cam.horizonY, vpOne ? vpOne[1] : vpL ? vpL[1] : vpR ? vpR[1] : 245);
  // ONE-POINT is the photographic default (see scene-camera.js): the camera axis
  // runs down the street, both façade rows converge on a single point, and there
  // is no second edge family to find. The old lowering had no such case — it
  // mirrored `frontRight` about the midpoint of two VPs, which is undefined when
  // they coincide, so the most common architectural photograph fell through to a
  // 600px guess.
  const onePoint = !!vpOne || cam.form === 'one-point' || (!vpL || !vpR);

  const frontLeft = isPair(rb.frontLeft) ? rb.frontLeft : [210, 510];
  let frontRight;
  if (isPair(rb.frontRight)) {
    frontRight = rb.frontRight;
  } else if (onePoint && vpOne) {
    // Mirror about the VP's own column — for a frontal view the recession point
    // IS the station point, so this is the honest one-point equivalent.
    frontRight = [2 * vpOne[0] - frontLeft[0], frontLeft[1]];
  } else if (vpL && vpR) {
    // mirror frontLeft about the station point (midway between the two VPs)
    const midX = (vpL[0] + vpR[0]) / 2;
    frontRight = [2 * midX - frontLeft[0], frontLeft[1]];
  } else {
    frontRight = [frontLeft[0] + 600, frontLeft[1]];
  }

  // viewBox bbox over every reference point (+ y=0 so the horizon band reads).
  const pts = [frontLeft, frontRight, [0, horizonY]];
  if (vpOne) pts.push(vpOne);
  if (vpL) pts.push(vpL);
  if (vpR) pts.push(vpR);
  const pad = 48;
  const minX = Math.min(...pts.map((p) => p[0])) - pad;
  const maxX = Math.max(...pts.map((p) => p[0])) + pad;
  const minY = Math.min(0, ...pts.map((p) => p[1])) - pad;
  const maxY = Math.max(frontLeft[1], frontRight[1], ...pts.map((p) => p[1])) + pad;
  const ox = -minX;
  const oy = -minY;
  const T = (p) => [p[0] + ox, p[1] + oy];
  const width = Math.max(1, Math.round(maxX - minX));
  const height = Math.max(1, Math.round(maxY - minY));

  const marks = [];
  // horizon (eye-level)
  const hL = T([minX, horizonY]);
  const hR = T([maxX, horizonY]);
  marks.push({ kind: 'line', x1: hL[0], y1: hL[1], x2: hR[0], y2: hR[1], stroke: '#9aa5b1', strokeWidth: 1.5 });
  marks.push({ kind: 'text', x: hL[0] + 8, y: hL[1] - 8, value: 'horizon', size: 12, anchor: 'start' });
  // near floor edge
  const fL = T(frontLeft);
  const fR = T(frontRight);
  marks.push({ kind: 'line', x1: fL[0], y1: fL[1], x2: fR[0], y2: fR[1], stroke: '#2c3e50', strokeWidth: 2 });
  // receding edges + VP markers
  if (vpL) {
    const v = T(vpL);
    marks.push({ kind: 'line', x1: fL[0], y1: fL[1], x2: v[0], y2: v[1], stroke: '#e67e22', strokeWidth: 1.5 });
    marks.push({ kind: 'circle', cx: v[0], cy: v[1], r: 6, fill: '#e74c3c' });
    marks.push({ kind: 'text', x: v[0] + 10, y: v[1], value: 'VP-L', size: 14, anchor: 'start' });
  }
  if (vpR) {
    const v = T(vpR);
    marks.push({ kind: 'line', x1: fR[0], y1: fR[1], x2: v[0], y2: v[1], stroke: '#e67e22', strokeWidth: 1.5 });
    marks.push({ kind: 'circle', cx: v[0], cy: v[1], r: 6, fill: '#e74c3c' });
    marks.push({ kind: 'text', x: v[0] - 10, y: v[1], value: 'VP-R', size: 14, anchor: 'end' });
  }
  // ONE-POINT: both edges of the corridor run to the single recession point, and
  // the cage carries the DEPTH RULINGS — equal-AREA bands drawn at their true
  // image rows. Their wild unevenness is the whole point of the drawing: it shows
  // the reader, before they count anything, that the sliver by the vanishing
  // point is worth as much ground as the whole foreground.
  if (vpOne) {
    const v = T(vpOne);
    marks.push({ kind: 'line', x1: fL[0], y1: fL[1], x2: v[0], y2: v[1], stroke: '#e67e22', strokeWidth: 1.5 });
    marks.push({ kind: 'line', x1: fR[0], y1: fR[1], x2: v[0], y2: v[1], stroke: '#e67e22', strokeWidth: 1.5 });
    marks.push({ kind: 'circle', cx: v[0], cy: v[1], r: 7, fill: '#e74c3c' });
    marks.push({ kind: 'text', x: v[0] + 12, y: v[1] - 6, value: 'VP', size: 14, anchor: 'start' });

    if (isNum(rb.farRow)) {
      let bands = [];
      try {
        const scam = resolveSceneCamera(insights);
        bands = equalAreaBands(scam, { count: num(rb.bands, 5), farRow: rb.farRow });
      } catch { bands = []; }
      for (const b of bands) {
        // the corridor narrows toward the VP, so each ruling spans the two rays
        const t = (b.rowTo - frontLeft[1]) / ((vpOne[1] - frontLeft[1]) || 1);
        const lx = frontLeft[0] + (vpOne[0] - frontLeft[0]) * t;
        const rx = frontRight[0] + (vpOne[0] - frontRight[0]) * t;
        const a = T([lx, b.rowTo]); const c = T([rx, b.rowTo]);
        marks.push({ kind: 'line', x1: a[0], y1: a[1], x2: c[0], y2: c[1], stroke: '#2980b9', strokeWidth: 1.2, dash: '4 3' });
        marks.push({
          kind: 'text', x: c[0] + 8, y: c[1] + 4, size: 11, anchor: 'start',
          value: `d ${b.depthTo} · ${Math.round(b.areaShare * 100)}% area in ${Math.round(b.pixelShare * 100)}% px`,
        });
      }
      const ratio = foreshorteningRatio(bands);
      if (ratio) {
        marks.push({
          kind: 'text', x: T([frontLeft[0], frontLeft[1]])[0], y: T([0, horizonY])[1] - 14, size: 13, anchor: 'start',
          value: `one-point · far band holds ${ratio}x the ground per pixel of the near band`,
        });
      }
    }
  }

  const manifest = { title, viewBox: { width, height }, marks };
  const errors = validateSketchManifest(manifest);
  if (errors.length) {
    throw new Error(`scene cage manifest invalid:\n - ${errors.join('\n - ')}`);
  }
  return manifest;
}

/**
 * POSE cage → a figure manifest (kind: 'figure'). The extracted dials ARE the
 * pose object; view/proto ride alongside. Reuses the proven figure render path,
 * so the joint LIMITS + spine caps clamp any over-driven dial. The caller
 * validates by rendering (a bad dial fails at mint, not at view time).
 */
export function lowerPoseCage(insights = {}, title = 'Pose reference') {
  const { dials } = resolvePoseDials(insights);
  const manifest = { kind: 'figure', title, pose: dials };
  const renderView = insights.view ?? insights.xmanji?.view;
  if (renderView !== undefined && renderView !== null) manifest.view = renderView;
  if (insights.proto && typeof insights.proto === 'object' && !Array.isArray(insights.proto)) {
    manifest.proto = insights.proto;
  }
  return manifest;
}

/**
 * LANDSCAPE cage → a painted-landscape manifest (kind: 'painted-landscape'). The
 * extracted glyph map IS the manifest: heartbeat + splatch (required) plus any of
 * the optional layers (scene / structures / forest / sky / camera / light / seed /
 * renderStyle / *Overrides) pass straight through. The substrate RENDERS it, so the
 * cage is a candidate recreation, not a diagram. Validates against the same closed
 * vocabulary as create_painted_landscape — a bad glyph fails at mint, not at view.
 */
export function lowerLandscapeCage(insights = {}, title = 'Landscape reference') {
  // `elevation` is validated by validatePaintedLandscape; the built-form fields
  // (bridges / city / cityDensity / farmland) are consumed by the World mesh and
  // NOT covered by that validator, so we shape-check them here — a bad span fails
  // at capture time, not lazily at World-view time.
  const PASSTHROUGH = [
    'heartbeat', 'splatch', 'structures', 'scene', 'forest', 'sky', 'camera',
    'light', 'seed', 'renderStyle', 'paletteOverrides', 'heartbeatOverrides',
    'bridges', 'city', 'cityDensity', 'farmland', 'elevation',
  ];
  const manifest = { kind: 'painted-landscape', title };
  for (const key of PASSTHROUGH) {
    if (insights[key] !== undefined && insights[key] !== null) manifest[key] = insights[key];
  }
  const errors = validatePaintedLandscape(manifest);
  errors.push(...validateLandscapeBuiltForm(manifest));
  if (errors.length) {
    throw new Error(`landscape cage manifest invalid (check your glyph picks):\n - ${errors.join('\n - ')}`);
  }
  return manifest;
}

// Shape-check the built-form fields the painted-landscape validator leaves alone.
function validateLandscapeBuiltForm(manifest) {
  const errors = [];
  const isPt = (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  if (manifest.bridges !== undefined) {
    if (!Array.isArray(manifest.bridges)) {
      errors.push('bridges must be an array of { from:[x,y], to:[x,y], … } spans');
    } else {
      manifest.bridges.forEach((br, i) => {
        if (!br || typeof br !== 'object' || !isPt(br.from) || !isPt(br.to)) {
          errors.push(`bridges[${i}]: requires { from:[x,y], to:[x,y] } world endpoints`);
        }
      });
    }
  }
  if (manifest.city !== undefined && typeof manifest.city !== 'boolean') {
    errors.push('city must be a boolean (true to mass buildings on buildable ground)');
  }
  if (manifest.cityDensity !== undefined
    && (typeof manifest.cityDensity !== 'number' || !Number.isFinite(manifest.cityDensity) || manifest.cityDensity < 0)) {
    errors.push('cityDensity must be a number >= 0 (0–1) when provided');
  }
  if (manifest.farmland !== undefined && typeof manifest.farmland !== 'boolean') {
    errors.push('farmland must be a boolean when provided');
  }
  return errors;
}

/**
 * A short human-readable caption for the cage stash item's body_md.
 */
export function summarizeReference(target, insights = {}, fidelity, passes) {
  const lines = [`**Visual reference** — target \`${target}\`, fidelity \`${fidelity}\`, pass ${passes}.`];
  if (target === 'pose') {
    if (insights.gesture) lines.push(`Gesture: ${insights.gesture}`);
    if (insights.confidence) {
      const c = insights.confidence;
      lines.push(`Confidence: in-plane ${c.inPlane ?? '?'} · depth ${c.depth ?? '?'} · roll ${c.roll ?? '?'}`);
    }
  } else if (target === 'scene') {
    if (insights.scale?.relative) lines.push(`Scale: ${insights.scale.relative}${insights.scale.grounded ? ' (grounded)' : ' (relative)'}`);
    if (insights.thematic?.mood) lines.push(`Mood: ${insights.thematic.mood}`);
  } else if (target === 'object') {
    const extra = summarizeObject(insights, insights.__ledger || null);
    if (extra) lines.push(extra);
  } else if (target === 'landscape') {
    const map = [
      insights.heartbeat ? `heartbeat \`${insights.heartbeat}\`` : null,
      insights.splatch ? `splatch \`${insights.splatch}\`` : null,
      insights.scene ? `scene \`${insights.scene}\`` : null,
      insights.structures ? `structures \`${insights.structures}\`` : null,
      insights.camera ? `camera \`${insights.camera}\`` : null,
      insights.sky && typeof insights.sky === 'string' ? `sky \`${insights.sky}\`` : null,
    ].filter(Boolean);
    if (map.length) lines.push(`Map: ${map.join(' · ')}`);
    if (insights.gesture) lines.push(`Gesture: ${insights.gesture}`);
  }
  const caveats = Array.isArray(insights.caveats) ? insights.caveats : [];
  if (caveats.length) lines.push(`Caveats: ${caveats.join('; ')}`);
  return lines.join('\n\n');
}

export { lowerObjectCage, fuseObjectInsights, summarizeObject };
export { resolveSceneCamera, depthAtRow, rowAtDepth, equalAreaBands, foreshorteningRatio };
