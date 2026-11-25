/**
 * THE OPERATION — what a frame level is fought for (an airspace level with a `frame`, assault-frame/): groups of the enemy
 * on the field, the ground force's units (groundforce/: a gun emplacement, a hover tank, a personnel walker, at a frame's
 * scale) and enemy frames (assault-frame/ STOCK builds on the frame rule, each with its own mind), and tasks done in order on
 * the objectives mechanic (game/objectives.js), in the level's own words.
 *
 *   goal: { operation: { groups: [...], tasks: [...], time? } }
 *     groups   [{ id, kind: 'turret' | 'tank' | 'walker' | 'gnat' (a flier, stood in the air) | 'hammer' (a missile
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
import { STOCK } from '../assault-frame/parts.js';

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
    gnat: Object.freeze({ hp: 700, damage: 32, rof: 4, range: 260, speed: 420, move: 30, air: 30, standoff: 55, turn: 3.2, floor: 10 }),
  }),
  reach: 60,
  // (an enemy frame fights with the pilot's own weapons and armour, kept off its own team's rounds)
  frameRange: 140,
});
// (the enemy's rounds: a hot red-orange in the shot's look, scene/channels/controllable/index.js foeLooks)
const FOE_ROUND = Object.freeze({ color: 0xff5a36, size: 0.42 });
export const OPERATION_LEGEND = 'mouse  turn & aim · W A S D  move · Shift  boost · C  quick boost · X  assault boost · F  kick · Space  jump, hold to climb · click / right click  hands · Q / E  shoulders';
const KINDS = ['turret', 'tank', 'walker', 'gnat', 'hammer', 'bastion', 'frame'];

export function readOperation(v, at = 'goal.operation') {
  if (!isObj(v)) throw new Error(`${at} is { groups, tasks, time? }: the enemy on the field and what is done about it`);
  for (const k of Object.keys(v)) if (!['groups', 'tasks', 'time'].includes(k)) throw new Error(`${at}.${k} is not part of an operation (groups, tasks, time)`);
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
  return { groups, tasks, ...(v.time ? { time: v.time } : {}) };
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
        const e = frameEntity(g.build, { id: m.id, at: m.at, heading: toward(m.at), team: 'foes', mind, figure: fig, gravity: ends.frame?.gravity, bound: ends.frame?.bound, ...(T ? { scale: T.scale, ap: T.ap } : {}) });
        if (A) { const hp = Math.round(e.body.hp * A.ap); e.body = { ...e.body, hp, hpMax: hp }; e.ace = { id: g.ace, name: A.name }; }
        entities.push({ ...e, ...(dormant ? { dormant: true } : {}) });
        continue;
      }
      const U = OPERATION.units[g.kind], fig = `unit-${g.kind}`, R = unitRadius(g.kind);
      figures[fig] = { unit: { kind: g.kind } };
      entities.push({
        id: m.id, team: 'foes', ...(dormant ? { dormant: true } : {}),
        rule: { type: 'ai', space: true, speed: U.move ?? 0, turn: U.turn ?? 1.4, standoff: U.standoff ?? (U.move ? 120 : 0), ...(U.floor ? { floor: U.floor } : {}), ...(U.missiles ? { missiles: { ...U.missiles } } : {}), ...(U.shieldRaise ? { shieldRaise: U.shieldRaise } : {}), fireArc: 14, burst: 0.6, pause: 1.8, sightRange: U.range, eye: R * 0.6 },
        ...(U.missiles ? {} : { weapon: { foeRound: true, fxColor: FOE_ROUND.color, fxScale: FOE_ROUND.size, fireClass: 'lob', auto: true, rof: U.rof, damage: U.damage, impact: 0.02, range: U.range, coreAngle: 2, assistAngle: 5, eye: R * 0.6, lobAngle: 0, projectileSpeed: U.speed, projectileGravity: 0, projRadius: 0.8, splashRadius: g.kind === 'tank' ? 4 : 0, fuse: U.range / U.speed * 1.3, noGround: true, passTeam: true, smokeTrail: g.kind === 'tank', fxColor: 0xff5a3a, foeRound: true, magazine: 9999 } }),
        body: { type: 'figure-rig', figure: fig, hittable: true, hp: U.hp, hpMax: U.hp, poise: 99, ...(U.shield ? { shield: { ...U.shield } } : {}), radius: R, egg: { a: R, c: r2(R * 0.6), cz: r2(R * 0.4) }, aimH: r2(R * 0.4), blast: 4 },
        transform: { pos: U.air ? [m.at[0], m.at[1], r2(m.at[2] + U.air)] : m.at, heading: toward(m.at), pitch: 0 },
      });
    }
  }
  return { entities, figures };
}
