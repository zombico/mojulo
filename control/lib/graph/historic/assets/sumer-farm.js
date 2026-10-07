/**
 * historic/assets/sumer-farm — the Sumerian countryside's kit: the tools a temple estate farmed with
 * and the buildings it raised away from the town (patterns.js family `farm`). Local frame, metres,
 * front −y (see ./kit.js); `ctx` = { palette, culture, rng }. The record behind each piece is
 * ../record/sumer-farm.js.
 *
 * Sumer reaped with sickles (fired clay, flint-toothed, later copper), not scythes — the scythe is
 * Iron Age. Wheels are solid discs of three planks; what pulled them were oxen and donkeys (the horse
 * comes later). There are no barns as such: grain is threshed in the open, heaped and sealed, then
 * stored in a mud-brick storehouse filled from its roof.
 *
 * The kit holds the tools and buildings only, at rest: people and beasts are drawn by their own
 * builders and placed separately, so a plough stands with its yoke on the ground, a cart with its pole
 * down, the pens and stalls empty. Each piece is kept to a few masses: a field holds a plough, sickles
 * and baskets at the crop's edge, stooks.
 */
import { slopedFlight, beam } from './kit.js';
import { scaleHex } from '../../polygonizer/vexar.js';

const box = (kind, x, y, w, d, z0, z1, tint, o = {}) => ({ kind, x, y, w, d, z0, z1, tint, ...o });
const drum = (cx, cy, r, z0, z1, tint, o = {}) => ({ kind: o.kind || 'drum', solid: 'drum', x: cx - r, y: cy - r, w: 2 * r, d: 2 * r, z0, z1, tint, ...o });
const dome = (cx, cy, r, z0, z1, tint, o = {}) => ({ kind: o.kind || 'dome', solid: 'dome', x: cx - r, y: cy - r, w: 2 * r, d: 2 * r, z0, z1, tint, ...o });
/** A solid wheel standing in the y–z plane (it rolls along y): a disc of radius R, t thick, its axle at (cx, cy, cz). */
const wheel = (cx, cy, cz, R, t, tint, o = {}) => ({ kind: o.kind || 'wheel', solid: 'ring', plane: 'y', x: cx - t / 2, y: cy - R, w: t, d: 2 * R, z0: cz - R, z1: cz + R, band: R, tint, ...o });
/** A thin sloping plate (a mat roof): the rect's front edge at z0, its back edge (shifted `run` along +y) at z1. */
const plate = (kind, x, y, w, t, run, z0, z1, tint) => ({ kind, solid: 'frustum', x, y, w, d: t, z0, z1, top: { x, y: y + run, w, d: t }, underside: true, tint });

// ── small tools ──

/** A sickle of fired clay (≈ 0.4 m): a grip and a crescent blade, in the x–z plane at `at`, blade toward −x·dir. */
function sickle(at, dir = 1, tint = '#b0744c', flat = false) {
  const [x, y, z] = at, pt = (u, v) => (flat ? [x + u * dir, y - v, z] : [x + u * dir, y, z + v]);   // flat: lying on the ground, the blade toward −y
  const out = [beam('sickle', pt(0, -0.06), pt(0, 0.08), 0.05, tint)];
  const arc = [[0, 0.08], [-0.12, 0.16], [-0.24, 0.13], [-0.32, 0.03]];
  for (let i = 0; i < arc.length - 1; i++) out.push(beam('sickle', pt(...arc[i]), pt(...arc[i + 1]), 0.045, tint));
  return out;
}
/** A long-handled hoe leaning from its foot at (x, y, 0) back to `top`; the blade at the foot. */
function hoe(x, y, top, wood, blade) {
  return [beam('tool', [x, y, 0.12], top, 0.05, wood), box('tool-blade', x - 0.11, y - 0.14, 0.22, 0.14, 0, 0.16, blade)];
}
/** A winnowing shovel: a handle and a broad flat blade. */
function shovel(x, y, top, wood) {
  return [beam('tool', [x, y, 0.3], top, 0.05, wood), box('tool-blade', x - 0.17, y - 0.08, 0.34, 0.06, 0, 0.42, scaleHex(wood, 1.12))];
}
/** A basket: an open drum flaring a little. */
const basket = (cx, cy, r, h, P, z = 0) => drum(cx, cy, r, z, z + h, P.reed, { kind: 'basket', sides: 9, taper: 1.15, open: true, lip: 0.04 });
/** A storage jar: a bulbous body under an open neck. */
const jar = (cx, cy, s, tint, z = 0) => [
  drum(cx, cy, 0.24 * s, z, z + 0.22 * s, tint, { kind: 'jar', sides: 10, taper: 1.35 }),
  drum(cx, cy, 0.32 * s, z + 0.22 * s, z + 0.5 * s, tint, { kind: 'jar', sides: 10, taper: 0.66 }),
  drum(cx, cy, 0.2 * s, z + 0.5 * s, z + 0.6 * s, scaleHex(tint, 0.92), { kind: 'jar', sides: 10, taper: 1.15, open: true, lip: 0.04 * s }),
];

/** A sheaf of cut barley, standing: a bound bundle, its ears flaring above the tie. */
function sheafUp(cx, cy, lean, P, z = 0) {
  const [lx, ly] = lean, h = 1.05;
  return [
    beam('sheaf', [cx, cy, z + 0.05], [cx + lx, cy + ly, z + h * 0.72], 0.2, P.straw),
    beam('sheaf-ears', [cx + lx * 0.72, cy + ly * 0.72, z + h * 0.62], [cx + lx * 1.05, cy + ly * 1.05, z + h], 0.26, P.grain),
  ];
}
/** A sheaf lying on the stubble, from (x, y) toward angle a. */
const sheafDown = (x, y, a, P, z = 0) => [
  beam('sheaf', [x, y, z + 0.12], [x + Math.cos(a) * 0.62, y + Math.sin(a) * 0.62, z + 0.12], 0.2, P.straw),
  beam('sheaf-ears', [x + Math.cos(a) * 0.6, y + Math.sin(a) * 0.6, z + 0.13], [x + Math.cos(a) * 0.95, y + Math.sin(a) * 0.95, z + 0.13], 0.25, P.grain),
];
/** A stook: sheaves leaning together to dry. */
function stookAt(cx, cy, P, rng, n = 6) {
  const out = [], a0 = rng() * 6.283;
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * 6.283, r = 0.42; out.push(...sheafUp(cx + Math.cos(a) * r, cy + Math.sin(a) * r, [-Math.cos(a) * 0.32, -Math.sin(a) * 0.32], P)); }
  return out;
}

// ── the tools at work ──

/**
 * The plough at rest in the field (Sumerian apin): an ard — a wooden sole with its share in the
 * furrow, a post carrying the long pole forward, two stilts behind for the ploughman's hands — the
 * pole's end lying on the yoke, set down on the ground where the oxen were loosed. In the sowing
 * season it carries the seed funnel: a thin tube up from the sole under a flaring cup.
 */
export const plough = {
  id: 'plough', designed: true, patterns: ['plough-team', 'strip-fields'],
  read: 'An ard plough at rest in its furrow, the pole forward to a yoke laid on the ground; with a seed funnel when sowing.',
  notes: [
    'Sole: a box 1.0 m on the ground, the share a wedge at its nose biting into the furrow; a post 0.45 m up from its heel.',
    'Pole: a beam ≈ 4 m from the post forward and down to the yoke, which lies across it on the ground (a beam 2.4 m).',
    'Stilts: two beams rising back from the sole to the grips at about 1 m, splayed 0.56 m.',
    'Seeder (`slot.seeder`): a drum tube r 0.05 from the sole to 1 m under a cup flaring to twice its width; a seed bag beside it.',
    'Behind the share a fresh furrow (a dark strip of ground) runs to the back of the slot. Oxen and ploughman are placed by their own builders.',
  ],
  envelope: { w: [2.8, 3.6], d: [8.5, 10] },
  build({ W, D, slot }, { palette: P }) {
    const cx = W / 2, out = [], wood = P.wood, seeder = slot.seeder !== false, yP = 4.5;   // without the funnel it is a plain ard, breaking fallow
    out.push(beam('yoke', [cx - 1.2, 0.6, 0.08], [cx + 1.2, 0.6, 0.08], 0.14, wood));
    out.push(beam('plough-pole', [cx, 0.6, 0.18], [cx, yP, 0.42], 0.1, wood));
    out.push(box('plough', cx - 0.07, yP - 0.1, 0.14, 1.0, 0.02, 0.16, wood));
    out.push({ kind: 'plough-share', solid: 'wedge', x: cx - 0.08, y: yP - 0.42, w: 0.16, d: 0.34, z0: 0, z1: 0.16, rise: 'y+', tint: scaleHex(wood, 0.8) });
    out.push(beam('plough', [cx, yP + 0.1, 0.12], [cx, yP + 0.06, 0.48], 0.09, wood));   // the post carrying the pole
    for (const o of [-1, 1]) out.push(beam('plough-stilt', [cx + o * 0.05, yP + 0.78, 0.12], [cx + o * 0.28, yP + 1.6, 0.98], 0.07, wood));
    if (seeder) {
      out.push(drum(cx, yP + 0.36, 0.05, 0.14, 0.98, scaleHex(wood, 0.9), { kind: 'seed-funnel', sides: 6 }), drum(cx, yP + 0.36, 0.08, 0.98, 1.2, scaleHex(wood, 1.1), { kind: 'seed-funnel', sides: 8, taper: 2, open: true, lip: 0.03 }));
      out.push(box('seed-bag', cx + 0.6, yP + 0.2, 0.36, 0.3, 0, 0.42, P.cloth));
    }
    return { boxes: out, grounds: [{ kind: 'furrow', x: cx - 0.28, y: yP + 0.6, w: 0.56, d: Math.max(0.1, D - yP - 0.6), z: 0.035, fill: scaleHex(P.tilled, 0.82) }] };
  },
};

/**
 * The edge of the reaping: a straight cut along the standing barley, the sheaves just cut lying behind
 * it, clay sickles and baskets set down among them, a water jar, the first stooks drying at the back.
 */
export const harvestEdge = {
  id: 'harvest-edge', designed: true, patterns: ['harvest'],
  read: 'Where the reaping stopped: sheaves lying behind the cut, clay sickles and baskets set down, stooks at the back.',
  notes: [
    'The slot\'s front is the standing crop\'s cut edge; the sheaves (straw beam + golden ear beam) lie at random angles behind it.',
    'Sickles: grip + three-segment crescent, ≈ 0.4 m, lying on the stubble one per ~2.2 m of front; a basket and a water jar.',
    'Stooks at the back: six sheaves leaning together on a 0.42 m circle.',
    'The reapers themselves are placed by their own builder.',
  ],
  envelope: { w: [8, 18], d: [4.5, 7] },
  build({ W, D }, { palette: P, rng }) {
    const out = [], n = Math.max(2, Math.floor(W / 2.2));
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * (W / n) + (rng() - 0.5) * 0.4;
      out.push(...sickle([cx, 1.0 + rng() * 0.6, 0.03], rng() < 0.5 ? 1 : -1, '#b0744c', true));
    }
    for (let i = 0; i < n * 2; i++) out.push(...sheafDown(0.3 + rng() * (W - 1.3), 2.2 + rng() * Math.max(0.5, D - 4.6), rng() * 6.283, P));
    const bx = W * (0.3 + rng() * 0.4);
    out.push(basket(bx, D - 2.3, 0.3, 0.38, P), ...jar(bx + 0.8, D - 2.1, 1.1, scaleHex(P.copper, 1.12)));
    for (let x = 1.2; x < W - 1; x += 3.4) out.push(...stookAt(x + rng() * 0.6, D - 0.8, P, rng));
    return out;
  },
};

/** A stook of sheaves left drying on the stubble. */
export const stook = {
  id: 'stook', designed: true, patterns: ['harvest'],
  read: 'Six sheaves leaning together on the stubble to dry.',
  notes: ['Six sheaves (straw beam + ear beam, 1.05 m) set on a 0.42 m circle, leaning in to meet at the top.'],
  envelope: { w: [1.4, 2], d: [1.4, 2] },
  build({ W, D }, { palette: P, rng }) { return stookAt(W / 2, D / 2, P, rng, 5 + Math.floor(rng() * 3)); },
};

/** The carts' frame: a body on a pair of solid wheels; shared by the cart and the wagon. */
function wheels(cx, cy, R, gauge, P) {
  const wood = P.wood, rim = scaleHex(wood, 0.62), out = [];
  for (const o of [-1, 1]) {
    const x = cx + o * gauge / 2;
    out.push(wheel(x, cy, R, R, 0.14, wood), wheel(x + o * 0.02, cy, R, R * 1.03, 0.1, rim, { kind: 'wheel-tyre', band: R * 0.08 }));
    out.push(box('wheel-hub', x + (o < 0 ? -0.16 : 0.02), cy - 0.11, 0.14, 0.22, R - 0.11, R + 0.11, rim));
    for (const dz of [-0.33, 0.33]) out.push(box('wheel-batten', x + (o < 0 ? -0.1 : 0.06), cy - R * 0.8, 0.04, R * 1.6, R + dz * R - 0.04, R + dz * R + 0.04, rim));   // the three planks' joints
  }
  out.push(beam('axle', [cx - gauge / 2, cy, R], [cx + gauge / 2, cy, R], 0.1, rim));
  return out;
}
/**
 * The farm cart, unhitched: two solid three-plank wheels under a wicker-sided box, its pole run forward
 * and down to the yoke lying on the ground; loaded with sheaves for the threshing floor.
 */
export const farmCart = {
  id: 'farm-cart', designed: true, patterns: ['cart', 'harvest'],
  read: 'A two-wheeled cart on solid plank wheels, unhitched, its pole down to the yoke on the ground, heaped with sheaves.',
  notes: [
    'Wheels: discs r 0.5 m, 0.14 thick, a darker tyre ring, a hub, two battens marking the three planks; gauge 1.5 m.',
    'Body: a box 1.3 × 1.9 on the axle at 0.62 m, wicker sides 0.5 high; the pole a beam from its front down to the yoke on the ground (≈ 1 m from the slot front).',
    'Unhitched: the donkey pair and the carter are placed by their own builders, at the yoke.',
    'Load: sheaves lying across the body in three layers, ears outward.',
    'Next: a rope lashing over the load; a second cart loaded with sealed grain sacks.',
  ],
  envelope: { w: [2.2, 3], d: [6.5, 8] },
  build({ W, D }, { palette: P }) {
    const cx = W / 2, out = [], wood = P.wood, wick = scaleHex(P.reed, 0.9);
    out.push(beam('yoke', [cx - 0.75, 0.95, 0.06], [cx + 0.75, 0.95, 0.06], 0.1, wood));
    const ya = D - 1.9, R = 0.5;
    out.push(...wheels(cx, ya, R, 1.5, P));
    const by = ya - 1.05, bd = 1.9, z0 = R + 0.12;
    out.push(box('cart', cx - 0.65, by, 1.3, bd, z0, z0 + 0.12, wood));
    for (const [x, y, w, d] of [[cx - 0.65, by, 0.07, bd], [cx + 0.58, by, 0.07, bd], [cx - 0.65, by, 1.3, 0.07], [cx - 0.65, by + bd - 0.07, 1.3, 0.07]]) out.push(box('cart-side', x, y, w, d, z0 + 0.12, z0 + 0.6, wick));
    out.push(beam('cart-pole', [cx, by + 0.1, z0 + 0.06], [cx, 0.95, 0.16], 0.1, wood));
    for (let layer = 0; layer < 3; layer++) for (let k = 0; k < 4; k++) {
      const y = by + 0.3 + k * 0.45 + (layer % 2) * 0.2, z = z0 + 0.12 + layer * 0.22, o = (k + layer) % 2 ? 1 : -1;
      if (y > by + bd - 0.15) continue;
      out.push(beam('sheaf', [cx - o * 0.55, y, z + 0.12], [cx + o * 0.15, y, z + 0.12], 0.22, P.straw), beam('sheaf-ears', [cx + o * 0.13, y, z + 0.12], [cx + o * 0.62, y, z + 0.12], 0.27, P.grain));
    }
    out.push(beam('goad', [cx + 0.75, by - 0.2, 0.03], [cx + 0.95, by - 2.0, 0.03], 0.035, wood));   // the carter's goad, dropped by the pole
    return out;
  },
};

/**
 * A four-wheeled wagon (the Standard of Ur's, at rest): a narrow box body on four solid wheels, a
 * tall front board, the pole laid forward on the ground; baskets and jars ready for loading.
 */
export const wagon = {
  id: 'wagon', designed: true, patterns: ['cart'],
  read: 'A four-wheeled wagon at rest on solid wheels, its tall front board up, the pole laid on the ground.',
  notes: [
    'Four discs r 0.45, gauge 1.2 m, axles 1.6 m apart; the body a box 1.0 × 2.2 on them, sides 0.4 high.',
    'Front board: a box across the front of the body rising 0.8 m above the sides (the Standard of Ur\'s panel).',
    'Pole: a beam from under the front down to the ground ahead of the slot; baskets and a jar in the body.',
  ],
  envelope: { w: [1.8, 2.4], d: [3.2, 4.2] },
  build({ W, D }, { palette: P }) {
    const cx = W / 2, R = 0.45, out = [], wood = P.wood, y0 = D - 2.9, z0 = R + 0.1;
    out.push(...wheels(cx, y0 + 0.5, R, 1.2, P), ...wheels(cx, y0 + 2.1, R, 1.2, P));
    out.push(box('wagon', cx - 0.5, y0, 1.0, 2.6, z0, z0 + 0.12, wood));
    for (const [x, w] of [[cx - 0.5, 0.06], [cx + 0.44, 0.06]]) out.push(box('wagon-side', x, y0, w, 2.6, z0 + 0.12, z0 + 0.52, wood));
    out.push(box('wagon-side', cx - 0.5, y0 + 2.54, 1.0, 0.06, z0 + 0.12, z0 + 0.52, wood), box('wagon-front', cx - 0.5, y0, 1.0, 0.08, z0 + 0.12, z0 + 1.32, scaleHex(wood, 1.1)));
    out.push(beam('wagon-pole', [cx, y0 + 0.05, z0], [cx, Math.max(0.1, y0 - 2.2), 0.06], 0.1, wood));
    out.push(basket(cx - 0.2, y0 + 1.1, 0.22, 0.32, P, z0 + 0.12), basket(cx + 0.15, y0 + 1.6, 0.2, 0.3, P, z0 + 0.12), ...jar(cx, y0 + 2.15, 0.8, scaleHex(P.copper, 1.1), z0 + 0.12));
    return out;
  },
};

/**
 * The threshing floor: a round of beaten earth spread with cut barley; the threshing sledge on it (a
 * board, its front curled up, flints set in its underside, a pole forward to its yoke), and the
 * threshed barley in a great heap beside a smaller heap of chaff — the big heap sealed with mud against
 * theft, a winnowing shovel stuck in it, a measure beside it. Unthreshed sheaves wait at the edge.
 */
export const threshingFloor = {
  id: 'threshing-floor', designed: true, patterns: ['threshing-floor', 'harvest'],
  read: 'A round threshing floor: the sledge on the straw, a sealed grain heap with its shovel and measure, chaff, waiting sheaves.',
  notes: [
    'Floor: a 16-sided disc the slot\'s width, beaten earth under a spread of straw (two grounds, the straw a ring inside).',
    'Sledge: a board 1.0 × 1.8 m, 0.1 thick, its front 0.4 m a wedge curling up; a pole forward to its yoke lying on the straw, set along the circuit.',
    'Grain heap: a cone r 1.8 m, 1.5 high, its skin a mud seal (a darker cap) with a clay sealing; chaff heap paler and flatter downwind.',
    'A winnowing shovel stands stuck in the heap; a grain measure (an open drum) beside it.',
    'The donkeys, driver, winnower and measurer are placed by their own builders. Next: a scribe\'s stool and a reed screen against the wind.',
  ],
  envelope: { w: [16, 24], d: [16, 24] },
  build({ W, D }, { palette: P, rng }) {
    const cx = W / 2, cy = D / 2, R = Math.min(W, D) / 2 - 0.5, out = [];
    const ring = (r, n = 16) => Array.from({ length: n }, (_, i) => { const a = (i / n) * 6.2832; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
    // the page draws triangles and parallelograms only: a round floor is a fan of triangles
    const fan = (kind, r, z, fill) => { const p = ring(r); return p.map((q, i) => ({ kind, poly: [[cx, cy], q, p[(i + 1) % p.length]], x: cx - r, y: cy - r, w: 2 * r, d: 2 * r, z, fill })); };
    const grounds = [...fan('threshing-floor', R, 0.04, P.floor), ...fan('threshing-straw', R * 0.7, 0.05, P.chaff)];
    out.push(...ring(R + 0.05, 40).map(([x, y]) => box('floor-kerb', x - 0.22, y - 0.22, 0.44, 0.44, 0, 0.12, scaleHex(P.floor, 0.85))));
    // the sledge on the south side of the circuit, heading west (the team goes round)
    const team = [beam('yoke', [-0.7, 0.6, 0.11], [0.7, 0.6, 0.11], 0.1, P.wood), beam('sledge-pole', [0, 0.6, 0.12], [0, 2.95, 0.22], 0.08, P.wood)];
    team.push(box('threshing-sledge', -0.5, 3.0, 1.0, 1.4, 0.04, 0.16, P.wood), { kind: 'threshing-sledge', solid: 'wedge', x: -0.5, y: 2.6, w: 1.0, d: 0.42, z0: 0.04, z1: 0.42, rise: 'y-', tint: P.wood });
    for (const [x, y] of [[-0.3, 3.3], [0.25, 3.6], [-0.1, 4.0]]) team.push(box('sledge-stone', x - 0.12, y - 0.1, 0.24, 0.2, 0.16, 0.3, scaleHex(P.stone, 0.9)));   // stones to weight it
    // turn it to run along the circuit (−x) by swapping axes: it is built along y
    const sy = cy + R * 0.48, sx = cx + 1.5;
    out.push(...team.map((b) => turnToX(b, sx, sy)));
    // the heaps, on the north side
    const hx = cx - R * 0.25, hy = cy - R * 0.38, hr = Math.min(1.9, R * 0.22);
    out.push(drum(hx, hy, hr, 0, hr * 0.62, P.grain, { kind: 'grain-heap', sides: 14, taper: 0.42 }), drum(hx, hy, hr * 0.42, hr * 0.62, hr * 0.85, scaleHex(P.earth[3], 0.92), { kind: 'grain-seal', sides: 14, taper: 0.12 }));
    out.push(box('clay-sealing', hx - 0.12, hy - hr * 0.42 - 0.04, 0.24, 0.08, hr * 0.62, hr * 0.72, scaleHex(P.earth[3], 0.7)));
    out.push(drum(hx + hr * 2.6, hy + 0.8, hr * 1.15, 0, hr * 0.38, P.chaff, { kind: 'chaff-heap', sides: 12, taper: 0.3 }));
    // a winnowing shovel stuck in the heap's flank, its handle up; the measure beside the heap
    const gx = hx + hr * 0.75, gy = hy + 0.15;
    out.push(box('tool-blade', gx - 0.17, gy - 0.03, 0.34, 0.06, hr * 0.15, hr * 0.15 + 0.42, scaleHex(P.wood, 1.12)), beam('tool', [gx, gy, hr * 0.15 + 0.4], [gx + 0.75, gy + 0.1, hr * 0.15 + 1.75], 0.05, P.wood));
    out.push(drum(hx - hr - 0.6, hy + hr * 0.6 - 0.75, 0.24, 0, 0.36, scaleHex(P.copper, 1.12), { kind: 'grain-measure', sides: 10, open: true, lip: 0.04 }));
    // the sheaves waiting at the edge, east
    for (let i = 0; i < 10; i++) out.push(...sheafDown(cx + R * 0.62 + rng() * R * 0.18, cy - R * 0.3 + rng() * R * 0.5, rng() * 6.283, P));
    return { boxes: out, grounds };
  },
};
/** Turn a part built along +y (centred on x = 0) to run along −x, standing at (sx, sy). */
function turnToX(b, sx, sy) {
  const r = (x, y, w, d) => ({ x: sx + y, y: sy - x - w, w: d, d: w });
  const o = { ...b, ...r(b.x, b.y, b.w, b.d) };
  if (b.top) o.top = r(b.top.x, b.top.y, b.top.w, b.top.d);
  if (b.rise) o.rise = { 'y-': 'x-', 'y+': 'x+', 'x+': 'y-', 'x-': 'y+' }[b.rise];
  if (b.solid === 'beam') { o.a = [sx + b.a[1], sy - b.a[0], b.a[2]]; o.b = [sx + b.b[1], sy - b.b[0], b.b[2]]; }
  if (b.solid === 'ring') o.plane = b.plane === 'y' ? undefined : 'y';
  if (b.axis) o.axis = b.axis === 'y' ? 'x' : 'y';
  return o;
}

// ── buildings away from the town ──

/**
 * The cattle byre (the Uruk trough's, and the dairy on the al-Ubaid frieze): a barrel of bundled reed,
 * its door end open and dark, bundled reed posts crowned with rings rising through its roof; a reed
 * fence pens the yard in front, a long feeding trough in it, and by the door the dairy's great
 * churning jars and the milking pots.
 */
export const reedByre = {
  id: 'reed-byre', designed: true, patterns: ['byre', 'reed'],
  read: 'A reed cattle byre with ringed reed posts through its roof, a fenced pen with its trough, churning jars at the door.',
  notes: [
    'Byre: a reed vault (axis y) the slot\'s width less 1 m, 8–9 m long at the back of the slot, its front end open and dark; reed ties as rings.',
    'Ring posts: three bundled reed drums rising 1.6 m through the roof ridge, each crowned with an upright ring (the goddess\'s sign).',
    'Pen: reed-mat fence panels 1.2 m high on posts round the front, a gap at the front centre.',
    'In the pen: a mud-brick feeding trough along one side with fodder in it; two churning jars 0.9 m high and two milking pots by the door.',
    'The cattle, the calf and the milker are placed by their own builders. Next: a reed screen hung over the door.',
  ],
  envelope: { w: [7, 10], d: [14, 19] },
  build({ W, D }, { palette: P }) {
    const reed = P.reed, tie = scaleHex(reed, 0.78), out = [];
    const L = Math.min(9, D * 0.5), y0 = D - L, R = (W - 1) / 2, wall = R * 0.5, top = wall + R;
    out.push({ kind: 'reed-house', solid: 'vault', x: 0.5, y: y0, w: W - 1, d: L, z0: 0, z1: top, axis: 'y', open: 'lo', tint: reed });
    for (let y = y0 + 1.4; y < D - 0.6; y += 1.9) out.push({ kind: 'reed-tie', solid: 'vault', x: 0.4, y, w: W - 0.8, d: 0.22, z0: 0, z1: top + 0.1, axis: 'y', caps: false, tint: tie });
    for (const f of [0.08, 0.5, 0.92]) {
      const cy = y0 + L * f, h = top + 1.6;
      out.push(drum(W / 2, cy, 0.32, top - 0.4, h, tie, { kind: 'reed-post', sides: 8, taper: 0.85 }));
      out.push({ kind: 'reed-ring', solid: 'ring', x: W / 2 - 0.45, y: cy - 0.08, w: 0.9, d: 0.16, z0: h - 0.05, z1: h + 0.85, band: 0.14, tint: reed });
    }
    // the pen: fence panels on posts round the front, a gap at the front centre
    const pen = { x: 0.2, y: 0.3, w: W - 0.4, d: y0 - 0.3 }, gap = 1.6;
    const panel = (x, y, w, d) => out.push(box('reed-fence', x, y, w, d, 0, 1.2, scaleHex(reed, 0.95)));
    panel(pen.x, pen.y, (pen.w - gap) / 2, 0.08); panel(pen.x + (pen.w + gap) / 2, pen.y, (pen.w - gap) / 2, 0.08);
    panel(pen.x, pen.y, 0.08, pen.d); panel(pen.x + pen.w - 0.08, pen.y, 0.08, pen.d);
    for (let x = pen.x; x <= pen.x + pen.w + 1e-6; x += pen.w / Math.round(pen.w / 1.6)) out.push(drum(x + 0.02, pen.y + 0.04, 0.08, 0, 1.45, tie, { kind: 'fence-post', sides: 6 }));
    for (let y = pen.y + pen.d / 3; y < pen.y + pen.d; y += pen.d / 3) for (const x of [pen.x + 0.04, pen.x + pen.w - 0.04]) out.push(drum(x, y, 0.08, 0, 1.45, tie, { kind: 'fence-post', sides: 6 }));
    // the feeding trough along the pen's west side, the dairy's jars by the door
    const td = Math.max(2, pen.d - 2.4);
    out.push(box('trough', pen.x + 0.4, pen.y + 1, 0.8, td, 0, 0.55, scaleHex(P.earth[1], 1.02), { skin: 'mud-plaster' }), box('trough-feed', pen.x + 0.52, pen.y + 1.12, 0.56, td - 0.24, 0.45, 0.53, P.straw));
    for (const o of [0, 1]) out.push(...jar(pen.x + pen.w - 0.9 - o * 0.95, y0 - 0.9, 1.6, scaleHex(P.copper, 1.08 + o * 0.06)));
    for (const o of [0, 1]) out.push(...jar(W / 2 - 1.4 - o * 0.55, y0 - 0.6, 0.6, scaleHex(P.copper, 1.15)));
    return out;
  },
};
/**
 * The sheepfold: a ring of reed-mat fence with a gap for the gate, a small reed shelter in the back
 * corner, a water trough and a heap of fodder in the fold, the shepherd's crook leaning by the gate.
 */
export const sheepfold = {
  id: 'sheepfold', designed: true, patterns: ['sheepfold', 'reed'],
  read: 'A reed-fenced fold with a little reed shelter, a water trough, fodder, a crook leaning by the gate.',
  notes: [
    'Fence: reed-mat panels 1.3 m high round the slot on posts every ~1.6 m, a 1.8 m gap in the front.',
    'Shelter: a small reed vault in the back corner, open toward the fold.',
    'Trough: a low brick-rimmed water trough along the west fence; fodder: a low dome of straw in the middle.',
    'Crook: a beam with a short hooked head leaning on the fence by the gap. The flock and the shepherd are placed by their own builders.',
  ],
  envelope: { w: [11, 18], d: [9, 15] },
  build({ W, D }, { palette: P }) {
    const reed = P.reed, tie = scaleHex(reed, 0.78), out = [], gap = 1.8;
    const panel = (x, y, w, d) => out.push(box('reed-fence', x, y, w, d, 0, 1.3, scaleHex(reed, 0.95)));
    panel(0, 0, (W - gap) / 2, 0.08); panel((W + gap) / 2, 0, (W - gap) / 2, 0.08); panel(0, D - 0.08, W, 0.08); panel(0, 0, 0.08, D); panel(W - 0.08, 0, 0.08, D);
    for (const [x0, y0, x1, y1] of [[0, 0, W, 0], [0, D, W, D], [0, 0, 0, D], [W, 0, W, D]]) {
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / 1.6));
      for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; out.push(drum(Math.min(W - 0.08, Math.max(0.08, x)), Math.min(D - 0.08, Math.max(0.08, y)), 0.08, 0, 1.5, tie, { kind: 'fence-post', sides: 6 })); }
    }
    const sw = Math.min(4, W * 0.3), sd = Math.min(5, D * 0.42), sx = W - sw - 0.3, sy = D - sd - 0.3;
    out.push({ kind: 'reed-house', solid: 'vault', x: sx, y: sy, w: sw, d: sd, z0: 0, z1: sw * 0.62, axis: 'y', open: 'lo', tint: reed });
    // the water trough along the west fence, fodder in the middle, the crook by the gate
    const brick = scaleHex(P.paving, 0.95), tl = Math.min(4, D * 0.4), ty = D * 0.3;
    for (const [x, y, w, d] of [[0.4, ty, 0.9, 0.15], [0.4, ty + tl - 0.15, 0.9, 0.15], [0.4, ty, 0.15, tl], [1.15, ty, 0.15, tl]]) out.push(box('trough', x, y, w, d, 0, 0.4, brick, { skin: 'baked-brick' }));
    out.push(box('trough-water', 0.55, ty + 0.15, 0.6, tl - 0.3, 0, 0.32, scaleHex(P.water, 1.15)));
    out.push(dome(W * 0.45, D * 0.55, 1.1, 0, 0.7, P.straw, { kind: 'straw-heap', sides: 10 }));
    const gx = (W + gap) / 2 + 0.3;
    out.push(beam('crook', [gx, 0.35, 0.02], [gx + 0.12, 0.12, 1.85], 0.045, P.wood), beam('crook', [gx + 0.12, 0.12, 1.85], [gx + 0.3, 0.12, 1.7], 0.045, P.wood));
    return out;
  },
};

/**
 * The stable for the donkeys (and the onager-donkey hybrids the temple bred for its wagons): a long
 * mud-brick shed, its back and ends walled, its front open between brick piers, a bay to a beast with
 * a brick manger along the back wall and a tethering peg at each pier; a flat roof of beams and mats
 * under packed mud; a heap of straw at one end.
 */
export const stable = {
  id: 'stable', designed: true, patterns: ['stable', 'flat-roof-cube', 'sun-dried-earth'],
  read: 'A long mud-brick stable open along its front between piers, a manger along its back, straw heaped at the end.',
  notes: [
    'Shed: back and end walls 0.6 m thick, 3.0 m high; the front open between brick piers 0.7 m square, one bay per ~2.6 m.',
    'Roof: a slab 0.35 m thick overhanging the front by 0.5 m, beam ends showing under it, a parapet rim.',
    'Mangers: a brick trough 0.6 high along the back wall, fodder in it; a tethering peg on each pier. The donkeys are placed by their own builder.',
    'Straw: a low dome heaped against the outer end wall.',
  ],
  envelope: { w: [12, 20], d: [6, 8] },
  build({ W, D }, { palette: P }) {
    const mud = P.earth[1], band = scaleHex(mud, 0.93), t = 0.6, H = 3.0, out = [], sw = W - 2.6;   // the straw heap takes the last 2.6 m
    out.push(box('stable-wall', 0, D - t, sw, t, 0, H, mud, { skin: 'mud-plaster' }), box('stable-wall', 0, 0.5, t, D - 0.5 - t, 0, H, mud, { skin: 'mud-plaster' }), box('stable-wall', sw - t, 0.5, t, D - 0.5 - t, 0, H, mud, { skin: 'mud-plaster' }));
    const n = Math.max(3, Math.round((sw - 2 * t) / 2.6)), bay = (sw - 2 * t) / n;
    for (let i = 1; i < n; i++) out.push(box('stable-pier', t + i * bay - 0.35, 0.5, 0.7, 0.7, 0, H, scaleHex(mud, 1.04), { skin: 'mudbrick' }));
    out.push(box('house-roof', -0.1, 0, sw + 0.2, D, H, H + 0.35, band), box('house-parapet', -0.1, 0, sw + 0.2, 0.3, H + 0.35, H + 0.8, band), box('house-parapet', -0.1, D - 0.3, sw + 0.2, 0.3, H + 0.35, H + 0.8, band));
    for (let x = 0.4; x < sw - 0.2; x += 0.9) out.push(box('beam-end', x, 0.3, 0.18, 0.3, H - 0.25, H - 0.05, scaleHex(P.wood, 1.1)));
    out.push(box('manger', t, D - t - 0.7, sw - 2 * t, 0.7, 0, 0.6, scaleHex(P.paving, 0.95), { skin: 'baked-brick' }), box('manger-feed', t + 0.1, D - t - 0.6, sw - 2 * t - 0.2, 0.5, 0.5, 0.58, P.straw));
    for (let i = 1; i < n; i++) out.push(box('tether-peg', t + i * bay - 0.05, 1.2, 0.1, 0.12, 1.1, 1.22, P.wood));
    out.push(dome(sw + 1.25, D * 0.55, 1.2, 0, 1.4, P.straw, { kind: 'straw-heap', sides: 12 }));
    return out;
  },
};

/**
 * The storehouse — the farm's barn: a blind mud-brick block, buttressed, its one narrow door sealed
 * with a clay sealing on a peg; grain goes in from the roof through hatches, carried up a brick stair
 * against its end; sacks and jars wait by the door, a basket of grain on the stair.
 */
export const storehouse = {
  id: 'storehouse', designed: true, patterns: ['storehouse', 'blank-wall', 'niched-wall', 'sun-dried-earth'],
  read: 'A blind buttressed storehouse filled from roof hatches up an end stair; a sealed door, sacks and jars by it.',
  notes: [
    'Block: the slot less a 2.2 m stair strip at one end, 4.2 m high, mud plaster; buttress ribs on the front and back.',
    'Door: a dark slot 0.9 × 1.9 m in the front, a door frame proud of it, a clay sealing on a peg beside it.',
    'Roof: hatches (dark boxes) in a row; a parapet; a sloped stair up the end between cheek walls.',
    'By the door: sacks (boxes, pale cloth) and three storage jars; a basket of grain set down halfway up the stair.',
  ],
  envelope: { w: [10, 16], d: [6, 9] },
  build({ W, D }, { palette: P, rng }) {
    const mud = P.earth[0], band = scaleHex(mud, 0.92), dark = scaleHex(mud, 0.38), H = 4.2, sw = 2.2, bw = W - sw, out = [];
    const body = { x: 0, y: 0.6, w: bw, d: D - 0.95 };   // the back buttresses stand in the last 0.35 m
    out.push(box('storehouse', body.x, body.y, body.w, body.d, 0, H, mud, { skin: 'mud-plaster' }));
    for (let x = 1.2; x < bw - 0.6; x += 1.8) for (const y of [body.y - 0.35, body.y + body.d]) if (Math.abs(x - bw / 2) > 1.1 || y > 1) out.push(box('rib', x - 0.35, y, 0.7, 0.35, 0, H * 0.94, scaleHex(mud, 1.03), { skin: 'mud-plaster' }));
    out.push(box('house-roof', -0.1, body.y - 0.1, bw + 0.2, body.d + 0.2, H, H + 0.3, band));
    for (const [y, d] of [[body.y - 0.1, 0.3], [body.y + body.d - 0.2, 0.3]]) out.push(box('house-parapet', -0.1, y, bw + 0.2, d, H + 0.3, H + 0.8, band));
    for (let x = 1.5; x < bw - 1; x += 2.6) out.push(box('roof-hatch', x, body.y + body.d / 2 - 0.45, 0.9, 0.9, H + 0.3, H + 0.34, dark), box('hatch-kerb', x - 0.1, body.y + body.d / 2 - 0.55, 1.1, 0.1, H + 0.3, H + 0.5, band));
    const dx = bw / 2;
    out.push(box('door-frame', dx - 0.75, body.y - 0.12, 1.5, 0.12, 0, 2.4, band), box('door', dx - 0.45, body.y - 0.16, 0.9, 0.08, 0, 1.9, dark));
    out.push(box('door-peg', dx + 0.62, body.y - 0.28, 0.08, 0.2, 1.15, 1.23, P.wood), box('clay-sealing', dx + 0.58, body.y - 0.34, 0.16, 0.1, 1.05, 1.25, scaleHex(P.earth[3], 0.7)));
    // the stair up the end to the roof, between cheek walls
    out.push(...slopedFlight({ x: bw + 0.35, y: 0.6, w: sw - 0.5, d: D - 0.6 }, 0, H + 0.3, P.stair, 'y+', { cheek: 0.3, cheekTint: band, riser: 0.32 }));
    const pz = (H + 0.3) * 0.55, py = 0.6 + (D - 0.6) * 0.55;
    out.push(basket(bw + 1.1, py, 0.26, 0.32, P, pz), drum(bw + 1.1, py, 0.22, pz + 0.28, pz + 0.38, P.grain, { kind: 'grain-heap', sides: 9, taper: 0.4 }));
    for (let i = 0; i < 4; i++) out.push(box('sack', 0.6 + i * 0.75 + rng() * 0.1, 0.05 + rng() * 0.15, 0.6, 0.42, 0, 0.55, scaleHex(P.cloth, 0.95 + rng() * 0.08)));
    for (let i = 0; i < 3; i++) out.push(...jar(bw - 1.0 - i * 0.75, 0.3, 1.25, scaleHex(P.copper, 1.05 + i * 0.04)));
    return out;
  },
};

/**
 * The farmhouse: a walled yard with a back range of rooms and a side wing, the yard gate in the front
 * wall; in the yard a bread oven (tannur), a reed sun-shade on four posts, water jars, and a ground
 * loom pegged out with its cloth half woven — the estate's women wove its wool.
 */
export const farmhouse = {
  id: 'farmhouse', designed: true, patterns: ['farmstead', 'courtyard-house', 'flat-roof-cube', 'sun-dried-earth'],
  read: 'A mud-brick farmhouse round a walled yard: a bread oven, a reed shade, jars, a ground loom with its cloth half woven.',
  notes: [
    'Back range: rooms the full width, 4.5 m deep, 3.4 m high, a door and a window to the yard; a side wing 4 m wide down one side, 3.0 m high.',
    'Yard wall 2.0 m high closing the other side and the front; the gate a 2 m gap in the front with a door frame.',
    'Tannur: a beehive oven (a dome r 0.55 on a 0.3 m drum) with a dark mouth; a reed shade on four posts, its mat roof a thin plate.',
    'Ground loom: four pegs, two beams 1.8 m apart across the warp (a thin pale sheet), the woven cloth a third of the way. The weaver is placed by her own builder.',
  ],
  envelope: { w: [15, 22], d: [13, 19] },
  build({ W, D }, { palette: P, rng }) {
    const tint = P.earth[2], band = scaleHex(tint, 0.93), dark = scaleHex(tint, 0.42), out = [];
    const kd = 4.5, h1 = 3.4, ww = 4, h2 = 3.0, t = 0.5, left = rng() < 0.5;
    const body = (x, y, w, d, h) => { out.push(box('house', x, y, w, d, 0, h, tint), box('house-roof', x - 0.1, y - 0.1, w + 0.2, d + 0.2, h, h + 0.3, band)); };
    body(0, D - kd, W, kd, h1);
    out.push(box('house-parapet', -0.1, D - 0.3, W + 0.2, 0.3, h1 + 0.3, h1 + 0.8, band));
    const wx = left ? 0 : W - ww;
    body(wx, t, ww, D - kd - t, h2);
    // the yard wall: front (with the gate) and the open side
    const gx = left ? ww + (W - ww) * 0.55 : (W - ww) * 0.45, gw = 2;
    out.push(box('court-wall', 0, 0, gx - gw / 2, t, 0, 2, tint), box('court-wall', gx + gw / 2, 0, W - gx - gw / 2, t, 0, 2, tint));
    out.push(box('court-wall', left ? W - t : 0, t, t, D - kd - t, 0, 2, tint));
    out.push(box('door-frame', gx - gw / 2 - 0.3, -0.15, 0.3, t + 0.3, 0, 2.5, band), box('door-frame', gx + gw / 2, -0.15, 0.3, t + 0.3, 0, 2.5, band));
    // doors to the yard
    for (const f of [0.25, 0.6]) out.push(box('door', (left ? ww : 0) + (W - ww) * f, D - kd - 0.06, 1, 0.08, 0, 2.1, dark));
    out.push(box('window', (left ? ww : 0) + (W - ww) * 0.85, D - kd - 0.06, 0.6, 0.08, 1.6, 2.4, dark), box('door', left ? ww : W - ww - 0.08, (D - kd) * 0.5, 0.08, 1, 0, 2.1, dark));
    // the yard
    const y0 = t, x0 = left ? ww : t, yw = W - ww - t, yd = D - kd - t;
    const ox0 = x0 + yw * 0.12, oy0 = y0 + yd * 0.7;
    out.push(drum(ox0 + 0.6, oy0, 0.62, 0, 0.3, scaleHex(tint, 1.05), { kind: 'tannur', sides: 10 }), dome(ox0 + 0.6, oy0, 0.55, 0.3, 1.25, scaleHex(tint, 1.1), { kind: 'tannur', sides: 10 }), drum(ox0 + 0.6, oy0, 0.12, 1.2, 1.27, '#2b2622', { kind: 'tannur-mouth', sides: 8 }));
    const sx = x0 + yw * 0.5, sy = y0 + yd * 0.45, sw2 = Math.min(4, yw * 0.4), sd = 3;
    for (const [px, py] of [[sx, sy], [sx + sw2, sy], [sx, sy + sd], [sx + sw2, sy + sd]]) out.push(box('shade-post', px - 0.08, py - 0.08, 0.16, 0.16, 0, py > sy + 1 ? 2.5 : 2.2, P.wood));
    out.push(plate('reed-mat', sx - 0.3, sy - 0.3, sw2 + 0.6, 0.06, sd + 0.6, 2.2, 2.55, P.reed));
    for (let i = 0; i < 3; i++) out.push(...jar(x0 + 0.7 + i * 0.8, y0 + 0.7, 1.3, scaleHex(P.copper, 1.04 + i * 0.05)));
    // the ground loom under the shade
    const lx = sx + 0.4, ly = sy + 0.5, lw = Math.min(1.4, sw2 - 0.8), ll = 1.8;
    out.push(box('loom-warp', lx, ly, lw, ll, 0.04, 0.07, P.wool));
    for (const y of [ly - 0.05, ly + ll - 0.05]) out.push(beam('loom-beam', [lx - 0.15, y, 0.1], [lx + lw + 0.15, y, 0.1], 0.08, P.wood));
    for (const [px, py] of [[lx - 0.2, ly - 0.1], [lx + lw + 0.12, ly - 0.1], [lx - 0.2, ly + ll], [lx + lw + 0.12, ly + ll]]) out.push(box('loom-peg', px, py, 0.08, 0.08, 0, 0.3, P.wood));
    out.push(box('loom-cloth', lx, ly, lw, ll * 0.35, 0.07, 0.09, scaleHex(P.cloth, 0.92)));
    return { boxes: out, grounds: [{ kind: 'court', x: x0, y: y0, w: yw, d: yd, z: 0.03, fill: P.lane, surface: 'mud' }] };
  },
};

/**
 * The tool shed: a reed lean-to against a low mud wall, and the estate's tools kept in it — hoes and
 * mattocks leaning on the wall, winnowing shovels, clay sickles hung on pegs, baskets, seed jars, a
 * spare plough share — the hoe and the plough of the Sumerian debate side by side.
 */
export const toolShed = {
  id: 'tool-shed', designed: true, patterns: ['tool-store', 'reed'],
  read: 'A reed lean-to on a low mud wall sheltering the estate\'s tools: hoes, mattocks, shovels, sickles on pegs, baskets, jars.',
  notes: [
    'Back wall: mud brick 0.4 thick, 2.0 m high; two posts at the front 2.4 m; the mat roof a thin plate sloping down to the front.',
    'Hoes and mattocks: handle beams leaning from the floor at the front to the wall top; the blade a small box at the foot.',
    'Shovels: handle + broad flat blade; sickles: grip + crescent on pegs along the wall at 1.4 m.',
    'Floor: a reed mat, two baskets, two seed jars, a spare ard sole lying along the front.',
  ],
  envelope: { w: [4.5, 7], d: [3, 4.2] },
  build({ W, D }, { palette: P, rng }) {
    const wood = P.wood, blade = scaleHex(P.copper, 0.95), out = [], wt = 0.4, hw = 2.0;
    out.push(box('court-wall', 0, D - wt, W, wt, 0, hw, P.earth[1]));
    for (const x of [0.1, W - 0.26]) out.push(box('shade-post', x, 0.2, 0.16, 0.16, 0, 2.4, wood));
    out.push(plate('reed-mat', -0.2, 0, W + 0.4, 0.06, D - wt, 2.4, hw + 0.2, P.reed));
    out.push(box('reed-floor-mat', 0.3, 0.5, W - 0.6, D - wt - 0.6, 0.01, 0.03, scaleHex(P.reed, 0.88)));
    const yw = D - wt - 0.05;
    let x = 0.5;
    for (let i = 0; i < 3; i++, x += 0.38) out.push(...hoe(x, 0.9, [x + 0.05, yw - 0.05, 1.85], wood, blade));
    for (let i = 0; i < 2; i++, x += 0.45) out.push(...shovel(x, 1.0, [x + 0.05, yw - 0.05, 1.9], wood));
    for (let i = 0; i < 4; i++) { const px = x + 0.3 + i * 0.42; out.push(box('peg', px - 0.03, yw - 0.12, 0.06, 0.12, 1.42, 1.48, wood), ...sickle([px, yw - 0.14, 1.32], 1, '#b0744c')); }
    out.push(basket(W - 1.2, 1.2, 0.3, 0.38, P), basket(W - 0.65, 1.5, 0.24, 0.3, P), ...jar(W - 0.8, D - wt - 0.6, 1.1, scaleHex(P.copper, 1.1)), ...jar(W - 1.5, D - wt - 0.6, 1.0, scaleHex(P.copper, 1.15)));
    out.push(box('plough', 0.6, 0.35, 1.0, 0.14, 0.03, 0.17, wood), { kind: 'plough-share', solid: 'wedge', x: 0.25, y: 0.33, w: 0.36, d: 0.18, z0: 0.03, z1: 0.17, rise: 'x+', tint: scaleHex(wood, 0.8) });
    out.push(drum(W / 2 + 0.2, 0.6, 0.22, 0.03, 0.18, scaleHex(P.copper, 1.1), { kind: 'grain-measure', sides: 10, open: true, lip: 0.03 }));
    return out;
  },
};

/**
 * The shaduf: a lifting pole on the canal bank — two mud-brick pillars carrying a crossbeam, a long
 * sweep pivoting on it, a lump of clay for a counterweight at its short end and a bucket on a rope at
 * the long end over the water, at rest with its counterweight down; a brick basin on the bank behind
 * takes what it lifts. Front (−y) toward the water; the sweep and bucket reach over it, past the slot.
 */
export const shaduf = {
  id: 'shaduf', designed: true, patterns: ['shaduf', 'irrigation'],
  read: 'A counterweighted sweep on two mud pillars its bucket hanging over the canal, a brick basin on the bank behind.',
  notes: [
    'Pillars: two mud-brick boxes 0.6 × 0.5, 2.3 m high, 1.3 m apart; a crossbeam on top.',
    'Sweep: a beam 6.5 m long pivoting on the crossbeam, its short end (≈ 1/4) down at the back with a clay counterweight (a drum), its long end up over the water.',
    'Rope: a thin box hanging from the tip to a bucket (a flaring drum) just above the water. The waterman is placed by his own builder.',
    'Basin: a small brick-rimmed pool on the bank behind the pillars, a channel running back from it.',
  ],
  envelope: { w: [2.6, 4], d: [4.5, 6] },
  build({ W, D, slot }, { palette: P }) {
    const cx = W / 2, wz = slot.waterZ ?? -1.2, mud = P.earth[1], out = [], py = 1.6, ph = 2.3;
    for (const o of [-1, 1]) out.push(box('shaduf-pillar', cx + o * 0.65 - 0.3, py, 0.6, 0.5, 0, ph, mud, { skin: 'mudbrick' }));
    out.push(beam('shaduf-crossbeam', [cx - 1.0, py + 0.25, ph + 0.06], [cx + 1.0, py + 0.25, ph + 0.06], 0.14, P.wood));
    const piv = [cx, py + 0.25, ph + 0.12], tip = [cx, -1.6, ph + 1.7], tail = [cx, py + 0.25 + 1.6, ph - 0.95];
    out.push(beam('shaduf-sweep', tail, tip, 0.12, P.wood));
    out.push(drum(tail[0], tail[1], 0.32, tail[2] - 0.5, tail[2] + 0.05, scaleHex(P.earth[3], 0.85), { kind: 'counterweight', sides: 8, taper: 0.8 }));
    const bz = wz + 0.35;
    out.push(box('rope', tip[0] - 0.02, tip[1] - 0.02, 0.04, 0.04, bz + 0.4, tip[2], scaleHex(P.reed, 0.7)));
    out.push(drum(tip[0], tip[1], 0.22, bz, bz + 0.42, scaleHex(P.copper, 1.1), { kind: 'bucket', sides: 8, taper: 1.2, open: true, lip: 0.03 }));
    // the basin and its channel, behind the pillars
    const bx = cx - 0.8, by = py + 0.9, bw = 1.6, bd = 1.4, brick = scaleHex(P.paving, 0.95);
    for (const [x, y, w, d] of [[bx, by, bw, 0.2], [bx, by + bd - 0.2, bw, 0.2], [bx, by, 0.2, bd], [bx + bw - 0.2, by, 0.2, bd]]) out.push(box('basin-rim', x, y, w, d, 0, 0.35, brick, { skin: 'baked-brick' }));
    return { boxes: out, grounds: [{ kind: 'water', x: bx + 0.2, y: by + 0.2, w: bw - 0.4, d: bd - 0.4, z: 0.25, fill: P.water }] };
  },
};

/**
 * A sluice at a field channel's head: two baked-brick cheeks either side of the channel, timber gate
 * boards dropped into slots between them, posts and a plank across the top to stand on.
 */
export const sluice = {
  id: 'sluice', designed: true, patterns: ['irrigation', 'fired-brick'],
  read: 'Brick cheeks either side of a channel, gate boards dropped between them, a plank across the top.',
  notes: [
    'Cheeks: baked-brick blocks 0.9 m wide either side of the channel, 1.0 m high (from 0.2 below the bank).',
    'Gate: boards stacked to 0.55 m between two posts in the channel\'s middle; a plank 0.3 wide across the top.',
  ],
  envelope: { w: [3, 4.5], d: [1.4, 2.2] },
  build({ W, D }, { palette: P }) {
    const brick = scaleHex(P.paving, 0.92), c = 0.9, out = [];
    out.push(box('sluice-cheek', 0, 0, c, D, -0.2, 0.8, brick, { skin: 'baked-brick' }), box('sluice-cheek', W - c, 0, c, D, -0.2, 0.8, brick, { skin: 'baked-brick' }));
    for (const x of [c, W - c - 0.16]) out.push(box('sluice-post', x, D / 2 - 0.08, 0.16, 0.16, -0.2, 1.1, P.wood));
    for (let k = 0; k < 3; k++) out.push(box('sluice-board', c, D / 2 - 0.04, W - 2 * c, 0.08, -0.15 + k * 0.22, -0.15 + (k + 1) * 0.22 - 0.02, scaleHex(P.wood, 1 + k * 0.05)));
    out.push(box('sluice-plank', c - 0.2, D / 2 - 0.15, W - 2 * c + 0.4, 0.3, 0.8, 0.88, P.wood));
    return out;
  },
};

export const SUMER_FARM_ASSETS = Object.fromEntries([plough, harvestEdge, stook, farmCart, wagon, threshingFloor, reedByre, sheepfold, stable, storehouse, farmhouse, toolShed, shaduf, sluice].map((a) => [a.id, a]));

// the small parts the works kit (./sumer-works.js) builds with too
export { box, drum, dome, wheel, plate, sickle, hoe, basket, jar, sheafDown };
