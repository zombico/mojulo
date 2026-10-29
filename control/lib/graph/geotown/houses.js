/**
 * AN EVOCATION'S HOUSES — each structure a TYPE of the pattern's (pattern.js `types`): the pattern's style changed
 * (era/arch-style.js { from, … }), spoken as its own language (era/out-town.js townLanguage), dressed in its own
 * material words, standing its own storeys and wearing its own front (fronts.js). No two neighbours of a row share a
 * type; a semi pair is one building. Its materials are laid as the words' tiles whatever the cube's grit (a quiet cube's
 * town takes only their colours): an evocation spends its polygons and its texels on its few houses.
 *
 *   houseKits(P, styleId, cube, kitId, seed) → { kit(type) → { id, read, L, dress, band, front }, pick(R, prev) → type } | null
 *       null when the pattern names no types or the style is not a starter (a written style: one language, no types)
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

/** The pattern's house types on its style: each spoken and dressed once, and the dice that pick one for a structure. */
export function houseKits(P, styleId, cube, kitId, seed) {
  if (!P.types || typeof styleId !== 'string' || !STYLE_STARTERS[styleId]) return null;
  const ids = Object.keys(P.types), sStyle = structureStyle(kitId, seed), kits = new Map();
  const kit = (id) => {
    if (!kits.has(id)) {
      const T = P.types[id], S = readStyle({ from: styleId, read: T.read, ...(T.style ?? {}) }, `pattern.types.${id}.style`);
      kits.set(id, { id, read: T.read, L: townLanguage(sStyle, S.language.id ?? S.language.doc), dress: houseDress(S, cube), band: T.storeys ?? P.house.storeys, front: T.front ?? {} });
    }
    return kits.get(id);
  };
  const total = ids.reduce((a, id) => a + (P.types[id].weight ?? 1), 0);
  // a type by its weight, never the one before it in the row
  const pick = (R, prev = null) => {
    const pool = ids.filter((id) => id !== prev), sum = pool.reduce((a, id) => a + (P.types[id].weight ?? 1), 0) || total;
    let t = R() * sum;
    for (const id of pool) { t -= P.types[id].weight ?? 1; if (t <= 0) return id; }
    return pool[pool.length - 1] ?? ids[0];
  };
  return { kit, pick, sStyle };
}
