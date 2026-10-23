/**
 * THE GAME'S JUICE — how its effects (the attacks, the blasts, the puffs, a battle's beats) are drawn and timed, read
 * off what the game already is: the effects' floor composed (scene/juice-style.js) from
 *
 *   register   the game's visual register, anime | western: the character book's direction when it names one, else
 *              the kit's pole as the colour theorist leaves it (banded is anime, material western: cast-setting.js)
 *   flavor     its game type's animation (feel/flavor.js): the template it plays (its feel's base), else its genre's
 *              (flavorFor, GENRE_FLAVOR), else realistic
 *
 *   juice?: 'auto' | false | { register?, flavor?, …dials }   the world's word (world.js reads its shape); a word it
 *            leaves out is the game's own. Absent: the effects are as they always were (nothing laid)
 *
 *   juiceOfGame(G)       → { fxStyle, from: { register, flavor }, why } every level's `fxStyle`, or null (no juice word, or false)
 *   juiceSuggestion(G)   → the same for a world that writes none: what `juice: 'auto'` would lay (design_game's readout)
 *
 * Pure.
 */
import { settingOfGame } from './cast-setting.js';
import { flavorFor } from './feel/flavor.js';
import { POLES } from './feel/cards.js';
import { QUICK_GENRE } from './intent.js';
import { JUICE_REGISTERS, JUICE_FLAVORS } from '../scene/juice-style.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function resolve(G, own) {
  const written = isObj(own) ? own : {};
  // the register: the world's word, else the game's tradition (its book's direction, else its kit's pole)
  let register = written.register, rFrom = 'operator';
  if (!register) {
    const t = settingOfGame(G).tradition;
    register = t ?? 'anime';
    rFrom = G?.characters?.direction?.tradition ? 'direction' : t ? 'pole' : 'default';
  }
  // the flavor: the world's word, else the template it plays, else its genre's, else realistic
  let flavor = written.flavor, fFrom = 'operator', why = 'the operator\'s word';
  const pole = G?.feel?.pole && POLES[G.feel.pole];
  if (!flavor && pole) { flavor = pole.base; fFrom = 'feel'; why = `its feel plays ${pole.name}, a ${pole.base} template`; }
  if (!flavor) {
    const genre = G?.intent?.from ?? (G?.quick?.goal ? QUICK_GENRE[G.quick.goal] : null), F = flavorFor({ genre });
    flavor = F.flavor; fFrom = F.from ?? 'default'; why = F.why;
  }
  const { register: _r, flavor: _f, ...dials } = written;
  return {
    fxStyle: { register, flavor, ...dials },
    from: { register: rFrom, flavor: fFrom },
    why: `${register}: ${JUICE_REGISTERS[register].says.split(':')[0]}; ${flavor}: ${why} (${JUICE_FLAVORS[flavor].says.split(':')[0]})`,
  };
}

/** The juice every level of a world carries as its `fxStyle`, or null (the world writes none, or false). */
export function juiceOfGame(G) {
  const own = G?.juice;
  if (own === undefined || own === null || own === false) return null;
  return resolve(G, own);
}

/** What `juice: 'auto'` would lay on a world that writes no juice (null when it writes one, or false). */
export function juiceSuggestion(G) {
  return G && G.juice === undefined ? resolve(G, 'auto') : null;
}
