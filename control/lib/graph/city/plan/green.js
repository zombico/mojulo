/**
 * THE CITY'S GREEN: trees and shrubs grown on a planned city after it is laid, an interceptor as the room stage's are
 * (era/interceptors.js) and the town's dress is (era/out-town-dress.js): each kind a SITE FINDER over the plan, a
 * GROWER, and an AGGRESSIVENESS from 0 (none) to 1 (every site taken), seeded from the plan alone, its count capped.
 * They are seen and never walked into: no collider, no lot, no law of the plan's moves for them.
 *
 *   street  street trees a metre in from the kerb of every walk wide enough for a tree pit (the grammar's green.walk), at the
 *           grammar's stride, kept clear of the crossings, the doors, the lobbies and the stops
 *   park    trees and shrubs grown loose in the parks (park sites and park districts), thinner toward their middle
 *   plaza   a ring of trees round each plaza, a little inside its edge
 *   court   trees and shrubs in the green the lots leave behind them (the block's gore)
 *
 *   green: 0…1 | { street?, park?, plaza?, court? }    the plan's own aggressiveness, over its grammar's
 *   grammar.green: { street, park, plaza, court, stride, walk, palms, conifers, shrubs }
 *                                                       its defaults, its spacing (m), the least walk a tree stands in
 *                                                       (m), and its species: the share of palms, conifers, shrubs
 *
 * The trees are the vegetation library's species, grown (grow.js) and pooled (pool.js), named by the grammar (green.trees,
 * conifer, palm) and laid at their real heights; a shrub is the legacy city's plant box (fractal-city cityShrub) at the
 * world's scale. (The legacy street tree was sized for the old, smaller city: among real storeys it reads as a stick.) Each
 * kind's dice are its own, per street, per site, per block (`${seed}|green-v1|<kind>:<key>`), so a lot by hand moves
 * no tree. Everything here is in metres until `greenPlan` hands them to the world in its units.
 */
import { streamOf } from './dice.js';
import { CITY_METERS_PER_UNIT as U } from '../fractal-city.js';
import { SPECIES } from '../../vegetation/species.js';

export const GREEN_KINDS = Object.freeze({
  street: 'street trees a metre in from the kerb of every walk wide enough (each in its pit, under a grate), planters on a walk too narrow for a tree, at the grammar\'s stride, clear of crossings, doors and stops',
  median: 'a planted central reservation down an avenue wide enough (the spine\'s and the major streets\'), its trees down the middle, broken at every crossing',
  park: 'trees and shrubs grown loose in the parks, thinner toward their middle',
  plaza: 'a ring of trees round each plaza',
  court: 'trees and shrubs in the green the lots leave behind them',
});
export const GREEN_IDS = Object.freeze(Object.keys(GREEN_KINDS));
// at most this many of each: a page's budget at full aggressiveness (a tree is ~110 faces, a palm ~1 500)
const CAP = { street: 700, median: 260, park: 400, plaza: 120, court: 240, palms: 400 };
/** A median: the least carriageway it stands in (m), its width (m), and how far it stops short of a crossing street's kerb. */
export const MEDIAN = Object.freeze({ road: 14, width: 2.6, clear: 4 });
const r2 = (v) => Math.round(v * 100) / 100;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A recipe's `green` over its grammar's → { street, park, plaza, court } each 0…1. */
export function readGreen(v, G) {
  const base = Object.fromEntries(GREEN_IDS.map((k) => [k, G?.green?.[k] ?? 0]));
  if (v === undefined) return base;
  const num = (x, k) => { if (!(typeof x === 'number' && x >= 0 && x <= 1)) throw new Error(`city: green${k ? `.${k}` : ''} is a number from 0 (none) to 1 (every site)`); return x; };
  if (typeof v === 'number') { num(v); return Object.fromEntries(GREEN_IDS.map((k) => [k, v])); }
  if (!isObj(v)) throw new Error(`city: green is 0…1 for every kind, or { ${GREEN_IDS.join(', ')} }`);
  for (const [k, x] of Object.entries(v)) { if (!GREEN_KINDS[k]) throw new Error(`city: green.${k} is not a kind of green (${GREEN_IDS.join(', ')})`); base[k] = num(x, k); }
  return base;
}

const inRect = (r, x, y, m = 0) => x > r.x0 - m && x < r.x1 + m && y > r.y0 - m && y < r.y1 + m;

/** The sites each kind finds, and what grows there: [{ kind, x, y, plant: 'tree' | 'shrub' | 'palm' | 'conifer', key }]. */
export function cityGreen(d) {
  const G = d.grammar, S = G.green, A = readGreen(d.plan.green, G), out = [];
  if (!S) return out;
  const lots = d.lots.filter((l) => l.use !== 'parking');
  const built = (x, y, m = 0.6) => lots.some((l) => inRect(l, x, y, m)) || d.sites.some((s) => s.mass && inRect(s.mass, x, y, 1.5));
  // what a street tree keeps clear of: the crossings (a corner's sight line), the doors, the lobbies and the stops
  const corners = d.walk.nodes.filter((n) => n.degree >= 3);
  const doors = [...d.lots.map((l) => l.door).filter(Boolean),   // a car park's too: its driveway
    ...(d.entries || []).filter((e) => e.door && !e.error).map((e) => e.door.at)];
  const stops = d.transit.flatMap((t) => t.stops.map((s) => s.at));
  // and never on a carriageway: where a run ends against another street (a T with no crossing on the walk)
  const segs = d.streets.flatMap((st) => st.pts.slice(1).map((b, k) => ({ id: st.id, a: st.pts[k], b, half: st.road / 2 + 0.6 })));
  const onRoad = (x, y) => segs.some(({ a, b, half }) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < half; });
  const near = ({ a, b }, x, y) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)); return [x - a[0] - t * dx, y - a[1] - t * dy]; };
  const clear = (x, y) => !onRoad(x, y) && !corners.some((n) => Math.hypot(n.x - x, n.y - y) < 11) && !doors.some((p) => Math.hypot(p[0] - x, p[1] - y) < 3.5) && !stops.some((p) => Math.hypot(p[0] - x, p[1] - y) < 9);
  // the species a site grows (a stream of its own decides which)
  const species = (rand, shrubby = 0) => { const r = rand(); return r < S.palms ? 'palm' : r < S.palms + S.conifers ? 'conifer' : rand() < shrubby ? 'shrub' : 'tree'; };

  // street: along both walks of every run, a metre in from the kerb, at the stride; a walk too narrow for a tree takes
  // a planter (a shrub in a concrete box) at the kerb instead, a little farther apart, if it is wide enough to pass one
  if (A.street > 0) for (const s of d.streets) {
    if (s.walk < S.walk) {
      if (s.walk < 1.8) continue;
      for (let k = 1; k < s.pts.length; k++) {
        const a = s.pts[k - 1], b = s.pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L, off = s.road / 2 + 0.6, step = S.stride * 1.4;
        for (const side of [-1, 1]) {
          const rand = streamOf(d.plan.seed, 'green', `planter:${s.id}:${k}:${side}`);
          for (let t = step / 2; t < L; t += step) {
            const x = a[0] + tx * t - ty * off * side, y = a[1] + ty * t + tx * off * side;
            if (rand() >= A.street * 0.6 || !clear(x, y) || built(x, y, 0.3) || d.sites.some((z) => inRect(z.rect, x, y))) continue;
            out.push({ kind: 'street', x: r2(x), y: r2(y), plant: 'planter', key: `${s.id}:${k}:${side}:p${Math.round(t)}`, along: r2(Math.atan2(ty, tx)) });
          }
        }
      }
      continue;
    }
    for (let k = 1; k < s.pts.length; k++) {
      const a = s.pts[k - 1], b = s.pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < S.stride) continue;
      const tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L, off = s.road / 2 + Math.min(1, s.walk * 0.25);   // a metre in from the kerb: the walk's middle stays clear
      for (const side of [-1, 1]) {
        const rand = streamOf(d.plan.seed, 'green', `street:${s.id}:${k}:${side}`);
        for (let t = S.stride / 2; t < L; t += S.stride) {
          const x = a[0] + tx * t - ty * off * side, y = a[1] + ty * t + tx * off * side, take = rand() < A.street;
          if (!take || !clear(x, y) || built(x, y, 0.3) || d.sites.some((z) => inRect(z.rect, x, y))) continue;
          out.push({ kind: 'street', x: r2(x), y: r2(y), plant: species(rand), key: `${s.id}:${k}:${side}:${Math.round(t)}`, along: r2(Math.atan2(ty, tx)) });
        }
      }
    }
  }
  // median: down the middle of an avenue wide enough, broken short of every street that crosses it, its trees at the stride
  if (A.median > 0) for (const s of d.streets) {
    if (s.road < MEDIAN.road || !(s.source === 'spine' || s.rank === 'major')) continue;
    const pick = streamOf(d.plan.seed, 'green', `median:${s.id}`);
    if (pick() >= A.median) continue;
    for (let k = 1; k < s.pts.length; k++) {
      const a = s.pts[k - 1], b = s.pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L;
      // where another street's carriageway (and its crossing) cuts the middle line
      const cut = (t) => { const x = a[0] + tx * t, y = a[1] + ty * t; return segs.some((g) => g.id !== s.id && Math.hypot(...near(g, x, y)) < g.half - 0.6 + MEDIAN.clear); };
      let run = null;
      const close = (t1) => { if (run && t1 - run.t0 > 6) out.push({ kind: 'median', strip: true, a: [r2(a[0] + tx * run.t0), r2(a[1] + ty * run.t0)], b: [r2(a[0] + tx * t1), r2(a[1] + ty * t1)], width: MEDIAN.width, key: `${s.id}:${k}:${Math.round(run.t0)}` }); run = null; };
      for (let t = 0; t <= L; t += 1) { if (cut(t)) close(t - 1); else if (!run) run = { t0: t }; }
      close(L);
    }
    const rand = streamOf(d.plan.seed, 'green', `median-trees:${s.id}`);
    for (const m of out.filter((x) => x.strip && x.key.startsWith(`${s.id}:`))) {
      const L = Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]), tx = (m.b[0] - m.a[0]) / L, ty = (m.b[1] - m.a[1]) / L;
      for (let t = S.stride / 2; t < L - 2; t += S.stride) {
        if (rand() >= Math.max(0.5, A.median)) continue;
        out.push({ kind: 'median', x: r2(m.a[0] + tx * t), y: r2(m.a[1] + ty * t), plant: species(rand), key: `${m.key}:${Math.round(t)}` });
      }
    }
  }
  // plaza: a ring a little inside each plaza's edge
  if (A.plaza > 0) for (const s of d.sites.filter((x) => x.use === 'plaza')) {
    const R = s.rect, inset = 4, rand = streamOf(d.plan.seed, 'green', `plaza:${s.id}`);
    const w = R.x1 - R.x0 - 2 * inset, h = R.y1 - R.y0 - 2 * inset, per = 2 * (w + h), n = Math.max(4, Math.floor(per / S.stride));
    for (let i = 0; i < n; i++) {
      let u = (i / n) * per, x, y;
      if (u < w) { x = R.x0 + inset + u; y = R.y0 + inset; } else if ((u -= w) < h) { x = R.x1 - inset; y = R.y0 + inset + u; } else if ((u -= h) < w) { x = R.x1 - inset - u; y = R.y1 - inset; } else { u -= w; x = R.x0 + inset; y = R.y1 - inset - u; }
      if (rand() < A.plaza) out.push({ kind: 'plaza', x: r2(x), y: r2(y), plant: species(rand), key: `${s.id}:${i}` });
    }
  }
  // park and court: a jittered lattice over the green, thinner toward a park's middle (a lawn), shrubs among the trees
  const scatter = (kind, R, key, a, pitch, lawn) => {
    const rand = streamOf(d.plan.seed, 'green', `${kind}:${key}`), cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, half = Math.min(R.x1 - R.x0, R.y1 - R.y0) / 2;
    for (let x = R.x0 + pitch / 2; x < R.x1; x += pitch) for (let y = R.y0 + pitch / 2; y < R.y1; y += pitch) {
      const jx = x + (rand() - 0.5) * pitch * 0.7, jy = y + (rand() - 0.5) * pitch * 0.7;
      const thin = lawn ? Math.min(1, 0.35 + Math.max(Math.abs(jx - cx), Math.abs(jy - cy)) / Math.max(half, 1)) : 1;
      if (rand() >= a * thin || !inRect(R, jx, jy, -1.5) || built(jx, jy)) continue;
      out.push({ kind, x: r2(jx), y: r2(jy), plant: species(rand, S.shrubs), key: `${key}:${Math.round(x)}:${Math.round(y)}` });
    }
  };
  if (A.park > 0) {
    for (const s of d.sites.filter((x) => x.use === 'park')) scatter('park', s.rect, s.id, A.park, 9, true);
    for (const r of d.reserved.filter((x) => x.kind === 'district' && x.use === 'park')) scatter('park', r.rect, r.id, A.park, 11, true);
  }
  if (A.court > 0) d.gore.forEach((g, i) => { if ((g.x1 - g.x0) > 6 && (g.y1 - g.y0) > 6) scatter('court', g, `${g.block ?? 'g'}:${i}`, A.court * 0.5, 8, false); });

  // the caps, each kept by an even stride through its list (never the first N: a cap thins the whole city alike)
  const capped = [];
  for (const kind of GREEN_IDS) {
    capped.push(...out.filter((p) => p.kind === kind && p.strip));
    const xs = out.filter((p) => p.kind === kind && !p.strip), n = CAP[kind];
    capped.push(...(xs.length <= n ? xs : Array.from({ length: n }, (_, i) => xs[Math.floor((i * xs.length) / n)])));
  }
  let palms = 0;
  return capped.map((p) => (p.plant === 'palm' && ++palms > CAP.palms ? { ...p, plant: 'tree' } : p));
}

/**
 * The green as the world draws it, in its units: the shrubs as the facade pipeline's plant boxes (cheap, low, many),
 * and every tree, conifer and palm as an item of its species ({ species, x, y, z0, height }) for the vegetation pool
 * (vegetation/pool.js), which grows a few variants of each and stamps them, each at the detail its size on screen needs.
 * A street tree is kept to its walk's scale (its species' lower heights, never over 14 m); a park's grows taller.
 */
export function greenPlan(d, green = cityGreen(d)) {
  const S = d.grammar.green, boxes = [], items = {}, ground = [];
  for (const p of green) {
    // a median's strip and a planter's box are the ground's and the street's, laid by the scene (greenGround)
    if (p.strip) continue;
    if (p.plant === 'planter') {
      const rand = streamOf(d.plan.seed, 'green', `grow:${p.key}`), h = 0.22 + rand() * 0.1, x = p.x / U, y = p.y / U, z = PLANTER.h / U;
      boxes.push({ kind: 'city-shrub', shape: 'shrub', x: x - 0.12, y: y - 0.12, w: 0.24, d: 0.24, z0: z, z1: z + h + 0.3, green: p.kind,
        plant: { height: h, stemRadius: 0.02, depth: 1, branches: 5, foliage: 'cluster', clusterSize: 0.24 + rand() * 0.06, foliageTiers: 3, branchAngle: 44, upBias: 0.18, lengthRatio: 0.55 } });
      continue;
    }
    const rand = streamOf(d.plan.seed, 'green', `grow:${p.key}`), x = p.x / U, y = p.y / U;
    if (p.plant === 'shrub') {
      const h = 0.28 + rand() * 0.18;   // a metre to a metre and a half
      boxes.push({ kind: 'city-shrub', shape: 'shrub', x: x - 0.15, y: y - 0.15, w: 0.3, d: 0.3, z0: 0, z1: h + 0.4, green: p.kind,
        plant: { height: h, stemRadius: 0.025, depth: 1, branches: 4 + Math.floor(rand() * 3), foliage: 'cluster', clusterSize: 0.28 + rand() * 0.1, foliageTiers: 3, branchAngle: 38 + rand() * 12, upBias: 0.18, lengthRatio: 0.55 } });
      continue;
    }
    const species = p.plant === 'palm' ? S.palm : p.plant === 'conifer' ? S.conifer : S.trees[Math.floor(rand() * S.trees.length)];
    const [lo, hi] = SPECIES[species].heights, top = p.kind === 'street' ? Math.min(hi, Math.max(lo, 14)) : Math.min(hi, 22);
    const h = lo + (Math.max(lo, top) - lo) * (p.kind === 'street' ? 0.2 + rand() * 0.5 : rand());
    (items[species] ||= []).push({ x, y, z0: 0, height: h / U });
  }
  return { boxes, items, ground };
}

/** A planter's box (m): its side and its height. A street tree's pit and grate: its side. */
export const PLANTER = Object.freeze({ side: 1, h: 0.5 });
export const PIT = 1.4;

/**
 * The green's own ground, in metres, for the scene to lay with the city's: each median a raised green strip with a
 * kerb, each street tree's pit under its grate, each planter's concrete box. → [{ kind, corners | box, … }]
 */
export function greenGround(green) {
  const out = [];
  for (const p of green) {
    if (p.strip) {
      const L = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]), nx = -(p.b[1] - p.a[1]) / L * p.width / 2, ny = (p.b[0] - p.a[0]) / L * p.width / 2;
      out.push({ kind: 'median', quad: [[p.a[0] + nx, p.a[1] + ny], [p.a[0] - nx, p.a[1] - ny], [p.b[0] - nx, p.b[1] - ny], [p.b[0] + nx, p.b[1] + ny]], z: 0.15 });
    } else if (p.kind === 'street' && p.plant === 'planter') out.push({ kind: 'planter', box: [p.x - PLANTER.side / 2, p.y - PLANTER.side / 2, p.x + PLANTER.side / 2, p.y + PLANTER.side / 2], h: PLANTER.h, along: p.along });
    else if (p.kind === 'street') out.push({ kind: 'pit', at: [p.x, p.y], side: PIT, along: p.along ?? 0 });
  }
  return out;
}
