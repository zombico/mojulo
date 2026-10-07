/**
 * historic/assets/sumer — the Sumer asset kit, each asset the read of a clay massing sheet the image
 * worker dreamed for it (brief ids in `sheet`). Local frame, metres, front −y (see ./kit.js).
 * `ctx` = { palette, culture, rng } — rng is the slot's own dressing stream.
 *
 * `designed: false` marks a PLACEHOLDER: the plain pattern massing that stands in a slot until its
 * sheet has been read into a designed asset. The city renders whole at every step of the loop.
 */
const pick = (xs, rng) => xs[Math.floor(rng() * xs.length)];
const lerp = ([a, b], t) => a + (b - a) * t;
const houseTint = (K, P, rng) => (rng() < K.house.whitewash ? pick(P.whitewash, rng) : pick(P.earth, rng));
import { merlons, ribs, flight, doorway, battered, slopedFlight } from './kit.js';
import { flatRoofCube, courtyardHouse, nichedWall } from '../patterns.js';
import { scaleHex } from '../../polygonizer/vexar.js';

const inset = (r, f) => ({ x: r.x + r.w * f, y: r.y + r.d * f, w: r.w * (1 - 2 * f), d: r.d * (1 - 2 * f) });

/**
 * The ziggurat: three battered tiers, each wrapped in deep buttress ribs under a crenellated rim; a
 * triple stair on the front (a long central flight square to the face, two side flights running
 * along it); a flat-roofed shrine on top under an overhanging slab.
 */
export const ziggurat = {
  id: 'ziggurat', sheet: 'ziggurat', designed: true, patterns: ['stepped-platform', 'niched-wall', 'sun-dried-earth', 'whitewash'],
  envelope: { w: [36, 70], d: [28, 50] },
  build({ W, D }, { palette: P }) {
    const H = Math.min(26, W * 0.44), hs = [0.42, 0.31, 0.27].map((f) => f * H);
    const body = P.platform, rim = scaleHex(P.platform, 0.92), ribT = scaleHex(P.platform, 0.97), stair = P.stair;
    const out = [];
    let r = { x: 0.7, y: 0.7, w: W - 1.4, d: D - 1.4 }, z = 0;   // the ribs stand proud of the body, inside the footprint
    const tops = [];
    for (let i = 0; i < 3; i++) {
      // each tier battered: its faces lean in as they rise, the ribs leaning with them
      const lean = hs[i] * 0.16, tier = battered(r, z, z + hs[i], body, lean, { kind: 'platform' });
      out.push(tier);
      out.push(...ribs(r, z, z + hs[i] * 0.9, ribT, { pitch: 2.1, width: 1, depth: 0.7, lean: lean * 0.9 }));
      out.push(...merlons(tier.top, z + hs[i], rim, { pitch: 1.7, size: 0.9, height: 0.6, depth: 0.7 }));
      z += hs[i];
      tops.push({ r: tier.top, z });
      r = inset(tier.top, i === 0 ? 0.08 : 0.1);
    }
    // triple stair: one long central flight square to the face, climbing to the second terrace between
    // sloped cheek walls, and two side flights running up along the face from the corners
    const cw = Math.max(3.5, W * 0.09), cx = W / 2, run = D * 0.5, h1 = tops[0].z, t2 = tops[1];
    out.push(...slopedFlight({ x: cx - cw / 2, y: -run, w: cw, d: run + t2.r.y }, 0, t2.z, stair, 'y+', { cheek: 0.7, cheekTint: rim }));
    const sw = cw * 0.8, sl = cx - cw / 2 - 0.7 - W * 0.06, fz = Math.min(h1, h1 * (run / (run + t2.r.y)));
    out.push(...slopedFlight({ x: W * 0.06, y: -sw, w: sl, d: sw }, 0, fz, stair, 'x+', { cheek: 0.5, cheekTint: rim }));
    out.push(...slopedFlight({ x: cx + cw / 2 + 0.7, y: -sw, w: sl, d: sw }, 0, fz, stair, 'x-', { cheek: 0.5, cheekTint: rim }));
    // the shrine on top, under an overhanging roof slab, its door toward the stair
    const top = tops[2], s = inset(top.r, 0.22), sh = Math.max(4.5, H * 0.24), wash = P.whitewash[0];
    out.push(battered(s, top.z, top.z + sh, wash, 0.35, { kind: 'shrine' }));
    out.push({ kind: 'shrine-roof', x: s.x - 0.6, y: s.y - 0.6, w: s.w + 1.2, d: s.d + 1.2, z0: top.z + sh, z1: top.z + sh + 0.7, tint: scaleHex(wash, 0.95) });
    out.push(...ribs(s, top.z, top.z + sh * 0.92, scaleHex(wash, 0.97), { pitch: 2, width: 0.7, depth: 0.35, faces: ['back', 'left', 'right'], lean: 0.3 }));
    out.push({ kind: 'door', x: s.x + s.w / 2 - 0.8, y: s.y - 0.08, w: 1.6, d: 0.4, z0: top.z, z1: top.z + 2.6, tint: scaleHex(body, 0.4) });   // proud of the leaning face
    return out;
  },
};

// ── placeholders (the first big-read massing), each replaced when its sheet is read ──

/**
 * The town house body, shared by the house assets (sheet house-small: a plain cube under a projecting
 * roof band, a parapet rim, a framed doorway on the street front, slit windows set high, a stair head
 * on the roof). Kept to a handful of masses: there are hundreds of houses.
 */
function houseBody({ x, y, w, d }, h, tint, rng, { stairHead = true } = {}) {
  const k = 0.25, dark = scaleHex(tint, 0.42), band = scaleHex(tint, 0.93);
  const out = [
    { kind: 'house', x: x + k, y: y + k, w: w - 2 * k, d: d - 2 * k, z0: 0, z1: h, tint },
    { kind: 'house-roof', x, y, w, d, z0: h, z1: h + 0.35, tint: band },
    // the parapet rim
    { kind: 'house-parapet', x, y, w, d: 0.35, z0: h + 0.35, z1: h + 0.9, tint: band },
    { kind: 'house-parapet', x, y: y + d - 0.35, w, d: 0.35, z0: h + 0.35, z1: h + 0.9, tint: band },
    { kind: 'house-parapet', x, y: y + 0.35, w: 0.35, d: d - 0.7, z0: h + 0.35, z1: h + 0.9, tint: band },
    { kind: 'house-parapet', x: x + w - 0.35, y: y + 0.35, w: 0.35, d: d - 0.7, z0: h + 0.35, z1: h + 0.9, tint: band },
  ];
  const dw = Math.min(1.3, w * 0.22), dx = x + w * (0.25 + rng() * 0.5);
  out.push({ kind: 'door-frame', x: dx - dw / 2 - 0.3, y: y + k - 0.15, w: dw + 0.6, d: 0.15, z0: 0, z1: 2.5, tint: band });
  out.push({ kind: 'door', x: dx - dw / 2, y: y + k - 0.2, w: dw, d: 0.12, z0: 0, z1: 2.1, tint: dark });
  // a pair of high slits on the front, away from the door
  const wx = dx < x + w / 2 ? x + w * 0.72 : x + w * 0.2;
  if (w > 5) for (const o of [0, 0.6]) out.push({ kind: 'window', x: wx + o, y: y + k - 0.1, w: 0.3, d: 0.1, z0: h * 0.5, z1: h * 0.5 + 1.1, tint: dark });
  if (stairHead && w > 5 && d > 5) {
    const sx = x + w - 2.6, sy = y + d - 3.4;
    out.push({ kind: 'stair-head', x: sx, y: sy, w: 1.8, d: 2.4, z0: h + 0.35, z1: h + 2.3, tint: band });
    out.push({ kind: 'door', x: sx + 0.45, y: sy - 0.06, w: 0.9, d: 0.08, z0: h + 0.35, z1: h + 1.9, tint: dark });
  }
  return out;
}

export const houseSmall = {
  id: 'house-small', sheet: 'house-small', designed: true, patterns: ['flat-roof-cube', 'blank-wall', 'sun-dried-earth'],
  envelope: { w: [6, 12], d: [6, 12] },
  build({ W, D }, { palette: P, culture: K, rng }) {
    const h = lerp(K.house.height, rng() * 0.6), tint = houseTint(K, P, rng);
    return houseBody({ x: 0, y: 0, w: W, d: D }, h, tint, rng, { stairHead: rng() < 0.7 });
  },
};
/**
 * The tall town house (sheet house-tall: a two-storey block with roof-beam ends showing under the roof
 * band, and a lower one-storey wing beside it behind a parapet).
 */
export const houseTall = {
  id: 'house-tall', sheet: 'house-tall', designed: true, patterns: ['flat-roof-cube', 'blank-wall', 'sun-dried-earth'],
  envelope: { w: [9, 17], d: [9, 17] },
  build({ W, D }, { palette: P, culture: K, rng }) {
    const tint = houseTint(K, P, rng), h = K.house.height[1] + 0.6 + rng() * 1.4, hl = lerp(K.house.height, rng() * 0.4);
    const mw = W * (0.55 + rng() * 0.15), left = rng() < 0.5;
    const main = { x: left ? 0 : W - mw, y: 0, w: mw, d: D }, wing = { x: left ? mw : 0, y: D * 0.15, w: W - mw, d: D * 0.85 };
    const out = houseBody(main, h, tint, rng, { stairHead: false });
    // beam ends under the roof band, along the front
    const beam = scaleHex(P.bridge, 1.15);
    for (let x = main.x + 0.8; x < main.x + main.w - 0.6; x += 1.3) out.push({ kind: 'beam-end', x, y: -0.45, w: 0.22, d: 0.7, z0: h - 0.45, z1: h - 0.23, tint: beam });
    const band = scaleHex(tint, 0.93);
    out.push({ kind: 'house', ...wing, z0: 0, z1: hl, tint: scaleHex(tint, 1.03) });
    out.push({ kind: 'house-parapet', x: wing.x, y: wing.y, w: wing.w, d: 0.35, z0: hl, z1: hl + 0.8, tint: band });
    out.push({ kind: 'house-parapet', x: left ? wing.x + wing.w - 0.35 : wing.x, y: wing.y, w: 0.35, d: wing.d, z0: hl, z1: hl + 0.8, tint: band });
    return out;
  },
};
/**
 * The courtyard house (sheet house-court, squared to its lot: a two-storey back range opening onto the
 * court through a row of dark doorways, single-storey front blocks — the street door in one — and low
 * walls closing the sides; the court open in the middle).
 */
export const houseCourt = {
  id: 'house-court', sheet: 'house-court', designed: true, patterns: ['courtyard-house', 'blank-wall', 'sun-dried-earth'],
  envelope: { w: [11, 18], d: [11, 18] },
  build({ W, D }, { palette: P, culture: K, rng }) {
    const tint = houseTint(K, P, rng), band = scaleHex(tint, 0.93), dark = scaleHex(tint, 0.42);
    const k = Math.min(3.6, D / 3.2), h1 = lerp(K.house.height, rng() * 0.5), h2 = h1 + 2.6, hl = h1 * 0.62, t = 0.5;
    const fl = W * (0.36 + rng() * 0.1);
    const out = [
      ...houseBody({ x: 0, y: 0, w: fl, d: k }, h1, tint, rng, { stairHead: false }),
      { kind: 'house', x: W - fl * 0.8, y: 0, w: fl * 0.8, d: k, z0: 0, z1: h1, tint },
      { kind: 'house-roof', x: W - fl * 0.8, y: 0, w: fl * 0.8, d: k, z0: h1, z1: h1 + 0.35, tint: band },
      { kind: 'court-wall', x: fl, y: 0, w: W - fl - fl * 0.8, d: t, z0: 0, z1: hl, tint },
      { kind: 'court-wall', x: 0, y: k, w: t, d: D - 2 * k, z0: 0, z1: hl, tint },
      { kind: 'court-wall', x: W - t, y: k, w: t, d: D - 2 * k, z0: 0, z1: hl, tint },
      { kind: 'house', x: 0, y: D - k, w: W, d: k, z0: 0, z1: h2, tint },
      { kind: 'house-roof', x: 0, y: D - k, w: W, d: k, z0: h2, z1: h2 + 0.35, tint: band },
      { kind: 'house-parapet', x: 0, y: D - 0.35, w: W, d: 0.35, z0: h2 + 0.35, z1: h2 + 0.9, tint: band },
    ];
    // the back range opens onto the court: a row of doorways below, windows above
    const n = Math.max(2, Math.floor((W - 2) / 2.6));
    for (let i = 0; i < n; i++) {
      const cx = 1 + (i + 0.5) * ((W - 2) / n);
      out.push({ kind: 'door', x: cx - 0.5, y: D - k - 0.08, w: 1, d: 0.1, z0: 0, z1: 2.2, tint: dark });
      out.push({ kind: 'window', x: cx - 0.35, y: D - k - 0.08, w: 0.7, d: 0.1, z0: h1 + 0.6, z1: h1 + 1.6, tint: dark });
    }
    return { boxes: out, grounds: [{ kind: 'court', x: t, y: k, w: W - 2 * t, d: D - 2 * k, z: 0.03, fill: P.court, surface: 'brick' }] };
  },
};

/**
 * A run of the city wall (sheet: a thick battered wall, deep vertical recesses along the outer face,
 * a projecting cornice band, a walkway behind a parapet rim). Only a run whose outer face is exposed
 * (`slot.exposed`) wears the face detail; runs buried in the wall's thickness are plain body.
 */
export const wallRun = {
  id: 'wall-run', sheet: 'wall-run', designed: true, patterns: ['towered-wall', 'niched-wall', 'sun-dried-earth'],
  envelope: { w: [3, 60], d: [3, 6] },
  build({ W, D, slot }, { palette: P, culture: K }) {
    const H = K.wall.height, body = P.wall;
    if (!slot.exposed) return [{ kind: 'city-wall', x: 0, y: 0, w: W, d: D, z0: 0, z1: H, tint: body }];
    // the outer face is battered: it leans back as it rises, its buttresses leaning with it
    const lean = Math.min(D * 0.4, H * 0.09), at = (z) => lean * (z / H);
    const out = [battered({ x: 0, y: 0, w: W, d: D }, 0, H, body, lean, { sides: ['front'], kind: 'city-wall' })];
    out.push(...ribs({ x: 0, y: 0, w: W, d: D }, 0, H * 0.78, scaleHex(body, 1.04), { pitch: 2.4, width: 1.2, depth: 0.45, faces: ['front'], lean: at(H * 0.78) }));
    out.push({ kind: 'cornice', x: 0, y: at(H * 0.84) - 0.3, w: W, d: 0.9, z0: H * 0.84, z1: H * 0.92, tint: scaleHex(body, 0.9) });
    out.push({ kind: 'parapet', x: 0, y: lean + 0.1, w: W, d: 0.6, z0: H, z1: H + 1.1, tint: scaleHex(body, 0.95) });
    return out;
  },
};
/**
 * A wall tower (sheet: a battered square body with vertical grooves, a cornice band ringed with
 * merlons, a shaded open chamber on top under a broad overhanging roof slab).
 */
function towerParts({ x, y, w, d }, H, P) {
  const body = scaleHex(P.wall, 0.97), shade = scaleHex(P.wall, 0.55), rim = scaleHex(P.wall, 0.9);
  const k = 0.6, core = { x: x + k, y: y + k, w: w - 2 * k, d: d - 2 * k }, zc = H * 0.8, lean = core.w * 0.13;
  const top = { x: x + w * 0.3, y: y + d * 0.3, w: w * 0.4, d: d * 0.4 }, post = Math.max(0.6, w * 0.08);
  return [
    battered(core, 0, zc, body, lean, { kind: 'wall-tower' }),   // the body tapers as it rises
    ...ribs(core, 0, zc * 0.95, scaleHex(body, 1.05), { pitch: core.w / 3, width: 0.8, depth: 0.45, lean: lean * 0.95 }),
    { kind: 'cornice', x: x + lean - 0.2, y: y + lean - 0.2, w: w - 2 * lean + 0.4, d: d - 2 * lean + 0.4, z0: zc, z1: zc + 0.7, tint: rim },
    ...merlons({ x: x + lean - 0.2, y: y + lean - 0.2, w: w - 2 * lean + 0.4, d: d - 2 * lean + 0.4 }, zc + 0.7, rim, { pitch: Math.max(1.4, w / 6), size: 0.8, height: 0.8, depth: 0.7 }),
    { kind: 'tower-chamber', ...top, z0: zc + 0.7, z1: H, tint: shade },
    ...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => ({ kind: 'tower-post', x: x + w * 0.22 + i * (w * 0.56 - post), y: y + d * 0.22 + j * (d * 0.56 - post), w: post, d: post, z0: zc + 0.7, z1: H, tint: body })),
    { kind: 'tower-roof', x: x + w * 0.16, y: y + d * 0.16, w: w * 0.68, d: d * 0.68, z0: H, z1: H + 0.6, tint: rim },
  ];
}
export const wallTower = {
  id: 'wall-tower', sheet: 'wall-tower', designed: true, patterns: ['towered-wall', 'niched-wall', 'sun-dried-earth'],
  envelope: { w: [7, 10], d: [7, 10] },
  build({ W, D }, { palette: P, culture: K }) { return towerParts({ x: 0, y: 0, w: W, d: D }, K.wall.towerHeight, P); },
};
/**
 * A city gate (sheet: two tall battered towers projecting forward, a lower gate block set back between
 * them, a tall doorway with stepped jambs, merlons on every top). The passage is open — the lane runs
 * through it.
 */
export const cityGate = {
  id: 'city-gate', sheet: 'city-gate', designed: true, patterns: ['towered-wall', 'sun-dried-earth'],
  envelope: { w: [24, 30], d: [10, 14] },
  build({ W, D }, { palette: P, culture: K }) {
    const t = Math.min(8, W * 0.28), H = K.wall.towerHeight + 2, gh = K.wall.height + 1;
    const body = scaleHex(P.wall, 0.95), rim = scaleHex(P.wall, 0.88), frame = scaleHex(P.wall, 1.05);
    const out = [];
    for (const x of [0, W - t]) {
      const r = { x, y: 0, w: t, d: D };
      const tw = battered(r, 0, H, body, t * 0.1, { kind: 'gate-tower' });   // battered, like the wall
      out.push(tw);
      out.push({ kind: 'cornice', x: tw.top.x - 0.25, y: tw.top.y - 0.25, w: tw.top.w + 0.5, d: tw.top.d + 0.5, z0: H, z1: H + 0.5, tint: rim });
      out.push(...merlons({ x: tw.top.x - 0.25, y: tw.top.y - 0.25, w: tw.top.w + 0.5, d: tw.top.d + 0.5 }, H + 0.5, rim, { pitch: t / 4, size: 0.9, height: 0.9, depth: 0.8 }));
    }
    // the gate block between the towers, set back; the passage through it stays open
    const gx0 = t, gw = W - 2 * t, y0 = 2.4, pw = Math.min(6, gw * 0.62), px = gx0 + (gw - pw) / 2, lz = Math.min(8.5, gh * 0.66);
    out.push({ kind: 'gate-block', x: gx0, y: y0, w: px - gx0, d: D - y0, z0: 0, z1: gh, tint: body });
    out.push({ kind: 'gate-block', x: px + pw, y: y0, w: gx0 + gw - px - pw, d: D - y0, z0: 0, z1: gh, tint: body });
    out.push({ kind: 'gate-block', x: px, y: y0, w: pw, d: D - y0, z0: lz, z1: gh, tint: body });
    out.push(...merlons({ x: gx0, y: y0, w: gw, d: D - y0 }, gh, rim, { pitch: gw / 5, size: 0.9, height: 0.9, depth: 0.8 }));
    // stepped jambs: two frames stand proud around the doorway
    for (const [k, dz] of [[1.4, 1.2], [0.7, 0.6]]) {
      out.push({ kind: 'gate-frame', x: px - k, y: y0 - 0.35 * (k / 0.7), w: k, d: 0.35 * (k / 0.7), z0: 0, z1: lz + dz, tint: frame });
      out.push({ kind: 'gate-frame', x: px + pw, y: y0 - 0.35 * (k / 0.7), w: k, d: 0.35 * (k / 0.7), z0: 0, z1: lz + dz, tint: frame });
      out.push({ kind: 'gate-frame', x: px - k, y: y0 - 0.35 * (k / 0.7), w: pw + 2 * k, d: 0.35 * (k / 0.7), z0: lz, z1: lz + dz, tint: frame });
    }
    return out;
  },
};
/**
 * The white temple (sheet white-temple: a raised platform with a stair running up its front, the
 * temple set back on top, its walls cut by deep tall niches all round, a cornice band and an
 * overhanging roof slab, a framed door toward the stair). Whitewashed.
 */
export const whiteTemple = {
  id: 'white-temple', sheet: 'white-temple', designed: true, patterns: ['niched-wall', 'whitewash', 'terrace', 'frieze', 'mosaic-skin'],
  envelope: { w: [16, 26], d: [12, 22] },
  build({ W, D }, { palette: P }) {
    const wash = P.whitewash[0], shade = scaleHex(wash, 0.5), band = scaleHex(wash, 0.93), plat = scaleHex(P.platform, 1.04);
    const hp = Math.min(3.6, D * 0.2), sw = 2.2, out = [];
    out.push(battered({ x: 0, y: sw, w: W, d: D - sw }, 0, hp, plat, hp * 0.18, { kind: 'platform' }));   // a sloped platform
    out.push(...slopedFlight({ x: W * 0.12, y: sw * 0.3, w: W * 0.3, d: sw * 0.7 }, 0, hp, P.stair, 'x+', { cheek: 0.35, cheekTint: plat }));   // the stair up the front
    const t = { x: W * 0.14, y: sw + (D - sw) * 0.16, w: W * 0.72, d: (D - sw) * 0.68 }, ht = Math.max(5.5, W * 0.3);
    out.push(battered(t, hp, hp + ht, wash, ht * 0.05, { kind: 'temple' }));
    out.push(...ribs(t, hp + 0.4, hp + ht * 0.78, shade, { pitch: 1.6, width: 0.55, depth: 0.08, lean: ht * 0.05 * 0.72 }));   // niches read as dark slots
    out.push({ kind: 'cornice', x: t.x - 0.25, y: t.y - 0.25, w: t.w + 0.5, d: t.d + 0.5, z0: hp + ht * 0.84, z1: hp + ht * 0.92, tint: band });
    out.push({ kind: 'temple-roof', x: t.x - 0.6, y: t.y - 0.6, w: t.w + 1.2, d: t.d + 1.2, z0: hp + ht, z1: hp + ht + 0.6, tint: band });
    const cx = t.x + t.w / 2;
    out.push({ kind: 'door-frame', x: cx - 1.5, y: t.y - 0.4, w: 3, d: 0.4, z0: hp, z1: hp + 3.6, tint: band });
    out.push({ kind: 'door', x: cx - 0.8, y: t.y - 0.46, w: 1.6, d: 0.1, z0: hp, z1: hp + 2.9, tint: scaleHex(P.platform, 0.4) });
    // the portal (sheet temple-portal): mosaic columns either side of the door under a lintel, a copper
    // frieze of walking cattle along the front, and the lion-headed eagle in copper over the door
    const cu = P.patina, cuDk = scaleHex(cu, 0.7), zl = hp + ht * 0.78;
    for (const o of [-1, 1]) out.push({ kind: 'portal-column', solid: 'drum', x: cx + o * 2 - 0.36, y: t.y - 1.3, w: 0.72, d: 0.72, z0: hp, z1: zl, sides: 10, tint: P.mosaic[0], surface: 'cone-mosaic' });
    out.push({ kind: 'portal-lintel', x: cx - 2.5, y: t.y - 1.45, w: 5, d: 1.5, z0: zl, z1: zl + 0.45, tint: band });
    const fz = hp + ht * 0.6;
    out.push({ kind: 'frieze', x: t.x + 0.3, y: t.y - 0.22, w: t.w - 0.6, d: 0.2, z0: fz, z1: fz + ht * 0.13, tint: cu });
    for (let x = t.x + 0.8; x < t.x + t.w - 1.4; x += 1.7) if (Math.abs(x + 0.45 - cx) > 2.8) out.push({ kind: 'frieze-cattle', x, y: t.y - 0.3, w: 0.9, d: 0.1, z0: fz + ht * 0.03, z1: fz + ht * 0.1, tint: cuDk });
    const rz = hp + ht + 0.6, pw = Math.min(t.w * 0.5, 7);
    out.push({ kind: 'relief', x: cx - pw / 2, y: t.y - 0.1, w: pw, d: 0.3, z0: rz, z1: rz + pw * 0.42, tint: cu });
    out.push({ kind: 'relief-eagle', x: cx - 0.35, y: t.y - 0.3, w: 0.7, d: 0.22, z0: rz + pw * 0.05, z1: rz + pw * 0.36, tint: cuDk });
    for (const o of [-1, 1]) out.push({ kind: 'relief-wing', solid: 'frustum', x: cx + o * 0.35 - (o < 0 ? 0.5 : 0), y: t.y - 0.28, w: 0.5, d: 0.2, z0: rz + pw * 0.12, z1: rz + pw * 0.36, top: { x: cx + o * (pw * 0.4) - (o < 0 ? 0.5 : 0), y: t.y - 0.28, w: 0.5, d: 0.2 }, tint: cuDk });
    return out;
  },
};

/**
 * The reed house, mudhif (sheet reed-house: a long barrel vault of bundled reed arches under woven
 * mats, thick bundled pillars at the front corners, the arched end open). The vault is stepped slices.
 */
export const reedHouse = {
  id: 'reed-house', sheet: 'reed-house', designed: true, patterns: ['reed'],
  envelope: { w: [4, 7], d: [8, 14] },
  build({ W, D }, { palette: P, rng }) {
    const reed = P.reed, tie = scaleHex(reed, 0.8);
    const R = W / 2 - 0.35, wall = R * 0.55, out = [];
    // a round barrel vault, its front end open and dark; reed ties as thin rings standing proud of it
    out.push({ kind: 'reed-house', solid: 'vault', x: 0.35, y: 0.6, w: W - 0.7, d: D - 0.6, z0: 0, z1: wall + R, axis: 'y', open: 'lo', tint: reed });
    for (let y = 2; y < D - 1; y += 2.2) out.push({ kind: 'reed-tie', solid: 'vault', x: 0.25, y, w: W - 0.5, d: 0.25, z0: 0, z1: wall + R + 0.1, axis: 'y', caps: false, tint: tie });
    // the bundled corner pillars, flaring at the top
    for (const x of [0, W - 0.9]) {
      const h = wall + R * (1.1 + rng() * 0.25);
      out.push({ kind: 'reed-pillar', solid: 'frustum', x, y: 0, w: 0.9, d: 0.9, z0: 0, z1: h, top: { x: x - 0.25, y: -0.25, w: 1.4, d: 1.4 }, tint: tie });
    }
    return out;
  },
};

import { SUMER_ART } from './sumer-art.js';

/**
 * The canal bridge: a humped brick bridge over a CORBELLED opening — courses stepping in until a
 * lintel closes the top, the way Sumerian builders spanned a tomb or a drain — high enough at its
 * crown for a reed boat's horns to pass under. Stair flights climb to the deck from each quay
 * between low cheek walls; a parapet runs along both edges of the deck.
 *
 * The layout passes where the water is: `slot.span` { y0, y1 } (local, the two banks) and
 * `slot.waterZ` (the water level, below the quay at 0). Local y runs across the canal; the opening
 * is a tunnel along x, the boats' way.
 */
export const canalBridge = {
  id: 'canal-bridge', designed: true, patterns: ['canal-through', 'sun-dried-earth'],
  read: 'a humped brick bridge on a stepped (corbelled) arch, stairs up from both quays',
  notes: ['opening 7 m wide at the water, sides upright 1.8 m, then six courses stepping in 0.5 m each', 'crown clearance ≈ 4.5 m over the water: a reed boat with its horns passes', 'stairs at 1:2 between cheek walls; parapets 0.9 m'],
  envelope: { w: [6, 9], d: [30, 34] },
  /** The opening's half-width at height z (local), for clearance checks: 0 where the bridge is solid. */
  profile({ y0, y1 }, waterZ) {
    const { zs, rise, inset, n, half0 } = bridgeDims({ y0, y1 }, waterZ);
    return (z) => (z < waterZ ? 0 : z < zs ? half0 : z < zs + n * rise ? half0 - (Math.floor((z - zs) / rise) + 1) * inset : 0);
  },
  build({ W, D, slot }, { palette: P }) {
    // alone (a sheet, a blueprint) it spans a 9 m canal centred in its rect, the water 1.5 m down
    const sp = slot.span || { y0: (D - 9) / 2, y1: (D + 9) / 2 }, wz = slot.waterZ ?? -1.5;
    const { y0, y1 } = sp, c = (y0 + y1) / 2;
    const { zs, rise, inset, n, half0, apex, top, deck } = bridgeDims(sp, wz);
    const brick = scaleHex(P.paving, 0.9), dk = scaleHex(P.paving, 0.8), yA = y0 - 1.2, yB = y1 + 1.2, out = [];
    // each course in three lengths: the two arch faces in the sun, the tunnel between them in its own
    // shade, so the opening reads dark from along the canal
    const shade = scaleHex(brick, 0.5), ring = Math.min(0.9, (W - 0.8) / 3);
    const span = (ya, yb, z0, z1, kind, tint = brick, through = false) => {
      if (yb - ya <= 0.01) return;
      if (!through) { out.push({ kind, x: 0.4, y: ya, w: W - 0.8, d: yb - ya, z0, z1, tint }); return; }
      out.push({ kind, x: 0.4, y: ya, w: ring, d: yb - ya, z0, z1, tint }, { kind, x: 0.4 + ring, y: ya, w: W - 0.8 - 2 * ring, d: yb - ya, z0, z1, tint: shade }, { kind, x: W - 0.4 - ring, y: ya, w: ring, d: yb - ya, z0, z1, tint });
    };
    // the abutments and the opening's upright sides, down into the water
    span(yA, c - half0, wz - 0.3, zs, 'bridge-pier', brick, true); span(c + half0, yB, wz - 0.3, zs, 'bridge-pier', brick, true);
    // the corbel: each course reaches a step further over the water
    for (let k = 0; k < n; k++) { const h = half0 - (k + 1) * inset, z = zs + k * rise; span(yA, c - h, z, z + rise, 'bridge-corbel', brick, true); span(c + h, yB, z, z + rise, 'bridge-corbel', brick, true); }
    span(yA, yB, apex, top, 'bridge-lintel', brick, true);
    span(yA, yB, top, deck, 'bridge-deck', P.paving);
    // parapets along both edges of the deck
    for (const x of [0, W - 0.4]) out.push({ kind: 'bridge-parapet', x, y: yA, w: 0.4, d: yB - yA, z0: top, z1: deck + 0.9, tint: dk });
    // stairs up from each quay, 1:2, between cheek walls
    const run = deck * 2;
    out.push(...slopedFlight({ x: 0.4, y: yA - run, w: W - 0.8, d: run }, 0, deck, P.stair, 'y+', { cheek: 0.4, cheekTint: dk, riser: 0.3 }));
    out.push(...slopedFlight({ x: 0.4, y: yB, w: W - 0.8, d: run }, 0, deck, P.stair, 'y-', { cheek: 0.4, cheekTint: dk, riser: 0.3 }));
    return out;
  },
};
/** The bridge's corbel, sized from the water's width and level (shared by build and profile). */
export function bridgeDims({ y0, y1 }, waterZ) {
  const half0 = (y1 - y0) / 2 - 1, zs = waterZ + 1.8, rise = 0.45, inset = 0.5, n = Math.max(3, Math.min(6, Math.floor((half0 - 0.5) / 0.5)));
  const apex = zs + n * rise, top = apex + 0.45;
  return { half0, zs, rise, inset, n, apex, top, deck: top + 0.15 };
}

export const SUMER_ASSETS = { ...Object.fromEntries([ziggurat, houseSmall, houseTall, houseCourt, wallRun, wallTower, cityGate, whiteTemple, reedHouse, canalBridge].map((a) => [a.id, a])), ...SUMER_ART };
