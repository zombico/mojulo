/**
 * mecha-drones — the drones a frame carries in its legs' bays (an archetype's `docks` and `drones`): the craft shelf's
 * own (craft-shelf: a drone archetype assembled in its look), each docked on its bay, carried with its segment, or
 * launched out of it.
 *
 *   droneBox(kind, look)                  → { lo, hi } the drone's bounds in its own frame (cached)
 *   dronesAt(arch, ctx, frames, { launch }) → [{ i, dock, body, T, lo, hi }]: each drone carried (its `count` of the
 *                                           docks, in the docks' order), its frame in the machine's: docked, its belly
 *                                           on its bay, its nose along the segment; launched, hovering out and over its
 *                                           bay, level, its nose outward
 *   droneItems(placements, kind, look)    → the drones' assembler items, each part of each drone placed by its frame
 *
 * A dock is a body's three hardpoints: its `hp` (the drone's seat; 'dock' unless it says), that and 'N' (a point out
 * along its floor's normal), that and 'Y' (a point toward the drone's nose); a dock that `hang`s holds the drone by its
 * back from a roof, the normal toward the roof, and launches it out of the open side below it. Pure.
 */
import { assembleCraft } from '../craft-shelf/index.js';
import { resolveAssemblerPlacements } from '../worlds/workbench-assembler.js';
import { DEG, about, apply, eulerXYZ, mul3, round3 } from './mecha-common.js';

const CRAFT = new Map();
/** The drone assembled in its look, standing on its gear (cached by its words). */
function craftOf(kind, look) {
  const key = `${kind}|${look ?? ''}`;
  if (!CRAFT.has(key)) {
    const { manifest } = assembleCraft(kind, { ...(look ? { look } : {}), attitude: 'ground', pose: { gear: 0 } });
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of resolveAssemblerPlacements(manifest)) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.bounds.min[k]); hi[k] = Math.max(hi[k], p.bounds.max[k]); }
    CRAFT.set(key, { manifest, lo, hi });
  }
  return CRAFT.get(key);
}
export const droneBox = (kind, look) => { const c = craftOf(kind, look); return { lo: [...c.lo], hi: [...c.hi] }; };

const unit = (v) => { const L = Math.hypot(...v) || 1; return v.map((x) => x / L); };
const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const cols = (x, y, z) => [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]];

/** The drones a frame carries where its frames (in the machine's) stand them: docked, or launched (`launch`). */
export function dronesAt(arch, ctx, frames, { launch = false } = {}) {
  const D = arch.drones, docks = arch.docks ?? [];
  if (!D || !D.count) return [];
  const { lo, hi } = craftOf(D.kind, D.look), seatOn = [-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]], seatHung = [seatOn[0], seatOn[1], -hi[2]];
  // (the frame's middle, where its drones fly out from)
  const mid = [0, 0];
  return docks.slice(0, D.count).map((d, i) => {
    const h = d.hp ?? 'dock', F = frames[d.body], o = apply(F, ctx.hp(d.body, h)), N = apply(F, ctx.hp(d.body, `${h}N`)), Y = apply(F, ctx.hp(d.body, `${h}Y`));
    const z = unit(N.map((v, k) => v - o[k])), y0 = Y.map((v, k) => v - o[k]), yz = y0[0] * z[0] + y0[1] * z[1] + y0[2] * z[2];
    const y = unit(y0.map((v, k) => v - yz * z[k])), x = crossV(y, z);
    // (docked on its cradle, its belly on it; or hung from its bay's roof by its back, `hang`)
    let R = cols(x, y, z), at = o, seat = d.hang ? seatHung : seatOn;
    if (launch && d.hang) {
      // (out of its bay's open underside: the way the underside faces, clear of the bay and a little up, level, its nose
      // that way)
      const r = unit([-z[0], -z[1], 0]), up = d.launch ?? [2.0, 1.6];
      at = [o[0] + r[0] * up[0], o[1] + r[1] * up[0], o[2] + up[1]];
      R = about([0, 0, 1], Math.atan2(-r[0], r[1]));
      seat = seatOn;
    } else if (launch) {
      // (out of its bay: up and away from the frame's middle, level, its nose outward; each bay's drone its own place)
      // (a bay that carries more than one: out along it from its middle, away from its leg)
      const from = d.hp ? F.t : mid, r = unit([o[0] - from[0], o[1] - from[1], 0]), up = d.launch ?? (d.hp ? [1.6, 3.0] : [2.2, 2.4]);
      at = [o[0] + r[0] * up[0], o[1] + r[1] * up[0], o[2] + up[1]];
      R = about([0, 0, 1], Math.atan2(-r[0], r[1]));
    }
    const T = { R, t: [at[0] + R[0][0] * seat[0] + R[0][1] * seat[1] + R[0][2] * seat[2], at[1] + R[1][0] * seat[0] + R[1][1] * seat[1] + R[1][2] * seat[2], at[2] + R[2][0] * seat[0] + R[2][1] * seat[1] + R[2][2] * seat[2]] };
    return { i, dock: d.id, body: d.body, T, lo: [...lo], hi: [...hi] };
  });
}

/** An item's orientation from its `rotate` (degrees, Rz·Ry·Rx, the assembler's). */
const rotOf = (r) => (r ? mul3(mul3(about([0, 0, 1], r[2] * DEG), about([0, 1, 0], r[1] * DEG)), about([1, 0, 0], r[0] * DEG)) : about([0, 0, 1], 0));

/** The drones' parts as assembler items, each drone's every part carried by its frame. */
export function droneItems(placements, kind, look) {
  if (!placements.length) return [];
  const { manifest } = craftOf(kind, look);
  return placements.flatMap((p) => manifest.items.map((it) => {
    const R = mul3(p.T.R, rotOf(it.rotate)), at = apply(p.T, it.at), rot = eulerXYZ(R).map((v) => round3(v) || 0);
    return { id: `drone${p.i}.${it.id}`, source: it.source, at: at.map((v) => round3(v) + 0), ...(it.flip ? { flip: it.flip } : {}), ...(rot.some(Boolean) ? { rotate: rot } : {}) };
  }));
}
