/**
 * WATER LIVE — a trail's water drawn as it moves: out-water.js's plan lowered onto the page's own live water, composed
 * as the landscape views compose theirs (landscape/waterfall-view.js). A gen-7 read on the World page draws it
 * (worlds/world-scene.js); every other read, the stills' painted sheets and the exports, keeps the painted water.
 *
 *   river   the surface channel's river (scene/channels/surface.js): its ripples and streaks running downstream along
 *           its line, lanes along its banks, foam where they gather, in the aqua look's river (materials/aqua-look.js)
 *           tinted by the cube's water; its current as fast as its bed falls (LIVE.flow)
 *   falls   a sheet off its lip (materials/jet.js), glassy over the brink and whitening as it falls, mist at its foot,
 *           into its pool: a shallows pond in its own carved bed (materials/shallows.js), still until the fall (or a
 *           wader) disturbs it; the brook to the lip a small river
 *
 *   lowerWaterworks(plan, { sky, bg }) → { surfaces, shallows?, jets?, drawn: [ids] } (each body drawn live, its id in
 *                                        `drawn`: the painted faces carrying it, `waterBody`, are left out)
 *
 * Pure: the plan's numbers alone, the same plan the same water.
 */
import { withAqua } from '../materials/aqua-look.js';
import { normalizeShallows } from '../materials/shallows.js';
import { normalizeJets } from '../materials/jet.js';

/**
 * THE LIVE WATER'S CARD, metres and seconds:
 *   cell        the surface grid's cell
 *   bank        how far past its water a river's mesh runs under its bank (the banks rise over it)
 *   amp, lam    its ripples' height and length
 *   flow        its current: [slowest, fastest] m/s and the fall per metre that runs it fastest
 *   brook       the brook's current and ripples
 *   discharge   the falls' flow, m³/s per metre of lip; lead, the water's depth over the brink
 *   shore       the width of the foam along a river's banks (m)
 */
export const LIVE = Object.freeze({
  cell: 0.5, bank: 0.6, amp: 0.05, lam: 4,
  flow: Object.freeze({ min: 1.6, max: 6, steep: 0.06 }),
  brook: Object.freeze({ flow: 3.5, amp: 0.03, lam: 2.5 }),
  discharge: 0.3, lead: 0.12, shore: 0.25,
});

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const rgb01 = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** A river on the surface channel along `line` (downstream, [x, y, level]), `half` its water's half width. */
function riverSurface(line, half, { flow, amp, lam, fill, sun }) {
  let xa = Infinity, xb = -Infinity, ya = Infinity, yb = -Infinity;
  for (const [x, y] of line) { xa = Math.min(xa, x); xb = Math.max(xb, x); ya = Math.min(ya, y); yb = Math.max(yb, y); }
  const pad = half + LIVE.bank + LIVE.cell, w = xb - xa + 2 * pad, d = yb - ya + 2 * pad, c = rgb01(fill);
  return {
    grid: { w: r4(w), d: r4(d), nx: Math.max(4, Math.round(w / LIVE.cell) + 1), ny: Math.max(4, Math.round(d / LIVE.cell) + 1), cx: r4((xa + xb) / 2), cy: r4((ya + yb) / 2) },
    // (the cube's water: its deep a darker stop, its foam near white; lit by the page's own light, `noLights`)
    deep: c.map((v) => r4(v * 0.45)), surf: c.map(r4), crest: [0.92, 0.95, 0.95], sun, amax: 1, noLights: true,
    river: { pts: line, half: r4(half), bank: r4(half + LIVE.bank), flow: r4(flow), amp: r4(amp), lam: r4(lam) },
  };
}

// a river's current from its bed's fall per metre: the slowest on the level, the fastest at `steep`
const current = (fall, length) => { const F = LIVE.flow, s = length > 0 ? fall / length : 0; return F.min + (F.max - F.min) * Math.min(1, s / F.steep); };

export function lowerWaterworks(plan = [], { sky = null, bg = null } = {}) {
  const sun = sky?.sun?.dir ? sky.sun.dir.map((v) => r4(v * 100)) : [40, -60, 90];
  const rivers = [], brooks = [], ponds = [], falls = [], drawn = [];
  for (const P of plan) {
    if (P.form === 'river' && P.line?.length >= 2) {
      rivers.push(riverSurface(P.line, P.half, { flow: current(P.fall, P.length), amp: LIVE.amp, lam: LIVE.lam, fill: P.fill, sun }));
      drawn.push(P.id);
    } else if (P.form === 'falls' && P.pool?.bed) {
      if (P.brook?.line?.length >= 2) brooks.push(riverSurface(P.brook.line, P.brook.half, { ...LIVE.brook, fill: P.fill, sun }));
      // (its pool a pond in its own bed, the cube's water its colour and the lake's look tinted by it)
      const L = P.pool.at[2];
      ponds.push({ id: `${P.id}:pool`, kind: 'pond', ground: r4(L + 0.25), freeboard: 0.25, deep: P.pool.depth, bed: P.pool.bed, color: P.fill, look: { tint: P.fill } });
      falls.push(P);
      drawn.push(P.id);
    }
  }
  if (!drawn.length) return null;
  const bodies = ponds.length ? normalizeShallows(ponds, { sky, bg }) : [];
  // (the falls: a sheet off the lip, its approach the brook narrowing to it, into its pool)
  const jets = falls.length ? normalizeJets(falls.map((P) => ({
    id: P.id, at: [P.lip[0], P.lip[1], r4(P.lip[2] + LIVE.lead)], dir: P.dir, shape: 'sheet', width: P.width, discharge: r4(LIVE.discharge * P.width), into: `${P.id}:pool`, fall: r4(P.drop + 1),
    approach: { length: 2, head: 0.1, half: P.brook?.half ?? P.width / 2 },
  })), { bodies }) : [];
  // (the rivers and the brooks in the aqua look's river, tinted by the cube's water)
  // (its banks' foam a narrow band: these banks are steep, and the river look's own band reads as a white rim)
  const fill = plan.find((P) => drawn.includes(P.id)).fill, look = { kind: 'river', shore: LIVE.shore, ...(fill ? { tint: fill } : {}) };
  const surfaces = withAqua([...rivers, ...brooks], look, 'river', { sky, bg });
  return { surfaces, ...(bodies.length ? { shallows: { bodies, floaters: [] } } : {}), ...(jets.length ? { jets } : {}), drawn };
}
