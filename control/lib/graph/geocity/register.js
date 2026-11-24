/**
 * THE OUTSKIRTS' REGISTER — how a metro's outskirts read from its streets when they are massing (geocity/scene.js: the
 * houses, shops, walk-ups and low-rises it stands outside the blocks it evokes, its street trees, the words its walls are
 * finished in). It is its outskirts pattern's (geotown/pattern.js PATTERNS, the metro's `outskirts`): the card that
 * builds its evoked blocks house by house says, in its `metro` block, how the same neighbourhoods read as massing, so a
 * west-coast tract's stucco and palms are the metro's out to its edge and not the evoked block's alone. A card with no
 * `metro` block reads as the metro always has (the streetcar suburb's: brick pairs under gables, maples).
 *
 *   OUTSKIRTS_LOOK      the look a card with no `metro` block reads as: the numbers geocity/scene.js stood its outskirts by
 *   outskirtsLook(P)    → the look of a pattern card P (its `metro` block over OUTSKIRTS_LOOK): { house: { form, pitch,
 *                         most, pair, gap, far }, walls, roofs, shops, flats, trees: { dense, low }, finishes }
 *
 *   house.form   'gable' (its gable to the street, the ridge into the block), 'hip' (a low hip, eaves all round) or
 *                'flat' (a parapet over a flat roof)
 *   house.pitch  the roof's rise over the house's frontage (a gable's 0.32: steep; a ranch's hip low)
 *   house.most   the most storeys a house stands, whatever its corridor lifts the block's others to
 *   house.pair   a house mass's frontage (a semi pair's, or one detached house's), `gap` between masses
 *   house.far    a far town's house as the skyline sees it: a box this tall (m) on its pad
 *   walls        the walls' colours (a house's, a converted shop's), one by the block's dice
 *   roofs        the roofs' colours (three at least), the third the flat roofs' (a shop's, a low-rise's)
 *   shops        a shop row's fronts
 *   flats        a walk-up's and a low-rise's walls (null: the grammar's brick, as before)
 *   trees        the street trees' species, `dense` along a close-built arterial, `low` along an outskirts street
 *   finishes     a group's material word over the metro's own (`geocity:house` its stucco)
 *
 * Pure: data and a reader.
 */
import { SPECIES } from '../vegetation/species.js';
import { MATERIAL_WORDS } from '../era/arch-style.js';

export const OUTSKIRTS_LOOK = Object.freeze({
  house: Object.freeze({ form: 'gable', pitch: 0.32, most: 3, pair: 13.6, gap: 1.4, far: 8 }),
  walls: Object.freeze(['#a3563f', '#b5654a', '#9c4b36', '#c9a57a', '#d2c3a8', '#8c5a44']),
  roofs: Object.freeze(['#4a4f55', '#5b4a3f', '#3f4448', '#6a5a4c']),
  shops: Object.freeze(['#8a3a2e', '#3e5e3a', '#24405e', '#6e5a3a', '#7a2e4a']),
  flats: null,
  trees: Object.freeze({ dense: Object.freeze(['maple', 'beech']), low: Object.freeze(['maple', 'cherry']) }),
  finishes: Object.freeze({}),
});
export const HOUSE_FORMS = Object.freeze(['gable', 'hip', 'flat']);
// the groups a register may finish in its own word (the outskirts' masses)
export const REGISTER_GROUPS = Object.freeze(['geocity:house', 'geocity:shops', 'geocity:avenue', 'geocity:lowrise', 'geocity:walkup', 'geocity:school', 'geocity:low']);

const HEX = /^#[0-9a-f]{6}$/i;
const hexes = (v, at, least = 1) => { if (!Array.isArray(v) || v.length < least || !v.every((h) => typeof h === 'string' && HEX.test(h))) throw new Error(`outskirts look: ${at} is a list of colours (#rrggbb)`); return Object.freeze([...v]); };

/** A pattern card's outskirts look: its `metro` block over the streetcar suburb's; a card with none reads as before. */
export function outskirtsLook(P) {
  const M = P && P.metro;
  if (!M) return OUTSKIRTS_LOOK;
  const L = OUTSKIRTS_LOOK, house = { ...L.house, ...(M.house ?? {}) };
  if (!HOUSE_FORMS.includes(house.form)) throw new Error(`outskirts look: house.form is ${HOUSE_FORMS.join(', ')}`);
  if (!(house.pitch >= 0 && house.pitch <= 0.6) || !(Number.isInteger(house.most) && house.most >= 1 && house.most <= 3) || !(house.pair >= 6 && house.pair <= 30) || !(house.gap >= 0 && house.gap <= 12) || !(house.far >= 3 && house.far <= 12)) throw new Error('outskirts look: house is { form, pitch: 0–0.6, most: 1–3 storeys, pair: 6–30 m, gap: 0–12 m, far: 3–12 m }');
  const trees = { ...L.trees, ...(M.trees ?? {}) };
  for (const k of ['dense', 'low']) if (!Array.isArray(trees[k]) || !trees[k].length || !trees[k].every((s) => SPECIES[s])) throw new Error(`outskirts look: trees.${k} is a list of species (vegetation/species.js)`);
  const finishes = M.finishes ?? {};
  for (const [g, w] of Object.entries(finishes)) if (!REGISTER_GROUPS.includes(g) || !MATERIAL_WORDS[w]) throw new Error(`outskirts look: finishes.${g} is a material word on one of ${REGISTER_GROUPS.join(', ')}`);
  return Object.freeze({
    house: Object.freeze(house),
    walls: M.walls ? hexes(M.walls, 'walls') : L.walls, roofs: M.roofs ? hexes(M.roofs, 'roofs', 3) : L.roofs,
    shops: M.shops ? hexes(M.shops, 'shops') : L.shops, flats: M.flats ? hexes(M.flats, 'flats') : null,
    trees: Object.freeze({ dense: Object.freeze([...trees.dense]), low: Object.freeze([...trees.low]) }),
    finishes: Object.freeze({ ...finishes }),
  });
}
