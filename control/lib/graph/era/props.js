/**
 * CORNER THINGS — the non-interactive props a room stage gathers where its floor meets its walls: crates, barrels,
 * planks leaning on the wall, stones, a boulder, debris. Like moss they sit across the junction, so the room reads as
 * used, not as a box. A dressing names the kinds and the share (`props: { kinds, share }`); the placement is the law:
 *   • corners first, in clusters of two or three (things are pushed into corners);
 *   • then the wall base between pilasters, singly, by a seeded die;
 *   • never in a doorway, on the walking line, or in what the dressing keeps clear (its set piece);
 *   • never two of a kind side by side (distinct inside the radius).
 * Every face carries a tint and a normal, so the stage bakes it with the room. A pure function of the plan.
 */
import { hash3, walkLine } from './dirt.js';
import { P, r5, panel, hexRgb } from './geom.js';
import { rockPool, rockRepeats, expandRepeats } from '../polygonizer/rock-pool.js';

export const PROP_KINDS = Object.freeze(['crate', 'barrel', 'planks', 'stones', 'boulder', 'debris']);

const mix = (a, b, t) => a + (b - a) * t;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const WOOD = { key: 'wood-oak', scale: 0.7, tint: [0.62, 0.55, 0.48], group: 'stage:prop' };
const DARK_WOOD = { key: 'wood-walnut', scale: 0.7, tint: [0.7, 0.64, 0.58], group: 'stage:prop' };
const IRON = [0.22, 0.21, 0.2];

/** An oriented box: centre `c`, unit axes `A`, `B`, `C`, half sizes `h` — six panels. */
function obox(out, c, A, B, C, h, surf, cell = 0.5) {
  for (const [N, U, V, hn, hu, hv] of [[A, B, C, h[0], h[1], h[2]], [B, C, A, h[1], h[2], h[0]], [C, A, B, h[2], h[0], h[1]]]) {
    for (const s of [1, -1]) {
      const n = mul(N, s), u = s > 0 ? U : mul(U, -1);
      const o = add(add(add(c, mul(n, hn)), mul(u, -hu)), mul(V, -hv));
      panel(out, o, u, 2 * hu, V, 2 * hv, n, surf, cell);
    }
  }
}

/** An upright n-sided prism (a barrel's staves) of radius r, from z0 to z1, with a cap. */
function prism(out, [x, y], r, z0, z1, sides, surf, tint = null) {
  const pt = (i, z) => P([x + r * Math.cos((i / sides) * 2 * Math.PI), y + r * Math.sin((i / sides) * 2 * Math.PI), z]);
  for (let i = 0; i < sides; i++) {
    const a = ((i + 0.5) / sides) * 2 * Math.PI, n = [Math.cos(a), Math.sin(a), 0].map(r5);
    out.push({ corners: [pt(i, z0), pt(i + 1, z0), pt(i + 1, z1), pt(i, z1)], normal: n, outNormal: n, ...(surf ? { texture: surf.key, textureLit: true, uv: [[i / 2, 0], [(i + 1) / 2, 0], [(i + 1) / 2, (z1 - z0) / surf.scale], [i / 2, (z1 - z0) / surf.scale]].map((q) => q.map(r5)), tint: surf.tint } : { tint }), group: 'stage:prop' });
  }
  const cap = [...Array(sides).keys()].map((i) => pt(i, z1));
  out.push({ corners: cap, normal: [0, 0, 1], outNormal: [0, 0, 1], ...(surf ? { tint: surf.tint.map((v) => v * 0.9) } : { tint }), group: 'stage:prop' });
}

const ITEMS = {
  crate(out, p, N, U, s, i) {
    const w = mix(0.55, 0.85, hash3(i, 1, 5101)), c = add(p, [0, 0, w / 2]);
    obox(out, add(c, mul(N, w / 2)), N, U, [0, 0, 1], [w / 2, w / 2, w / 2], WOOD);
    if (s > 0.5) { const w2 = w * 0.7; obox(out, add(add(c, mul(N, w / 2)), [0, 0, w / 2 + w2 / 2]), N, U, [0, 0, 1], [w2 / 2, w2 / 2, w2 / 2], DARK_WOOD); }
  },
  barrel(out, p, N, U, s, i) {
    const r = 0.3, h = 0.86, c = add(p, mul(N, r + 0.02));
    prism(out, [c[0], c[1]], r, 0, h, 8, DARK_WOOD);
    for (const z of [0.18, h - 0.2]) prism(out, [c[0], c[1]], r + 0.012, z, z + 0.05, 8, null, IRON);
  },
  planks(out, p, N, U, s, i) {
    const n = 2 + Math.floor(hash3(i, 3, 5103) * 2), len = mix(1.6, 2.1, hash3(i, 4, 5105));
    for (let k = 0; k < n; k++) {
      const base = add(add(p, mul(N, 0.55 + 0.05 * k)), mul(U, (k - (n - 1) / 2) * 0.27)), top = add(add(p, mul(N, 0.06)), add(mul(U, (k - (n - 1) / 2) * 0.27), [0, 0, len * 0.93]));
      const C = unit([top[0] - base[0], top[1] - base[1], top[2] - base[2]]), A = unit(cross(U, C)), mid = mul(add(base, top), 0.5);
      obox(out, mid, A, U, C, [0.02, 0.11, Math.hypot(top[0] - base[0], top[1] - base[1], top[2] - base[2]) / 2], k % 2 ? DARK_WOOD : WOOD, 0.6);
    }
  },
};

/** Where things gather in a room stage: corners (clusters), then wall bases between pilasters (singles). */
function spots(plan, pilasters, keepClear) {
  const out = [], off = (plan.kit.plinth?.out ?? 0.2) + 0.12, walk = walkLine(plan);
  const toWalk = (x, y) => { let best = Infinity; for (let i = 0; i + 1 < walk.length; i++) { const [ax, ay] = walk[i], [bx, by] = walk[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)); best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return best; };
  const doors = plan.links.map((l) => { const mid = (l.lo + l.hi) / 2; return l.wall.endsWith('y') ? [mid, l.at, (l.hi - l.lo) / 2 + 1.3] : [l.at, mid, (l.hi - l.lo) / 2 + 1.3]; });
  const clear = (x, y, r = 0.6) => toWalk(x, y) > 1.4 + r && doors.every(([dx, dy, dr]) => Math.hypot(x - dx, y - dy) > dr + r) && keepClear.every((k) => Math.hypot(x - k.x, y - k.y) > k.r + r);
  plan.rooms.forEach((r, ri) => {
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = sx < 0 ? r.x0 + off : r.x1 - off, y = sy < 0 ? r.y0 + off : r.y1 - off;
      if (r.open.includes(sx < 0 ? '-x' : '+x') || r.open.includes(sy < 0 ? '-y' : '+y') || !clear(x, y, 1)) continue;
      // a corner cluster: one item against each wall of the corner (N points into the room)
      out.push({ corner: true, room: r.id, ri, items: [{ p: [x + sx * -0.1, y + sy * -0.75, 0], N: [0, -sy, 0], U: [1, 0, 0] }, { p: [x + sx * -0.75, y + sy * -0.1, 0], N: [-sx, 0, 0], U: [0, 1, 0] }] });
    }
  });
  const byWall = new Map();
  for (const p of pilasters) { const k = `${p.room}|${p.F.o.join()}|${p.F.U.join()}`; if (!byWall.has(k)) byWall.set(k, []); byWall.get(k).push(p); }
  for (const list of byWall.values()) {
    list.sort((a, b) => a.k - b.k);
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i], b = list[i + 1];
      if (b.k !== a.k + 1) continue;
      const u = (a.u + b.u) / 2 + (hash3(a.k, i, 5107) - 0.5) * 1.2, F = a.F, q = add(add(F.o, mul(F.U, u)), mul(F.N, off));
      if (clear(q[0], q[1])) out.push({ corner: false, room: a.room, items: [{ p: [q[0], q[1], 0], N: F.N, U: F.U }], seed: a.k * 7 + i });
    }
  }
  return out;
}

/** The props for a plan: `spec` { kinds, share, rock?, tone? }; `keepClear` [{ x, y, r }]. → faces, baked with the room. */
export function cornerThings(plan, pilasters, spec, keepClear = []) {
  const kinds = spec.kinds.filter((k) => PROP_KINDS.includes(k)), out = [], rocks = [];
  let prev = null;
  spots(plan, pilasters, keepClear).forEach((s, si) => {
    if (!s.corner && hash3(si, 0, 5111) > spec.share) return;
    s.items.forEach((it, ii) => {
      if (!s.corner && ii > 0) return;
      let kind = kinds[Math.floor(hash3(si, ii, 5113) * kinds.length)];
      if (kind === prev) kind = kinds[(kinds.indexOf(kind) + 1) % kinds.length];   // never two of a kind side by side
      prev = kind;
      const seed = si * 11 + ii;
      if (ITEMS[kind]) { ITEMS[kind](out, it.p, it.N, it.U, s.corner ? hash3(seed, 2, 5115) : 0, seed); return; }
      // the rock kinds: stones in a small heap, a boulder with stones at its foot, a scatter of debris
      const n = kind === 'stones' ? 5 : kind === 'boulder' ? 3 : 8;
      for (let k = 0; k < n; k++) {
        const size = kind === 'boulder' && k === 0 ? mix(0.7, 1.05, hash3(seed, k, 5117)) : kind === 'debris' ? mix(0.07, 0.16, hash3(seed, k, 5119)) : mix(0.15, 0.34, hash3(seed, k, 5121));
        const along = (hash3(seed, k, 5123) - 0.5) * (kind === 'debris' ? 1.6 : 0.9), out2 = (k === 0 ? 0.35 : 0.2) + hash3(seed, k, 5125) * (kind === 'debris' ? 0.9 : 0.5);
        const q = add(add(it.p, mul(it.U, along)), mul(it.N, out2));
        rocks.push({ x: r5(q[0]), y: r5(q[1]), z0: 0, size: r5(size) });
      }
    });
  });
  for (const f of out) f.doubleSided = true;   // a prop is seen from every side the walker can reach
  if (rocks.length) {
    const tone = spec.tone || '#6a6660', pool = rockPool({ rock: spec.rock || 'basalt', variants: 6, detail: 0, tone, seed: 'stage-props', group: 'stage:prop' });
    const tint = hexRgb(tone);
    for (const f of expandRepeats(rockRepeats(pool, rocks, { sink: 0.2, group: 'stage:prop' }))) out.push({ corners: f.corners.map(P), normal: f.outNormal, outNormal: f.outNormal, tint, group: 'stage:prop', doubleSided: true });
  }
  return out;
}
