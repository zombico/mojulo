/**
 * THE GAME'S JUICE — how its effects (the attacks, the blasts, the puffs, a battle's beats) are drawn and timed, read
 * off what the game already is: the effects' floor composed (scene/juice-style.js) from
 *
 *   register   the game's visual register, anime | western: the character book's direction when it names one, else
 *              the kit's pole as the colour theorist leaves it (banded is anime, material western: cast-setting.js)
 *   look       how the register is drawn (JUICE_LOOKS): the world's word, else the look its genre is drawn in (an
 *              anime fighter or brawler is full anime, cel-shaded: CEL_GENRES), else the register's own (isekai, material)
 *   flavor     its game type's animation (feel/flavor.js): the template it plays (its feel's base), else its genre's
 *              (flavorFor, GENRE_FLAVOR), else realistic
 *   fidelity   how finely its effects are drawn (juice-style.js JUICE_FIDELITIES), the venue's drawing: a voxel stadium
 *              (its quick words' venue, stadium/stadium-words.js) or a voxel kit draws blocks; else the era's, read at
 *              each read (`era`: the sixth generation's paint, the seventh's form)
 *
 *   juice?: 'auto' | false | { register?, look?, flavor?, …dials }   the world's word (world.js reads its shape); a word it
 *            leaves out is the game's own. Absent: the effects are as they always were (nothing laid)
 *
 *   trail colour  a weapon's swing trail (juice-style.js resolveTrailColor): the world's `trailColor` word or colour, or
 *              a source the caller passes (a word, a colour, or a function of the context), against the game's context:
 *              its element (the hero's first power's, else the direction's leading element: element-words.js), its power
 *              colour (the character palette's first), its palette (the world palette's accent); none resolves, the
 *              look's own
 *
 *   juiceOfGame(G, { trailColor? })   → { fxStyle, from: { register, look, flavor, fidelity }, why } every level's `fxStyle`, or null
 *                                       (no juice word, or false)
 *   juiceSuggestion(G)   → the same for a world that writes none: what `juice: 'auto'` would lay (design_game's readout)
 *   trailContext(G)      → { element?, power?, palette? } the colours a trail's source reads
 *
 * Pure.
 */
import { settingOfGame } from './cast-setting.js';
import { flavorFor } from './feel/flavor.js';
import { POLES } from './feel/cards.js';
import { QUICK_GENRE } from './intent.js';
import { JUICE_REGISTERS, JUICE_LOOKS, JUICE_FLAVORS, resolveTrailColor } from '../scene/juice-style.js';
import { ELEMENT_TINT } from './element-words.js';
import { solvePalette } from '../color-theorist/solve.js';
import { GENRE_FEEL } from './feel/suggest.js';
import { quickVenueOf } from './quick.js';
import { STADIUM_PRESETS } from '../stadium/stadium-words.js';

/** The genres whose anime is full anime, cel-shaded (the anime fighter's, the brawler's): the rest draw the register's own look. */
export const CEL_GENRES = Object.freeze(['versus-fighter', 'arena-brawler']);
// the genre a feel's template is the template of (feel/suggest.js GENRE_FEEL, read backward)
const GENRE_OF_POLE = Object.fromEntries(Object.entries(GENRE_FEEL).map(([g, f]) => [f.pole, g]));

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The colours a swing trail's source reads off the game: its element, its power colour, its palette's accent. */
export function trailContext(G) {
  const out = {}, D = G?.characters?.direction, powers = G?.characters?.hero?.actions?.powers ?? [];
  const el = powers.find((p) => p && ELEMENT_TINT[p.element])?.element ?? (ELEMENT_TINT[D?.primary] ? D.primary : null);
  if (el) out.element = ELEMENT_TINT[el];
  if (Array.isArray(D?.palette) && /^#[0-9a-f]{6}$/i.test(D.palette[0])) out.power = D.palette[0];
  const spec = G?.style?.palette;
  if (spec && typeof spec === 'object') { try { const a = solvePalette(spec).roles.accent; if (a) out.palette = a[2]; } catch { /* a palette that does not solve gives none */ } }
  return out;
}

function resolve(G, own, opts = {}) {
  const written = isObj(own) ? own : {};
  // the register: the world's word (or its look's), else the game's tradition (its book's direction, else its kit's pole)
  let register = written.register ?? (written.look ? JUICE_LOOKS[written.look]?.register : undefined), rFrom = 'operator';
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
  // the look: the world's word, else its genre's (an anime fighter is cel-shaded), else the register's own
  const genre = G?.intent?.from ?? (G?.quick?.goal ? QUICK_GENRE[G.quick.goal] : null) ?? (G?.feel?.pole ? GENRE_OF_POLE[G.feel.pole] : null);
  let look = written.look, lFrom = 'operator';
  if (!look) { const cel = register === 'anime' && CEL_GENRES.includes(genre); look = cel ? 'cel' : JUICE_REGISTERS[register].look; lFrom = cel ? genre : 'register'; }
  // the fidelity: the world's word, else the venue's drawing (a voxel stadium, a voxel kit), else the read's era
  let fidelity = written.fidelity, dFrom = 'operator';
  if (!fidelity) {
    let v; try { v = G?.quick ? quickVenueOf(G.quick) : undefined; } catch { v = undefined; }
    const look = typeof v === 'string' ? STADIUM_PRESETS[v]?.look : v && typeof v === 'object' ? v.look ?? STADIUM_PRESETS[v.preset]?.look : undefined;
    const vox = look === 'voxel' || G?.style?.kit?.pole === 'voxel';
    fidelity = vox ? 'voxel' : 'era'; dFrom = vox ? (look === 'voxel' ? 'venue' : 'kit') : 'era';
  }
  const { register: _r, look: _l, flavor: _f, fidelity: _d, trailColor: tc, ...dials } = written;
  // the trail's colour: the caller's source over the world's word, read against the game's context (none: the look's own)
  const source = opts.trailColor ?? tc, rgb = resolveTrailColor(source, trailContext(G));
  return {
    fxStyle: { register, look, flavor, fidelity, ...dials, ...(rgb ? { trailColor: rgb } : {}) },
    from: { register: rFrom, look: lFrom, flavor: fFrom, fidelity: dFrom },
    why: `${register}, ${look}: ${JUICE_LOOKS[look].says.split(':')[0]}; ${flavor}: ${why} (${JUICE_FLAVORS[flavor].says.split(':')[0]})`,
  };
}

/** The juice every level of a world carries as its `fxStyle`, or null (the world writes none, or false). */
export function juiceOfGame(G, opts = {}) {
  const own = G?.juice;
  if (own === undefined || own === null || own === false) return null;
  return resolve(G, own, opts);
}

/** What `juice: 'auto'` would lay on a world that writes no juice (null when it writes one, or false). */
export function juiceSuggestion(G) {
  return G && G.juice === undefined ? resolve(G, 'auto') : null;
}
