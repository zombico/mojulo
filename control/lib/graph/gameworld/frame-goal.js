/**
 * THE OPERATION — what a frame level is fought for (an airspace level with a `frame`, assault-frame/): groups of the enemy
 * on the field, the ground force's units (groundforce/: a gun emplacement, a hover tank, a personnel walker, at a frame's
 * scale) and enemy frames (assault-frame/ STOCK builds on the frame rule, each with its own mind), and tasks done in order on
 * the objectives mechanic (game/objectives.js), in the level's own words.
 *
 *   goal: { operation: { groups: [...], tasks: [...], time? } }
 *     groups   [{ id, kind: 'turret' | 'tank' | 'walker' | 'gnat' | 'wasp' | 'kite' | 'harrow' | 'thunderhead' (fliers, stood
 *              in the air, the last two gunships with a boss's bar) | 'hammer' (a missile
 *              launcher) | 'bastion' (a shield-bearer) | 'frame', count?, at: [x, y] (a share of the field: −1..1 each
 *              way, the frame starting at [0, −0.55]), spread? (m), build? (a frame's: a STOCK name), palette?,
 *              ace? (a frame's: an ace off assault-frame/aces.js, its build, paint, armour and phases; one), mt? (a frame's:
 *              a smaller frame off assault-frame/mts.js, its build, scale, armour and mind), reserve?
 *              (true: held back dormant until an ace's phase calls it in) }]
 *     tasks    [{ down: <group id> | [ids] | true, text? } | { reach: [x, y], radius?, text? } | { scan: [x, y], radius?,
 *              seconds?, found?, text? } (stay in the ring while the readout fills) | { hold: seconds, text? }]
 *              a down task's groups stand dormant until it begins (objectives wake them); true: every group;
 *              any task's `pause`: the seconds after the one before is met that it begins (a beat let breathe);
 *              { learn: <FRAME_LESSONS word>, text? } a control shown and met only as it is done; { act: <bus event>,
 *              text? } met as the level says it (a scene's end: `scene-end:<id>`)
 *     marks    { <name>: [x, y] } named places on the field, each a spot of its name for the level's scenes
 *     a group's `wary: true`: a unit that holds its fire until it is hit (a survey drone spotted, pointed out, engaged)
 *     a group's `comes: <task number>`: it stands dormant till that task begins and comes then, not that task's to down
 *     (a frame that comes with the one fought, to be led off by an ally in a split)
 *     any task's `alarm: '<words>'`: as it begins the enemy is heard coming (OP_ALARM: a warning, the cue's: a red band
 *     across the screen, the words under its title, its own klaxon)
 *     allies[].hold   true: it stands its ground, an instructor on the range; <task number>: till that task begins,
 *                     then it fights and keeps by the pilot (the cast's `unhold`, rules-frame.js)
 *     retry  true: the pilot down begins the task in hand again (game/objectives.js RETRY: the screen faded, the pilot up
 *            whole where it fell, each fought group put back where it stood, whole), not the level lost
 *     split  { ally, foe: <group id>, at: <task number>, to: [x, y], back?: <task number>, title?, line?: { who, say } }
 *            as task `at` begins, a scene: the foe's group shown (its title a banner), the ally and the foe in one frame,
 *            the line said, and the two of them off together toward `to` and gone, a fight of their own off the field;
 *            as task `back` begins the ally comes back from there, alone (SPLIT)
 *
 *   OPERATION                      the numbers: a unit's armour and guns at a frame's scale, a reach's radius
 *   readOperation(v, at)           → the operation; throws, teaching
 *   operationMechanics(op, ends)   → the level's mechanics: the objectives, the frame's armour its life (fail-on-death)
 *   operationCast(op, ends)        → { entities, figures } the groups stood on the field
 *   OPERATION_LEGEND               the keys the play adds to the level's legend
 *
 * Pure: the dice are the field's, seeded by the group's id.
 */
import { unitRadius, GROUND_UNITS } from '../groundforce/index.js';
import { ACES, readAce } from '../assault-frame/aces.js';
import { MTS, readMt } from '../assault-frame/mts.js';
import { frameEntity } from '../assault-frame/pilot.js';
import { STOCK, PARTS } from '../assault-frame/parts.js';
import { readBuild } from '../assault-frame/assemble.js';
import { readScript } from './script.js';
import { PARTS_SLICE } from '../assault-frame/hangar.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r2 = (v) => Math.round(v * 100) / 100;

/** A unit at a frame's scale: its armour against a frame's rounds, its gun's damage, rate and reach. */
export const OPERATION = Object.freeze({
  units: Object.freeze({
    turret: Object.freeze({ hp: 3200, damage: 90, rof: 3, range: 520, speed: 340 }),
    tank: Object.freeze({ hp: 4200, damage: 260, rof: 0.6, range: 480, speed: 260, move: 9 }),
    walker: Object.freeze({ hp: 2600, damage: 70, rof: 5, range: 360, speed: 380, move: 6 }),
    // (a flier, one of a swarm: light, quick, close, weaving round the frame; `air` the metres it is stood over the ground,
    // `standoff` the reach it closes to, `turn` how quick it comes round, `floor` the least it flies over the land)
    // (a launcher: no gun, homing missiles off its rack, the engine's launcher, worlds/controllable/combat-ranged.js
    // `rule.missiles`, its impact a share of a frame's bar; it hangs back at its standoff behind what screens it. Its
    // splash wider than its fuse's reach and its round's: a missile that bursts as it passes still lands)
    hammer: Object.freeze({ hp: 3600, range: 650, move: 4, standoff: 420, turn: 0.9, missiles: Object.freeze({ count: 40, lockTime: 1.6, cone: 40, range: 650, speed: 115, turn: 1.3, damage: 520, splash: 9, prox: 4, fuse: 9, cooldown: 1.1, impact: 0.12 }) }),
    // (a shield-bearer: the engine's frontal shield, combat-hit.js `body.shield` { hp, arc }: shots from in front are eaten
    // until it breaks, a flank goes round it; broken, it staggers and raises it again `shieldRaise` s on, a frame's lunge
    // knocks it aside, rules-frame.js)
    bastion: Object.freeze({ hp: 5200, damage: 150, rof: 1.6, range: 380, speed: 360, move: 3.5, standoff: 150, shield: Object.freeze({ hp: 4200, arc: 120 }), shieldRaise: 7 }),
    // (the fliers that fly, rules-frame.js `frame-flight`: the AI aims and fires them, their `flight` flies them. A Wasp
    // strafes, a Kite perches high with missiles, the Harrow gunship circles and hangs to barrage, a boss: its `boss` the
    // name on the HUD's bar, assault-frame/aces.js's shape)
    wasp: Object.freeze({ hp: 1100, damage: 45, rof: 6, range: 300, speed: 480, air: 55, turn: 2.6, floor: 8, flight: Object.freeze({ mode: 'strafe', speed: 64, alt: 50, low: 14, out: 260, turn: 1.8 }) }),
    kite: Object.freeze({ hp: 2200, range: 720, air: 70, turn: 1.4, floor: 20, flight: Object.freeze({ mode: 'perch', alt: 70, range: 320, speed: 20, every: 9 }), missiles: Object.freeze({ count: 30, lockTime: 1.8, cone: 50, range: 720, speed: 105, turn: 1.2, damage: 420, splash: 8, prox: 4, fuse: 10, cooldown: 2.4, impact: 0.1 }) }),
    // (the Thunderhead, the heavy gunship: a quad drone at a gunship's scale, orbiting the frame at height nose on: its
    // chin gun's stream and its rail cannon's slugs, which barely turn but land hard; its guns are slung forward and
    // cannot bear past `under` degrees down, so a frame right under it is safe while it stays there; its rotors spin at
    // `spin` turns a second; its hit and aim at its hull, `hitAt` m up, not up among its rotors)
    thunderhead: Object.freeze({ hp: 64000, damage: 60, rof: 10, range: 820, speed: 560, air: 115, turn: 0.9, floor: 60, boss: 'Thunderhead', hitAt: 2.2, flight: Object.freeze({ mode: 'orbit', radius: 260, alt: 115, speed: 44, turn: 0.7, under: 55, spin: 3.2 }), missiles: Object.freeze({ count: 80, lockTime: 2.4, cone: 40, range: 850, speed: 150, turn: 0.3, damage: 1500, splash: 16, prox: 5, fuse: 8, cooldown: 5, impact: 0.5 }) }),
    harrow: Object.freeze({ hp: 32000, damage: 90, rof: 7, range: 520, speed: 520, air: 45, turn: 1.4, floor: 18, boss: 'Harrow', flight: Object.freeze({ mode: 'circuit', radius: 170, alt: 42, speed: 26, hover: Object.freeze([3.5, 11]), turn: 1.2 }), missiles: Object.freeze({ count: 120, lockTime: 1.2, cone: 60, range: 650, speed: 115, turn: 1.3, damage: 480, splash: 9, prox: 4, fuse: 9, cooldown: 1.4, impact: 0.1 }) }),
    gnat: Object.freeze({ hp: 700, damage: 32, rof: 4, range: 260, speed: 170, move: 30, air: 30, standoff: 55, turn: 3.2, floor: 10 }),
  }),
  reach: 60,
  // (a scan's ring and how long it takes inside it)
  scan: Object.freeze({ radius: 40, seconds: 6 }),
  // (an enemy frame fights with the pilot's own weapons and armour, kept off its own team's rounds)
  frameRange: 140,
});
// (the enemy's rounds: a hot red-orange in the shot's look, scene/channels/controllable/index.js foeLooks)
const FOE_ROUND = Object.freeze({ color: 0xff5a36, size: 0.42 });
export const OPERATION_LEGEND = 'mouse  turn & aim · W A S D  move · Shift  boost · C  quick boost · X  assault boost · F  kick · Space  jump, hold to climb · click / right click  hands · Q / E  shoulders';
const KINDS = ['turret', 'tank', 'walker', 'gnat', 'wasp', 'kite', 'harrow', 'thunderhead', 'hammer', 'bastion', 'frame'];

export function readOperation(v, at = 'goal.operation') {
  if (!isObj(v)) throw new Error(`${at} is { groups, tasks, time? }: the enemy on the field and what is done about it`);
  for (const k of Object.keys(v)) if (!['groups', 'tasks', 'time', 'reward', 'briefing', 'lessons', 'allies', 'script', 'props', 'marks', 'split', 'retry'].includes(k)) throw new Error(`${at}.${k} is not part of an operation (groups, tasks, time, reward, briefing, lessons, allies, script, props, marks)`);
  // (its briefing: told on the holo table before the drop, campaign/operation-brief.js reads it whole)
  if (v.briefing !== undefined && !(v.briefing && typeof v.briefing === 'object' && Array.isArray(v.briefing.steps))) throw new Error(`${at}.briefing is { region?, steps: [{ title, say, show?, routes? }] }: the operation told on the holo table`);
  // (its reward: the parts its win adds to the garage's, assault-frame/parts.js ids)
  if (v.reward !== undefined && !(Array.isArray(v.reward) && v.reward.every((id) => typeof id === 'string' && Object.values(PARTS).some((T) => T[id])))) throw new Error(`${at}.reward is a list of parts (assault-frame/parts.js ids) its win adds to the garage`);
  if (!Array.isArray(v.groups) || !v.groups.length) throw new Error(`${at}.groups is a list of the enemy's groups`);
  const ids = new Set();
  const groups = v.groups.map((g, i) => {
    const gat = `${at}.groups[${i}]`;
    if (!isObj(g) || typeof g.id !== 'string' || !/^[a-z][a-z0-9-]{0,23}$/.test(g.id)) throw new Error(`${gat} is { id, kind, count?, at, spread?, build?, ace?, mt?, reserve? } (id a short lower-case name)`);
    if (ids.has(g.id)) throw new Error(`${gat}.id '${g.id}' is used twice`);
    ids.add(g.id);
    if (!KINDS.includes(g.kind)) throw new Error(`${gat}.kind is one of ${KINDS.join(', ')}`);
    if (!(Array.isArray(g.at) && g.at.length === 2 && g.at.every((x) => Number.isFinite(x) && Math.abs(x) <= 1))) throw new Error(`${gat}.at is [x, y], each −1..1: a share of the field`);
    const count = g.count ?? 1;
    if (!(Number.isInteger(count) && count >= 1 && count <= 12)) throw new Error(`${gat}.count is 1 to 12`);
    if (g.build !== undefined && (g.kind !== 'frame' || !STOCK[g.build])) throw new Error(`${gat}.build is a frame's: ${Object.keys(STOCK).join(', ')}`);
    // (an ace, assault-frame/aces.js: a named frame with its own build and paint and its phases; one of it)
    if (g.ace !== undefined) { if (g.kind !== 'frame') throw new Error(`${gat}.ace is a frame's`); readAce(g.ace, `${gat}.ace`); if (count !== 1) throw new Error(`${gat}.count: an ace is one`); }
    // (an MT, assault-frame/mts.js: a smaller frame off its shelf, its build, scale, armour and mind its row's)
    if (g.mt !== undefined) { if (g.kind !== 'frame' || g.ace !== undefined) throw new Error(`${gat}.mt is a frame's, not an ace's`); readMt(g.mt, `${gat}.mt`); }
    // (a reserve: held back, dormant, until an ace's phase calls it in)
    if (g.reserve !== undefined && g.reserve !== true) throw new Error(`${gat}.reserve is true: held back till an ace calls it`);
    // (wary: it goes about its own work, holding its fire until it is hit: a survey drone spotted before it is fought,
    // the mind's `defensive` temperament, worlds/controllable/mind.js; a unit's, not a frame's)
    if (g.wary !== undefined && (g.wary !== true || g.kind === 'frame')) throw new Error(`${gat}.wary is true: a unit that holds its fire until it is hit (not a frame)`);
    // (comes: dormant till a task begins, then woken, not that task's to down; checked against the tasks below)
    if (g.comes !== undefined && !(Number.isInteger(g.comes) && g.comes >= 2)) throw new Error(`${gat}.comes is the number of the task it comes with (2 or later: one awake from the start needs none)`);
    // (an intro: a short scene as it first comes, FOE_INTRO)
    const intro = g.intro === undefined || g.intro === false ? null : readIntro(g.intro, `${gat}.intro`);
    return { id: g.id, kind: g.kind, count, at: g.at.slice(), spread: g.spread ?? 40, ...(g.kind === 'frame' ? { build: g.ace ? ACES[g.ace].build : g.mt ? MTS[g.mt].build : g.build ?? 'raptor' } : {}), ...(g.mt ? { mt: g.mt, palette: MTS[g.mt].palette } : {}), ...(g.ace ? { ace: g.ace, palette: ACES[g.ace].palette } : {}), ...(g.palette ? { palette: g.palette } : {}), ...(g.wary ? { wary: true } : {}), ...(intro ? { intro } : {}), ...(g.reserve ? { reserve: true } : {}), ...(g.comes ? { comes: g.comes } : {}) };
  });
  if (!Array.isArray(v.tasks) || !v.tasks.length) throw new Error(`${at}.tasks is a list: { down }, { reach }, { hold }`);
  const tasks = v.tasks.map((t, i) => {
    const tat = `${at}.tasks[${i}]`;
    if (!isObj(t)) throw new Error(`${tat} is { down } | { reach } | { scan } | { hold }`);
    if (t.down !== undefined) {
      const of = t.down === true ? [...ids] : [].concat(t.down);
      for (const id of of) if (!ids.has(id)) throw new Error(`${tat}.down names '${id}', not a group (${[...ids].join(', ')})`);
      return { down: of, ...(t.text ? { text: t.text } : {}) };
    }
    if (t.reach !== undefined) {
      if (!(Array.isArray(t.reach) && t.reach.length === 2 && t.reach.every((x) => Number.isFinite(x) && Math.abs(x) <= 1))) throw new Error(`${tat}.reach is [x, y], each −1..1`);
      return { reach: t.reach.slice(), radius: t.radius ?? OPERATION.reach, ...(t.text ? { text: t.text } : {}) };
    }
    if (t.scan !== undefined) {
      // (a scan: the ring stood in while the readout fills, what it found said as it is met; game/objectives.js `scan`)
      if (!(Array.isArray(t.scan) && t.scan.length === 2 && t.scan.every((x) => Number.isFinite(x) && Math.abs(x) <= 1))) throw new Error(`${tat}.scan is [x, y], each −1..1: the place scanned`);
      if (t.seconds !== undefined && !(Number.isFinite(t.seconds) && t.seconds > 0 && t.seconds <= 60)) throw new Error(`${tat}.seconds is how long the scan takes, 0 to 60`);
      if (t.found !== undefined && !(typeof t.found === 'string' && t.found && t.found.length <= 120)) throw new Error(`${tat}.found is what the scan found, in words (up to 120 letters)`);
      return { scan: t.scan.slice(), radius: t.radius ?? OPERATION.scan.radius, seconds: t.seconds ?? OPERATION.scan.seconds, ...(t.found ? { found: t.found } : {}), ...(t.text ? { text: t.text } : {}) };
    }
    if (t.learn !== undefined) {
      // (a control learnt: the pilot shown its keys and told what it does, and the task met only as it is done, the
      // guide's lesson saying so on the bus: FRAME_LESSONS, game/objectives.js `act`)
      if (!(typeof t.learn === 'string' && FRAME_LESSONS[t.learn] && FRAME_LESSONS[t.learn].fact)) throw new Error(`${tat}.learn is a control the frame shows it is done: ${Object.keys(FRAME_LESSONS).filter((k) => FRAME_LESSONS[k].fact).join(', ')}`);
      return { learn: t.learn, ...(t.text ? { text: t.text } : {}) };
    }
    if (t.act !== undefined) {
      // (an event waited on: met as the level's bus says it, a scene's end (`scene-end:<id>`) or any other: no clock)
      if (!(typeof t.act === 'string' && /^[a-z][a-z0-9:_-]{0,63}$/i.test(t.act))) throw new Error(`${tat}.act is the bus event that meets it (a scene's end is scene-end:<id>)`);
      return { act: t.act, ...(t.text ? { text: t.text } : {}) };
    }
    if (t.hold !== undefined) {
      if (!(Number.isFinite(t.hold) && t.hold > 0)) throw new Error(`${tat}.hold is seconds`);
      return { hold: t.hold, ...(t.text ? { text: t.text } : {}) };
    }
    throw new Error(`${tat} is { down } | { reach } | { scan } | { hold } | { learn } | { act }`);
  });
  // (a task's pause: the seconds after the one before is met that it begins, a beat let breathe, game/objectives.js)
  v.tasks.forEach((t, i) => {
    if (t.pause === undefined) return;
    if (!(Number.isFinite(t.pause) && t.pause > 0 && t.pause <= 30)) throw new Error(`${at}.tasks[${i}].pause is the seconds after the one before is met that it begins, up to 30`);
    tasks[i] = { ...tasks[i], pause: t.pause };
  });
  // (a task's alarm: the enemy heard coming as it begins, OP_ALARM)
  v.tasks.forEach((t, i) => {
    if (t.alarm === undefined) return;
    if (!(typeof t.alarm === 'string' && t.alarm && t.alarm.length <= 40)) throw new Error(`${at}.tasks[${i}].alarm is the words on its banner as the enemy is heard coming, up to 40 letters`);
    tasks[i] = { ...tasks[i], alarm: t.alarm };
  });
  for (const g of groups) if (g.comes && g.comes > tasks.length) throw new Error(`${at}.groups: '${g.id}' comes with task ${g.comes}, and there are ${tasks.length}`);
  // (its allies: frames on the pilot's side, a wingman who leads it through the operation's places and fights beside it)
  const allies = v.allies === undefined ? null : readAllies(v.allies, ids, `${at}.allies`, tasks.length);
  // (its script: the spoken lines on its moments, gameworld/script.js; its allies speak under their own names)
  const script = v.script === undefined ? null : (() => { const S = readScript(v.script, { tasks: tasks.length, at: `${at}.script` }); for (const a of allies ?? []) S.speakers[a.id] ??= { name: a.name }; return S; })();
  // (its lessons: the frame's controls taught one at a time, each group as its task begins: FRAME_LESSONS)
  const lessons = v.lessons === undefined ? null : readFrameLessons(v.lessons, tasks.length, `${at}.lessons`);
  // (its marks: named places on the field for its scenes, a walk's end, a shot's place: each a spot of its name)
  const marks = v.marks === undefined ? null : readMarks(v.marks, `${at}.marks`);
  // (its retry: the pilot down begins the task in hand again, game/objectives.js RETRY)
  if (v.retry !== undefined && typeof v.retry !== 'boolean') throw new Error(`${at}.retry is true: the pilot down begins the task in hand again (its foes up and whole, where they stood), not the level lost`);
  // (its split: an ally and a foe off together, SPLIT)
  const split = v.split === undefined ? null : readSplit(v.split, { allies: allies ?? [], groups, tasks: tasks.length, speakers: script ? Object.keys(script.speakers) : (allies ?? []).map((a) => a.id) }, `${at}.split`);
  // (its props: things stood on the field for its scenes to move, PROP)
  const props = v.props === undefined ? null : readProps(v.props, new Set([...ids, ...(allies ?? []).map((a) => a.id)]), `${at}.props`);
  return { groups, tasks, ...(v.time ? { time: v.time } : {}), ...(v.reward?.length ? { reward: [...new Set(v.reward)] } : {}), ...(lessons ? { lessons } : {}), ...(allies ? { allies } : {}), ...(script ? { script } : {}), ...(props ? { props } : {}), ...(marks ? { marks } : {}), ...(split ? { split } : {}), ...(v.retry ? { retry: true } : {}) };
}
/** A FOE'S INTRO (a group's `intro: true | { title?, line?, who? }`): the first time the group comes (its down task
 *  begins, or the level starts for a group awake from the start), a short scene: the letterbox, the camera pushed in on
 *  it, its name as a banner (`title`, else its card's label), a line said over it where one is written (`who` says
 *  `line`, its id a speaker's), then the play back. Skippable as every scene is (Esc). */
export const FOE_INTRO = Object.freeze({ hold: 3, banner: 2.6 });
function readIntro(v, at) {
  if (v === true) return {};
  if (!isObj(v)) throw new Error(`${at} is true, or { title?, line?, who? }`);
  for (const k of Object.keys(v)) if (!['title', 'line', 'who'].includes(k)) throw new Error(`${at}.${k} is not part of an intro (title, line, who)`);
  if (v.title !== undefined && !(typeof v.title === 'string' && v.title && v.title.length <= 40)) throw new Error(`${at}.title is its name on the banner, up to 40 letters`);
  if (v.line !== undefined && !(typeof v.line === 'string' && v.line && v.line.length <= 240)) throw new Error(`${at}.line is what is said over it, up to 240 letters`);
  if ((v.line === undefined) !== (v.who === undefined) || (v.who !== undefined && !/^[a-z][a-z0-9-]{0,40}$/.test(v.who))) throw new Error(`${at}: a line needs its who (a speaker's id), and a who its line`);
  return { ...(v.title ? { title: v.title } : {}), ...(v.line ? { line: v.line, who: v.who } : {}) };
}
/** A task's ALARM, as it begins: a warning (the cue's `warning`, scene/channels/warning.js: a red band across the screen,
 *  its `title` over the words, its own klaxon), standing `ttl` s. A level cue: no scene, the fight goes on under it. */
export const OP_ALARM = Object.freeze({ title: 'WARNING', ttl: 3.2 });
/** A SPLIT: an ally and a foe leave the field together, a fight of their own off it (a level's economy: it is never
 *  played). As its task begins, a scene: the foe's group in a wide push (its `title` a banner), the ally and the foe in
 *  one frame, its `line` said, then both off toward `to` at `speed` m/s and gone after `leave` s; as task `back` begins,
 *  the ally comes back from there alone (spawned at its place, let go of any hold), the foe it went with never seen again. */
export const SPLIT = Object.freeze({ speed: 34, leave: 3.2, banner: 2.6 });
function readSplit(v, { allies, groups, tasks, speakers }, at) {
  if (!isObj(v)) throw new Error(`${at} is { ally, foe, at, to, back?, title?, line? }: an ally and a foe off the field together`);
  for (const k of Object.keys(v)) if (!['ally', 'foe', 'at', 'to', 'back', 'title', 'line'].includes(k)) throw new Error(`${at}.${k} is not part of a split (ally, foe, at, to, back, title, line)`);
  if (!allies.some((a) => a.id === v.ally)) throw new Error(`${at}.ally is one of the operation's allies (${allies.map((a) => a.id).join(', ') || 'none'})`);
  const G = groups.find((g) => g.id === v.foe);
  if (!G || G.count !== 1) throw new Error(`${at}.foe is a group of one (${groups.filter((g) => g.count === 1).map((g) => g.id).join(', ')})`);
  if (!(Number.isInteger(v.at) && v.at >= 1 && v.at <= tasks)) throw new Error(`${at}.at is the number of the task that begins it (1 to ${tasks})`);
  if (G.comes && G.comes > v.at) throw new Error(`${at}.foe '${v.foe}' comes with task ${G.comes}, after the split's`);
  if (!(Array.isArray(v.to) && v.to.length === 2 && v.to.every((x) => Number.isFinite(x) && Math.abs(x) <= 1))) throw new Error(`${at}.to is [x, y], each −1..1 of the field: where the two go`);
  if (v.back !== undefined && !(Number.isInteger(v.back) && v.back > v.at && v.back <= tasks)) throw new Error(`${at}.back is the number of a task after the split's that brings the ally back (${v.at + 1} to ${tasks})`);
  if (v.title !== undefined && !(typeof v.title === 'string' && v.title && v.title.length <= 40)) throw new Error(`${at}.title is the foe's name on the banner, up to 40 letters`);
  if (v.line !== undefined && !(isObj(v.line) && typeof v.line.say === 'string' && v.line.say && v.line.say.length <= 240 && speakers.includes(v.line.who))) throw new Error(`${at}.line is { who, say }: a speaker's id (${speakers.join(', ')}) and what is said, up to 240 letters`);
  return { ally: v.ally, foe: v.foe, at: v.at, to: v.to.slice(), ...(v.back ? { back: v.back } : {}), ...(v.title ? { title: v.title } : {}), ...(v.line ? { line: { who: v.line.who, say: v.line.say } } : {}) };
}
// (an operation's marks: { <name>: [x, y] }, each a share of the field, at most 16)
function readMarks(v, at) {
  if (!isObj(v) || !Object.keys(v).length || Object.keys(v).length > 16) throw new Error(`${at} is { <name>: [x, y] }, 1 to 16 places (each −1..1 of the field)`);
  return Object.fromEntries(Object.entries(v).map(([k, p]) => {
    if (!/^[a-z][a-z0-9-]{0,30}$/.test(k) || /^t\d+$/.test(k)) throw new Error(`${at}.${k}: a mark's name is lower-case, not a task's (t<n>)`);
    if (!(Array.isArray(p) && p.length === 2 && p.every((x) => Number.isFinite(x) && Math.abs(x) <= 1))) throw new Error(`${at}.${k} is [x, y], each −1..1 of the field`);
    return [k, p.slice()];
  }));
}

/** An operation's PROPS checked (throws, teaching): [{ id, unit, at, raise?, hidden?, face? }]. A thing stood on the field
 *  for the level's scenes to move (the world's `scenes`, playscape/ui/scenes.js): a body drawn as a card (groundforce/,
 *  a prop's card or any unit's), no mind, nothing hits it. It stands `raise` metres over its place, asleep while
 *  `hidden` (a scene's spawn wakes it), and its place, where it is set down, is a spot of its own id for the scenes
 *  (`{ glide: { who: 'candle', to: 'candle' } }` lowers it onto it); each reach's and scan's place is the spot `t<n>`. */
export const PROP = Object.freeze({ most: 12, raise: 3000 });
function readProps(v, taken, at) {
  if (!Array.isArray(v) || !v.length || v.length > PROP.most) throw new Error(`${at} is 1 to ${PROP.most} props: [{ id, unit, at, raise?, hidden?, face? }]`);
  const seen = new Set();
  return v.map((p, i) => {
    const pat = `${at}[${i}]`;
    if (!isObj(p)) throw new Error(`${pat} is { id, unit, at, raise?, hidden?, face? }`);
    for (const k of Object.keys(p)) if (!['id', 'unit', 'at', 'raise', 'hidden', 'face'].includes(k)) throw new Error(`${pat}.${k} is not part of a prop (id, unit, at, raise, hidden, face)`);
    if (typeof p.id !== 'string' || !/^[a-z][a-z0-9-]{0,30}$/.test(p.id) || seen.has(p.id) || taken.has(p.id) || /^t\d+$/.test(p.id)) throw new Error(`${pat}.id is its own name, lower-case, not a group's, an ally's or a task's (t<n>)`);
    seen.add(p.id);
    if (!GROUND_UNITS[p.unit]) throw new Error(`${pat}.unit is the card it is drawn as: ${Object.keys(GROUND_UNITS).join(', ')}`);
    if (!(Array.isArray(p.at) && p.at.length === 2 && p.at.every((x) => Number.isFinite(x) && x >= -1 && x <= 1))) throw new Error(`${pat}.at is its place, [x, y] each -1 to 1 of the field`);
    if (p.raise !== undefined && !(Number.isFinite(p.raise) && p.raise >= 0 && p.raise <= PROP.raise)) throw new Error(`${pat}.raise is metres over its place, 0 to ${PROP.raise}`);
    if (p.hidden !== undefined && typeof p.hidden !== 'boolean') throw new Error(`${pat}.hidden is true where it waits asleep for a scene to spawn it`);
    if (p.face !== undefined && !Number.isFinite(p.face)) throw new Error(`${pat}.face is degrees`);
    return { id: p.id, unit: p.unit, at: p.at.slice(), ...(p.raise ? { raise: p.raise } : {}), ...(p.hidden ? { hidden: true } : {}), ...(p.face !== undefined ? { face: p.face } : {}) };
  });
}

/** An operation's allies checked (throws, teaching): [{ id, name, build?, palette?, ap?, lead? }]. A wingman: a frame on
 *  the pilot's side (no team, as the pilot has none), its mind an ally's (rules-frame.js): it fights the nearest foe
 *  awake near it, and with none it leads to the operation's places in order (its reaches' and its scans'), waiting at
 *  each for the pilot, then keeps by the pilot. `ap` its armour's share over its build's (a wingman is hard to lose). */
export const ALLY = Object.freeze({ most: 3, ap: 3, engage: 500, palette: 'federation', build: 'raptor' });
function readAllies(v, groupIds, at, taskCount = Infinity) {
  if (!Array.isArray(v) || !v.length || v.length > ALLY.most) throw new Error(`${at} is 1 to ${ALLY.most} allies: [{ id, name, build?, palette?, ap?, lead? }]`);
  const seen = new Set();
  return v.map((a, i) => {
    const aat = `${at}[${i}]`;
    if (!isObj(a)) throw new Error(`${aat} is { id, name, build?, palette?, ap?, lead? }`);
    for (const k of Object.keys(a)) if (!['id', 'name', 'build', 'palette', 'ap', 'lead', 'hold'].includes(k)) throw new Error(`${aat}.${k} is not part of an ally (id, name, build, palette, ap, lead, hold)`);
    if (typeof a.id !== 'string' || !/^[a-z][a-z0-9-]{0,30}$/.test(a.id) || seen.has(a.id) || groupIds.has(a.id)) throw new Error(`${aat}.id is its own name, lower-case, not a group's`);
    seen.add(a.id);
    if (typeof a.name !== 'string' || !a.name || a.name.length > 24) throw new Error(`${aat}.name is what it is called, up to 24 letters`);
    if (a.build !== undefined) readBuild(a.build, `${aat}.build`);
    if (a.ap !== undefined && !(Number.isFinite(a.ap) && a.ap > 0 && a.ap <= 10)) throw new Error(`${aat}.ap is its armour's share over its build's, 0 to 10`);
    if (a.lead !== undefined && typeof a.lead !== 'boolean') throw new Error(`${aat}.lead is true where it leads the pilot through the operation's places`);
    // (hold: it stands its ground where it was stood, facing the pilot, an instructor on the range; it fights only a foe
    // that comes within its reach, and leads nowhere)
    // (or a task's number: it holds till that task begins, then fights and keeps by the pilot)
    if (a.hold !== undefined && typeof a.hold !== 'boolean' && !(Number.isInteger(a.hold) && a.hold >= 2 && a.hold <= taskCount)) throw new Error(`${aat}.hold is true where it stands its ground, an instructor, and leads nowhere; or the number of the task it holds till (2 to ${taskCount})`);
    return { id: a.id, name: a.name, build: a.build ?? ALLY.build, palette: a.palette ?? ALLY.palette, ap: a.ap ?? ALLY.ap, lead: a.lead !== false && !a.hold, ...(a.hold ? { hold: a.hold } : {}) };
  });
}

/**
 * THE FRAME'S LESSONS: what a frame level can teach, one control at a time, each line kept up until the pilot does it
 * (its `fact`, the guide channel's: scene/channels/guide.js) or its patience runs out. A word a line: its keys and what
 * it is. An operation's `lessons` are groups, `{ teach: [<word>…], at?: <task number> }`, the group shown as its task
 * begins (the first, as the level starts, where it says none): a training level's movement as it starts, its weapons
 * as its drones come.
 */
export const FRAME_LESSONS = Object.freeze({
  move: Object.freeze({ keys: 'W A S D  move', fact: 'move' }),
  look: Object.freeze({ keys: 'mouse  turn and aim', fact: 'look' }),
  boost: Object.freeze({ keys: 'Shift  boost: skate over the ground on your thrusters', fact: 'boost' }),
  'quick-boost': Object.freeze({ keys: 'C  quick boost: a sudden dash, the way you are moving', fact: 'quick-boost' }),
  jump: Object.freeze({ keys: 'Space  jump', fact: 'jump' }),
  climb: Object.freeze({ keys: 'Space  hold in the air to climb on your thrusters', fact: 'climb' }),
  'assault-boost': Object.freeze({ keys: 'X  assault boost: a charge straight ahead', fact: 'assault-boost' }),
  energy: Object.freeze({ keys: 'EN  the bar under your armour: boosting spends it, it fills again on the ground' }),
  lock: Object.freeze({ keys: 'aim at a foe  the sight locks on', fact: 'lock' }),
  'right-hand': Object.freeze({ keys: 'click  fire the right hand', fact: 'fire-armR' }),
  'left-hand': Object.freeze({ keys: 'right-click  fire the left hand', fact: 'fire-armL' }),
  'left-shoulder': Object.freeze({ keys: 'Q  fire the left shoulder', fact: 'fire-backL' }),
  'right-shoulder': Object.freeze({ keys: 'E  fire the right shoulder', fact: 'fire-backR' }),
  kick: Object.freeze({ keys: 'F  kick: a boosting frame\'s blow at close range' }),
});
// (the objectives mechanic's task in hand, game/objectives.js objectiveNames: the operation's is the default id's)
export const FRAME_LESSON_TASK = '__obj';
// (a learnt control's words on the objective line, from its lesson: what follows its keys, `W A S D  move` → `Move`)
const learnText = (L) => { const w = L.keys.split(/\s{2,}/).slice(1).join(' ') || L.keys; return w[0].toUpperCase() + w.slice(1); };
// (the lessons the operation shows, in the order its tasks come: its own groups, each as its task begins, and each
// learn task's control, shown once that task has begun (its begun flag, game/objectives.js), so it is never done in the
// pause before it)
function lessonsOf(op) {
  const own = (op.lessons ?? []).map((l) => ({ l, at: l.when ? l.when.gte : 0 }));
  const learnt = op.tasks.map((t, i) => (t.learn ? { l: { ...FRAME_LESSONS[t.learn], when: { var: `${FRAME_LESSON_TASK}_in${i}`, gte: 1 } }, at: i } : null)).filter(Boolean);
  return [...own, ...learnt].map((x, n) => ({ ...x, n })).sort((a, b) => a.at - b.at || a.n - b.n).map((x) => x.l);
}

/** An operation's lessons checked (throws, teaching) and lowered to the guide's: [{ keys, fact?, when? }]. */
export function readFrameLessons(v, taskCount, at = 'operation.lessons') {
  if (!Array.isArray(v) || !v.length) throw new Error(`${at} is [{ teach: [<word>…], at?: <task number> }]: the frame's controls taught a group at a time (words: ${Object.keys(FRAME_LESSONS).join(', ')})`);
  const out = [];
  v.forEach((g, i) => {
    const gat = `${at}[${i}]`;
    if (!g || typeof g !== 'object' || Array.isArray(g)) throw new Error(`${gat} is { teach: [<word>…], at?: <task number> }`);
    for (const k of Object.keys(g)) if (!['teach', 'at'].includes(k)) throw new Error(`${gat}.${k} is not part of a lesson group (teach, at)`);
    if (!Array.isArray(g.teach) || !g.teach.length) throw new Error(`${gat}.teach is the words it teaches, in order (${Object.keys(FRAME_LESSONS).join(', ')})`);
    for (const w of g.teach) if (!FRAME_LESSONS[w]) throw new Error(`${gat}.teach names '${w}': one of ${Object.keys(FRAME_LESSONS).join(', ')}`);
    const n = g.at ?? 1;
    if (!(Number.isInteger(n) && n >= 1 && n <= taskCount)) throw new Error(`${gat}.at is the task (1 to ${taskCount}) whose beginning shows it`);
    for (const w of g.teach) out.push({ ...FRAME_LESSONS[w], ...(n > 1 ? { when: { var: FRAME_LESSON_TASK, gte: n - 1 } } : {}) });
  });
  return out;
}

// the field's half-size, and a share of it as a place on the ground (round the field's middle: a geocube's land is
// not laid about the origin, assault-frame/field.js)
const halfOf = (ends) => ends.frame?.half ?? 600;
const placeOf = (ends, s) => { const h = halfOf(ends), [cx, cy] = ends.frame?.centre ?? [0, 0]; return [r2(cx + s[0] * h), r2(cy + s[1] * h)]; };
// a group's members: spread round its place by the field's dice, seeded by its id
function membersOf(g, ends) {
  let seed = 2166136261;
  for (const c of g.id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const [cx, cy] = placeOf(ends, g.at), out = [];
  for (let k = 0; k < g.count; k++) {
    const a = rnd() * Math.PI * 2, d = g.count === 1 ? 0 : g.spread * (0.4 + 0.6 * rnd());
    const x = r2(cx + Math.cos(a) * d), y = r2(cy + Math.sin(a) * d);
    out.push({ id: g.count === 1 ? g.id : `${g.id}-${k + 1}`, at: [x, y, r2(ends.ground(x, y))] });
  }
  return out;
}
const idsOf = (op, ends, groupIds) => op.groups.filter((g) => groupIds.includes(g.id)).flatMap((g) => membersOf(g, ends).map((m) => m.id));

export function operationMechanics(op, ends) {
  const tasks = op.tasks.map((t, i) => {
    if (t.down) {
      const names = op.groups.filter((g) => t.down.includes(g.id)).map((g) => `${g.count > 1 ? g.count + ' ' : ''}${g.kind === 'frame' ? 'enemy frame' : g.kind}${g.count > 1 ? 's' : ''}`).join(', ');
      return { id: `t${i + 1}`, kind: 'clear', text: t.text ?? `Destroy: ${names}`, foes: idsOf(op, ends, t.down) };
    }
    if (t.reach) { const [x, y] = placeOf(ends, t.reach); return { id: `t${i + 1}`, kind: 'reach', text: t.text ?? 'Move to the waypoint', at: [x, y, r2(ends.ground(x, y))], radius: t.radius, planar: true }; }
    if (t.scan) { const [x, y] = placeOf(ends, t.scan); return { id: `t${i + 1}`, kind: 'scan', text: t.text ?? 'Scan the site: stay inside the ring', at: [x, y, r2(ends.ground(x, y))], radius: t.radius, seconds: t.seconds, planar: true, ...(t.found ? { found: t.found } : {}) }; }
    if (t.act) return { id: `t${i + 1}`, kind: 'act', on: t.act, text: t.text ?? 'Stand by' };
    if (t.learn) { const L = FRAME_LESSONS[t.learn]; return { id: `t${i + 1}`, kind: 'act', on: `lesson:${L.fact}`, text: t.text ?? learnText(L) }; }
    return { id: `t${i + 1}`, kind: 'hold', text: t.text ?? `Hold for ${t.hold} s`, seconds: t.hold };
  });
  // (what each task's begin sets moving: the groups that come with it, the allies let go, the ally back from a split)
  const ops = tasks.map(() => []);
  for (const g of op.groups) if (g.comes) for (const m of membersOf(g, ends)) ops[g.comes - 1].push({ op: 'spawn', who: m.id, fresh: true });
  for (const a of op.allies ?? []) if (Number.isInteger(a.hold)) ops[a.hold - 1].push({ op: 'unhold', who: a.id });
  if (op.split?.back) { const S = op.split, [x, y] = placeOf(ends, S.to); ops[S.back - 1].push({ op: 'spawn', who: S.ally, at: [x, y, r2(ends.ground(x, y))] }, { op: 'unhold', who: S.ally }); }
  // (a retry: each fought group put back where it stood as its task is begun again; the pilot down is no loss then)
  const again = op.retry ? op.tasks.map((t) => (t.down ? op.groups.filter((g) => t.down.includes(g.id)).flatMap((g) => membersOf(g, ends).map((m) => ({ op: 'spawn', who: m.id, at: m.at, fresh: true }))) : [])) : null;
  // (quiet: the frame's own HUD says what it needs; the objectives show the task in hand and its own clock, no count)
  return [{ kind: 'objectives', tasks: tasks.map((o, i) => ({ ...o, ...(op.tasks[i].pause ? { pause: op.tasks[i].pause } : {}), ...(ops[i].length ? { ops: ops[i] } : {}), ...(again?.[i].length ? { again: again[i] } : {}) })), say: 'line', quiet: true, ...(op.retry ? { retry: true } : {}) }, ...(op.retry ? [] : [{ kind: 'fail-on-death', of: 'body' }])];
}

export function operationCast(op, ends) {
  const entities = [], figures = {};
  const p0 = ends.spawn;
  const toward = (at) => Math.atan2(p0[1] - at[1], p0[0] - at[0]);
  // (a group a down task names stands dormant until its task begins: the objectives wake it)
  const asleep = new Set([...op.tasks.filter((t, i) => t.down && i > 0).flatMap((t) => t.down), ...op.groups.filter((g) => g.reserve || g.comes).map((g) => g.id)]);
  for (const g of op.groups) {
    for (const m of membersOf(g, ends)) {
      const dormant = asleep.has(g.id);
      if (g.kind === 'frame') {
        const T = g.mt ? MTS[g.mt] : null;
        const fig = g.ace ? `frame-ace-${g.ace}` : T ? `frame-mt-${g.mt}` : `frame-${g.build}${g.palette ? `-${g.palette}` : ''}`;
        figures[fig] = { assault: { build: g.build, palette: g.palette ?? 'ash', ...(T ? { scale: T.scale } : {}) } };
        // (an ace: its phases on its mind, its armour its row's share over its build's, its name on it for the HUD)
        const A = g.ace ? ACES[g.ace] : null;
        const mind = A ? { range: A.phases[0].range, aggression: A.phases[0].aggression, dodge: A.phases[0].dodge, phases: A.phases } : T ? { ...T.mind } : { range: OPERATION.frameRange };
        const e = frameEntity(g.build, { id: m.id, at: m.at, heading: toward(m.at), team: 'foes', mind, figure: fig, gravity: ends.frame?.gravity, bound: ends.frame?.bound, ...(T ? { scale: T.scale, ap: T.ap } : {}), ...(ends.frame?.probe ? { probe: ends.frame.probe, collide: ends.frame.collide } : {}) });
        if (A) { const hp = Math.round(e.body.hp * A.ap); e.body = { ...e.body, hp, hpMax: hp }; e.ace = { id: g.ace, name: A.name }; }
        entities.push({ ...e, ...(dormant ? { dormant: true } : {}) });
        continue;
      }
      const U = OPERATION.units[g.kind], fig = `unit-${g.kind}`, R = unitRadius(g.kind);
      // (drawn in the form render as the frames are: its metal lit by the world, its round parts round)
      figures[fig] = { unit: { kind: g.kind, form: true } };
      entities.push({
        id: m.id, team: 'foes', ...(dormant ? { dormant: true } : {}),
        rule: { type: 'ai', space: true, speed: U.flight ? 0 : U.move ?? 0, turn: U.turn ?? 1.4, standoff: U.standoff ?? (U.move ? 120 : 0), ...(U.floor ? { floor: U.floor } : {}), ...(U.missiles ? { missiles: { ...U.missiles } } : {}), ...(U.shieldRaise ? { shieldRaise: U.shieldRaise } : {}), ...(U.flight ? { flight: { ...U.flight } } : {}), fireArc: 14, burst: 0.6, pause: 1.8, sightRange: U.range, eye: R * 0.6, ...(g.wary ? { mind: { aggressiveness: 'defensive' } } : {}) },
        ...(!U.rof ? {} : { weapon: { foeRound: true, fxColor: FOE_ROUND.color, fxScale: FOE_ROUND.size, fireClass: 'lob', auto: true, rof: U.rof, damage: U.damage, impact: 0.02, range: U.range, coreAngle: 2, assistAngle: 5, eye: R * 0.6, lobAngle: 0, projectileSpeed: U.speed, projectileGravity: 0, projRadius: 0.8, splashRadius: g.kind === 'tank' ? 4 : 0, fuse: U.range / U.speed * 1.3, noGround: true, passTeam: true, smokeTrail: g.kind === 'tank', fxColor: 0xff5a3a, foeRound: true, magazine: 9999 } }),
        body: { type: 'figure-rig', figure: fig, hittable: true, hp: U.hp, hpMax: U.hp, poise: 99, ...(U.shield ? { shield: { ...U.shield } } : {}), radius: R, egg: { a: R, c: r2(R * 0.6), cz: r2(U.hitAt ?? R * 0.4) }, aimH: r2(U.hitAt ?? R * 0.4), blast: 4 },
        transform: { pos: U.air ? [m.at[0], m.at[1], r2(m.at[2] + U.air)] : m.at, heading: toward(m.at), pitch: 0 },
        ...(U.boss ? { ace: { id: g.kind, name: U.boss } } : {}),
      });
    }
  }
  // (its reward: each part granted to the save's parts as the operation is won, the game channel's `wins`)
  // (its allies: stood beside the drop, a little behind, facing the way on; a leader's places the operation's reaches' and
  // scans', in order, each with the radius the pilot meets it in)
  const places = op.tasks.map((t) => t.reach ?? t.scan ? (() => { const [x, y] = placeOf(ends, t.reach ?? t.scan); return { at: [x, y, r2(ends.ground(x, y))], r: t.radius }; })() : null).filter(Boolean);
  (op.allies ?? []).forEach((a, i) => {
    const fig = `frame-ally-${a.id}`, side = i % 2 ? -1 : 1, x = r2(p0[0] + side * (40 + 20 * i)), y = r2(p0[1] - 20), at = [x, y, r2(ends.ground(x, y))];
    figures[fig] = { assault: { build: a.build, palette: a.palette } };
    const e = frameEntity(a.build, { id: a.id, at, heading: ends.heading ?? Math.PI / 2, mind: { range: OPERATION.frameRange, aggression: 0.5, dodge: 0.5, ally: true, engage: a.hold ? ALLY.engage / 2 : ALLY.engage, ...(a.lead && places.length ? { lead: places } : {}), ...(a.hold ? { hold: true } : {}) }, figure: fig, gravity: ends.frame?.gravity, bound: ends.frame?.bound, ap: a.ap, ...(ends.frame?.probe ? { probe: ends.frame.probe, collide: ends.frame.collide } : {}) });
    entities.push({ ...e, ally: { name: a.name } });
  });
  // (its props: each stood raised over its place, asleep while hidden; its place a spot of its id, and each task's place
  // the spot t<n>, for the scenes to frame and to set things down on)
  const spots = [];
  op.tasks.forEach((t, i) => { if (t.reach ?? t.scan) { const [x, y] = placeOf(ends, t.reach ?? t.scan); spots.push({ id: `t${i + 1}`, at: [x, y, r2(ends.ground(x, y))] }); } });
  // (each group's intro, a scene on the moment it first comes)
  const intros = op.groups.filter((g) => g.intro).map((g) => {
    const k = op.tasks.findIndex((t) => t.down && t.down.includes(g.id)), ids = membersOf(g, ends).map((m) => m.id), I = g.intro;
    const title = I.title ?? (g.kind === 'frame' ? (g.ace ? ACES[g.ace].name : 'enemy frame') : GROUND_UNITS[g.kind]?.label ?? g.kind).toUpperCase();
    return { id: `intro-${g.id}`, when: k >= 0 ? { on: 'objective:begin', match: { task: `t${k + 1}` } } : { start: true }, beats: [
      { shot: { frame: 'wide', on: ids, move: 'push' }, for: 0.6 },
      { do: { say: title, as: 'banner', ttl: FOE_INTRO.banner } },
      ...(I.line ? [{ line: { who: I.who, say: I.line } }] : [{ wait: FOE_INTRO.hold }]),
    ] };
  });
  // (the split: the scene of an ally and a foe off together, SPLIT; where they go a spot of its own)
  const S = op.split, splits = [];
  if (S) {
    const [x, y] = placeOf(ends, S.to), to = `split-${S.ally}`, G = op.groups.find((g) => g.id === S.foe);
    spots.push({ id: to, at: [x, y, r2(ends.ground(x, y))] });
    const fought = op.tasks[S.at - 1].down ?? [], shown = [...new Set([S.foe, ...fought])].flatMap((id) => membersOf(op.groups.find((g) => g.id === id), ends).map((m) => m.id));
    splits.push({ id: `split-${S.ally}`, when: { on: 'objective:begin', match: { task: `t${S.at}` } }, beats: [
      ...(S.title ? [{ shot: { frame: 'wide', on: shown, move: 'push' }, for: 0.6 }, { do: { say: S.title, as: 'banner', ttl: SPLIT.banner } }, { wait: SPLIT.banner }] : []),
      // (the ally alone as it speaks: two bodies a fight apart are specks in one frame; then the two of them as they go,
      // drawing together toward where they fight)
      { shot: { frame: 'low', on: [S.ally], move: 'track' }, for: 0.6 },
      ...(S.line ? [{ line: { who: S.line.who, say: S.line.say } }] : []),
      { do: [{ walk: { who: S.ally, to, speed: SPLIT.speed } }, { walk: { who: S.foe, to, speed: SPLIT.speed } }] },
      { shot: { frame: 'wide', on: [S.ally, membersOf(G, ends)[0].id], move: 'track' }, for: 0.6 },
      { wait: SPLIT.leave },
      { do: [{ vanish: S.ally }, { vanish: S.foe }] },
    ] });
  }
  // (each task's alarm: a level cue as it begins, OP_ALARM)
  const alarms = op.tasks.map((t, i) => (t.alarm ? { id: `alarm-t${i + 1}`, once: true, when: { on: 'objective:begin', match: { task: `t${i + 1}` } }, then: { warning: { say: t.alarm, title: OP_ALARM.title, ttl: OP_ALARM.ttl } } } : null)).filter(Boolean);
  for (const [k, m] of Object.entries(op.marks ?? {})) { const [x, y] = placeOf(ends, m); spots.push({ id: k, at: [x, y, r2(ends.ground(x, y))] }); }
  for (const p of op.props ?? []) {
    const [x, y] = placeOf(ends, p.at), z = r2(ends.ground(x, y)), fig = `prop-${p.unit}`, face = p.face !== undefined ? (p.face * Math.PI) / 180 : toward([x, y]);
    figures[fig] = { unit: { kind: p.unit, form: true } };
    entities.push({ id: p.id, ...(p.hidden ? { dormant: true } : {}), body: { type: 'figure-rig', figure: fig, hittable: false, radius: unitRadius(p.unit) }, transform: { pos: [x, y, r2(z + (p.raise ?? 0))], heading: face, pitch: 0 } });
    spots.push({ id: p.id, at: [x, y, z], face: r2((face * 180) / Math.PI) });
  }
  const scenes = [...intros, ...splits];
  return { entities, figures, ...(op.props || op.marks || scenes.length || alarms.length ? { play: { spots, ...(scenes.length ? { scenes } : {}), ...(alarms.length ? { cues: alarms } : {}) } } : {}), ...(op.reward ? { wins: op.reward.map((item) => ({ type: 'grant', slice: PARTS_SLICE, item, count: 1 })) } : {}), ...(op.lessons || op.tasks.some((t) => t.learn) ? { lessons: lessonsOf(op) } : {}), ...(op.script ? { script: op.script } : {}) };
}
