/**
 * THE INFILTRATION YARD — a practice room for a game played as a stealth action game is: a body moved under a free
 * camera, the aim held to shoot (worlds/controllable/aim-view.js), cover to move between. The game's play tried before
 * its levels, on the runtime it ships: the hero on the world's feel, its kit in its hands, a yard of cover and targets
 * at the ranges a sidearm is asked for.
 *
 *   the radar     the yard's bodies within 30 m of the hero (`rule.radarRange`)
 *   the hero      the world's own where made (`refs.hero`), else a stand-in person; on the world's feel
 *   the camera    a chase the player turns; the aim held, behind the shoulder; from the aim, the eye
 *   the kit       the world's guns as the firing range reads them (loadout.js loadoutOf: a carried kit, the hero's own
 *                 guns, else its feel template's), the knife in the free hand where it carries one
 *   in hand       one weapon at a time, or none, from a held menu the look steps; a ration used from another
 *                 (worlds/controllable/carry.js)
 *   the dive      on the jump's button (there is no jump): a second, about 4.8 m, a second before another
 *   the fists     with nothing in hand the trigger is the fist's strings (jab, cross, hook; the heavy an uppercut)
 *   the run       the feel's fast gait, the only pace: no sprint, no stamina; a low wall or a crate gone over out of the run, a taller
 *                 thing climbed by holding the stick into it, the gun put away for it (worlds/controllable/free-run.js)
 *   the yard      a walled floor 32 m square: a wall to come round (the third-person look past a corner), two low walls to
 *                 fire over, crates; the start at its south
 *   the crouch    on a press, and up on the next: slower, and out of a guard's sight behind a wall a metre high
 *                 (worlds/controllable/stance.js); held, flat on the ground: slower again, and under a wall half as high
 *   the takedown  the action behind a guard that has not seen the hero puts it down (worlds/controllable/takedown.js)
 *   KO and kill   the fists, the takedown and the sleep dart (the kit's `dart`) knock a guard out, asleep where it lies
 *                 until a teammate that sees it wakes it; the action drags a sleeper out of sight; a gun's rounds kill
 *                 (worlds/controllable/knockout.js)
 *   the guard     a patrol across the far half of the yard, armed with a carbine it fires on what it sees, its round
 *                 between two posts; hurt by what it has not seen it turns there and looks, and fires on who it finds; what it sees is drawn on the
 *                 floor as a fan that stops at what stops its sight, hot while it sees the hero; a sighting is said. The
 *                 carbine is in its hands, carried low on its round; once it has seen the hero it keeps it (alert.js):
 *                 shouldered, its sight wider and longer, where it lost the hero searched, the guards near it called
 *   the targets   a person's box at 5, 15 and 30 m of the start, one behind the corner; each stands again a moment
 *                 after it falls
 *
 *   infiltrationRoom(G, { refs?, cast?, vault?, roll?, climb?, toss?: '<the hero's own clip for each (toss: its throw)>', crouch?: { idle, walk }, prone?: { idle, crawl } }) → { manifest, kit: [names], knife, hero: 'own' | 'stand-in', targets }
 *   INFILTRATION_LEGEND
 *
 * Pure, no dice. Its page: scripts/spikes/mission/room.mjs (a spike: the room joins the practice door once it is kept).
 */
import { playerWorld, traversalStates } from '../playscape/player.js';
import { feelRule, readFeel } from './feel/lower.js';
import { floorOf, dummyFigure } from './practice-room.js';
import { standFoe } from './foes.js';
import { loadoutOf } from './loadout.js';
import { armsLoadout, armDetailed, knifeOf } from './arms-kit.js';
import { SHOOT, SHOULDER, PERSON } from './quick.js';
import { lowerBody } from './game-bodies.js';
import { PLAY_GRADE } from '../figures/figure-grades.js';
import { armLevel } from './arsenal.js';
import { BASIC_ARSENAL } from './combos.js';

const HALF = 16;
export const INFILTRATION_LEGEND = 'W A S D  run · mouse  look · Space  dive · run at a low wall to go over it · hold W into a taller one to climb it · C  crouch · C (hold)  lie down, and stand · unarmed: click  punch · E behind a guard that has not seen you  takedown · G (hold)  weapon menu · H (hold)  item menu · right mouse (hold)  aim · click  fire, aimed · Tab  first person, aimed · Q  the other shoulder, aimed · R  reload · V  knife';
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
// THE GUARD: a patrol in a person's skin (foes/classes/patrol.js: it walks its round and back, watching ahead in a
// narrow beam, engages what it sees and takes up its round again), across the yard's far half, its sight drawn on the
// floor (scene/channels/controllable/sight-view.js). It can be struck and shot
const GUARD = Object.freeze({ id: 'guard-1', entry: Object.freeze({ class: 'patrol', skin: Object.freeze({ people: 'human' }) }), at: Object.freeze([-8, 10.5, 0]), heading: 0 });
// (its figure: a made one's on the stand-in's library and clips, drawn as it is, else the stand-in person)
const guardFigure = (ref, cast) => { const { hero, ...rest } = dummyFigure(cast); return typeof ref === 'string' ? { ...rest, heroRef: ref } : { ...rest, hero }; };
// (its CARBINE: what it sees it fires on, in bursts of three from where it stands off, a round 6 of the hero's 100; it
// turns and shoots rather than closing to strike)
const GUARD_CARBINE = Object.freeze({ fireClass: 'sight', auto: false, cooldown: 0.28, burst: 3, burstRof: 9, magazine: 30, reload: 2.2, damage: 6, impact: 1, range: 40, coreAngle: 1.5, eye: 1.4, round: SHOOT.rifle.round });
// (the carbine as the arms library draws it: the view the hero's own kit carries, its parts and where each hand closes;
// the guard carries it, its rounds are GUARD_CARBINE's)
const CARBINE_VIEW = armsLoadout(['carbine'], SHOOT.rifle, { eye: GUARD_CARBINE.eye, hand: 'right' })[0].gunplay;
const GUARD_TUNE = Object.freeze({ team: 'guards', rule: Object.freeze({ speed: 1.6, turnRate: 2.2, guardRadius: 14, sightShown: 'radar', standoff: 9, burst: 0.5, pause: 1.1, meleeSeek: false,
  // (hurt by what it has not seen, it stops, turns to where the blow came from and looks: startle.js)
  // (and it hears: a shot across the yard, running feet close by)
  startle: Object.freeze({ hears: Object.freeze({}) }),
  // (once it has seen the hero it keeps it: its sight wider and longer, where it lost it searched, the guards near it
  // called, the carbine up before its first round: alert.js)
  alert: Object.freeze({ cone: 1.3, range: 1.6, hold: 12, search: 6, pace: 1.8, leash: 2, raise: 0.45, call: 14 }),
  // (and the team holds an ALARM: a glimpse is a threat detected, a sure sighting radioed in over 2.5 s is a threat found,
  // the whole team searching the last known place; it dies down only while no guard sees the hero: alarm.js. A level
  // sends its own backup: `alarm.backup`, `alarm.from`)
  alarm: Object.freeze({ confirm: 0.6, radio: 2.5, found: 30, detected: 40, vigilant: 1.25, sweep: 4, every: 6 }),
  // (the carbine in its hands, carried low on its round and shouldered once it has the hero: gunplay-view.js)
  armHeld: true,
  // (the carbine its one slot, in place of the patrol's own blow: a body with a loadout fires what its slot carries)
  loadout: Object.freeze([Object.freeze({ name: 'carbine', figure: GUARD.id, weapon: GUARD_CARBINE, gunplay: CARBINE_VIEW })]) }), weapon: GUARD_CARBINE, body: Object.freeze({ hittable: true, hp: TARGET_HP }) });
// (the box a hero's vault clip is solved for where the door is given none: the middle of the speed vault's band, about
// half a metre; the yard's low walls are a metre, and the body is lifted by the rest: free-run.js `clipH`)
const VAULT_CLIP_H = 0.5;
// THE DIVE (worlds/controllable/dive.js over the rule's dodge): a second at 7.6 m/s at its middle, about 4.8 m of
// ground, a second before another; with a roll of the hero's own (`roll`) it plays that, the page's tumble off
const DIVE = Object.freeze({ dodge: true, dodgeDur: 1, dodgeSpeed: 7.6, dodgeCooldown: 1, dodgeBoostCost: 0, dodgeOverheat: false, dodgeTurns: 0, dive: Object.freeze({ jump: false }) });
// (a bare hand's blow, where a held blade would say its own, worlds/held-strike.js: its reach, its seconds, and a damage
// that makes the jab 8 of a target's 100, the cross about 10, the hook 16)
const FIST_BLOW = Object.freeze({ strikeReach: 0.95, strikeDur: 0.4, strikeDamage: 16 });
// THE FISTS (the basic arsenal's, gameworld/combos.js): its ground strings alone, the jab, the cross and the hook on
// the light beat and the uppercut on the heavy; no launcher, no air string, no guard prop. What the trigger is with
// nothing in hand (worlds/controllable/carry.js)
const FISTS = (() => {
  const fist = BASIC_ARSENAL.weapons.find((w) => w.id === 'fist'), moves = Object.fromEntries(Object.entries(fist.moves).filter(([, m]) => !m.air && !m.launch));
  // (their blows land plainly: no blow shoves harder than the jab does or knocks down, so the hook and the uppercut
  // bring no longer freeze, shove or fall than a jab's)
  for (const k of Object.keys(moves)) { const { impact: _i, topple: _t, ...m } = moves[k]; moves[k] = m; }
  return { timing: BASIC_ARSENAL.timing, weapons: [{ ...fist, figure: 'drawn', guard: false, moves, combos: fist.combos.filter((c) => !c.air && c.moves.every((m) => moves[m])) }] };
})();

/** The infiltration yard (see the header). */
export function infiltrationRoom(G, { refs = {}, cast = 'male', vault = null, roll = null, climb = null, crouch = null, prone = null, toss = null } = {}) {
  const own = typeof refs.hero === 'string';
  if (G?.feel != null) readFeel(G.feel);
  const L = loadoutOf(G), words = (L?.weapons ?? []).filter((w) => typeof w === 'string'), hasKnife = (L?.weapons ?? []).some((w) => w && typeof w === 'object' && w.fire === 'melee');
  // (the kit's rounds against this yard's targets: the kit's numbers are against the quick shooter's foe; each gun drawn
  // in the hero's hands as the arms library builds it, not as its parts' boxes: arms-kit.js armDetailed)
  const kit0 = words.length ? armsLoadout(words, { ...SHOOT.rifle, damage: TARGET_HP / SHOOT.foeHp }, { eye: 1.5, hand: 'right', converge: true }).map(armDetailed) : null;
  // (a hand grenade thrown with the hero's own throw where it has one, `toss` its clip: throw.js plays the body's `throw`)
  const kit = kit0 && toss ? kit0.map((s) => (s.weapon.throw ? { ...s, weapon: { ...s.weapon, throw: { ...s.weapon.throw, clip: true } } } : s)) : kit0;
  // ONE PACE: the stick's push is the feel's fast gait (its sprint's speed) and there is no run to hold: the feel's
  // sprint, its stamina and the dodge on the sprint's key are left out
  const { boostSpeed, boostMax: _bm, boostRegen: _br, overheatRegen: _or, boostUnlockFrac: _bu, stamina: _st, sprintSpeed, sprint: _sp,
    dodge: _d, dodgeDur: _dd, dodgeSpeed: _ds, dodgeBoostCost: _dc, dodgeOverheat: _do, dodgeCooldown: _dl, ...felt } = G?.feel != null ? feelRule(G.feel) : {};
  const fast = boostSpeed ?? sprintSpeed ?? null;
  const rule = {
    ...felt, ...(fast > (felt.speed ?? 0) ? { speed: fast } : {}), move: 'camera', collideRadius: 0.3, collideHeight: 1.7,
    aimView: { shoulder: { ...SHOULDER }, eye: 1.6 },
    // (over the low walls and the crates out of the run; the stick held into a taller thing climbs it: free-run.js; the jump's
    // button is the dive's: dive.js)
    // (the crouch: slower, and low enough to be out of sight behind the yard's low walls; flat on the ground, the crawl seen
    // from the eye, and low enough to go under a truck: stance.js)
    stance: { crouch: { speed: 2.2, height: 1.1 }, prone: { speed: 0.9, height: 0.45, view: 'eye' } },
    // (a watcher that has not seen it, come up on from behind, is put down on the action: takedown.js)
    takedown: { clip: 'mv_fist_hook_still' },
    // (two ways down, knockout.js: its blows, its takedown and its sleep darts knock out, a guard asleep where it lies until a
    // teammate that sees it wakes it; the action drags a sleeper out of sight; its handgun's rounds kill)
    knockout: true,
    // (the radar reads the yard: 30 m to its rim)
    radarRange: 30,
    freeRun: { on: 'push', ...(vault ? { clipH: VAULT_CLIP_H } : {}) },
    ...DIVE, ...(roll ? { dive: { ...DIVE.dive, clip: true } } : {}),
    // (one weapon in hand, or none, from a held menu; a ration to use: carry.js)
    carry: { items: [{ id: 'ration', name: 'ration', count: 3, heal: 40 }] },
    ...(kit ? { loadout: kit, gunplay: true } : {}), ...(hasKnife ? { knife: knifeOf(TARGET_HP) } : {}),
  };
  const P = playerWorld({ heroRef: own ? refs.hero : 'stand-in', id: 'hero', title: 'infiltration yard', controls: INFILTRATION_LEGEND, rule });
  const { heroRef: _r, ...lib } = P.figures.hero;
  // (what plays a vault and a climb: the hero's own vault clip where it has one, `vault` its name (the free-run
  // library's: hero motion `stepVault`, `speedVault`, `hurdle`, `kongVault`), else a state every player plays)
  // (and its own roll under the dive, `roll` (hero motion `rollForward`), its own climb, `climb` (a clip of the hero's))
  const clips = traversalStates({ ...lib.clips, ...(vault ? { vault } : {}), ...(roll ? { dodge_roll: roll } : {}), ...(climb ? { mantle: climb } : {}), ...(crouch ? { crouch_idle: crouch.idle, crouch_walk: crouch.walk } : {}), ...(prone ? { prone_idle: prone.idle, prone_crawl: prone.crawl } : {}), ...(toss ? { throw: toss } : {}) });
  const figures = { hero: own ? { ...lib, clips, heroRef: refs.hero } : { ...lib, clips, hero: lowerBody({ cast }, null) } };
  const heroE = { ...P.entities[0], ...(kit ? { weapon: kit[0].weapon } : {}), body: { ...P.entities[0].body, hittable: true, hp: 100, radius: 0.5, egg: { ...PERSON, cz: PERSON.c } }, transform: { pos: START.slice(), heading: Math.PI / 2 } };
  const targets = TARGETS.map((t) => ({ id: t.id, rule: { type: 'walk', speed: 0, eye: 0 }, team: 'targets', transform: { pos: [t.at[0], t.at[1], 0.9], heading: -Math.PI / 2 },
    body: { type: 'mesh', shape: 'box', size: [0.5, 0.3, 1.8], color: 0xb0716a, marker: false, hittable: true, hp: TARGET_HP, radius: 0.5, egg: { ...PERSON, cz: 0 }, respawn: 3 } }));
  const { faces, colliders } = floorOf({ half: HALF });
  const manifest = {
    kind: 'controllable', title: `Infiltration yard · ${G?.name ?? G?.id ?? 'game'}`, bg: '#1b1d22', faces, colliders, figures, entities: [heroE, ...targets],
    // (a clear line, `clear`: where a wall, a crate or a ceiling would pull the eye in onto a body crouched against it, the
    // camera looks for a line over or beside it instead: channels/controllable/index.js THE CLEAR LINE)
    // (and in on the body: four fifths of the feel's distance and height, its angle kept, so the body is more of the frame
    // and less of it is ground to paint)
    camera: { ...P.camera, ...(Number.isFinite(P.camera?.dist) ? { dist: Math.round(P.camera.dist * 80) / 100 } : {}), ...(Number.isFinite(P.camera?.height) ? { height: Math.round(P.camera.height * 80) / 100 } : {}), steer: 'orbit', mouseLook: true, clear: true }, events: { ...(P.events ?? {}) },
    blocks: BLOCKS.map((b) => ({ ...b, at: b.at.slice() })),
    // (the hero baked as a level bakes it: the play grade, figure-grades.js)
    figureGrade: PLAY_GRADE,
    // (and lit as a form page lights it, the cast rig: the skinned body, its cloth closed over its joints)
    castLight: { cube: { from: 'theatre-grey' } },
    // (its effects plain: the western register in the realistic flavour, the camera's shake, the impact's flash and its
    // sparks turned well down: scene/juice-style.js)
    fxStyle: { register: 'western', flavor: 'realistic', shake: 0.15, star: 0.3, sparks: 0.3, light: 0.4 },
  };
  // (the guard, stood as every hostile is: foes.js standFoe; its figure a made one's, `refs.guard`, else a stand-in person)
  const part = { figures: manifest.figures, entities: manifest.entities };
  standFoe(null, part, { id: GUARD.id, entry: GUARD.entry, at: GUARD.at.slice(), heading: GUARD.heading }, { figure: guardFigure(refs.guard, cast), tune: GUARD_TUNE });
  manifest.figures = part.figures; manifest.entities = part.entities;
  // (the fists, laid as a level's arsenal is, their clips the figure's own)
  const armed = armLevel({ ...(G ?? {}), arsenal: FISTS }, manifest);
  if (armed !== manifest) { manifest.figures = armed.figures; manifest.entities = armed.entities.map((e) => (e.id === 'hero' ? { ...e, rule: { ...e.rule, moveClips: true, ...FIST_BLOW } } : e)); }
  return { manifest, kit: kit ? kit.map((s) => s.name) : [], knife: hasKnife, hero: own ? 'own' : 'stand-in', targets: TARGETS.map((t) => t.id), guards: [GUARD.id] };
}
