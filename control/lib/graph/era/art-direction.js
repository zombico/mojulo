/**
 * ART DIRECTION — the gate before a room stage is built: its palette, its materials, its architecture and its motifs,
 * decided first and offered for approval, item by item (the isekai cards did this; the room kits never did).
 *
 *   rollArt(kitId, seed, only?)  → a direction drawn by seeded dice inside the kit's RAILS (no presets: families of
 *                                   ranges), every value a number stored in the recipe
 *   compileArt(art, kitId)       → what the direction means to the builder: tiles, proportions, dressing, torch colour
 *   resolveArt(manifest)         → AUTHORING TIME ONLY (create_sketch / update_sketch): `art: 'propose' | 'auto'` and
 *                                   any item set to 'reroll' are rolled with a fresh seed and stored as numbers
 *
 * The recipe carries the whole direction (`art: { palette, materials, architecture, motifs, status }`), so a world stays
 * stateless and editable: a patch to `/art/palette/stone` re-colours every tile painted from it (materials hold only
 * texture numbers; their colours come from the palette). `status` records what the operator approved; the build reads
 * the direction whatever its status. Absent `art`, nothing changes.
 */
import { randomInt } from 'node:crypto';
import { normalizeTileSpec, proportionsOver } from './tile-specs.js';

// the gate's items, in the order the board shows them: MOTIFS are small (a pattern carved in a band), DOODADS large
// (the set piece, the accent wall, the things on the floor)
export const ART_ITEMS = Object.freeze(['palette', 'materials', 'architecture', 'motifs', 'doodads', 'atmosphere', 'plan']);
const ROLLED = ['palette', 'materials', 'architecture', 'motifs', 'doodads', 'atmosphere'];
const STATUSES = ['proposed', 'approved', 'auto'];

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r3 = (x) => Math.round(x * 1000) / 1000;
const dice = (seed) => {
  const R = mulberry32(seed);
  return { n: ([lo, hi]) => r3(lo + (hi - lo) * R()), i: ([lo, hi]) => lo + Math.floor(R() * (hi - lo + 1)), pick: (xs) => xs[Math.floor(R() * xs.length)], R };
};
const subSeed = (seed, item) => { let h = (seed >>> 0) ^ 0x9e3779b9; for (const c of item) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0; return (h % 99998) + 1; };

/** HSL (h in degrees, s and l 0..1) → [r, g, b] 0..255. */
export function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.max(0, Math.min(255, Math.round(v * 255))));
}
/** A ramp of five stops, darkest first: the shade end mixed toward a cool blue-grey (shade is a colour, never a
 *  muddier version of the hue), the light end toward a warm lamp white. Mixed in RGB, so no hue is dragged through
 *  its neighbours on the wheel. */
const COOL = [44, 52, 74], WARM = [255, 238, 206];
function ramp(h, s, l, span = [0.26, 0.2]) {
  return [0, 1, 2, 3, 4].map((k) => {
    const t = k / 4, c = hsl(h, Math.min(1, s * (1.15 - 0.3 * t)), Math.max(0.04, Math.min(0.94, l - span[0] + (span[0] + span[1]) * t)));
    const toward = t < 0.5 ? COOL : WARM, w = t < 0.5 ? (0.5 - t) * 0.36 : (t - 0.5) * 0.16;
    return c.map((v, i) => Math.round(v + (toward[i] - v) * w));
  });
}

/**
 * THE RAILS: per room kit, the families its stone is drawn from (hue, saturation, lightness ranges) and the range of
 * every texture, proportion and motif number. A roll is any point inside them; the kit's laws hold anywhere inside
 * (art-direction.deep.test.js sweeps it).
 */
/**
 * THE RAILS: per room kit, the families its stone is drawn from (hue, saturation, lightness ranges) and the range of
 * every texture, proportion and motif number. A roll is any point inside them; the kit's laws hold anywhere inside
 * (art-direction.deep.test.js sweeps it). In a rail, [lo, hi] is a number, [lo, hi, 'i'] an integer, a list of words
 * a choice (repeat a word to weight it), and `oneOf: [{ w, …spec }]` a choice between whole specs by weight.
 */
const BRICK_WEAR = { mortarThick: [0.06, 0.12], bevel: [0.15, 0.3], vary: [18, 32], grain: [8, 14], accent: [0.08, 0.18], jointDepth: [0.4, 0.75], grime: [0.3, 0.6], chips: [0.2, 0.45] };
const RUBBLE = { w: 0.25, gen: 'stone-brick', bond: 'rubble', rows: [4, 6, 'i'], radius: [0.3, 0.6], shadow: [0.5, 0.8], mortarThick: [0.07, 0.11], bevel: [0.2, 0.32], vary: [22, 36], grain: [10, 16], dark: true };
const BRICK_FLOOR = { w: 0.2, gen: 'stone-brick', bond: ['herringbone', 'basketweave'], rows: [7, 10, 'i'], radius: [0.1, 0.3], shadow: [0.3, 0.6], mortarThick: [0.08, 0.12], bevel: [0.12, 0.24], vary: [16, 28], grain: [8, 14], chips: [0.1, 0.3] };
const HEX_FLOOR = { w: 0.2, gen: 'stone-brick', bond: 'hex', rows: [5, 7, 'i'], radius: [0, 0.2], shadow: [0.3, 0.6], mortarThick: [0.08, 0.12], bevel: [0.15, 0.28], vary: [18, 30], grain: [8, 14], chips: [0.1, 0.3] };
const FLAGS = (lost, cracked) => ({ w: 0.6, gen: 'flagstone', cells: [3, 5, 'i'], wobble: [1, 3.5], vary: [16, 30], grain: [8, 16], cracked, lost });
export const ART_RAILS = Object.freeze({
  'gothic-stone': {
    stone: [
      { id: 'bluestone', h: [205, 225], s: [0.08, 0.16], l: [0.44, 0.52] },
      { id: 'sandstone', h: [30, 42], s: [0.16, 0.28], l: [0.5, 0.58] },
      { id: 'green slate', h: [140, 170], s: [0.05, 0.12], l: [0.42, 0.5] },
      { id: 'granite', h: [20, 60], s: [0.01, 0.04], l: [0.46, 0.54] },
      { id: 'red sandstone', h: [6, 18], s: [0.2, 0.3], l: [0.42, 0.5] },
    ],
    accent: { pull: [0.45, 0.8], dl: [-0.14, -0.06], s: [0.12, 0.24] },
    materials: {
      wall: { oneOf: [{ w: 0.75, gen: 'stone-brick', bond: ['running', 'running', 'flemish', 'ashlar', 'stack'], rows: [4, 7, 'i'], cols: [3, 5, 'i'], radius: [0.08, 0.35], shadow: [0.3, 0.7], ...BRICK_WEAR }, RUBBLE] },
      floor: { oneOf: [FLAGS([0.04, 0.14], [0.15, 0.4]), BRICK_FLOOR, HEX_FLOOR] },
      ceiling: { gen: 'rock', style: 'cave', amp: [14, 26], crackFreq: [4, 8], crackWidth: [0.01, 0.025], crackDepth: [0.08, 0.2], speckle: [0.02, 0.08] },
      trim: { gen: 'rock', style: 'slate', amp: [16, 26] },
      wood: { gen: 'wood', ringFreq: [8, 12, 'i'], streakAmt: [0.08, 0.16], mottle: [3, 6] },
      weathering: { earth: [0, 0.4], ivy: [0, 0.55], growth: [0, 0.6], litter: [0.15, 0.8], cracks: [0.1, 0.7] },
    },
    architecture: { plinth: { h: [0.45, 0.8] }, cornice: { h: [0.3, 0.55] }, pilaster: { w: [0.55, 0.85], out: [0.2, 0.32] }, rib: { w: [0.35, 0.55], drop: [0.3, 0.45] }, door: { height: [3, 3.6] },
      vaultRise: [2.2, 3.6], lift: [1, 1.3], niche: { head: ['round', 'round', 'flat'], tiers: [1, 2], urns: [0.15, 0.4] } },
    motifs: { pattern: ['meander', 'rope', 'dentil', 'chevron', 'rosette', 'diamond'], on: ['plinth', 'cornice', 'both'], relief: [0.45, 0.8] },
    doodads: { setPiece: ['tomb', 'tomb', 'open-tomb', 'altar', 'well'], accent: 'ashlar', props: ['crate', 'barrel', 'planks', 'stones', 'boulder', 'debris', 'coffin'], round: ['barrel'], clusters: [0, 2], cobwebs: [0.35, 0.65] },
    atmosphere: { fog: [0.7, 1.8], dust: [0.15, 0.85], flicker: [0.3, 0.6] },
  },
  catacomb: {
    stone: [
      { id: 'ochre tufa', h: [30, 42], s: [0.2, 0.32], l: [0.5, 0.58] },
      { id: 'grey limestone', h: [35, 50], s: [0.04, 0.1], l: [0.55, 0.62] },
      { id: 'red tuff', h: [10, 22], s: [0.18, 0.28], l: [0.42, 0.5] },
      { id: 'chalk', h: [40, 55], s: [0.06, 0.12], l: [0.62, 0.68] },
    ],
    accent: { bone: { h: [36, 46], s: [0.14, 0.24], l: [0.56, 0.64] } },
    materials: {
      wall: { oneOf: [{ w: 0.7, gen: 'rock', style: 'cave', amp: [30, 48], crackFreq: [6, 10], crackWidth: [0.02, 0.04], crackDepth: [0.25, 0.4], speckle: [0.06, 0.16] }, { ...RUBBLE, w: 0.3 }] },
      floor: { oneOf: [FLAGS([0.1, 0.2], [0.25, 0.45]), { ...HEX_FLOOR, w: 0.25 }, { ...BRICK_FLOOR, w: 0.15 }] },
      ceiling: { gen: 'rock', style: 'cave', amp: [22, 34], crackFreq: [5, 9], crackWidth: [0.02, 0.035], crackDepth: [0.2, 0.35], speckle: [0.06, 0.12] },
      trim: { gen: 'rock', style: 'cave', amp: [20, 30], crackFreq: [6, 9], crackWidth: [0.015, 0.03], crackDepth: [0.15, 0.3], speckle: [0.04, 0.1] },
      wood: { gen: 'wood', ringFreq: [8, 12, 'i'], streakAmt: [0.1, 0.18], mottle: [3, 6] },
      weathering: { earth: [0.2, 0.8], ivy: [0, 0.25], growth: [0, 0.4], litter: [0.3, 0.9], cracks: [0.2, 0.8] },
    },
    architecture: { plinth: { h: [0.25, 0.45] }, cornice: { h: [0.2, 0.3] }, pilaster: { w: [0.5, 0.7], out: [0.12, 0.22] }, rib: { w: [0.4, 0.6], drop: [0.15, 0.3] }, door: { height: [3, 3.3] },
      vaultRise: [2, 2.8], lift: [1, 1.3], niche: { head: ['flat'], tiers: [3, 4], urns: [0.06, 0.18], sealed: [0.25, 0.55] } },
    motifs: { pattern: ['scallop', 'meander', 'diamond', 'rosette', 'rope'], on: ['plinth', 'cornice', 'both'], relief: [0.4, 0.75] },
    doodads: { setPiece: ['tomb', 'open-tomb', 'open-tomb', 'altar'], accent: 'ossuary', props: ['amphora', 'bones', 'stones', 'debris', 'planks', 'coffin'], round: ['amphora', 'bones'], clusters: [0, 2], cobwebs: [0.3, 0.55] },
    atmosphere: { fog: [0.8, 2], dust: [0.3, 1], flicker: [0.3, 0.55] },
  },
});
export const ART_KITS = Object.freeze(Object.keys(ART_RAILS));
const railsOf = (kitId) => {
  const R = ART_RAILS[kitId];
  if (!R) throw new Error(`stage: art direction is offered for the room kits ${ART_KITS.join(', ')} (got '${kitId}')`);
  return R;
};

/** One rail value rolled: a range, an integer range, a choice of words, or a nested object. */
function rollValue(d, v) {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? d.pick(v) : v[2] === 'i' ? d.i(v) : d.n(v);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rollValue(d, x)]));
  return v;
}
/** A spec rail rolled: `oneOf` picks a whole spec by weight first. */
function rollSpec(d, rail) {
  let r = rail;
  if (rail.oneOf) { let t = d.R() * rail.oneOf.reduce((a, o) => a + o.w, 0); r = rail.oneOf.find((o) => (t -= o.w) < 0) || rail.oneOf[rail.oneOf.length - 1]; }
  const { w: _w, ...spec } = r;
  return rollValue(d, spec);
}

/** Each item's roll: a pure function of the kit and that item's seed. */
const ROLL = {
  palette(R, seed) {
    const d = dice(seed), fam = d.pick(R.stone), h = d.n(fam.h), s = d.n(fam.s), l = d.n(fam.l);
    // blue and orange are opposite on the wheel (any hue path between them runs through purple or green), so a ramp
    // leans warm by mixing toward an earth ramp in RGB, stop by stop
    const mixR = (a, b, t) => a.map((c, i) => c.map((v, k) => Math.round(v + (b[i][k] - v) * t)));
    let accent;
    if (R.accent.bone) { const b = R.accent.bone; accent = ramp(d.n(b.h), d.n(b.s), d.n(b.l), [0.3, 0.14]); }
    else { const as = d.n(R.accent.s), al = l + d.n(R.accent.dl); accent = mixR(ramp(h, as, al), ramp(24, as * 1.5, al), d.n(R.accent.pull)); }
    return {
      seed, family: fam.id,
      stone: ramp(h, s, l),
      floor: mixR(ramp(h, s * 0.9, l - 0.08), ramp(30, 0.26, l - 0.08), 0.45),
      vault: ramp((h + 10) % 360, s * 0.7, l - 0.18, [0.16, 0.12]),
      trim: ramp(h, s * 0.8, l + 0.05, [0.22, 0.16]),
      wood: ramp(d.n([24, 36]), d.n([0.1, 0.18]), d.n([0.34, 0.42]), [0.16, 0.12]),
      accent,
      light: hsl(d.n([22, 38]), d.n([0.85, 0.98]), d.n([0.6, 0.68])),
    };
  },
  materials(R, seed) {
    const d = dice(seed), out = { seed };
    for (const [part, rail] of Object.entries(R.materials)) {
      if (part === 'weathering') {
        // the interceptors' dials (interceptors.js) roll from dice of their own: a seed rolled before they existed
        // keeps every other number it had
        const { growth, litter, cracks, ...rest } = rail, d2 = dice(seed + 7919);
        out.weathering = { ...rollValue(d, rest), ...rollValue(d2, Object.fromEntries(Object.entries({ growth, litter, cracks }).filter(([, v]) => v !== undefined))) };
        continue;
      }
      const spec = rollSpec(d, rail);
      spec.seed = d.i([1, 99999]);
      out[part] = spec;
    }
    return out;
  },
  architecture(R, seed) {
    const d = dice(seed), A = R.architecture, proportions = {};
    for (const [part, nums] of Object.entries(A)) if (!['vaultRise', 'lift', 'niche'].includes(part)) proportions[part] = rollValue(d, nums);
    return { seed, proportions, vault: { maxRise: d.n(A.vaultRise) }, lift: Math.round(d.n(A.lift) * 20) / 20, niche: rollValue(d, A.niche) };
  },
  motifs(R, seed) {
    const d = dice(seed);
    return { seed, ...rollValue(d, R.motifs), figure: d.R() < 0.3 ? 'accent' : 'trim' };
  },
  doodads(R, seed) {
    const d = dice(seed), M = R.doodads;
    // four or five kinds of things, always one turned round (a barrel, a jar): shuffled, so the mix differs
    const pool = M.props.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(d.R() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const n = d.i([4, Math.min(5, pool.length)]), kinds = pool.slice(0, n);
    if (!kinds.some((k) => M.round.includes(k))) kinds[n - 1] = M.round[0];
    return { seed, setPiece: d.pick(M.setPiece), accent: M.accent, props: kinds, clusters: d.i(M.clusters), cobwebs: d.n(M.cobwebs) };
  },
  atmosphere(R, seed) {
    const d = dice(seed);
    return { seed, ...rollValue(d, R.atmosphere) };
  },
};

/** A direction for `kitId` from `seed`: every item, or only those in `only`, each from its own sub-seed. */
export function rollArt(kitId, seed, only = ROLLED) {
  const R = railsOf(kitId), out = {};
  for (const item of only) out[item] = ROLL[item](R, subSeed(seed, item));
  return out;
}

const rgbHex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const unitRgb = (c) => c.map((v) => r3(v / 255));
const grey = (c, warm = 6) => { const g = Math.round((c[0] + c[1] + c[2]) / 3); return [Math.min(255, g + warm), g, Math.max(0, g - warm)]; };

/**
 * What a direction means to the builder: `tiles` (tile specs, coloured from the palette), `proportions`, the vault's
 * rise and the lift, the motif band, and dressing overrides (the niche, the set piece, the accent, the corner things
 * and their wood, cobwebs, earth, ivy, the torch's colour, the atmosphere). Every number is checked against its rail
 * here; a direction outside them is refused with the range it broke.
 */
export function compileArt(art, kitId) {
  railsOf(kitId);
  if (!art || typeof art !== 'object' || Array.isArray(art)) throw new Error("stage: art is 'propose', 'auto', or { palette, materials, architecture, motifs, doodads, atmosphere, status }");
  for (const item of ROLLED) if (!art[item] || typeof art[item] !== 'object') throw new Error(`stage: art.${item} is missing (set art.${item} to 'reroll' at create_sketch / update_sketch to roll one)`);
  const P = art.palette, M = art.materials, A = art.architecture, X = art.motifs, Dd = art.doodads, At = art.atmosphere;
  for (const k of ['stone', 'floor', 'vault', 'trim', 'wood', 'accent']) if (!Array.isArray(P[k]) || P[k].length !== 5) throw new Error(`stage: art.palette.${k} is a ramp of five [r, g, b] stops, darkest first`);
  // the colours each surface is painted in: its own ramp; a rubble wall is dark stones in a pale grey mortar
  const paint = (spec, R2) => {
    const { dark, ...s } = spec;
    if (s.gen === 'stone-brick') return dark ? { ...s, stone: R2[1], mortar: grey(P.trim[3]) } : { ...s, stone: R2[2], mortar: R2[0] };
    if (s.gen === 'flagstone') return { ...s, stone: R2[2], mortar: R2[0], gravel: R2[1] };
    if (s.gen === 'rock') return { ...s, base: R2[2] };
    if (s.gen === 'wood') return { ...s, early: R2[3], late: R2[1] };
    return s;
  };
  const colourOf = { wall: P.stone, floor: P.floor, ceiling: P.vault, trim: P.trim };
  const tiles = {};
  for (const part of ['wall', 'floor', 'ceiling', 'trim']) { tiles[part] = paint(M[part], colourOf[part]); normalizeTileSpec(tiles[part], `stage: art.materials.${part}`); }
  const wood = paint(M.wood, P.wood);
  normalizeTileSpec(wood, 'stage: art.materials.wood');
  const motif = { gen: 'frieze', pattern: X.pattern, ground: P.trim[1], figure: X.figure === 'accent' ? P.accent[3] : P.trim[3], relief: X.relief };
  normalizeTileSpec(motif, 'stage: art.motifs');
  if (!['plinth', 'cornice', 'both'].includes(X.on)) throw new Error("stage: art.motifs.on is 'plinth', 'cornice' or 'both'");
  const W2 = M.weathering || {}, unit01 = (v, at) => { if (v !== undefined && !(typeof v === 'number' && v >= 0 && v <= 1)) throw new Error(`stage: ${at} is a number from 0 to 1`); return v; };
  for (const k of ['earth', 'ivy', 'growth', 'litter', 'cracks']) unit01(W2[k], `art.materials.weathering.${k}`);
  if (A.lift !== undefined && !(A.lift >= 1 && A.lift <= 2)) throw new Error('stage: art.architecture.lift is a number from 1 to 2');
  return {
    tiles, proportions: A.proportions, vault: A.vault, lift: A.lift ?? 1, motif: { spec: motif, on: X.on },
    torch: rgbHex(P.light), atmosphere: { fog: At.fog, dust: At.dust, flicker: At.flicker },
    dress: { niche: A.niche, setPiece: Dd.setPiece, accent: { stone: { stone: P.accent[2], mortar: P.accent[0] } }, props: Dd.props, clusters: Dd.clusters, wood: { light: wood, dark: { ...wood, early: P.wood[2], late: P.wood[0] } },
      cobwebs: Dd.cobwebs, slab: unitRgb(P.trim[3]), earth: W2.earth ?? 0, ivy: W2.ivy ?? 0 },
    // the interceptors' dials: every plant at `growth`, the litter and the cracks; a direction rolled without them, none
    intercept: Object.fromEntries([...(W2.growth !== undefined ? ['grass', 'vines', 'creep', 'fungus'].map((k) => [k, W2.growth]) : []), ...(W2.litter !== undefined ? [['litter', W2.litter]] : []), ...(W2.cracks !== undefined ? [['cracks', W2.cracks]] : [])]),
  };
}

/** A kit with a direction applied: its tiles (recipe tiles still win, surface by surface), proportions, vault, dressing. */
export function kitWithArt(kit, kitId, art, allowedProportions, familyOf) {
  const C = compileArt(art, kitId), D = kit.dress;
  const props = proportionsOver(kit, kitId, C.proportions, allowedProportions, 'stage: art.architecture.proportions');
  const accentStone = { ...D.accent.stone, ...C.dress.accent.stone };
  return {
    kit: {
      ...kit, ...props, lift: C.lift, atmosphere: C.atmosphere, ...(Object.keys(C.intercept).length ? { intercept: C.intercept } : {}),
      motif: { family: familyOf(C.motif.spec), on: C.motif.on, tint: [1, 1, 1] },
      arch: kit.arch ? { ...kit.arch, vault: { ...kit.arch.vault, maxRise: C.vault.maxRise } } : kit.arch,
      torch: { ...(props.torch || kit.torch), color: C.torch },
      dress: {
        ...D,
        tomb: { ...D.tomb, kind: C.dress.setPiece },
        niches: { ...D.niches, ...C.dress.niche, ...(D.niches.slab ? { slab: C.dress.slab } : {}) },
        accent: { ...D.accent, stone: accentStone },
        props: { ...D.props, kinds: C.dress.props, clusters: C.dress.clusters, wood: C.dress.wood },
        cobwebs: { ...D.cobwebs, share: C.dress.cobwebs },
        ...(C.dress.earth > 0 ? { earth: { amount: C.dress.earth } } : {}),
        ...(C.dress.ivy > 0 ? { ivy: { tint: [0.5, 0.62, 0.48], amount: C.dress.ivy } } : {}),
      },
    },
    tiles: C.tiles,
  };
}

/** A direction's statuses, each item 'proposed', 'approved' or 'auto'. */
function statusOf(art, fill) {
  const s = { ...(art && typeof art === 'object' && art.status && typeof art.status === 'object' ? art.status : {}) };
  for (const item of ART_ITEMS) if (!STATUSES.includes(s[item])) s[item] = fill;
  return s;
}

/** A fresh seed: authoring time only (never inside a builder). */
export const freshArtSeed = () => randomInt(1, 2 ** 31 - 1);

/**
 * AUTHORING TIME: `art: 'propose'` (every item proposed), `'auto'` (hands off: rolled and marked auto), `{ seed }`
 * (rolled from that seed), or a stored direction whose items set to 'reroll' (or missing) are rolled afresh. Returns
 * the manifest with its direction as numbers; a manifest without `art`, or not a room stage, comes back as it was.
 */
export function resolveArt(manifest, fresh = freshArtSeed) {
  if (!manifest || manifest.kind !== 'stage' || manifest.art === undefined) return manifest;
  const kitId = manifest.kit || 'gothic-stone', a = manifest.art;
  if (a === 'propose' || a === 'auto' || (a && typeof a === 'object' && !ROLLED.some((k) => k in a))) {
    const seed = a && typeof a === 'object' && Number.isInteger(a.seed) ? a.seed : fresh();
    const status = statusOf(null, a === 'auto' ? 'auto' : 'proposed');
    return { ...manifest, art: { seed, ...rollArt(kitId, seed), status } };
  }
  if (typeof a === 'string') throw new Error(`stage: art is 'propose', 'auto', or a direction object (got '${a}')`);
  const redo = ROLLED.filter((k) => a[k] === 'reroll' || a[k] === undefined);
  if (!redo.length) return { ...manifest, art: { ...a, status: statusOf(a, 'proposed') } };
  const seed = fresh(), rolled = rollArt(kitId, seed, redo), status = statusOf(a, 'proposed');
  for (const k of redo) status[k] = 'proposed';
  return { ...manifest, art: { ...a, ...rolled, status } };
}

/** For a build without the authoring step (a test, a direct assemble): a string direction rolls from seed 1. */
export const artForBuild = (kitId, a) => (typeof a === 'string' || !ROLLED.some((k) => a && typeof a === 'object' && k in a)
  ? { ...rollArt(kitId, (a && a.seed) || 1) } : a);
