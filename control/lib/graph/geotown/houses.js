/**
 * AN EVOCATION'S BUILDINGS — each house a TYPE of the pattern's (pattern.js `types`): the pattern's style changed
 * (era/arch-style.js { from, … }), spoken as its own language (era/out-town.js townLanguage), dressed in its own
 * material words, standing its own storeys and wearing its own front (fronts.js). No two neighbours of a row share a
 * type; a semi pair is one building. Its materials are laid as the words' tiles whatever the cube's grit (a quiet cube's
 * town takes only their colours): an evocation spends its polygons and its texels on its few houses.
 *
 *   buildingKits(P, styleId, cube, kitId, seed) → { kit(kind, id), pick(kind, R, prev), sStyle, typed }: every row
 *       kind's buildings (a house's type, a shop's brick and awning, a walk-up), each its own language and dress
 *   houseDress(S, cube)  → { <surface group>: { spec?, metres?, colour?, roof? } }: a style's words as tiles and colours
 *
 * Pure; the dice are the caller's.
 */
import { readStyle, materialContext, wordTile, MATERIAL_WORDS, STYLE_STARTERS } from '../era/arch-style.js';
import { townLanguage } from '../era/out-town.js';
import { structureStyle } from '../era/out-structures.js';

// the town's surface groups each style surface dresses (era/arch-style.js styleTownDress), and each tile's seed
const GROUPS = { plaster: ['str:plaster'], stone: ['str:stone'], timber: ['str:timber'], shell: ['str:shell'], paint: ['str:paint'], plinth: ['plinth'], roof: ['str:tile', 'str:slate', 'str:shingle', 'str:thatch'] };
const SEEDS = { 'str:plaster': 23, 'str:stone': 29, plinth: 31, 'str:shell': 37, 'str:timber': 41, 'str:tile': 43, 'str:slate': 47, 'str:shingle': 53, 'str:thatch': 59, 'str:paint': 61 };

/** A style's words dressed as tiles (and its colours), whatever the cube's grit. */
export function houseDress(S, cube) {
  const X = materialContext(cube), out = {};
  for (const [surface, groups] of Object.entries(GROUPS)) {
    const w = S.materials[surface], colour = S.palette[surface] ?? (w ? MATERIAL_WORDS[w].colour : null);
    if (!w && !colour) continue;
    for (const g of groups) {
      const T = w ? wordTile(w, X, SEEDS[g]) : null;
      const e = { ...(T ? { spec: T.spec, metres: T.metres } : {}), ...(surface === 'roof' ? { roof: true } : {}), ...(colour ? { colour } : {}) };
      if (e.spec || e.colour) out[g] = e;
    }
  }
  return out;
}

// a shop's awning and its sign, by its kit's number
const AWNINGS = ['#2f5d50', '#7a2e2e', '#2e4a7a', '#b8892e', '#4a4f55', '#6a3a5a'];
const SIGNS = ['#1f2a33', '#3a2a1f', '#e8e0cc', '#24382a', '#5a1f1f', '#2a2f45'];

/** The buildings of an evocation's rows, each kind's kits spoken and dressed once, and the dice that pick one for a
 *  building: a houses row the pattern's TYPES on its style (when the style is a starter; a written style is one
 *  language, no types), a shop row its own brick each (its `palettes`, the main-street style's) with its own awning and
 *  sign, a walk-up its style. → { kit(kind, id) → { id, kind, use, read?, L, dress, band, front, awning?, sign? } | null,
 *  pick(kind, R, prev) → id, sStyle } */
export function buildingKits(P, styleId, cube, kitId, seed) {
  const sStyle = structureStyle(kitId, seed), cache = new Map(), typed = !!P.types && typeof styleId === 'string' && !!STYLE_STARTERS[styleId];
  const make = (key, spec, at, extra) => {
    if (!cache.has(key)) { const S = readStyle(spec, at); cache.set(key, { id: key, L: townLanguage(sStyle, S.language.id ?? S.language.doc), dress: houseDress(S, cube), ...extra }); }
    return cache.get(key);
  };
  const kit = (kind, id) => {
    if (kind === 'houses') {
      if (!typed) return null;
      const T = P.types[id];
      return make(`houses:${id}`, { from: styleId, read: T.read, ...(T.style ?? {}) }, `pattern.types.${id}.style`, { kind, type: id, use: 'dwelling', read: T.read, band: T.storeys ?? P.house.storeys, front: T.front ?? {} });
    }
    const K = P.rows[kind], n = Number(id) || 0;
    if (kind === 'shops') return make(`shops:${n}`, { from: K.style, palette: { stone: K.palettes[n % K.palettes.length] } }, `pattern.rows.shops`, { kind, type: `shop-${n}`, use: K.use, band: K.storeys, front: K.front ?? {}, awning: AWNINGS[n % AWNINGS.length], sign: SIGNS[(n * 3 + 1) % SIGNS.length] });
    return make(`${kind}:0`, K.style, `pattern.rows.${kind}`, { kind, type: kind, use: K.use, band: K.storeys, front: K.front ?? {}, accent: true });
  };
  const ids = (kind) => (kind === 'houses' ? (typed ? Object.keys(P.types) : ['0']) : kind === 'shops' ? P.rows.shops.palettes.map((_, i) => String(i)) : ['0']);
  const weight = (kind, id) => (kind === 'houses' && typed ? P.types[id].weight ?? 1 : 1);
  // a kit by its weight, never the one before it in the row
  const pick = (kind, R, prev = null) => {
    const all = ids(kind), pool = all.length > 1 ? all.filter((id) => id !== prev) : all, sum = pool.reduce((a, id) => a + weight(kind, id), 0);
    let t = R() * sum;
    for (const id of pool) { t -= weight(kind, id); if (t <= 0) return id; }
    return pool[pool.length - 1];
  };
  return { kit, pick, sStyle, typed };
}
