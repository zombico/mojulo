/**
 * THE GEOCITY'S GEOTOWNS — the two tools composed: a neighbourhood of the metro laid by the geotown (geotown/design.js),
 * any neighbourhood (the edge or the core), its block segments the geotown's own, standing on the metro's land, its
 * perimeter streets meeting the arterials round it. What is not the town in its neighbourhood is green (the town's
 * frame centred in it).
 *
 *   true            the town fitted to its neighbourhood: the outskirts' pattern to scale (`evoke: 'metro'`), as many
 *                   blocks across and along as the neighbourhood holds (up to the geotown's most), its streetscape by
 *                   its ring (leafy in the outskirts, snug in the frame, urban in the core), no margin of its own
 *   { … }           the town its recipe asks (an evocation, a neighbourhood's layout, a pattern, a streetscape), no margin
 *                   unless it says
 *
 *   a BLOCK of the metro may be given to the geotown too ('D3.2.1'): one of its block segments, cropped to its block
 *
 *   townsOf(d, T, N)      → { <region id>: { spec, seed, design, origin: [x, y], frame: { W, D }, field, fits, rest } }
 *   blockTownsOf(d, T, N) → { <block id>: { spec, seed, design, block, rect, shift, field, surfaces, fits } }
 *     origin the town's south-west corner in the metro's frame; field (x, y) → the metro's natural ground in the
 *     town's frame; fits whether its frame stands inside its neighbourhood; rest the square metres of the
 *     neighbourhood the town leaves (green)
 *
 * Pure: a town's dice are its own (its seed off the metro's and its neighbourhood's id).
 */
import { designGeotown } from '../geotown/design.js';
import { GRID_MOST } from '../geotown/read.js';
import { PATTERNS, SEGMENTS } from '../geotown/pattern.js';
import { PLAY } from './metro.js';
import { strHash } from '../city/plan/dice.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
export const RING_STREETSCAPES = Object.freeze({ outskirts: 'leafy', frame: 'snug', core: 'urban' });

/** The largest grid of the pattern's blocks whose frame stands inside w × h (by the one- and two-block frames). */
function fitGrid(base, seed, w, h) {
  const frameOf = (g) => designGeotown({ ...base, grid: g }, { seed, field: () => 0 }).frame;
  const f1 = frameOf([1, 1]), f2 = frameOf([2, 2]), dx = f2.W - f1.W, dy = f2.D - f1.D;
  const clamp = (v) => Math.max(1, Math.min(GRID_MOST, v));
  let c = clamp(1 + Math.floor((w - f1.W) / dx)), r = clamp(1 + Math.floor((h - f1.D) / dy));
  // (each block's dice its own: a grid's frame a little off the estimate is cut back until it stands inside)
  for (let f = frameOf([c, r]); (f.W > w || f.D > h) && (c > 1 || r > 1); f = frameOf([c, r])) { if (f.W - w > f.D - h && c > 1) c--; else if (r > 1) r--; else c--; }
  return [c, r];
}

// a neighbourhood too small for one block to scale, or a block given to the geotown with no segment named: its ring's
export const RING_SEGMENTS = Object.freeze({ outskirts: 'houses', frame: 'lowrise', core: 'main-street' });
const TOWN_SEGMENTS = Object.freeze(['houses', 'main-street', 'apartments', 'lowrise', 'edge', 'school', 'sports', 'park']);

/** The pattern a composed town is laid in: the metro's outskirts', compressed as the metro's own is at game scale (its
 *  blocks and rows shorter, never a house or a lane), and its rows' counts (`counts`: houses, shops, low-rises, an
 *  avenue's buildings) where a block is filled by count. A pattern document (geotown/read.js: { from, …changes }). */
function townPattern(T, counts = null, depth = null) {
  const id = T.metro.outskirts, P = PATTERNS[id], k = depth ? null : PLAY[T.play]?.depth ?? null, doc = { from: id };
  const scale = (r) => r.map((v) => Math.round(v * k * 100) / 100), c = depth ? [depth, depth] : null;
  if (k) doc.block = { long: T.pattern.block.long, depth: T.pattern.block.depth };
  // (a block filled by its row's depth: each row of the segment as deep as half the metro block across it)
  if (c) { doc.block = { ...P.block, depth: c }; doc.rows = Object.fromEntries(Object.entries(P.rows).map(([n, v]) => [n, { ...v, depth: c }])); }
  if (k || c || counts) doc.streetscapes = Object.fromEntries(Object.entries(P.streetscapes).map(([n, v]) => [n, {
    ...v, ...(v.block?.depth && (k || c) ? { block: { ...v.block, depth: c ?? scale(v.block.depth) } } : {}), ...(counts ? { evoke: { ...(v.evoke ?? {}), ...counts } } : {}),
  }]));
  if (counts) doc.evoke = counts;
  return doc;
}

/** A composed recipe's evocation, said or implied: a neighbourhood named is evoked as one, a segment named as one. */
const evokeOf = (own) => (own.evoke !== undefined ? own : own.neighbourhood !== undefined ? { ...own, evoke: 'neighbourhood' } : own.segment !== undefined ? { ...own, evoke: 'segment' } : own);

export function townsOf(d, T, N) {
  const out = {};
  for (const [id, ask] of Object.entries(T.geotowns ?? {})) {
    if (id.includes('.')) continue;
    const r = d.regions.find((x) => x.id === id);
    if (!r) throw new Error(`geocity: geotowns.${id} is not a neighbourhood (${d.regions.map((x) => x.id).join(', ')})`);
    if (r.park) throw new Error(`geocity: geotowns.${id} is the city's park; a geotown is laid in a built neighbourhood`);
    const seed = strHash(`${d.seed}|geotown|${id}`) % 100000, w = r.rect[2] - r.rect[0], h = r.rect[3] - r.rect[1];
    const own = evokeOf(ask === true ? {} : ask), told = own.evoke !== undefined;
    let spec = { margin: 0, ...(own.pattern === undefined ? { pattern: townPattern(T) } : {}), ...(own.streetscape === undefined ? { streetscape: RING_STREETSCAPES[r.builds] } : {}), ...own };
    if (!told) {
      spec = { ...spec, evoke: 'metro', grid: own.grid ?? fitGrid({ ...spec, evoke: 'metro' }, seed, w, h) };
      // (one block to scale too big for it: a block segment of its ring's instead)
      const f = designGeotown(spec, { seed, field: () => 0 }).frame;
      if (!own.grid && (f.W > w || f.D > h)) { const { grid, ...rest } = spec; spec = { ...rest, evoke: 'segment', segment: RING_SEGMENTS[r.builds] }; }
    }
    // its frame first (the land moves no street), then the town on the metro's land, centred in its neighbourhood
    const F = designGeotown(spec, { seed, field: () => 0 }).frame;
    const origin = [r3(r.rect[0] + (w - F.W) / 2), r3(r.rect[1] + (h - F.D) / 2)];
    const field = (x, y) => N(x + origin[0], y + origin[1]);
    const design = designGeotown(spec, { seed, field });
    out[id] = { spec, seed, design, origin, frame: { W: design.frame.W, D: design.frame.D }, field, fits: design.frame.W <= w + 0.01 && design.frame.D <= h + 0.01, rest: r3(Math.max(0, w * h - design.frame.W * design.frame.D)) };
  }
  return out;
}

/** The blocks given to the geotown (a block's id, 'D3.2.1'): each laid by one of its block segments, its block cropped
 *  from its evocation and centred in the metro's block, on the metro's land. → { <block id>: { spec, seed, design,
 *  block, rect, shift: [dx, dy], field, fits, surfaces } } (`surfaces` the metro block's ground: the town block's own,
 *  and green round it) */
export function blockTownsOf(d, T, N) {
  const out = {};
  for (const [id, ask] of Object.entries(T.geotowns ?? {})) {
    if (!id.includes('.')) continue;
    const r = d.regions.find((x) => x.blocks.some((b) => b.id === id)), b = r?.blocks.find((x) => x.id === id);
    if (!b) throw new Error(`geocity: geotowns.${id} is not a block (a neighbourhood's id, its column and row: 'D3.2.1')`);
    if (r.geotown) throw new Error(`geocity: geotowns.${id} is in '${r.id}', a geotown already`);
    const seed = strHash(`${d.seed}|geotown|${id}`) % 100000, own = evokeOf(ask === true ? {} : ask), told = own.evoke !== undefined;
    const seg = TOWN_SEGMENTS.includes(b.kind) ? b.kind : RING_SEGMENTS[r.builds];
    let spec = { margin: 0, ...(own.pattern === undefined ? { pattern: townPattern(T) } : {}), ...(own.streetscape === undefined ? { streetscape: RING_STREETSCAPES[r.builds] } : {}), ...(told ? {} : { evoke: 'segment', segment: seg }), ...own };
    const blockOf = (D0) => D0.blocks.find((x) => x.built !== false && D0.plots.some((p) => p.block === x.id)) ?? D0.blocks[0];
    // a segment filled by count: its rows as long as the metro's block runs along them (its counts scaled, then cut
    // back until it stands inside)
    if (spec.evoke === 'segment' && own.pattern === undefined && SEGMENTS[spec.segment ?? 'houses']?.rows.length) {
      const SG = SEGMENTS[spec.segment ?? 'houses'], axis = SG.axis, run = (q) => (axis === 'x' ? q[2] - q[0] : q[3] - q[1]), L = run(b.rect);
      // its rows as deep as the block across them shares out (no deeper than a row asks: the least the pattern holds)
      const across = axis === 'x' ? b.rect[3] - b.rect[1] : b.rect[2] - b.rect[0], P0 = PATTERNS[T.metro.outskirts];
      const least = P0.setback[1] + P0.house.depth[0] + 2, deep = Math.floor((across / SG.rows.length - 0.5) * 100) / 100;
      let depth = deep >= least ? deep : null;
      // (a lane or an alley between its rows takes its share across: what the first lay overshoots, its rows give back)
      const cross = (q) => (axis === 'x' ? q[3] - q[1] : q[2] - q[0]);
      for (let k = 0; depth && k < 3; k++) {
        const over = cross(blockOf(designGeotown({ ...spec, pattern: townPattern(T, null, depth) }, { seed, field: () => 0 })).rect) - across;
        if (over <= 0.01) break;
        const next = Math.floor((depth - over / SG.rows.length - 0.1) * 100) / 100;
        depth = next >= least ? next : null;
      }
      if (depth) spec = { ...spec, pattern: townPattern(T, null, depth) };
      const D0 = designGeotown(spec, { seed, field: () => 0 }), E = D0.pattern.evoke, L0 = run(blockOf(D0).rect);
      for (let f = (L - 1) / L0, k = 0; k < 8; k++, f *= 0.9) {
        const counts = Object.fromEntries(['houses', 'shops', 'lowrise', 'avenue'].filter((c) => E[c]).map((c) => [c, E[c].map((v) => Math.max(1, Math.floor(v * f)))]));
        const s2 = { ...spec, pattern: townPattern(T, counts, depth) };
        if (run(blockOf(designGeotown(s2, { seed, field: () => 0 })).rect) <= L + 0.01) { spec = s2; break; }
      }
    }
    const flat = designGeotown(spec, { seed, field: () => 0 }), g0 = blockOf(flat).rect;
    const shift = [r3((b.rect[0] + b.rect[2]) / 2 - (g0[0] + g0[2]) / 2), r3((b.rect[1] + b.rect[3]) / 2 - (g0[1] + g0[3]) / 2)];
    const field = (x, y) => N(x + shift[0], y + shift[1]), design = designGeotown(spec, { seed, field }), gb = blockOf(design);
    // its ground: the town block's surfaces, the green round it (scaled to the metro's block where it overreaches)
    const own2 = Object.fromEntries(Object.entries(design.ledger.blocks[gb.id] ?? {}).filter(([, v]) => v > 0)), sum = Object.values(own2).reduce((a, v) => a + v, 0);
    const k = sum > b.area ? b.area / sum : 1, surfaces = Object.fromEntries(Object.entries(own2).map(([s2, v]) => [s2, r3(v * k)]));
    const left = b.area - Object.values(surfaces).reduce((a, v) => a + v, 0);
    if (left > 0.001) surfaces.margin = r3(left);
    out[id] = { spec, seed, design, block: gb.id, rect: gb.rect, shift, field, surfaces, fits: gb.rect[2] - gb.rect[0] <= b.rect[2] - b.rect[0] + 0.01 && gb.rect[3] - gb.rect[1] <= b.rect[3] - b.rect[1] + 0.01 };
  }
  return out;
}
