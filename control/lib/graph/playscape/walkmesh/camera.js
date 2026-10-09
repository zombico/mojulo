/**
 * THE PLATE CAMERA — one fixed pinhole per plate, the same one every still and the World page use
 * (polygonizer/pure-mandala.js resolveCameraBasis), so the board's overlay, the bake's render and the runtime agree.
 *
 *   paintedFraming(size, ground)   a painted plate's camera from its ground fit: the eye `height` (m) over the floor,
 *                                  the horizontal `fov`, and the `horizon` line (plate px). A level horizon above the
 *                                  plate's centre is a camera pitched down: tan(pitch) = (cy − horizon) / f.
 *   bakedFraming(camera, size)     a baked plate's camera: { at, look, fov } in the world's metres
 *   plateBasis(framing, size)      the basis (position, forward, right, up, f, pictureCenter)
 *   project(B, P)                  world point (m, z-up) → { px: [x, y], depth } or null behind the near plane
 *   lift(B, px, z = 0)             plate px → the world point where its ray meets the plane z, or null (at or above
 *                                  the horizon, the ray never lands)
 *   horizonOf(B)                   the plate y where the level ground meets the sky
 *   figureSpan(B, m, height)       how many plate px a figure `height` m tall standing at m spans
 *
 * Pure arithmetic; no dice.
 */
import { resolveCameraBasis } from '../../polygonizer/pure-mandala.js';

export const NEAR = 0.05;
export const GROUND_DEFAULTS = Object.freeze({ height: 1.6, fov: 60 });
export const FOV_RANGE = Object.freeze([20, 120]);   // resolveCameraBasis clamps to this

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function paintedFraming([w, h], { horizon, height = GROUND_DEFAULTS.height, fov = GROUND_DEFAULTS.fov }) {
  const f = w / (2 * Math.tan((fov * Math.PI) / 360));
  const tan = (h / 2 - horizon) / f;
  return { cameraPosition: [0, 0, height], lookAt: [0, 10, height - 10 * tan], horizontalFov: fov, pictureCenter: [w / 2, h / 2] };
}

export function bakedFraming({ at, look, fov = GROUND_DEFAULTS.fov }, [w, h]) {
  return { cameraPosition: [...at], lookAt: [...look], horizontalFov: fov, pictureCenter: [w / 2, h / 2] };
}

export function plateBasis(framing, [w, h]) {
  const B = resolveCameraBasis({ worldFraming: framing, viewBox: { width: w, height: h } });
  if (!B) throw new Error('walkmesh: the plate camera has no direction (its eye and its look coincide)');
  return B;
}

export function project(B, P) {
  const V = sub([P[0], P[1], P[2] ?? 0], B.position);
  const depth = dot(V, B.forward);
  if (depth < NEAR) return null;
  return { px: [B.pictureCenter[0] + (dot(V, B.right) / depth) * B.f, B.pictureCenter[1] - (dot(V, B.up) / depth) * B.f], depth };
}

export function lift(B, [x, y], z = 0) {
  const a = (x - B.pictureCenter[0]) / B.f, b = -(y - B.pictureCenter[1]) / B.f;
  const d = [0, 1, 2].map((i) => B.forward[i] + B.right[i] * a + B.up[i] * b);
  if (Math.abs(d[2]) < 1e-12) return null;
  const t = (z - B.position[2]) / d[2];
  if (!(t > 0)) return null;
  return [B.position[0] + d[0] * t, B.position[1] + d[1] * t, z];
}

export function horizonOf(B) {
  const flat = Math.hypot(B.forward[0], B.forward[1]);
  if (flat < 1e-9) return null;   // looking straight down: no horizon in frame
  const d = [B.forward[0] / flat, B.forward[1] / flat, 0];
  return B.pictureCenter[1] - (dot(d, B.up) / dot(d, B.forward)) * B.f;
}

export function figureSpan(B, m, height) {
  const feet = project(B, [m[0], m[1], m[2] ?? 0]), head = project(B, [m[0], m[1], (m[2] ?? 0) + height]);
  return feet && head ? { feet: feet.px, head: head.px, span: feet.px[1] - head.px[1], depth: feet.depth } : null;
}
