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

export const ART_ITEMS = Object.freeze(['palette', 'materials', 'architecture', 'motifs', 'plan']);
const ROLLED = ['palette', 'materials', 'architecture', 'motifs'];
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
      wall: { gen: 'stone-brick', rows: [4, 7, 'i'], cols: [3, 5, 'i'], radius: [0.08, 0.35], shadow: [0.3, 0.7], mortarThick: [0.06, 0.12], bevel: [0.15, 0.3], vary: [18, 32], grain: [8, 14], accent: [0.08, 0.18], jointDepth: [0.4, 0.75], grime: [0.3, 0.6], chips: [0.2, 0.45] },
      floor: { gen: 'flagstone', cells: [3, 5, 'i'], wobble: [1, 3], vary: [16, 28], grain: [8, 16], cracked: [0.15, 0.4], lost: [0.04, 0.14] },
      ceiling: { gen: 'rock', style: 'cave', amp: [14, 26], crackFreq: [4, 8], crackWidth: [0.01, 0.025], crackDepth: [0.08, 0.2], speckle: [0.02, 0.08] },
      trim: { gen: 'rock', style: 'slate', amp: [16, 26] },
      wood: { gen: 'wood', ringFreq: [8, 12, 'i'], streakAmt: [0.08, 0.16], mottle: [3, 6] },
    },
    architecture: { plinth: { h: [0.45, 0.8] }, cornice: { h: [0.3, 0.55] }, pilaster: { w: [0.55, 0.85], out: [0.2, 0.32] }, rib: { w: [0.35, 0.55], drop: [0.3, 0.45] }, door: { height: [3, 3.6] }, vaultRise: [2.2, 3.4] },
    motifs: { niche: { head: ['round', 'round', 'flat'], tiers: [1, 2], urns: [0.15, 0.4] }, accent: 'ashlar', props: ['crate', 'barrel', 'planks', 'stones', 'boulder', 'debris'], round: ['barrel'], cobwebs: [0.35, 0.65] },
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
      wall: { gen: 'rock', style: 'cave', amp: [30, 48], crackFreq: [6, 10], crackWidth: [0.02, 0.04], crackDepth: [0.25, 0.4], speckle: [0.06, 0.16] },
      floor: { gen: 'flagstone', cells: [3, 5, 'i'], wobble: [1.5, 3.5], vary: [20, 30], grain: [10, 16], cracked: [0.25, 0.45], lost: [0.1, 0.2] },
      ceiling: { gen: 'rock', style: 'cave', amp: [22, 34], crackFreq: [5, 9], crackWidth: [0.02, 0.035], crackDepth: [0.2, 0.35], speckle: [0.06, 0.12] },
      trim: { gen: 'rock', style: 'cave', amp: [20, 30], crackFreq: [6, 9], crackWidth: [0.015, 0.03], crackDepth: [0.15, 0.3], speckle: [0.04, 0.1] },
      wood: { gen: 'wood', ringFreq: [8, 12, 'i'], streakAmt: [0.1, 0.18], mottle: [3, 6] },
    },
    architecture: { plinth: { h: [0.25, 0.45] }, cornice: { h: [0.2, 0.3] }, pilaster: { w: [0.5, 0.7], out: [0.12, 0.22] }, rib: { w: [0.4, 0.6], drop: [0.15, 0.3] }, door: { height: [3, 3.3] }, vaultRise: [1.6, 2.6] },
    motifs: { niche: { head: ['flat'], tiers: [3, 4], urns: [0.06, 0.18], sealed: [0.25, 0.55] }, accent: 'ossuary', props: ['amphora', 'bones', 'stones', 'debris', 'planks'], round: ['amphora', 'bones'], cobwebs: [0.3, 0.55] },
  },
});
export const ART_KITS = Object.freeze(Object.keys(ART_RAILS));
const railsOf = (kitId) => {
  const R = ART_RAILS[kitId];
  if (!R) throw new Error(`stage: art direction is offered for the room kits ${ART_KITS.join(', ')} (got '${kitId}')`);
  return R;
};

/** Each item's roll: a pure function of the kit and that item's seed. */
const ROLL = {
  palette(R, seed) {
    const d = dice(seed), fam = d.pick(R.stone), h = d.n(fam.h), s = d.n(fam.s), l = d.n(fam.l);
    // blue and orange are opposite on the wheel (any hue path between them runs through purple or green), so a ramp
    // leans warm by mixing toward an earth ramp in RGB, stop by stop
    const mixR = (a, b, t) => a.map((c, i) => c.map((v, k) => Math.round(v + (b[i][k] - v) * t)));
    let accent;
    if (R.accent.bone) { const b = R.accent.bone; accent = ramp(d.n(b.h), d.n(b.s), d.n(b.l), [0.3, 0.14]); }
    // the accent pulled toward warm earth and darker: a stone that reads as other (the floor leans warm less far)
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
      const spec = {};
      for (const [k, v] of Object.entries(rail)) spec[k] = Array.isArray(v) ? (v[2] === 'i' ? d.i(v) : d.n(v)) : v;
      spec.seed = d.i([1, 99999]);
      out[part] = spec;
    }
    return out;
  },
  architecture(R, seed) {
    const d = dice(seed), A = R.architecture, proportions = {};
    for (const [part, nums] of Object.entries(A)) if (part !== 'vaultRise') proportions[part] = Object.fromEntries(Object.entries(nums).map(([k, v]) => [k, d.n(v)]));
    return { seed, proportions, vault: { maxRise: d.n(A.vaultRise) } };
  },
  motifs(R, seed) {
    const d = dice(seed), M = R.motifs;
    // four or five kinds of corner things, always one turned round (a barrel, a jar): shuffled, so the mix differs
    const pool = M.props.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(d.R() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const n = d.i([4, Math.min(5, pool.length)]);
    const kinds = pool.slice(0, n);
    if (!kinds.some((k) => M.round.includes(k))) kinds[n - 1] = M.round[0];
    return {
      seed,
      niche: { head: d.pick(M.niche.head), tiers: d.i(M.niche.tiers), urns: d.n(M.niche.urns), ...(M.niche.sealed ? { sealed: d.n(M.niche.sealed) } : {}) },
      accent: M.accent, props: kinds, cobwebs: d.n(M.cobwebs),
    };
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

/**
 * What a direction means to the builder: `tiles` (tile specs, coloured from the palette), `proportions`, the vault's
 * rise, and dressing overrides (the niche, the accent, the corner things and their wood, cobwebs, the torch's colour).
 * Every number is checked against its rail here; a direction outside them is refused with the range it broke.
 */
export function compileArt(art, kitId) {
  railsOf(kitId);
  if (!art || typeof art !== 'object' || Array.isArray(art)) throw new Error("stage: art is 'propose', 'auto', or { palette, materials, architecture, motifs, status }");
  for (const item of ROLLED) if (!art[item] || typeof art[item] !== 'object') throw new Error(`stage: art.${item} is missing (set art.${item} to 'reroll' at create_sketch / update_sketch to roll one)`);
  const P = art.palette, M = art.materials, A = art.architecture, X = art.motifs;
  for (const k of ['stone', 'floor', 'vault', 'trim', 'wood', 'accent']) if (!Array.isArray(P[k]) || P[k].length !== 5) throw new Error(`stage: art.palette.${k} is a ramp of five [r, g, b] stops, darkest first`);
  const { seed: _s, ...m } = M;
  const paint = {
    'stone-brick': (ramp2) => ({ stone: ramp2[2], mortar: ramp2[0] }),
    flagstone: (ramp2) => ({ stone: ramp2[2], mortar: ramp2[0], gravel: ramp2[1] }),
    rock: (ramp2) => ({ base: ramp2[2] }),
    wood: (ramp2) => ({ early: ramp2[3], late: ramp2[1] }),
  };
  const colourOf = { wall: P.stone, floor: P.floor, ceiling: P.vault, trim: P.trim, wood: P.wood };
  const tiles = {};
  for (const part of ['wall', 'floor', 'ceiling', 'trim']) {
    const spec = { ...m[part], ...paint[m[part].gen](colourOf[part]) };
    normalizeTileSpec(spec, `stage: art.materials.${part}`);
    tiles[part] = spec;
  }
  const wood = { ...m.wood, ...paint.wood(P.wood) };
  normalizeTileSpec(wood, 'stage: art.materials.wood');
  const darkWood = { ...wood, early: P.wood[2], late: P.wood[0] };
  // the accent wall's stone (ashlar) or bone (an ossuary's courses), painted from the accent ramp
  const accent = { stone: { stone: P.accent[2], mortar: P.accent[0] } };
  return {
    tiles, proportions: A.proportions, vault: A.vault,
    torch: rgbHex(P.light),
    dress: { niche: X.niche, accent, props: X.props, wood: { light: wood, dark: darkWood }, cobwebs: X.cobwebs, slab: unitRgb(P.trim[3]) },
  };
}

/** A kit with a direction applied: its tiles (recipe tiles still win, surface by surface), proportions, vault, dressing. */
export function kitWithArt(kit, kitId, art, allowedProportions) {
  const C = compileArt(art, kitId), D = kit.dress;
  const props = proportionsOver(kit, kitId, C.proportions, allowedProportions, 'stage: art.architecture.proportions');
  const accentStone = { ...D.accent.stone, ...C.dress.accent.stone };
  return {
    kit: {
      ...kit, ...props,
      arch: kit.arch ? { ...kit.arch, vault: { ...kit.arch.vault, maxRise: C.vault.maxRise } } : kit.arch,
      torch: { ...(props.torch || kit.torch), color: C.torch },
      dress: {
        ...D,
        niches: { ...D.niches, ...C.dress.niche, ...(D.niches.slab ? { slab: C.dress.slab } : {}) },
        accent: { ...D.accent, stone: accentStone },
        props: { ...D.props, kinds: C.dress.props, wood: C.dress.wood },
        cobwebs: { ...D.cobwebs, share: C.dress.cobwebs },
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
