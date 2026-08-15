/**
 * figure-render — render the posed protoform figure to a self-contained SVG (and
 * frames for a motion GIF). This is the reusable renderer the MCP `create_figure`
 * tool and the studies share: it composes the whole figure stack as pure
 * functions and meshes the result with vexar lighting.
 *
 *   pose (dof)   ──articulate + groundBalance──▶ posed, balanced nodes
 *   proto        ──buildProtoform──▶ body stacks (trunk straight, legs ground-IK)
 *   off-rest     ──warpStacks onto the balanced spine──▶ trunk deformed, arms
 *                  rigid on the girdle, legs passed through → one welded figure
 *   garment      ──buildGarment──▶ clothed
 *                 ──mesh + Lambert shade + paint──▶ SVG
 *
 * The figure is a pure function of (pose, proto, garment) — nothing is baked, so
 * a render is just "choose the dials". See
 * lite-template/integration/0610/figure-spine-articulation.plan.md and
 * figure-proto-params.plan.md.
 */
import { articulate, basePositions } from './figure-vajra.js';
import { projectTwoPoint } from './pure-mandala.js';
import { makeLight, shadeHex, litFactor, dot3, sub3, centroid } from './vexar.js';
import { PROTO_DEFAULT, buildProtoform } from './figure-proto.js';
import { buildFluffs } from './figure-fluff.js';
import { weldFluffs } from './figure-weld.js';
import { spineDeformerFromNodes, warpStacks, spineArmAnchors } from './figure-spine.js';
import { groundBalance, groundVault } from './figure-balance.js';
import { gait, WALK_DEFAULTS, resolveMotion } from './figure-posing.js';
import { emoteMotion, isEmoteSpec } from './figure-emotes.js';
import { buildGarment, GARMENTS, resolveCuts, cutPredicate, cutHits, cutBoundary } from './figure-garments.js';
import { buildWig, WIGS } from './wig.js';
import { resolveFigureSetup } from '../../visual-language/themes.js';
import { buildAnimal } from './figure-animal-build.js';
// engine→mobile-suit seam (mobile-suit-pack.plan.md): the shield prop rides the ms-shield shelf
// LAZILY and CONTAINED — with that module absent or broken, figures render shieldless instead of
// the whole figure pipeline failing at import time.
let resolveMsShieldRecipe = null;
try { ({ resolveMsShieldRecipe } = await import('../mobile-suit/ms-shield.js')); } catch (err) { console.error('ms-shield shelf unavailable — figures render shieldless:', err?.message); }
import { extrudeToFaces } from './extrude-faces.js';
import { sweepToFaces } from './sweep-faces.js';

const FLESH_HEX = '#c8836a';
const PROTO_SCALE = 12;                 // buildProtoform world scale (STAND × 12)
const S = 1.95;                         // STAND → render world
const LIGHT = makeLight({ direction: [0.42, -0.5, -0.76], ambient: 0.40, diffuse: 0.76 });

export const FIGURE_VIEWS = ['frontal', 'three-quarter', 'lateral', 'left', 'back'];
const VIEW_AZ = { frontal: 0, 'three-quarter': 38, lateral: 90, left: -90, back: 180 };

// a manifest `garment` may be one spec key or an array (layering: shirt + jacket …)
const garmentList = (g) => (g == null ? [] : Array.isArray(g) ? g : [g]);
const SEAM_HEX = '#1f2127';                                  // the red-line (cloth-edge) seam color
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// The legs+feet carry ground IK (re-bent knee, planted ankle) the spine warp's
// height field can't reproduce, so they are built on the BALANCED armature nodes
// and their stacks pass the warp through untouched. Everything else — including
// the pelvis girdle (diaper/glute/pelvis) — is built in the rest frame and WARPED
// onto the balanced spine, so the whole trunk+girdle rides the balanced pelvis as
// one piece instead of the diaper floating off the front.
const GROUNDED_NODES = ['hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
const GROUNDED_STACKS = new Set(['legL', 'legR', 'footL', 'footR', 'hipCapL', 'hipCapR']);

// Volume-preserving squash & stretch (the weight principle): scale the figure
// vertically by `s` about the feet (ground contact) and horizontally by 1/√s about
// the central axis, so volume holds (s·(1/√s)² = 1). s<1 = squash (pancake on
// impact / a gather), s>1 = stretch (a launch). Pure deform over the ring-stacks,
// like the spine warp.
function squashStretch(stacks, s) {
  let footZ = Infinity;
  for (const st of stacks) for (const rg of st.rings) for (const q of rg.polyline) if (q.z < footZ) footZ = q.z;
  const h = 1 / Math.sqrt(s);
  const f = (q) => ({ x: q.x * h, y: q.y * h, z: footZ + (q.z - footZ) * s });
  return stacks.map((st) => ({ ...st, rings: st.rings.map((rg) => ({ center: f(rg.center), polyline: rg.polyline.map(f) })) }));
}

// CHIBI RIG — remap the armature to few-heads-tall proportions BEFORE the flesh
// binds, so the vajra rig is kept purely as the skeleton (joints/animation) while
// the read becomes a stylized mascot. It shrinks every body landmark's offset from
// an anchor (the neck) — `body` scales the vertical drop (short torso + stubby
// limbs), `lateral` the sideways spread (narrower shoulders/hips) — and leaves the
// head/neck untouched so the head stays full-size over a shrunken body (the big-head
// cue). `headLift` nudges the head up to clear the shoulders. Coordinate-agnostic:
// pure offset scaling about `anchor`. Pairs with a `fluffs` body; the fluff shape
// girths are absolute, so the body stays chunky while the skeleton compresses.
const CHIBI_KEEP = new Set(['headTop', 'headBase', 'neckHub']);
function chibiRig(pos, opts = {}) {
  const { body = 0.5, lateral = 0.82, anchor = 'neckHub', headLift = 0 } = (opts === true ? {} : opts);
  const a = pos[anchor];
  if (!a) return pos;
  const out = {};
  for (const [k, p] of Object.entries(pos)) {
    if (CHIBI_KEEP.has(k)) { out[k] = headLift ? { x: p.x, y: p.y, z: p.z + headLift } : { ...p }; continue; }
    out[k] = { x: a.x + (p.x - a.x) * lateral, y: a.y + (p.y - a.y) * lateral, z: a.z + (p.z - a.z) * body };
  }
  return out;
}

// Rigid vertical translation of the whole figure (root lift, in PROTO_SCALE units).
function liftStacks(stacks, dz) {
  const f = (q) => ({ x: q.x, y: q.y, z: q.z + dz });
  return stacks.map((st) => ({ ...st, rings: st.rings.map((rg) => ({ center: f(rg.center), polyline: rg.polyline.map(f) })) }));
}

// The figure is off-rest (worth warping) if the spine is bent, the pelvis is
// HINGED, OR balance shifted any node off its FK position. (The hinge lives in both
// `full` and `balanced`, so the balance-delta check below can't see it on its own.)
// Neutral standing → all equal → no warp → canonical.
function offRest(spine, hinge, full, balanced) {
  if (spine && (spine.sagittal || spine.lateral || spine.axial)) return true;
  if (hinge) return true;
  for (const k in balanced) {
    const a = balanced[k], b = full[k];
    if (Math.abs(a.x - b.x) > 1e-6 || Math.abs(a.y - b.y) > 1e-6 || Math.abs(a.z - b.z) > 1e-6) return true;
  }
  return false;
}

/**
 * The posed, ground-solved armature nodes (pure) — the same balance solve
 * buildPosedFigure runs before fleshing. Plant the support foot/feet and shift
 * the COM over them (weighted stance). support 'none' = AIRBORNE: skip the
 * ground solve entirely (pure FK), so both feet can leave the ground for a
 * hop/jump — pair with `lift`. `crouch` drops the pelvis (a squat); `kneeOut`
 * tracks the knees out/in. `plant` (per-foot ground weights) → the
 * inverted-pendulum vault (feet pinned, pelvis height derived).
 * Exported for the declared-coordinate layer (animation-cheats.plan.md):
 * OpenPose skeletons and joint anchors are projections of THESE nodes.
 */
export function balancedArmature(pose = {}, full = articulate(pose)) {
  const { weight = 0, support = 'both', crouch = 0, kneeOut = 0, plant = null } = pose || {};
  if (support === 'none') return full;
  const feet = support === 'L' ? ['L'] : support === 'R' ? ['R'] : ['L', 'R'];
  return plant ? groundVault(full, { plant }) : groundBalance(full, { feet, weight, crouch, kneeOut });
}

/**
 * Compose the posed, dressed figure as tagged ring-stacks (pure).
 * @param {object} pose  dof: { shL:{yaw,pitch}, elbowL, hipL, kneeL, head, …,
 *                        spine:{ sagittal, lateral, axial } }  (spine drives the warp)
 * @param {object} proto figure tuning ({ sex, height, build knobs … })
 * @param {?string} garment  a GARMENTS key (skinSuit/wetsuit/tee/tank/dress) or null
 */
// A HELD SHIELD — a real ms-armory shield mounted on a posed forearm. The shield
// is an ms-shield workbench recipe (families / palettes / rims / bosses) lowered
// to placed faces (workbenchAssetFaces), scaled to the figure and dropped at the
// posed forearm, so it composites with the body and RIDES the pose. The shield's
// local frame is +y forward / +z up — the SAME axes as the figure — so the mount
// hardware (−y) sits toward the arm and the face (+y) points forward. `hold` (or
// `hold.shield`) is `true` or `{ side, family, palette, seed, size, front, mount }`.
function buildHeldShield(nodes, hold) {
  const spec = hold === true ? {} : (hold && typeof hold === 'object' ? (hold.shield && typeof hold.shield === 'object' ? hold.shield : hold) : null);
  if (!spec) return [];
  const side = (spec.side === 'R' || (hold && hold.side === 'R')) ? 'R' : 'L';
  const wrist = nodes['wrist' + side], elbow = nodes['elbow' + side];
  if (!wrist || !elbow) return [];
  if (!resolveMsShieldRecipe) return [];   // shelf unavailable — shieldless, never fatal
  let raw;
  try {
    const recipe = resolveMsShieldRecipe({ family: spec.family, palette: spec.palette, seed: spec.seed ?? 3 });
    // lower the shield's extrudes + sweeps DIRECTLY with the polygonizer face-lowerers (light, leaf
    // modules) — importing workbench.js here would drag in the scene/world chain and cycle back.
    raw = [
      ...(recipe.extrudes || []).flatMap((s) => extrudeToFaces(s)),
      ...(recipe.sweeps || []).flatMap((s) => sweepToFaces(s)),
    ];   // [{ corners:[[x,y,z]…], fill, doubleSided? }] — vexar-shaded
  } catch { return []; }
  if (!raw.length) return [];
  let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  for (const f of raw) for (const c of f.corners) {
    if (c[0] < mnx) mnx = c[0]; if (c[0] > mxx) mxx = c[0];
    if (c[1] < mny) mny = c[1]; if (c[1] > mxy) mxy = c[1];
    if (c[2] < mnz) mnz = c[2]; if (c[2] > mxz) mxz = c[2];
  }
  const cxL = (mnx + mxx) / 2, cyL = (mny + mxy) / 2, czL = (mnz + mxz) / 2;   // shield-local center
  const targetH = spec.size ?? 0.62;                 // shield height in STAND units (~shoulder to hip)
  const scale = targetH / ((mxz - mnz) || 1);
  const t = spec.mount ?? 0.5;                        // mount along elbow→wrist (0 = elbow, 1 = wrist)
  const front = spec.front ?? 0.12;                  // push the shield center in FRONT of the forearm (+y)
  const mx = elbow.x + (wrist.x - elbow.x) * t;
  const my = elbow.y + (wrist.y - elbow.y) * t + front;
  const mz = elbow.z + (wrist.z - elbow.z) * t;
  const S = PROTO_SCALE;
  const faces = raw.map((f) => ({
    fill: f.fill,
    doubleSided: f.doubleSided,
    corners: f.corners.map(([x, y, z]) => ({
      x: (mx + (x - cxL) * scale) * S,
      y: (my + (y - cyL) * scale) * S,
      z: (mz + (z - czL) * scale) * S,
    })),
  }));
  return [{ id: 'shield:' + side, faces }];
}

export function buildPosedFigure(pose = {}, proto = {}, garment = null, fluffs = null, hold = null, hair = null, proportions = null, fluffQuality = 1, weld = null) {
  const { spine, hinge, squash, weight = 0, support = 'both', lift = 0, crouch = 0, kneeOut = 0, plant = null, footFlat = null, ...limbs } = pose || {};
  const full = articulate(pose);          // spine + limbs (pure FK, feet float)
  const balanced = balancedArmature(pose, full);

  // The trunk + girdle + arms are built on the LIMBS-posed, STRAIGHT-spine,
  // UN-HINGED, PRE-balance armature: the trunk builders read only z-heights/widths
  // so they MUST stay straight (the spine warp below bends them onto the curve — and
  // the hip HINGE rides that same warp, which is why hinge is held out here like spine), and
  // baking balance in here would double it against that warp. The legs+feet are
  // the exception — they carry ground IK the height-warp can't reproduce — so they
  // are built on the BALANCED nodes and passed through the warp. `buildProtoform`
  // builds from one armature, so build twice and take only the leg/foot stacks
  // from the balanced build; the girdle (diaper/glute) comes from the rest build
  // and is WARPED, so it rides the balanced pelvis with the rest of the trunk.
  // One build: trunk + girdle + arms on the rest frame (warped below), legs+feet
  // on the balanced ground-IK nodes (passed through the warp). buildProtoform's
  // legNodes override does this in a single pass.
  const restPos = articulate(limbs);
  const legPos = { ...restPos };
  for (const k of GROUNDED_NODES) legPos[k] = { ...balanced[k] };
  // `plant` pins the foot to the floor (position); `footFlat` (default → plant) flattens the
  // sole to the ground (orientation). The walk does both; the sprint pins without flattening
  // (forefoot strike), so it passes footFlat = 0.
  const flatOf = (s) => (footFlat ? footFlat[s] || 0 : plant ? plant[s] || 0 : 0);
  // wrist articulation (the hand's mirror of footFlex): wristL/R = { flex, deviation } (a bare
  // number is treated as flex), fingersL/R = the knuckle curl. Threaded into the hand builder.
  const wf = (w) => (typeof w === 'number' ? { flex: w } : (w || {}));
  const wfL = wf(limbs.wristL), wfR = wf(limbs.wristR);
  let body;
  if (Array.isArray(fluffs) && fluffs.length) {
    // FLUFFFORM — the stylized flesh register (figure-fluff.plan.md §3): a SIBLING
    // of protoform, not a layer on top. buildFluffs emits the exact proto stack
    // shape ({ id, rings }, world = STAND × scale), so the spine warp, garment
    // layer, and vexar mesher below eat it unchanged. Fluffs bind landmark
    // segments/nodes on the rest frame with the grounded leg nodes spliced in
    // (mirroring buildProtoform's legNodes pass), so leg/foot fluffs sit on the
    // balanced ground-IK ankles.
    const fluffPos = { ...restPos };
    for (const k of GROUNDED_NODES) fluffPos[k] = legPos[k];
    // Chibi rig: compress the skeleton to mascot proportions before the shapes bind.
    const boundPos = proportions ? chibiRig(fluffPos, proportions) : fluffPos;
    // fluffQuality scales the tessellation off the defaults (14 rings × 24 samples ×
    // 10 latitude) — >1 rounds the beads/pipes (smoother spheres, finer joint seams)
    // at a polygon cost. 1 = the byte-identical default.
    const q = Math.max(0.5, fluffQuality || 1);
    const tess = q === 1 ? {} : { rings: Math.round(14 * q), samples: Math.round(24 * q), latRings: Math.round(10 * q) };
    if (weld) {
      // Seamless path: weld the STRUCTURAL fluffs (bulbs+pipes) into one skin per
      // colour via the SDF field; keep `overlay:true` specs (face marks / doodads)
      // as ordinary beads on top. `overlay` isn't a fluff dial, so strip it first.
      const strip = ({ overlay, ...f }) => f;   // eslint-disable-line no-unused-vars
      const structural = fluffs.filter((f) => !f.overlay).map(strip);
      const overlays = fluffs.filter((f) => f.overlay).map(strip);
      const weldOpts = (weld && typeof weld === 'object') ? weld : {};
      body = [
        ...weldFluffs(boundPos, structural, { scale: PROTO_SCALE, ...weldOpts }),
        ...(overlays.length ? buildFluffs(boundPos, overlays, { scale: PROTO_SCALE, ...tess }) : []),
      ];
    } else {
      body = buildFluffs(boundPos, fluffs, { scale: PROTO_SCALE, ...tess });
    }
  } else {
    body = buildProtoform(restPos, { ...PROTO_DEFAULT, ...proto }, legPos, {
      L: { ankle: limbs.ankleL || 0, toe: limbs.toeL || 0, plant: plant ? plant.L || 0 : 0, flatten: flatOf('L') },
      R: { ankle: limbs.ankleR || 0, toe: limbs.toeR || 0, plant: plant ? plant.R || 0 : 0, flatten: flatOf('R') },
    }, {
      L: { flex: wfL.flex || 0, deviation: wfL.deviation || 0, curl: limbs.fingersL || 0 },
      R: { flex: wfR.flex || 0, deviation: wfR.deviation || 0, curl: limbs.fingersR || 0 },
    });
  }

  // Warp whenever the figure is off its rest pose. S0 = the straight rest spine the
  // flesh was built on; S1 = the fully posed + BALANCED spine. Because S1 carries
  // the trunk's pelvis onto the balanced hips, the trunk stays welded to the
  // (balanced) legs instead of floating. The arms ride the shoulder girdle rigidly;
  // the grounded lower-body stacks pass through unchanged. Rest → S0≡S1 → identity.
  if (offRest(spine, hinge, full, balanced)) {
    const deformer = spineDeformerFromNodes(basePositions(), balanced);
    body = warpStacks(body, deformer, { anchors: spineArmAnchors(), skip: GROUNDED_STACKS });
  }
  // Squash & stretch: a volume-preserving deform about the feet (the weight
  // principle). Applied last, over the whole flesh, so garments built from it
  // follow. squash = 1 → identity.
  if (squash && squash !== 1) body = squashStretch(body, squash);
  // Root lift — raise the whole figure off the ground (a hop/jump arc). In STAND
  // units; the locked ground baseline in renderFigureFrames keeps it airborne.
  if (lift) body = liftStacks(body, lift * PROTO_SCALE);
  // A fluff (or proto) stack that authored its OWN colour keeps it; only uncoloured
  // flesh falls back to FLESH_HEX (and thus tracks the setup material via recolorFlesh).
  // This is what lets a stylized fluff body be multi-coloured (a blue vest-bead, a
  // black hair-bead) from the recipe alone, without the skin-paint seam.
  const stacks = body.map((s) => ({ id: s.id, rings: s.rings, hex: s.hex || FLESH_HEX }));
  // Garments: build each cloth shell, then RESOLVE its spec's cuts + panels against the
  // body and attach them per-piece, so the shared mesher (litFaces) carves and recolours
  // the cloth — svgile-row's cutter, finally in the production renderer (SVG + World).
  // `garment` is a single spec KEY, an inline spec OBJECT, or an array (layering: shirt + trousers + jacket).
  for (const garm of garmentList(garment)) {
    const spec = (garm && typeof garm === 'object') ? garm : GARMENTS[garm]; if (!spec) continue;
    const gpieces = buildGarment(body, spec);
    const cuts = resolveCuts(spec.cuts, gpieces, body);
    const pregions = resolveCuts((spec.panels || []).map((p) => p.region), gpieces, body);
    const panels = (spec.panels || []).map((p, i) => ({ region: pregions[i], color: p.color, on: p.on }));
    for (const g of gpieces) {
      const ap = cuts.filter((c) => !c.on || c.on === g.panel);             // cuts scoped to this piece's panel
      const pp = panels.filter((p) => !p.on || p.on === g.panel);
      const outer = !g.id.includes(':under:');                              // seams trace OUTER cloth only
      stacks.push({
        id: g.id, rings: g.rings, hex: g.hex, panel: g.panel,
        sheet: g.sheet || false,                                              // open two-sided cloth (wave-drape)
        cut: ap.length ? cutPredicate(ap) : null,
        panels: pp.length ? pp : null,
        seamCuts: outer && ap.length ? ap : null,
      });
    }
  }
  // HAIR (wig.js): a scalp-anchored shell read off the posed head (needs `headEgg`),
  // appended after the flesh map so recolorFlesh leaves the hair colour alone. Same
  // ring-stack currency as a garment — the curtain is an OPEN sheet (two-sided smooth
  // shading), the tail/strand/knot/bun kinds are CLOSED tubes. A wig is one spec KEY,
  // an inline spec object, OR { style, color?, tipColor?, highlight? } (style + colour
  // variations). buildWig ramps (ombre) ride the stack as `ramp`; the mesher ignores
  // unknown keys, so hair meshes through the shared litFaces unchanged.
  if (hair) {
    const style = (hair && typeof hair === 'object' && 'style' in hair) ? hair.style : hair;
    const opts = (hair && typeof hair === 'object') ? hair : {};
    try {
      for (const st of buildWig(body, style, opts)) {
        stacks.push({ id: st.id, rings: st.rings, hex: st.hex, ...(st.ramp ? { ramp: st.ramp } : {}), sheet: !st.closed });
      }
    } catch (err) { /* a figure with no headEgg (fluffform) renders hairless rather than failing */ }
  }
  // held prop (shield): appended AFTER the flesh mapping so recolorFlesh leaves its hex alone;
  // ride the same root lift the body took so it stays in the hand off the ground.
  if (hold) {
    for (const st of buildHeldShield(balanced, hold)) {
      if (lift) st.faces = st.faces.map((f) => ({
        ...f, corners: f.corners.map((q) => ({ x: q.x, y: q.y, z: q.z + lift * PROTO_SCALE })),
      }));
      stacks.push(st);
    }
  }
  return stacks;
}

// ── camera: orbit a perspective rig around the figure (auto-frames any pose) ──
const FIG_R = 7.7, FIG_H = 2.6, LOOK = [0, 0.1, 1.7];
const ROOM = { worldExtent: { width: 14, depth: 14, height: 8 }, xRange: [-7, 7], yRange: [-7, 7], frontY: 7, backY: -7, verticalUnit: 70 };
function viewAzimuth(view) {
  if (typeof view === 'number') return view;
  return VIEW_AZ[view] ?? VIEW_AZ['three-quarter'];
}
function makeCamera(view) {
  const a = (viewAzimuth(view) * Math.PI) / 180;
  const CAM = [FIG_R * Math.sin(a), FIG_R * Math.cos(a), FIG_H];           // az 0 = +y (front)
  const cam = { kind: 'two-point', viewBox: { width: 1000, height: 1000 }, worldFraming: { cameraPosition: CAM, lookAt: LOOK, horizontalFov: 30, pictureCenter: [500, 500] } };
  // Un-mirror screen-x: projectTwoPoint puts the figure's +x (its right side) on
  // screen-right, but a figure facing us should show its right on OUR left (the
  // natural mirror/photo convention). Negating x makes posing read intuitively —
  // the figure's right hand (shR) lands on the viewer's left.
  const project = (p) => { const r = projectTwoPoint([p[0], p[1], p[2]], cam, ROOM); return [-r[0], r[1]]; };
  return { CAM, project };
}

/**
 * The /svg studio orbit camera as a World-payload camera (interchange.plan.md I2 —
 * the figure world/export form). Same rig makeCamera builds: azimuth around the
 * figure at FIG_R/FIG_H, 30° fov. NOTE the /svg path additionally MIRRORS screen-x
 * (the photo convention); a 3D viewport cannot, so left/right read un-mirrored there.
 */
export function figureWorldCamera(view) {
  const a = (viewAzimuth(view) * Math.PI) / 180;
  return {
    name: 'studio',
    worldFraming: { cameraPosition: [FIG_R * Math.sin(a), FIG_R * Math.cos(a), FIG_H], lookAt: LOOK, horizontalFov: 30, pictureCenter: [280, 380] },
  };
}

const newell = (pts) => {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l];
};

// The lowest ring height (in /PROTO_SCALE units) — the figure's ground contact.
function stackMinZ(stacks) {
  let minZ = Infinity;
  for (const st of stacks) {
    if (st.faces) { for (const f of st.faces) for (const q of f.corners) { const z = q.z / PROTO_SCALE; if (z < minZ) minZ = z; } continue; }
    for (const rg of st.rings) for (const q of rg.polyline) { const z = q.z / PROTO_SCALE; if (z < minZ) minZ = z; }
  }
  return minZ;
}
// The shared STAND→render world transform. The lowest ring plants on the ground,
// so filled meshing and wireframe stroking stay in lockstep. `groundZ` (when given)
// is a baseline shared across a motion's frames — so a figure that LIFTS off the
// ground (a hop/jump) rises above it instead of being re-planted every frame.
function worldVertex(stacks, groundZ) {
  const minZ = groundZ == null ? stackMinZ(stacks) : groundZ;
  return (q) => [(q.x / PROTO_SCALE) * S, (q.y / PROTO_SCALE) * S, ((q.z / PROTO_SCALE) - minZ) * S + 0.02];
}

// Mesh the stacks into world-space lit faces (back-face culled, depth tagged).
// `cull:false` keeps every face: the SVG path culls against the single fixed CAM,
// but the live World orbit camera moves, so the back of the figure must survive
// (the three.js material renders DoubleSide). Shading is camera-independent — the
// outward normal is oriented by the stack centre, not CAM — so colours are unchanged.
// An OPEN cloth SHEET (wave-drape: cape/cloak/tabard) — the ring grid is a 2D
// panel, not a closed tube. It has no meaningful centerline, so we can't orient
// by a ring centre or back-face cull. Instead: SMOOTH the shading with vertex
// normals (mean of the ≤4 incident face normals) so the wave folds read as soft
// gradients not a hard facet checkerboard, and light BOTH sides by |Lambert|
// (flip each face normal into the light hemisphere). svgile-row cuts + panels
// still apply, tested against the raw figure-space centroid like any garment.
function emitSheetFaces(st, V, light, dist, faces) {
  const cut = st.cut, panels = st.panels, R = st.rings;
  const Ni = R.length, Nj = Math.min(...R.map((r) => r.polyline.length));
  if (Ni < 2 || Nj < 2) return;
  const P = R.map((r) => r.polyline.slice(0, Nj).map((p) => V(p)));         // world positions [i][j]
  const FN = [];                                                            // face normals, consistent winding
  for (let i = 0; i < Ni - 1; i++) { FN[i] = []; for (let j = 0; j < Nj - 1; j++) FN[i][j] = newell([P[i][j], P[i][j + 1], P[i + 1][j + 1], P[i + 1][j]]); }
  const VN = [];                                                            // vertex normals = mean of incident faces
  for (let i = 0; i < Ni; i++) {
    VN[i] = [];
    for (let j = 0; j < Nj; j++) {
      let x = 0, y = 0, z = 0;
      for (const [di, dj] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) {
        const fi = i + di, fj = j + dj;
        if (fi >= 0 && fi < Ni - 1 && fj >= 0 && fj < Nj - 1) { const f = FN[fi][fj]; x += f[0]; y += f[1]; z += f[2]; }
      }
      const l = Math.hypot(x, y, z) || 1; VN[i][j] = [x / l, y / l, z / l];
    }
  }
  for (let i = 0; i < Ni - 1; i++) {
    const a = R[i].polyline, b = R[i + 1].polyline;
    for (let j = 0; j < Nj - 1; j++) {
      const pa = a[j], pa1 = a[j + 1], pb1 = b[j + 1], pb = b[j];
      const praw = (cut || panels) ? { x: (pa.x + pa1.x + pb1.x + pb.x) / 4, y: (pa.y + pa1.y + pb1.y + pb.y) / 4, z: (pa.z + pa1.z + pb1.z + pb.z) / 4 } : null;
      if (cut && cut(praw)) continue;
      const wpts = [P[i][j], P[i][j + 1], P[i + 1][j + 1], P[i + 1][j]];
      const vn = [VN[i][j], VN[i][j + 1], VN[i + 1][j + 1], VN[i + 1][j]];
      let nx = 0, ny = 0, nz = 0; for (const v of vn) { nx += v[0]; ny += v[1]; nz += v[2]; }
      const l = Math.hypot(nx, ny, nz) || 1; let shadeN = [nx / l, ny / l, nz / l];
      if (dot3(shadeN, light.toLight) < 0) shadeN = [-shadeN[0], -shadeN[1], -shadeN[2]];   // two-sided |Lambert|
      let hex = st.hex;
      if (panels) for (const p of panels) if (cutHits(praw, p.region)) hex = p.color;
      const cen = centroid(wpts);
      faces.push({ wpts, fill: shadeHex(hex, shadeN, light), shade: litFactor(shadeN, light), dist: dist(cen) });
    }
  }
}

function litFaces(stacks, CAM, light = LIGHT, groundZ, { cull = true, recolor = null } = {}) {
  const V = worldVertex(stacks, groundZ);
  const dist = (cen) => Math.hypot(cen[0] - CAM[0], cen[1] - CAM[1], cen[2] - CAM[2]);
  const faces = [];
  for (const st of stacks) {
    if (st.sheet) { emitSheetFaces(st, V, light, dist, faces); continue; }  // open two-sided cloth (wave-drape)
    if (st.faces) {   // prebuilt object faces (a lowered workbench prop, e.g. the ms-shield) — already shaded
      for (const f of st.faces) {
        const wpts = f.corners.map(V);
        faces.push({ wpts, fill: f.fill, shade: 1, dist: dist(centroid(wpts)) });   // painter's-sort by depth; fill carries its own shading
      }
      continue;
    }
    const cut = st.cut, panels = st.panels;                                 // garment cutter + panel recolour (null for flesh)
    for (let i = 0; i < st.rings.length - 1; i++) {
      const a = st.rings[i].polyline, b = st.rings[i + 1].polyline, m = Math.min(a.length, b.length);
      const c0 = st.rings[i].center, c1 = st.rings[i + 1].center;
      const cw = V({ x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2, z: (c0.z + c1.z) / 2 });
      for (let j = 0; j < m - 1; j++) {
        const pa = a[j], pa1 = a[j + 1], pb1 = b[j + 1], pb = b[j];
        // svgile-row cutter: a face is DELETED if its body-relative centroid lands in a
        // cut scoped to this piece's panel; PANELS recolour by the last region covering
        // it. Both test the RAW ring centroid — the cut frame is figure space, not world.
        const praw = (cut || panels) ? { x: (pa.x + pa1.x + pb1.x + pb.x) / 4, y: (pa.y + pa1.y + pb1.y + pb.y) / 4, z: (pa.z + pa1.z + pb1.z + pb.z) / 4 } : null;
        if (cut && cut(praw)) continue;
        const wpts = [V(pa), V(pa1), V(pb1), V(pb)];
        let n = newell(wpts); const cen = centroid(wpts);
        if (dot3(n, sub3(cen, cw)) < 0) n = [-n[0], -n[1], -n[2]];
        if (cull && dot3(n, sub3(CAM, cen)) <= 0) continue;                 // back-face cull
        let hex = st.hex, shadeN = n;
        if (panels) for (const p of panels) if (cutHits(praw, p.region)) hex = p.color;   // last panel wins
        // per-face recolor (animal countershading): when a face flips to the underside
        // colour, shade it with the z-FLIPPED (upward) normal so the white belly catches
        // overhead light instead of shading to muddy grey — biological countershading.
        if (recolor) { const rc = recolor(hex, n, cen); if (rc) { hex = rc; shadeN = [n[0], n[1], Math.abs(n[2])]; } }
        // `shade` = the raw Lambert factor, carried so the skin-projection seam can
        // multiply a sampled albedo by the deterministic form-shading (the control
        // scaffold emits it as data-shade — same contract as manji-svg lit faces).
        faces.push({ wpts, fill: shadeHex(hex, shadeN, light), shade: litFactor(shadeN, light), dist: dist(cen) });
      }
    }
  }
  // RED-LINE seams: each cut's boundary (cutBoundary) realised as a thin ribbon lying on
  // the cloth along the seam, so lapels / neckline / armholes draw themselves in 3D
  // (the World analogue of the SVG path's stroked polylines). Back-face culled per seam.
  for (const st of stacks) {
    if (!st.seamCuts) continue;
    for (const s of cutBoundary(st.rings, st.seamCuts)) {
      const P = V(s.p), Q = V(s.q), nW = unit3([s.n.x, s.n.y, s.n.z]);
      const cen0 = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2, (P[2] + Q[2]) / 2];
      if (cull && dot3(nW, sub3(CAM, cen0)) <= 0) continue;                 // cull far-side seams
      const perp = unit3(cross3(unit3(sub3(Q, P)), nW)), w = 0.018, e = 0.006;
      const off = (p, k) => [p[0] + perp[0] * k + nW[0] * e, p[1] + perp[1] * k + nW[1] * e, p[2] + perp[2] * k + nW[2] * e];
      const wpts = [off(P, -w), off(Q, -w), off(Q, w), off(P, w)], cen = centroid(wpts);
      faces.push({ wpts, fill: shadeHex(SEAM_HEX, nW, light), shade: litFactor(nW, light), dist: dist(cen) - 1e-3 });   // tiebreak toward camera
    }
  }
  faces.sort((p, q) => q.dist - p.dist);                                    // far → near
  return faces;
}

// Project lit faces to 2D + the screen bounding box (no fit applied yet).
function projectFaces(faces, project) {
  const proj = faces.map((f) => ({ pts: f.wpts.map(project), fill: f.fill, shade: f.shade }));
  const bb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const f of proj) for (const [x, y] of f.pts) if (Number.isFinite(x) && Number.isFinite(y)) {
    if (x < bb.minX) bb.minX = x; if (y < bb.minY) bb.minY = y; if (x > bb.maxX) bb.maxX = x; if (y > bb.maxY) bb.maxY = y;
  }
  return { proj, bb };
}
// A fit (scale + offset) that frames a bbox into a W×H viewBox. Computed ONCE for
// a whole motion so the figure doesn't rescale/jitter frame-to-frame.
function fitFor(bb, W, H, pad) {
  const fw = Math.max(1e-6, bb.maxX - bb.minX), fh = Math.max(1e-6, bb.maxY - bb.minY);
  const s = Math.min((W - pad * 2) / fw, (H - pad * 2) / fh);
  return { s, ox: pad + ((W - pad * 2) - fw * s) / 2 - bb.minX * s, oy: pad + ((H - pad * 2) - fh * s) / 2 - bb.minY * s };
}
function drawPolys(proj, fit, { control = false } = {}) {
  const X = (x) => (x * fit.s + fit.ox).toFixed(1), Y = (y) => (y * fit.s + fit.oy).toFixed(1);
  const out = [];
  for (const f of proj) {
    const pts = f.pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
    if (!pts) continue;
    // Control-scaffold faces use the manji-svg lit-face polygon contract
    // (stroke-linejoin + data-shade) so skin-projection's reskin matches them.
    out.push(control
      ? `<polygon points="${pts}" fill="${f.fill}" stroke="${f.fill}" stroke-width="0.5" stroke-linejoin="round" data-shade="${(f.shade ?? 1).toFixed(4)}"/>`
      : `<polygon points="${pts}" fill="${f.fill}" stroke="${f.fill}" stroke-width="0.5"/>`);
  }
  return out;
}

// ── wireframe (ring-wave) — stroke every projected ring polyline, no fill ──
// The figure is already a stack of rings; the construction view is just those
// rings drawn as lines instead of meshed into lit faces. Far rings fade for a
// little depth cue. Same world transform + camera as the filled path.
function projectWire(stacks, project, groundZ) {
  const V = worldVertex(stacks, groundZ);
  const lines = [];
  const bb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const st of stacks) {
    for (const rg of st.rings) {
      const pts = rg.polyline.map((q) => project(V(q)));
      lines.push(pts);
      for (const [x, y] of pts) if (Number.isFinite(x) && Number.isFinite(y)) {
        if (x < bb.minX) bb.minX = x; if (y < bb.minY) bb.minY = y;
        if (x > bb.maxX) bb.maxX = x; if (y > bb.maxY) bb.maxY = y;
      }
    }
  }
  return { lines, bb };
}
function drawWire(lines, fit, stroke) {
  const X = (x) => (x * fit.s + fit.ox).toFixed(1), Y = (y) => (y * fit.s + fit.oy).toFixed(1);
  const out = [];
  for (const pts of lines) {
    const d = pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
    if (d) out.push(`<polyline points="${d}" fill="none" stroke="${stroke}" stroke-width="0.8" stroke-linejoin="round" opacity="0.85"/>`);
  }
  return out;
}

const VB_W = 560, VB_H = 760, PAD = 28, BG = '#eef1f4';
const svgDoc = (polys, bg) => [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}" width="${VB_W}" height="${VB_H}">`,
  `<rect width="${VB_W}" height="${VB_H}" fill="${bg}"/>`, ...polys, `</svg>`,
].join('\n');

/**
 * Resolve a manifest's named studio setup into render knobs. No setup → the
 * built-in defaults (so existing figures render byte-identically). The setup's
 * backdrop yields to `background:false` (transparent) when the caller asks.
 */
function resolveSetup(manifest) {
  const setup = resolveFigureSetup(manifest.setup);
  const bg = manifest.background === false ? 'none' : (setup?.bg ?? BG);
  return {
    mode: setup?.mode ?? 'filled',
    bg,
    fleshHex: setup?.fleshHex ?? FLESH_HEX,
    light: setup?.light ? makeLight(setup.light) : LIGHT,
    wireStroke: setup?.wireStroke ?? '#7fdbff',
  };
}

// Re-tint only the FLESH stacks to the setup's material; garment hexes stay.
function recolorFlesh(stacks, fleshHex) {
  if (fleshHex === FLESH_HEX) return stacks;
  return stacks.map((s) => (s.hex === FLESH_HEX ? { ...s, hex: fleshHex } : s));
}

/**
 * Render a single posed figure to a standalone SVG string. Pass a precomputed
 * `fit` (from a motion's locked framing) to keep the figure from rescaling.
 */
export function renderFigureToSvg(manifest = {}, fit = null, { control = false } = {}) {
  const setup = resolveSetup(manifest);
  const stacks = recolorFlesh(buildPosedFigure(manifest.pose, manifest.proto, manifest.garment, manifest.fluffs, manifest.hold, manifest.hair, manifest.proportions, manifest.fluffQuality, manifest.weld), setup.fleshHex);
  const { CAM, project } = makeCamera(manifest.view);
  // The control scaffold (skin seam) is ALWAYS the filled lit render — a wire
  // setup would fragment a diffusion skin (the polygomer-skin lesson).
  if (setup.mode === 'wire' && !control) {
    const { lines, bb } = projectWire(stacks, project);
    return svgDoc(drawWire(lines, fit || fitFor(bb, VB_W, VB_H, PAD), setup.wireStroke), setup.bg);
  }
  const { proj, bb } = projectFaces(litFaces(stacks, CAM, setup.light), project);
  return svgDoc(drawPolys(proj, fit || fitFor(bb, VB_W, VB_H, PAD), { control }), setup.bg);
}

/**
 * Render the figure AND return its armature nodes in final SVG pixel
 * coordinates — the declared-coordinate seam (animation-cheats.plan.md).
 * The nodes ride the exact same world transform, camera, and fit as the
 * mesh, so a skeleton drawn from them is pixel-aligned with the render by
 * construction. Returns { svg, nodes: { headTop, neckHub, shoulderL, … :
 * [x, y] }, fit, viewBox }. Limitation: `pose.squash` deforms the flesh but
 * not the armature — don't rely on node alignment under squash.
 */
export function renderFigureWithArmature(manifest = {}, fit = null) {
  const setup = resolveSetup(manifest);
  const stacks = recolorFlesh(buildPosedFigure(manifest.pose, manifest.proto, manifest.garment, manifest.fluffs, manifest.hold, manifest.hair, manifest.proportions, manifest.fluffQuality, manifest.weld), setup.fleshHex);
  const { CAM, project } = makeCamera(manifest.view);
  const { proj, bb } = projectFaces(litFaces(stacks, CAM, setup.light), project);
  const F = fit || fitFor(bb, VB_W, VB_H, PAD);
  const svg = svgDoc(drawPolys(proj, F), setup.bg);
  const pose = manifest.pose || {};
  const arm = balancedArmature(pose);
  const lift = pose.lift || 0;                     // liftStacks moved the flesh; move the nodes with it
  const minZ = stackMinZ(stacks);                  // same ground plant as worldVertex
  const nodes = {};
  for (const [k, n] of Object.entries(arm)) {
    const [x, y] = project([n.x * S, n.y * S, ((n.z + lift) - minZ) * S + 0.02]);
    nodes[k] = [x * F.s + F.ox, y * F.s + F.oy];
  }
  return { svg, nodes, fit: F, viewBox: { width: VB_W, height: VB_H } };
}

// ─── ANIMAL render — the character builder, pointed at the animal-realm ──────
// `buildAnimal` (figure-animal-build) emits the SAME currency as the figure: parts of
// ring polylines `{polylines, stroke}`. So the animal renders through the EXACT figure
// mesher (litFaces → projectFaces → drawPolys), no second renderer — we just adapt the
// parts into the stack shape litFaces consumes, frame a horizontal-subject camera, and
// reuse everything else. The /api/sketches route dispatches kind:'animal' here.
const VB_WA = 760, VB_HA = 540, BG_A = '#eef1f4';
// animal azimuths: head-on (front of the body) = 180°, lateral = 90°, three-quarter ≈ 130°.
const ANIMAL_VIEW_AZ = { frontal: 180, 'three-quarter': 130, lateral: 90, left: -90, back: 0 };

// buildAnimal parts → litFaces stacks. STAND coords are lifted into PROTO_SCALE units so
// worldVertex (÷PROTO_SCALE ×S) lands them in the same render world as the figure; each
// ring carries its centroid as `center` (litFaces orients normals outward from it).
function animalStacks(parts) {
  const lift = (q) => ({ x: q.x * PROTO_SCALE, y: q.y * PROTO_SCALE, z: q.z * PROTO_SCALE });
  const centroidOf = (poly) => { let x = 0, y = 0, z = 0; for (const q of poly) { x += q.x; y += q.y; z += q.z; } const n = poly.length || 1; return lift({ x: x / n, y: y / n, z: z / n }); };
  return parts.map((p) => ({ hex: p.stroke, rings: p.polylines.map((poly) => ({ polyline: poly.map(lift), center: centroidOf(poly) })) }));
}

// A self-framing two-point camera orbiting the animal's world bounding box (so any
// archetype frames itself). Mirrors makeCamera's screen-x un-mirror so left/right read
// naturally. az/elev in radians/deg.
function animalCamera(stacks, az, elevDeg) {
  const V = worldVertex(stacks, null);
  const bb = { mnx: Infinity, mny: Infinity, mnz: Infinity, mxx: -Infinity, mxy: -Infinity, mxz: -Infinity };
  for (const st of stacks) for (const rg of st.rings) for (const q of rg.polyline) {
    const [x, y, z] = V(q);
    if (x < bb.mnx) bb.mnx = x; if (y < bb.mny) bb.mny = y; if (z < bb.mnz) bb.mnz = z;
    if (x > bb.mxx) bb.mxx = x; if (y > bb.mxy) bb.mxy = y; if (z > bb.mxz) bb.mxz = z;
  }
  const center = [(bb.mnx + bb.mxx) / 2, (bb.mny + bb.mxy) / 2, (bb.mnz + bb.mxz) / 2];
  const radius = 0.5 * Math.hypot(bb.mxx - bb.mnx, bb.mxy - bb.mny, bb.mxz - bb.mnz) || 1;
  const el = (elevDeg * Math.PI) / 180, R = radius * 3.2;
  const CAM = [center[0] + R * Math.cos(el) * Math.sin(az), center[1] - R * Math.cos(el) * Math.cos(az), center[2] + R * Math.sin(el)];
  const cam = { kind: 'two-point', viewBox: { width: 1000, height: 1000 }, worldFraming: { cameraPosition: CAM, lookAt: center, horizontalFov: 32, pictureCenter: [500, 500] } };
  const project = (p) => { const r = projectTwoPoint([p[0], p[1], p[2]], cam, ROOM); return [-r[0], r[1]]; };
  return { CAM, project };
}

/**
 * Render an animal (a buildAnimal recipe) to a standalone SVG through the figure mesher.
 * @param {{archetype?:string, opts?:object, view?:string|number, elev?:number, background?:false}} manifest
 */
// Filter assembled parts to the HEAD region (upper-forward) — a face study close-up. Same
// rule as the spike's cropHead: a part is kept if its centroid is in the top of the z-range
// AND the forward part of the y-range (the head sits high + forward on a quadruped).
function cropToHead(parts) {
  let zmin = Infinity, zmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const p of parts) for (const r of p.polylines) for (const q of r) {
    if (q.z < zmin) zmin = q.z; if (q.z > zmax) zmax = q.z;
    if (q.y < ymin) ymin = q.y; if (q.y > ymax) ymax = q.y;
  }
  return parts.filter((p) => {
    let cz = 0, cy = 0, n = 0;
    for (const r of p.polylines) for (const q of r) { cz += q.z; cy += q.y; n++; }
    if (!n) return false; cz /= n; cy /= n;
    return cz > zmin + 0.55 * (zmax - zmin) && cy > ymin + 0.62 * (ymax - ymin);
  });
}

export function renderAnimalToSvg(manifest = {}) {
  const { archetype = 'canine', opts = {}, view, elev, crop } = manifest;
  const built = buildAnimal(archetype, opts);
  const parts = crop === 'head' ? cropToHead(built.parts) : built.parts;
  const stacks = animalStacks(parts);
  const azDeg = typeof view === 'number' ? view : (ANIMAL_VIEW_AZ[view] ?? ANIMAL_VIEW_AZ['three-quarter']);
  const az = (azDeg * Math.PI) / 180, elDeg = typeof elev === 'number' ? elev : 12;
  const { CAM, project } = animalCamera(stacks, az, elDeg);
  // NORMAL-RULE ZONES: recolor body/tail faces by their OUTWARD NORMAL direction — a mark
  // with a geometric (normal) signature comes OFF the patch-colour wall, the same way the
  // ventral belly did. Two cases, mirror images, both gated to the coat hex (so feet / tips /
  // face zones are untouched) and both shaded as-if-lit so they read bright, not muddy:
  //   • `underHex` / `underCut` — DOWN-facing faces (n_z < cut) → countershaded belly (most mammals).
  //   • `overHex`  / `overCut`  — UP-facing faces   (n_z > cut) → a dorsal stripe down the back AND
  //     the tail-top (skunk / badger / dorsal-stripe). The tail must be SOLID coat for it to catch.
  const coatHex = opts?.coat?.color, underHex = opts?.underHex, underCut = opts?.underCut ?? -0.3;
  const overHex = opts?.overHex, overCut = opts?.overCut ?? 0.3;
  const recolor = (coatHex && (underHex || overHex)) ? (hex, n) => {
    if (hex !== coatHex) return null;
    if (underHex && n[2] < underCut) return underHex;
    if (overHex && n[2] > overCut) return overHex;
    return null;
  } : null;
  const { proj, bb } = projectFaces(litFaces(stacks, CAM, LIGHT, null, { cull: true, recolor }), project);
  const bg = manifest.background === false ? 'none' : BG_A;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_WA} ${VB_HA}" width="${VB_WA}" height="${VB_HA}">`,
    `<rect width="${VB_WA}" height="${VB_HA}" fill="${bg}"/>`,
    ...drawPolys(proj, fitFor(bb, VB_WA, VB_HA, PAD)),
    `</svg>`,
  ].join('\n');
}

// ── motion: walk is the formalized, parameterized gait (figure-posing.js) ──
// It drives the figure's stance/ground primitives (support + weight → groundBalance
// plants the stance foot and shifts the COM). `motion: 'walk'` uses the defaults;
// `motion: { gait: { strideLength, armSwing, ... } }` tunes the dials.
const TAU = 2 * Math.PI;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
// A natural head/body TILT; the right hand RESTS ON THE HIP, then lifts into a
// right-hand WAVE that accelerates then stops, then returns to the hip (so it
// loops). Choreographed over phase u ∈ [0,1]:
//   tilt in 0–.16; the arm lifts hip→up over .12–.28; wave .28–.74 with rising
//   frequency, amplitude damped to 0 by ~.74 (the "stop"); arm returns .82–1.0.
function wavePose(u) {
  const dof = {};
  const tilt = smooth(u / 0.16) * (1 - smooth((u - 0.80) / 0.20));         // ease in, hold, ease out
  dof.spine = { lateral: 0.11 * tilt, axial: 0.04 * tilt };                 // a light torso lean (head-led, not a fall)
  dof.head = { yaw: 13 * tilt, pitch: -7 * tilt };                         // cock the head
  const raise = smooth((u - 0.12) / 0.16) * (1 - smooth((u - 0.82) / 0.18)); // 0 = hand on hip · 1 = raised wave
  const w = clamp01((u - 0.28) / 0.46);                                     // local wave param
  const theta = TAU * (2.2 * w + 3.2 * w * w);                              // phase: frequency RAMPS UP with w
  const amp = smooth(w / 0.10) * (1 - smooth((w - 0.80) / 0.20));           // wave in, then damp to 0 → STOP
  const wave = (u > 0.28 && u < 0.80) ? Math.sin(theta) * amp : 0;
  const L = (a, b) => a + (b - a) * raise;                                  // blend hand-on-hip → raised wave
  // hand-on-hip (akimbo): elbow flared out, deeply bent, forearm rolled in to the hip.
  // raised wave:  upper arm out, forearm rolled UP (fingers up).
  // wave SWAYS the hand side to side through the shoulder's near-full abduction range.
  dof.shR = { yaw: L(-30, -58) + wave * 22, pitch: L(4, -4), roll: L(-95, 92) };   // hip: elbow flared, forearm rolled DOWN to the hip → up: forearm rolled UP
  dof.elbowR = L(88, 92);
  return dof;
}
// A LIMBER FLOW that exercises the new capabilities: an overhead REACH (shoulder
// pitch+roll lifts the forearms up) with a chest-opening ARCH (spine −sagittal),
// SIDE-BENDS left/right (spine lateral — a new axis), then a deep FORWARD FOLD
// toward the toes (spine +sagittal, the 3-segment curl the single navel-hinge
// could never reach), and back up. Authored as weighted keyposes over phase, so
// the body passes through neutral between beats and the loop closes.
const STRETCH_STAND = { shL: { pitch: 4 }, shR: { pitch: 4 }, elbowL: 12, elbowR: 12, kneeL: 5, kneeR: 5 };
// straight arms cap at horizontal (shoulder cone) — to get hands UP, raise the
// upper arm AND bend the elbow + roll the forearm up (the wave's trick).
const STRETCH_REACH = { spine: { sagittal: -0.7 }, shL: { yaw: 26, pitch: 70, roll: -96 }, shR: { yaw: -26, pitch: 70, roll: 96 }, elbowL: 92, elbowR: 92, head: { pitch: -10 } };
const STRETCH_SIDER = { spine: { lateral: 0.85, axial: 0.1 }, shL: { yaw: 58, pitch: 44, roll: 34 }, shR: { pitch: 8, yaw: -6 }, elbowL: 18, elbowR: 22 };
const STRETCH_SIDEL = { spine: { lateral: -0.85, axial: -0.1 }, shR: { yaw: -58, pitch: 44, roll: -34 }, shL: { pitch: 8, yaw: 6 }, elbowL: 22, elbowR: 18 };
const STRETCH_FOLD = { spine: { sagittal: 1.0 }, shL: { pitch: 10 }, shR: { pitch: 10 }, elbowL: 6, elbowR: 6, kneeL: 14, kneeR: 14 };
function blendPoses(items) {
  const acc = {}; let W = 0;
  for (const [pose, w] of items) {
    if (w <= 0) continue; W += w;
    for (const [k, v] of Object.entries(pose)) {
      if (typeof v === 'number') acc[k] = (acc[k] || 0) + v * w;
      else { acc[k] = acc[k] || {}; for (const [sk, sv] of Object.entries(v)) acc[k][sk] = (acc[k][sk] || 0) + sv * w; }
    }
  }
  const out = {}; if (W <= 0) return out;
  for (const [k, v] of Object.entries(acc)) {
    if (typeof v === 'number') out[k] = v / W;
    else { out[k] = {}; for (const [sk, sv] of Object.entries(v)) out[k][sk] = sv / W; }
  }
  return out;
}
function stretchPose(u) {
  const env = (a, p1, p2, b) => clamp01(smooth((u - a) / (p1 - a))) * (1 - clamp01(smooth((u - p2) / (b - p2))));
  const wR = env(0.03, 0.10, 0.20, 0.27), wSR = env(0.27, 0.34, 0.42, 0.50);
  const wSL = env(0.50, 0.57, 0.65, 0.72), wF = env(0.72, 0.81, 0.91, 0.99);
  const wStand = Math.max(0, 1 - wR - wSR - wSL - wF);
  return blendPoses([[STRETCH_STAND, wStand], [STRETCH_REACH, wR], [STRETCH_SIDER, wSR], [STRETCH_SIDEL, wSL], [STRETCH_FOLD, wF]]);
}
const MOTIONS = { walk: gait(WALK_DEFAULTS), wave: wavePose, stretch: stretchPose };
// Resolve a motion. The string names 'wave'/'stretch' (choreographies that live
// here) come from MOTIONS; emote names / { emote } specs come from the named
// figure-emotes library; everything else — 'walk', a parameterized gait/walk
// spec, a keyframe-motion spec, a function, a `perform`-wrapped motion — goes
// through figure-posing's resolveMotion, the shared motion front door.
const motionFn = (m, frames) => {
  if (m === 'wave' || m === 'stretch') return MOTIONS[m];
  if (isEmoteSpec(m)) return emoteMotion(m, { frames });
  return resolveMotion(m, { frames });
};
export function figureIsAnimated(manifest) { return !!(manifest && motionFn(manifest.motion)); }

// Does this STRING resolve to a known motion? Manifest validators use this to
// reject an unknown keyframe motion name up front (a clear error) instead of
// letting it crash later at guide render (sampleMotionPose → null → deref).
// Object specs ({ keyframes }, { walk }, …) are validated by their own shape;
// this is only the name-string gate.
export function isKnownMotionName(m) { return typeof m === 'string' && !!motionFn(m); }

/**
 * Sample a motion's pose at phase u ∈ [0,1) — the still-frame door into the
 * motion vocabulary ('walk'/'wave'/'stretch'/gait/keyframe specs). Returns the
 * sampled dof object, or null when the motion doesn't resolve. Callers merge it
 * under/over a base pose exactly like renderFigureFrames does per frame.
 */
export function sampleMotionPose(motion, u = 0, frames = 30) {
  const move = motionFn(motion, frames);
  if (!move) return null;
  const t = ((u % 1) + 1) % 1;
  return move(t);
}

/**
 * Render N frames of a motion as SVG strings (for a GIF). The camera framing is
 * computed ONCE from the union of all frames' extents and reused, so the figure
 * stays put instead of rescaling/jittering as the limbs move.
 */
export function renderFigureFrames(manifest = {}, frames = 30) {
  const move = motionFn(manifest.motion, frames);
  if (!move) return [renderFigureToSvg(manifest)];
  const setup = resolveSetup(manifest);
  const wire = setup.mode === 'wire';
  const { CAM, project } = makeCamera(manifest.view);
  // Pass 1: build every frame's flesh and find the SHARED ground baseline (the
  // lowest contact across the whole motion). A grounded frame's foot sits on it;
  // a lifted frame rises above it — so a hop/jump leaves the ground instead of
  // being re-planted per frame. For grounded motions every frame's min is equal,
  // so this is identical to per-frame planting.
  const built = [];
  let groundZ = Infinity;
  for (let i = 0; i < frames; i++) {
    const pose = { ...(manifest.pose || {}), ...move(i / frames) };
    const stacks = recolorFlesh(buildPosedFigure(pose, manifest.proto, manifest.garment, manifest.fluffs, manifest.hold, manifest.hair, manifest.proportions, manifest.fluffQuality, manifest.weld), setup.fleshHex);
    built.push(stacks);
    const mz = stackMinZ(stacks);
    if (mz < groundZ) groundZ = mz;
  }
  // Pass 2: project every frame against that baseline; lock ONE camera framing.
  const projected = [];
  const gb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const stacks of built) {
    const { lines, proj, bb } = wire
      ? { ...projectWire(stacks, project, groundZ) }
      : projectFaces(litFaces(stacks, CAM, setup.light, groundZ), project);
    projected.push(wire ? lines : proj);
    if (bb.minX < gb.minX) gb.minX = bb.minX; if (bb.minY < gb.minY) gb.minY = bb.minY;
    if (bb.maxX > gb.maxX) gb.maxX = bb.maxX; if (bb.maxY > gb.maxY) gb.maxY = bb.maxY;
  }
  const fit = fitFor(gb, VB_W, VB_H, PAD);   // ONE locked framing for the whole motion
  return projected.map((p) => svgDoc(wire ? drawWire(p, fit, setup.wireStroke) : drawPolys(p, fit), setup.bg));
}

/**
 * Render a motion as engine-agnostic WORLD frames for the live three.js viewport
 * (figure-world.plan.md). Same Pass-1 solve as renderFigureFrames — build every
 * frame, share the lowest ground contact as the baseline so a hop leaves the floor
 * — but each frame emits UN-PROJECTED, UN-CULLED lit faces { corners, fill }
 * instead of 2D polys, because the orbit camera moves. A still figure (no motion)
 * collapses to a single frame, so this also covers a static posed figure in 3D.
 *
 * @returns {{ frames: {faces:{corners:number[][],fill:string}[]}[], title:string, bg:string }}
 */
/**
 * figureRigSamples — the rig-bake feed (renderer-convergence step 2): rest faces + per-key
 * BALANCED armature nodes, all in the SAME world space renderFigureWorldFrames faces use
 * (worldVertex over the rest build's ground). Keeping both sides of the transform in this
 * module means rig-bake never replicates PROTO_SCALE / S / groundZ — the spaces agree by
 * construction. Nodes come from the same articulate + groundBalance/groundVault solve the
 * flesh is built on (the spine warp's smooth deformation is NOT reproduced — rigid parts
 * approximate it; see rig-bake.js).
 */
export function figureRigSamples(manifest = {}, keys = 8) {
  const setup = resolveSetup(manifest);
  const { CAM } = makeCamera(manifest.view);
  const move = motionFn(manifest.motion || 'walk', keys);
  const restPose = manifest.pose || {};
  const restStacks = recolorFlesh(buildPosedFigure(restPose, manifest.proto, manifest.garment, manifest.fluffs, manifest.hold, manifest.hair, manifest.proportions, manifest.fluffQuality, manifest.weld), setup.fleshHex);
  const groundZ = stackMinZ(restStacks);
  const V = worldVertex(restStacks, groundZ);
  const restFaces = litFaces(restStacks, CAM, setup.light, groundZ, { cull: false })
    .map((f) => ({ corners: f.wpts, fill: f.fill }));
  // armature nodes (STAND units) → the same world space: scale up to stack units, then the
  // shared worldVertex transform.
  const mapNodes = (nodes) => Object.fromEntries(Object.entries(nodes).map(([k, n]) => {
    const [x, y, z] = V({ x: n.x * PROTO_SCALE, y: n.y * PROTO_SCALE, z: n.z * PROTO_SCALE });
    return [k, { x, y, z }];
  }));
  const solve = (pose) => {
    const { support = 'both', weight = 0, crouch = 0, kneeOut = 0, plant = null } = pose || {};
    const full = articulate(pose);
    if (support === 'none') return full;                     // airborne: pure FK
    const feet = support === 'L' ? ['L'] : support === 'R' ? ['R'] : ['L', 'R'];
    return plant ? groundVault(full, { plant }) : groundBalance(full, { feet, weight, crouch, kneeOut });
  };
  const restNodes = mapNodes(solve(restPose));
  const nodeFrames = Array.from({ length: keys }, (_, i) =>
    mapNodes(solve({ ...restPose, ...(move ? move(i / keys) : {}) })));
  return { restFaces, restNodes, nodeFrames };
}

export function renderFigureWorldFrames(manifest = {}, frames = 30) {
  const setup = resolveSetup(manifest);
  const { CAM } = makeCamera(manifest.view);
  const move = motionFn(manifest.motion, frames);
  const poses = move
    ? Array.from({ length: frames }, (_, i) => ({ ...(manifest.pose || {}), ...move(i / frames) }))
    : [manifest.pose || {}];
  // Pass 1: build every frame; share the lowest ground contact across the motion.
  const built = poses.map((pose) => recolorFlesh(buildPosedFigure(pose, manifest.proto, manifest.garment, manifest.fluffs, manifest.hold, manifest.hair, manifest.proportions, manifest.fluffQuality, manifest.weld), setup.fleshHex));
  let groundZ = Infinity;
  for (const stacks of built) { const mz = stackMinZ(stacks); if (mz < groundZ) groundZ = mz; }
  // Pass 2: mesh each frame to world faces — no projection, no cull → orbitable.
  const frameList = built.map((stacks) => ({
    faces: litFaces(stacks, CAM, setup.light, groundZ, { cull: false })
      .map((f) => ({ corners: f.wpts, fill: f.fill })),
  }));
  return { frames: frameList, title: manifest.title || 'figure', bg: setup.bg === 'none' ? '#0e1014' : setup.bg };
}
