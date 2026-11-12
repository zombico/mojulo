/**
 * THE HALLS: every exhibit is asked for by `<hall>/<id>`, the way a museum or an encyclopedia is walked by wing.
 *
 *   science  physics, chemistry, energy and machines; the law-composed science worlds and the ladder
 *   space    the sky and the cosmos
 *   earth    water, weather and land
 *   life     cells, molecules, DNA and its processes
 *   math     the mathematics explainers
 *   history  the historic cultures at their period: a region's hub, a culture's entry, its record
 *
 * A card's hall is its family's (science → science, bio → life, math → math, entry → history) unless HALL_OVERRIDES
 * moves it to another wing by its id. A card of no exhibit family (compose_world's bases, the stage's kits and looks: family
 * `world`) has no hall: it is not an exhibit. An `<id>` keeps its card's own id, so a stored recipe, a search hit
 * (`source_ref`) and a hall id name the same card; a hall id lowers onto the manifest kind the card always minted, and
 * nothing already minted changes.
 *
 * Pure: the catalog and the ids to leave out (a kind folded into a science world) are handed in, never imported, so this
 * module reads no tool and no file. The doors are lib/mcp/tools/create-exhibit.js.
 */

export const HALLS = Object.freeze([
  { id: 'science', name: 'Science', about: 'physics, chemistry, energy and machines; the law-composed science worlds and the ladder' },
  { id: 'space', name: 'Space', about: 'the sky and the cosmos: stars, planets, comets, galaxies, gravitational waves' },
  { id: 'earth', name: 'Earth', about: 'water, weather and land: the atmosphere, oceans, rivers, waterfalls, storms, water power' },
  { id: 'life', name: 'Life', about: 'cells, molecules, DNA and its processes, the energy cycle' },
  { id: 'math', name: 'Mathematics', about: 'the mathematics explainers: algebra, geometry, calculus, series, probability' },
  { id: 'history', name: 'History', about: 'the historic cultures at their period: a region\'s hub, a culture\'s entry, its record' },
]);

export const HALL_IDS = Object.freeze(HALLS.map((h) => h.id));

/** A card family's hall. A family absent here (`world`) is not an exhibit. */
export const FAMILY_HALL = Object.freeze({ science: 'science', bio: 'life', math: 'math', entry: 'history' });

/** A card moved off its family's hall, by its id. */
export const HALL_OVERRIDES = Object.freeze({
  comet: 'space', galaxy: 'space', 'gravity-wave': 'space', pulsar: 'space', saturn: 'space', 'star-birth': 'space', 'star-surface': 'space',
  atmosphere: 'earth', aurora: 'earth', beach: 'earth', ocean: 'earth', river: 'earth', waterfall: 'earth', 'lightning-storm': 'earth', hydro: 'earth',
  'parallel-transport': 'math',
});

/** A card's hall ({ id, family, recipe? }), or null when it is no exhibit. A kept recipe (the book's, the cookbook's)
 * stands in the hall of the kind it keeps a setting of. */
export function hallOf(card) {
  if (!card || typeof card.id !== 'string') return null;
  const hall = FAMILY_HALL[card.family];
  if (!hall) return null;
  return HALL_OVERRIDES[card.id] ?? HALL_OVERRIDES[card.recipe?.kind] ?? hall;
}

/** A card's exhibit id, `<hall>/<id>`, or null when it is no exhibit. */
export function exhibitId(card) {
  const hall = hallOf(card);
  return hall ? `${hall}/${card.id}` : null;
}

/** `<hall>/<id>` → { hall, id }; a bare id (no known hall before the first slash) → { hall: null, id }. A history id
 * may hold a slash of its own (`history/giza/record`), so only a known hall is split off. */
export function splitExhibitId(s) {
  const str = String(s ?? '').trim();
  const at = str.indexOf('/');
  if (at > 0 && HALL_IDS.includes(str.slice(0, at))) return { hall: str.slice(0, at), id: str.slice(at + 1) };
  return { hall: null, id: str };
}

/**
 * The exhibits of a card catalog: exhibit id → card. `leave` names card ids that are no exhibit although their family
 * is (a kind folded into a science world: it renders its rows and answers by its old kind, never by a hall).
 */
export function exhibitCatalog(cards, { leave = [] } = {}) {
  const out = new Map(), skip = new Set(leave);
  for (const card of cards instanceof Map ? cards.values() : cards) {
    if (skip.has(card.id)) continue;
    const xid = exhibitId(card);
    if (xid) out.set(xid, card);
  }
  return out;
}

/**
 * Resolve what an agent passed (a hall id, or the bare id a search hit carries) against an exhibit catalog →
 * { id: '<hall>/<id>', hall, card }. An unknown or misfiled id throws, teaching: the right hall for a known card, or the
 * hall's ids, or the halls.
 */
export function resolveExhibit(s, catalog) {
  const { hall, id } = splitExhibitId(s);
  if (!id) throw new Error(`an exhibit id is '<hall>/<id>' (halls: ${HALL_IDS.join(', ')})`);
  const byBare = [...catalog.entries()].find(([, c]) => c.id === id);
  if (byBare) {
    const [xid, card] = byBare;
    const right = splitExhibitId(xid).hall;
    if (hall && hall !== right) throw new Error(`'${id}' is in the ${right} hall, not ${hall}: '${xid}'`);
    return { id: xid, hall: right, card };
  }
  if (hall) {
    const ids = [...catalog.keys()].filter((x) => x.startsWith(`${hall}/`) && catalog.get(x).index !== false);
    throw new Error(`no exhibit '${id}' in the ${hall} hall. Its exhibits: ${ids.join(', ')}`);
  }
  throw new Error(`no exhibit '${id}'. Exhibits are '<hall>/<id>' (halls: ${HALL_IDS.join(', ')}); list a hall with get_exhibit({ hall })`);
}
