/**
 * THE METRO'S FRONTAGE — what a building's walls show the street at a person's height: its WINDOWS (glass in a frame,
 * a stone sill and head), its ground floor's STOREFRONTS (glazing over a stall riser between pilasters, a door, a
 * transom, a fascia sign, an awning on some), its APARTMENT ENTRIES (a door in a stone surround, a transom, a step, a
 * canopy), an office's LOBBY (glass doors under a canopy), BALCONIES (a slab and a glass rail), and its bands (a
 * cornice at its top, a band over its shops). Each piece a TEMPLATE the scene stamps (instanced repeats, drawn near the
 * camera, kit.js's way): the light baked, so each facing its own template, never yawed; the parts a building or a shop
 * paints its own baked white and TINTED per instance.
 *
 *   FRONTAGE                       the pieces' numbers: bays, the share of shops with an awning, of buildings with
 *                                  balconies, an entry's spacing
 *   FACINGS                        { s, n, e, w }: a wall's outward normal
 *   frontageTemplates(L, { frames? }) → { <piece>-<part>:<facing>: faces }: every piece each way, lit by L (the scene's
 *                                  light); a window once a frame's paint (`frames`), untinted
 *   wallsOf([x0, y0, x1, y1])      → { s, n, e, w: { a, L } }: a box's walls, each from its start (on the left seen from
 *                                  the street) along it
 *   frontsOf(wall, spec, R)        → [{ key, pos, scale?, tint? }]: a wall dressed. wall { facing, a, L, z0, out? (m proud
 *                                  of it) }; spec {
 *                                  storeys, floorH, use: 'residential' | 'office' | 'mixed', ground: 'shops' | 'entries'
 *                                  | 'lobby' | 'windows' | 'none', windows?: false (its ground only), balconies?: true,
 *                                  palette: { frame, shop, sign, awning, door, rail } (lists of hex), frames? (the
 *                                  windows' baked paints: a window its frame's variant) }; R its dice
 *   TINT(hex)                      a paint as an instance's tint (linear rgb)
 *
 * Metres; a wall's frame `u` along it, `v` out of it, `z` up from its foot. Pure.
 */
import { litFactor, scaleHex } from '../polygonizer/vexar.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
export const FACINGS = Object.freeze({ s: [0, -1], n: [0, 1], e: [1, 0], w: [-1, 0] });
export const FRONTAGE = Object.freeze({
  bay: { residential: 3.4, office: 3.0, mixed: 3.2 },
  // a storefront's nominal width and storey (its template's; each stretched to its share of the wall and its storey)
  shop: { w: 5, h: 4, least: 4.2, awning: 0.45 },
  lobby: { w: 6, h: 4.5 },
  entry: { every: 18, w: 2.6 },
  balcony: { share: 0.45 },
  window: { h: 3 },
});
// a window block's bays and storeys, and its nominal bay (m): stretched to a wall's bay and storey
const WIN_BLOCK = [4, 2], WIN_BAY = 3.4;
const GLASS = '#2f3c46', SHOP_GLASS = '#7d97a3', DOOR_GLASS = '#3a454c', TRANSOM = '#64808c', STONE = '#cfc8ba', RAIL_GLASS = '#a9bcc4';
export const TINT = (h) => [1, 3, 5].map((k) => { const c = parseInt(h.slice(k, k + 2), 16) / 255; return r4(c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); });

// ── the pieces, in a wall's frame (u along it, v out of it, z up), each a list of boxes and quads ──
const B = (u0, u1, v0, v1, z0, z1, part) => ({ box: [u0, u1, v0, v1, z0, z1], part });
const Q = (corners, n, part) => ({ quad: corners, n, part });
const PIECES = {
  // a punched window: its glass, its frame (a mullion and a transom bar), its stone sill and head
  win: [
    Q([[-0.62, 0.025, 0.88], [0.62, 0.025, 0.88], [0.62, 0.025, 2.46], [-0.62, 0.025, 2.46]], [0, 1, 0], 'glass'),
    B(-0.7, -0.62, 0, 0.07, 0.86, 2.48, 'frame'), B(0.62, 0.7, 0, 0.07, 0.86, 2.48, 'frame'), B(-0.62, 0.62, 0, 0.07, 2.42, 2.48, 'frame'),
    B(-0.62, 0.62, 0, 0.06, 0.86, 0.92, 'frame'), B(-0.025, 0.025, 0, 0.05, 0.92, 2.42, 'frame'), B(-0.62, 0.62, 0, 0.05, 1.98, 2.03, 'frame'),
    B(-0.78, 0.78, 0, 0.15, 0.76, 0.86, 'stone'), B(-0.78, 0.78, 0, 0.08, 2.48, 2.64, 'stone'),
  ],
  // a storefront: glazing over a stall riser, a door to one side, a transom, pilasters, its fascia sign
  shop: [
    Q([[-2.2, 0.05, 0.55], [1.0, 0.05, 0.55], [1.0, 0.05, 3.0], [-2.2, 0.05, 3.0]], [0, 1, 0], 'shopglass'),
    Q([[1.25, 0.03, 0.04], [2.2, 0.03, 0.04], [2.2, 0.03, 2.45], [1.25, 0.03, 2.45]], [0, 1, 0], 'doorglass'),
    Q([[-2.2, 0.05, 3.08], [2.2, 0.05, 3.08], [2.2, 0.05, 3.3], [-2.2, 0.05, 3.3]], [0, 1, 0], 'transom'),
    B(-2.25, 1.05, 0, 0.12, 0, 0.55, 'frame'), B(-2.5, -2.2, 0, 0.2, 0, 3.36, 'frame'), B(2.2, 2.5, 0, 0.2, 0, 3.36, 'frame'),
    B(1.0, 1.25, 0, 0.1, 0, 3.0, 'frame'), B(1.25, 2.2, 0, 0.1, 2.45, 3.0, 'frame'), B(-2.2, 2.2, 0, 0.1, 3.0, 3.08, 'frame'), B(-0.62, -0.56, 0, 0.08, 0.55, 3.0, 'frame'),
    B(-2.5, 2.5, 0, 0.24, 3.36, 3.95, 'sign'),
  ],
  // an awning over a storefront's glazing
  awning: [
    Q([[-2.3, 0.24, 3.34], [2.3, 0.24, 3.34], [2.3, 1.5, 2.78], [-2.3, 1.5, 2.78]], [0, 0.4, 0.92], 'awning'),
    Q([[-2.3, 1.5, 2.52], [2.3, 1.5, 2.52], [2.3, 1.5, 2.78], [-2.3, 1.5, 2.78]], [0, 1, 0], 'awning'),
    Q([[-2.3, 0.24, 3.34], [-2.3, 1.5, 2.78], [-2.3, 1.5, 2.52]], [-1, 0, 0], 'awning'), Q([[2.3, 0.24, 3.34], [2.3, 1.5, 2.52], [2.3, 1.5, 2.78]], [1, 0, 0], 'awning'),
  ],
  // an apartment's entry: a pair of doors in a stone surround, a transom over them, a step, a canopy
  entry: [
    B(-0.74, -0.02, 0, 0.05, 0.15, 2.3, 'door'), B(0.02, 0.74, 0, 0.05, 0.15, 2.3, 'door'),
    Q([[-0.74, 0.03, 2.34], [0.74, 0.03, 2.34], [0.74, 0.03, 2.62], [-0.74, 0.03, 2.62]], [0, 1, 0], 'transom'),
    B(-1.0, -0.74, 0, 0.16, 0.15, 2.66, 'stone'), B(0.74, 1.0, 0, 0.16, 0.15, 2.66, 'stone'), B(-1.0, 1.0, 0, 0.16, 2.62, 2.8, 'stone'),
    B(-1.15, 1.15, 0, 0.6, 0, 0.15, 'stone'), B(-1.3, 1.3, 0, 1.2, 2.88, 3.0, 'canopy'),
  ],
  // an office's lobby: glass doors and walls between mullions, a canopy over them
  lobby: [
    Q([[-2.8, 0.05, 0.04], [2.8, 0.05, 0.04], [2.8, 0.05, 3.6], [-2.8, 0.05, 3.6]], [0, 1, 0], 'shopglass'),
    ...[-2.85, -1.45, -0.05, 1.35, 2.75].map((u) => B(u, u + 0.1, 0, 0.12, 0, 3.7, 'frame')), B(-2.85, 2.85, 0, 0.12, 3.6, 3.7, 'frame'),
    B(-3.2, 3.2, 0, 2.2, 3.8, 3.98, 'canopy'), B(-3.2, 3.2, 2.1, 2.2, 3.6, 3.98, 'canopy'),
  ],
  // a balcony at a storey's floor: its slab, a glass rail, a top rail
  balcony: [
    B(-1.3, 1.3, 0, 1.25, -0.06, 0.14, 'stone'),
    Q([[-1.26, 1.2, 0.14], [1.26, 1.2, 0.14], [1.26, 1.2, 1.0], [-1.26, 1.2, 1.0]], [0, 1, 0], 'railglass'), Q([[1.26, 1.2, 0.14], [-1.26, 1.2, 0.14], [-1.26, 1.2, 1.0], [1.26, 1.2, 1.0]], [0, -1, 0], 'railglass'),
    B(-1.3, 1.3, 1.17, 1.25, 1.0, 1.06, 'rail'), B(-1.3, -1.24, 0, 1.25, 1.0, 1.06, 'rail'), B(1.24, 1.3, 0, 1.25, 1.0, 1.06, 'rail'),
  ],
  // a band along a wall (a cornice, a band over its shops): a unit box, stretched along the wall and in its height
  band: [B(0, 1, 0, 0.4, 0, 0.5, 'band')],
};
// each part's paint: a fixed one, or white for its instance's tint (TINTS: the parts a building or a shop paints)
const PART_HEX = { glass: GLASS, shopglass: SHOP_GLASS, doorglass: DOOR_GLASS, transom: TRANSOM, stone: STONE, railglass: RAIL_GLASS };
const TINTS = new Set(['frame', 'sign', 'awning', 'door', 'canopy', 'rail', 'band']);
// each piece's parts gathered into the templates it stamps (a window one, its glass and sill tinted with its frame: a
// metro stamps tens of thousands); a template is tinted when a part in it is
const PART_OF_PIECE = { win: { glass: 'unit', frame: 'unit', stone: 'unit' }, shop: { shopglass: 'glass', doorglass: 'glass', transom: 'glass', frame: 'frame', sign: 'sign' }, awning: { awning: 'awning' },
  entry: { door: 'door', transom: 'stone', stone: 'stone', canopy: 'canopy' }, lobby: { shopglass: 'glass', frame: 'frame', canopy: 'canopy' }, balcony: { stone: 'slab', railglass: 'slab', rail: 'rail' }, band: { band: 'band' } };
const TINTED = new Set(Object.values(PART_OF_PIECE).flatMap((m) => Object.entries(m).filter(([part]) => TINTS.has(part)).map(([, g]) => g)));

/** Every piece's parts each way, lit: { '<piece>-<part>:<facing>': faces }. */
const MEMO = new Map();
export function frontageTemplates(L, { frames = [] } = {}) {
  // (once a light and a set of paints: a scene asks them every build)
  const memo = JSON.stringify([L, frames]);
  if (MEMO.has(memo)) return MEMO.get(memo);
  const out = {};
  for (const [f, n] of Object.entries(FACINGS)) {
    const t = [-n[1], n[0]], W = (u, v, z) => [r4(u * t[0] + v * n[0]), r4(u * t[1] + v * n[1]), r4(z)], N = (a, b, c) => [a * t[0] + b * n[0], a * t[1] + b * n[1], c];
    const face = (corners, nl, hex) => { const nw = N(...nl), len = Math.hypot(...nw); const nn = nw.map((v) => v / len); return { corners: corners.map((c) => W(...c)), normal: nn, fill: scaleHex(hex, litFactor(nn, L)) }; };
    // (WINDOWS baked once a frame's paint, none tinted, as one or as a BLOCK of WIN_BLOCK bays by storeys: a metro stamps
    // tens of thousands, a block an eighth of them)
    const variants = (piece) => (piece === 'win' && frames.length ? frames.flatMap((hex, k) => [[1, 1], WIN_BLOCK].map(([c, r]) => ({ tag: `${k}x${c}${r}`, frame: hex, cols: c, rows: r }))) : [{ tag: '', frame: null, cols: 1, rows: 1 }]);
    for (const [piece, items0] of Object.entries(PIECES)) for (const V of variants(piece)) {
      // (a block's windows each its bay and storey over: the template's nominal bay and storey, stretched to the wall's)
      const items = V.cols * V.rows === 1 ? items0 : Array.from({ length: V.cols * V.rows }, (_, i) => { const du = (i % V.cols - (V.cols - 1) / 2) * WIN_BAY, dz = Math.floor(i / V.cols) * FRONTAGE.window.h; return items0.map((it) => (it.quad ? { ...it, quad: it.quad.map(([u, v, z]) => [u + du, v, z + dz]) } : { ...it, box: [it.box[0] + du, it.box[1] + du, it.box[2], it.box[3], it.box[4] + dz, it.box[5] + dz] })); }).flat();
      for (const it of items) {
      const group = PART_OF_PIECE[piece][it.part] + V.tag, key = `${piece}-${group}:${f}`, hex = TINTS.has(it.part) ? V.frame ?? '#ffffff' : PART_HEX[it.part] ?? GLASS;
      const list = out[key] ?? (out[key] = []);
      if (it.quad) { list.push(face(it.quad, it.n, hex)); continue; }
      const [u0, u1, v0, v1, z0, z1] = it.box;
      list.push(face([[u0, v1, z1], [u1, v1, z1], [u1, v0, z1], [u0, v0, z1]], [0, 0, 1], hex), face([[u0, v0, z0], [u1, v0, z0], [u1, v1, z0], [u0, v1, z0]], [0, 0, -1], hex),
        face([[u0, v1, z0], [u1, v1, z0], [u1, v1, z1], [u0, v1, z1]], [0, 1, 0], hex), face([[u0, v0, z0], [u0, v1, z0], [u0, v1, z1], [u0, v0, z1]], [-1, 0, 0], hex), face([[u1, v1, z0], [u1, v0, z0], [u1, v0, z1], [u1, v1, z1]], [1, 0, 0], hex));
      }
    }
  }
  MEMO.set(memo, out);
  if (MEMO.size > 6) MEMO.delete(MEMO.keys().next().value);
  return out;
}
/** The pieces' parts: which template keys a piece stamps, and which of them take its tint. */
const partsOf = (piece) => [...new Set(Object.values(PART_OF_PIECE[piece]))].map((g) => ({ g, tinted: TINTED.has(g) }));

/** A box's four walls, each from its start along it (left to right seen from outside). */
export function wallsOf([x0, y0, x1, y1]) {
  return { s: { a: [x0, y0], L: x1 - x0 }, n: { a: [x1, y1], L: x1 - x0 }, e: { a: [x1, y0], L: y1 - y0 }, w: { a: [x0, y1], L: y1 - y0 } };
}

/** A wall dressed: its storefronts, entries or lobby on its ground floor, its windows over them, balconies, its bands. */
export function frontsOf(wall, spec, R) {
  const { facing, L, z0 } = wall, n = FACINGS[facing], t = [-n[1], n[0]], out = [], P = spec.palette;
  // (stood `out` metres proud of its wall: a facade's piers in front of its plane)
  const a = [wall.a[0] + n[0] * (wall.out ?? 0), wall.a[1] + n[1] * (wall.out ?? 0)];
  const { storeys, floorH } = spec, ns = facing === 's' || facing === 'n';
  // (a stretch along the wall and in height: the axis the wall runs on)
  const sc = (su, sz = 1) => (Math.abs(su - 1) < 1e-6 && Math.abs(sz - 1) < 1e-6 ? null : ns ? [r4(su), 1, r4(sz)] : [1, r4(su), r4(sz)]);
  const r2 = (v) => Math.round(v * 100) / 100 + 0;
  const put = (piece, u, z, tint, scale = null) => {
    const pos = [r2(a[0] + t[0] * u), r2(a[1] + t[1] * u), r2(z)];
    // (a window of a baked frame, or a block of them: its variant, untinted)
    if (piece === 'win' && spec.frames?.length) { out.push({ key: `win-unit${Math.max(0, spec.frames.indexOf(tint.all))}x${tint.block ?? '11'}:${facing}`, pos, ...(scale ? { scale } : {}) }); return; }
    for (const { g, tinted } of partsOf(piece)) out.push({ key: `${piece}-${g}:${facing}`, pos, ...(scale ? { scale } : {}), ...(tinted && tint ? { tint: TINT(tint[g] ?? tint.all) } : {}) });
  };
  if (L < 3 || storeys < 1) return out;
  const bay = FRONTAGE.bay[spec.use] ?? 3.4, nb = Math.max(1, Math.floor(L / bay)), step = L / nb, zs = floorH / FRONTAGE.window.h;
  const pick = (xs) => xs[Math.floor(R() * xs.length)];
  // the ground floor, by its use
  const taken = new Set();
  if (spec.ground === 'shops' || spec.ground === 'lobby') {
    const lob = spec.ground === 'lobby' && L >= FRONTAGE.lobby.w + 2;
    const lobU = lob ? L / 2 : null, segs = lob ? [[0, L / 2 - FRONTAGE.lobby.w / 2 - 0.3], [L / 2 + FRONTAGE.lobby.w / 2 + 0.3, L]] : [[0, L]];
    if (lob) put('lobby', lobU, z0, { frame: pick(P.frame), canopy: pick(P.rail) }, sc(1, Math.max(0.85, floorH / FRONTAGE.lobby.h)));
    for (const [s0, s1] of segs) {
      const len = s1 - s0, k = Math.floor(len / FRONTAGE.shop.least);
      if (k < 1) continue;
      const w = len / k;
      for (let i = 0; i < k; i++) {
        const u = s0 + (i + 0.5) * w, frame = pick(P.shop), sign = pick(P.sign);
        put('shop', u, z0, { frame, sign }, sc(w / FRONTAGE.shop.w, Math.min(1.1, floorH / FRONTAGE.shop.h)));
        if (R() < FRONTAGE.shop.awning) put('awning', u, z0, { awning: pick(P.awning) }, sc(w / FRONTAGE.shop.w, Math.min(1.1, floorH / FRONTAGE.shop.h)));
      }
    }
    // (a band over the shops, the storey's floor)
    put('band', 0, z0 + floorH - 0.18, { band: pick(P.shop) }, sc(L, 0.5));
    for (let k = 0; k < nb; k++) taken.add(k);
  } else if (spec.ground === 'entries') {
    const ne = Math.max(1, Math.round(L / FRONTAGE.entry.every));
    for (let i = 0; i < ne; i++) { const k = Math.min(nb - 1, Math.floor(((i + 0.5) * nb) / ne)); taken.add(k); put('entry', (k + 0.5) * step, z0, { door: pick(P.door), canopy: pick(P.rail) }); }
  } else if (spec.ground === 'none') for (let k = 0; k < nb; k++) taken.add(k);
  // its windows, storey by storey (its ground's where nothing else is), and its balconies
  const balc = spec.use === 'residential' && spec.balconies !== false && R() < FRONTAGE.balcony.share, frame = pick(P.frame), rail = pick(P.rail);
  if (spec.windows !== false) {
    // (blocks of windows where a block's bays and storeys are all windows, single windows round them)
    const [bc, br] = WIN_BLOCK, done = new Set(), blocks = spec.frames?.length;
    if (blocks) for (let j = 1; j + br - 1 < storeys; j += br) for (let k = 0; k + bc - 1 < nb; k += bc) {
      put('win', (k + bc / 2) * step, z0 + j * floorH, { all: frame, block: `${bc}${br}` }, sc(step / WIN_BAY, zs));
      for (let jj = j; jj < j + br; jj++) for (let kk = k; kk < k + bc; kk++) done.add(`${jj}:${kk}`);
    }
    for (let j = 0; j < storeys; j++) for (let k = 0; k < nb; k++) {
      if ((j === 0 && taken.has(k)) || done.has(`${j}:${k}`)) continue;
      put('win', (k + 0.5) * step, z0 + j * floorH, { all: frame }, sc(1, zs));
    }
    if (balc) for (let j = 1; j < storeys; j++) for (let k = 1; k < nb; k += 2) put('balcony', (k + 0.5) * step, z0 + j * floorH, { rail });
  }
  // its cornice at its top (none where its facade is another's)
  if (spec.windows !== false) put('band', 0, z0 + storeys * floorH - 0.5, { band: frame }, sc(L, 1));
  return out;
}
