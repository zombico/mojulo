/**
 * THE PAINT — colour as its own concern, for the outdoor structures, the town and its dress. Every asset is built in
 * VALUES only (greys, 0…1) on named SURFACE GROUPS, the way a playscape object is (playscape/objects/laws.js
 * `values-only`) and a stage's tiles are (era/tone.js): a building says "this is plaster at 0.88, this is tile at 0.5,
 * this opening is 0.04", never what colour any of it is. The style guide paints: each group takes one of the kit's
 * swatch ramps (era/style/swatches.js), the lit value picks the stop, and the kit's accent is kept for the one surface
 * that marks a use. One town, any kit's paint.
 *
 * The painter's own rules (colour decisions, so they live here, not in any builder):
 *   - trim that shares a covering's ramp sits a stop over it (shutters read as shutters, not as patches of roof)
 *   - a covering on its walls' ramp sits a stop under them (the value order survives a shared ramp)
 *   - the accent stop is the accent's alone: any other surface landing on it steps off it
 *   - a covering on the openings' ramp never sinks to their stop: the holes stay the darkest thing
 *   - fitted to a language (`fitPaint`): a cap that comes out over its walls steps a stop down, or the walls a stop
 *     up, until the order holds
 * and its law: the paint keeps the asset's value order (wall over roof over opening) for every wall and covering the
 * kit's rails can build together. A recipe's paint may re-point a group at another of the kit's ramps; nothing else.
 *
 * And its rules for a STREET: the citizens are painted by ruled variation of the anchor's paint. The roofs hold (every
 * citizen's cap the anchor's ramp and stop: a street's roofs are one); the walls vary (each household's wall groups a
 * stop up or down, or swapped for another of the group's ramps the kit has); neighbours on a frontage differ; every
 * variant keeps the value order; the focus, the landmark and the secondaries (one voice, the counterpoint) wear the
 * anchor's own paint, and the secondary's values must keep their order under it too.
 *
 *   structurePaint(kitId, { swatches })  → { kitId, ramps: { group: stops }, from, shift, accent }
 *   paintStop(paint, group, value)       → [r, g, b]
 *   paintIndex(paint, group, value)      → { stops, i, ramp } (the ramp and the stop: a material's window on the material pole)
 *   paintLaws(paint)                     → [{ law, ok, value, want }]
 *   streetPaints(paint, town)            → { paints: one per lot, laws }
 */
import { SWATCHES, madeRamp, swatchesOf } from './style/swatches.js';
import { baseOf } from './style/looks.js';
import { STRUCTURE_RAILS, COVERINGS, geometry } from './out-structures.js';
import { decompileAnchor } from './out-anchor-structure.js';

/** The surface groups, and what each is. Buildings `str:`, the town's ground `town:`, the dress `dress:`. */
export const SURFACE_GROUPS = Object.freeze({
  'str:plaster': 'plaster walls and a frame\'s panels', 'str:stone': 'stone walls, socles, chimneys', 'str:timber': 'boards, frame members, posts, doors, trims',
  'str:thatch': 'thatch, its edge and its rolled ridge', 'str:tile': 'tile, its courses and its ridge', 'str:shingle': 'shingle and its courses', 'str:slate': 'slate and its courses',
  'str:shell': 'a shell, its tunnel and its points', 'str:lens': 'a shell\'s round lights', 'str:motif': 'a shell\'s ribs and the rims round its lights',
  'str:paint': 'shutters, signs, a painted door', 'str:opening': 'glass and voids: the darkest thing on a building', 'str:accent': 'the one surface that marks a use (the focus\'s door)',
  'town:grass': 'the ground', 'town:soil': 'beaten earth, fields', 'town:stone': 'paving, walls, stairs',
  'dress:timber': 'posts, benches, carts, barrels', 'dress:stone': 'wells', 'dress:paint': 'lanterns, awnings, boards', 'dress:cloth': 'awnings\' other stripe', 'dress:leaf': 'foliage', 'dress:bark': 'trunks, logs', 'dress:bloom': 'flowers',
});
export const SURFACE_GROUP_IDS = Object.freeze(Object.keys(SURFACE_GROUPS));

// each group's ramp (a list: the first the kit has), then each kit's re-pointings
const BASE = {
  'str:plaster': ['soil', 'rope'], 'str:stone': ['stone'], 'str:timber': ['timber'], 'str:thatch': ['rope'], 'str:tile': ['paint'], 'str:shingle': ['timber'], 'str:slate': ['stone'],
  'str:shell': ['soil', 'rope'], 'str:lens': ['lens', 'glow', 'paint'], 'str:motif': ['soil', 'rope'],
  'str:paint': ['paint'], 'str:opening': ['timber'], 'str:accent': ['paint'],
  'town:grass': ['grass', 'moss'], 'town:soil': ['soil', 'rope'], 'town:stone': ['stone'],
  'dress:timber': ['timber'], 'dress:stone': ['stone'], 'dress:paint': ['paint'], 'dress:cloth': ['rope'], 'dress:leaf': ['foliage', 'moss'], 'dress:bark': ['bark', 'timber'], 'dress:bloom': ['blossom', 'paint'],
};
export const STRUCTURE_PAINTS = Object.freeze({
  'isekai-meadow': {}, 'isekai-garden': {}, 'isekai-sakura': {}, 'isekai-bamboo': {},
  'nature-trail': { 'str:plaster': ['rope'] }, 'jungle-mgs3': { 'str:plaster': ['rope'] },
  'alien-night': { 'str:shell': ['rock'], 'str:motif': ['rock'], 'str:plaster': ['rock'], 'str:tile': ['rock'], 'str:shingle': ['timber'], 'str:slate': ['timber'] },
});
const resolve = (kitId, names) => { for (const n of names) { try { return { name: n, stops: madeRamp(kitId, n) }; } catch { /* the next */ } } return { name: 'stone', stops: madeRamp(kitId, 'stone') }; };

/** A kit's paint, a recipe's re-pointings applied (a group at another of the kit's ramps), the painter's rules run. */
export function structurePaint(kitId, { swatches = {} } = {}) {
  const own = STRUCTURE_PAINTS[kitId] ?? STRUCTURE_PAINTS[baseOf(kitId)];
  if (!own || !swatchesOf(kitId)) throw new Error(`paint: the outdoor structures are painted for ${Object.keys(STRUCTURE_PAINTS).join(', ')} (got '${kitId}')`);
  const ramps = {}, names = {}, from = {}, shift = {};
  for (const g of SURFACE_GROUP_IDS) {
    if (swatches[g] !== undefined) { madeRamp(kitId, swatches[g]); const r = resolve(kitId, [swatches[g]]); ramps[g] = r.stops; names[g] = r.name; from[g] = 'recipe'; continue; }
    const r = resolve(kitId, own[g] ?? BASE[g]); ramps[g] = r.stops; names[g] = r.name; from[g] = 'kit';
  }
  for (const g of Object.keys(swatches)) if (!SURFACE_GROUPS[g]) throw new Error(`paint: '${g}' is not a surface group (${SURFACE_GROUP_IDS.join(', ')})`);
  const covers = Object.keys(COVERINGS).map((c) => `str:${c}`), walls = ['str:plaster', 'str:stone', 'str:timber'];
  // a covering on its walls' ramp sits a stop under them; trim on a covering's ramp sits a stop over it
  for (const c of covers) if (walls.some((w) => ramps[w] === ramps[c])) shift[c] = -1;
  if (covers.some((c) => ramps[c] === ramps['str:paint'])) { shift['str:paint'] = 1; from['str:paint'] = `${from['str:paint']} · rule: a stop over the roof it shares a ramp with`; }
  const [accRamp, accStop] = swatchesOf(kitId).accent;
  return { kitId, ramps, names, from, shift, accent: madeRamp(kitId, accRamp)[accStop], accentRamp: madeRamp(kitId, accRamp), accentStop: accStop };
}

/** A group's colour at a value (a lit value: the light has been applied), the painter's rules kept. */
export function paintStop(P, group, value, step = 0) {
  const { stops, i } = paintIndex(P, group, value, step);
  return stops[i];
}
/** The same, as the ramp and the stop on it (`ramp` its name): what a material is painted round on the material pole. */
export function paintIndex(P, group, value, step = 0) {
  if (group === 'str:accent') return { stops: P.accentRamp, i: P.accentStop, ramp: 'accent' };
  const S = P.ramps[group] ?? P.ramps['str:stone'], n = S.length;
  let i = Math.max(0, Math.min(n - 1, Math.round(value * (n - 1)) + step + (P.shift[group] ?? 0)));
  if (S === P.accentRamp && i === P.accentStop) i = i + (step > 0 || i === 0 ? 1 : -1);
  if (COVER_GROUPS.has(group) && S === P.ramps['str:opening']) i = Math.max(i, Math.round(0.04 * (n - 1)) + (P.shift['str:opening'] ?? 0) + 1);
  return { stops: S, i: Math.max(0, Math.min(n - 1, i)), ramp: group === 'str:opening' ? 'opening' : (P.names?.[group] ?? 'stone') };
}

const COVER_GROUPS = new Set(Object.keys(COVERINGS).map((c) => `str:${c}`));
const luma = ([a, b, c]) => 0.3 * a + 0.59 * b + 0.11 * c;
/** The paint's law: an anchor's language (the kit's own unless given) keeps its value order under the paint: every
 *  storey over its cap (or its lights), those over an opening. */
export function paintLaws(P, L = decompileAnchor(STRUCTURE_RAILS[P.kitId].anchor)) {
  const V = L.values, broken = [], open = luma(paintStop(P, 'str:opening', 0.04));
  // no cap: the walls stand over the lights where the lights are their own surface (a lens), else over the openings
  if (!V.cap && V.opening.group === 'str:opening') { const bad = V.storeys.filter((st) => !(luma(paintStop(P, st.group, st.value)) > open)); return [{ law: 'paint-keeps-values', ok: bad.length === 0, value: bad.length ? bad.map((st) => st.group).join(', ') : `${L.id}: the walls over the openings`, want: 'the paint keeps the anchor\'s value order: walls over cap (or lights) over openings' }]; }
  const cap = V.cap ? luma(paintStop(P, V.cap.group, V.cap.value)) : luma(paintStop(P, V.opening.group, V.opening.value));
  for (const st of V.storeys) { const w = luma(paintStop(P, st.group, st.value)); if (!(w > cap)) broken.push(`${st.group} ${Math.round(w)} / ${V.cap?.group ?? V.opening.group} ${Math.round(cap)}`); }
  if (!(cap > open)) broken.push(`cap ${Math.round(cap)} / opening ${Math.round(open)}`);
  return [{ law: 'paint-keeps-values', ok: broken.length === 0, value: broken.length ? broken.join(', ') : `${L.id}: ${V.storeys.length} storey value${V.storeys.length > 1 ? 's' : ''} over ${V.cap ? 'the cap' : 'the lights'} over the openings`, want: 'the paint keeps the anchor\'s value order: walls over cap (or lights) over openings' }];
}

/** The paint fitted to a language: where its value order breaks, the cap steps down a stop, then the walls up, in turn
 *  (at most three each); the same paint where it holds. */
export function fitPaint(P, L) {
  let Q = P;
  const cap = L.values.cap?.group, walls = [...new Set(L.values.storeys.map((x) => x.group))];
  for (let k = 0; k < 6 && !paintLaws(Q, L)[0].ok; k++) {
    const shift = { ...Q.shift };
    if (cap && k % 2 === 0) shift[cap] = (shift[cap] ?? 0) - 1; else for (const g of walls) if (g !== cap) shift[g] = (shift[g] ?? 0) + 1;
    Q = { ...Q, shift, fitted: L.id };
  }
  return Q;
}

// ── a street's paint: ruled variation of the anchor's ───────────────────────────────────────────────────────────────
/** The ramps a wall group may swap to, household by household (the kit's own; a name it lacks is skipped). */
export const WALL_ALTERNATIVES = Object.freeze({ 'str:plaster': ['soil', 'rope', 'stone'], 'str:stone': ['stone', 'rock'], 'str:timber': ['timber', 'bark'], 'str:shell': ['rock', 'rope'] });
const cache = new WeakMap();
/** A paint with some wall groups re-pointed: `change` { group: { ramp, step } }. */
function variant(P, change) {
  const ramps = { ...P.ramps }, names = { ...P.names }, shift = { ...P.shift };
  for (const [g, c] of Object.entries(change)) { ramps[g] = madeRamp(P.kitId, c.ramp); names[g] = c.ramp; shift[g] = (P.shift[g] ?? 0) + c.step; }
  return { ...P, ramps, names, shift, variant: change };
}
/**
 * The paint for every lot of a town (era/out-town.js), by the street's rules: roofs hold, walls vary, neighbours on a
 * frontage differ, the value order kept; the focus and the landmark unvaried. Seeded from the town alone.
 */
export function streetPaints(P, town) {
  if (!cache.has(town)) cache.set(town, new Map());
  const memo = cache.get(town);
  if (memo.has(P)) return memo.get(P);
  const P0 = P, P2 = town.secondary ? fitPaint(P0, town.secondary) : null;
  P = fitPaint(P0, town.language);
  const L = town.language, walls = [...new Set(L.values.storeys.map((s) => s.group))].filter((g) => WALL_ALTERNATIVES[g] && g !== L.values.cap?.group);
  const fixed = new Set([L.values.cap?.group, 'str:paint', 'str:accent', ...Object.keys(COVERINGS).map((c) => `str:${c}`)].filter(Boolean).map((g) => P.ramps[g])).add(P.accentRamp);
  // each wall group's choices: its own ramp or an alternative (never a roof's or the trim's), a stop up, level or down
  const opts = walls.map((g) => { const seen = new Set(), out = []; for (const name of [P.names[g], ...WALL_ALTERNATIVES[g]]) { let r; try { r = madeRamp(P.kitId, name); } catch { continue; } if (seen.has(r) || (r !== P.ramps[g] && fixed.has(r))) continue; seen.add(r); for (const step of [0, -1, 1]) out.push({ g, ramp: name, step }); } return out; });
  let combos = [{}];
  for (const o of opts) combos = combos.flatMap((c) => o.map((x) => ({ ...c, [x.g]: { ramp: x.ramp, step: x.step } })));
  const keyOf = (c) => JSON.stringify(c), lawOk = new Map(), okOf = (c) => { const k = keyOf(c); if (!lawOk.has(k)) lawOk.set(k, paintLaws(variant(P, c), L)[0].ok); return lawOk.get(k); };
  const R = geometry.mulberry32(geometry.subSeed(town.seed ?? 1, `paint:${P.kitId}`)), last = new Map(), paints = new Array(town.lots.length).fill(P), keys = new Array(town.lots.length).fill('anchor');
  const order = town.lots.map((l, i) => ({ l, i })).sort((a, b) => (a.l.route + a.l.side).localeCompare(b.l.route + b.l.side) || (a.l.s ?? 0) - (b.l.s ?? 0));
  let alike = 0, broken = 0;
  for (const { l, i } of order) {
    if (l.secondary) { paints[i] = P2; keys[i] = 'secondary'; continue; }
    if (l.focus || l.dare) continue;
    const front = `${l.route}:${l.side}`, prev = last.get(front), start = Math.floor(R() * combos.length);
    let pick = null;
    for (let k = 0; k < combos.length && !pick; k++) { const c = combos[(start + k) % combos.length]; if (keyOf(c) !== prev && okOf(c)) pick = c; }
    pick ??= {};
    if (keyOf(pick) === prev && combos.length > 1) alike++;
    if (!okOf(pick)) broken++;
    last.set(front, keyOf(pick)); keys[i] = keyOf(pick); paints[i] = Object.keys(pick).length ? variant(P, pick) : P;
  }
  const cap = L.values.cap?.group, roofs = !cap || paints.every((q, i) => town.lots[i].secondary || (q.ramps[cap] === P.ramps[cap] && (q.shift[cap] ?? 0) === (P.shift[cap] ?? 0)));
  const out = { paints, keys, laws: [
    { law: 'roofs-hold', ok: roofs, value: cap ? `every roof ${P.names[cap]}${P.shift[cap] ? ` ${P.shift[cap]}` : ''}` : 'no cap: the shells hold their own', want: 'a street\'s roofs are one: every citizen\'s cap on the anchor\'s ramp and stop' },
    { law: 'neighbours-differ', ok: alike === 0, value: combos.length > 1 ? `${new Set(keys.filter((k) => k !== 'anchor' && k !== 'secondary')).size} wall paints over ${combos.length} allowed, ${alike} neighbours alike` : 'nothing to vary: the walls are the cap\'s own material; households differ in form', want: 'no two neighbours on a frontage painted alike' },
    { law: 'variants-keep-values', ok: broken === 0, value: `${broken} variants out of order`, want: 'every household\'s paint keeps the anchor\'s value order' },
    ...(town.secondary ? [{ ...paintLaws(P2, town.secondary)[0], law: 'secondary-keeps-values', want: 'the secondary keeps its own value order under the anchor\'s paint' }] : []),
  ] };
  memo.set(P, out);
  return out;
}
