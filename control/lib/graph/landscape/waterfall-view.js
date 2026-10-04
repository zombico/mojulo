/**
 * waterfall-view — a river that runs off a cliff, falls, and plunges into a pool, in the traversable three.js World.
 * Built from the falling-water primitive (materials/jet.js): the fall is a `jets` stream — a SHEET over the lip, or a
 * round SPOUT through a rock notch — drawn on the GPU along its ballistic path, glassy over the lip, whitening and
 * fraying as it falls (break-up length ~30 critical depths), with mist at its foot. The pool is a shallows pond
 * (materials/shallows.js) whose simulated surface the fall churns through the water bus; the river above and the
 * outflow below are the surface channel's `river` mode, like river-view.
 *
 * Three KINDS, one primitive at different points in its parameter space (see SCENARIOS):
 *   veil       a tall, thin ribbon from a narrow lip that frays to streaks and mist long before the pool
 *   curtain    a broad, heavy block of water off a wide ledge, solid most of the way down
 *   horsetail  a round spout shot through a notch in the rock, white from halfway
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'waterfall-view', scenario?, seed?, scale?, flow? (m³/s), viewBox?, scene?:{ bg? }, title? }
 * 1 unit = 1 m at scale 1. Deterministic: seeded phases + hash noise, dmath trig, no dice.
 */

import * as dmath from '../../util/dmath.js';
import { withAqua } from '../materials/aqua-look.js';
import { normalizeShallows, bedDepth } from '../materials/shallows.js';
import { normalizeJets, sheetProfile, jetProfile, jetAt, jetHitTime } from '../materials/jet.js';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('');
const norm3 = (v) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const r4 = (v) => +(+v).toFixed(4);

const W = 120, H = 150, TX = 64, TY = 80;    // terrain footprint (m) and its face grid
const YC = 12;                                 // the cliff's edge (the lip) runs along y = YC; the river flows −y
const SUN = [-45, -60, 90];

function hash2(ix, iy) { let h = (ix * 374761393 + iy * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}
function fbm(x, y, f0 = 0.045) { let s = 0, a = 0.5, f = f0; for (let o = 0; o < 4; o++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }

// fall: the drop from the lip to the pool's level (m); lip: its width (m) — a sheet — or `spout` a round jet's radius;
// flow: m³/s; channel: the river above's half-width (a sheet's is half its lip); pool: the plunge pool's size (m) and depth
const SCENARIOS = {
  veil: { fall: 38, lip: 5, flow: 1.6, pool: [24, 20], deep: 3.2, rock: [0.40, 0.38, 0.36], tint: '#5f9c95' },
  curtain: { fall: 16, lip: 26, flow: 45, pool: [44, 26], deep: 4, rock: [0.46, 0.40, 0.33], tint: '#4f8f8a' },
  horsetail: { fall: 30, spout: 0.6, flow: 3, channel: 3.5, pool: [22, 20], deep: 3.5, rock: [0.36, 0.34, 0.33], tint: '#5a958c' },
};
export const WATERFALL_SCENARIOS = Object.keys(SCENARIOS);

/**
 * Resolve a recipe into terrain faces, the two river surfaces, the plunge pool and the fall. Pure; deterministic.
 * @returns {{ faces, surfaces, shallows, jets, bounds, stats }}
 */
export function planWaterfallScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'veil';
  // a waterfall is the river going over the edge: a sheet's channel is exactly the lip's width (only a spout is a
  // river squeezed through a slot)
  const S = SCENARIOS[scenario].spout ? SCENARIOS[scenario] : { ...SCENARIOS[scenario], channel: SCENARIOS[scenario].lip / 2 };
  const s = clampNum(recipe.scale, 0.4, 3, 1);
  const seed = Number.isFinite(+recipe.seed) ? Math.floor(+recipe.seed) : 1;
  const Q = clampNum(recipe.flow, 0.05, 2000, S.flow);
  const nOff = ((seed * 131) % 500) + 40, ph = (seed * 0.61803) % 6.283;
  const sheet = !S.spout;

  // the fall's own numbers (metres): where the water leaves the lip, how far it throws before the pool
  const lipZ = S.fall;                                            // the lip's rock, above the pool's level (0)
  const prof = sheet ? sheetProfile({ W: S.lip, Q, dir: [0, -1, 0] }) : jetProfile({ r0: S.spout, Q, dir: [0, -1, 0] });
  const lead = sheet ? prof.hb / 2 : S.spout;                     // the stream's axis above the lip rock
  const tHit = jetHitTime(prof, -(lipZ + lead)), throwY = -jetAt(prof, tHit).p[1];

  // the plunge pool: a pond centred a little past the impact, its bowl cut back under the cliff's foot
  const poolY = YC - throwY - S.pool[1] * 0.18;
  const [pond] = normalizeShallows([{ id: 'plunge', kind: 'pond', at: [0, poolY * s], size: [S.pool[0] * s, S.pool[1] * s], deep: S.deep, freeboard: 0.4, seed, ground: 0,
    look: { tint: S.tint, sigma: [0.55, 0.22, 0.3] }, breeze: 0.02 }], { metersPerUnit: 1 / s });
  const level = pond.level / s;                                   // the pool's still level, metres (just under 0)
  const shoreY = poolY - (S.pool[1] / 2) / 1.45;                  // the downstream shore, where the outflow leaves

  // the land: a plateau above the cliff, a valley floor below, both rolling; the river channels carved into both
  // (both stay above their river's water everywhere, so a bank never dips under it)
  const plateau = (x, y) => lipZ + 4 + (fbm(x + nOff, y + nOff) - 0.5) * 6 + Math.max(0, y - YC) * 0.05 + Math.abs(x) * 0.06;
  const floor = (x, y) => 2.4 + (fbm(x + nOff * 0.7, y - nOff) - 0.5) * 3.6 + Math.abs(x) * 0.07;
  // a ragged edge, straight across the river and its banks (the river's sunk skirts must stay behind the cliff face)
  const cliffAt = (x) => YC + (fbm(x * 0.6 + nOff, 7) - 0.5) * 5 * Math.max(0, Math.min(1, (Math.abs(x) - S.channel - 2.5) / 6));
  // the river's surface over the lip rock upstream: a little over twice critical depth, drawing down to the brink
  // over `app` m (the sheet's tongue draws that); a spout's slot is fed from a pool behind it
  const head = sheet ? 2.2 * prof.hc : 0.5, app = sheet ? Math.max(4, 10 * prof.hc) : 0;
  const upLevel = (y) => lipZ + head + Math.max(0, y - YC) * 0.02;
  const lowLevel = (y) => level - 0.05 - Math.max(0, shoreY - y) * 0.025;
  const outX = (y) => 6 * dmath.sin((shoreY - y) * 0.045 + ph) * Math.min(1, (shoreY - y) / 20);
  // a channel: its bed out to `half`, rising straight to `rim` (above the water) by `bank`, natural ground beyond.
  // The river mode sinks the water's off-ribbon vertices 40 m; the bank must be above the water by the river's own
  // bank distance or those skirts show
  const carve = (z, dl, half, bank, bed, rim) => { if (dl <= half) return Math.min(z, bed); if (dl >= bank) return z; const u = (dl - half) / (bank - half); return Math.min(z, bed + (Math.max(z, rim) - bed) * (1 - (1 - u) * (1 - u))); };
  // a spout is a river squeezed through a slot: the river stops in a pool `back` m behind the edge, and only a slot
  // the spout's width runs on to the cliff
  const back = sheet ? 0 : 5, slot = sheet ? 0 : S.spout * 1.3;
  const above = (x, y) => {
    let z = plateau(x, y);
    if (y > YC - 1 + back) {
      // the channel to the lip: a bed under the water, banks sloping up like a small valley; the bed rises to the lip
      // ledge over the last few metres (smooth), so the water runs out onto a worn rock lip, not off a box
      const k = Math.min(1, Math.max(0, (y - YC) / Math.max(3, app))), bed = lipZ - 1.1 * k * k * (3 - 2 * k);
      z = carve(z, Math.abs(x), S.channel - 0.6, S.channel + 6, Math.min(bed, upLevel(y) - 0.3), upLevel(y) + 2.5);
    }
    if (slot && y > YC - 1) z = carve(z, Math.abs(x), slot, slot + 1.5, lipZ - 0.2, lipZ + 3);                       // the slot
    if (slot && Math.abs(x) <= slot && y < YC + 0.6) z = lipZ;                                                       // a spout's slot: a clean ledge
    return z;
  };
  const terrainZ = (x, y) => {
    const c = cliffAt(x);
    let z;
    if (y >= c) z = above(x, y);
    else {
      // the cliff face: from the edge's own (carved) height, a steep fall over ~1.5 m of run, then scree into the valley
      const k = Math.min(1, (c - y) / 1.5), top = above(x, c), bottom = floor(x, y) + Math.max(0, 6 - (c - y)) * 0.9;
      z = top + (bottom - top) * k;
      z = carve(z, Math.abs(x - outX(y)), 3 + S.channel * 0.4, 6 + S.channel * 0.4, lowLevel(y) - 1.4, lowLevel(y) + 2.2);    // the outflow
    }
    // the pool's bowl, cut into whatever is there (it undercuts the cliff's foot, as a plunge pool does)
    // (past its shore the bank climbs steeply, so the bowl cuts the pool and no more)
    const d = bedDepth(pond, x * s, y * s) / s, qq = Math.hypot(x - pond.center[0] / s, y - pond.center[1] / s) / (pond.radii[1] / s);
    z = Math.min(z, level - d + Math.max(0, qq - 1.05) * 220);
    return z;
  };

  // faces: rock where steep (darker where the spray keeps it wet), grass on the flats, sand at the waterline
  // The lip and the channel above it get a finer patch (FINE × the grid): at 1.5 m a 5 m channel and its banks are
  // two cells, the banks interpolate straight under the water's edge and the brink reads as a box. The patch spans
  // whole coarse cells; on its border a fine vertex takes the coarse edge's straight line, so no crack opens.
  // (sized to what needs it — the brink, the banks either side, the tongue's run — so the page stays near a river-view's)
  const cw = W / TX, ch = H / TY, FINE = 3;
  const pi0 = Math.floor((W / 2 - (S.channel + 5)) / cw), pi1 = TX - pi0;
  const pj0 = Math.floor((H / 2 + YC - 3) / ch), pj1 = Math.ceil((H / 2 + YC + app + back + 4) / ch);
  const inPatch = (i, j) => i >= pi0 && i < pi1 && j >= pj0 && j < pj1;
  const gx = (i) => -W / 2 + cw * i, gy = (j) => -H / 2 + ch * j;
  const fineZ = (fi, fj) => {
    // fi, fj: fine indices from the patch's corner; on the border, interpolate the coarse edge
    const x = gx(pi0) + (cw / FINE) * fi, y = gy(pj0) + (ch / FINE) * fj, nI = (pi1 - pi0) * FINE, nJ = (pj1 - pj0) * FINE;
    if (fj === 0 || fj === nJ) { const i0 = pi0 + Math.floor(fi / FINE), t = (fi % FINE) / FINE; return t ? terrainZ(gx(i0), y) * (1 - t) + terrainZ(gx(i0 + 1), y) * t : terrainZ(x, y); }
    if (fi === 0 || fi === nI) { const j0 = pj0 + Math.floor(fj / FINE), t = (fj % FINE) / FINE; return t ? terrainZ(x, gy(j0)) * (1 - t) + terrainZ(x, gy(j0 + 1)) * t : terrainZ(x, y); }
    return terrainZ(x, y);
  };
  const sun = norm3(SUN), ROCK = S.rock, GRASS = [0.31, 0.45, 0.21], SAND = [0.62, 0.56, 0.42], WET = ROCK.map((v) => v * 0.55);
  const faces = [];
  const face = (xa, xb, ya, yb, za, zb, zc4, zd, seedA, seedB) => {
    const p00 = [r4(xa * s), r4(ya * s), r4(za * s)], p10 = [r4(xb * s), r4(ya * s), r4(zb * s)], p11 = [r4(xb * s), r4(yb * s), r4(zc4 * s)], p01 = [r4(xa * s), r4(yb * s), r4(zd * s)];
    const n = norm3(cross3(sub3(p10, p00), sub3(p01, p00)));
    const shade = 0.42 + 0.58 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
    const xc = (xa + xb) / 2, yc = (ya + yb) / 2, zc = (za + zb + zc4 + zd) / 4;
    const steep = 1 - n[2], spray = Math.exp(-((xc / (S.channel + 8)) ** 2) - ((yc - (YC - throwY)) / 18) ** 2);
    const nearWater = zc < level + 0.6 || (yc > YC && Math.abs(xc) < S.channel + 1.5 && zc < upLevel(yc) + 0.5) || (yc < shoreY && Math.abs(xc - outX(yc)) < 6 && zc < lowLevel(yc) + 0.6);
    let base = steep > 0.5 ? ROCK : nearWater ? SAND : GRASS;
    if (steep > 0.5 || nearWater) base = base.map((v, k) => v + (WET[k] - v) * Math.min(0.8, spray * 1.2));
    const g = 0.94 + 0.12 * hash2(seedA, seedB);
    faces.push({ corners: [p00, p10, p11, p01], fill: hex(base.map((v) => v * shade * g)), group: steep > 0.5 ? 'rock' : 'ground' });
  };
  for (let j = 0; j < TY; j++) for (let i = 0; i < TX; i++) {
    if (inPatch(i, j)) continue;
    const xa = gx(i), xb = gx(i + 1), ya = gy(j), yb = gy(j + 1);
    face(xa, xb, ya, yb, terrainZ(xa, ya), terrainZ(xb, ya), terrainZ(xb, yb), terrainZ(xa, yb), i * 7 + 3, j * 5 + 1);
  }
  const nI = (pi1 - pi0) * FINE, nJ = (pj1 - pj0) * FINE, fw = cw / FINE, fh = ch / FINE, Z = [];
  for (let fj = 0; fj <= nJ; fj++) for (let fi = 0; fi <= nI; fi++) Z.push(fineZ(fi, fj));
  for (let fj = 0; fj < nJ; fj++) for (let fi = 0; fi < nI; fi++) {
    const xa = gx(pi0) + fw * fi, ya = gy(pj0) + fh * fj, q = fj * (nI + 1) + fi;
    face(xa, xa + fw, ya, ya + fh, Z[q], Z[q + 1], Z[q + nI + 2], Z[q + nI + 1], 4001 + fi, 7001 + fj);
  }

  // the rivers: above, straight to the lip; below, from the pool's shore winding away
  const upY0 = YC + Math.max(0.7, app - 0.4) + back, upW = 2 * (S.channel + 1.6);         // wide enough that its edges bury in the banks
  const N = 40, up = [], down = [];
  for (let k = 0; k < N; k++) { const y = H / 2 - ((H / 2 - upY0) * k) / (N - 1); up.push([0, r4(y * s), r4(upLevel(y) * s)]); }
  for (let k = 0; k < N; k++) { const y = shoreY - 2 - ((shoreY - 2 + H / 2) * k) / (N - 1); down.push([r4(outX(y) * s), r4(y * s), r4(lowLevel(y) * s)]); }
  const riverLook = { deep: [0.06, 0.26, 0.30], surf: [0.15, 0.46, 0.48], crest: [0.94, 0.98, 0.97], sun: SUN.map((v) => v * s), amax: 1 };
  // The river mode culls cells past its banks and sinks their vertices 40 m — a skirt the terrain must hide. The
  // upper river is straight, so its grid is exactly the water's width (no cell to cull, no skirt), and it stops short
  // of the lip (a cell over the cliff would hang down the face)
  const upper = { ...riverLook, grid: { w: upW * s, d: (H / 2 - upY0) * s, nx: Math.max(8, Math.round(upW / 0.6)), ny: 70, cx: 0, cy: ((H / 2 + upY0) / 2) * s },
    river: { pts: up, half: (S.channel + 1.6) * s, bank: (S.channel + 2.6) * s, flow: Math.min(9, prof.v0 * 2.4), amp: 0.25 * s, lam: 7 * s } };
  const lower = { ...riverLook, grid: { w: 60 * s, d: (shoreY + H / 2) * s, nx: 50, ny: 80, cx: 0, cy: ((shoreY - H / 2) / 2) * s },
    river: { pts: down, half: (3.5 + S.channel * 0.4) * s, bank: (5 + S.channel * 0.4) * s, flow: 5, amp: 0.3 * s, lam: 9 * s } };

  // the fall: the primitive, pouring off the lip into the pool
  const [fallJet] = normalizeJets([{ id: 'fall', at: [0, (YC + 0.2) * s, (lipZ + lead) * s], dir: [0, -1, 0], discharge: Q, into: 'plunge', fall: lipZ + lead + S.deep + 1,
    ...(sheet ? { shape: 'sheet', width: S.lip * s, approach: { length: app * s, head: r4(head + 0.03 - lead), half: S.channel * s } } : { radius: S.spout }) }], { bodies: [pond], metersPerUnit: 1 / s });

  return {
    faces, surfaces: [upper, lower],
    shallows: { bodies: [pond], floaters: [{ at: [-4 * s, (poolY - 4) * s], shape: 'leaf', r: 0.35 * s }, { at: [5 * s, (poolY - 6) * s], shape: 'leaf', r: 0.3 * s, yaw: 1.2, color: '#a08a30' }] },
    jets: [fallJet],
    bounds: { center: [0, 0, lipZ * s * 0.5], radius: Math.hypot(W / 2, H / 2) * s },
    stats: { scenario, seed, flow: Q, fall: lipZ, throw: r4(throwY), breakup: r4(prof.Lb), lip: sheet ? S.lip : 2 * S.spout, faces: faces.length },
  };
}

/** Resolve a recipe into the emitThreeWorld payload: cameras on the fall from the valley, the pool, and the lip. */
export function assembleWaterfallScene(recipe = {}, { title } = {}) {
  const plan = planWaterfallScene(recipe);
  const s = clampNum(recipe.scale, 0.4, 3, 1), f = plan.stats.fall, yi = YC - plan.stats.throw;
  const cameras = [
    { name: 'valley', worldFraming: { cameraPosition: [22 * s, (yi - 62) * s, (f * 0.45 + 6) * s], lookAt: [0, YC * s, f * 0.5 * s], horizontalFov: 60 } },
    { name: 'pool', worldFraming: { cameraPosition: [12 * s, (yi - 24) * s, 4 * s], lookAt: [0, yi * s, f * 0.25 * s], horizontalFov: 62 } },
    { name: 'high', worldFraming: { cameraPosition: [60 * s, -90 * s, 110 * s], lookAt: [0, 0, f * 0.3 * s], horizontalFov: 56 } },
    { name: 'lip', worldFraming: { cameraPosition: [-13 * s, (YC - 11) * s, (f + 13) * s], lookAt: [0, (YC + 3) * s, (f - 2) * s], horizontalFov: 58 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#cfe3ee';
  return {
    faces: plan.faces,
    // the river look, with a narrower shore-foam band: these banks are steep, and 0.8 m of foam read as a white rim
    surfaces: withAqua(plan.surfaces, recipe.aqua == null ? { kind: 'river', shore: 0.25 } : recipe.aqua, 'river', { bg, unit: s }),
    shallows: plan.shallows,
    jets: plan.jets,
    metersPerUnit: 1 / s,
    sky: { zenith: [92, 140, 196], horizon: [214, 228, 236], day: 1, stars: 0, seed: 3 },
    light: { toLight: norm3(SUN) },
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} waterfall`,
    bg,
  };
}
