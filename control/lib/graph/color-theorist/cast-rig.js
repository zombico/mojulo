/**
 * THE CAST RIG — the one light every body is drawn under (a hero, a fighter, a brawler, a piloted vehicle), as plain
 * data, in both eras. A fight's rig has the shape (versus/versus-arena.client.js fightRig: a key the room shares, a sky
 * over a ground, a rim from behind) and works there because the room is unlit; here it is solved from the world's own
 * light, so a body's material can carry it over paint and over form alike: the KEY is the world's one sun (the cube's
 * solve, era/cube-light.js), the HEMISPHERE is that solve's sky light over what its floor throws back, and the RIM is
 * the horizon behind the figure. Only the key is a light a page owns; the hemisphere and the rim are terms a body's own
 * material adds, so they light nothing else.
 *
 *   castRig(cube, { hour?, register?, palette? }) → { from, register, key, hemi, rim, bands?, tone, reads, why }
 *     cube      a checked geocube (era/geocube.js readGeocube), or null: the card (a greybox, a studio: CAST_CARD, the
 *               fight rig's own numbers)
 *     hour      the hour the level is lit at (the cube's own where absent); the sun does not move within a level
 *     register  'western' (lit as an engine lights it) | 'anime' (cel: the same rig, its tones stepped); a register of
 *               the body, never of the world: an anime world is lit as any other
 *     palette   the body's groups → hex (its albedo), for the separation read; a middle grey where absent
 *   key    { toLight, linear, level, color, gain }   the world's sun (or moon): `linear` and `level` the solve's, shared
 *          with the land; `gain` the body's own lift over it (1 unless the form read asks for more)
 *   hemi   { sky, ground, gain }   linear: a face turned up takes `sky` (the solve's ambient), one turned down `ground`
 *          (the floor's base under the light it stands in), a wall their mean; `gain` the body's own fill (1 unless the
 *          shade side would be a hole). The card's gains are 1: it is written, and lights as the fight rig does
 *   rim    { linear, color, strength, power }   a fresnel edge in the horizon's hue; at strength 1 it is as bright as
 *          the key side. Raised where the figure's shade side sits on the horizon's value
 *   bands  (anime) { steps, ramp }   the cel's tones, the shade side to the light
 *   tone   { curve, exposure, form, paint }   one rule an era: on a form page the renderer's curve tones the body with
 *          the land ('renderer'); on a painted page the body tones itself to the paint's range ('body')
 *   reads  the rig's laws, each { law, ok, …, note }: form (the key side over the shade side, held between FORM and
 *          DEPTH by the two gains), separation (the shade side against the horizon)
 *
 * Units are the solve's: out = base × light. A renderer that divides diffuse by π, as three does, sets its lights to π ×
 * these. Pure: no dice, no clock; the same cube and hour, the same rig, byte for byte. Its making is the core's
 * (cast-rig-core.js: the laws, the card, the rig with the solve passed in), which reads none of the era's modules.
 */
import { cubeLight } from '../era/cube-light.js';
import { castRigOf } from './cast-rig-core.js';

export { CAST_REGISTERS, CAST_RIG_LAWS, CAST_BANDS, CAST_CARD, castCard } from './cast-rig-core.js';

/** The rig (the core's, cast-rig-core.js castRigOf) under the cube's own light solve. */
export const castRig = (cube, opts = {}) => castRigOf(cube, opts, cubeLight);
