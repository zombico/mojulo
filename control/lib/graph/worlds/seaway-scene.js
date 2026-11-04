/**
 * seaway-scene — an assembled boat underway, on the World page's live water: an assembler manifest that carries a
 * `seaway` (craft-shelf `assembleCraft(id, { underway: { speed, course } })`) resolves here instead of to its studio.
 *
 * The boat's own faces (its static `wake` item left out: the water draws its wake live) are packed into the seaway
 * channel (scene/channels/seaway.js) about its origin, the hull's middle at its waterline, as Int16 corners on its own
 * scale and Uint8 colours. The course is a loop the boat runs counter-clockwise, starting at the world's origin heading
 * +y; buoys mark it. The water is a grid over the loop, its cells small against the boat's divergent waves and its
 * length, at most `MAX_N` a side; its look and swell are the sea's for a ship, a lake's for a small boat. Pure.
 */
import { lowerAssemblerFaces } from './workbench-assembler.js';
import { assembleBoxCityScene } from '../scene/scene-css3d.js';
import { lowerObjectFaces, WORKBENCH_LIGHT } from './workbench.js';
import { resolveAquaLook } from '../materials/aqua-look.js';

const MAX_N = 200, r3 = (v) => Math.round(v * 1000) / 1000 + 0;

// (a sea's swell for a ship's water, a lake's ripple for a small boat's: lengths in metres, amplitudes, directions)
export const SEAWAY_WATERS = Object.freeze({
  ocean: { color: '#1f4f63', swell: [{ length: 71, amp: 0.3, dir: 0.3, ph: 0 }, { length: 47, amp: 0.17, dir: 0.85, ph: 1.3 }, { length: 29, amp: 0.1, dir: -0.35, ph: 2.1 }, { length: 19, amp: 0.06, dir: 1.6, ph: 4.0 }, { length: 11, amp: 0.035, dir: -1.1, ph: 5.2 }] },
  lake: { color: '#2f5a55', swell: [{ length: 6.3, amp: 0.045, dir: 0.4, ph: 0 }, { length: 4.1, amp: 0.025, dir: 1.15, ph: 1.1 }, { length: 2.6, amp: 0.014, dir: -0.45, ph: 2.4 }, { length: 1.7, amp: 0.008, dir: 1.9, ph: 3.7 }] },
});

const hex = (s) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(s)); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(String(s)); return m ? m[1].split(',').slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(+v)))) : hex(s) || [128, 128, 128]; };

/** A boat's faces packed about its origin: { pos (base64 Int16 xyz per corner), col (base64 Uint8 rgb), scale, tris }. */
export function packBoat(faces, origin) {
  const tris = [];
  for (const f of faces) {
    const c = f.corners;
    for (let k = 1; k + 1 < c.length; k += 1) tris.push([c[0], c[k], c[k + 1], f.fill]);
  }
  let reach = 0;
  for (const [a, b, c] of tris) for (const p of [a, b, c]) for (let i = 0; i < 3; i += 1) reach = Math.max(reach, Math.abs(p[i] - origin[i]));
  const scale = Math.max(reach, 1e-3) / 32000, pos = new Int16Array(tris.length * 9), col = new Uint8Array(tris.length * 9);
  tris.forEach(([a, b, c, fill], t) => {
    const C = rgb(fill);
    [a, b, c].forEach((p, v) => { for (let i = 0; i < 3; i += 1) { pos[t * 9 + v * 3 + i] = Math.round((p[i] - origin[i]) / scale); col[t * 9 + v * 3 + i] = C[i]; } });
  });
  const b64 = (u) => Buffer.from(u.buffer, u.byteOffset, u.byteLength).toString('base64');
  return { pos: b64(pos), col: b64(col), scale: +scale.toPrecision(8), tris: tris.length };
}

/** The water over a loop of radius R round its centre: its size and grid, its look and swell. */
export function seawayWater(seaway) {
  const W = seaway.wake, L = W.waterline.length, R = seaway.course.loop, kind = seaway.water;
  const size = r3(2 * (R + Math.max(0.3 * R, 3 * L))), cell = Math.max(size / (MAX_N - 1), Math.min(W.divergent.wavelength, L) / 8);
  const n = Math.max(60, Math.min(MAX_N, Math.ceil(size / cell) + 1));
  return { kind, size, n, color: SEAWAY_WATERS[kind].color, swell: SEAWAY_WATERS[kind].swell, look: resolveAquaLook(kind === 'ocean' ? 'ocean' : 'lake') };
}

// a buoy: a float, its cage and its topmark, sized to the course
function buoyFaces(at, s, light) {
  const L = (id, z0, z1, pairs, tint) => ({ id, axisFrom: { x: at[0], y: at[1], z: z0 }, axisTo: { x: at[0], y: at[1], z: z1 }, profile: pairs.map(([t, radius]) => ({ t, radius })), tint, samples: 12, crossSections: pairs.length });
  return lowerObjectFaces({ lathes: [L('float', -0.4 * s, 0.5 * s, [[0, 0.2 * s], [0.4, 0.55 * s], [1, 0.45 * s]], '#d8452f'), L('cage', 0.5 * s, 1.6 * s, [[0, 0.3 * s], [1, 0.08 * s]], '#d8452f'), L('mark', 1.6 * s, 1.9 * s, [[0, 0.18 * s], [0.5, 0.2 * s], [1, 0.02 * s]], '#f2d23a')] }, light);
}

export function assembleSeawayScene(m, { title, light, toon } = {}) {
  const S = m.seaway, origin = S.origin, R = S.course.loop, center = [r3(-R), 0];
  const items = m.items.filter((it) => it.id !== 'wake');
  const faces = lowerAssemblerFaces({ ...m, items }, { light: light || WORKBENCH_LIGHT }).filter((f) => !f.studio);
  void toon;
  const boat = packBoat(faces, origin), water = seawayWater(S), course = { loop: R, center };
  // the buoys round the loop, outside it, sized to the boat
  const s = Math.max(0.5, Math.min(4, 0.08 * S.wake.waterline.length)), off = 0.5 * S.wake.waterline.beam + 6 * s;
  const buoys = Array.from({ length: 8 }, (_, k) => { const a = (2 * Math.PI * (k + 0.5)) / 8; return [r3(center[0] + (R + off) * Math.cos(a)), r3(center[1] + (R + off) * Math.sin(a)), 0]; });
  const buoyF = buoys.flatMap((b) => buoyFaces(b, s, light || WORKBENCH_LIGHT));
  // the chase camera: astern, outboard and above the boat at its start
  const D = Math.max(3 * S.wake.waterline.length, 25);
  const cameras = [
    { name: 'chase', worldFraming: { cameraPosition: [r3(0.9 * D), r3(-1.4 * D), r3(0.55 * D)], lookAt: [0, r3(0.2 * D), 0], horizontalFov: 50 } },
    { name: 'wake', worldFraming: { cameraPosition: [r3(0.5 * D), r3(1.2 * D), r3(1.1 * D)], lookAt: [0, r3(-1.2 * D), 0], horizontalFov: 55 } },
    { name: 'course', worldFraming: { cameraPosition: [center[0], r3(center[1] - 0.01), r3(2.6 * R)], lookAt: [center[0], center[1], 0], horizontalFov: 55 } },
  ];
  const payload = assembleBoxCityScene({ faces: buoyF, grounds: [], cameras, viewBox: { width: 1120, height: 700 }, title: title || m.title, bg: '#b9cad6', light: light || WORKBENCH_LIGHT });
  return { ...payload, seaway: { boat, water, wake: S.wake, course } };
}
