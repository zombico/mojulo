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
import { reliefToFaces, validateReliefs } from '../polygonizer/relief-faces.js';
import { makeLight } from '../polygonizer/vexar.js';
import { validateMaterialRef } from '../polygonizer/materials.js';

// Neutral studio key (z is UP in this World) — a clean form light, not a mood scene. Shared by the
// baked faces and the scene so object, grid, and ground all agree. Mirrors the proven 0616 spike.
const WORKBENCH_LIGHT = makeLight({ direction: [0.4, -0.5, 0.74], ambient: 0.5, diffuse: 0.56 });

const GRID_STEP = 5;        // measured-grid spacing, in the manifest's `units` (informational today)
const DEFAULT_UNITS = 'cm';

const latheTint = (spec) => spec.tint || (spec.style && spec.style.fill) || undefined;

// A wrapped lathe's stable texture key (by index) — shared by face tagging and source resolution.
const wrapKey = (i) => `wrap_${i}`;
const wrapKeyed = (spec, i) => (spec && spec.wrap && typeof spec.wrap === 'object'
  ? { ...spec, wrap: { ...spec.wrap, texture: spec.wrap.texture || wrapKey(i) } }
  : spec);

/** Lower a polygomer manifest (lathe + extrude + sweep + relief monomers) into one baked World face list. */
export function lowerObjectFaces(manifest, light) {
  const lathes = Array.isArray(manifest.lathes) ? manifest.lathes : [];
  const extrudes = Array.isArray(manifest.extrudes) ? manifest.extrudes : [];
  const sweeps = Array.isArray(manifest.sweeps) ? manifest.sweeps : [];
  const reliefs = Array.isArray(manifest.reliefs) ? manifest.reliefs : [];
  // Per-monomer `material` (polygonizer/materials.js): a named finish on the spec rides into the
  // generator — response curve baked into the fills, plus `spec`/`pbr` face tags for the World's
  // live highlight and the .glb PBR export. Absent → byte-identical (material-response.plan.md P4).
  return [
    ...lathes.flatMap((spec, i) => latheToFaces(wrapKeyed(spec, i), { light, tint: latheTint(spec), material: spec.material })),
    ...extrudes.flatMap((spec) => extrudeToFaces(spec, { light, material: spec.material })),
    ...sweeps.flatMap((spec) => sweepToFaces(spec, { light, material: spec.material })),
    ...reliefs.flatMap((spec) => reliefToFaces(spec, { light, material: spec.material })),
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
 * Label-wrap sources to resolve for a manifest → [{ key, source }]. A `lathe.wrap.source` is a
 * label image reference (an inline `svg`, a `dataUrl`, or a `sketchRef`); the caller (the /world
 * route — the DB-aware layer) resolves each to a data-URL `textures` map and passes it back into
 * assembleWorkbenchScene. Keeping the heavy image OUT of the manifest preserves the tiny recipe.
 */
export function collectWrapSources(manifest) {
  const lathes = Array.isArray(manifest && manifest.lathes) ? manifest.lathes : [];
  const out = [];
  lathes.forEach((spec, i) => {
    if (spec && spec.wrap && typeof spec.wrap === 'object' && spec.wrap.source) {
      out.push({ key: spec.wrap.texture || wrapKey(i), source: spec.wrap.source });
    }
  });
  return out;
}

/** Bake ONE monomer alone → its axis-aligned bounds (for the per-part size/placement readout). */
function monomerBounds(kind, spec, light) {
  const m = kind === 'lathe' ? { lathes: [spec] }
    : kind === 'extrude' ? { extrudes: [spec] }
      : kind === 'relief' ? { reliefs: [spec] }
        : { sweeps: [spec] };
  return boundsOf(lowerObjectFaces(m, light));
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
  const z = bounds.min[2];
  const halfX = Math.max(step * 2, (bounds.max[0] - bounds.min[0]) / 2 + step * 1.5);
  const halfY = Math.max(step * 2, (bounds.max[1] - bounds.min[1]) / 2 + step * 1.5);
  const cx = bounds.center[0];
  const cy = bounds.center[1];
  const nx = Math.ceil(halfX / step) * step;
  const ny = Math.ceil(halfY / step) * step;
  const grounds = [{ x: cx - nx, y: cy - ny, w: nx * 2, d: ny * 2, z, fill: '#20262e' }];
  const faces = [];
  const lw = Math.max(0.06, step * 0.02); // line half-width
  const lift = z + Math.max(0.02, step * 0.006);
  const line = (corners, major) => faces.push({ corners, fill: major ? '#4a6a52' : '#33414c', doubleSided: true });
  for (let gx = -nx; gx <= nx + 1e-6; gx += step) {
    line([[cx + gx - lw, cy - ny, lift], [cx + gx + lw, cy - ny, lift], [cx + gx + lw, cy + ny, lift], [cx + gx - lw, cy + ny, lift]], Math.abs(gx) < 1e-6);
  }
  for (let gy = -ny; gy <= ny + 1e-6; gy += step) {
    line([[cx - nx, cy + gy - lw, lift], [cx + nx, cy + gy - lw, lift], [cx + nx, cy + gy + lw, lift], [cx - nx, cy + gy + lw, lift]], Math.abs(gy) < 1e-6);
  }
  return { grounds, faces };
}

// Preset turntable shots framed to the object's bounds (free orbit is added by /world regardless;
// these are the HUD buttons + the camera the /scene + PNG stills use).
function turntableCameras(bounds) {
  const t = [bounds.center[0], bounds.center[1], bounds.center[2]];
  const r = bounds.radius * 3.0;
  const h = bounds.center[2] + bounds.radius * 0.9;
  const shot = (name, deg, fov = 38) => {
    const a = (deg / 180) * Math.PI;
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
  const floor = measuredFloor(bounds);
  const viewBox = opts.viewBox && typeof opts.viewBox === 'object' ? opts.viewBox : { width: 900, height: 900 };
  const payload = assembleBoxCityScene({
    faces: [...objectFaces, ...floor.faces],
    grounds: floor.grounds,
    cameras: turntableCameras(bounds),
    viewBox,
    title: opts.title || 'mojulo workbench',
    bg: '#0d1218',
    light: WORKBENCH_LIGHT,
  });
  payload.inflate = Number.isFinite(opts.inflate) ? opts.inflate : STUDIO_PANEL_INFLATE;
  // label-wrap textures (key → data-URL), pre-resolved by the caller; emitThreeWorld reads them.
  return opts.textures && typeof opts.textures === 'object' ? { ...payload, textures: opts.textures } : payload;
}

/**
 * Assemble a workbench manifest into the shared scene payload (faces + grounds + cameras + light),
 * consumed by BOTH emitPreserve3dScene (/scene) and emitThreeWorld (/world). The seam every
 * box-world rides — mirrors assembleFractalCityScene.
 */
export function assembleWorkbenchScene(opts = {}) {
  return studioSceneFromFaces(lowerObjectFaces(opts, WORKBENCH_LIGHT), opts);
}

/** /scene + PNG path: CSS-3D preset-shot HTML. (The /world route calls assembleWorkbenchScene → emitThreeWorld.) */
export function renderWorkbenchToHtml(opts = {}) {
  return emitPreserve3dScene({ ...assembleWorkbenchScene(opts), signs: opts.signs });
}

/**
 * Validate the polygomer recipe + return a stat readout (no geometry persisted). Called by the
 * mint tool so a bad monomer surfaces as a clear 400, and the operator gets a size/face readout.
 */
export function planWorkbench(manifest = {}) {
  const lathes = Array.isArray(manifest.lathes) ? manifest.lathes : [];
  const extrudes = Array.isArray(manifest.extrudes) ? manifest.extrudes : [];
  const sweeps = Array.isArray(manifest.sweeps) ? manifest.sweeps : [];
  const reliefs = Array.isArray(manifest.reliefs) ? manifest.reliefs : [];
  if (!lathes.length && !extrudes.length && !sweeps.length && !reliefs.length) {
    throw new Error('A workbench needs at least one monomer — a non-empty `lathes`, `extrudes`, `sweeps`, and/or `reliefs` array.');
  }
  const errors = [...validateLathes(lathes, []), ...validateExtrudes(extrudes, []), ...validateSweeps(sweeps, []), ...validateReliefs(reliefs, [])]; // endpoints are literal {x,y,z}
  // material refs fail LOUDLY at mint (resolveMaterial's fallback would silently steel a typo)
  for (const [k, arr] of [['lathes', lathes], ['extrudes', extrudes], ['sweeps', sweeps], ['reliefs', reliefs]]) {
    arr.forEach((s, i) => { const e = validateMaterialRef(s && s.material); if (e) errors.push(`${k}[${i}].material: ${e}`); });
  }
  if (errors.length) {
    throw new Error(`Invalid monomers:\n- ${errors.join('\n- ')}`);
  }
  const faces = lowerObjectFaces(manifest, WORKBENCH_LIGHT);
  const bounds = boundsOf(faces);
  const units = typeof manifest.units === 'string' ? manifest.units : DEFAULT_UNITS;
  const round1 = (n) => Math.round(n * 10) / 10;
  const size = bounds
    ? { w: round1(bounds.max[0] - bounds.min[0]), d: round1(bounds.max[1] - bounds.min[1]), h: round1(bounds.max[2] - bounds.min[2]) }
    : null;

  // Per-monomer readout — the model's eyes on each part's size + where it sits on the z stack,
  // so gaps/overlaps are legible from the numbers before spending a render→view loop.
  const part = (kind, spec, index) => {
    const b = monomerBounds(kind, spec, WORKBENCH_LIGHT);
    if (!b) return null;
    return {
      kind, index,
      size: { w: round1(b.max[0] - b.min[0]), d: round1(b.max[1] - b.min[1]), h: round1(b.max[2] - b.min[2]) },
      base: round1(b.min[2]), top: round1(b.max[2]),
    };
  };
  const parts = [
    ...lathes.map((s, i) => part('lathe', s, i)),
    ...extrudes.map((s, i) => part('extrude', s, i)),
    ...sweeps.map((s, i) => part('sweep', s, i)),
    ...reliefs.map((s, i) => part('relief', s, i)),
  ].filter(Boolean);

  // Grid-alignment lint — unambiguous, high-signal checks the measured vantage cares about.
  const warnings = [];
  if (bounds) {
    const tol = Math.max(0.2, (bounds.max[2] - bounds.min[2]) * 0.02);
    if (bounds.min[2] > tol) {
      warnings.push(`Object floats ${round1(bounds.min[2])} ${units} above the grid (lowest point z=${round1(bounds.min[2])}). Drop the base monomer so its lowest z = 0 to seat it on the measured floor.`);
    } else if (bounds.min[2] < -tol) {
      warnings.push(`Object sinks ${round1(-bounds.min[2])} ${units} below the grid (lowest point z=${round1(bounds.min[2])}). Raise the base monomer so its lowest z = 0.`);
    }
  }

  return { stats: { monomers: lathes.length + extrudes.length + sweeps.length + reliefs.length, lathes: lathes.length, extrudes: extrudes.length, sweeps: sweeps.length, reliefs: reliefs.length, faces: faces.length, units, size, parts, ...(warnings.length ? { warnings } : {}) } };
}

export { WORKBENCH_LIGHT };
