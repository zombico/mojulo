/**
 * WHAT A PLACE SHEDS, READ FROM WHAT IT IS MADE OF — a room's answer to the debris question when no one has written it
 * (era/skandart.js): every room declares its materials (its wall's, its upper wall's, its ceiling's tiles: a generator's
 * settings or a named tile) and, when its recipe says, its use. Each material sheds its own things (stone its spall and a
 * block, render its flakes, brick its bricks, concrete its chunks, boards their boards, timber its planks and splinters,
 * metal its sheets); a use leaves its own (an office its papers, a store its sherds). So a room never seen before, a
 * recipe's own tiles included, answers with what it is made of; a kit's card, or a recipe's, is the art direction over it.
 *
 *   MATERIALS        each matter: the words that name it in a tile, what it sheds from a wall and from a ceiling, and
 *                    whether what it sheds is heavy (heaps at its repose) or light (drifts: a skin of dust, carried)
 *   USES             what people leave behind, by the words of a room's use, and the vessels it kept (`vessels`)
 *   matterOfTile(tile)            → a matter id, or null (a floor's carpet, epoxy: nothing a wall sheds)
 *   deriveSkandart(kit, { use })  → a card { foot, corner, collapse?, heights?, spread?, derived: { wall, ceiling, use } }
 *                                   or null when nothing it is made of sheds
 * Pure: reads a kit's card, draws nothing.
 */
import { generatedSpecOf } from '../landscape/surface-textures.js';

const F = Object.freeze;

/** Each matter: the words a tile names it by (a generator's `gen` / `cut` / `style`, or a tile key), what it sheds. */
export const MATERIALS = F({
  render: F({ words: F(['render', 'stucco', 'plaster', 'limewash', 'lath']), weight: 'heavy',
    wall: F({ 'render-flake': 12 }), ceiling: F({ 'render-flake': 14, spall: 6 }) }),
  brick: F({ words: F(['brick']), weight: 'heavy', wall: F({ brick: 12, spall: 4 }), ceiling: F({ brick: 16, spall: 8 }) }),
  concrete: F({ words: F(['concrete', 'block', 'cinder', 'deck', 'slab']), weight: 'heavy',
    wall: F({ 'concrete-chunk': 12 }), ceiling: F({ 'slab-chunk': 20, 'concrete-chunk': 24, 'deck-sheet': 4 }) }),
  stone: F({ words: F(['stone', 'ashlar', 'dressed', 'rock', 'flagstone', 'marble', 'granite', 'sandstone', 'bluestone', 'shaft', 'cave', 'tufa']), weight: 'heavy',
    wall: F({ spall: 16, 'fallen-block': 1 }), ceiling: F({ 'breakdown-slab': 4, spall: 14 }) }),
  board: F({ words: F(['panel', 'board', 'gypsum', 'plasterboard', 'drywall']), weight: 'light', wall: F({ board: 3 }), ceiling: F({ board: 6 }) }),
  wood: F({ words: F(['wood', 'boards', 'timber', 'plank', 'log', 'bamboo']), weight: 'light',
    wall: F({ plank: 2, splinter: 6 }), ceiling: F({ beam: 2, plank: 4, splinter: 8 }) }),
  metal: F({ words: F(['plate', 'steel', 'hull', 'corrugated', 'metal', 'iron', 'tin']), weight: 'light',
    wall: F({ 'deck-sheet': 1 }), ceiling: F({ 'deck-sheet': 6 }) }),
  slate: F({ words: F(['slate']), weight: 'light', wall: F({ slate: 4 }), ceiling: F({ slate: 10 }) }),
  glass: F({ words: F(['glass', 'glazed']), weight: 'light', wall: F({ 'glass-shard': 10 }), ceiling: F({ 'glass-shard': 16 }) }),
});
// (the order a tile's words are tried in: the most particular first, so a 'concrete-board' reads as board, a ceiling of
// 'boards' as wood, a dressed 'render' as render over the stone behind it)
const ORDER = F(['glass', 'slate', 'brick', 'render', 'wood', 'board', 'metal', 'concrete', 'stone']);

/** What people leave behind, by the words of a room's use. */
export const USES = F([
  F({ words: F(['lab', 'office', 'library', 'archive', 'school', 'clinic', 'hospital', 'study', 'records', 'control']), leave: F({ paper: 8 }) }),
  F({ words: F(['store', 'shop', 'kitchen', 'tavern', 'market', 'pantry', 'cellar', 'granary']), leave: F({ sherd: 6 }), vessels: F({ kinds: F({ pot: 3, jar: 2, basket: 2, barrel: 1 }), every: 2 }) }),
  F({ words: F(['workshop', 'forge', 'mill', 'warehouse', 'hangar', 'depot', 'barn', 'stable', 'shed']), leave: F({ splinter: 6 }), vessels: F({ kinds: F({ crate: 4, barrel: 2, keg: 1, chest: 1 }), every: 3 }) }),
]);

/** A tile's matter: its generator's settings read first (gen, cut, style, face), then its key; null if nothing sheds. */
export function matterOfTile(tile) {
  if (!tile) return null;
  const S = tile.family ? generatedSpecOf(`${tile.family}-a`) : null;
  // (a 'stone-brick' is cut stone laid in courses: stone, not brick)
  // (a named family, 'stone-wall-bluestone', is read by its name as a key is)
  const said = [S?.gen, S?.cfg?.cut, S?.cfg?.style, tile.key, S ? null : tile.family].filter((w) => typeof w === 'string').join(' ').toLowerCase().replace('stone-brick', 'stone');
  if (!said) return null;
  // (a dressed wall in render is render over stone: what it sheds is its coat first, the stone behind it after)
  for (const m of ORDER) if (MATERIALS[m].words.some((w) => said.includes(w))) return m;
  return null;
}

const addRows = (into, rows, k = 1) => { for (const [id, n] of Object.entries(rows)) into[id] = Math.max(into[id] ?? 0, Math.round(n * k)); return into; };

/** A kit's answer, read from what it is made of and, given one, its use. → a card, or null if nothing it is made of sheds. */
export function deriveSkandart(kit, { use = null } = {}) {
  const T = kit?.tiles || {};
  const walls = [T.wall, T.wallUpper, T.upper].map(matterOfTile).filter(Boolean), ceiling = matterOfTile(T.ceiling);
  // (a dressed wall in render sheds its coat and the stone behind it)
  const behind = T.wall?.family && generatedSpecOf(`${T.wall.family}-a`)?.cfg?.cut === 'render' ? ['stone'] : [];
  const wallMs = [...new Set([...walls, ...behind])];
  if (!wallMs.length && !ceiling) return null;
  const foot = {}, corner = {};
  for (const m of wallMs) { addRows(foot, MATERIALS[m].wall); addRows(corner, MATERIALS[m].wall, 1.2); }
  const usedBy = typeof use === 'string' ? USES.find((U) => U.words.some((w) => use.toLowerCase().includes(w))) : null;
  if (usedBy) { addRows(foot, usedBy.leave); addRows(corner, usedBy.leave, 0.8); }
  if (!Object.keys(foot).length) return null;
  const light = wallMs.every((m) => MATERIALS[m].weight === 'light');
  return {
    foot: { why: `its walls are ${wallMs.join(' and ')}: what they shed lies at their feet${usedBy ? `, with what its use leaves` : ''}`, pieces: foot },
    corner: { why: 'what falls is pushed into the corners', pieces: corner },
    ...(ceiling ? { collapse: { why: `where its roof comes down, its ${ceiling} lies under the hole`, pieces: { ...MATERIALS[ceiling].ceiling }, spread: 2.4 } } : {}),
    // (light things drift: a skin of dust, carried past it; heavy things heap at their repose)
    ...(light ? { heights: { foot: [0.03, 0.12], corner: [0.06, 0.24], cone: [0.3, 0.7] }, spread: 1.2 } : { heights: { cone: [0.3, 0.8] } }),
    // (what its use stored, era/skandart-vessels.js: a store's pots and jars, a workshop's crates)
    ...(usedBy?.vessels ? { vessels: usedBy.vessels } : {}),
    derived: { wall: wallMs, ceiling, ...(usedBy ? { use } : {}) },
  };
}
