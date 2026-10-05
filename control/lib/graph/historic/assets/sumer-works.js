/**
 * historic/assets/sumer-works — the Sumerian works: where the tools, the bricks and the pots were made
 * (patterns.js family `works`). Same contract as ./sumer-farm.js: local frame, metres, front −y,
 * `ctx` = { palette, culture, rng }; the record behind each piece is ../record/sumer-works.js.
 *
 * The alluvium has clay, reed, water and palm, and nothing else: no building stone, no ore, no tall
 * timber. Its quarry is the clay pit, and what it quarried became brick and pot. Stone, copper, tall
 * timber and bitumen came down the rivers by boat and were landed at the canal. The copper came as
 * ingots smelted at the mines (Magan, Anatolia, Iran), so the town's "forge" is a caster's and
 * smith's yard: a bowl hearth blown with reed blowpipes, crucibles, stone and clay moulds, an anvil
 * stone. There is no iron here and no bellowed furnace.
 *
 * Like the farm kit, the works stand at rest, without people: the blowpipes laid down by the
 * hearth, the mould left by its row of bricks, the wheel stopped with a pot on it.
 */
import { slopedFlight, beam } from './kit.js';
import { box, drum, dome, wheel, plate, sickle, hoe, basket, jar } from './sumer-farm.js';
import { scaleHex } from '../../polygonizer/vexar.js';

/** One planar face: corners [x, y, z] (local metres) facing `out`, its rect the corners' bounding box. */
function panel(kind, pts, out, tint) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]);
  return { kind, solid: 'panel', pts, out, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys), z0: Math.min(...zs), z1: Math.max(...zs), tint };
}
/** A low ring of four boxes round a rect: a pit's or a tank's rim. */
const rim = (kind, x, y, w, d, t, h, tint, o = {}) => [box(kind, x, y, w, t, 0, h, tint, o), box(kind, x, y + d - t, w, t, 0, h, tint, o), box(kind, x, y + t, t, d - 2 * t, 0, h, tint, o), box(kind, x + w - t, y + t, t, d - 2 * t, 0, h, tint, o)];
/** A bundle of reed lying from a to b. */
const bundle = (a, b, P, t = 0.28) => beam('reed-bundle', a, b, t, P.reed);
/** A hearth's fire: a bed of charcoal with its glow, r across, its top at z. */
const fire = (cx, cy, r, z, P) => [drum(cx, cy, r, z - 0.1, z, P.charcoal, { kind: 'charcoal', sides: 10 }), drum(cx, cy, r * 0.55, z, z + 0.03, P.ember, { kind: 'ember', sides: 8 })];

// ── the clay: the alluvium's own quarry ──

/**
 * The clay pit: a pit cut 1.6 m into the alluvium by the canal, its sides sloping, its floor wet with
 * seepage, lumps of dug clay and baskets left on the floor, a ladder against one side. The slot IS the
 * pit: the layout leaves its ground out, so the pit's floor shows under the plain.
 */
export const clayPit = {
  id: 'clay-pit', designed: true, sunk: true, patterns: ['clay-pit'],
  read: 'A pit dug into the alluvium for brick clay: sloping cut sides, a wet floor, lumps of clay and baskets, a ladder.',
  notes: [
    'Sides: four sloping panels from the rim (the slot edge, ground level) 1.3 m in and 1.6 m down; the cut a darker clay.',
    'Floor: wet mud at −1.6 m with a seepage puddle in one corner.',
    'On the floor: four dug lumps (low domes), a mattock leaning on the back slope, two baskets. A ladder (two rails, rungs) leans on the front slope.',
    'The layout cuts the slot out of the base ground; the diggers and carriers are placed by their own builders.',
  ],
  envelope: { w: [12, 20], d: [8, 12] },
  build({ W, D }, { palette: P, rng }) {
    const dep = 1.6, run = 1.3, cut = scaleHex(P.clay, 0.92), out = [];
    out.push(panel('pit-side', [[0, 0, 0], [W, 0, 0], [W - run, run, -dep], [run, run, -dep]], [0, 1, 0.8], scaleHex(cut, 0.9)));
    out.push(panel('pit-side', [[0, D, 0], [W, D, 0], [W - run, D - run, -dep], [run, D - run, -dep]], [0, -1, 0.8], cut));
    out.push(panel('pit-side', [[0, 0, 0], [0, D, 0], [run, D - run, -dep], [run, run, -dep]], [1, 0, 0.8], scaleHex(cut, 0.96)));
    out.push(panel('pit-side', [[W, 0, 0], [W, D, 0], [W - run, D - run, -dep], [W - run, run, -dep]], [-1, 0, 0.8], scaleHex(cut, 0.86)));
    const fx = run, fy = run, fw = W - 2 * run, fd = D - 2 * run, z = -dep;
    for (let i = 0; i < 4; i++) out.push(dome(fx + 1 + rng() * (fw - 2), fy + 0.8 + rng() * (fd - 1.6), 0.35 + rng() * 0.25, z, z + 0.3 + rng() * 0.2, scaleHex(P.clay, 0.95 + rng() * 0.1), { kind: 'clay-lump', sides: 8 }));
    const mx = fx + fw * 0.7;
    out.push(beam('tool', [mx, D - run - 0.5, z + 0.1], [mx + 0.1, D - run * 0.35, z + dep * 0.8], 0.05, P.wood), box('tool-blade', mx - 0.11, D - run - 0.66, 0.22, 0.16, z, z + 0.16, P.flint));
    out.push(basket(fx + fw * 0.3, fy + fd * 0.6, 0.3, 0.36, P, z), basket(fx + fw * 0.4, fy + fd * 0.45, 0.26, 0.32, P, z));
    // the ladder up the front slope: rails from the floor to the rim, rungs across
    const lx = fx + fw * 0.15;
    for (const o of [0, 0.5]) out.push(beam('ladder', [lx + o, run + 0.25, z], [lx + o, -0.15, 0.3], 0.06, P.wood));
    for (let k = 1; k < 5; k++) { const t = k / 5, y = run + 0.25 - t * (run + 0.4), zz = z + t * (dep + 0.3); out.push(beam('ladder', [lx, y, zz], [lx + 0.5, y, zz], 0.04, P.wood)); }
    return { boxes: out, grounds: [{ kind: 'pit-floor', x: fx, y: fy, w: fw, d: fd, z, fill: scaleHex(P.clay, 0.85), surface: 'mud' }, { kind: 'water', x: fx + 0.2, y: fy + fd * 0.6, w: fw * 0.16, d: fd * 0.3, z: z + 0.03, fill: scaleHex(P.water, 0.9) }] };
  },
};

/**
 * The mixing pits beside the clay pit: two shallow treading pits ringed with a low earth rim, one wet
 * with fresh slurry and one with clay worked stiff; chopped straw heaped for temper, the worked clay
 * heaped ready for the moulders, water jars, baskets, a hoe stuck in the heap.
 */
export const clayMixing = {
  id: 'clay-mixing', designed: true, patterns: ['clay-pit', 'brick-moulding'],
  read: 'Two shallow treading pits for brick clay, a heap of chopped straw for temper, the worked clay heaped, jars and baskets.',
  notes: [
    'Pits: earth rims 0.35 wide, 0.3 high round two pits ≈ 3 × 3 m; slurry at 0.2 m (one wetter, one stiffer).',
    'Temper: a dome of chopped straw (the Sumerian brick is clay and straw); the worked clay a darker dome beside it.',
    'A hoe stuck in the clay heap; two water jars, three baskets (one full of clay).',
  ],
  envelope: { w: [8, 12], d: [5, 8] },
  build({ W, D }, { palette: P }) {
    const pw = Math.min(3.2, (W - 2.4) / 2), pd = Math.min(3.2, D - 2.2), earth = scaleHex(P.ground, 0.88), out = [], grounds = [];
    for (const [k, x] of [[0, 0.3], [1, 0.9 + pw]]) {
      out.push(...rim('pit-rim', x, D - pd - 0.3, pw, pd, 0.35, 0.3, earth));
      grounds.push({ kind: 'slurry', x: x + 0.35, y: D - pd + 0.05, w: pw - 0.7, d: pd - 0.7, z: 0.2, fill: scaleHex(P.clay, k ? 0.9 : 0.78), surface: 'mud' });
    }
    const hx = W - 1.2;
    out.push(dome(hx, D - 1.4, 1.0, 0, 0.75, scaleHex(P.clay, 0.88), { kind: 'clay-heap', sides: 10 }), dome(hx - 0.2, 1.1, 0.8, 0, 0.6, P.straw, { kind: 'straw-heap', sides: 10 }));
    out.push(...hoe(hx - 0.1, D - 1.4, [hx + 0.3, D - 1.0, 1.7], P.wood, P.flint).map((b) => (b.solid === 'beam' ? { ...b, a: [b.a[0], b.a[1], b.a[2] + 0.55] } : { ...b, z0: b.z0 + 0.45, z1: b.z1 + 0.45 })));
    out.push(...jar(0.8, 0.9, 1.3, scaleHex(P.copper, 1.1)), ...jar(1.6, 0.7, 1.2, scaleHex(P.copper, 1.15)));
    out.push(basket(3.0, 0.8, 0.3, 0.36, P), basket(3.8, 1.0, 0.28, 0.34, P), basket(4.6, 0.7, 0.3, 0.36, P), dome(4.6, 0.7, 0.26, 0.36, 0.5, scaleHex(P.clay, 0.88), { kind: 'clay-lump', sides: 8 }));
    return { boxes: out, grounds };
  },
};

/**
 * The moulding field: fresh bricks laid flat in long rows on sanded ground to dry (the ground's
 * texture), and at its front the moulding line: the open wooden mould left at the end of the last row,
 * a row of real bricks just struck from it, the heap of worked clay, a water jar and a basket of sand.
 * At the back, bricks turned up on edge to finish drying.
 */
export const brickField = {
  id: 'brick-field', designed: true, patterns: ['brick-moulding', 'sun-dried-earth'],
  read: 'A field of fresh mud bricks drying in rows; the wooden mould left at the end of the last row, bricks turned on edge behind.',
  notes: [
    'Field: a drying-bricks ground (rows of flat bricks on sand) over all but the front 2.5 m.',
    'Moulding line: a two-cell wooden mould (frame boards 0.05 thick, 0.1 high, handles at the ends) at the end of a row of ten fresh bricks (0.32 × 0.17 × 0.08).',
    'A heap of worked clay, a water jar and a basket of sand (thrown in the mould so the brick slips out).',
    'At the back: two rows of bricks set on edge, a hand apart. The moulders are placed by their own builder.',
  ],
  envelope: { w: [18, 30], d: [12, 20] },
  build({ W, D }, { palette: P, rng }) {
    const brick = P.earth[1], wet = scaleHex(brick, 0.82), wood = P.wood, out = [];
    const ry = 1.3;
    let x = 1.5;
    for (let i = 0; i < 10; i++, x += 0.24) out.push(box('fresh-brick', x, ry, 0.17, 0.32, 0, 0.08, scaleHex(wet, 0.96 + rng() * 0.08)));
    // the mould: two cells side by side, open top and bottom, a handle beyond each end
    const mx = x + 0.1, my = ry - 0.01, cw = 0.17, ch = 0.34, t = 0.05;
    out.push(box('brick-mould', mx, my, 2 * cw + 3 * t, t, 0, 0.1, wood), box('brick-mould', mx, my + ch + t, 2 * cw + 3 * t, t, 0, 0.1, wood));
    for (const k of [0, 1, 2]) out.push(box('brick-mould', mx + k * (cw + t), my + t, t, ch, 0, 0.1, wood));
    for (const [a, b] of [[[mx - 0.25, my + 0.2, 0.06], [mx, my + 0.2, 0.06]], [[mx + 2 * cw + 3 * t, my + 0.2, 0.06], [mx + 2 * cw + 3 * t + 0.25, my + 0.2, 0.06]]]) out.push(beam('mould-handle', a, b, 0.04, wood));
    out.push(dome(mx + 1.6, 0.9, 0.9, 0, 0.7, scaleHex(P.clay, 0.88), { kind: 'clay-heap', sides: 10 }));
    out.push(...jar(mx + 3.0, 0.8, 1.3, scaleHex(P.copper, 1.1)), basket(mx + 0.4, 0.5, 0.26, 0.3, P), dome(mx + 0.4, 0.5, 0.22, 0.3, 0.38, scaleHex(P.ground, 1.15), { kind: 'sand', sides: 8 }));
    // bricks on edge at the back, drying through
    for (const y of [D - 1.4, D - 0.8]) for (let bx = W * 0.45; bx < W - 0.6; bx += 0.4) out.push(box('brick-on-edge', bx, y, 0.32, 0.09, 0, 0.17, scaleHex(brick, 1.0 + rng() * 0.08)));
    return { boxes: out, grounds: [{ kind: 'brick-field', x: 0, y: 2.5, w: W, d: D - 2.5, z: 0.03, fill: brick, surface: 'drying-bricks' }] };
  },
};

/** Cured mud bricks stacked in open hacks to finish drying, one hack still going up. */
export const brickHacks = {
  id: 'brick-hacks', designed: true, patterns: ['brick-moulding', 'sun-dried-earth'],
  read: 'Cured mud bricks stacked in long hacks, the last one half built, loose bricks on top.',
  notes: [
    'Hacks: blocks 1.1 m wide, 2–3 m long, 1.3 m high in bare mudbrick (the skin draws the coursing), a hand apart.',
    'The last hack half height, a few loose bricks on its top.',
  ],
  envelope: { w: [8, 14], d: [5, 8] },
  build({ W, D }, { palette: P, rng }) {
    const out = [], n = Math.max(2, Math.floor(W / 1.6)), pitch = W / n;
    for (let i = 0; i < n; i++) {
      const last = i === n - 1, h = last ? 0.6 : 1.2 + rng() * 0.2, len = D - 1 - rng() * 1.2;
      out.push(box('brick-hack', i * pitch + 0.2, 0.5, 1.1, len, 0, h, scaleHex(P.earth[1], 1.0 + rng() * 0.06), { skin: 'mudbrick' }));
      if (last) for (let k = 0; k < 5; k++) out.push(box('brick', i * pitch + 0.25 + rng() * 0.6, 0.7 + rng() * (len - 0.6), 0.32, 0.17, h, h + 0.08, P.earth[1]));
    }
    return out;
  },
};

/**
 * The brick kiln: a rectangular updraft kiln of mud brick, fire-reddened, its firing tunnels opening
 * in the front, soot over their mouths; the top open on the setting of green bricks, half capped with
 * mud; an earth ramp up the side for loading. Fuel by the mouths (reed bundles, dung cakes), the ash
 * raked out, and the baked bricks stacked to one side.
 */
export const brickKiln = {
  id: 'brick-kiln', designed: true, patterns: ['brick-kiln', 'fired-brick'],
  read: 'A rectangular updraft brick kiln, its fire tunnels in the front, the top half capped, fuel and ash by the mouths, baked bricks stacked.',
  notes: [
    'Chamber: walls 0.9 m thick, 3.0 m high, fire-reddened mud plaster; firing tunnels: two vault mouths 0.9 wide, 1.1 high, dark, soot above.',
    'Top: the setting of green bricks (a brick ground at 2.7 m), the back half capped with a mud layer.',
    'Ramp: an earth wedge up the side to the top. Fuel: three layers of reed bundles, a heap of dung cakes; an ash heap at the mouths.',
    'Baked bricks: two stacks (baked-brick skin) — fuel-costly, kept for drains, pavements, the ziggurat\'s casing and the sluices.',
  ],
  envelope: { w: [8, 11], d: [8, 11] },
  build({ W, D }, { palette: P, rng }) {
    const red = scaleHex(P.wall, 1.12), soot = scaleHex(red, 0.62), t = 0.9, H = 3.0, out = [];
    const K = { x: 1.7, y: 2.6, w: W - 1.9, d: D - 2.8 };
    out.push(...rim('kiln', K.x, K.y, K.w, K.d, t, H, red, { skin: 'mud-plaster' }));
    const n = 2;
    for (let i = 0; i < n; i++) {
      const cx = K.x + K.w * (i + 1) / (n + 1);
      out.push({ kind: 'kiln-mouth', solid: 'vault', x: cx - 0.45, y: K.y - 0.5, w: 0.9, d: 1.5, z0: 0, z1: 1.1, axis: 'y', open: 'lo', tint: scaleHex(red, 0.85) });
      out.push(panel('soot', [[cx - 0.45, K.y - 0.02, 1.0], [cx + 0.45, K.y - 0.02, 1.0], [cx, K.y - 0.02, 2.5]], [0, -1, 0], soot));   // a plume of soot over the mouth
    }
    out.push(box('kiln-cap', K.x + t, K.y + K.d / 2, K.w - 2 * t, K.d / 2 - t, 2.65, 2.85, scaleHex(P.earth[3], 0.95)));
    out.push({ kind: 'ramp', solid: 'wedge', x: 0, y: K.y + 0.4, w: K.x - 0.05, d: K.d - 0.4, z0: 0, z1: H - 0.1, rise: 'y+', tint: scaleHex(P.ground, 0.9) });
    // fuel and ash at the front
    for (let l = 0; l < 3; l++) for (let k = 0; k < 4 - l; k++) { const x = 0.3 + k * 0.32 + l * 0.16; out.push(bundle([x, 0.2, 0.14 + l * 0.26], [x, 2.1, 0.14 + l * 0.26], P)); }
    out.push(dome(2.6, 1.0, 0.7, 0, 0.5, '#5b4a3a', { kind: 'dung-cakes', sides: 9 }));
    out.push(dome(K.x + K.w / 2, 0.9, 0.9, 0, 0.35, P.ash, { kind: 'ash-heap', sides: 10 }));
    // baked bricks stacked to the side
    for (let i = 0; i < 2; i++) out.push(box('baked-stack', W - 1.0 - i * 1.25, 0.2, 0.95, 1.9, 0, 0.9 + rng() * 0.3, P.paving, { skin: 'baked-brick' }));
    return { boxes: out, grounds: [{ kind: 'kiln-setting', x: K.x + t, y: K.y + t, w: K.w - 2 * t, d: K.d - 2 * t, z: 2.7, fill: scaleHex(P.earth[1], 0.92), surface: 'brick' }] };
  },
};

// ── the potters ──

/**
 * The potters' yard: a reed shade over the wheel (a heavy disc on a pivot stone, a pot left on it, the
 * potter's seat, a bowl of water), rows of fresh pots drying, the stacks of mould-made bevelled-rim
 * bowls the temple handed rations out in, two brick-rimmed settling tanks for the clay, and the
 * wasters heap of cracked and misfired pots. The kilns stand beside it as their own slots.
 */
export const pottersYard = {
  id: 'potters-yard', designed: true, patterns: ['potters', 'reed'],
  read: 'A reed shade over a potter\'s wheel, fresh pots drying in rows, stacks of bevelled-rim bowls, settling tanks, a wasters heap.',
  notes: [
    'Shade: a reed mat roof 2.4 m up on four posts. Wheel: a pivot stone, a clay disc r 0.45 on it, a pot on the disc; a low seat behind it.',
    'Drying pots: two rows of greenware jars (unfired, paler) along the front.',
    'Bevelled-rim bowls: stacks of inverted cones, four to a stack — the mass-made ration bowl of the Uruk period.',
    'Tanks: two brick rims 2 × 1.4 m, slurry in them; the wasters heap a low dome of sherd colour with broken pots on it.',
  ],
  envelope: { w: [12, 18], d: [9, 13] },
  build({ W, D }, { palette: P, rng }) {
    const out = [], green = P.greenware, terra = scaleHex(P.copper, 1.1);
    const sx = 0.6, sy = D - 6, sw = 6, sd = 4.6;
    for (const [px, py] of [[sx, sy], [sx + sw, sy], [sx, sy + sd], [sx + sw, sy + sd]]) out.push(box('shade-post', px - 0.08, py - 0.08, 0.16, 0.16, 0, py > sy + 1 ? 2.7 : 2.4, P.wood));
    out.push(plate('reed-mat', sx - 0.3, sy - 0.3, sw + 0.6, 0.06, sd + 0.6, 2.4, 2.75, P.reed));
    // the wheel under the shade
    const wx = sx + 2, wy = sy + 2.2;
    out.push(drum(wx, wy, 0.25, 0, 0.14, P.basalt, { kind: 'pivot-stone', sides: 8 }), drum(wx, wy, 0.46, 0.14, 0.26, scaleHex(P.copper, 0.95), { kind: 'potters-wheel', sides: 14 }));
    out.push(...jar(wx, wy, 0.75, green, 0.26), box('seat', wx - 0.25, wy + 0.65, 0.5, 0.4, 0, 0.3, P.wood), drum(wx + 0.75, wy + 0.2, 0.2, 0, 0.14, terra, { kind: 'water-bowl', sides: 9, taper: 1.3, open: true, lip: 0.03 }));
    // a second, slow wheel (tournette) and pots waiting by it
    out.push(drum(wx + 2.3, wy + 0.6, 0.3, 0, 0.1, P.basalt, { kind: 'pivot-stone', sides: 8 }), drum(wx + 2.3, wy + 0.6, 0.32, 0.1, 0.17, scaleHex(P.copper, 0.95), { kind: 'potters-wheel', sides: 12 }));
    // greenware drying along the front, in the sun
    for (let r = 0; r < 2; r++) for (let x = 0.8 + r * 0.3; x < W * 0.55; x += 0.75) out.push(...jar(x, 0.6 + r * 0.8, 0.8 + rng() * 0.3, scaleHex(green, 0.97 + rng() * 0.06)));
    // bevelled-rim bowls in stacks (an upturned bowl is a cone: wide at its foot when inverted)
    for (let i = 0; i < 6; i++) {
      const bx = W * 0.6 + (i % 3) * 0.7, by = 0.6 + Math.floor(i / 3) * 0.7, n = 3 + Math.floor(rng() * 3);
      out.push(drum(bx, by, 0.1, 0, 0.05 + n * 0.06, scaleHex(P.copper, 1.12 + rng() * 0.05), { kind: 'bowl-stack', sides: 9, taper: 1.0 + 0.6 / n, open: true, lip: 0.02 }));   // nested, the stack flares only by its top bowl
    }
    // settling tanks
    const tx = sx + sw + 1.2, grounds = [];
    for (let k = 0; k < 2; k++) {
      const ty = sy + 0.3 + k * 2.1;
      out.push(...rim('tank-rim', tx, ty, 2, 1.4, 0.18, 0.45, scaleHex(P.paving, 0.95), { skin: 'baked-brick' }));
      grounds.push({ kind: 'slurry', x: tx + 0.18, y: ty + 0.18, w: 1.64, d: 1.04, z: 0.35, fill: scaleHex(P.clay, k ? 1.05 : 0.95) });
    }
    // the wasters heap in the back corner
    const hx = W - 1.6, hy = D - 1.6;
    out.push(dome(hx, hy, 1.4, 0, 0.9, P.sherd, { kind: 'wasters', sides: 11 }));
    for (let k = 0; k < 5; k++) { const a = rng() * 6.283, r = 0.5 + rng() * 0.6; out.push(drum(hx + Math.cos(a) * r, hy + Math.sin(a) * r, 0.16, 0.9 * (1 - r / 1.4) * 0.8, 0.9 * (1 - r / 1.4) * 0.8 + 0.18, scaleHex(P.sherd, 0.9 + rng() * 0.15), { kind: 'sherd', sides: 7, taper: 1.3, open: true, lip: 0.02 })); }
    return { boxes: out, grounds: [...grounds, { kind: 'yard', x: 0, y: 0, w: W, d: D, z: 0.025, fill: P.lane, surface: 'mud' }] };
  },
};

// ── the metal: casting and smithing imported copper ──

/**
 * The coppersmiths' yard — Sumer's forge: a walled yard before a store room, two bowl hearths in a
 * reed windbreak, a crucible standing in each, the reed blowpipes with their clay tips laid round them;
 * stone moulds (an axe cast in one, a bivalve mould tied shut), an anvil stone with hammerstones, a
 * charcoal heap and baskets, the bun ingots from the boats on a mat, finished blades laid out on another,
 * a quench jar and the slag heap by the wall.
 */
export const copperWorkshop = {
  id: 'copper-workshop', designed: true, patterns: ['metal-casting', 'courtyard-house', 'sun-dried-earth'],
  read: 'A coppersmiths\' yard: bowl hearths with crucibles and blowpipes, stone moulds, an anvil stone, charcoal, ingots and finished blades.',
  notes: [
    'Yard: mud walls 0.5 thick, 2.2 high, the gate a 2 m gap in the front; a store room 3.5 m deep across the back, flat-roofed, a door and window.',
    'Hearths: open clay bowls r 0.5, 0.28 high, charcoal glowing in them, a crucible (open drum r 0.12) standing in each, molten metal in it; a reed screen 1.3 m high behind.',
    'Blowpipes: four reeds 1.1 m to a hearth, lying on the ground pointed in, each with a clay tip at the hearth end.',
    'Moulds: stone slabs with the shape cut in them (dark), one with an axe cast in it, a bivalve pair tied shut. Anvil: a basalt block, three hammerstones.',
    'Copper: plano-convex bun ingots on a mat; finished hoe and axe blades, sickles and chisels on another; a quench jar; charcoal heap; slag heap by the wall.',
    'Smelting is done at the mines (Magan, Anatolia, Iran); this yard melts, casts and hammers. The smiths are placed by their own builder.',
  ],
  envelope: { w: [13, 17], d: [11, 14] },
  build({ W, D }, { palette: P, rng }) {
    const mud = P.earth[2], band = scaleHex(mud, 0.93), dark = scaleHex(mud, 0.4), t = 0.5, hw = 2.2, rd = 3.5, h1 = 3.0, gw = 2, out = [];
    out.push(box('house', 0, D - rd, W, rd, 0, h1, mud), box('house-roof', -0.1, D - rd - 0.1, W + 0.2, rd + 0.2, h1, h1 + 0.3, band), box('house-parapet', -0.1, D - 0.3, W + 0.2, 0.3, h1 + 0.3, h1 + 0.8, band));
    out.push(box('door', W * 0.3, D - rd - 0.06, 1, 0.08, 0, 2.1, dark), box('window', W * 0.62, D - rd - 0.06, 0.6, 0.08, 1.6, 2.3, dark));
    out.push(box('court-wall', 0, 0, (W - gw) / 2, t, 0, hw, mud), box('court-wall', (W + gw) / 2, 0, (W - gw) / 2, t, 0, hw, mud));
    out.push(box('court-wall', 0, t, t, D - rd - t, 0, hw, mud), box('court-wall', W - t, t, t, D - rd - t, 0, hw, mud));
    for (const o of [-1, 1]) out.push(box('door-frame', W / 2 + o * (gw / 2 + 0.15) - 0.15, -0.15, 0.3, t + 0.3, 0, 2.6, band));
    const cy0 = t, cd = D - rd - t;   // the yard's depth
    // the hearths on the west side, in their windbreak
    const hearths = [[2.0, cy0 + cd * 0.62], [3.6, cy0 + cd * 0.36]];
    out.push(box('reed-screen', 0.9, cy0 + cd * 0.82, 3.6, 0.1, 0, 1.3, P.reed), box('reed-screen', 0.9, cy0 + cd * 0.15, 0.1, cd * 0.67, 0, 1.3, P.reed));
    for (const [hx, hy] of hearths) {
      out.push(drum(hx, hy, 0.5, 0, 0.28, scaleHex(P.earth[3], 0.72), { kind: 'hearth', sides: 12, open: true, lip: 0.08 }));   // clay, blackened by the fire
      out.push(...fire(hx, hy, 0.42, 0.22, P));
      out.push(drum(hx, hy, 0.12, 0.2, 0.36, P.crucible, { kind: 'crucible', sides: 8, taper: 1.15, open: true, lip: 0.025 }), drum(hx, hy, 0.09, 0.3, 0.33, P.molten, { kind: 'molten', sides: 8 }));
      for (let k = 0; k < 4; k++) {
        const a = 0.4 + k * 0.75 + rng() * 0.2, c = Math.cos(a), s = Math.sin(a), r0 = 0.62;
        out.push(beam('blowpipe-tip', [hx + c * r0, hy + s * r0, 0.04], [hx + c * (r0 + 0.12), hy + s * (r0 + 0.12), 0.04], 0.05, P.clay), beam('blowpipe', [hx + c * (r0 + 0.12), hy + s * (r0 + 0.12), 0.04], [hx + c * (r0 + 1.1), hy + s * (r0 + 1.1), 0.04], 0.035, P.reed));
      }
    }
    // moulds, anvil and the casting floor in the middle of the yard
    const mx = W * 0.45, my = cy0 + cd * 0.55;
    for (let k = 0; k < 3; k++) {
      const x = mx + k * 0.75, y = my;
      out.push(box('mould', x, y, 0.55, 0.32, 0, 0.1, P.stone), box('mould-matrix', x + 0.12, y + 0.08, 0.3, 0.14, 0.1, 0.105, '#2e2925'));
      if (k === 0) out.push(box('cast-axe', x + 0.13, y + 0.09, 0.28, 0.12, 0.104, 0.12, P.metal));
    }
    out.push(box('mould', mx + 2.4, my + 0.02, 0.5, 0.3, 0, 0.1, P.stone), box('mould', mx + 2.4, my + 0.02, 0.5, 0.3, 0.1, 0.2, scaleHex(P.stone, 1.06)), box('mould-tie', mx + 2.62, my - 0.01, 0.05, 0.36, 0, 0.22, P.reed));
    const ax = mx + 0.6, ay = my - 1.6;
    out.push(box('anvil-stone', ax, ay, 0.55, 0.42, 0, 0.38, P.basalt));
    for (let k = 0; k < 3; k++) out.push(dome(ax + 0.85 + k * 0.25, ay + 0.15 + (k % 2) * 0.2, 0.09, 0, 0.11, scaleHex(P.basalt, 1.15 + k * 0.05), { kind: 'hammerstone', sides: 7 }));
    out.push(...jar(ax - 0.6, ay + 0.2, 1.1, scaleHex(P.copper, 1.1)));   // the quench jar
    // charcoal, ingots and finished work along the east wall
    const ex = W - t - 1.6;
    out.push(dome(ex + 0.4, cy0 + cd * 0.78, 1.0, 0, 0.65, P.charcoal, { kind: 'charcoal-heap', sides: 10 }), basket(ex - 0.6, cy0 + cd * 0.85, 0.28, 0.34, P), drum(ex - 0.6, cy0 + cd * 0.85, 0.24, 0.3, 0.36, P.charcoal, { kind: 'charcoal', sides: 8 }));
    const mat1 = { x: ex - 0.4, y: cy0 + cd * 0.38, w: 1.6, d: 1.0 }, mat2 = { x: ex - 0.4, y: cy0 + cd * 0.12, w: 1.6, d: 1.0 };
    out.push(box('reed-floor-mat', mat1.x, mat1.y, mat1.w, mat1.d, 0.01, 0.03, scaleHex(P.reed, 0.9)), box('reed-floor-mat', mat2.x, mat2.y, mat2.w, mat2.d, 0.01, 0.03, scaleHex(P.reed, 0.9)));
    for (let k = 0; k < 6; k++) out.push(dome(mat1.x + 0.3 + (k % 3) * 0.5, mat1.y + 0.3 + Math.floor(k / 3) * 0.42, 0.15, 0.03, 0.1, scaleHex(P.metal, 0.9 + rng() * 0.1), { kind: 'ingot', sides: 8 }));
    for (let k = 0; k < 4; k++) out.push(box('hoe-blade', mat2.x + 0.15 + k * 0.36, mat2.y + 0.12, 0.22, 0.28, 0.03, 0.05, P.metal));
    for (let k = 0; k < 2; k++) out.push(...sickle([mat2.x + 0.5 + k * 0.55, mat2.y + 0.9, 0.04], 1, P.metal, true));
    for (let k = 0; k < 3; k++) out.push(box('chisel', mat2.x + 1.25, mat2.y + 0.5 + k * 0.12, 0.25, 0.04, 0.03, 0.06, P.metal));
    out.push(dome(W - t - 0.9, cy0 + 0.9, 0.75, 0, 0.45, P.slag, { kind: 'slag-heap', sides: 9 }));
    return { boxes: out, grounds: [{ kind: 'court', x: t, y: cy0, w: W - 2 * t, d: cd, z: 0.03, fill: scaleHex(P.lane, 0.9), surface: 'mud' }] };
  },
};

/**
 * Where the charcoal is made: a clamp of palm and tamarisk wood stacked and covered in earth, burning
 * slow, vents at its crown; an opened clamp raked out beside it in a black heap (`slot.opened`).
 */
export const charcoalClamp = {
  id: 'charcoal-clamp', designed: true, patterns: ['charcoal-burning'],
  read: 'A charcoal clamp: wood stacked and earthed over to burn slow, vents smoking at its crown; or one raked open, black.',
  notes: [
    'Clamp: a dome of earth r ≈ 2 m, 1.4 high, darker where the fire shows through; three dark vents and a glowing one.',
    'Opened (`slot.opened`): a low black heap in a ring of raked-back earth, a rake leaning on it.',
    'Beside it a stack of split wood for the next clamp.',
  ],
  envelope: { w: [4, 6], d: [4, 6] },
  build({ W, D, slot }, { palette: P }) {
    const r = Math.min(W, D) / 2 - 0.4, cx = W / 2 - 0.3, cy = D / 2, out = [];
    if (slot.opened) {
      out.push(drum(cx, cy, r + 0.2, 0, 0.18, scaleHex(P.ground, 0.75), { kind: 'raked-earth', sides: 12, open: true, lip: 0.4 }), dome(cx, cy, r * 0.8, 0, 0.5, P.charcoal, { kind: 'charcoal-heap', sides: 11 }));
      out.push(beam('rake', [cx + r * 0.6, cy - 0.3, 0.3], [cx + r + 0.6, cy - 0.1, 1.2], 0.04, P.wood), beam('rake', [cx + r * 0.6, cy - 0.6, 0.3], [cx + r * 0.6, cy, 0.3], 0.05, P.wood));
    } else {
      out.push(dome(cx, cy, r, 0, 1.4, scaleHex(P.earth[3], 0.82), { kind: 'clamp', sides: 12 }));
      for (const [a, z] of [[0.3, 1.25], [2.4, 1.2], [4.3, 1.22]]) out.push(drum(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3, 0.1, z, z + 0.08, '#2b2622', { kind: 'vent', sides: 6 }));
      out.push(drum(cx, cy, 0.1, 1.38, 1.44, P.ember, { kind: 'ember', sides: 6 }));
    }
    for (let l = 0; l < 3; l++) for (let k = 0; k < 3 - l; k++) { const x = W - 0.15 - k * 0.22 - l * 0.11, z = 0.1 + l * 0.19; out.push(beam('split-wood', [x, cy - 0.9, z], [x, cy + 0.9, z], 0.2, scaleHex(P.wood, 0.95 + k * 0.05))); }
    return out;
  },
};

// ── the wood ──

/**
 * The wheelwright's yard: imported logs on skids, sawn planks stacked; a solid wheel being made —
 * three planks laid edge to edge and doweled, the round cut, battens across — and two finished
 * wheels standing; a cart body on blocks waiting for them; under a shade, the bench with the copper
 * adze, saw, chisels and the bow drill.
 */
export const wheelwright = {
  id: 'wheelwright', designed: true, patterns: ['joinery', 'cart'],
  read: 'A wheelwright\'s yard: logs and planks, a three-plank wheel being made, finished wheels standing, a cart body on blocks, the bench with adze, saw and bow drill.',
  notes: [
    'Logs: three beams 0.45 thick, 4–5 m, dark imported timber on two skids; planks: five 2.6 × 0.35 × 0.06 stacked on skids.',
    'Wheel in the making: three planks laid flat on blocks, the disc r 0.5 marked out on them (a thin disc over the planks), battens across.',
    'Finished wheels: two discs standing on edge against the bench, darker tyres. Cart body: a box on four blocks, its pole to the ground.',
    'Bench: 2.6 × 0.6, 0.8 high, under a reed shade; adze, saw, chisels, a bow drill (bow + spindle) on it. Wood chips on the ground.',
  ],
  envelope: { w: [12, 16], d: [9, 12] },
  build({ W, D }, { palette: P, rng }) {
    const wood = P.wood, timber = P.timber, out = [];
    // the shade and bench at the back
    const sx = W - 6.2, sy = D - 3.6, sw = 5.6, sd = 3.0;
    for (const [px, py] of [[sx, sy], [sx + sw, sy], [sx, sy + sd], [sx + sw, sy + sd]]) out.push(box('shade-post', px - 0.08, py - 0.08, 0.16, 0.16, 0, py > sy + 1 ? 2.6 : 2.3, wood));
    out.push(plate('reed-mat', sx - 0.3, sy - 0.3, sw + 0.6, 0.06, sd + 0.6, 2.3, 2.65, P.reed));
    const bx = sx + 1.2, by = sy + 1.4;
    out.push(box('bench', bx, by, 2.6, 0.6, 0.6, 0.8, wood), box('bench-leg', bx + 0.1, by + 0.1, 0.16, 0.4, 0, 0.6, wood), box('bench-leg', bx + 2.34, by + 0.1, 0.16, 0.4, 0, 0.6, wood));
    out.push(beam('adze', [bx + 0.3, by + 0.2, 0.84], [bx + 0.75, by + 0.28, 0.84], 0.04, wood), box('adze-blade', bx + 0.22, by + 0.14, 0.1, 0.16, 0.8, 0.84, P.metal));
    out.push(box('saw', bx + 1.0, by + 0.1, 0.55, 0.12, 0.8, 0.82, P.metal), beam('saw-grip', [bx + 1.55, by + 0.16, 0.83], [bx + 1.7, by + 0.16, 0.83], 0.04, wood));
    for (let k = 0; k < 3; k++) out.push(box('chisel', bx + 1.9, by + 0.12 + k * 0.12, 0.22, 0.03, 0.8, 0.83, P.metal));
    out.push(beam('bow-drill', [bx + 0.6, by + 0.45, 0.82], [bx + 1.4, by + 0.45, 0.82], 0.03, wood), beam('bow-drill', [bx + 0.95, by + 0.42, 0.8], [bx + 0.95, by + 0.42, 1.1], 0.03, wood));
    // two finished wheels on edge by the bench
    for (const k of [0, 1]) { const x = bx - 0.5 - k * 0.3, y = by + 0.3; out.push(wheel(x, y, 0.5, 0.5, 0.12, wood), wheel(x + 0.01, y, 0.5, 0.52, 0.08, scaleHex(wood, 0.62), { kind: 'wheel-tyre', band: 0.05 })); }
    // logs on skids, planks stacked, on the west
    for (const y of [1.0, 4.2]) out.push(box('skid', 0.3, y, 1.9 + 0.4, 0.2, 0, 0.18, scaleHex(wood, 0.9)));
    for (let k = 0; k < 3; k++) { const x = 0.55 + k * 0.6; out.push(beam('log', [x, 0.4, 0.4], [x, 4.6 + rng() * 0.4, 0.4], 0.45, scaleHex(timber, 0.95 + k * 0.05))); }
    for (let k = 0; k < 5; k++) out.push(box('plank', 3.0, 0.8 + (k % 2) * 0.05, 0.35, 2.6, 0.18 + k * 0.065, 0.24 + k * 0.065, scaleHex(timber, 1.1 + k * 0.03)));
    for (const y of [1.0, 2.9]) out.push(box('skid', 2.8, y, 0.75, 0.18, 0, 0.18, scaleHex(wood, 0.9)));
    // the wheel being made: three planks on blocks, the round marked out, battens across
    const wx = 5.2, wy = 2.2;
    for (const o of [-0.4, 0.4]) out.push(box('block', wx + o - 0.12, wy - 0.4, 0.24, 0.8, 0, 0.16, scaleHex(wood, 0.85)));
    for (let k = 0; k < 3; k++) out.push(box('plank', wx - 0.55 + k * 0.37, wy - 0.55, 0.36, 1.1, 0.16, 0.24, scaleHex(timber, 1.12 + k * 0.03)));
    out.push(drum(wx, wy, 0.5, 0.24, 0.245, scaleHex(timber, 1.3), { kind: 'wheel-mark', sides: 16 }));
    for (const o of [-0.25, 0.25]) out.push(box('wheel-batten', wx - 0.45, wy + o - 0.04, 0.9, 0.08, 0.245, 0.29, scaleHex(wood, 0.8)));
    // a cart body on blocks, waiting for its wheels
    const cx = W * 0.55, cy = D * 0.5 - 1;
    for (const [x, y] of [[cx - 0.6, cy], [cx + 0.45, cy], [cx - 0.6, cy + 1.7], [cx + 0.45, cy + 1.7]]) out.push(box('block', x, y, 0.16, 0.2, 0, 0.45, scaleHex(wood, 0.85)));
    out.push(box('cart', cx - 0.65, cy - 0.05, 1.3, 1.95, 0.45, 0.57, wood), box('cart-side', cx - 0.65, cy - 0.05, 0.07, 1.95, 0.57, 1.05, scaleHex(P.reed, 0.9)), box('cart-side', cx + 0.58, cy - 0.05, 0.07, 1.95, 0.57, 1.05, scaleHex(P.reed, 0.9)));
    out.push(beam('cart-pole', [cx, cy + 0.05, 0.5], [cx, cy - 2.6, 0.06], 0.1, wood));
    return { boxes: out, grounds: [{ kind: 'yard', x: 0, y: 0, w: W, d: D, z: 0.025, fill: P.lane, surface: 'mud' }, { kind: 'chips', x: 3.8, y: 0.8, w: 3.4, d: 3.0, z: 0.03, fill: P.chips, surface: 'stubble' }] };
  },
};

// ── what came down the river ──

/**
 * The landing where the boats unload what the plain lacks: a baked-brick quay face down to the water,
 * mooring posts; on the quay squared limestone, basalt grinding stones (saddle querns with their
 * rubbers), a heap of flint nodules, a knapper's seat among the waste flakes with sickle blades laid
 * out, a block on a timber sledge ready to drag off, and jars sealed for the temple's store.
 */
export const stoneLanding = {
  id: 'stone-landing', designed: true, patterns: ['stone-landing', 'boat', 'fired-brick'],
  read: 'A quay where stone comes in by boat: squared limestone, basalt querns, flint nodules and a knapping floor, a block on a sledge, sealed jars.',
  notes: [
    'Quay: a baked-brick face along the front from the water (−1 m) to 0.15 m, two mooring posts. Front (−y) toward the water.',
    'Limestone: roughly squared blocks 0.8–1.4 m; basalt: four saddle querns (a long low block with its rubber on it) in a row.',
    'Flint: a heap of nodules (small domes); a knapping floor — a stone seat, an anvil stone, waste flakes (a rubble ground), sickle teeth on a mat.',
    'A limestone block on a timber sledge (a board, front curled) with its hauling rope laid forward; jars with clay sealings.',
  ],
  envelope: { w: [14, 20], d: [7, 10] },
  build({ W, D, slot }, { palette: P, rng }) {
    const wz = slot.waterZ ?? -1, out = [];
    out.push(box('revetment', 0, -0.4, W, 0.8, wz - 0.3, 0.15, P.paving));
    for (const x of [1.2, W - 1.4]) out.push(drum(x, 0.25, 0.12, 0.15, 1.1, P.wood, { kind: 'mooring-post', sides: 7 }));
    // limestone blocks
    let x = 1.0;
    for (let k = 0; k < 4; k++) { const s = 0.8 + rng() * 0.6; out.push(box('limestone', x, 1.2 + rng() * 0.4, s, s * (0.7 + rng() * 0.3), 0, s * (0.55 + rng() * 0.2), scaleHex(P.limestone, 0.94 + rng() * 0.1))); x += s + 0.35; }
    // basalt querns in a row behind them
    for (let k = 0; k < 4; k++) { const qx = 1.0 + k * 1.15, qy = D - 2.2; out.push(box('quern', qx, qy, 0.45, 0.9, 0, 0.24, P.basalt), box('quern-rubber', qx + 0.06, qy + 0.3, 0.33, 0.2, 0.24, 0.34, scaleHex(P.basalt, 1.15))); }
    // flint: nodules heaped, the knapping floor
    const fx = W * 0.55, fy = D * 0.55;
    for (let k = 0; k < 9; k++) out.push(dome(fx + (rng() - 0.5) * 1.2, fy + (rng() - 0.5) * 1.0, 0.13 + rng() * 0.06, 0, 0.16, scaleHex(P.flint, 0.85 + rng() * 0.25), { kind: 'flint-nodule', sides: 7 }));
    const kx = fx + 2.0, ky = fy - 0.2;
    out.push(box('seat-stone', kx, ky, 0.45, 0.4, 0, 0.35, P.limestone), box('anvil-stone', kx + 0.7, ky - 0.4, 0.3, 0.3, 0, 0.18, P.basalt));
    out.push(box('reed-floor-mat', kx + 0.1, ky + 0.7, 0.9, 0.5, 0.01, 0.03, scaleHex(P.reed, 0.9)));
    for (let k = 0; k < 8; k++) out.push(box('sickle-tooth', kx + 0.18 + (k % 4) * 0.2, ky + 0.8 + Math.floor(k / 4) * 0.2, 0.1, 0.04, 0.03, 0.045, P.flint));
    // a block on a sledge, its rope laid out forward
    const sx = W - 3.2, sy = 2.0;
    out.push(box('sledge', sx, sy, 1.2, 2.0, 0, 0.14, P.wood), { kind: 'sledge', solid: 'wedge', x: sx, y: sy - 0.4, w: 1.2, d: 0.42, z0: 0, z1: 0.38, rise: 'y-', tint: P.wood });
    out.push(box('limestone', sx + 0.1, sy + 0.3, 1.0, 1.3, 0.14, 0.95, P.limestone), beam('rope', [sx + 0.6, sy - 0.3, 0.3], [sx + 0.9, 0.5, 0.03], 0.04, scaleHex(P.reed, 0.7)));
    // sealed jars for the store
    for (let k = 0; k < 3; k++) { const jx = W - 1.0 - k * 0.7, jy = D - 0.8; out.push(...jar(jx, jy, 1.2, scaleHex(P.copper, 1.08)), drum(jx, jy, 0.13, 0.66, 0.74, scaleHex(P.earth[3], 0.7), { kind: 'clay-sealing', sides: 8 })); }
    return { boxes: out, grounds: [{ kind: 'quay', x: 0, y: 0, w: W, d: D, z: 0.03, fill: P.paving, surface: 'brick' }, { kind: 'flakes', x: kx - 0.6, y: ky - 0.7, w: 2.0, d: 1.9, z: 0.04, fill: P.flint, surface: 'rubble' }] };
  },
};

/**
 * The bitumen boilers: bitumen came in lumps from the seeps upriver (Hit) and was cooked with sand
 * and chopped straw into a mastic for mortar, caulking and waterproofing — a great pot on a fire on
 * three stones, the raw lumps heaped, the temper heaps, baskets and jars coated black, reed bundles
 * waiting to be dipped for a boat's hull.
 */
export const bitumenWorks = {
  id: 'bitumen-works', designed: true, patterns: ['bitumen-works'],
  read: 'A great pot of bitumen on a fire, the raw lumps heaped, sand and straw for temper, baskets and jars coated black.',
  notes: [
    'Hearth: three stones round a charcoal fire, a big jar on them, bitumen glossy black in its mouth.',
    'Raw bitumen: a heap of black lumps (domes); temper: a dome of sand and one of chopped straw.',
    'Coated: three baskets and two jars black to their shoulders; reed bundles for a boat\'s hull waiting.',
  ],
  envelope: { w: [7, 10], d: [5, 8] },
  build({ W, D }, { palette: P, rng }) {
    const out = [], hx = W * 0.35, hy = D * 0.5;
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.3; out.push(box('hearth-stone', hx + Math.cos(a) * 0.45 - 0.14, hy + Math.sin(a) * 0.45 - 0.12, 0.28, 0.24, 0, 0.3, P.basalt)); }
    out.push(...fire(hx, hy, 0.4, 0.12, P));
    out.push(drum(hx, hy, 0.38, 0.3, 0.62, scaleHex(P.copper, 0.8), { kind: 'cauldron', sides: 11, taper: 1.25 }), drum(hx, hy, 0.48, 0.62, 0.92, scaleHex(P.copper, 0.8), { kind: 'cauldron', sides: 11, taper: 0.82, open: true, lip: 0.05 }), drum(hx, hy, 0.36, 0.84, 0.86, P.bitumen, { kind: 'bitumen', sides: 11 }));
    for (let k = 0; k < 7; k++) out.push(dome(W - 1.5 + (rng() - 0.5) * 1.4, D - 1.4 + (rng() - 0.5) * 1.2, 0.2 + rng() * 0.15, 0, 0.18 + rng() * 0.12, scaleHex(P.bitumen, 0.9 + rng() * 0.3), { kind: 'bitumen-lump', sides: 7 }));
    out.push(dome(1.0, D - 1.0, 0.7, 0, 0.45, scaleHex(P.ground, 1.18), { kind: 'sand', sides: 9 }), dome(2.5, D - 0.8, 0.55, 0, 0.4, P.straw, { kind: 'straw-heap', sides: 9 }));
    for (let k = 0; k < 3; k++) { const bx = W * 0.6 + k * 0.7, by = 0.7; out.push(basket(bx, by, 0.28, 0.34, P), drum(bx, by, 0.29, 0, 0.22, P.bitumen, { kind: 'bitumen-coat', sides: 9, taper: 1.12 })); }
    for (let k = 0; k < 2; k++) { const jx = 0.8 + k * 0.8, jy = 0.8; out.push(...jar(jx, jy, 1.1, scaleHex(P.copper, 1.1)), drum(jx, jy, 0.27, 0, 0.3, P.bitumen, { kind: 'bitumen-coat', sides: 10, taper: 1.3 })); }
    for (let k = 0; k < 3; k++) out.push(bundle([W - 0.4 - k * 0.32, 0.3, 0.14], [W - 0.4 - k * 0.32, 2.8, 0.14], P));
    return { boxes: out, grounds: [{ kind: 'yard', x: 0, y: 0, w: W, d: D, z: 0.025, fill: scaleHex(P.lane, 0.86), surface: 'mud' }] };
  },
};

// ── the reed ──

/**
 * The reed cutters' ground at the marsh edge: cut reed bound in bundles and stacked, bundles stood up
 * in tall stooks to dry, a mat half plaited on the ground, a finished mat rolled, coils of reed rope,
 * the cutters' sickle — the reed that became the byres, the boats, the mats under every roof.
 */
export const reedStore = {
  id: 'reed-store', designed: true, patterns: ['reed', 'reed-working'],
  read: 'Cut reed in bundles: stacked, stood up to dry in tall stooks; a mat half plaited on the ground, rolled mats, rope coils.',
  notes: [
    'Stacks: bundles 0.3 thick, 3 m long, in two pyramids of three layers. Stooks: eight bundles leaning to meet at 2.8 m.',
    'Mat: a pale reed box 2 × 3 m, 0.03 thick, half its length done (a darker run); two rolled mats (short thick beams).',
    'Rope: three low coils (open drums); a sickle by the mat. The cutters and the weavers are placed by their own builders.',
  ],
  envelope: { w: [8, 14], d: [5, 8] },
  build({ W, D }, { palette: P, rng }) {
    const out = [];
    for (const [x0, y0] of [[0.4, 0.4], [0.4, 2.0]]) for (let l = 0; l < 3; l++) for (let k = 0; k < 4 - l; k++) { const y = y0 + 0.16 * l + k * 0.32; out.push(bundle([x0, y, 0.15 + l * 0.27], [x0 + 3.0, y, 0.15 + l * 0.27], P)); }
    for (const [cx, cy] of [[W - 1.5, D - 1.6], [W - 3.6, D - 1.4]]) {
      const a0 = rng() * 6.283;
      for (let i = 0; i < 8; i++) { const a = a0 + (i / 8) * 6.283; out.push(bundle([cx + Math.cos(a) * 0.75, cy + Math.sin(a) * 0.75, 0.05], [cx + Math.cos(a) * 0.1, cy + Math.sin(a) * 0.1, 2.8], P, 0.22)); }
    }
    const mx = 4.0, my = 0.5;
    out.push(box('reed-mat', mx, my, 2.0, 3.0, 0.01, 0.04, scaleHex(P.reed, 1.08)), box('reed-mat', mx, my, 2.0, 1.5, 0.04, 0.05, scaleHex(P.reed, 0.86)));
    for (let k = 0; k < 2; k++) out.push(beam('mat-roll', [mx + 2.5, my + 0.4 + k * 0.5, 0.18], [mx + 4.2, my + 0.4 + k * 0.5, 0.18], 0.36, scaleHex(P.reed, 0.95)));
    for (let k = 0; k < 3; k++) out.push(drum(mx + 2.8 + k * 0.55, my + 1.8, 0.22, 0, 0.12, scaleHex(P.reed, 0.72), { kind: 'rope-coil', sides: 9, open: true, lip: 0.08 }));
    out.push(...sickle([mx + 1.0, my + 3.4, 0.03], 1, P.metal, true));
    return out;
  },
};

export const SUMER_WORKS_ASSETS = Object.fromEntries([clayPit, clayMixing, brickField, brickHacks, brickKiln, pottersYard, copperWorkshop, charcoalClamp, wheelwright, stoneLanding, bitumenWorks, reedStore].map((a) => [a.id, a]));
