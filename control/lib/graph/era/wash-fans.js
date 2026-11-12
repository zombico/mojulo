/**
 * WASH FANS — where rain runs off a trail: down its own length to where it slows (its dips, the foot of each descent),
 * and over its edge there on the low side,
 * dropping what it carried as it slows and spreads. Each a fan of washed sand and grit, from the trail's edge at a dip,
 * opening downhill as it runs out, its edge ragged (a trail's `skandart` on open ground, beside its rockfall and its
 * trees' deadfall). Centimetres deep, so it reads by its colour, not its height: the land's ground cut as sand where it
 * lies (as a shore's is, era/out-water.js), and no grass on it.
 *
 *   WASH                                   the numbers
 *   washFans(site, { amount, seed }) → { fans: [{ on, at, dir, len }], sand(x, y) → > 0 on a fan off the trail,
 *          lobe(x, y) → > 0 on a lobe on it, laws }: a fan opens to the side lower at its toe; where neither is (a trail
 *          sunk in its banks) the water stays in it and drops its load on the trail itself, a LOBE run on down it
 *          (`lobe` of a fan's length, opening at `lobeSpread` degrees a side)
 *     where the water slows: a dip (a low point of the trail's own profile, `dip` m under the trail `span` m either way)
 *     or the foot of a descent (`fall` m down over the `run` m behind it, its grade here under `level`); the fans those
 *     places' share `amount` (by their dice), each `len` m (the amount's share of its range), opening at `spread` degrees a side
 * Pure; seeded.
 */
import { hash3, vnoise } from './dirt.js';
import { r5 } from './geom.js';

export const WASH = Object.freeze({ dip: 0.05, span: 3, fall: 0.5, run: 6, level: 0.05, apart: 5, len: Object.freeze([1.8, 4.5]), spread: 26, mouth: 0.7, rag: 0.3, lobe: 0.75, lobeSpread: 8 });

const mix = (a, b, t) => a + (b - a) * t;

export function washFans(site, { amount, seed = 1 }) {
  const A = WASH, at = (y) => site.ground(site.trailX(y), y), fans = [], laws = [];
  // where the water slows: the trail's DIPS (its profile's low points, deep enough either way) and the FOOT of each
  // descent (where it levels out, `fall` m down over the `run` m behind it and under `level` of a grade here)
  const dips = [], slope = (y) => (at(y + 0.5) - at(y - 0.5)), lo = A.span, hi = site.D - A.span;
  const isDip = (y) => { const z = at(y); return z < at(y - A.span) - A.dip && z < at(y + A.span) - A.dip && ![-1, -0.5, 0.5, 1].some((d) => at(y + d) < z); };
  const isFoot = (y) => Math.abs(slope(y)) < A.level && (at(y - A.run) - at(y) > A.fall || at(y + A.run) - at(y) > A.fall);
  let inFoot = false;
  for (let y = lo; y <= hi; y += 0.5) {
    const foot = isFoot(y), take = isDip(y) || (foot && !inFoot);
    inFoot = foot;
    if (take && !dips.some((q) => Math.abs(q - y) < A.apart)) dips.push(y);
  }
  dips.forEach((y, k) => {
    if (hash3(seed, k, 8701) >= amount) return;
    // (its way: square to the trail, toward the side lower at its toe; where neither is, the trail is sunk in its banks
    // and the water stays in it: a LOBE on the trail itself, run on down it)
    const x = site.trailX(y), tx = site.trailX(y + 0.5) - site.trailX(y - 0.5), tl = Math.hypot(tx, 1), t = [tx / tl, 1 / tl], n0 = [t[1], -t[0]];
    const len = mix(A.len[0], A.len[1], amount) * mix(0.8, 1.2, hash3(seed, k, 8703)), e = site.halfWAt(y);
    const mouthZ = (sd) => site.ground(x + n0[0] * e * sd, y + n0[1] * e * sd), toeZ = (sd) => site.ground(x + n0[0] * (e + len) * sd, y + n0[1] * (e + len) * sd);
    const sides = [1, -1].filter((sd) => toeZ(sd) < mouthZ(sd)).sort((p, q) => toeZ(p) - mouthZ(p) - (toeZ(q) - mouthZ(q)));
    if (sides.length) {
      const sd = sides[0], n = [n0[0] * sd, n0[1] * sd];
      fans.push({ on: 'side', at: [r5(x + n[0] * e), r5(y + n[1] * e)], dir: [r5(n[0]), r5(n[1])], t, len: r5(len), mouth: e * A.mouth, tan: Math.tan((A.spread * Math.PI) / 180), k });
    } else {
      const down = at(y + A.run) < at(y - A.run) ? 1 : -1, d = [t[0] * down, t[1] * down];
      fans.push({ on: 'trail', at: [r5(x), r5(y)], dir: [r5(d[0]), r5(d[1])], t: n0, len: r5(len * A.lobe), mouth: e * 0.85, tan: Math.tan((A.lobeSpread * Math.PI) / 180), k });
    }
  });
  const field = (on) => (x, y) => {
    let best = -1;
    for (const F of fans) {
      if (F.on !== on) continue;
      const px = x - F.at[0], py = y - F.at[1], u = px * F.dir[0] + py * F.dir[1], v = px * F.t[0] + py * F.t[1];
      if (u < -0.3 || u > F.len + 1) continue;
      const rag = 1 + A.rag * (2 * vnoise(x * 1.3, y * 1.3, seed + 8711 + F.k) - 1);
      best = Math.max(best, Math.min(F.len * rag - u, (F.mouth + u * F.tan) * rag - Math.abs(v), u + 0.3));
    }
    return best;
  };
  const sand = field('side'), lobe = field('trail');
  for (const F of fans) {
    const toe = [F.at[0] + F.dir[0] * F.len, F.at[1] + F.dir[1] * F.len];
    // (water runs down or spreads where it is level, never climbs: its toe no higher than its mouth)
    laws.push({ law: 'downhill', what: `the ${F.on === 'side' ? 'fan' : 'lobe'} at ${F.at.join(', ')}: its toe no higher than its mouth`, ok: site.ground(...toe) <= site.ground(...F.at) + 0.02 });
  }
  laws.push({ law: 'placed', what: `${fans.length} of ${dips.length} places the water slows (${fans.filter((F) => F.on === 'side').length} fans off the trail, ${fans.filter((F) => F.on === 'trail').length} lobes on it)`, ok: fans.length > 0 || !dips.length });
  return { fans: fans.map(({ on, at: a, dir, len }) => ({ on, at: a, dir, len })), sand, lobe, laws };
}
