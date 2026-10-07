/**
 * INTERCEPTORS — immersive detail a built room stage takes on after it is built and before it is lit: things that
 * never collide and are never named, only seen. Each is a site finder, a grower and an aggressiveness from 0 (none)
 * to 1 (the place has given way), seeded from the plan alone, so a recipe grows the same way every time:
 *
 *   litter  loose stones and grit along the walls and in the floor's joints (pebble patches laid flat, a few stones
 *           standing), in the floor's own shade, so they show the floor's variety without drawing the eye
 *   cracks  a crack across a single flagstone here and there (a decal on that stone alone)
 *   grass   tufts in the floor's joints and along the foot of the walls, of every height, thinning toward the way
 *   vines   vines and roots hanging from under the cornice, clear of the piers, longer where the place is wilder
 *   creep   ivy rooted at the foot of the large things (the set piece, the doodads), climbing their sides
 *   fungus  clusters of fungi in the room corners (at the foot of whatever stands in one) and at the feet of the piers
 *
 * A recipe sets `growth` (0…1 for all four plants, or { grass, vines, creep, fungus }), `litter` and `cracks` (0…1).
 * Every face carries its own group (`stage:litter`, `stage:crack`, `stage:grass`, `stage:vine`, `stage:creep`,
 * `stage:fungus`), so a tone colours them as a surface of their own (tone.js), and no anchor or collider is made for
 * any of them (anchors.js). A kind's count is capped, so the page budget holds at full aggressiveness.
 */
import { hash3, walkLine } from './dirt.js';
import { P, r5, card, crossed, wallFrame, openingU } from './geom.js';
import { rockPool, rockRepeats, expandRepeats } from '../polygonizer/rock-pool.js';
import './leaf-cards.js';

export const INTERCEPTOR_IDS = Object.freeze(['litter', 'cracks', 'grass', 'vines', 'creep', 'fungus']);
export const GROWTH_IDS = Object.freeze(['grass', 'vines', 'creep', 'fungus']);
const CAP = { litter: 40, patches: 56, cracks: 90, grass: 160, vines: 100, creep: 60, fungus: 50 };
const GREEN = [0.62, 0.7, 0.5], ROOT = [0.6, 0.54, 0.46], FUNGUS = [0.86, 0.82, 0.74];
const mix = (a, b, t) => a + (b - a) * t;
const SIDES = ['-y', '+x', '+y', '-x'];

/** A recipe's `growth`, `litter`, `cracks` → { litter, cracks, grass, vines, creep, fungus } (each 0…1), or null. */
export function readInterceptors(m) {
  const out = {}, num = (v, k) => {
    if (!(typeof v === 'number' && v >= 0 && v <= 1)) throw new Error(`stage: ${k} is a number from 0 (none) to 1 (the place has given way)`);
    return v;
  };
  if (m.growth !== undefined) {
    if (typeof m.growth === 'number') for (const k of GROWTH_IDS) out[k] = num(m.growth, 'growth');
    else if (m.growth && typeof m.growth === 'object') {
      for (const k of Object.keys(m.growth)) if (!GROWTH_IDS.includes(k)) throw new Error(`stage: growth.${k} is not a growth (${GROWTH_IDS.join(', ')})`);
      for (const k of GROWTH_IDS) if (m.growth[k] !== undefined) out[k] = num(m.growth[k], `growth.${k}`);
    } else throw new Error('stage: growth is 0…1 for every plant, or { grass, vines, creep, fungus }');
  }
  if (m.litter !== undefined) out.litter = num(m.litter, 'litter');
  if (m.cracks !== undefined) out.cracks = num(m.cracks, 'cracks');
  return Object.values(out).some((v) => v > 0) ? out : null;
}

// ── sites ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** How far a point is from the walk (the line through the doorways a walker takes). */
function walkDistance(plan) {
  const walk = walkLine(plan);
  return (x, y) => {
    let best = Infinity;
    for (let i = 0; i + 1 < walk.length; i++) {
      const [ax, ay] = walk[i], [bx, by] = walk[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
      best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    return best;
  };
}
/** The floor's stones: each room's bays (one flagstone tile spans a bay), as cells { room, ri, x0, y0, x1, y1 }. */
export function floorCells(plan) {
  const out = [], bay = plan.kit.bay || 3;
  plan.rooms.forEach((r, ri) => {
    const nx = Math.max(1, Math.round((r.x1 - r.x0) / bay)), ny = Math.max(1, Math.round((r.y1 - r.y0) / bay)), bx = (r.x1 - r.x0) / nx, by = (r.y1 - r.y0) / ny;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) out.push({ room: r.id, ri, i, j, x0: r.x0 + i * bx, y0: r.y0 + j * by, x1: r.x0 + (i + 1) * bx, y1: r.y0 + (j + 1) * by });
  });
  return out;
}
/** The bare runs of each closed wall (doorways cut out): { r, ri, F, u0, u1, side }. */
function wallRuns(plan) {
  const out = [];
  plan.rooms.forEach((r, ri) => SIDES.forEach((side) => {
    if (r.open.includes(side)) return;
    const F = wallFrame(r, side), cuts = r.openings[side].map((op) => openingU(F, op)).sort((a, b) => a[0] - b[0]);
    let u = 0.3;
    for (const [c0, c1] of cuts) { if (c0 - 0.4 - u > 0.4) out.push({ r, ri, F, side, u0: u, u1: c0 - 0.4 }); u = c1 + 0.4; }
    if (F.len - 0.3 - u > 0.4) out.push({ r, ri, F, side, u0: u, u1: F.len - 0.3 });
  }));
  return out;
}
const onF = (F, u, off, z) => [F.o[0] + F.U[0] * u + F.N[0] * off, F.o[1] + F.U[1] * u + F.N[1] * off, z];

// ── growers ───────────────────────────────────────────────────────────────────────────────────────────────────
// a capped kind keeps an even spread of its candidates (every room its share), never the first rooms' fill
const fair = (list, cap) => (list.length <= cap ? list : Array.from({ length: cap }, (_, i) => list[Math.floor(((i + 0.5) * list.length) / cap)]));

/** Loose stones and grit in the floor's stone and shade, never on the way: patches of pebbles laid flat in the joints
 *  and at the foot of the walls (one decal a patch: the variety costs a face), and a few stones standing among them. */
function litter(plan, A, ctx) {
  const out = [], tint = plan.kit.tint.floor, foot = (plan.kit.plinth?.out ?? 0.2) + (plan.kit.gutter?.width ?? 0) + 0.2, spots = [];
  ctx.runs.forEach((w, wi) => {
    const n = Math.round((w.u1 - w.u0) * A * 0.35);
    for (let k = 0; k < n; k++) {
      const p = onF(w.F, mix(w.u0, w.u1, hash3(wi, k, 7101)), foot + 0.3 * hash3(wi, k, 7103), 0);
      if (ctx.toWalk(p[0], p[1]) >= 1.1) spots.push({ x: p[0], y: p[1], s: mix(0.5, 1.1, hash3(wi, k, 7105)), seed: wi * 53 + k, stone: hash3(wi, k, 7125) < 0.7 });
    }
  });
  ctx.cells.forEach((c, ci) => {
    // grit gathered where the stone's joints meet
    if (hash3(ci, 0, 7107) > A * 0.5) return;
    const x = hash3(ci, 1, 7109) < 0.5 ? c.x0 : c.x1, y = hash3(ci, 2, 7111) < 0.5 ? c.y0 : c.y1;
    if (ctx.toWalk(x, y) >= 0.9) spots.push({ x, y, s: mix(0.35, 0.8, hash3(ci, 3, 7113)), seed: 4000 + ci, stone: false });
  });
  const kept = fair(spots, CAP.patches);
  for (const q of kept) {
    const a = hash3(q.seed, 9, 7121) * Math.PI * 2, along = [Math.cos(a), Math.sin(a), 0], up = [-Math.sin(a), Math.cos(a), 0];
    card(out, P([q.x - up[0] * q.s / 2, q.y - up[1] * q.s / 2, 0.008]), along, up, q.s, q.s, 'card:pebbles', tint.map((v) => v * mix(0.9, 1.08, hash3(q.seed, 8, 7123))), 'stage:litter');
  }
  const items = fair(kept.filter((q) => q.stone), CAP.litter).map((q) => ({ x: r5(q.x + (hash3(q.seed, 1, 7127) - 0.5) * 0.4), y: r5(q.y + (hash3(q.seed, 2, 7129) - 0.5) * 0.4), z0: 0, size: r5(mix(0.08, 0.22, hash3(q.seed, 3, 7131) ** 2)) }));
  if (!items.length) return out;
  const pool = rockPool({ rock: plan.kit.rubble?.rock || 'basalt', variants: 4, detail: 0, tone: '#808080', seed: 'stage-litter', group: 'stage:litter' });
  for (const [i, f] of expandRepeats(rockRepeats(pool, items, { sink: 0.35, group: 'stage:litter' })).entries())
    out.push({ corners: f.corners.map(P), normal: f.outNormal, outNormal: f.outNormal, tint: tint.map((v) => r5(v * mix(0.88, 1.08, hash3(i >> 3, 0, 7119)))), group: 'stage:litter', doubleSided: true });
  return out;
}

/** A crack across one flagstone: a decal laid on that stone alone, turned and sized to it. */
function cracks(plan, A, ctx) {
  const out = [], tint = plan.kit.tint.floor.map((v) => v * 0.9);
  for (const { c, ci } of fair(ctx.cells.map((c, ci) => ({ c, ci })).filter(({ ci }) => hash3(ci, 0, 7201) < A * 0.55), CAP.cracks)) {
    // turned any way, the decal's square stays inside its stone: its half diagonal clears every joint
    const w = c.x1 - c.x0, d = c.y1 - c.y0, s = Math.min(w, d) * mix(0.5, 0.68, hash3(ci, 1, 7203)), a = hash3(ci, 2, 7205) * Math.PI, m = s * Math.SQRT1_2 + 0.03;
    const cx = mix(c.x0 + m, c.x1 - m, hash3(ci, 3, 7207)), cy = mix(c.y0 + m, c.y1 - m, hash3(ci, 4, 7209));
    const along = [Math.cos(a), Math.sin(a), 0], up = [-Math.sin(a), Math.cos(a), 0];
    card(out, [cx - up[0] * s / 2, cy - up[1] * s / 2, 0.006], along, up, s, s, 'card:crack', tint, 'stage:crack');
  }
  return out;
}

/** Grass in the joints and at the foot of the walls, of every height; thinning toward the way. */
function grass(plan, A, ctx) {
  const out = [], foot = (plan.kit.plinth?.out ?? 0.2) + (plan.kit.gutter?.width ?? 0) * 0.5, spots = [];
  ctx.runs.forEach((w, wi) => {
    const k0 = Math.round((w.u1 - w.u0) * A * 1.6);
    for (let k = 0; k < k0; k++) {
      const p = onF(w.F, mix(w.u0, w.u1, hash3(wi, k, 7311)), foot, 0);
      if (ctx.toWalk(p[0], p[1]) > 1.2) spots.push([p[0], p[1], wi * 131 + k]);
    }
  });
  ctx.cells.forEach((c, ci) => {
    // along the stone's two near joints, where the soil shows
    for (let k = 0; k < 3; k++) {
      const onX = hash3(ci, k, 7313) < 0.5, x = onX ? mix(c.x0, c.x1, hash3(ci, k, 7315)) : c.x0, y = onX ? c.y0 : mix(c.y0, c.y1, hash3(ci, k, 7317));
      const far = ctx.toWalk(x, y), keep = A * Math.min(1, Math.max(0.08, (far - 0.6) / 2.5));
      if (hash3(ci, k, 7319) < keep) spots.push([x, y, 5000 + ci * 7 + k]);
    }
  });
  for (const [x, y, seed] of fair(spots, CAP.grass)) {
    const h = mix(0.2, 0.9, hash3(seed, 1, 7301) ** 1.4) * mix(0.7, 1, A), w = h * mix(1.2, 1.8, hash3(seed, 2, 7303));
    crossed(out, P([x, y, 0]), hash3(seed, 3, 7305) * Math.PI, w, h, 'card:meadow', GREEN, 'stage:grass');
  }
  return out;
}

/** Vines and roots hanging from the top of the walls, against them, in strips; longer where the place is wilder. */
function vines(plan, A, ctx) {
  // they hang in front of the piers' faces and the niches' frames, falling clear of the wall from under the cornice
  const out = [], top = (r) => r.h - (plan.kit.cornice?.h ?? 0), spots = [], off = (plan.kit.pilaster?.out ?? 0) + 0.06;
  ctx.runs.forEach((w, wi) => { const k0 = Math.round((w.u1 - w.u0) * A * 0.45); for (let k = 0; k < k0; k++) spots.push([w, wi, k]); });
  for (const [w, wi, k] of fair(spots, CAP.vines)) {
    const z1 = top(w.r), len = Math.min(z1 - 0.3, mix(1.8, z1 * 0.92, (A ** 0.8) * hash3(wi, k, 7401))), u = mix(w.u0, w.u1, hash3(wi, k, 7403));
    if (hash3(wi, k, 7405) < 0.65) {
      const wd = mix(0.4, 0.7, hash3(wi, k, 7407));
      card(out, P(onF(w.F, u, off + 0.08 * hash3(wi, k, 7409), z1 - len)), w.F.U, [0, 0, 1], wd, len, 'card:vine', GREEN, 'stage:vine', Math.max(1, Math.round(len / wd / 1.5)));
    } else {
      // a curtain of roots, the strands from the top edge
      const wd = mix(0.6, 1.4, hash3(wi, k, 7411)), l2 = Math.min(len, mix(1.2, 3, hash3(wi, k, 7413)));
      card(out, P(onF(w.F, u, off, z1 - l2)), w.F.U, [0, 0, 1], wd, l2, 'card:roots', ROOT, 'stage:vine');
    }
  }
  return out;
}

/** Ivy rooted at the foot of each large thing, climbing one or two of its sides. */
function creep(plan, A, ctx) {
  const out = [];
  ctx.things.forEach((t, ti) => {
    if (out.length / 2 >= CAP.creep || hash3(ti, 0, 7501) > mix(0.25, 1, A)) return;
    const b = t.box, sides = [[[b.min[0], b.min[1]], [1, 0, 0], [0, -1, 0], b.max[0] - b.min[0]], [[b.max[0], b.min[1]], [0, 1, 0], [1, 0, 0], b.max[1] - b.min[1]],
      [[b.max[0], b.max[1]], [-1, 0, 0], [0, 1, 0], b.max[0] - b.min[0]], [[b.min[0], b.max[1]], [0, -1, 0], [-1, 0, 0], b.max[1] - b.min[1]]];
    const n = A > 0.6 ? 2 : 1, s0 = Math.floor(hash3(ti, 1, 7503) * 4);
    for (let k = 0; k < n; k++) {
      const [o, U, N, len] = sides[(s0 + k * 2) % 4], h = (b.max[2] - b.min[2]) * mix(0.35, 1.05, A * hash3(ti, k, 7505)), wd = len * mix(0.5, 0.95, hash3(ti, k, 7507));
      const u = mix(wd / 2, len - wd / 2, hash3(ti, k, 7509));
      // the ivy card hangs from its top edge, so it is laid upside down: its mass at the root, its tips reaching up
      card(out, P([o[0] + U[0] * u + N[0] * 0.025, o[1] + U[1] * u + N[1] * 0.025, b.min[2] + h]), U, [0, 0, -1], wd, h, 'card:ivy', GREEN, 'stage:creep');
    }
  });
  return out;
}

/** Fungi in the room corners and at the feet of a share of the piers. */
function fungus(plan, A, ctx) {
  const out = [], foot = (plan.kit.plinth?.out ?? 0.2) + 0.12, spots = [];
  plan.rooms.forEach((r, ri) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], ci) => {
    if (hash3(ri, ci, 7605) > mix(0.2, 0.95, A)) return;
    if (r.open.includes(sx < 0 ? '-x' : '+x') || r.open.includes(sy < 0 ? '-y' : '+y')) return;
    let x = sx < 0 ? r.x0 + foot : r.x1 - foot, y = sy < 0 ? r.y0 + foot : r.y1 - foot;
    // a corner a large thing stands in: the fungus grows at that thing's foot instead, on the side facing the room
    const t = ctx.things.find((q) => x > q.box.min[0] - 0.4 && x < q.box.max[0] + 0.4 && y > q.box.min[1] - 0.4 && y < q.box.max[1] + 0.4);
    if (t) {
      const cx = (t.box.min[0] + t.box.max[0]) / 2, cy = (t.box.min[1] + t.box.max[1]) / 2, rx = (r.x0 + r.x1) / 2 - cx, ry = (r.y0 + r.y1) / 2 - cy;
      if (Math.abs(rx) * (r.y1 - r.y0) > Math.abs(ry) * (r.x1 - r.x0)) { x = rx > 0 ? t.box.max[0] + 0.16 : t.box.min[0] - 0.16; y = cy; }
      else { y = ry > 0 ? t.box.max[1] + 0.16 : t.box.min[1] - 0.16; x = cx; }
    }
    if (ctx.toWalk(x, y) < 1) return;
    spots.push([x, y, ri * 17 + ci]);
    if (A > 0.5) spots.push([x - sx * 0.35, y - sy * 0.12, ri * 17 + ci + 500]);
  }));
  (ctx.pilasters || []).forEach((p, pi) => {
    if (hash3(pi, 0, 7607) > A * 0.55) return;
    const q = onF(p.F, p.u + (hash3(pi, 1, 7609) < 0.5 ? -1 : 1) * ((plan.kit.pilaster?.w ?? 0.6) / 2 + 0.15), foot, 0);
    if (ctx.toWalk(q[0], q[1]) > 1) spots.push([q[0], q[1], 9000 + pi]);
  });
  for (const [x, y, seed] of fair(spots, CAP.fungus)) {
    const s = mix(0.25, 0.65, hash3(seed, 1, 7601)) * mix(0.7, 1.1, A);
    crossed(out, P([x, y, 0]), hash3(seed, 2, 7603) * Math.PI, s * 1.4, s, 'card:fungus', FUNGUS, 'stage:fungus', 3);
  }
  return out;
}

const GROWERS = { litter, cracks, grass, vines, creep, fungus };

/**
 * Run a stage's interceptors: `I` from readInterceptors; `geom` the built shell (its pilasters); `things` the large
 * things standing in it, each with a `box` ({ min, max }). → faces, in the stage's own shape (tint, group), unbaked.
 */
export function intercept(plan, geom, things, I) {
  if (!I) return [];
  const ctx = { cells: floorCells(plan), runs: wallRuns(plan), toWalk: walkDistance(plan), pilasters: geom.pilasters || [], things: things.filter((t) => t && t.box) };
  return INTERCEPTOR_IDS.flatMap((k) => (I[k] > 0 ? GROWERS[k](plan, I[k], ctx) : []));
}
