/**
 * THE INFILTRATION YARD — a practice room for a game played as a stealth action game is: a body moved under a free
 * camera, the aim held to shoot (worlds/controllable/aim-view.js), cover to move between. The game's play tried before
 * its levels, on the runtime it ships: the hero on the world's feel, its kit in its hands, a yard of cover and targets
 * at the ranges a sidearm is asked for.
 *
 *   the hero      the world's own where made (`refs.hero`), else a stand-in person; on the world's feel
 *   the camera    a chase the player turns; the aim held, behind the shoulder; from the aim, the eye
 *   the kit       the world's guns as the firing range reads them (loadout.js loadoutOf: a carried kit, the hero's own
 *                 guns, else its feel template's), the knife in the free hand where it carries one
 *   in hand       one weapon at a time, or none, from a held menu the look steps; a ration used from another
 *                 (worlds/controllable/carry.js)
 *   the run       the feel's fast gait, the only pace: no sprint, no stamina; a low wall or a crate gone over out of the run, a taller
 *                 thing climbed on the jump (worlds/controllable/free-run.js)
 *   the yard      a walled floor 32 m square: a wall to come round (the third-person look past a corner), two low walls to
 *                 fire over, crates; the start at its south
 *   the targets   a person's box at 5, 15 and 30 m of the start, one behind the corner; each stands again a moment
 *                 after it falls
 *
 *   infiltrationRoom(G, { refs?, cast?, vault?: '<the hero's vault clip>' }) → { manifest, kit: [names], knife, hero: 'own' | 'stand-in', targets }
 *   INFILTRATION_LEGEND
 *
 * Pure, no dice. Its page: scripts/spikes/mission/room.mjs (a spike: the room joins the practice door once it is kept).
 */
import { playerWorld, traversalStates } from '../playscape/player.js';
import { feelRule, readFeel } from './feel/lower.js';
import { floorOf } from './practice-room.js';
import { loadoutOf } from './loadout.js';
import { armsLoadout, knifeOf } from './arms-kit.js';
import { SHOOT, SHOULDER, PERSON } from './quick.js';
import { lowerBody } from './game-bodies.js';
import { PLAY_GRADE } from '../figures/figure-grades.js';

const HALF = 16;
export const INFILTRATION_LEGEND = 'W A S D  run · mouse  look · run at a low wall to go over it · Space at a taller one  climb · G (hold)  weapon menu · H (hold)  item menu · right mouse (hold)  aim · click  fire, aimed · Tab  first person, aimed · Q  the other shoulder, aimed · R  reload · V  knife · Space  jump';
const START = Object.freeze([0, -13, 0]);
const wall = (id, x, y, length, height, N = [0, -1]) => ({ id, form: 'wall', at: [x, y, 0], N, length, height, thick: 0.5 });
const BLOCKS = Object.freeze([
  wall('corner', -6, -3, 9, 2.6), wall('corner-return', -10.5, 1.2, 8, 2.6, [1, 0]),
  wall('low-near', 5, -6, 6, 1), wall('low-far', 4, 6, 8, 1),
  { id: 'crates-1', form: 'crate', at: [9, -1, 0], stack: 2 }, { id: 'crates-2', form: 'crate', at: [-2, 4, 0] }, { id: 'crates-3', form: 'crate', at: [10, 10, 0], stack: 2 },
]);
// a person's box at each range of the start, and one behind the corner
const TARGETS = Object.freeze([{ id: 'target-5', at: [2, -8, 0] }, { id: 'target-15', at: [6, 2, 0] }, { id: 'target-30', at: [-1, 15, 0] }, { id: 'target-corner', at: [-8, 2, 0] }]);
const TARGET_HP = 100;

/** The infiltration yard (see the header). */
export function infiltrationRoom(G, { refs = {}, cast = 'male', vault = null } = {}) {
  const own = typeof refs.hero === 'string';
  if (G?.feel != null) readFeel(G.feel);
  const L = loadoutOf(G), words = (L?.weapons ?? []).filter((w) => typeof w === 'string'), hasKnife = (L?.weapons ?? []).some((w) => w && typeof w === 'object' && w.fire === 'melee');
  // (the kit's rounds against this yard's targets: the kit's numbers are against the quick shooter's foe)
  const kit = words.length ? armsLoadout(words, { ...SHOOT.rifle, damage: TARGET_HP / SHOOT.foeHp }, { eye: 1.5, hand: 'right', converge: true }) : null;
  // ONE PACE: the stick's push is the feel's fast gait (its sprint's speed) and there is no run to hold: the feel's
  // sprint, its stamina and the dodge on the sprint's key are left out
  const { boostSpeed, boostMax: _bm, boostRegen: _br, overheatRegen: _or, boostUnlockFrac: _bu, stamina: _st, sprintSpeed, sprint: _sp,
    dodge: _d, dodgeDur: _dd, dodgeSpeed: _ds, dodgeBoostCost: _dc, dodgeOverheat: _do, dodgeCooldown: _dl, ...felt } = G?.feel != null ? feelRule(G.feel) : {};
  const fast = boostSpeed ?? sprintSpeed ?? null;
  const rule = {
    ...felt, ...(fast > (felt.speed ?? 0) ? { speed: fast } : {}), move: 'camera', collideRadius: 0.3, collideHeight: 1.7,
    aimView: { shoulder: { ...SHOULDER }, eye: 1.6 },
    // (over the low walls and the crates out of the run; the jump at a taller thing climbs it: free-run.js)
    freeRun: {},
    // (one weapon in hand, or none, from a held menu; a ration to use: carry.js)
    carry: { items: [{ id: 'ration', name: 'ration', count: 3, heal: 40 }] },
    ...(kit ? { loadout: kit, gunplay: true } : {}), ...(hasKnife ? { knife: knifeOf(TARGET_HP) } : {}),
  };
  const P = playerWorld({ heroRef: own ? refs.hero : 'stand-in', id: 'hero', title: 'infiltration yard', controls: INFILTRATION_LEGEND, rule });
  const { heroRef: _r, ...lib } = P.figures.hero;
  // (what plays a vault and a climb: the hero's own vault clip where it has one, `vault` its name (the free-run
  // library's: hero motion `stepVault`, `speedVault`, `hurdle`, `kongVault`), else a state every player plays)
  const clips = traversalStates({ ...lib.clips, ...(vault ? { vault } : {}) });
  const figures = { hero: own ? { ...lib, clips, heroRef: refs.hero } : { ...lib, clips, hero: lowerBody({ cast }, null) } };
  const heroE = { ...P.entities[0], ...(kit ? { weapon: kit[0].weapon } : {}), body: { ...P.entities[0].body, hittable: true, hp: 100, radius: 0.5, egg: { ...PERSON, cz: PERSON.c } }, transform: { pos: START.slice(), heading: Math.PI / 2 } };
  const targets = TARGETS.map((t) => ({ id: t.id, rule: { type: 'walk', speed: 0, eye: 0 }, team: 'targets', transform: { pos: [t.at[0], t.at[1], 0.9], heading: -Math.PI / 2 },
    body: { type: 'mesh', shape: 'box', size: [0.5, 0.3, 1.8], color: 0xb0716a, marker: false, hittable: true, hp: TARGET_HP, radius: 0.5, egg: { ...PERSON, cz: 0 }, respawn: 3 } }));
  const { faces, colliders } = floorOf({ half: HALF });
  const manifest = {
    kind: 'controllable', title: `Infiltration yard · ${G?.name ?? G?.id ?? 'game'}`, bg: '#1b1d22', faces, colliders, figures, entities: [heroE, ...targets],
    camera: { ...P.camera, steer: 'orbit', mouseLook: true }, events: { ...(P.events ?? {}) },
    blocks: BLOCKS.map((b) => ({ ...b, at: b.at.slice() })),
    // (the hero baked as a level bakes it: the play grade, figure-grades.js)
    figureGrade: PLAY_GRADE,
    // (and lit as a form page lights it, the cast rig: the skinned body, its cloth closed over its joints)
    castLight: { cube: { from: 'theatre-grey' } },
  };
  return { manifest, kit: kit ? kit.map((s) => s.name) : [], knife: hasKnife, hero: own ? 'own' : 'stand-in', targets: TARGETS.map((t) => t.id) };
}
