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
// a turned profile cut off at `cut` of its height (a broken vessel's lower part, open where it broke); none: whole
const cutProfile = (prof, cut) => {
  if (!(cut > 0 && cut < 1)) return prof;
  const top = prof[prof.length - 1][1], z = top * cut, out = [];
  for (let i = 0; i < prof.length; i++) {
    if (prof[i][1] <= z) { out.push(prof[i]); continue; }
    const [ra, za] = prof[i - 1], [rb, zb] = prof[i], t = (z - za) / Math.max(1e-9, zb - za);
    out.push([ra + (rb - ra) * t, z]);
    break;
  }
  return out;
};
// fired clay: a pot's terracotta, an urn's darker body
const CLAY = Object.freeze({ pot: Object.freeze({ key: null, scale: 1, tint: [0.62, 0.42, 0.3] }), urn: Object.freeze({ key: null, scale: 1, tint: [0.46, 0.34, 0.28] }) });

/**
 * An oriented box: centre `c`, unit axes `A`, `B`, `C`, half sizes `h` — six panels. A face list that carries a
 * `boxes` array (playscape's destructible items: `blockSink()`) also gets the box itself, with the range of faces it
 * made, so the item can be cut as solids later; any other list gets the panels only.
 */
export function obox(out, c, A, B, C, h, surf, cell = 0.5) {
  const from = out.length;
  for (const [N, U, V, hn, hu, hv] of [[A, B, C, h[0], h[1], h[2]], [B, C, A, h[1], h[2], h[0]], [C, A, B, h[2], h[0], h[1]]]) {
    for (const s of [1, -1]) {
      const n = mul(N, s), u = s > 0 ? U : mul(U, -1);
      const o = add(add(add(c, mul(n, hn)), mul(u, -hu)), mul(V, -hv));
      panel(out, o, u, 2 * hu, V, 2 * hv, n, surf, cell);
    }
  }
  if (out.boxes) out.boxes.push({ c: [...c], A: [...A], B: [...B], C: [...C], h: [...h], group: surf.group, value: surf.tint ? surf.tint[0] : null, from, to: out.length });
}

/** A face list that also keeps the boxes `obox` builds into it (not enumerable: the faces read as before). */
export const blockSink = () => Object.defineProperty([], 'boxes', { value: [], enumerable: false });

const ITEMS = {
  crate(out, p, N, U, s, i, S) {
    // (its size its own die's, or the one asked, `S.size`: a crate stacked on another no bigger than it)
    const w = S?.size ?? mix(0.55, 0.85, hash3(i, 1, 5101)), c = add(p, [0, 0, w / 2]);
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
  // (the vessels a room stores, era/skandart-vessels.js: each one thing, turned on the lathe, fired clay; `S.cut` a
  // broken one's lower part, open at the break)
  pot(out, p, N, U, s, i, S) {
    // squat and wide-bellied, a rolled lip
    const sz = mix(0.85, 1.15, hash3(i, 1, 5161)), c = add(p, mul(N, 0.22 * sz));
    lathe(out, c, cutProfile([[0.09, 0], [0.17, 0.05], [0.21, 0.17], [0.19, 0.29], [0.12, 0.36], [0.13, 0.39], [0.11, 0.4], [0, 0.4]], S?.cut).map(([r, z]) => [r * sz, p[2] + z * sz]), 10, CLAY.pot, 'stage:prop');
  },
  urn(out, p, N, U, s, i, S) {
    // tall on a foot, high-shouldered, a neck and a lid with its knob
    const sz = mix(0.9, 1.12, hash3(i, 2, 5163)), c = add(p, mul(N, 0.24 * sz));
    lathe(out, c, cutProfile([[0.12, 0], [0.12, 0.04], [0.09, 0.07], [0.19, 0.24], [0.24, 0.44], [0.19, 0.6], [0.11, 0.66], [0.13, 0.7], [0.12, 0.72], [0.06, 0.76], [0.03, 0.8], [0, 0.8]], S?.cut).map(([r, z]) => [r * sz, p[2] + z * sz]), 10, CLAY.urn, 'stage:prop');
  },
  jar(out, p, N, U, s, i, S) {
    // one amphora standing: shoulders, a neck, a lip
    const sz = mix(0.9, 1.15, hash3(i, 3, 5165)), c = add(p, mul(N, 0.21 * sz));
    lathe(out, c, cutProfile([[0.05, 0], [0.15, 0.1], [0.2, 0.32], [0.15, 0.55], [0.06, 0.63], [0.07, 0.72], [0.045, 0.73], [0, 0.73]], S?.cut).map(([r, z]) => [r * sz, p[2] + z * sz]), 8, CLAY.pot, 'stage:prop');
  },
  // (and the wooden things a room stores, era/skandart-vessels.js: a chest, a keg, a basket)
  chest(out, p, N, U, s, i, S) {
    // long along the wall, its lid a board's thickness proud, two iron straps over the lid and down the front
    const L = mix(0.72, 0.9, hash3(i, 4, 5167)), D = 0.44, H = 0.42, c = add(add(p, mul(N, D / 2)), [0, 0, H / 2]), up = [0, 0, 1], iron = { key: null, scale: 1, tint: IRON, group: 'stage:prop' };
    obox(out, c, U, N, up, [L / 2, D / 2, H / 2], S.dark, 0.5);
    obox(out, add(c, [0, 0, H / 2 + 0.03]), U, N, up, [L / 2 + 0.02, D / 2 + 0.02, 0.03], S.wood, 0.5);
    // (from the floor up over the lid's top)
    for (const k of [-0.3, 0.3]) obox(out, add(add(c, mul(U, k * L)), [0, 0, 0.03]), U, N, up, [0.025, D / 2 + 0.025, H / 2 + 0.03], iron, 0.5);
  },
  keg(out, p, N, U, s, i, S) {
    // a small barrel: staves bulging, two hoops
    const r = 0.17, h = 0.46, c = add(p, mul(N, r + 0.04)), bulge = (z) => r + 0.03 * Math.sin((z / h) * Math.PI);
    lathe(out, c, [[r, p[2]], [bulge(0.12), p[2] + 0.12], [bulge(h / 2), p[2] + h / 2], [bulge(h - 0.12), p[2] + h - 0.12], [r, p[2] + h], [0, p[2] + h]], 9, S.dark, 'stage:prop');
    for (const z of [0.08, h - 0.11]) lathe(out, c, [[bulge(z) + 0.01, p[2] + z], [bulge(z + 0.035) + 0.01, p[2] + z + 0.035]], 9, { key: null, scale: 1, tint: IRON }, 'stage:prop');
  },
  basket(out, p, N, U, s, i) {
    // woven, flared, open: a rim and the dark of its inside
    const sz = mix(0.9, 1.1, hash3(i, 5, 5169)), c = add(p, mul(N, 0.24 * sz)), wicker = { key: null, scale: 1, tint: [0.62, 0.5, 0.32] };
    lathe(out, c, [[0.15, 0], [0.19, 0.08], [0.23, 0.3], [0.25, 0.34], [0.22, 0.34], [0.2, 0.06], [0, 0.06]].map(([r, z]) => [r * sz, p[2] + z * sz]), 10, wicker, 'stage:prop');
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

/** The props' surfaces a thing is built in (a dressing's `wood` and `stone`, else the shelf's own). */
export function propSurfaces(spec = {}) {
  const W = spec.wood || PROP_WOOD;
  return { wood: woodSurf(W.light, [0.9, 0.88, 0.86]), dark: woodSurf(W.dark, [0.92, 0.9, 0.88]), stone: { ...(spec.stone || { key: 'marble-carrara', scale: 1.2, tint: [0.6, 0.58, 0.55] }), group: 'stage:prop' } };
}
/** One prop of the shelf built on its own (era/skandart-vessels.js): its kind's builder at `p` against the wall whose
 *  normal into the room is N (U along it), `s` its die for what it stacks (a crate's second), `seed` its own. */
export function buildProp(kind, out, p, N, U, s, seed, S = propSurfaces()) {
  if (!ITEMS[kind]) throw new Error(`props: '${kind}' is no prop the shelf builds (${Object.keys(ITEMS).join(', ')})`);
  ITEMS[kind](out, p, N, U, s, seed, S);
}

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

/** The props for a plan: `spec` { kinds, share, clusters?, apart?, rock?, tone?, wood?, stone?, leave? }; `keepClear` [{ x, y, r }]. → faces, baked with the room.
 *  `anchors` (an array) takes one record per thing (anchors.js): a doodad's or a built prop's faces carry its id as
 *  their `node`; a heap of stones is pooled with every other, so it is addressed by its place and size alone. */
export function cornerThings(plan, pilasters, spec, keepClear = [], anchors = null) {
  const out = [], rocks = [], count = {};
  const W = spec.wood || PROP_WOOD, S = { wood: woodSurf(W.light, [0.9, 0.88, 0.86]), dark: woodSurf(W.dark, [0.92, 0.9, 0.88]),
    stone: { ...(spec.stone || { key: 'marble-carrara', scale: 1.2, tint: [0.6, 0.58, 0.55] }), group: 'stage:prop' } };
  for (const t of placeThings(plan, pilasters, spec, keepClear)) {
    // (a kind the room lays by its own causes, `leave`: era/skandart.js's fallen stone; its place is kept, so the dice of
    // every other thing fall as they did)
    if (spec.leave && spec.leave.includes(t.kind)) continue;
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
