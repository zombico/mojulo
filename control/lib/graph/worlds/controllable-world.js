/**
 * controllable-world — ONE primitive for "control a thing in a world". An entity is a transform
 * (position + heading/pitch) plus a RULE that updates it each frame. The figure, the ball, the
 * drone — and the CAMERA — are all entities; only the rule (what drives the transform) and the
 * body (what it looks like) differ.
 *
 * S0 (controllable-split.plan.md): the model now lives in ./controllable/ as composed BUILDER
 * closures — currently one (`all.js`, the former monolith wholesale), carved into per-system
 * builders over S1–S4. This file is the FAÇADE: it composes the live Node instance and re-exports
 * the same API as before, so consumers never track the decomposition. The browser runs the SAME
 * builder sources via ./controllable/compose.js#emissionSource() (single source of truth — no
 * second, drifting copy; wired in scene/channels/controllable/index.js).
 *
 * Purity doctrine (unchanged): rules consume a NORMALIZED input snapshot (axes already mapped
 * from keys/mouse by the renderer) and a fixed dt, so the same inputs → byte-identical outputs.
 * Ground-snap / wall-slide (raycasts against world geometry) and the physics integrator are
 * passed in as `hooks` by the renderer; the model itself stays geometry-free and deterministic.
 *
 * World convention: z-up, heading = yaw about +Z. Rules: glide, walk, platform (gravity+jump),
 * follow, clock, ai (the fire-back hunter — a vacated suit's ambient brain), mover.
 */

import { composeLive } from './controllable/compose.js';

// ── standalone `controllable` world kind ─────────────────────────────────────────────────────────
// Most controllable worlds RIDE on an existing kind (a figure walking a stored city). This assembler
// is for the standalone case: a bare stage (a floor, or caller-supplied `faces`) that exists only to
// host entities, so an entities-only manifest renders without piggybacking on another kind. NOT part
// of the browser-emitted closure — it builds server-side faces like every other assemble*Scene.
// (The import is server-side only, like this whole section — buildControllable stays import-free.)
// engine→mobile-suit seam (controllable-split.plan.md): the atmosphere regrade lives in the content
// pack, loaded LAZILY and CONTAINED — pack absent, the no-op mirrors the function's own
// "no manifest.atmosphere" null return, so un-keyed worlds are byte-identical either way.
let applyArenaAtmosphere = () => null;
try {
  ({ applyArenaAtmosphere } = await import('../mobile-suit/arena-atmosphere.js'));
} catch (err) { console.error('mobile-suit pack absent — atmosphere keying disabled:', err?.message); }
function defaultGround(spec = {}) {
  const size = spec.size || 40, cell = spec.cell || 4, n = Math.max(2, Math.round(size / cell));
  const a = spec.colorA || '#2f3b50', b = spec.colorB || '#3b4a64';
  const faces = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = -size / 2 + i * cell, y = -size / 2 + j * cell;
    faces.push({ corners: [[x, y, 0], [x + cell, y, 0], [x + cell, y + cell, 0], [x, y + cell, 0]], fill: (i + j) % 2 ? a : b, doubleSided: true });
  }
  return faces;
}

/**
 * assembleControllableScene(manifest, opts) → payload for emitThreeWorld. The `entities` / `camera`
 * / `figures` are layered on by resolveWorldScene's controllable passthrough (same as on any kind);
 * this just provides the static stage + an initial camera framing.
 */
export function assembleControllableScene(manifest = {}, opts = {}) {
  let faces = Array.isArray(manifest.faces) && manifest.faces.length ? manifest.faces : defaultGround(manifest.ground || {});
  // opt-in atmosphere keying (arena-atmosphere.js): regrade the stage fills under a low warm
  // key + blue-shifted ambient, cast baked long-shadow decals off `colliders`, and derive a
  // matching sky + payload light. Absent `manifest.atmosphere` ⇒ byte-identical.
  const atmo = applyArenaAtmosphere(manifest, faces);
  if (atmo) faces = atmo.faces;
  const framing = manifest.worldFraming || manifest.framing || { cameraPosition: [14, -18, 10], lookAt: [0, 0, 1], horizontalFov: 60 };
  return {
    faces,
    cameras: [{ worldFraming: framing }],
    viewBox: manifest.viewBox || { width: 1120, height: 780 },
    title: opts.title || manifest.title || 'mojulo controllable world',
    bg: manifest.bg || '#0b1220',
    // opt-in sky (e.g. `{ space:true }` for a full-sphere starfield + void bg — the SPACE maps) —
    // additive; an explicit `manifest.sky` wins over the atmosphere-derived dome.
    ...(manifest.sky && typeof manifest.sky === 'object' ? { sky: manifest.sky }
      : (atmo && atmo.sky ? { sky: atmo.sky } : {})),
    ...(atmo && atmo.light ? { light: atmo.light } : {}),
  };
}

// Live node instance (tested in controllable-world.test.js). The browser runs the same builder
// sources via compose.js#emissionSource(), so there is no second copy — keep all model changes
// inside the ./controllable/ builders.
const _cw = composeLive();
export const createWorld = _cw.createWorld;
export const stepWorld = _cw.stepWorld;
export const normalizeEntity = _cw.normalizeEntity;
export const gaitFramePair = _cw.gaitFramePair;
export const advanceGaitMix = _cw.advanceGaitMix;
export const RULES = _cw.RULES;
export const AI_DIFFICULTY = _cw.AI_DIFFICULTY;
