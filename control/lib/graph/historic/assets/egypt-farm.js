/**
 * historic/assets/egypt-farm — the New Kingdom countryside's kit (c. 1250 BCE): the tools an estate of
 * Amun farmed the flood plain with and the buildings it raised away from the town (patterns.js family
 * `farm`). Same contract as ./sumer-farm.js: local frame, metres, front −y, `ctx` = { palette, culture,
 * rng }; the record behind each piece is ../record/egypt-industry.js.
 *
 * Much is as in Sumer: the ard, the sickle, the threshing floor, the shaduf. Where Egypt differed
 * the pieces say so:
 *   - the ard is drawn by a yoke lashed to the oxen's horns, and the seed is broadcast and trodden in,
 *     so there is no seed funnel;
 *   - the reapers cut high under the ear with wooden sickles set with flint teeth, leaving the straw
 *     standing;
 *   - the grain goes off in rope nets and donkey panniers, not in carts (wheels are for war and the
 *     great hauls);
 *   - the cattle trample the threshing floor inside a kerb wall, and the grain is winnowed with
 *     scoops;
 *   - scribes measure the grain before it goes up a stair into a court of domed silos.
 * Newer things the period had are here too: the upright two-beam loom, vineyards on forked-post
 * pergolas, pottery beehives, and checkerboard beds round a garden pool.
 *
 * As in Sumer, tools and buildings only, at rest: people and beasts come from their own builders.
 */
import { slopedFlight, beam } from './kit.js';
import { box, drum, dome, plate, basket, jar } from './sumer-farm.js';
import { scaleHex } from '../../polygonizer/vexar.js';

const DARK = '#2b2622';

// ── small tools ──

/** A wooden sickle set with flint teeth (≈ 0.45 m): the Sumerian crescent in wood, a row of flint on its inner edge. */
export function egSickle(at, dir, P, flat = false) {
  const [x, y, z] = at, pt = (u, v) => (flat ? [x + u * dir, y - v, z] : [x + u * dir, y, z + v]);
  const out = [beam('sickle', pt(0, -0.08), pt(0, 0.08), 0.05, P.wood)];
  const arc = [[0, 0.08], [-0.13, 0.18], [-0.27, 0.15], [-0.36, 0.04]];
  for (let i = 0; i < arc.length - 1; i++) out.push(beam('sickle', pt(...arc[i]), pt(...arc[i + 1]), 0.045, P.wood));
  for (let i = 1; i < arc.length - 1; i++) out.push(beam('sickle-teeth', pt(arc[i][0], arc[i][1] - 0.035), pt(arc[i + 1][0] + 0.02, arc[i + 1][1] - 0.035), 0.022, P.flint));
  return out;
}
/** The A-shaped hoe: a handle and a broad wooden blade joined at an acute angle, a rope across them. The foot at (x, y), the handle's top at `top`. */
export function aHoe(x, y, top, P) {
  const mid = (t) => [x + (top[0] - x) * t, y + (top[1] - y) * t, (top[2]) * t];
  const tip = [x, y - 0.55, 0.03];
  return [beam('hoe-handle', [x, y, 0.05], top, 0.05, P.wood), beam('hoe-blade', [x, y, 0.05], tip, 0.09, scaleHex(P.wood, 1.1)), beam('hoe-rope', mid(0.35), [x, y - 0.3, 0.04], 0.025, scaleHex(P.reed, 0.7))];
}
/** A three-pronged wooden fork lying from (x, y) toward angle a. */
function fork(x, y, a, P, z = 0.03) {
  const c = Math.cos(a), s = Math.sin(a), L = 1.5, out = [beam('fork', [x, y, z], [x + c * L, y + s * L, z], 0.045, P.wood)];
  for (const o of [-0.1, 0, 0.1]) out.push(beam('fork-prong', [x + c * L - s * o * 0.3, y + s * L + c * o * 0.3, z], [x + c * (L + 0.35) - s * o, y + s * (L + 0.35) + c * o, z], 0.03, P.wood));
  return out;
}
/** A pair of winnowing scoops: two small curved boards, one on the other. */
const scoops = (x, y, z, P) => [box('winnowing-scoop', x, y, 0.3, 0.24, z, z + 0.04, scaleHex(P.wood, 1.12)), box('winnowing-scoop', x + 0.12, y + 0.1, 0.3, 0.24, z + 0.04, z + 0.08, scaleHex(P.wood, 1.05))];
/** A rope carrying net bulging with ears: a dome of grain under two rope straps. */
const net = (cx, cy, r, P, z = 0) => [
  dome(cx, cy, r, z, z + r * 1.1, P.grain, { kind: 'carrying-net', sides: 9 }),
  beam('net-rope', [cx - r, cy, z + 0.08], [cx, cy, z + r * 1.12], 0.03, scaleHex(P.reed, 0.7)), beam('net-rope', [cx, cy, z + r * 1.12], [cx + r, cy, z + 0.08], 0.03, scaleHex(P.reed, 0.7)),
  beam('net-rope', [cx, cy - r, z + 0.08], [cx, cy, z + r * 1.12], 0.03, scaleHex(P.reed, 0.7)), beam('net-rope', [cx, cy, z + r * 1.12], [cx, cy + r, z + 0.08], 0.03, scaleHex(P.reed, 0.7)),
];
/** A sheaf cut high: a thick bundle of ears on a short thin stub of straw, lying from (x, y) toward angle a. */
const earSheaf = (x, y, a, P, z = 0) => [
  beam('sheaf', [x, y, z + 0.08], [x + Math.cos(a) * 0.25, y + Math.sin(a) * 0.25, z + 0.08], 0.1, P.straw),
  beam('sheaf-ears', [x + Math.cos(a) * 0.22, y + Math.sin(a) * 0.22, z + 0.14], [x + Math.cos(a) * 0.62, y + Math.sin(a) * 0.62, z + 0.14], 0.28, P.grain),
];
/** A heqat, the grain measure: an open wooden tub. */
const heqat = (cx, cy, P, z = 0) => drum(cx, cy, 0.22, z, z + 0.34, scaleHex(P.wood, 1.1), { kind: 'grain-measure', sides: 10, open: true, lip: 0.035 });
/** A tree with a broad crown (the sycamore fig): a trunk and three lumped domes. */
export function sycamore(cx, cy, s, P) {
  const g = P.sycamore, h = 3.2 * s;
  return [
    beam('tree-trunk', [cx, cy, 0], [cx + 0.2 * s, cy + 0.1 * s, h], 0.42 * s, scaleHex(P.wood, 0.9)),
    dome(cx, cy, 2.6 * s, h - 0.4 * s, h + 2.4 * s, g, { kind: 'tree-crown', sides: 10 }),
    dome(cx - 1.4 * s, cy + 0.8 * s, 1.6 * s, h - 0.8 * s, h + 1.2 * s, scaleHex(g, 0.92), { kind: 'tree-crown', sides: 9 }),
    dome(cx + 1.5 * s, cy - 0.6 * s, 1.5 * s, h - 0.6 * s, h + 1.4 * s, scaleHex(g, 1.08), { kind: 'tree-crown', sides: 9 }),
  ];
}
/** A wine amphora: a tall body tapering to a point, a short neck, a mud stopper. */
function amphora(cx, cy, P, z = 0, lean = 0) {
  const t = P.copper;
  return [
    drum(cx, cy, 0.1, z, z + 0.22, scaleHex(t, 1.05), { kind: 'amphora', sides: 9, taper: 2.1 }),
    drum(cx + lean * 0.3, cy, 0.21, z + 0.22, z + 0.62, scaleHex(t, 1.05), { kind: 'amphora', sides: 9, taper: 0.55 }),
    drum(cx + lean * 0.4, cy, 0.09, z + 0.62, z + 0.74, scaleHex(P.mud, 0.9), { kind: 'jar-stopper', sides: 8 }),
  ];
}

// ── the tools at work ──

/**
 * The ard at rest in its furrow: the stock with its share, the long pole forward to the horn yoke
 * lying on the ground, two long handles rising back joined by a crossbar. No seed funnel: Egypt
 * broadcast its seed and drove the flock over it; a seed bag lies by the plough when sowing.
 */
export const egArd = {
  id: 'eg-ard', designed: true, patterns: ['plough-team', 'strip-fields'],
  read: 'An Egyptian ard at rest in its furrow: share and stock, a long pole to the horn yoke on the ground, two long handles with a crossbar.',
  notes: [
    'Yoke: a straight beam 1.8 m lying across the pole\'s end (in life lashed to the horns, not on the neck).',
    'Stock: a short box on the ground, the share a wedge at its nose; the pole runs from it ≈ 4 m forward, rising a little from the yoke.',
    'Handles: two beams from the stock\'s heel back and up to ≈ 1.05 m, splayed 0.6 m, a crossbar between them at two thirds.',
    'Sowing (`slot.seeder`): a linen seed bag and a basket of seed by the stock; there is no funnel. The fresh furrow runs back to the slot\'s end.',
  ],
  envelope: { w: [2.8, 3.6], d: [8.5, 10] },
  build({ W, D, slot }, { palette: P }) {
    const cx = W / 2, out = [], wood = P.wood, yP = 4.5;
    out.push(beam('yoke', [cx - 0.9, 0.6, 0.08], [cx + 0.9, 0.6, 0.08], 0.12, wood));
    out.push(beam('plough-pole', [cx, 0.55, 0.12], [cx, yP + 0.1, 0.3], 0.1, wood));
    out.push(box('plough', cx - 0.07, yP, 0.14, 0.7, 0.02, 0.18, wood));
    out.push({ kind: 'plough-share', solid: 'wedge', x: cx - 0.08, y: yP - 0.36, w: 0.16, d: 0.36, z0: 0, z1: 0.16, rise: 'y+', tint: scaleHex(wood, 0.8) });
    const g = [];
    for (const o of [-1, 1]) { const a = [cx + o * 0.05, yP + 0.55, 0.15], b = [cx + o * 0.3, yP + 1.85, 1.05]; out.push(beam('plough-stilt', a, b, 0.065, wood)); g.push(a.map((v, i) => v + (b[i] - v) * 0.66)); }
    out.push(beam('plough-crossbar', g[0], g[1], 0.05, wood));
    if (slot.seeder) out.push(box('seed-bag', cx + 0.6, yP + 0.2, 0.36, 0.3, 0, 0.42, P.cloth), basket(cx + 0.75, yP + 0.85, 0.24, 0.3, P), drum(cx + 0.75, yP + 0.85, 0.2, 0.26, 0.31, P.grain, { kind: 'seed', sides: 8 }));
    return { boxes: out, grounds: [{ kind: 'furrow', x: cx - 0.28, y: yP + 0.6, w: 0.56, d: Math.max(0.1, D - yP - 0.6), z: 0.035, fill: scaleHex(P.tilled, 0.82) }] };
  },
};

/**
 * Where the reaping stopped. Egypt cut high, under the ear: the straw is left standing (the layout
 * draws it as tall stubble) and the sheaves are short bundles of ears. The flint-toothed sickles lie
 * among them; a rope carrying net stands full, ready to be lifted onto a donkey, another half filled;
 * a gleaner's basket, and a water jar in a palm-rib shade.
 */
export const egHarvestEdge = {
  id: 'eg-harvest-edge', designed: true, patterns: ['harvest'],
  read: 'Where the high reaping stopped: short sheaves of ears, flint-toothed sickles, carrying nets full of ears, a gleaner\'s basket, a water jar in a little shade.',
  notes: [
    'Sickles: wood with a flint row on the inner edge, ≈ 0.45 m, one per ~2.4 m of the cut\'s front.',
    'Sheaves: ears only (short straw), lying behind the cut; two rope nets bulging with ears (domes under rope straps), one half full.',
    'A small shade of palm ribs on two forked posts with a water jar under it; a gleaner\'s basket at the back.',
  ],
  envelope: { w: [8, 18], d: [4.5, 7] },
  build({ W, D }, { palette: P, rng }) {
    const out = [], n = Math.max(2, Math.floor(W / 2.4));
    for (let i = 0; i < n; i++) out.push(...egSickle([(i + 0.5) * (W / n) + (rng() - 0.5) * 0.4, 1.0 + rng() * 0.6, 0.03], rng() < 0.5 ? 1 : -1, P, true));
    for (let i = 0; i < n * 2; i++) {
      out.push(...earSheaf(0.3 + rng() * (W - 1.3), 2.0 + rng() * Math.max(0.5, D - 4.2), rng() * 6.283, P));
    }
    const nx = W * (0.25 + rng() * 0.2);
    out.push(...net(nx, D - 1.2, 0.55, P), ...net(nx + 1.4, D - 1.1, 0.42, P));
    const sx = W * 0.72, sy = D - 1.8;
    for (const o of [0, 1.4]) out.push(beam('shade-post', [sx + o, sy, 0], [sx + o, sy, 1.6], 0.08, P.wood));
    out.push(plate('palm-ribs', sx - 0.3, sy - 0.5, 2.0, 0.05, 1.1, 1.6, 1.7, scaleHex(P.straw, 0.9)), ...jar(sx + 0.7, sy + 0.1, 1.1, scaleHex(P.copper, 1.1)));
    out.push(basket(W * 0.12 + rng(), D - 0.7, 0.26, 0.32, P));
    return out;
  },
};

/**
 * The grain going off the field: the donkeys' loads set down at the field's end — two pack saddles,
 * each with a pair of rope nets heaped with sheaves either side — and a carrying pole with its two
 * nets for the men. Egypt carried its harvest; the cart was not a farm tool there.
 */
export const egGrainPacks = {
  id: 'eg-grain-packs', designed: true, patterns: ['harvest'],
  read: 'Donkey loads set down at the field\'s end: pack saddles with a rope net of sheaves either side, a carrying pole with two nets.',
  notes: [
    'Pack saddle: a padded box 0.6 × 0.9 m, 0.3 high, a girth strap over it; a full net (dome of ears under rope straps) either side of it.',
    'Two loads along the slot; a carrying pole (beam 2.2 m) laid between two nets at its ends. The donkeys and the carriers are placed by their own builders.',
    'Behind: a goad and a heap of loose ears.',
  ],
  envelope: { w: [2.2, 3], d: [6.5, 8] },
  build({ W, D }, { palette: P }) {
    const cx = W / 2, out = [];
    for (const y of [1.4, 3.6]) {
      out.push(box('pack-saddle', cx - 0.3, y - 0.45, 0.6, 0.9, 0, 0.3, scaleHex(P.cloth, 0.88)), box('girth', cx - 0.33, y - 0.05, 0.66, 0.1, 0, 0.32, scaleHex(P.reed, 0.7)));
      out.push(...net(cx - 0.75, y, 0.4, P), ...net(cx + 0.75, y, 0.4, P));
    }
    const py = D - 1.4;
    out.push(...net(cx - 0.8, py, 0.38, P), ...net(cx + 0.8, py, 0.38, P), beam('carrying-pole', [cx - 1.1, py - 0.5, 0.06], [cx + 1.1, py - 0.5, 0.06], 0.06, P.wood));
    out.push(beam('goad', [cx + 0.3, D - 0.4, 0.03], [cx + 1.0, D - 0.2, 0.03], 0.03, P.wood), dome(cx - 0.4, D - 0.4, 0.4, 0, 0.22, P.grain, { kind: 'grain-heap', sides: 8 }));
    return out;
  },
};

/**
 * The scribes' shade: where the harvest is counted before it is stored — a light mat roof on four
 * posts, a low stool, the writing chest with the scribe's palette and a roll of papyrus on it, the
 * heqat measures and the heap they are filled from.
 */
export const egScribesShade = {
  id: 'eg-scribes-shade', designed: true, patterns: ['storehouse', 'harvest'],
  read: 'A mat shade over a low stool and a writing chest with palette and papyrus; heqat measures by a grain heap.',
  notes: [
    'Shade: four posts 1.9 m, a mat roof (thin plate) 1.8 × 2.4.',
    'Chest: a box 0.5 × 0.35 × 0.4 with the palette (thin box, two ink wells) and a papyrus roll (pale beam) on it; a stool 0.25 high.',
    'In front: a grain heap and two heqat measures. The scribes and measurers are placed by their own builders.',
  ],
  envelope: { w: [1.8, 2.4], d: [3.2, 4.2] },
  build({ W, D }, { palette: P }) {
    const out = [], y0 = D - 2.4, x0 = 0.15, sw = W - 0.3;
    for (const [px, py] of [[x0, y0], [x0 + sw, y0], [x0, D - 0.1], [x0 + sw, D - 0.1]]) out.push(box('shade-post', px - 0.05, py - 0.05, 0.1, 0.1, 0, 1.9, P.wood));
    out.push(plate('reed-mat', x0 - 0.1, y0 - 0.1, sw + 0.2, 0.05, 2.3, 1.9, 2.0, P.reed));
    out.push(box('writing-chest', W / 2 - 0.25, D - 1.4, 0.5, 0.35, 0, 0.4, scaleHex(P.wood, 1.15)), box('scribe-palette', W / 2 - 0.16, D - 1.32, 0.32, 0.07, 0.4, 0.42, scaleHex(P.wood, 1.35)));
    out.push(beam('papyrus-roll', [W / 2 - 0.2, D - 1.18, 0.44], [W / 2 + 0.15, D - 1.18, 0.44], 0.05, P.cloth), box('stool', W / 2 - 0.2, D - 0.75, 0.4, 0.35, 0, 0.25, P.wood));
    out.push(dome(W / 2, 0.9, 0.7, 0, 0.55, P.grain, { kind: 'grain-heap', sides: 10 }), heqat(W / 2 - 0.65, 1.75, P), heqat(W / 2 + 0.6, 1.8, P));
    return out;
  },
};

/**
 * The threshing floor, Egyptian: a round of beaten earth with a low kerb wall, the ears spread on it for
 * the cattle to trample (no sledge), wooden forks lying on the straw; the winnowed grain heaped, the
 * pairs of winnowing scoops on it, the chaff blown aside, a heqat by the heap; sheaves waiting.
 */
export const egThreshingFloor = {
  id: 'eg-threshing-floor', designed: true, patterns: ['threshing-floor', 'harvest'],
  read: 'A round threshing floor inside a low kerb wall, ears spread for the cattle to tread, forks, a winnowed heap with its scoops, chaff, waiting sheaves.',
  notes: [
    'Floor: a 16-sided disc the slot\'s width, beaten earth; the ears a ring spread inside; a kerb wall 0.55 m high round it with a gap for the cattle.',
    'Forks: three-pronged wooden forks lying on the straw. No sledge: in Egypt the cattle trod the grain out.',
    'Heaps: the winnowed grain (a cone) with two pairs of winnowing scoops on it and a heqat; the chaff heap paler, downwind.',
    'In the flood season (`slot.season` \'flood\') the floor is swept bare and the heap sealed.',
  ],
  envelope: { w: [16, 24], d: [16, 24] },
  build({ W, D, slot }, { palette: P, rng }) {
    const cx = W / 2, cy = D / 2, R = Math.min(W, D) / 2 - 0.5, out = [], bare = slot.season === 'flood';
    const ring = (r, n = 16) => Array.from({ length: n }, (_, i) => { const a = (i / n) * 6.2832; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
    const fan = (kind, r, z, fill) => { const p = ring(r); return p.map((q, i) => ({ kind, poly: [[cx, cy], q, p[(i + 1) % p.length]], x: cx - r, y: cy - r, w: 2 * r, d: 2 * r, z, fill })); };
    const grounds = [...fan('threshing-floor', R, 0.04, P.floor)];
    if (!bare) grounds.push(...fan('threshing-straw', R * 0.72, 0.05, P.chaff));
    // the kerb wall, a gap to the south for the cattle
    const kerb = ring(R + 0.1, 28);
    kerb.forEach((q, i) => { const n = kerb[(i + 1) % kerb.length]; if (!(Math.min(q[1], n[1]) > cy + R * 0.8 && Math.abs((q[0] + n[0]) / 2 - cx) < 1.6)) out.push(beam('fold-wall', [q[0], q[1], 0.27], [n[0], n[1], 0.27], 0.55, scaleHex(P.mud, 1.1))); });
    const hx = cx - R * 0.28, hy = cy - R * 0.36, hr = Math.min(1.9, R * 0.22);
    out.push(drum(hx, hy, hr, 0, hr * 0.62, P.grain, { kind: 'grain-heap', sides: 14, taper: 0.42 }));
    if (bare) out.push(drum(hx, hy, hr * 0.42, hr * 0.62, hr * 0.85, scaleHex(P.mud, 1.05), { kind: 'grain-seal', sides: 14, taper: 0.12 }));
    else {
      out.push(drum(hx, hy, hr * 0.42, hr * 0.62, hr * 0.8, P.grain, { kind: 'grain-heap', sides: 14, taper: 0.2 }));
      out.push(...scoops(hx - 0.4, hy - hr * 0.5, hr * 0.42, P), ...scoops(hx + hr * 0.3, hy + 0.2, hr * 0.3, P));
      out.push(drum(hx + hr * 2.6, hy + 0.9, hr * 1.15, 0, hr * 0.36, P.chaff, { kind: 'chaff-heap', sides: 12, taper: 0.3 }));
      for (let k = 0; k < 3; k++) out.push(...fork(cx - R * 0.3 + k * 1.6, cy + R * 0.35 + rng() * 0.6, rng() * 6.283, P, 0.07));
      for (let i = 0; i < 10; i++) out.push(...earSheaf(cx + R * 0.6 + rng() * R * 0.18, cy - R * 0.3 + rng() * R * 0.5, rng() * 6.283, P));
    }
    out.push(heqat(hx - hr - 0.6, hy + hr * 0.6 - 0.7, P));
    return { boxes: out, grounds };
  },
};

// ── buildings away from the town ──

/**
 * The granary court (the Meketre model's, and the tomb paintings'): a walled yard, and along its back a
 * row of tall domed silos of plastered mud brick, each with a hatch at its crown and a small door at its
 * foot to draw the grain off; a stair of mud brick up the side wall to the silo tops, where the grain is
 * tipped in. A heap waiting to go up, a ladder, sacks, a heqat.
 */
export const egSiloCourt = {
  id: 'eg-silo-court', designed: true, patterns: ['granary', 'storehouse', 'sun-dried-earth'],
  read: 'A walled granary court: a row of tall domed mud silos with crown hatches and foot doors, a stair up to their tops, a heap waiting, sacks.',
  notes: [
    'Wall: mud brick 0.45 thick, 2.4 m high, a 1.6 m gate in the front.',
    'Silos: drums r ≈ 1.25, 3.0 m, under domes to ≈ 4.7 m, mud plaster; a dark hatch at each crown, a small dark door at the foot facing the court.',
    'Stair: a mud-brick flight up the inside of the side wall to a walk at 3.2 m by the silo tops; a ladder against the last silo.',
    'Court: a grain heap, sacks, a heqat. In the flood season (`slot.season` \'flood\') the court is empty, the doors sealed.',
  ],
  envelope: { w: [10, 16], d: [6, 9] },
  build({ W, D, slot }, { palette: P, rng }) {
    const mud = P.earth[2], dark = DARK, t = 0.45, H = 2.4, out = [], gw = 1.6, gx = W * 0.35;
    out.push(box('yard-wall', 0, 0, gx - gw / 2, t, 0, H, mud), box('yard-wall', gx + gw / 2, 0, W - gx - gw / 2, t, 0, H, mud));
    out.push(box('yard-wall', 0, D - t, W, t, 0, H, mud), box('yard-wall', 0, t, t, D - 2 * t, 0, H, mud), box('yard-wall', W - t, t, t, D - 2 * t, 0, H, mud));
    const sw = 2.2, sx0 = t + sw + 0.2, r = Math.min(1.25, (D - 2 * t) * 0.24), n = Math.max(2, Math.floor((W - sx0 - t) / (2 * r + 0.25))), pitch = (W - sx0 - t) / n, sy = D - t - r - 0.15;
    for (let i = 0; i < n; i++) {
      const sx = sx0 + pitch * (i + 0.5), tint = scaleHex(P.mud, 1.12 + (i % 2) * 0.04);
      out.push(drum(sx, sy, r, 0, 3.0, tint, { kind: 'silo', sides: 12 }), dome(sx, sy, r, 3.0, 4.7, tint, { kind: 'silo', sides: 12 }), drum(sx, sy, 0.24, 4.55, 4.75, dark, { kind: 'silo-hatch', sides: 8 }));
      out.push(box('silo-door', sx - 0.25, sy - r - 0.02, 0.5, 0.06, 0.25, 0.85, slot.season === 'flood' ? scaleHex(P.mud, 0.9) : dark));
    }
    // the stair up the west wall to a walk along the back by the silo tops
    out.push(...slopedFlight({ x: t, y: t + 0.4, w: sw, d: D - 2 * t - 1.8 }, 0, 3.2, P.stair, 'y+', { cheek: 0.25, cheekTint: mud, riser: 0.3 }));
    out.push(box('silo-walk', t, D - t - 1.4, sx0 - t, 1.4, 0, 3.2, mud));
    const lx = sx0 + pitch * (n - 0.5) + r * 0.7;
    for (const o of [0, 0.45]) out.push(beam('ladder', [lx + o, sy - r - 0.9, 0], [lx + o, sy - r * 0.3, 3.4], 0.06, P.wood));
    if (slot.season !== 'flood') {
      out.push(dome(W * 0.62, 1.9, 1.1, 0, 0.75, P.grain, { kind: 'grain-heap', sides: 11 }), heqat(W * 0.62 - 1.5, 1.3, P));
      for (let i = 0; i < 3; i++) out.push(box('sack', W * 0.8 + i * 0.3 - 0.4, 0.7 + rng() * 0.2 + i * 0.5, 0.6, 0.42, 0, 0.55, scaleHex(P.cloth, 0.92 + rng() * 0.06)));
    }
    return { boxes: out, grounds: [{ kind: 'court', x: t, y: t, w: W - 2 * t, d: D - 2 * t, z: 0.03, fill: P.lane, surface: 'mud' }] };
  },
};

/**
 * The cattle shed (the Meketre model's byre and the stall scenes): a mud-brick stall at the back, its
 * front open under a portico on papyrus-bundle columns; a yard walled in low mud brick before it,
 * mud mangers heaped with green clover along one wall, tethering stakes, a stone water trough.
 */
export const egCattleShed = {
  id: 'eg-cattle-shed', designed: true, patterns: ['byre', 'flat-roof-cube', 'sun-dried-earth'],
  read: 'A mud-brick cattle stall open under a portico of papyrus-bundle columns, a low-walled yard with clover in its mangers, stakes, a stone trough.',
  notes: [
    'Stall: back and end walls 0.5 thick, 3.0 m, a flat roof 0.3 thick overhanging the front; the front open between four papyrus-bundle columns (drum shaft r 0.22, a closed-bud capital).',
    'Yard: a mud-brick wall 1.3 m round the front part, a 1.8 m gate; along one side a mud manger heaped with green clover; four tethering stakes; a sandstone trough with water.',
    'The cattle, the calves and the herdsmen are placed by their own builders.',
  ],
  envelope: { w: [7, 10], d: [14, 19] },
  build({ W, D }, { palette: P }) {
    const mud = P.earth[1], band = scaleHex(mud, 0.93), out = [], L = Math.min(7, D * 0.42), y0 = D - L, t = 0.5, H = 3.0;
    out.push(box('stable-wall', 0, D - t, W, t, 0, H, mud), box('stable-wall', 0, y0, t, L - t, 0, H, mud), box('stable-wall', W - t, y0, t, L - t, 0, H, mud));
    out.push(box('house-roof', -0.1, y0 - 0.6, W + 0.2, L + 0.6, H, H + 0.3, band), box('house-parapet', -0.1, y0 - 0.6, W + 0.2, 0.25, H + 0.3, H + 0.6, band));
    for (let i = 0; i < 4; i++) {
      const x = t + 0.4 + (i * (W - 2 * t - 0.8)) / 3, y = y0 - 0.3;
      out.push(drum(x, y, 0.22, 0, H - 0.5, scaleHex(P.yellow, 0.85), { kind: 'column', sides: 8, taper: 0.85 }), drum(x, y, 0.28, H - 0.5, H, scaleHex(P.green, 1.1), { kind: 'column-capital', sides: 8, taper: 0.6 }));
    }
    out.push(box('manger', t, D - t - 0.7, W - 2 * t, 0.7, 0, 0.55, scaleHex(mud, 1.05), { skin: 'mud-plaster' }), box('manger-feed', t + 0.1, D - t - 0.6, W - 2 * t - 0.2, 0.5, 0.45, 0.6, P.fodder));
    // the yard
    const yd = y0 - 1.0, gap = 1.8, wt = 0.4, yh = 1.3;
    out.push(box('yard-wall', 0, 0, (W - gap) / 2, wt, 0, yh, mud), box('yard-wall', (W + gap) / 2, 0, (W - gap) / 2, wt, 0, yh, mud), box('yard-wall', 0, wt, wt, yd - wt, 0, yh, mud), box('yard-wall', W - wt, wt, wt, yd - wt, 0, yh, mud));
    out.push(box('manger', wt, yd * 0.25, 0.8, yd * 0.55, 0, 0.55, scaleHex(mud, 1.05), { skin: 'mud-plaster' }), dome(wt + 0.4, yd * 0.52, Math.min(0.5, yd * 0.25), 0.5, 0.85, P.fodder, { kind: 'clover', sides: 8 }));
    for (let k = 0; k < 4; k++) out.push(beam('tether-stake', [W * 0.45 + (k % 2) * 1.4, 1.6 + Math.floor(k / 2) * (yd * 0.4), 0], [W * 0.45 + (k % 2) * 1.4, 1.6 + Math.floor(k / 2) * (yd * 0.4), 0.7], 0.07, P.wood));
    out.push(box('trough', W - wt - 1.0, yd * 0.4, 0.8, 1.8, 0, 0.5, P.sandstone), box('trough-water', W - wt - 0.9, yd * 0.4 + 0.1, 0.6, 1.6, 0, 0.42, scaleHex(P.water, 1.15)));
    return { boxes: out, grounds: [{ kind: 'yard', x: wt, y: wt, w: W - 2 * wt, d: y0 - wt, z: 0.03, fill: scaleHex(P.lane, 0.92), surface: 'mud' }] };
  },
};

/** The donkeys' stable: a long mud-brick shed open along its front on palm-trunk posts, mangers along the back, straw at the end. */
export const egStable = {
  id: 'eg-stable', designed: true, patterns: ['stable', 'flat-roof-cube', 'sun-dried-earth'],
  read: 'A long mud-brick shed open on palm-trunk posts, mud mangers along its back, a straw heap at the end.',
  notes: [
    'Shed: back and end walls 0.5 thick, 2.8 m; the front open on palm-trunk posts (drums r 0.16) every ~2.4 m; a roof of palm ribs and mud (a slab 0.3) overhanging.',
    'Mangers: a mud trough along the back wall with straw and clover; tethering pegs on the posts. Straw heaped against the outer end.',
  ],
  envelope: { w: [12, 20], d: [6, 8] },
  build({ W, D }, { palette: P }) {
    const mud = P.earth[0], band = scaleHex(mud, 0.93), t = 0.5, H = 2.8, out = [], sw = W - 2.6;
    out.push(box('stable-wall', 0, D - t, sw, t, 0, H, mud), box('stable-wall', 0, 0.5, t, D - 0.5 - t, 0, H, mud), box('stable-wall', sw - t, 0.5, t, D - 0.5 - t, 0, H, mud));
    const n = Math.max(3, Math.round((sw - 2 * t) / 2.4));
    for (let i = 1; i < n; i++) { const x = t + (i * (sw - 2 * t)) / n; out.push(drum(x, 0.75, 0.16, 0, H, scaleHex(P.wood, 0.95), { kind: 'palm-post', sides: 7 }), box('tether-peg', x - 0.05, 0.92, 0.1, 0.12, 1.1, 1.22, P.wood)); }
    out.push(box('house-roof', -0.1, 0.2, sw + 0.2, D - 0.2, H, H + 0.3, band), box('house-parapet', -0.1, 0.2, sw + 0.2, 0.25, H + 0.3, H + 0.55, band));
    out.push(box('manger', t, D - t - 0.7, sw - 2 * t, 0.7, 0, 0.55, scaleHex(mud, 1.06), { skin: 'mud-plaster' }), box('manger-feed', t + 0.1, D - t - 0.6, sw - 2 * t - 0.2, 0.5, 0.45, 0.58, P.straw));
    out.push(dome(sw + 1.25, D * 0.55, 1.2, 0, 1.3, P.straw, { kind: 'straw-heap', sides: 12 }));
    return out;
  },
};

/** The fold: a mud-brick wall round the flock's yard, a shelter of palm fronds on posts in the corner, a trough, fodder, a crook. */
export const egFold = {
  id: 'eg-fold', designed: true, patterns: ['sheepfold', 'sun-dried-earth'],
  read: 'A mud-walled fold, a palm-frond shelter in its corner, a trough, fodder, a crook leaning by the gate.',
  notes: [
    'Wall: mud brick 0.4 thick, 1.4 m high round the slot, a 1.8 m gate in the front.',
    'Shelter: a mat of palm fronds on four posts 1.8 m in the back corner. Trough: a mud trough with water along the west wall; fodder a low dome.',
    'The sheep and goats and the herdsman are placed by their own builders; it was the flock that trod the sown seed in.',
  ],
  envelope: { w: [11, 18], d: [9, 15] },
  build({ W, D }, { palette: P }) {
    const mud = P.earth[3], t = 0.4, h = 1.4, gap = 1.8, out = [];
    out.push(box('fold-wall', 0, 0, (W - gap) / 2, t, 0, h, mud), box('fold-wall', (W + gap) / 2, 0, (W - gap) / 2, t, 0, h, mud), box('fold-wall', 0, D - t, W, t, 0, h, mud), box('fold-wall', 0, t, t, D - 2 * t, 0, h, mud), box('fold-wall', W - t, t, t, D - 2 * t, 0, h, mud));
    const sw = Math.min(4.5, W * 0.32), sd = Math.min(3.5, D * 0.35), sx = W - t - sw - 0.1, sy = D - t - sd - 0.1;
    for (const [px, py] of [[sx, sy], [sx + sw, sy], [sx, sy + sd], [sx + sw, sy + sd]]) out.push(box('shade-post', px - 0.07, py - 0.07, 0.14, 0.14, 0, 1.9, P.wood));
    out.push(plate('palm-fronds', sx - 0.2, sy - 0.2, sw + 0.4, 0.06, sd + 0.4, 1.8, 1.95, scaleHex(P.straw, 0.85)));
    const tl = Math.min(4, D * 0.4), ty = D * 0.3;
    out.push(box('trough', t + 0.1, ty, 0.8, tl, 0, 0.4, scaleHex(mud, 1.08), { skin: 'mud-plaster' }), box('trough-water', t + 0.25, ty + 0.15, 0.5, tl - 0.3, 0, 0.33, scaleHex(P.water, 1.15)));
    out.push(dome(W * 0.45, D * 0.55, 1.0, 0, 0.6, P.fodder, { kind: 'clover', sides: 10 }));
    const gx = (W + gap) / 2 + 0.3;
    out.push(beam('crook', [gx, 0.6, 0.02], [gx + 0.12, 0.45, 1.75], 0.045, P.wood), beam('crook', [gx + 0.12, 0.45, 1.75], [gx + 0.3, 0.45, 1.6], 0.045, P.wood));
    return out;
  },
};

/**
 * The farmhouse: a mud-brick house round a walled yard, as the tomb models and Amarna's small houses
 * show it — a back range with a light loggia of posts and matting on its roof and a wind-catcher
 * facing the north wind, a stair up from the yard to the roof, two conical bread ovens, a saddle quern
 * on its bench, jars on a pot stand, and the upright two-beam loom of the New Kingdom with its cloth
 * half woven.
 */
export const egFarmhouse = {
  id: 'eg-farmhouse', designed: true, patterns: ['farmstead', 'courtyard-house', 'flat-roof-cube', 'sun-dried-earth'],
  read: 'A mud-brick farmhouse round a walled yard: a roof loggia and wind-catcher, a stair to the roof, conical ovens, a quern, an upright loom.',
  notes: [
    'Back range: rooms the full width, 4.5 m deep, 3.6 m high; a side wing 4 m wide, 3.0 m; the yard wall 2.0 m with a 2 m gate.',
    'Roof: a loggia of four posts with a mat roof (thin plate) on the back range; a wind-catcher (a wedge) open to the north.',
    'Stair: a mud-brick flight from the yard up the side wing\'s flank to its roof.',
    'Yard: two conical bread ovens (frusta with a dark mouth), a saddle quern on a mud bench, three jars on a pot stand.',
    'Loom: the upright two-beam loom — two posts 2.2 m, a top and a bottom beam, the warp a thin pale sheet, the woven cloth the lower third. The weaver is placed by her own builder.',
  ],
  envelope: { w: [15, 22], d: [13, 19] },
  build({ W, D }, { palette: P, rng }) {
    const tint = P.earth[2], band = scaleHex(tint, 0.93), dark = DARK, out = [];
    const kd = 4.5, h1 = 3.6, ww = 4, h2 = 3.0, t = 0.5, left = rng() < 0.5;
    const body = (x, y, w, d, h) => { out.push(box('house', x, y, w, d, 0, h, tint), box('house-roof', x - 0.1, y - 0.1, w + 0.2, d + 0.2, h, h + 0.3, band)); };
    body(0, D - kd, W, kd, h1);
    out.push(box('house-parapet', -0.1, D - 0.3, W + 0.2, 0.3, h1 + 0.3, h1 + 0.8, band));
    const wx = left ? 0 : W - ww;
    body(wx, t, ww, D - kd - t, h2);
    const gx = left ? ww + (W - ww) * 0.55 : (W - ww) * 0.45, gw = 2;
    out.push(box('court-wall', 0, 0, gx - gw / 2, t, 0, 2, tint), box('court-wall', gx + gw / 2, 0, W - gx - gw / 2, t, 0, 2, tint));
    out.push(box('court-wall', left ? W - t : 0, t, t, D - kd - t, 0, 2, tint));
    out.push(box('door-frame', gx - gw / 2 - 0.3, -0.15, 0.3, t + 0.3, 0, 2.5, band), box('door-frame', gx + gw / 2, -0.15, 0.3, t + 0.3, 0, 2.5, band));
    for (const f of [0.25, 0.6]) out.push(box('door', (left ? ww : 0) + (W - ww) * f, D - kd - 0.06, 1, 0.08, 0, 2.1, dark));
    out.push(box('window', (left ? ww : 0) + (W - ww) * 0.85, D - kd - 0.06, 0.6, 0.08, 2.2, 2.7, dark));
    // the roof: a loggia over the back range, the wind-catcher open to the north (the back)
    const lx = (left ? ww : 0) + 1, lw = Math.min(5, W - ww - 2), ly = D - kd + 0.6, ld = kd - 1.4, z = h1 + 0.3;
    for (const [px, py] of [[lx, ly], [lx + lw, ly], [lx, ly + ld], [lx + lw, ly + ld]]) out.push(box('shade-post', px - 0.07, py - 0.07, 0.14, 0.14, z, z + 2.1, P.wood));
    out.push(plate('reed-mat', lx - 0.2, ly - 0.2, lw + 0.4, 0.05, ld + 0.4, z + 2.0, z + 2.15, P.reed));
    const cx = left ? W - 2.2 : 1.2;
    out.push({ kind: 'wind-catcher', solid: 'wedge', x: cx, y: D - 1.9, w: 1.2, d: 1.5, z0: z, z1: z + 1.7, rise: 'y+', tint: band }, box('window', cx + 0.2, D - 0.42, 0.8, 0.06, z + 0.4, z + 1.4, dark));
    // the stair up the wing's flank to its roof
    const sx = left ? ww : W - ww - 1.1;
    out.push(...slopedFlight({ x: sx, y: t + 0.6, w: 1.1, d: Math.min(5, D - kd - t - 1.2) }, 0, h2 + 0.3, P.stair, 'y-', { riser: 0.3 }));
    // the yard
    const y0 = t, x0 = left ? ww + 1.2 : t, yw = W - ww - t - 1.2, yd = D - kd - t;
    for (const k of [0, 1]) {
      const ox = x0 + 0.8 + k * 1.3, oy = y0 + yd * 0.72;
      out.push({ kind: 'oven', solid: 'frustum', x: ox - 0.5, y: oy - 0.5, w: 1.0, d: 1.0, z0: 0, z1: 1.1, top: { x: ox - 0.2, y: oy - 0.2, w: 0.4, d: 0.4 }, tint: scaleHex(tint, 1.08) }, drum(ox, oy, 0.15, 1.08, 1.13, dark, { kind: 'oven-mouth', sides: 8 }));
    }
    const qx = x0 + yw * 0.45, qy = y0 + yd * 0.8;
    out.push(box('quern-bench', qx, qy, 1.4, 0.7, 0, 0.5, scaleHex(tint, 1.04)), box('quern', qx + 0.15, qy + 0.1, 0.9, 0.45, 0.5, 0.62, P.sandstone), box('quern-rubber', qx + 0.45, qy + 0.15, 0.25, 0.35, 0.62, 0.72, scaleHex(P.sandstone, 0.85)));
    out.push(drum(x0 + yw - 1.2, y0 + 0.9, 0.5, 0, 0.35, scaleHex(P.wood, 0.95), { kind: 'pot-stand', sides: 8, open: true, lip: 0.08 }));
    for (let i = 0; i < 3; i++) out.push(...jar(x0 + yw - 1.5 + (i % 2) * 0.55, y0 + 0.75 + Math.floor(i / 2) * 0.4, 1.0, scaleHex(P.copper, 1.04 + i * 0.05), 0.3));
    // the upright loom against the yard wall (the stair takes the wing's flank)
    const mx = left ? W - t - 0.45 : t + 0.15, my = y0 + yd * 0.3, ml = 1.8;
    for (const y of [my, my + ml]) out.push(box('loom-post', mx, y - 0.06, 0.12, 0.12, 0, 2.3, P.wood));
    for (const zz of [0.25, 2.1]) out.push(beam('loom-beam', [mx + 0.06, my - 0.1, zz], [mx + 0.06, my + ml + 0.1, zz], 0.08, P.wood));
    out.push(box('loom-warp', mx + 0.04, my + 0.05, 0.03, ml - 0.1, 0.3, 2.05, P.cloth), box('loom-cloth', mx + 0.03, my + 0.05, 0.05, ml - 0.1, 0.3, 0.9, scaleHex(P.cloth, 0.9)));
    return { boxes: out, grounds: [{ kind: 'court', x: left ? ww : t, y: y0, w: W - ww - t, d: yd, z: 0.03, fill: P.lane, surface: 'mud' }] };
  },
};

/**
 * The tool shed: a lean-to of palm ribs on a mud wall, and the estate's tools in it — the A-shaped
 * hoes that broke the clods after the flood, flint-toothed sickles on pegs, winnowing scoops, forks,
 * baskets, a spare ard stock, and a coil of the measuring cord the field scribes re-marked the
 * boundaries with each year when the water went down.
 */
export const egToolShed = {
  id: 'eg-tool-shed', designed: true, patterns: ['tool-store'],
  read: 'A palm-rib lean-to on a mud wall: A-shaped hoes, flint-toothed sickles on pegs, scoops, forks, baskets, a spare ard, the measuring cord.',
  notes: [
    'Back wall: mud brick 0.4 thick, 2.0 m high; two posts at the front 2.3 m; the roof a thin plate of palm ribs sloping to the front.',
    'Hoes: the A-shaped hoe (handle, broad wooden blade, a rope between them) leaning on the wall, three of them.',
    'On pegs: four flint-toothed wooden sickles. On the floor: two pairs of winnowing scoops, two forks, baskets, a spare ard stock and share, a coil of measuring cord.',
  ],
  envelope: { w: [4.5, 7], d: [3, 4.2] },
  build({ W, D }, { palette: P }) {
    const wood = P.wood, out = [], wt = 0.4, hw = 2.0;
    out.push(box('court-wall', 0, D - wt, W, wt, 0, hw, P.earth[1]));
    for (const x of [0.1, W - 0.26]) out.push(box('shade-post', x, 0.2, 0.16, 0.16, 0, 2.3, wood));
    out.push(plate('palm-ribs', -0.2, 0, W + 0.4, 0.06, D - wt, 2.3, hw + 0.2, scaleHex(P.straw, 0.88)));
    const yw = D - wt - 0.05;
    let x = 0.5;
    for (let i = 0; i < 3; i++, x += 0.42) out.push(...aHoe(x, 1.4, [x + 0.05, yw - 0.05, 1.75], P));
    for (let i = 0; i < 4; i++) { const px = x + 0.3 + i * 0.45; out.push(box('peg', px - 0.03, yw - 0.12, 0.06, 0.12, 1.42, 1.48, wood), ...egSickle([px, yw - 0.14, 1.34], 1, P)); }
    out.push(...scoops(W - 1.5, 0.6, 0.02, P), ...scoops(W - 1.1, 1.2, 0.02, P));
    out.push(...fork(0.3, 0.35, 0.05, P), ...fork(0.3, 0.7, -0.05, P));
    out.push(basket(W - 0.6, D - wt - 0.5, 0.26, 0.32, P), basket(W - 1.2, D - wt - 0.45, 0.22, 0.28, P));
    out.push(box('plough', 2.4, 0.9, 0.7, 0.14, 0.03, 0.17, wood), { kind: 'plough-share', solid: 'wedge', x: 2.06, y: 0.88, w: 0.36, d: 0.18, z0: 0.03, z1: 0.17, rise: 'x+', tint: scaleHex(wood, 0.8) });
    out.push(drum(W / 2 + 0.6, D - wt - 0.5, 0.26, 0.02, 0.14, scaleHex(P.reed, 0.75), { kind: 'measuring-cord', sides: 10, open: true, lip: 0.1 }));
    return out;
  },
};

/**
 * The shaduf, as the Theban tombs paint it: one plastered mud pillar with a short crossbar on its top,
 * the sweep pivoting there, a lump of Nile mud bound to its short end, a pot on a rope at its long end
 * over the water; a mud basin behind, its channel running back to the garden beds.
 */
export const egPillarShaduf = {
  id: 'eg-pillar-shaduf', designed: true, patterns: ['shaduf', 'irrigation'],
  read: 'A shaduf on one plastered mud pillar: the sweep with its mud counterweight, a pot hanging over the water, a basin behind.',
  notes: [
    'Pillar: a mud-plastered drum r 0.32, 2.3 m high; a crossbar 0.9 m on its top.',
    'Sweep: a beam 6 m pivoting on the crossbar, its short end down at the back with a lump of mud (a dome) bound to it, its long end up over the water.',
    'Rope and pot: a thin box from the tip to a pottery bucket just above the water. The waterman is placed by his own builder.',
    'Basin: a mud-rimmed pool on the bank behind, its channel leading back.',
  ],
  envelope: { w: [2.6, 4], d: [4.5, 6] },
  build({ W, D, slot }, { palette: P }) {
    const cx = W / 2, wz = slot.waterZ ?? -1.2, mud = scaleHex(P.earth[2], 1.08), out = [], py = 1.7, ph = 2.3;
    out.push(drum(cx, py, 0.32, 0, ph, mud, { kind: 'shaduf-pillar', sides: 10, taper: 0.85, skin: 'mud-plaster' }));
    out.push(beam('shaduf-crossbeam', [cx - 0.45, py, ph + 0.05], [cx + 0.45, py, ph + 0.05], 0.12, P.wood));
    const tip = [cx, -1.4, ph + 1.6], tail = [cx, py + 1.5, ph - 0.9];
    out.push(beam('shaduf-sweep', tail, tip, 0.11, P.wood));
    out.push(dome(tail[0], tail[1], 0.34, tail[2] - 0.45, tail[2] + 0.1, scaleHex(P.mud, 0.85), { kind: 'counterweight', sides: 8 }));
    const bz = wz + 0.35;
    out.push(box('rope', tip[0] - 0.02, tip[1] - 0.02, 0.04, 0.04, bz + 0.38, tip[2], scaleHex(P.reed, 0.7)));
    out.push(drum(tip[0], tip[1], 0.2, bz, bz + 0.4, scaleHex(P.copper, 1.1), { kind: 'bucket', sides: 8, taper: 1.15, open: true, lip: 0.03 }));
    const bx = cx - 0.8, by = py + 0.8, bw = 1.6, bd = 1.4, rim = scaleHex(P.mud, 1.1);
    for (const [x, y, w, d] of [[bx, by, bw, 0.2], [bx, by + bd - 0.2, bw, 0.2], [bx, by, 0.2, bd], [bx + bw - 0.2, by, 0.2, bd]]) out.push(box('basin-rim', x, y, w, d, 0, 0.3, rim));
    return { boxes: out, grounds: [{ kind: 'water', x: bx + 0.2, y: by + 0.2, w: bw - 0.4, d: bd - 0.4, z: 0.22, fill: P.water }] };
  },
};

/** A field channel's head cut through the dyke: mud cheeks shored with palm trunks, timber boards dropped between posts, a plank across. */
export const egSluice = {
  id: 'eg-sluice', designed: true, patterns: ['irrigation'],
  read: 'A cut in the dyke: mud cheeks shored with palm trunks, gate boards dropped between two posts, a plank across.',
  notes: [
    'Cheeks: mud banks 0.9 m wide either side of the channel, faced with laid palm trunks (beams) against the scour; no fired brick in Egypt.',
    'Gate: boards stacked between two posts in the channel; a plank 0.3 wide across the top.',
  ],
  envelope: { w: [3, 4.5], d: [1.4, 2.2] },
  build({ W, D }, { palette: P }) {
    const c = 0.9, out = [], mud = scaleHex(P.mud, 1.05);
    out.push(box('sluice-cheek', 0, 0, c, D, -0.2, 0.7, mud), box('sluice-cheek', W - c, 0, c, D, -0.2, 0.7, mud));
    for (const x of [c - 0.1, W - c + 0.1]) for (const z of [0.0, 0.32]) out.push(beam('palm-trunk', [x, 0.05, z], [x, D - 0.05, z], 0.22, scaleHex(P.wood, 0.9)));
    for (const x of [c + 0.05, W - c - 0.2]) out.push(box('sluice-post', x, D / 2 - 0.08, 0.15, 0.16, -0.2, 1.0, P.wood));
    for (let k = 0; k < 3; k++) out.push(box('sluice-board', c, D / 2 - 0.04, W - 2 * c, 0.08, -0.15 + k * 0.22, -0.15 + (k + 1) * 0.22 - 0.02, scaleHex(P.wood, 1 + k * 0.05)));
    out.push(box('sluice-plank', c - 0.2, D / 2 - 0.15, W - 2 * c + 0.4, 0.3, 0.75, 0.83, P.wood));
    return out;
  },
};

// ── the newer pieces: the garden, the vines, the bees ──

/**
 * The garden: square beds in a checkerboard, each a sunk square inside a low mud ridge so it holds
 * the water poured into it — leeks, onions, lettuce in rows — round a rectangular pool; sycamore figs
 * shading it; jars by the pool to carry from.
 */
export const egGarden = {
  id: 'eg-garden', designed: true, patterns: ['garden-beds', 'irrigation', 'grove-fringe'],
  read: 'Checkerboard beds inside low mud ridges round a rectangular pool, sycamore figs shading it, jars by the water.',
  notes: [
    'Beds: squares 1.2 m on a 1.4 m grid, a mud ridge 0.12 high round each; alternate squares green (planted) and dark (wet silt).',
    'Pool: a rectangle ≈ 4 × 3 m, the water 0.4 below the beds inside a mud kerb, in the middle of the beds.',
    'Two sycamore figs (a trunk under lumped domes) on the north side; jars at the pool. The gardeners are placed by their own builders.',
  ],
  envelope: { w: [14, 26], d: [14, 24] },
  build({ W, D }, { palette: P, rng }) {
    const out = [], grounds = [], pitch = 1.4, s = 1.2, ridge = scaleHex(P.mud, 1.12);
    const pool = { x: W / 2 - 2, y: D * 0.55 - 1.5, w: 4, d: 3 };
    const by0 = 6.5, nx = Math.floor((W - 1) / pitch), ny = Math.floor((D - by0 - 0.5) / pitch);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = 0.5 + i * pitch, y = by0 + j * pitch;
      if (x + pitch > pool.x - 0.3 && x < pool.x + pool.w + 0.3 && y + pitch > pool.y - 0.3 && y < pool.y + pool.d + 0.3) continue;
      const planted = (i + j) % 2 === 0;
      grounds.push({ kind: 'bed', x, y, w: s, d: s, z: 0.04, fill: planted ? scaleHex(P.garden, 0.9 + rng() * 0.2) : P.tilled, surface: planted ? 'sown' : 'mud' });
      out.push(box('bed-ridge', x - 0.1, y - 0.1, s + 0.2, 0.1, 0, 0.12, ridge), box('bed-ridge', x - 0.1, y + s, s + 0.2, 0.1, 0, 0.12, ridge));
    }
    for (const [x, y, w, d] of [[pool.x - 0.3, pool.y - 0.3, pool.w + 0.6, 0.3], [pool.x - 0.3, pool.y + pool.d, pool.w + 0.6, 0.3], [pool.x - 0.3, pool.y, 0.3, pool.d], [pool.x + pool.w, pool.y, 0.3, pool.d]]) out.push(box('pool-kerb', x, y, w, d, 0, 0.25, ridge));
    grounds.push({ kind: 'water', ...pool, z: 0.1, fill: P.water });
    for (let k = 0; k < 3; k++) out.push(...jar(pool.x + pool.w + 0.7, pool.y + 0.4 + k * 0.7, 1.1, scaleHex(P.copper, 1.05 + k * 0.04)));
    out.push(...sycamore(W * 0.25, 3.0, 0.85, P), ...sycamore(W * 0.72, 3.2, 0.95, P));
    return { boxes: out, grounds: [{ kind: 'garden-floor', x: 0, y: 0, w: W, d: D, z: 0.025, fill: scaleHex(P.lane, 0.9), surface: 'mud' }, ...grounds] };
  },
};

/**
 * The vineyard: vines trained over a pergola of forked posts carrying cross poles, the grapes hanging
 * in the shade under it; at its end the wine press — a treading vat with an overhead beam on two
 * forked posts (the treaders hold ropes hung from it), the must running out by a spout into a basin —
 * and the amphorae, stoppered with mud, ready for the cellar.
 */
export const egVineyard = {
  id: 'eg-vineyard', designed: true, patterns: ['vineyard'],
  read: 'Vines on a pergola of forked posts, grapes hanging under it; a treading vat with its overhead beam and ropes, a spout to a basin, stoppered amphorae.',
  notes: [
    'Pergola: forked posts (a post beam with a V of two short beams) on a 2.4 m grid, 2.1 m high, cross poles along the rows; the vine canopy low green clumps (three to a bay) with gaps between; vine stems twisting up the posts.',
    'Grapes: small dark drums hanging under the canopy.',
    'Press: a mud-plastered vat 3 × 2.4 m, 0.7 high, the must dark in it; two forked posts carrying a beam 2.5 m up with four ropes hanging; a spout to a basin.',
    'Amphorae: tall pointed jars with mud stoppers, standing in a row against a low wall.',
  ],
  envelope: { w: [16, 24], d: [12, 18] },
  build({ W, D }, { palette: P, rng }) {
    const out = [], wood = P.wood, h = 2.1, g = 2.4, px0 = 0.6, pw = W - 6.2, py0 = 0.6, pd = D - 1.2;
    const nx = Math.max(2, Math.round(pw / g)), ny = Math.max(2, Math.round(pd / g));
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const x = px0 + (i * pw) / nx, y = py0 + (j * pd) / ny;
      out.push(beam('pergola-post', [x, y, 0], [x, y, h - 0.25], 0.12, wood), beam('pergola-fork', [x, y, h - 0.25], [x - 0.18, y, h], 0.07, wood), beam('pergola-fork', [x, y, h - 0.25], [x + 0.18, y, h], 0.07, wood));
      if (i < nx && (j + i) % 2 === 0) out.push(beam('vine', [x + 0.15, y + 0.1, 0], [x + 0.35, y - 0.05, h * 0.55], 0.09, scaleHex(wood, 0.8)), beam('vine', [x + 0.35, y - 0.05, h * 0.55], [x + 0.1, y, h], 0.08, scaleHex(wood, 0.8)));
    }
    for (let j = 0; j <= ny; j++) { const y = py0 + (j * pd) / ny; out.push(beam('pergola-pole', [px0 - 0.2, y, h], [px0 + pw + 0.2, y, h], 0.08, wood)); }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = px0 + (i * pw) / nx, y = py0 + (j * pd) / ny, cw = pw / nx, cd = pd / ny;
      // the leaves in clumps, light coming through between them
      for (let k = 0; k < 2; k++) { const r = 0.7 + rng() * 0.35; out.push(dome(x + r * 0.6 + rng() * (cw - r * 1.2), y + r * 0.6 + rng() * (cd - r * 1.2), r, h - 0.05, h + 0.25 + rng() * 0.2, scaleHex(P.vine, 0.88 + rng() * 0.24), { kind: 'vine-leaves', sides: 7 })); }
      for (let k = 0; k < 3; k++) { const gx = x + 0.4 + rng() * (cw - 0.8), gy = y + 0.4 + rng() * (cd - 0.8); out.push(drum(gx, gy, 0.1, h - 0.3, h + 0.05, P.grape, { kind: 'grapes', sides: 6, taper: 1.6 })); }
    }
    // the press at the east end
    const vx = W - 5.2, vy = 1.0, vw = 3.0, vd = 2.4, mud = scaleHex(P.earth[2], 1.06);
    for (const [x, y, w, d] of [[vx, vy, vw, 0.25], [vx, vy + vd - 0.25, vw, 0.25], [vx, vy, 0.25, vd], [vx + vw - 0.25, vy, 0.25, vd]]) out.push(box('vat-wall', x, y, w, d, 0, 0.7, mud, { skin: 'mud-plaster' }));
    for (const x of [vx + 0.1, vx + vw - 0.1]) out.push(beam('press-post', [x, vy + vd / 2, 0], [x, vy + vd / 2, 2.4], 0.14, wood), beam('pergola-fork', [x, vy + vd / 2, 2.4], [x, vy + vd / 2 - 0.2, 2.6], 0.08, wood), beam('pergola-fork', [x, vy + vd / 2, 2.4], [x, vy + vd / 2 + 0.2, 2.6], 0.08, wood));
    out.push(beam('press-beam', [vx - 0.1, vy + vd / 2, 2.55], [vx + vw + 0.1, vy + vd / 2, 2.55], 0.13, wood));
    for (let k = 0; k < 4; k++) { const x = vx + 0.6 + k * 0.6; out.push(box('rope', x - 0.02, vy + vd / 2 - 0.02, 0.04, 0.04, 1.3, 2.5, scaleHex(P.reed, 0.7))); }
    out.push(beam('spout', [vx + vw / 2, vy + vd, 0.3], [vx + vw / 2, vy + vd + 0.6, 0.2], 0.1, mud), box('basin-rim', vx + vw / 2 - 0.5, vy + vd + 0.55, 1.0, 0.8, 0, 0.3, mud));
    for (let k = 0; k < 5; k++) out.push(...amphora(W - 0.6, D - 1.0 - k * 0.55, P));
    out.push(box('court-wall', W - 0.25, D - 3.6, 0.25, 3.2, 0, 1.0, mud));
    return { boxes: out, grounds: [{ kind: 'must', x: vx + 0.25, y: vy + 0.25, w: vw - 0.5, d: vd - 0.5, z: 0.45, fill: scaleHex(P.grape, 1.1) }, { kind: 'must', x: vx + vw / 2 - 0.3, y: vy + vd + 0.65, w: 0.6, d: 0.6, z: 0.22, fill: scaleHex(P.grape, 1.1) }, { kind: 'vineyard-floor', x: 0, y: 0, w: W, d: D, z: 0.025, fill: scaleHex(P.lane, 0.92), surface: 'mud' }] };
  },
};

/**
 * The apiary (Rekhmire's and the sun temple of Niuserre's): long cylinders of pottery laid on their
 * sides and stacked in a bank, bedded in mud, their entrance holes to the front; the honey jars, a
 * bowl for the smoke, and a sealed jar of honey.
 */
export const egApiary = {
  id: 'eg-apiary', designed: true, patterns: ['apiary'],
  read: 'Pottery hive cylinders laid on their sides in a stacked bank of mud, entrance holes to the front, honey jars by it.',
  notes: [
    'Hives: cylinders (round-topped vaults 0.4 across) 1.2 m long laid front to back, three rows stacked (5, 4, 3), bedded in a mud bank; a dark entrance hole on each front end.',
    'By it: three honey jars sealed with mud, a smoking bowl. The beekeeper is placed by his own builder.',
  ],
  envelope: { w: [4, 7], d: [2.5, 4] },
  build({ W, D }, { palette: P }) {
    const out = [], L = 1.2, y0 = D - L - 0.2, hive = P.hive;
    out.push({ kind: 'hive-bank', solid: 'wedge', x: 0.1, y: y0 + L * 0.5, w: W - 0.2, d: L * 0.5 + 0.1, z0: 0, z1: 1.3, rise: 'y+', tint: scaleHex(P.mud, 1.08) });
    for (let r = 0; r < 3; r++) {
      const n = 5 - r, z = 0.22 + r * 0.38;
      for (let i = 0; i < n; i++) {
        const x = W / 2 + (i - (n - 1) / 2) * 0.44;
        out.push({ kind: 'hive', solid: 'vault', axis: 'y', x: x - 0.2, y: y0, w: 0.4, d: L, z0: z - 0.19, z1: z + 0.19, tint: scaleHex(hive, 0.95 + ((i + r) % 3) * 0.05) }, box('hive-entrance', x - 0.05, y0 - 0.02, 0.1, 0.03, z - 0.06, z + 0.04, DARK));
      }
    }
    for (let k = 0; k < 3; k++) out.push(...jar(0.5 + k * 0.6, 0.5, 0.9, scaleHex(P.copper, 1.1)), drum(0.5 + k * 0.6, 0.5, 0.11, 0.53, 0.6, scaleHex(P.mud, 0.9), { kind: 'jar-stopper', sides: 8 }));
    out.push(drum(W - 0.6, 0.5, 0.2, 0, 0.12, scaleHex(P.copper, 0.9), { kind: 'smoke-bowl', sides: 8, open: true, lip: 0.03 }));
    return out;
  },
};

export const EGYPT_FARM_ASSETS = Object.fromEntries([egArd, egHarvestEdge, egGrainPacks, egScribesShade, egThreshingFloor, egSiloCourt, egCattleShed, egStable, egFold, egFarmhouse, egToolShed, egPillarShaduf, egSluice, egGarden, egVineyard, egApiary].map((a) => [a.id, a]));

// the small parts the Egyptian works kit (./egypt-works.js) builds with too
export { net, heqat, scoops, fork, amphora, earSheaf };
