import { safeJson } from '../emit-util.js';

// The BEACONS channel (a city's aviation obstruction lights: geocity/rooftop.js beaconsOf): points of light that keep
// their size on the screen however far off they are (a beacon is seen across a city as a dot, never as a box), blinking
// together on the world clock (`period` seconds, on for `duty` of it), so a capture at a clock and the live page agree.
// Emitted only when a payload carries `beacons` with points; none ⇒ not one byte.
//
//   beacons { at: [[x, y, z], …], color: '#rrggbb', period, duty, size? }

/** Beacons fit to emit, or null. */
export function readBeacons(b) {
  return b && Array.isArray(b.at) && b.at.length && b.at.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)) ? b : null;
}

/** The page's script: `stepBeacons(t)` (t in ms), `window.__mojBeacons` its probe. */
export function beaconsChannelScript(b) {
  const B = { at: b.at, color: b.color ?? '#ff2a1a', period: b.period > 0 ? b.period : 1.6, duty: b.duty > 0 && b.duty < 1 ? b.duty : 0.35, size: b.size > 0 ? b.size : 6 };
  return `
// ---- beacons channel (aviation lights blinking over the tallest: their size the screen's, on the world clock) ----
let stepBeacons = () => {};
{
const BEACONS = ${safeJson(B)};
const __bgGeo = new THREE.BufferGeometry();
__bgGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BEACONS.at.flat()), 3));
// (each point a round soft dot, not a square: a radial falloff in its alpha)
const __bgDot = (() => { const n = 32, a = new Uint8Array(n * n * 4); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const d = Math.hypot(i + 0.5 - n / 2, j + 0.5 - n / 2) / (n / 2), k = (j * n + i) * 4; a[k] = a[k + 1] = a[k + 2] = 255; a[k + 3] = Math.round(255 * Math.max(0, Math.min(1, (1 - d) * 1.6)) ** 1.5); } const t = new THREE.DataTexture(a, n, n, THREE.RGBAFormat); t.needsUpdate = true; return t; })();
const __bgMat = new THREE.PointsMaterial({ color: new THREE.Color(BEACONS.color), size: BEACONS.size, sizeAttenuation: false, depthWrite: false, map: __bgDot, transparent: true, alphaTest: 0.05 });
const __bgPts = new THREE.Points(__bgGeo, __bgMat);
__bgPts.frustumCulled = false;
// (its glow: the same points larger and faint, added over what is behind them)
const __bgHalo = new THREE.Points(__bgGeo, new THREE.PointsMaterial({ color: new THREE.Color(BEACONS.color), size: BEACONS.size * 2.6, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, map: __bgDot }));
__bgHalo.frustumCulled = false;
__bgPts.add(__bgHalo);
scene.add(__bgPts);
window.__mojBeacons = { count: BEACONS.at.length, on: true };
stepBeacons = (t) => {
  // (in whole milliseconds, so a clock on the beat is on it, not a hair short)
  const P = Math.round(BEACONS.period * 1000), ph = (((Math.round(t) % P) + P) % P) / P, on = ph < BEACONS.duty;
  __bgPts.visible = on; window.__mojBeacons.on = on;
};
}`;
}
