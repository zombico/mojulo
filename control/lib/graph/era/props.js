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
import { P, r5, panel, hexRgb, lathe } from './geom.js';
import { rockPool, rockRepeats, expandRepeats } from '../polygonizer/rock-pool.js';
import { tileFamilyOf } from './tile-specs.js';

export const PROP_KINDS = Object.freeze(['crate', 'barrel', 'planks', 'amphora', 'bones', 'coffin', 'stones', 'boulder', 'debris']);
// DOODADS are the large things (a crate, a barrel, a boulder, jars, a coffin); the rest is scatter. Two doodads never
// stand together (within `apart` metres) unless the dressing declared a cluster there on purpose (`clusters`: how many
// corners may gather two); scatter goes anywhere.
export const DOODAD_KINDS = Object.freeze(['crate', 'barrel', 'boulder', 'amphora', 'coffin']);

const mix = (a, b, t) => a + (b - a) * t;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// the props' timber, by default: old, quiet, straight-grained boards (tile-specs.js `wood`), not a polished figure
export const PROP_WOOD = Object.freeze({
  light: { gen: 'wood', early: [118, 106, 92], late: [96, 85, 72], ringFreq: 10, ringWarp: 0.12, cathedral: 0.04, streakAmt: 0.12, mottle: 5 },
  dark: { gen: 'wood', early: [86, 76, 66], late: [68, 59, 51], ringFreq: 9, ringWarp: 0.12, cathedral: 0.04, streakAmt: 0.14, mottle: 4 },
});
const woodSurf = (spec, tint) => ({ key: `${tileFamilyOf(spec, 'props.wood')}-a`, scale: 0.7, tint, group: 'stage:prop' });
const IRON = [0.22, 0.21, 0.2];

/** An oriented box: centre `c`, unit axes `A`, `B`, `C`, half sizes `h` — six panels. */
export function obox(out, c, A, B, C, h, surf, cell = 0.5) {
  for (const [N, U, V, hn, hu, hv] of [[A, B, C, h[0], h[1], h[2]], [B, C, A, h[1], h[2], h[0]], [C, A, B, h[2], h[0], h[1]]]) {
    for (const s of [1, -1]) {
      const n = mul(N, s), u = s > 0 ? U : mul(U, -1);
      const o = add(add(add(c, mul(n, hn)), mul(u, -hu)), mul(V, -hv));
      panel(out, o, u, 2 * hu, V, 2 * hv, n, surf, cell);
    }
  }
}

const ITEMS = {
  crate(out, p, N, U, s, i, S) {
    const w = mix(0.55, 0.85, hash3(i, 1, 5101)), c = add(p, [0, 0, w / 2]);
    obox(out, add(c, mul(N, w / 2)), N, U, [0, 0, 1], [w / 2, w / 2, w / 2], S.wood);
    if (s > 0.5) { const w2 = w * 0.7; obox(out, add(add(c, mul(N, w / 2)), [0, 0, w / 2 + w2 / 2]), N, U, [0, 0, 1], [w2 / 2, w2 / 2, w2 / 2], S.dark); }
  },
  barrel(out, p, N, U, s, i, S) {
    // turned, not boxed: staves bulging at the belly, iron hoops riding the curve, a lid
    const r = 0.27, h = 0.86, c = add(p, mul(N, r + 0.06)), bulge = (z) => r + 0.05 * Math.sin((z / h) * Math.PI);
    lathe(out, c, [[r, 0], [bulge(0.22), 0.22], [bulge(h / 2), h / 2], [bulge(h - 0.22), h - 0.22], [r, h], [0, h]], 10, S.dark, 'stage:prop');
    for (const z of [0.12, h - 0.17]) lathe(out, c, [[bulge(z) + 0.012, z], [bulge(z + 0.05) + 0.012, z + 0.05]], 10, { key: null, scale: 1, tint: IRON }, 'stage:prop');
  },
  amphora(out, p, N, U, s, i) {
    // two or three jars against the wall, one leaning: shoulders, a neck, a lip
    const n = 2 + (hash3(i, 6, 5131) < 0.5 ? 1 : 0), clay = { key: null, scale: 1, tint: [0.62, 0.42, 0.3] };
    for (let k = 0; k < n; k++) {
      const sz = mix(0.85, 1.15, hash3(i, k, 5133)), c = add(add(p, mul(N, 0.26)), mul(U, (k - (n - 1) / 2) * 0.42));
      lathe(out, c, [[0.05, 0], [0.15, 0.1], [0.2, 0.32], [0.15, 0.55], [0.06, 0.63], [0.07, 0.72], [0.045, 0.73], [0, 0.73]].map(([r, z]) => [r * sz, z * sz]), 8, clay, 'stage:prop');
    }
  },
  coffin(out, p, N, U, s, i, S) {
    // an emptied stone coffin along the wall: its lid knocked askew, the dark inside showing at the gap
    const c = add(p, mul(N, 0.4)), L = mix(1.7, 2.0, hash3(i, 9, 5151)), h = 0.58, A = unit([U[0], U[1], 0]), B = unit([N[0], N[1], 0]);
    obox(out, add(c, [0, 0, h / 2]), A, B, [0, 0, 1], [L / 2, 0.34, h / 2], S.stone, 0.5);
    const tw = 0.06, dark = { key: null, scale: 1, tint: [0.05, 0.05, 0.06], group: 'stage:prop' };
    out.push({ corners: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => P(add(add(c, mul(A, a * (L / 2 - tw))), add(mul(B, b * (0.34 - tw)), [0, 0, h + 0.002])))), normal: [0, 0, 1], outNormal: [0, 0, 1], ...dark });
    const yaw = 0.22 * (hash3(i, 10, 5153) < 0.5 ? -1 : 1), cs = Math.cos(yaw), sn = Math.sin(yaw), A2 = unit(add(mul(A, cs), mul(B, sn))), B2 = unit(add(mul(B, cs), mul(A, -sn)));
    obox(out, add(add(c, mul(A, L * 0.18)), [0, 0, h + 0.05]), A2, B2, [0, 0, 1], [L / 2 + 0.04, 0.38, 0.05], S.stone, 0.5);
  },
  bones(out, p, N, U, s, i) {
    // a heap of long bones, crossed as they fell, and a skull or two on top
    const bone = [0.86, 0.82, 0.72], c = add(p, mul(N, 0.45));
    for (let k = 0; k < 7; k++) {
      const a = hash3(i, k, 5141) * Math.PI, len = mix(0.32, 0.46, hash3(i, k, 5143)), A = [Math.cos(a), Math.sin(a), 0];
      const at = add(c, [(hash3(i, k, 5145) - 0.5) * 0.5, (hash3(i, k, 5147) - 0.5) * 0.5, 0.025 + 0.03 * (k % 3)]);
      obox(out, at, A, unit(cross([0, 0, 1], A)), [0, 0, 1], [len / 2, 0.022, 0.022], { key: null, scale: 1, tint: bone, group: 'stage:prop' }, 0.6);
    }
    skull(out, add(c, [0.05, 0, 0.08]), N, 0.1, bone);
    if (s > 0.4) skull(out, add(add(c, mul(U, 0.25)), [0, 0, 0]), N, 0.09, bone);
  },
  planks(out, p, N, U, s, i, S) {
    const n = 2 + Math.floor(hash3(i, 3, 5103) * 2), len = mix(1.6, 2.1, hash3(i, 4, 5105));
    for (let k = 0; k < n; k++) {
      const base = add(add(p, mul(N, 0.55 + 0.05 * k)), mul(U, (k - (n - 1) / 2) * 0.27)), top = add(add(p, mul(N, 0.06)), add(mul(U, (k - (n - 1) / 2) * 0.27), [0, 0, len * 0.93]));
      const C = unit([top[0] - base[0], top[1] - base[1], top[2] - base[2]]), A = unit(cross(U, C)), mid = mul(add(base, top), 0.5);
      obox(out, mid, A, U, C, [0.02, 0.11, Math.hypot(top[0] - base[0], top[1] - base[1], top[2] - base[2]) / 2], k % 2 ? S.dark : S.wood, 0.6);
    }
  },
};

/** A skull facing N: a lathed cranium and two dark sockets on its face. */
export function skull(out, c, N, r, tint, group = 'stage:prop') {
  // (lathe's profile heights are absolute: lift them to the skull's own z)
  lathe(out, c, [[0, 0], [r * 0.62, r * 0.12], [r * 0.95, r * 0.75], [r * 0.9, r * 1.35], [r * 0.5, r * 1.75], [0, r * 1.85]].map(([a, z]) => [a, c[2] + z]), 6, { key: null, scale: 1, tint }, group);
  const side = unit(cross([0, 0, 1], N)), face = add(c, mul(N, r * 0.93));
  for (const sg of [-1, 1]) {
    const o = add(add(face, mul(side, sg * r * 0.36)), [0, 0, r * 0.95]), a = mul(side, r * 0.17), b = [0, 0, r * 0.2];
    out.push({ corners: [P(add(o, mul(a, -1))), P(add(o, a)), P(add(add(o, a), b)), P(add(add(o, mul(a, -1)), b))], normal: N.map(r5), outNormal: N.map(r5), tint: [0.12, 0.1, 0.09], group });
  }
}

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
/** Where each thing goes and what it is: [{ kind, p, N, U, s, seed, cluster }], the doodad rule kept (see DOODAD_KINDS). */
export function placeThings(plan, pilasters, spec, keepClear = []) {
  const kinds = spec.kinds.filter((k) => PROP_KINDS.includes(k)), scatter = kinds.filter((k) => !DOODAD_KINDS.includes(k));
  const clusters = spec.clusters ?? 1, apart = spec.apart ?? 2.5, placed = [], out = [];
  let prev = null, used = 0;
  spots(plan, pilasters, keepClear).forEach((s, si) => {
    if (!s.corner && hash3(si, 0, 5111) > spec.share) return;
    // a corner gathers two things only where a cluster is declared; elsewhere it holds one
    const cluster = s.corner && used < clusters ? `c${si}` : null;
    if (cluster) used++;
    s.items.forEach((it, ii) => {
      if (ii > 0 && !cluster) return;
      let kind = kinds[Math.floor(hash3(si, ii, 5113) * kinds.length)];
      if (kind === prev) kind = kinds[(kinds.indexOf(kind) + 1) % kinds.length];   // never two of a kind side by side
      if (DOODAD_KINDS.includes(kind) && placed.some((q) => Math.hypot(q.p[0] - it.p[0], q.p[1] - it.p[1]) < apart && (!cluster || q.cluster !== cluster))) {
        kind = scatter.find((k) => k !== prev) || null;   // too near another doodad: scatter instead, or nothing
        if (!kind) return;
      }
      prev = kind;
      const seed = si * 11 + ii, thing = { kind, p: it.p, N: it.N, U: it.U, s: s.corner ? hash3(seed, 2, 5115) : 0, seed, cluster };
      if (DOODAD_KINDS.includes(kind)) placed.push(thing);
      out.push(thing);
    });
  });
  return out;
}

/** The props for a plan: `spec` { kinds, share, clusters?, apart?, rock?, tone?, wood?, stone? }; `keepClear` [{ x, y, r }]. → faces, baked with the room.
 *  `anchors` (an array) takes one record per thing (anchors.js): a doodad's or a built prop's faces carry its id as
 *  their `node`; a heap of stones is pooled with every other, so it is addressed by its place and size alone. */
export function cornerThings(plan, pilasters, spec, keepClear = [], anchors = null) {
  const out = [], rocks = [], count = {};
  const W = spec.wood || PROP_WOOD, S = { wood: woodSurf(W.light, [0.9, 0.88, 0.86]), dark: woodSurf(W.dark, [0.92, 0.9, 0.88]),
    stone: { ...(spec.stone || { key: 'marble-carrara', scale: 1.2, tint: [0.6, 0.58, 0.55] }), group: 'stage:prop' } };
  for (const t of placeThings(plan, pilasters, spec, keepClear)) {
    const { kind, seed } = t, it = t, id = `${kind}-${(count[kind] = (count[kind] || 0) + 1)}`, big = DOODAD_KINDS.includes(kind);
    if (anchors) anchors.push({ id, kind: big ? 'doodad' : 'prop', form: kind, at: P(it.p), N: P(it.N), ...(t.cluster ? { cluster: t.cluster } : {}), ...(big ? { solid: true } : {}) });
    {
      // a doodad's faces carry their own group (`stage:prop-doodad`), so the law reads where the large things stand
      if (ITEMS[kind]) { const n0 = out.length; ITEMS[kind](out, it.p, it.N, it.U, t.s, seed, S); for (let q = n0; q < out.length; q++) { if (big) out[q].group = 'stage:prop-doodad'; if (anchors) out[q].node = id; } continue; }
      // the rock kinds: stones in a small heap, a boulder with stones at its foot, a scatter of debris
      const n = kind === 'stones' ? 5 : kind === 'boulder' ? 3 : 8;
      for (let k = 0; k < n; k++) {
        const size = kind === 'boulder' && k === 0 ? mix(0.7, 1.05, hash3(seed, k, 5117)) : kind === 'debris' ? mix(0.07, 0.16, hash3(seed, k, 5119)) : mix(0.15, 0.34, hash3(seed, k, 5121));
        const along = (hash3(seed, k, 5123) - 0.5) * (kind === 'debris' ? 1.6 : 0.9), out2 = (k === 0 ? 0.35 : 0.2) + hash3(seed, k, 5125) * (kind === 'debris' ? 0.9 : 0.5);
        const q = add(add(it.p, mul(it.U, along)), mul(it.N, out2));
        rocks.push({ x: r5(q[0]), y: r5(q[1]), z0: 0, size: r5(size) });
      }
      // pooled with every other stone: its bounds are its stones' (each about its size across, sunk a fifth)
      if (anchors) { const mine = rocks.slice(-n), a = anchors[anchors.length - 1];
        a.box = { min: P([Math.min(...mine.map((q) => q.x - q.size / 2)), Math.min(...mine.map((q) => q.y - q.size / 2)), 0]), max: P([Math.max(...mine.map((q) => q.x + q.size / 2)), Math.max(...mine.map((q) => q.y + q.size / 2)), Math.max(...mine.map((q) => q.size * 0.8))]) }; }
    }
  }
  for (const f of out) f.doubleSided = true;   // a prop is seen from every side the walker can reach
  if (rocks.length) {
    const tone = spec.tone || '#6a6660', pool = rockPool({ rock: spec.rock || 'basalt', variants: 6, detail: 0, tone, seed: 'stage-props', group: 'stage:prop' });
    const tint = hexRgb(tone);
    for (const f of expandRepeats(rockRepeats(pool, rocks, { sink: 0.2, group: 'stage:prop' }))) out.push({ corners: f.corners.map(P), normal: f.outNormal, outNormal: f.outNormal, tint, group: 'stage:prop', doubleSided: true });
  }
  return out;
}

// Where each prop belongs, in the playscape setting words (../playscape/setting.js). Timber, rope and stone are old
// enough for any pre-industrial room; a coffin and bones keep to the dead. An axis a prop omits fits any world.
const BEFORE_NOW = ['ancient', 'medieval', 'early-modern', 'modern'];
export const PROP_SETTINGS = Object.freeze({
  crate: { era: BEFORE_NOW },
  barrel: { era: BEFORE_NOW },
  planks: { era: BEFORE_NOW },
  amphora: { era: ['ancient', 'medieval'] },
  bones: { place: ['funerary', 'sacred', 'wild'] },
  coffin: { place: ['funerary', 'sacred'] },
  stones: {},
  boulder: {},
  debris: {},
});
