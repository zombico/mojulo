/**
 * historic/assets/pompeii-land — the kit of Pompeii's farm (79 CE): a villa rustica of the Vesuvian slope after Villa
 * Regina and the Villa della Pisanella at Boscoreale, from ../record/pompeii-land.js. PLACEHOLDERS: massing to the
 * record's numbers where it gives them and conjecture (said so in `notes`) where it does not; every piece is
 * `designed: false` until its reference sheet is drawn and checked. Same contract as the other kits (./kit.js):
 * local frame in metres, front −y, `ctx` = { palette, culture, rng }.
 *
 * People and beasts are placed by their own builders (../crews.js): the cart is left with its pole down to the yoke
 * on the ground, so its team is hitched there.
 */
import { beam } from './kit.js';
import { gableRoof } from './lindos.js';
import { box, drum, wheel, basket } from './sumer-farm.js';
import { scaleHex } from '../../polygonizer/vexar.js';

/** A tiled lean-to roof over a rect, high at the back (+y) and low at the front, on its own eaves. */
const leanTo = (r, zFront, zBack, P, kind = 'roof') => {
  const out = [], n = 4, t = P.tile;
  for (let i = 0; i < n; i++) {
    const y0 = r.y + (r.d * i) / n, y1 = r.y + (r.d * (i + 1)) / n, z0 = zFront + ((zBack - zFront) * i) / n, z1 = zFront + ((zBack - zFront) * (i + 1)) / n;
    out.push(box(kind, r.x, y0, r.w, y1 - y0 + 0.02, Math.min(z0, z1), Math.max(z0, z1) + 0.12, scaleHex(t, 0.94 + 0.04 * (i % 2))));
  }
  return out;
};
const posts = (x0, x1, y, n, z0, h, r, tint) => Array.from({ length: n }, (_, i) => drum(x0 + ((x1 - x0) * i) / Math.max(1, n - 1), y, r, z0, z0 + h, tint, { kind: 'column', sides: 8 }));

/** The villa round its court: rooms on three sides behind an arcade, an upper floor at the back, the gate in front. */
export const villa = {
  id: 'pl-villa', designed: false, patterns: ['courtyard-house', 'tile-roof', 'colonnade'],
  read: 'A plain farmhouse round an open court: rooms on three sides behind a wide arcade, an upper floor along the back, a front wall with the gate; tiled roofs, plastered walls.',
  notes: ['Placeholder after Villa Regina (record: pl-villa-regina, pl-villa-court): about 450 m² of rooms; wings 6 m deep (conjecture), walls 4.2 m, the back wing two storeys (the plan has an upper floor).', 'The cella vinaria (pl-cella-vinaria) is its own slot in the court, under the back arcade.'],
  envelope: { w: [26, 34], d: [22, 28] },
  build({ W, D }, { palette: P }) {
    const out = [], g = [], wing = 6, h = 4.2, wall = P.plaster, socle = P.socle;
    // back (+y) wing, two storeys; side wings one; the front wall with its gate
    const back = { x: 0, y: D - wing, w: W, d: wing }, left = { x: 0, y: 1, w: wing, d: D - wing - 1 }, right = { x: W - wing, y: 1, w: wing, d: D - wing - 1 };
    out.push(box('house', back.x, back.y, back.w, back.d, 0, h * 1.7, wall), box('socle', back.x - 0.02, back.y - 0.02, back.w + 0.04, 0.05, 0, 0.9, socle));
    for (const r of [left, right]) out.push(box('house', r.x, r.y, r.w, r.d, 0, h, wall));
    out.push(...gableRoof(back, h * 1.7, 22, P, { axis: 'x', pediments: false }), ...gableRoof(left, h, 22, P, { axis: 'y', pediments: false }), ...gableRoof(right, h, 22, P, { axis: 'y', pediments: false }));
    const gx = W / 2 - 1.6;
    out.push(box('court-wall', 0, 0, gx, 1, 0, 3.2, wall), box('court-wall', gx + 3.2, 0, W - gx - 3.2, 1, 0, 3.2, wall));
    out.push(box('door', gx, 0.3, 3.2, 0.12, 0, 2.8, P.door));   // the gate, its leaves open inward: a dark opening
    // the arcade on the court side of the back wing: piers and a lean-to roof
    const ay = D - wing - 3;
    out.push(...posts(wing + 1, W - wing - 1, ay + 0.3, 7, 0, 3.2, 0.28, P.stucco), ...leanTo({ x: wing, y: ay, w: W - 2 * wing, d: 3 }, 3.3, 3.9, P));
    g.push({ kind: 'court', x: wing, y: 1, w: W - 2 * wing, d: D - wing - 1, z: 0.04, fill: P.court, surface: 'dry-earth' });
    return { boxes: out, grounds: g };
  },
};

/** The wine cellar in the open: dolia sunk to their shoulders in rows, each mouth lidded. */
export const cellaVinaria = {
  id: 'pl-cella-vinaria', designed: false, patterns: ['storehouse'],
  read: 'Rows of great storage jars sunk in the ground to the shoulder, only their round mouths and lids showing, on a beaten floor.',
  notes: ['Record: pl-cella-vinaria: 18 dolia, some 10,000 litres together (Villa Regina). Three rows of six; a mouth 0.62 m across, the shoulder 0.18 m proud (conjecture).'],
  envelope: { w: [8, 12], d: [4.5, 7] },
  build({ W, D }, { palette: P }) {
    const out = [], g = [{ kind: 'cellar-floor', x: 0, y: 0, w: W, d: D, z: 0.05, fill: scaleHex(P.court, 0.92), surface: 'dry-earth' }];
    const cols = 6, rows = 3, dx = W / cols, dy = D / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const cx = dx * (i + 0.5), cy = dy * (j + 0.5);
      out.push(drum(cx, cy, 0.55, 0, 0.18, P.dolium, { kind: 'dolium', sides: 10 }), drum(cx, cy, 0.34, 0.18, 0.24, scaleHex(P.dolium, 0.8), { kind: 'dolium-lid', sides: 8 }));
    }
    return { boxes: out, grounds: g };
  },
};

/** The treading room and the press room side by side, open at the front: the trodden grapes run to the press. */
export const pressRoom = {
  id: 'pl-press-room', designed: false, patterns: ['wine-press'],
  read: 'Two rooms open to the yard: in one a raised treading floor with a low kerb; in the next a lever press, a long beam from a socket in the back wall down over the press bed, a stone weight at its free end, and the must vat sunk in front.',
  notes: ['Record: pl-press-room, pl-lever-press (Villa Regina IX and IXbis; the Villa of the Mysteries\' beam). No page gave the beam or the bed: beam 7 m (conjecture), bed 2.4 m square, vat 1.2 m.', 'Roofed at the back only, so the press shows from above (a placeholder\'s choice).'],
  envelope: { w: [11, 15], d: [6, 8] },
  build({ W, D }, { palette: P }) {
    const out = [], h = 3.6, wall = P.plaster, wood = P.timber, split = W * 0.4;
    out.push(box('house', 0, D - 0.5, W, 0.5, 0, h, wall), box('house', 0, 0, 0.5, D, 0, h, wall), box('house', W - 0.5, 0, 0.5, D, 0, h, wall), box('house', split - 0.25, D * 0.35, 0.5, D * 0.65, 0, h, wall));
    out.push(...leanTo({ x: 0, y: D * 0.55, w: W, d: D * 0.45 }, h, h + 0.6, P));
    // the treading floor: raised, kerbed, its spout toward the press
    out.push(box('treading-floor', 0.8, 1, split - 1.6, D - 2.2, 0, 0.45, P.cocciopesto), box('treading-kerb', 0.8, 1, split - 1.6, 0.18, 0.45, 0.7, P.cocciopesto));
    // the press bed and its must vat; the beam from the back wall over the bed, the weight hanging at its end
    const bx = split + (W - split) / 2;
    out.push(box('press-bed', bx - 1.2, D - 3.6, 2.4, 2.4, 0, 0.35, P.cocciopesto), box('must-vat', bx - 0.6, D - 5.2, 1.2, 1.2, -0.6, 0.05, scaleHex(P.must, 0.9)));
    out.push(beam('press-beam', [bx, D - 0.6, 1.9], [bx - 0.4, 0.8, 1.15], 0.32, wood));
    out.push(box('press-weight', bx - 0.85, 0.3, 0.9, 0.9, 0, 0.75, P.lava), beam('press-rope', [bx - 0.4, 0.8, 1.15], [bx - 0.4, 0.75, 0.75], 0.05, P.reed));
    out.push(box('press-bag', bx - 0.9, D - 3.3, 1.8, 1.8, 0.35, 0.75, P.must));   // the pressed pulp under the beam
    return { boxes: out, grounds: [{ kind: 'floor', x: 0, y: 0, w: W, d: D, z: 0.04, fill: scaleHex(P.court, 0.95), surface: 'dry-earth' }] };
  },
};

/** The threshing terrace: a raised paved floor with a kerb, the grain heaped at its edge. */
export const threshingTerrace = {
  id: 'pl-threshing-terrace', designed: false, patterns: ['threshing-floor'],
  read: 'A square terrace a step above the yard, paved and kerbed, a heap of grain and one of chaff at its edge.',
  notes: ['Record: pl-threshing-terrace (Villa Regina XVII). Its area is on no page read: 10 m square here (conjecture).'],
  envelope: { w: [9, 12], d: [9, 12] },
  build({ W, D }, { palette: P }) {
    const out = [box('threshing-floor', 0, 0, W, D, 0, 0.35, P.cocciopesto)];
    for (const [x, y, w, d] of [[0, 0, W, 0.25], [0, D - 0.25, W, 0.25], [0, 0, 0.25, D], [W - 0.25, 0, 0.25, D]]) out.push(box('threshing-kerb', x, y, w, d, 0.35, 0.55, scaleHex(P.cocciopesto, 0.9)));
    out.push({ kind: 'grain-heap', solid: 'dome', sides: 8, x: W - 3.4, y: D - 3.4, w: 2.6, d: 2.6, z0: 0.35, z1: 1.2, tint: P.grain });
    out.push({ kind: 'chaff-heap', solid: 'dome', sides: 8, x: 0.8, y: D - 3.0, w: 2.2, d: 2.2, z0: 0.35, z1: 0.9, tint: P.chaff });
    return out;
  },
};

/** The barn with a pergola of vines along its front. */
export const barn = {
  id: 'pl-barn', designed: false, patterns: ['storehouse', 'pergola'],
  read: 'A tiled barn open to a pergola along its front: posts and cross-beams under a roof of vine leaves.',
  notes: ['Record: pl-villa-regina (VIII, a barn with a pergola). Sizes conjecture.'],
  envelope: { w: [8, 12], d: [6, 9] },
  build({ W, D }, { palette: P }) {
    const out = [], bd = D * 0.55, wall = P.plaster;
    out.push(box('house', 0, D - bd, W, bd, 0, 3.4, wall), ...gableRoof({ x: 0, y: D - bd, w: W, d: bd }, 3.4, 22, P, { axis: 'x', pediments: false }));
    out.push(...posts(0.3, W - 0.3, 0.4, 5, 0, 2.4, 0.09, P.timber));
    for (let i = 0; i < 5; i++) { const x = 0.3 + ((W - 0.6) * i) / 4; out.push(beam('pergola-beam', [x, 0.4, 2.4], [x, D - bd, 2.4], 0.1, P.timber)); }
    out.push(box('pergola-leaves', 0, 0.1, W, D - bd - 0.1, 2.45, 2.75, P.vine));
    return out;
  },
};

/** A block of vines on stakes, in rows, the grapes ripe. */
export const vineBlock = {
  id: 'pl-vine-block', designed: false, patterns: ['vineyard'],
  read: 'Rows of vines tied to stakes, head high, the leaves a dark band along each row and the ripe bunches under them; tilled earth between the rows.',
  notes: ['Record: pl-villa-vineyard, pl-town-vineyard, pl-vines-staked. Rows 2 m apart, a stake every 3 m drawn (the vines stood closer: a stake each), the band 0.9–1.7 m high (conjecture).'],
  envelope: { w: [12, 60], d: [10, 50] },
  build({ W, D }, { palette: P, rng }) {
    const out = [], g = [{ kind: 'field', x: 0, y: 0, w: W, d: D, z: 0.02, fill: P.tilled, surface: 'furrows' }];
    for (let y = 1; y < D - 0.5; y += 2) {
      out.push(box('vine-row', 0.5, y - 0.22, W - 1, 0.44, 0.85, 1.65, scaleHex(P.vine, 0.92 + rng() * 0.16)));
      out.push(box('vine-grapes', 0.7, y - 0.26, W - 1.4, 0.52, 0.8, 1.0, P.grapes));
      for (let x = 0.5; x < W - 0.3; x += 3) out.push(box('stake', x - 0.04, y - 0.04, 0.08, 0.08, 0, 1.8, P.timber));
    }
    return { boxes: out, grounds: g };
  },
};

/** The olive mill: a round lava basin, a pillar at its heart, two crushing wheels on a beam turned round it. */
export const trapetum = {
  id: 'pl-trapetum', designed: false, patterns: ['olive-press'],
  read: 'Under a lean-to, a round basin of grey lava, a pillar rising from its middle, and two half-round crushing wheels standing on edge in the basin, threaded on a wooden beam the men push round.',
  notes: ['Record: pl-trapetum (the Pisanella: two orbes of Vesuvian lava, traces of wooden hubs). Basin 1.8 m across, wheels 1.0 m (conjecture).'],
  envelope: { w: [6, 9], d: [5, 7] },
  build({ W, D }, { palette: P }) {
    const out = [], cx = W / 2, cy = D / 2, lava = P.lava;
    out.push(box('house', 0, D - 0.5, W, 0.5, 0, 3.2, P.plaster), ...leanTo({ x: 0, y: D * 0.5, w: W, d: D * 0.5 }, 3.0, 3.4, P));
    out.push(drum(cx, cy, 0.95, 0, 0.75, lava, { kind: 'mortarium', sides: 12 }), drum(cx, cy, 0.7, 0.7, 0.78, scaleHex(lava, 0.7), { kind: 'mortarium-bowl', sides: 12 }));
    out.push(drum(cx, cy, 0.14, 0.75, 1.25, lava, { kind: 'milliarium', sides: 6 }));
    for (const o of [-1, 1]) out.push(wheel(cx + o * 0.42, cy, 1.2, 0.5, 0.22, scaleHex(lava, 1.08), { kind: 'orbis' }));
    out.push(beam('trapetum-beam', [cx - 1.4, cy, 1.2], [cx + 1.4, cy, 1.2], 0.12, P.timber));
    return out;
  },
};

/** The farm cart (plaustrum), unhitched, loaded for the vintage: its pole down to the yoke on the ground. */
export const cart = {
  id: 'pl-cart', designed: false, patterns: ['cart'],
  read: 'A two-wheeled farm cart with a plank box, grape baskets heaped in it, its pole run forward down to the yoke on the ground.',
  notes: ['Record: pl-cart: wheels 1.32 m apart (Villa Regina\'s cart and its lane\'s ruts). Wheels r 0.6, box 1.2 × 2.2 (conjecture).', 'Unhitched: its pair and the carter are placed at the yoke by ../crews.js.'],
  envelope: { w: [2.2, 3], d: [6.5, 8] },
  build({ W, D }, { palette: P }) {
    const cx = W / 2, out = [], wood = P.timber, R = 0.6, ya = D - 2.0;
    out.push(beam('yoke', [cx - 0.75, 0.95, 0.06], [cx + 0.75, 0.95, 0.06], 0.1, wood));
    for (const o of [-1, 1]) out.push(wheel(cx + o * 0.66, ya, R, R, 0.14, wood));
    out.push(beam('axle', [cx - 0.66, ya, R], [cx + 0.66, ya, R], 0.1, scaleHex(wood, 0.7)));
    const by = ya - 1.2, z0 = R + 0.1;
    out.push(box('cart', cx - 0.6, by, 1.2, 2.2, z0, z0 + 0.1, wood));
    for (const [x, y, w, d] of [[cx - 0.6, by, 0.07, 2.2], [cx + 0.53, by, 0.07, 2.2], [cx - 0.6, by + 2.13, 1.2, 0.07]]) out.push(box('cart-side', x, y, w, d, z0 + 0.1, z0 + 0.55, wood));
    out.push(beam('cart-pole', [cx, by + 0.1, z0 + 0.05], [cx, 0.95, 0.16], 0.1, wood));
    for (let k = 0; k < 4; k++) out.push(basket(cx + (k % 2 ? 0.28 : -0.28), by + 0.5 + Math.floor(k / 2) * 0.9, 0.24, 0.32, P, z0 + 0.1));
    return out;
  },
};

/** A stable: a low tiled building open along one side, a trough inside. */
export const stable = {
  id: 'pl-stable', designed: false, patterns: ['stable'],
  read: 'A low stable, tiled, open along its front between posts, a long trough against the back wall.',
  notes: ['Record: pl-stable (Civita Giuliana: three equids, an iron harness with bronze studs). Sizes conjecture; the beasts are placed by ../crews.js.'],
  envelope: { w: [8, 12], d: [5, 7] },
  build({ W, D }, { palette: P }) {
    const out = [], h = 2.8, wall = P.plaster;
    out.push(box('house', 0, D - 0.4, W, 0.4, 0, h, wall), box('house', 0, 0, 0.4, D, 0, h, wall), box('house', W - 0.4, 0, 0.4, D, 0, h, wall));
    out.push(...posts(0.8, W - 0.8, 0.3, 4, 0, h, 0.12, P.timber), ...leanTo({ x: 0, y: 0, w: W, d: D }, h, h + 0.7, P));
    out.push(box('trough', 0.6, D - 1.1, W - 1.2, 0.6, 0, 0.7, P.tufa));
    return out;
  },
};

export const POMPEII_FARM_ASSETS = Object.fromEntries([villa, cellaVinaria, pressRoom, threshingTerrace, barn, vineBlock, trapetum, cart, stable].map((a) => [a.id, a]));
