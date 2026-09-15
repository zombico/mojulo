/**
 * workbench — a measured OBJECT vantage (the polygomer's turntable).
 *
 * The object-scale, measured sibling to the environment world-kinds (fractal-city,
 * transportation-hub). Where those drop you INTO a traversable world at abstract scale, the
 * workbench puts a single everyday object in front of you on a measured grid — neutral studio
 * light, literal real-world units, form accuracy over mood. It renders a POLYGOMER (a bonded set
 * of monomer primitives — today `lathe`s) baked into the engine-agnostic World face list via
 * `latheToFaces`, then funnelled through the SAME `assembleBoxCityScene` seam every box-world rides
 * so it serves both /scene (CSS-3D preset shots) and /world (traversable three.js orbit).
 *
 * Fractal-generation philosophy: the manifest IS the recipe (a handful of monomer specs, no baked
 * geometry); the object is regenerated deterministically on render.
 *
 * Stored manifest (the recipe):
 *   { kind:'workbench', lathes:[…], extrudes:[…], sweeps:[…], reliefs:[…], units?, viewBox?, title? }
 * Monomers (any combination; bonds are literal placements — the workbench has no walker):
 *   <lathe>   revolution: { axisFrom, axisTo, profile:[{t,radius}], tint?, harmonics?, … }
 *   <extrude> prism/shell: { profile:{rect|points}, axisFrom, axisTo, wallThickness?, openFace?, tint? }
 *   <sweep>   bent tube:   { path:[[x,y,z]…], radius, sides?, tint?, caps? }
 *   <relief>  raised emboss: { shape:{path|text}, size, anchor, normal?, up?, style?, tint? }
 * All carry resolved coordinates.
 *
 * Design: control/lib/graph/workbench.plan.md  ·  Geometry: polygonizer/lathe-faces.js.
 */

import { assembleBoxCityScene, emitPreserve3dScene } from '../scene/scene-css3d.js';
import { latheToFaces } from '../polygonizer/lathe-faces.js';
import { validateLathes } from '../polygonizer/lathe.js';
import { extrudeToFaces, validateExtrudes } from '../polygonizer/extrude-faces.js';
import { sweepToFaces, validateSweeps } from '../polygonizer/sweep-faces.js';
import { drapeToFaces, validateDrapes } from '../polygonizer/drape-faces.js';
import { reliefToFaces, validateReliefs } from '../polygonizer/relief-faces.js';
import { shellToFaces, validateShells } from '../polygonizer/shell-faces.js';
import { loftToFaces, validateLofts } from '../polygonizer/loft-faces.js';
import { fieldToFaces, validateFields, fieldGrid } from '../polygonizer/field-faces.js';
import { lowerCuts, validateCuts } from '../polygonizer/workbench-cuts.js';
import { expandWorkbenchProgram, hasProgram, MONOMER_KEYS } from './workbench-program.js';
import { makeLight } from '../polygonizer/vexar.js';
import { validateMaterialRef } from '../polygonizer/materials.js';
import { auditClosure } from '../polygonizer/face-closure.js';
import { rasterSampler, analyzeSkin, bakeSkinOntoFaces } from '../polygonizer/skin-projection.js';
import { scaffoldViewBox } from '../polygonizer/faces-scaffold-svg.js';

// Neutral studio key (z is UP in this World) — a clean form light, not a mood scene. Shared by the
// baked faces and the scene so object, grid, and ground all agree. Mirrors the proven 0616 spike.
const WORKBENCH_LIGHT = makeLight({ direction: [0.4, -0.5, 0.74], ambient: 0.5, diffuse: 0.56, fill: { diffuse: 0.34 } });

const GRID_STEP = 5;        // measured-grid spacing, in the manifest's `units` (informational today)
const DEFAULT_UNITS = 'cm';

// Point-shape tolerance (launch-falls-short.plan.md P2). The manuals write a lathe axis as
// `{x,y,z}` and a sweep path as `[[x,y,z]…]`, and a first-session agent mixes them — the two
// refusals a cold mug run paid (2026-09-09). Canonicalize before validation and before every
// lowering, copying ONLY what changes: a recipe already in canonical shape keeps its object
// identity, so nothing minted before this renders a byte differently.
const isObjPt = (p) => p && typeof p === 'object' && !Array.isArray(p) && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
const isArrPt = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const toArrPt = (p) => (isObjPt(p) ? [p.x, p.y, p.z] : p);
const toObjPt = (p) => (isArrPt(p) ? { x: p[0], y: p[1], z: p[2] } : p);
function canonicalizeMonomers(manifest) {
  if (!manifest || typeof manifest !== 'object') return manifest;
  let out = manifest;
  const set = (k, v) => { if (out === manifest) out = { ...manifest }; out[k] = v; };
  if (Array.isArray(manifest.sweeps)) {
    let changed = false;
    const sweeps = manifest.sweeps.map((sp) => {
      if (!sp || !Array.isArray(sp.path) || !sp.path.some(isObjPt)) return sp;
      changed = true;
      return { ...sp, path: sp.path.map(toArrPt) };
    });
    if (changed) set('sweeps', sweeps);
  }
  for (const k of ['lathes', 'extrudes']) {
    if (!Array.isArray(manifest[k])) continue;
    let changed = false;
    const rows = manifest[k].map((sp) => {
      if (!sp || typeof sp !== 'object' || !(isArrPt(sp.axisFrom) || isArrPt(sp.axisTo))) return sp;
      changed = true;
      return { ...sp, axisFrom: toObjPt(sp.axisFrom), axisTo: toObjPt(sp.axisTo) };
    });
    if (changed) set(k, rows);
  }
  return out;
}
export { canonicalizeMonomers };

const latheTint = (spec) => spec.tint || (spec.style && spec.style.fill) || undefined;

// A wrapped monomer's stable texture key (by index) — shared by face tagging and source resolution.
// Lathes key `wrap_<i>`; extrudes (the carton print, soda-product-shot 2026-09-08) key `xwrap_<i>`.
const wrapKey = (i) => `wrap_${i}`;
const xwrapKey = (i) => `xwrap_${i}`;
const wrapKeyed = (spec, i, keyOf = wrapKey) => (spec && spec.wrap && typeof spec.wrap === 'object'
  ? { ...spec, wrap: { ...spec.wrap, texture: spec.wrap.texture || keyOf(i) } }
  : spec);

/** Lower a polygomer manifest (lathe + extrude + sweep + loft + field + drape + relief + shell monomers) into one baked World face list. */
export function lowerObjectFaces(manifest, light) {
  // A `program` (the code kind, expressiveness.plan.md E3) expands to monomers and/or a face
  // list first; absent one, `manifest` passes through untouched.
  if (hasProgram(manifest)) {
    const ex = expandWorkbenchProgram(manifest, { light });
    return [...lowerObjectFaces(ex.manifest, light), ...ex.faces];
  }
  // `cuts` (parts-booleans.plan.md B1): the named monomers leave their arrays and come back as
  // one `fields` entry per cut. Absent cuts, `manifest` passes through by identity.
  manifest = lowerCuts(canonicalizeMonomers(manifest));
  const lathes = Array.isArray(manifest.lathes) ? manifest.lathes : [];
  const extrudes = Array.isArray(manifest.extrudes) ? manifest.extrudes : [];
  const sweeps = Array.isArray(manifest.sweeps) ? manifest.sweeps : [];
  const drapes = Array.isArray(manifest.drapes) ? manifest.drapes : [];
  const reliefs = Array.isArray(manifest.reliefs) ? manifest.reliefs : [];
  const shells = Array.isArray(manifest.shells) ? manifest.shells : [];
  const lofts = Array.isArray(manifest.lofts) ? manifest.lofts : [];
  const fields = Array.isArray(manifest.fields) ? manifest.fields : [];
  // Per-monomer `material` (polygonizer/materials.js): a named finish on the spec rides into the
  // generator — response curve baked into the fills, plus `spec`/`pbr` face tags for the World's
  // live highlight and the .glb PBR export. Absent → byte-identical (material-response.plan.md P4).
  // A monomer's `group` names the RENDER GROUP its faces join (the World meshes each group on its own, so
  // a mover / deform channel can move it — a hinged lid). Fields and shells tag their own groups; the
  // sweep monomers below take the spec's. Absent `group` → faces untouched, byte-identical.
  const grouped = (faces, spec) => (typeof spec.group === 'string' && spec.group ? faces.map((f) => (f.group ? f : { ...f, group: spec.group })) : faces);
  return [
    ...lathes.flatMap((spec, i) => grouped(latheToFaces(wrapKeyed(spec, i), { light, tint: latheTint(spec), material: spec.material, caps: spec.caps }), spec)),
    ...extrudes.flatMap((spec, i) => grouped(extrudeToFaces(wrapKeyed(spec, i, xwrapKey), { light, material: spec.material }), spec)),
    ...sweeps.flatMap((spec) => grouped(sweepToFaces(spec, { light, material: spec.material }), spec)),
    ...lofts.flatMap((spec) => grouped(loftToFaces(spec, { light, material: spec.material }), spec)),
    // field solids (field-solids.plan.md F3): one closed surface-net shell per entry, cuts included
    ...fields.flatMap((spec) => fieldToFaces(spec, { light, material: spec.material })),
    ...drapes.flatMap((spec) => grouped(drapeToFaces(spec, { light, material: spec.material }), spec)),
    ...reliefs.flatMap((spec) => grouped(reliefToFaces(spec, { light, material: spec.material }), spec)),
    // `index` seeds the shell's stable per-face id (`<index>:<n>`), so a recipe can name a face.
    ...shells.flatMap((spec, i) => shellToFaces(spec, { light, material: spec.material, index: i })),
  ];
}

/**
 * WORLD-ASSET BRIDGE — lower a workbench polygomer into baked faces ready to drop into ANY world
 * scene's `faces` channel (fractal-city / transport-hub / room — they all consume the same
 * `{ corners, fill, doubleSided }` shape via assembleBoxCityScene). This is what makes the
 * workbench reachable for *building world assets* (props, fixtures, monuments) — the second
 * sensibility: author at convenient units, then `scale` to the world's MERU units and `translate`
 * to a placement point, and push the result into `extraFaces`.
 *
 * @param {object} manifest  a workbench polygomer ({ lathes?, extrudes?, sweeps? }).
 * @param {object} opts  { translate:[x,y,z]=origin, scale:1 (uniform; cm→meru), light }.
 * @returns {Array} faces — vertex-color form only (labels/wraps are a package-design concern, not
 *   world-asset; keep world props flat-shaded + readable). Use `light` to match the host scene's key.
 */
export function workbenchAssetFaces(manifest = {}, opts = {}) {
  const light = opts.light || WORKBENCH_LIGHT;
  const s = Number.isFinite(opts.scale) ? opts.scale : 1;
  const t = Array.isArray(opts.translate) ? opts.translate : [0, 0, 0];
  const faces = lowerObjectFaces(manifest, light);
  if (s === 1 && t[0] === 0 && t[1] === 0 && t[2] === 0) return faces;
  return faces.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x * s + t[0], y * s + t[1], z * s + t[2]]) }));
}

/**
 * Label-wrap sources to resolve for a manifest → [{ key, source }]. A `lathe.wrap.source` (a can)
 * or an `extrude.wrap.source` (a carton) is a label image reference (an inline `svg`, a `dataUrl`,
 * a `sketchRef`, or an `outcomeRef`); the caller (the /world route — the DB-aware layer) resolves
 * each to a data-URL `textures` map and passes it back into assembleWorkbenchScene. Keeping the
 * heavy image OUT of the manifest preserves the tiny recipe.
 */
export function collectWrapSources(manifest) {
  if (hasProgram(manifest)) manifest = expandWorkbenchProgram(manifest).manifest;
  // the same lowering lowerObjectFaces applies, so wrap keys (by index) agree on both sides
  manifest = lowerCuts(manifest);
  const lathes = Array.isArray(manifest && manifest.lathes) ? manifest.lathes : [];
  const extrudes = Array.isArray(manifest && manifest.extrudes) ? manifest.extrudes : [];
  const out = [];
  lathes.forEach((spec, i) => {
    if (spec && spec.wrap && typeof spec.wrap === 'object' && spec.wrap.source) {
      out.push({ key: spec.wrap.texture || wrapKey(i), source: spec.wrap.source });
    }
  });
  extrudes.forEach((spec, i) => {
    if (spec && spec.wrap && typeof spec.wrap === 'object' && spec.wrap.source) {
      out.push({ key: spec.wrap.texture || xwrapKey(i), source: spec.wrap.source });
    }
  });
  return out;
}

/** A single-monomer manifest (for baking / measuring / auditing ONE part in isolation). */
function monomerManifest(kind, spec) {
  return kind === 'lathe' ? { lathes: [spec] }
    : kind === 'extrude' ? { extrudes: [spec] }
      : kind === 'relief' ? { reliefs: [spec] }
        : kind === 'drape' ? { drapes: [spec] }
          : kind === 'shell' ? { shells: [spec] }
            : kind === 'loft' ? { lofts: [spec] }
              : kind === 'field' ? { fields: [spec] }
                : { sweeps: [spec] };
}

/** Bake ONE monomer alone → its baked face list. */
function monomerFaceList(kind, spec, light) {
  return lowerObjectFaces(monomerManifest(kind, spec), light);
}

/** Bake ONE monomer alone → its axis-aligned bounds (for the per-part size/placement readout). */
function monomerBounds(kind, spec, light) {
  return boundsOf(monomerFaceList(kind, spec, light));
}

// Does this monomer INTEND to be a closed solid? A surface modeler ships a hole whenever a shell is
// left open — but some openings are deliberate (an extrude `openFace` recess, a sweep with embedded
// ends, a drape cloth sheet). We only lint the intent-closed monomers, so the warning stays
// high-signal: an open one of THESE is a dropped cap, not a design choice.
function monomerIntendsClosed(kind, spec) {
  if (kind === 'drape') return false;                       // a cloth sheet is open by nature
  if (kind === 'sweep') return spec && spec.caps === false ? false : true; // caps:false = embedded ends
  if (kind === 'loft') return spec && spec.caps === false ? false : true;  // same rule as sweep
  if (kind === 'extrude') {
    const shell = spec && Number.isFinite(spec.wallThickness) && spec.wallThickness > 0;
    return shell ? spec.openFace === 'none' : true;         // a recessed shell is open unless openFace:'none'
  }
  if (kind === 'lathe') return spec && spec.caps === false ? false : true;
  if (kind === 'shell') return !(spec && spec.open !== undefined); // `open` cuts a dome/cutaway on purpose
  return true;                                              // relief: always meant to be closed
}

/** Axis-aligned bounds of a baked face list → { min, max, center, radius }, or null if empty. */
function boundsOf(faces) {
  if (!faces.length) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) {
    for (const c of f.corners) {
      for (let i = 0; i < 3; i += 1) {
        if (c[i] < min[i]) min[i] = c[i];
        if (c[i] > max[i]) max[i] = c[i];
      }
    }
  }
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 || 1;
  return { min, max, center, radius };
}

// A measured floor: a base plane + a grid of thin flat quads on the object's base (z = min.z),
// graduated in `units`. The grid is the workbench's scale cue — it makes the literal size legible.
function measuredFloor(bounds, step = GRID_STEP) {
  // Drop the grid a hair below the object's lowest point so downward-hanging detail
  // (e.g. a "fist down" whose fingers point at the floor) reads with clearance instead of
  // z-fighting / sitting flush on the grid. Small + proportional so scale still reads true.
  const clearance = Math.max(0.12, (bounds.max[2] - bounds.min[2]) * 0.04);
  const z = bounds.min[2] - clearance;
  const halfX = Math.max(step * 2, (bounds.max[0] - bounds.min[0]) / 2 + step * 1.5);
  const halfY = Math.max(step * 2, (bounds.max[1] - bounds.min[1]) / 2 + step * 1.5);
  const cx = bounds.center[0];
  const cy = bounds.center[1];
  const nx = Math.ceil(halfX / step) * step;
  const ny = Math.ceil(halfY / step) * step;
  // `studio: true` marks floor + grid as studio furniture — the scale cue for
  // /world and the GLB, filtered OUT of the STL print handoff (scene-stl.js):
  // zero-thickness grid quads riding into a slicer would be repair poison.
  const grounds = [{ x: cx - nx, y: cy - ny, w: nx * 2, d: ny * 2, z, fill: '#20262e', studio: true }];
  const faces = [];
  const lw = Math.max(0.06, step * 0.02); // line half-width
  const lift = z + Math.max(0.02, step * 0.006);
  const line = (corners, major) => faces.push({ corners, fill: major ? '#4a6a52' : '#33414c', doubleSided: true, studio: true });
  for (let gx = -nx; gx <= nx + 1e-6; gx += step) {
    line([[cx + gx - lw, cy - ny, lift], [cx + gx + lw, cy - ny, lift], [cx + gx + lw, cy + ny, lift], [cx + gx - lw, cy + ny, lift]], Math.abs(gx) < 1e-6);
  }
  for (let gy = -ny; gy <= ny + 1e-6; gy += step) {
    line([[cx - nx, cy + gy - lw, lift], [cx + nx, cy + gy - lw, lift], [cx + nx, cy + gy + lw, lift], [cx - nx, cy + gy + lw, lift]], Math.abs(gy) < 1e-6);
  }
  return { grounds, faces };
}

// The studio's shot names assume the model's face points +y (the 'front' camera sits at +y
// looking back). A manifest may declare which way it was actually authored via `facing`:
// '+y' (default) | '-y' | '+x' | '-x', or a raw azimuth offset in degrees — the whole
// turntable rotates so 'front' stays honest. Camera-only: geometry is untouched.
export function facingYaw(facing) {
  if (Number.isFinite(facing)) return facing;
  return { '+y': 0, '-y': 180, '+x': -90, '-x': 90 }[facing] ?? 0;
}

// Preset turntable shots framed to the object's bounds (free orbit is added by /world regardless;
// these are the HUD buttons + the camera the /scene + PNG stills use).
function turntableCameras(bounds, yaw = 0) {
  const t = [bounds.center[0], bounds.center[1], bounds.center[2]];
  const r = bounds.radius * 3.0;
  const h = bounds.center[2] + bounds.radius * 0.9;
  const shot = (name, deg, fov = 38) => {
    const a = ((deg + yaw) / 180) * Math.PI;
    return { name, worldFraming: { cameraPosition: [t[0] + r * Math.cos(a), t[1] + r * Math.sin(a), h], lookAt: t, horizontalFov: fov } };
  };
  return [
    shot('front', 90), shot('three-quarter', 45), shot('side', 0), shot('back', 270),
    { name: 'top', worldFraming: { cameraPosition: [t[0], t[1] - 0.01, t[2] + r * 1.05], lookAt: t, horizontalFov: 44 } },
  ];
}

/**
 * Wrap a PRE-BAKED World face list in the measured studio vantage (measured floor grid framed to
 * the faces' bounds + preset turntable cameras + neutral framing), then funnel it through the shared
 * assembleBoxCityScene seam. This is the studio scene for ANY baked face list — not just lowered
 * monomers: a meta-fabricator family instance (a sampled vehicle), a world asset, any
 * `{ corners, fill, doubleSided }` faces — so it can be verified on the same measured grid the
 * workbench gives an authored polygomer. The faces carry their own baked shading; WORKBENCH_LIGHT
 * lights the grid/ground.
 */
// CSS-3D panels are flat tiles; on a tessellated body adjacent tiles leave hairline seams. Grow
// each studio panel slightly so neighbours overlap and the seams close (the three.js /world ignores
// it — a depth-buffered mesh has no gaps). Carried on the payload → emitPreserve3dScene reads it.
const STUDIO_PANEL_INFLATE = 1.05;

export function studioSceneFromFaces(objectFaces = [], opts = {}) {
  const bounds = boundsOf(objectFaces) || { min: [-5, -5, 0], max: [5, 5, 5], center: [0, 0, 2.5], radius: 7 };
  // `grid: false` drops the measured floor + grid (a bare studio for a product shot); default keeps the scale cue.
  const floor = opts.grid === false ? { faces: [], grounds: [] } : measuredFloor(bounds);
  const viewBox = opts.viewBox && typeof opts.viewBox === 'object' ? opts.viewBox : { width: 900, height: 900 };
  const payload = assembleBoxCityScene({
    faces: [...objectFaces, ...floor.faces],
    grounds: floor.grounds,
    cameras: turntableCameras(bounds, facingYaw(opts.facing)),
    viewBox,
    title: opts.title || 'mojulo workbench',
    bg: '#0d1218',
    // studio light for the grid/ground (the object faces carry their own baked shading).
    // `opts.light` is FLAT_LIGHT under unshaded export; absent → WORKBENCH_LIGHT (byte-identical).
    light: opts.light || WORKBENCH_LIGHT,
  });
  payload.inflate = Number.isFinite(opts.inflate) ? opts.inflate : STUDIO_PANEL_INFLATE;
  // `movers` (the World's mover channel, e.g. a `turn` hinge on a named group) ride the payload as authored.
  if (Array.isArray(opts.movers) && opts.movers.length) payload.movers = opts.movers;
  // label-wrap textures (key → data-URL), pre-resolved by the caller; emitThreeWorld reads them.
  return opts.textures && typeof opts.textures === 'object' ? { ...payload, textures: opts.textures } : payload;
}

/**
 * Bake a bound painted skin (skin_polygomer's stored INPUT raster) onto a
 * workbench/assembler face list: each face samples the skin at its centroid
 * projected through the SAME camera the ?control=1 faces-scaffold used —
 * `scaffoldViewBox` reproduces that scaffold's viewBox exactly, so painter and
 * bake stay registered. No skin (or no faces) → faces unchanged.
 */
export function bakeBoundSkinFaces(faces, skin, manifest = {}, light = WORKBENCH_LIGHT) {
  if (!skin || !faces.length) return faces;
  const camera = manifest.camera || {};
  const roomBasis = manifest.roomBasis || {};
  const viewBox = scaffoldViewBox(faces, { camera, roomBasis });
  const { background, fallback } = analyzeSkin(skin);
  const sampler = rasterSampler({ ...skin, background, fallback });
  // `light` defaults to WORKBENCH_LIGHT (byte-identical); FLAT_LIGHT under unshaded export.
  return bakeSkinOntoFaces(faces, { sampler, viewBox, camera, roomBasis, light });
}

/**
 * Assemble a workbench manifest into the shared scene payload (faces + grounds + cameras + light),
 * consumed by BOTH emitPreserve3dScene (/scene) and emitThreeWorld (/world). The seam every
 * box-world rides — mirrors assembleFractalCityScene. When `opts.skin` is a bound
 * painted raster (the world route loads it), the faces wear it.
 */
export function assembleWorkbenchScene(opts = {}) {
  // `opts.light` is FLAT_LIGHT under unshaded export (world-scene ctx.light); absent → the
  // neutral studio key, so the shaded path is byte-identical. Threaded through the object bake
  // AND the skin re-bake so a flat-albedo export carries no directional term.
  const light = opts.light || WORKBENCH_LIGHT;
  return studioSceneFromFaces(bakeBoundSkinFaces(lowerObjectFaces(opts, light), opts.skin, opts, light), opts);
}

/** /scene + PNG path: CSS-3D preset-shot HTML. (The /world route calls assembleWorkbenchScene → emitThreeWorld.) */
export function renderWorkbenchToHtml(opts = {}) {
  return emitPreserve3dScene({ ...assembleWorkbenchScene(opts), signs: opts.signs });
}

/**
 * Validate the polygomer recipe + return a stat readout (no geometry persisted). Called by the
 * mint tool so a bad monomer surfaces as a clear 400, and the operator gets a size/face readout.
 */
/**
 * persistedLedger(ledger) → the DETERMINISTIC subset of planWorkbench's ledger that is stored on
 * the manifest as `ledger` at mint and on every update_sketch edit (continuous-guardrails G6):
 * recipe bytes, faces, per-monomer closure. Timings (wall_ms, program_ms) stay OUT — a stored
 * manifest hashes into the export README's provenance line, and "same recipe, same bytes" must
 * hold across two mints of the same recipe.
 */
export function persistedLedger(ledger) {
  if (!ledger) return undefined;
  return { recipe_bytes: ledger.recipe_bytes, faces: ledger.faces, closed: ledger.closed };
}

export function planWorkbench(manifest = {}) {
  const t0 = performance.now();
  // the mint LEDGER (expressiveness.plan.md E5): what the recipe cost to say vs what it made —
  // recipe bytes (the honest proxy for the tokens the agent had to write), kernel wall-clock,
  // faces, closure. "Structure carried, not re-derived" is a number here, not a claim.
  // G6 (continuous-guardrails.plan.md): the persisted ledger rides the manifest as `ledger`;
  // measure the RECIPE, not the ledger's own bytes.
  const { ledger: _priorLedger, ...recipeOnly } = manifest;
  const recipeBytes = Buffer.byteLength(JSON.stringify(recipeOnly), 'utf8');
  // The code kind: run the program ONCE here (memoised for the renders that follow). A
  // program that throws fails the mint with its error and its captured log — that is the
  // loop working. Its generated monomers then pay every gate below like hand-written ones.
  let programReport = null;
  let programFaces = [];
  if (hasProgram(manifest)) {
    const ex = expandWorkbenchProgram(manifest, { light: WORKBENCH_LIGHT });
    programReport = ex.program;
    programFaces = ex.faces;
    manifest = ex.manifest;
    if (!programFaces.length && !MONOMER_KEYS.some((k) => Array.isArray(manifest[k]) && manifest[k].length)) {
      throw new Error('The program returned no monomers and no faces.');
    }
  }
  const arraysOf = (m) => ({
    lathes: Array.isArray(m.lathes) ? m.lathes : [],
    extrudes: Array.isArray(m.extrudes) ? m.extrudes : [],
    sweeps: Array.isArray(m.sweeps) ? m.sweeps : [],
    drapes: Array.isArray(m.drapes) ? m.drapes : [],
    reliefs: Array.isArray(m.reliefs) ? m.reliefs : [],
    shells: Array.isArray(m.shells) ? m.shells : [],
    lofts: Array.isArray(m.lofts) ? m.lofts : [],
    fields: Array.isArray(m.fields) ? m.fields : [],
  });
  // The monomers as AUTHORED are what the validators read, so a bad lathe surfaces as a lathe
  // error, not as its field twin's; the readout below is over the CUT-LOWERED arrays, because
  // a flange with holes IS one part now (parts-booleans.plan.md B1).
  manifest = canonicalizeMonomers(manifest);
  const src = arraysOf(manifest);
  if (!src.lathes.length && !src.extrudes.length && !src.sweeps.length && !src.drapes.length && !src.reliefs.length && !src.shells.length && !src.lofts.length && !src.fields.length && !programFaces.length) {
    throw new Error('A workbench needs at least one monomer — a non-empty `lathes`, `extrudes`, `sweeps`, `lofts`, `fields`, `drapes`, `reliefs`, and/or `shells` array (or a `program` that returns them).');
  }
  const errors = [...validateLathes(src.lathes, []), ...validateExtrudes(src.extrudes, []), ...validateSweeps(src.sweeps, []), ...validateLofts(src.lofts, []), ...validateFields(src.fields, []), ...validateDrapes(src.drapes, []), ...validateReliefs(src.reliefs, []), ...validateShells(src.shells, [])]; // endpoints are literal {x,y,z}
  // material refs fail LOUDLY at mint (resolveMaterial's fallback would silently steel a typo)
  for (const k of ['lathes', 'extrudes', 'sweeps', 'lofts', 'fields', 'drapes', 'reliefs', 'shells']) {
    src[k].forEach((s, i) => { const e = validateMaterialRef(s && s.material); if (e) errors.push(`${k}[${i}].material: ${e}`); });
  }
  if (manifest.cuts !== undefined) errors.push(...validateCuts(manifest));
  if (errors.length) {
    throw new Error(`Invalid monomers:\n- ${errors.join('\n- ')}`);
  }
  const lowered = lowerCuts(manifest);
  const { lathes, extrudes, sweeps, drapes, reliefs, shells, lofts, fields } = arraysOf(lowered);
  const faces = [...lowerObjectFaces(lowered, WORKBENCH_LIGHT), ...programFaces];
  const bounds = boundsOf(faces);
  const units = typeof manifest.units === 'string' ? manifest.units : DEFAULT_UNITS;
  const round1 = (n) => Math.round(n * 10) / 10;
  const size = bounds
    ? { w: round1(bounds.max[0] - bounds.min[0]), d: round1(bounds.max[1] - bounds.min[1]), h: round1(bounds.max[2] - bounds.min[2]) }
    : null;

  // Closure lint — the surface modeler ships a silent hole whenever an intent-closed monomer's shell
  // is left open (a dropped cap: a constant-radius lathe → hollow tube, a sub-threshold end, a bad
  // profile winding). Catch it here from the geometry so "3D-prints with no surface" is a loud,
  // sized warning at mint, not something the operator finds in a render from the wrong angle.
  const openHints = {
    lathe: 'A constant-radius profile makes a hollow tube; taper an end to radius→0 for a rounded cap, or keep the end radius above ~0.08 so it gets a flat cap.',
    extrude: 'A solid prism should close on both ends — check the profile winding; if you meant a recessed tray/case, set `wallThickness` + `openFace` so the opening is intentional.',
    sweep: 'Ends are open — keep `caps:true` (default) unless both ends embed inside another monomer.',
    loft: 'A loft should close at both stations — keep `caps:true` (default) unless the ends embed in another monomer; a zero-area end station drops its cap on purpose.',
    field: 'A field solid is closed BY CONSTRUCTION — an open rim here is a polygonizer bug (the grid clipped the surface), not a recipe choice; please report the recipe.',
    relief: 'The raised outline did not close — check the glyph/path tessellation (an unclosed contour or self-intersection).',
    shell: 'A closed polyhedron should have no holes — if you meant a dome or a cutaway, set `open` so the opening is intentional.',
  };
  const closureWarnings = [];

  // Per-monomer readout — the model's eyes on each part's size + where it sits on the z stack,
  // so gaps/overlaps are legible from the numbers before spending a render→view loop.
  const part = (kind, spec, index) => {
    const monoFaces = monomerFaceList(kind, spec, WORKBENCH_LIGHT);
    const b = boundsOf(monoFaces);
    if (!b) return null;
    const closure = auditClosure(monoFaces, { intendClosed: monomerIntendsClosed(kind, spec) });
    const out = {
      kind, index,
      size: { w: round1(b.max[0] - b.min[0]), d: round1(b.max[1] - b.min[1]), h: round1(b.max[2] - b.min[2]) },
      base: round1(b.min[2]), top: round1(b.max[2]),
    };
    // a cut's emitted field reads out as the ONE part it is, with its provenance
    if (kind === 'field' && spec && spec.cut) { out.cut = spec.cut.id; out.from = spec.cut.from; }
    if (!closure.closed) {
      const widest = round1(closure.holes[0].diameter);
      out.open = { holes: closure.holes.length, widest };
      closureWarnings.push(
        `${kind}[${index}] is an open shell — ${closure.holes.length} hole${closure.holes.length === 1 ? '' : 's'}, widest ≈${widest} ${units} across; you'll see straight through it. ${openHints[kind]}`,
      );
    }
    return out;
  };
  const parts = [
    ...lathes.map((s, i) => part('lathe', s, i)),
    ...extrudes.map((s, i) => part('extrude', s, i)),
    ...sweeps.map((s, i) => part('sweep', s, i)),
    ...lofts.map((s, i) => part('loft', s, i)),
    ...fields.map((s, i) => part('field', s, i)),
    ...drapes.map((s, i) => part('drape', s, i)),
    ...reliefs.map((s, i) => part('relief', s, i)),
    ...shells.map((s, i) => part('shell', s, i)),
  ].filter(Boolean);
  // A program's FACE-LIST return is one more part: the closure audit reports (advisory —
  // the program may have meant an open sheet), never gates.
  if (programFaces.length) {
    const b = boundsOf(programFaces);
    const closure = auditClosure(programFaces, { intendClosed: true });
    const out = { kind: 'program', index: 0, size: { w: round1(b.max[0] - b.min[0]), d: round1(b.max[1] - b.min[1]), h: round1(b.max[2] - b.min[2]) }, base: round1(b.min[2]), top: round1(b.max[2]), faces: programFaces.length };
    if (!closure.closed) {
      out.open = { holes: closure.holes.length, widest: round1(closure.holes[0].diameter) };
      closureWarnings.push(`program faces form an open shell — ${closure.holes.length} hole${closure.holes.length === 1 ? '' : 's'}, widest ≈${round1(closure.holes[0].diameter)} ${units} across. If the sheet is meant to be open that is fine; for a printable solid, return closed shells (or a spec the kernel closes for you).`);
    }
    parts.push(out);
  }

  // Grid-alignment lint — unambiguous, high-signal checks the measured vantage cares about.
  const warnings = [...closureWarnings];
  if (bounds) {
    const tol = Math.max(0.2, (bounds.max[2] - bounds.min[2]) * 0.02);
    if (bounds.min[2] > tol) {
      warnings.push(`Object floats ${round1(bounds.min[2])} ${units} above the grid (lowest point z=${round1(bounds.min[2])}). Drop the base monomer so its lowest z = 0 to seat it on the measured floor.`);
    } else if (bounds.min[2] < -tol) {
      warnings.push(`Object sinks ${round1(-bounds.min[2])} ${units} below the grid (lowest point z=${round1(bounds.min[2])}). Raise the base monomer so its lowest z = 0.`);
    }
  }
  // parts-booleans B1: each cut's readout — what it consumed and what the field grid rounds its
  // edges to, in units. An advisory (never a refusal): the ceiling is the field solid's.
  const round3 = (n) => Math.round(n * 1000) / 1000;
  const cuts = fields.filter((f) => f && f.cut).map((f) => ({ ...f.cut, edge_round: round3(fieldGrid(f).cell) }));
  for (const c of cuts) {
    const op = c.subtract ? `subtract ${c.subtract.join(', ')}` : `intersect ${c.intersect.join(', ')}`;
    warnings.push(`cut '${c.id}' (${c.from} ${op}) rounds every edge to about ${c.edge_round} ${units} (${c.cells} cells) — raise \`cells\` (≤128) for a finer edge; a sharp edge is export_model union:true or the DCC.`);
  }

  const ledger = {
    recipe_bytes: recipeBytes,
    wall_ms: Math.round(performance.now() - t0),
    faces: faces.length,
    closed: closureWarnings.length === 0,
    ...(programReport ? { program_ms: programReport.ms } : {}),
  };
  return { stats: { monomers: lathes.length + extrudes.length + sweeps.length + lofts.length + fields.length + drapes.length + reliefs.length + shells.length, lathes: lathes.length, extrudes: extrudes.length, sweeps: sweeps.length, ...(lofts.length ? { lofts: lofts.length } : {}), ...(fields.length ? { fields: fields.length } : {}), drapes: drapes.length, reliefs: reliefs.length, shells: shells.length, faces: faces.length, units, size, parts, ...(cuts.length ? { cuts } : {}), ...(programReport ? { program: programReport } : {}), ledger, ...(warnings.length ? { warnings } : {}) } };
}

export { WORKBENCH_LIGHT };
