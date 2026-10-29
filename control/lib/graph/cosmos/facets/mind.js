/**
 * MIND: what the other characters decide, relative to Power and Soul. Shape as in reality.js.
 *
 * The mind matrix (lib/graph/mind/): a mind meets six situations, resolved per character from four axes. Two are
 * authored and live here, motivation and aggressiveness, beside rank (minibosses and bosses duel) and skill (a base
 * for a class, tuned per character). The other two, actions and capability, are MEASURED from the body that Power
 * and Soul give it, so a cube cannot author a mind its body cannot carry out. The authored axes' statuses are found
 * by resolving each value (mind/cosmos.js), never written here.
 *
 * The fighting strategies run in the engine's mind (worlds/controllable/mind.js), lifted whole from the arena.
 *
 * `foes`: the FOE CLASSES a game fields (lib/graph/foes/: how a hostile thing moves, attacks and decides, on any body
 * that fits it, at any rank). Each class's status and marks are found from its move and its attack (foes/cosmos.js).
 */
import { mindAxisValues } from '../../mind/cosmos.js';
import { marksAcross } from '../../scene/engines/registry.js';
import { foeClassValues } from '../../foes/cosmos.js';

const MIND_RULE = 'lib/graph/worlds/controllable/mind.js';
// every value's Godot mark (scene/godot-marks.js mindMark): kernel/mind.gd runs the web's mind (since 0.26.0); the
// commander stays the page's
const marked = (axis, values) => Object.fromEntries(Object.entries(values).map(([v, row]) => [v, { ...row, ...marksAcross((M, e) => M.mindMark(axis, v)[e]) }]));
const AXES = mindAxisValues();

export const MIND = Object.freeze({
  id: 'mind',
  asks: 'how do the others decide?',
  settings: {
    // built 10-25 (battle city): a teammate's positional play is the contest minds' (contest-mind.js), not a strategy
    // of the matrix; the mark is the matrix's, since the kernels run whatever the web's mind resolves
    motivation: {
      values: marked('motivation', {
        ...AXES.motivation,
        position: { status: 'built', lowers: 'lib/graph/contest/contest-mind.js', note: 'a player in a contest played by the computer: the court mind reads where the ball will land by running its physics on a copy and runs there; the turn mind bisects its power and aim on the sim\'s own probe; the positional mind holds a role\'s home region, marks and presses inside what the contest kernel says is legal; the team mind chases, shoots in range, passes ahead. Four skill tiers; never a strategy of the mind matrix' },
      }),
    },
    aggressiveness: { values: marked('aggressiveness', AXES.aggressiveness) },
    rank: { values: marked('rank', AXES.rank) },
    skill: { values: marked('skill', AXES.skill) },
    perception: {
      values: marked('perception', {
        sight: { status: 'built', lowers: MIND_RULE, note: 'a facing cone for the counter and a line of sight to fire' },
        memory: { status: 'built', lowers: MIND_RULE, note: 'a last-seen record: it goes there, searches, then forgets' },
      }),
    },
    pathing: {
      values: marked('pathing', {
        direct: { status: 'built', lowers: MIND_RULE, note: 'straight at the target, sliding along colliders' },
        navmesh: { status: 'built', lowers: 'lib/graph/worlds/controllable/nav.js', note: 'A* over a walk grid baked from the colliders; one floor, ground only' },
      }),
    },
    squad: {
      values: marked('squad', {
        none: { status: 'built' },
        'free-for-all': { status: 'built', lowers: MIND_RULE, note: 'targets the nearest live body (`target: all`)' },
        'team-aware': { status: 'built', lowers: 'lib/graph/worlds/controllable/group.js', note: 'skips allies when targeting; a group shares focus, sight, spacing, patterns and attack tokens' },
        pack: { status: 'built', lowers: 'lib/graph/worlds/controllable/group.js', note: 'a group plan: fan-out, encircle, close; K attackers at a time' },
      }),
    },
    social: {
      values: marked('social', {
        none: { status: 'built' },
        talk: { status: 'built', lowers: 'lib/graph/playscape/ui/scenes.js', godot: 'built', roblox: 'approximated', note: 'a moment with the cast (reach them, they talk), the player answering (choose: flags, branches); Godot plays it (kernel/scenes.gd)' },
        schedule: { status: 'built', lowers: 'lib/graph/playscape/ui/routines.js', note: 'play.routines: where each goes hour by hour on the level\'s clock (cues on hour, a walk and a pose); Godot keeps the day (the pose is said, not played)' },
      }),
    },
    // built 10-27 (hostile encounters): a class is built when its move and its attack both run (foes/cosmos.js)
    foes: { multi: true, values: foeClassValues() },
    commander: {
      values: marked('commander', {
        none: { status: 'built' },
        builtin: { status: 'built', lowers: 'lib/graph/worlds/controllable/commander.js', note: 'the reference commander, on rule.commanded' },
        agent: { status: 'partial', effort: 'M', lowers: 'lib/graph/worlds/controllable/commander.js', note: 'hook and http ports wired, sketch manifests only; design_game never sets a commander, no live model bridge or test (priced 10-12)' },
      }),
    },
  },
});
