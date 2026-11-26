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
 *     tasks    [{ down: <group id> | [ids] | true, text? } | { reach: [x, y], radius?, text? } | { hold: seconds, text? }]
 *              a down task's groups stand dormant until it begins (objectives wake them); true: every group
 *
 *   OPERATION                      the numbers: a unit's armour and guns at a frame's scale, a reach's radius
 *   readOperation(v, at)           → the operation; throws, teaching
 *   operationMechanics(op, ends)   → the level's mechanics: the objectives, the frame's armour its life (fail-on-death)
 *   operationCast(op, ends)        → { entities, figures } the groups stood on the field
 *   OPERATION_LEGEND               the keys the play adds to the level's legend
 *
 * Pure: the dice are the field's, seeded by the group's id.
 */
import { unitRadius } from '../groundforce/index.js';
import { ACES, readAce } from '../assault-frame/aces.js';
import { MTS, readMt } from '../assault-frame/mts.js';
import { frameEntity } from '../assault-frame/pilot.js';
import { STOCK, PARTS } from '../assault-frame/parts.js';
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
    gnat: Object.freeze({ hp: 700, damage: 32, rof: 4, range: 260, speed: 420, move: 30, air: 30, standoff: 55, turn: 3.2, floor: 10 }),
  }),
  reach: 60,
  // (an enemy frame fights with the pilot's own weapons and armour, kept off its own team's rounds)
  frameRange: 140,
});
// (the enemy's rounds: a hot red-orange in the shot's look, scene/channels/controllable/index.js foeLooks)
const FOE_ROUND = Object.freeze({ color: 0xff5a36, size: 0.42 });
export const OPERATION_LEGEND = 'mouse  turn & aim · W A S D  move · Shift  boost · C  quick boost · X  assault boost · F  kick · Space  jump, hold to climb · click / right click  hands · Q / E  shoulders';
const KINDS = ['turret', 'tank', 'walker', 'gnat', 'wasp', 'kite', 'harrow', 'thunderhead', 'hammer', 'bastion', 'frame'];

export function readOperation(v, at = 'goal.operation') {
  if (!isObj(v)) throw new Error(`${at} is { groups, tasks, time? }: the enemy on the field and what is done about it`);
  for (const k of Object.keys(v)) if (!['groups', 'tasks', 'time', 'reward', 'briefing', 'lessons'].includes(k)) throw new Error(`${at}.${k} is not part of an operation (groups, tasks, time, reward, briefing, lessons)`);
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
    return { id: g.id, kind: g.kind, count, at: g.at.slice(), spread: g.spread ?? 40, ...(g.kind === 'frame' ? { build: g.ace ? ACES[g.ace].build : g.mt ? MTS[g.mt].build : g.build ?? 'raptor' } : {}), ...(g.mt ? { mt: g.mt, palette: MTS[g.mt].palette } : {}), ...(g.ace ? { ace: g.ace, palette: ACES[g.ace].palette } : {}), ...(g.palette ? { palette: g.palette } : {}), ...(g.reserve ? { reserve: true } : {}) };
  });
  if (!Array.isArray(v.tasks) || !v.tasks.length) throw new Error(`${at}.tasks is a list: { down }, { reach }, { hold }`);
  const tasks = v.tasks.map((t, i) => {
    const tat = `${at}.tasks[${i}]`;
    if (!isObj(t)) throw new Error(`${tat} is { down } | { reach } | { hold }`);
    if (t.down !== undefined) {
      const of = t.down === true ? [...ids] : [].concat(t.down);
      for (const id of of) if (!ids.has(id)) throw new Error(`${tat}.down names '${id}', not a group (${[...ids].join(', ')})`);
      return { down: of, ...(t.text ? { text: t.text } : {}) };
    }
    if (t.reach !== undefined) {
      if (!(Array.isArray(t.reach) && t.reach.length === 2 && t.reach.every((x) => Number.isFinite(x) && Math.abs(x) <= 1))) throw new Error(`${tat}.reach is [x, y], each −1..1`);
      return { reach: t.reach.slice(), radius: t.radius ?? OPERATION.reach, ...(t.text ? { text: t.text } : {}) };
    }
    if (t.hold !== undefined) {
      if (!(Number.isFinite(t.hold) && t.hold > 0)) throw new Error(`${tat}.hold is seconds`);
      return { hold: t.hold, ...(t.text ? { text: t.text } : {}) };
    }
    throw new Error(`${tat} is { down } | { reach } | { hold }`);
  });
  // (its lessons: the frame's controls taught one at a time, each group as its task begins: FRAME_LESSONS)
  const lessons = v.lessons === undefined ? null : readFrameLessons(v.lessons, tasks.length, `${at}.lessons`);
  return { groups, tasks, ...(v.time ? { time: v.time } : {}), ...(v.reward?.length ? { reward: [...new Set(v.reward)] } : {}), ...(lessons ? { lessons } : {}) };
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
    return { id: `t${i + 1}`, kind: 'hold', text: t.text ?? `Hold for ${t.hold} s`, seconds: t.hold };
  });
  return [{ kind: 'objectives', tasks, say: 'line' }, { kind: 'fail-on-death', of: 'body' }];
}

export function operationCast(op, ends) {
  const entities = [], figures = {};
  const p0 = ends.spawn;
  const toward = (at) => Math.atan2(p0[1] - at[1], p0[0] - at[0]);
  // (a group a down task names stands dormant until its task begins: the objectives wake it)
  const asleep = new Set([...op.tasks.filter((t, i) => t.down && i > 0).flatMap((t) => t.down), ...op.groups.filter((g) => g.reserve).map((g) => g.id)]);
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
        rule: { type: 'ai', space: true, speed: U.flight ? 0 : U.move ?? 0, turn: U.turn ?? 1.4, standoff: U.standoff ?? (U.move ? 120 : 0), ...(U.floor ? { floor: U.floor } : {}), ...(U.missiles ? { missiles: { ...U.missiles } } : {}), ...(U.shieldRaise ? { shieldRaise: U.shieldRaise } : {}), ...(U.flight ? { flight: { ...U.flight } } : {}), fireArc: 14, burst: 0.6, pause: 1.8, sightRange: U.range, eye: R * 0.6 },
        ...(!U.rof ? {} : { weapon: { foeRound: true, fxColor: FOE_ROUND.color, fxScale: FOE_ROUND.size, fireClass: 'lob', auto: true, rof: U.rof, damage: U.damage, impact: 0.02, range: U.range, coreAngle: 2, assistAngle: 5, eye: R * 0.6, lobAngle: 0, projectileSpeed: U.speed, projectileGravity: 0, projRadius: 0.8, splashRadius: g.kind === 'tank' ? 4 : 0, fuse: U.range / U.speed * 1.3, noGround: true, passTeam: true, smokeTrail: g.kind === 'tank', fxColor: 0xff5a3a, foeRound: true, magazine: 9999 } }),
        body: { type: 'figure-rig', figure: fig, hittable: true, hp: U.hp, hpMax: U.hp, poise: 99, ...(U.shield ? { shield: { ...U.shield } } : {}), radius: R, egg: { a: R, c: r2(R * 0.6), cz: r2(U.hitAt ?? R * 0.4) }, aimH: r2(U.hitAt ?? R * 0.4), blast: 4 },
        transform: { pos: U.air ? [m.at[0], m.at[1], r2(m.at[2] + U.air)] : m.at, heading: toward(m.at), pitch: 0 },
        ...(U.boss ? { ace: { id: g.kind, name: U.boss } } : {}),
      });
    }
  }
  // (its reward: each part granted to the save's parts as the operation is won, the game channel's `wins`)
  return { entities, figures, ...(op.reward ? { wins: op.reward.map((item) => ({ type: 'grant', slice: PARTS_SLICE, item, count: 1 })) } : {}), ...(op.lessons ? { lessons: op.lessons } : {}) };
}
