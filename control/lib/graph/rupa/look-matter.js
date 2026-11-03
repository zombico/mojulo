/**
 * rupa/look-matter.js — what a thing is made of, read off how it LOOKS, so its matter agrees with its skin: a stone-brick
 * wall is stone, an adobe one adobe, a board wall pine. A world painted by a geocube says what its things are made of by
 * role; where it names nothing this reads it off the cube's own look (era/geocube.js cubeMatter). rupa is the internal
 * name.
 *
 *   ROLES            the roles a cube's matter is given by: wall, floor, accent, trim, roof, ground, wood, metal, glass,
 *                    structure (its landmarks: painted from its stone, so stone unless the cube says otherwise)
 *   CLASS_ROLE       which role a breakable class takes its matter from (a wall and a pilaster the wall's, a set piece
 *                    and a boulder the accent's, a door the wood's, lockers and a rack the metal's, glass the glass's);
 *                    a class not here keeps its own (CLASS_MATTER: a crate's planks, a pot's clay)
 *   TILE_MATTER      a surface tile's generator → matter (landscape/surface-textures.js: stone-brick, flagstone, rock,
 *                    frieze stone; wood timber); a dressed tile by its cut (boards pine, brick brick, tile clay, …)
 *   WORD_MATTER      an architectural material word → matter (era/arch-style.js MATERIAL_WORDS), each with its reason
 *   KIT_MATTER       an interior kit → its walls', floors' and metal's matter
 *   matterOfTile(tile) · matterOfWord(word) → { matter, fill?, why } | null
 *   readRoleMatter(spec, where) → { matter, fill?, porosity? } checked (an id, or the object)
 *   SUBSTRATE_MATTER what each of the land's grounds is (era/substrate.js: soil, sand, scree, bedrock, wet, path)
 *   groundOfShares(shares) → the matter of the land's commonest ground (its shares, the cube's readout), or null
 *
 * The words' matters are the nearest in the table, said so where it is a stand-in (asphalt has no row: concrete stands for
 * it; thatch is reed: pine at a third, which burns as it should).
 */
import { MATTER, resolveMatter } from './matter.js';

export const ROLES = Object.freeze(['wall', 'floor', 'accent', 'trim', 'roof', 'ground', 'wood', 'metal', 'glass', 'structure']);

export const CLASS_ROLE = Object.freeze({
  wall: 'wall', pilaster: 'wall', 'set-piece': 'accent', boulder: 'accent', lid: 'accent',
  door: 'wood', lockers: 'metal', rack: 'metal', glass: 'glass',
});

const T = (matter, why, fill) => Object.freeze({ matter, why, ...(fill ? { fill } : {}) });
export const TILE_MATTER = Object.freeze({
  'stone-brick': T('stone', 'its tile is stone-brick'), flagstone: T('stone', 'its tile is flagstone'),
  rock: T('stone', 'its tile is rock'), frieze: T('stone', 'its tile is a carved frieze'), wood: T('timber', 'its tile is wood'),
});
// a dressed tile (a material word's) by its cut
const DRESSED_CUT = Object.freeze({
  boards: T('pine', 'its tile is boards'), brick: T('brick', 'its tile is brick'), tile: T('ceramic', 'its tile is clay tile'),
  slate: T('stone', 'its tile is slate'), gravel: T('gravel', 'its tile is gravel'), setts: T('stone', 'its tile is setts'),
  render: T('stone', 'its tile is a render over stone'),
});

export const WORD_MATTER = Object.freeze({
  limewash: T('stone', 'limewash over rubble: stone'), 'lime-render': T('stone', 'lime render over coursed stone'),
  ashlar: T('stone', 'ashlar is squared stone'), rubble: T('stone', 'rubble is rough stone'),
  'hand-brick': T('brick', 'hand-made brick'), adobe: T('adobe', 'mud brick'), boards: T('pine', 'upright boards'),
  'clay-tile': T('ceramic', 'fired clay tiles'), slate: T('stone', 'slate'), shingle: T('pine', 'split timber shingles'),
  thatch: T('pine', 'reed thatch: pine at a third stands for it (it burns as it should)', 0.33),
  flags: T('stone', 'flagstones'), setts: T('stone', 'setts are stone'), earth: T('loam', 'beaten earth'),
  'brick-paving': T('brick', 'floor bricks'), 'stone-road': T('stone', 'field stones'), gravel: T('gravel', 'gravel'),
  'wire-brick': T('brick', 'wire-cut brick'), stucco: T('concrete', 'a cement coat over block'),
  'sawn-stone': T('stone', 'sawn stone'), precast: T('concrete', 'precast concrete'), concrete: T('concrete', 'concrete'),
  glass: T('glass', 'glass'), pavement: T('concrete', 'concrete paving'), asphalt: T('concrete', 'asphalt: concrete stands for it'),
});

export const KIT_MATTER = Object.freeze({
  'gothic-stone': { wall: T('stone', 'its rooms are a gothic stone kit'), floor: T('stone', 'its rooms are a gothic stone kit') },
  catacomb: { wall: T('stone', 'its rooms are a catacomb kit'), floor: T('stone', 'its rooms are a catacomb kit') },
  'research-lab': { wall: T('concrete', 'its rooms are a research lab kit'), floor: T('concrete', 'its rooms are a research lab kit'), metal: T('steel', 'its rooms are a research lab kit') },
});

export function matterOfTile(tile) {
  if (!tile || typeof tile !== 'object') return null;
  if (tile.gen === 'dressed') return DRESSED_CUT[tile.params?.cut ?? tile.cut] ?? T('stone', 'its tile is dressed stone');
  return TILE_MATTER[tile.gen] ?? null;
}

export const matterOfWord = (word) => (typeof word === 'string' ? WORD_MATTER[word] ?? null : null);

export function readRoleMatter(spec, where = 'matter') {
  const s = typeof spec === 'string' ? { matter: spec } : spec;
  if (!s || typeof s !== 'object' || Array.isArray(s) || s.matter === undefined) throw new Error(`${where} is a matter's name or { matter, fill?, porosity? }`);
  for (const k of Object.keys(s)) if (!['matter', 'fill', 'porosity', 'why'].includes(k)) throw new Error(`${where}.${k} is not one of matter, fill, porosity`);
  const m = resolveMatter(s.matter, `${where}.matter`);
  if (m.family === 'liquid' || m.family === 'gas') throw new Error(`${where}: ${m.id} is a ${m.family}, nothing is built of it`);
  if (s.fill !== undefined && !(s.fill > 0 && s.fill <= 1)) throw new Error(`${where}.fill is the solid share, above 0 and at most 1`);
  if (s.porosity !== undefined && !(s.porosity >= 0 && s.porosity < 1)) throw new Error(`${where}.porosity is the open share, 0 to under 1`);
  return { matter: typeof s.matter === 'string' ? s.matter : m, ...(s.fill !== undefined ? { fill: s.fill } : {}), ...(s.porosity !== undefined ? { porosity: s.porosity } : {}) };
}

export const DEFAULT_ROLE = Object.freeze({
  wood: T('timber', 'the default for what is wood'), metal: T('steel', 'the default for what is metal'), glass: T('glass', 'the default for what is glass'),
  structure: T('stone', 'its structures are painted from its stone'),
});

// the land's grounds (era/substrate.js) as matter: earth deep enough to root in is loam, a beach or a dune sand, fallen
// rock gravel, bare rock stone, a stream's bank clay (mud is a liquid here), a walked trail packed gravel
export const SUBSTRATE_MATTER = Object.freeze({
  soil: T('loam', 'its land is soil'), sand: T('sand', 'its land is sand'), scree: T('gravel', 'its land is scree'),
  bedrock: T('stone', 'its land is bare rock'), wet: T('clay', 'its land is wet ground'), path: T('gravel', 'its land is a walked path'),
});
export function groundOfShares(shares) {
  if (!shares || typeof shares !== 'object') return null;
  // the commonest ground off the path (a crater is dug where the land is, not only on the trail)
  const best = Object.entries(shares).filter(([k, v]) => k !== 'path' && SUBSTRATE_MATTER[k] && v > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  return best ? SUBSTRATE_MATTER[best[0]] : null;
}
export const isMatter = (id) => typeof id === 'string' && !!MATTER[id];
