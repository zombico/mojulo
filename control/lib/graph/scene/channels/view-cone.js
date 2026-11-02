// In-page script (part of the form channel, channels/form-land.js): THE VIEW CONE, where the page draws full detail.
// Not a ring round the player: the camera's frustum, cut off at a REACH. Inside it the channels draw what they make in
// full; past its reach they draw an impression (the grass its strands, channels/form-grass.js); what the cone does not
// see is left undrawn. Mojulo web only: an engine export keeps its full geometry.
//
//   reach   the screen's by default: the distance at which a tall grass blade's width (VIEW_CONE.blade) covers
//           VIEW_CONE.px pixels, at the camera's field of view and the canvas's height in device pixels, so a bigger
//           screen sees real grass further. A world's `cone` fixes it in metres; live, [ and ] shrink and grow it, \
//           returns it to the screen's. Always within VIEW_CONE.range
//   when    set in scene.onBeforeRender by every perspective camera that renders the scene, before the render list is
//           built, so a channel that reads it in its own hook (installed after this one) culls the same frame
//
// `window.__mojCone`: { reach (m), px (a pixel's size at a metre), grain (the impression's, px a texel), eye, frustum, fixed (the set reach, or null),
// set(m | null), sees(sphere) }. A page without the form channel carries none of it.
import { GRASS_TIERS } from './form-grass.js';

const tall = GRASS_TIERS.find((t) => t.sward === 'tall');
/** The cone's ruler: real detail while a tall blade's mean width (`blade`, m) covers `px` pixels; a reach is kept within
 *  `range` (m), and a key press scales it by `step`. Past the reach everything is its impression (the grass its colour,
 *  a tree its card, a tile of buildings its card), at an impression's GRAIN of at most `grain` pixels a texel: one rule
 *  for the whole world. */
export const VIEW_CONE = Object.freeze({
  px: 0.75,
  grain: 1.5,
  // the crust's softening (`soften`, css pixels at its most, channels/frame-pass.js): the grain's by default, within `softRange`
  soften: 1.5,
  softRange: Object.freeze([0.5, 4]),
  blade: Math.round(tall.scale * ((tall.clump.width[0] + tall.clump.width[1]) / 2) * 1e4) / 1e4,
  range: Object.freeze([4, 600]),
  step: 1.25,
});

/** A world's `cone`, read: a reach in metres (a number, or { reach }) → { reach }; `true` the screen's reach, asked for
 *  (a page without the form render carries the cone only when its world asks) → { reach: null }; `{ reach?, soften? }`
 *  the same with the crust softened past the reach (`soften` true for the grain's css pixels, or a number of them:
 *  channels/frame-pass.js) → { reach, soften }; absent → null. */
export function readCone(v) {
  if (v === undefined || v === null) return null;
  if (v === true) return { reach: null };
  const [lo, hi] = VIEW_CONE.range, [slo, shi] = VIEW_CONE.softRange;
  const say = `cone is the view cone's reach in metres (${lo} to ${hi}), true for the screen's, or { reach?, soften? } (soften: the impressions past the reach softened, true or ${slo} to ${shi} css pixels): full detail inside it, an impression past it. Absent, the screen's on a form page, none on another`;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of Object.keys(v)) if (k !== 'reach' && k !== 'soften') throw new Error(`cone.${k} is not a setting (reach, soften)`);
    const out = { reach: null };
    if (v.reach !== undefined && v.reach !== null) { if (!Number.isFinite(v.reach) || v.reach < lo || v.reach > hi) throw new Error(say); out.reach = v.reach; }
    if (v.soften !== undefined && v.soften !== false) {
      const sp = v.soften === true ? VIEW_CONE.soften : v.soften;
      if (!(typeof sp === 'number' && Number.isFinite(sp) && sp >= slo && sp <= shi)) throw new Error(say);
      out.soften = sp;
    }
    return out;
  }
  const reach = typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(reach) || reach < lo || reach > hi) throw new Error(say);
  return { reach };
}

/** The cone's page source; `cone` a read cone (readCone) or null. */
export function viewConeScript(cone = null) {
  return `
  // --- the view cone: full detail where the screen can show it (channels/view-cone.js) ---
  (function () {
    const VC = ${JSON.stringify(VIEW_CONE)}, F = new THREE.Frustum(), PM = new THREE.Matrix4(), buf = new THREE.Vector2();
    const clamp = (m) => Math.min(VC.range[1], Math.max(VC.range[0], m));
    let fixed = ${cone && Number.isFinite(cone.reach) ? JSON.stringify(cone.reach) : 'null'};
    const K = { reach: fixed ?? 30, px: 0.001, grain: VC.grain, eye: new THREE.Vector3(), frustum: F,
      get fixed() { return fixed; },
      set: (m) => { fixed = m === null || m === undefined ? null : clamp(m); return fixed; },
      sees: (s) => F.intersectsSphere(s) };
    window.__mojCone = K;
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = function (r, s, cam, rt) {
      if (cam.isPerspectiveCamera) {
        K.px = 2 * Math.tan(cam.getEffectiveFOV() * Math.PI / 360) / Math.max(1, r.getDrawingBufferSize(buf).y);
        K.reach = clamp(fixed ?? VC.blade / (VC.px * K.px));
        K.eye.setFromMatrixPosition(cam.matrixWorld);
        F.setFromProjectionMatrix(PM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      }
      if (prev) prev.call(this, r, s, cam, rt);
    };
    window.addEventListener('keydown', (e) => {
      if (e.key === '[' || e.key === ']') console.log('view cone reach', K.set(K.reach * (e.key === ']' ? VC.step : 1 / VC.step)));
      else if (e.key === '\\\\') { K.set(null); console.log('view cone reach: the screen\\'s'); }
    });
  })();
`;
}
