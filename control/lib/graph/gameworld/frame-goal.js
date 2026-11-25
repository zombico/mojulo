/**
 * THE OPERATION — what a frame level is fought for (an airspace level with a `frame`, assault-frame/): groups of the enemy
 * on the field, the ground force's units (groundforce/: a gun emplacement, a hover tank, a personnel walker, at a frame's
 * scale) and enemy frames (assault-frame/ STOCK builds on the frame rule, each with its own mind), and tasks done in order on
 * the objectives mechanic (game/objectives.js), in the level's own words.
 *
 *   goal: { operation: { groups: [...], tasks: [...], time? } }
 *     groups   [{ id, kind: 'turret' | 'tank' | 'walker' | 'frame', count?, at: [x, y] (a share of the field: −1..1 each
 *              way, the frame starting at [0, −0.55]), spread? (m), build? (a frame's: a STOCK name), palette? }]
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
  }),
  reach: 60,
  // (an enemy frame fights with the pilot's own weapons and armour, kept off its own team's rounds)
  frameRange: 140,
});
export const OPERATION_LEGEND = 'mouse  turn & aim · W A S D  move · Shift  boost · C  quick boost · X  assault boost · F  kick · Space  jump, hold to climb · click / right click  hands · Q / E  shoulders';
const KINDS = ['turret', 'tank', 'walker', 'frame'];

export function readOperation(v, at = 'goal.operation') {
  if (!isObj(v)) throw new Error(`${at} is { groups, tasks, time? }: the enemy on the field and what is done about it`);
  for (const k of Object.keys(v)) if (!['groups', 'tasks', 'time'].includes(k)) throw new Error(`${at}.${k} is not part of an operation (groups, tasks, time)`);
  if (!Array.isArray(v.groups) || !v.groups.length) throw new Error(`${at}.groups is a list of the enemy's groups`);
  const ids = new Set();
  const groups = v.groups.map((g, i) => {
    const gat = `${at}.groups[${i}]`;
    if (!isObj(g) || typeof g.id !== 'string' || !/^[a-z][a-z0-9-]{0,23}$/.test(g.id)) throw new Error(`${gat} is { id, kind, count?, at, spread?, build? } (id a short lower-case name)`);
    if (ids.has(g.id)) throw new Error(`${gat}.id '${g.id}' is used twice`);
    ids.add(g.id);
    if (!KINDS.includes(g.kind)) throw new Error(`${gat}.kind is one of ${KINDS.join(', ')}`);
    if (!(Array.isArray(g.at) && g.at.length === 2 && g.at.every((x) => Number.isFinite(x) && Math.abs(x) <= 1))) throw new Error(`${gat}.at is [x, y], each −1..1: a share of the field`);
    const count = g.count ?? 1;
    if (!(Number.isInteger(count) && count >= 1 && count <= 12)) throw new Error(`${gat}.count is 1 to 12`);
    if (g.build !== undefined && (g.kind !== 'frame' || !STOCK[g.build])) throw new Error(`${gat}.build is a frame's: ${Object.keys(STOCK).join(', ')}`);
    return { id: g.id, kind: g.kind, count, at: g.at.slice(), spread: g.spread ?? 40, ...(g.kind === 'frame' ? { build: g.build ?? 'raptor' } : {}), ...(g.palette ? { palette: g.palette } : {}) };
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
  const asleep = new Set(op.tasks.filter((t, i) => t.down && i > 0).flatMap((t) => t.down));
  for (const g of op.groups) {
    for (const m of membersOf(g, ends)) {
      const dormant = asleep.has(g.id);
      if (g.kind === 'frame') {
        const fig = `frame-${g.build}${g.palette ? `-${g.palette}` : ''}`;
        figures[fig] = { assault: { build: g.build, palette: g.palette ?? 'ash' } };
        const e = frameEntity(g.build, { id: m.id, at: m.at, heading: toward(m.at), team: 'foes', mind: { range: OPERATION.frameRange }, figure: fig, gravity: ends.frame?.gravity, bound: ends.frame?.bound });
        entities.push({ ...e, ...(dormant ? { dormant: true } : {}) });
        continue;
      }
      const U = OPERATION.units[g.kind], fig = `unit-${g.kind}`, R = unitRadius(g.kind);
      figures[fig] = { unit: { kind: g.kind } };
      entities.push({
        id: m.id, team: 'foes', ...(dormant ? { dormant: true } : {}),
        rule: { type: 'ai', space: true, speed: U.move ?? 0, turn: 1.4, standoff: U.move ? 120 : 0, fireArc: 14, burst: 0.6, pause: 1.8, sightRange: U.range, eye: R * 0.6 },
        weapon: { fireClass: 'lob', auto: true, rof: U.rof, damage: U.damage, impact: 0.02, range: U.range, coreAngle: 2, assistAngle: 5, eye: R * 0.6, lobAngle: 0, projectileSpeed: U.speed, projectileGravity: 0, projRadius: 0.8, splashRadius: g.kind === 'tank' ? 4 : 0, fuse: U.range / U.speed * 1.3, noGround: true, passTeam: true, smokeTrail: g.kind === 'tank', fxColor: 0xff5a3a, foeRound: true, magazine: 9999 },
        body: { type: 'figure-rig', figure: fig, hittable: true, hp: U.hp, hpMax: U.hp, poise: 99, radius: R, egg: { a: R, c: r2(R * 0.6), cz: r2(R * 0.4) }, aimH: r2(R * 0.4), blast: 4 },
        transform: { pos: m.at, heading: toward(m.at), pitch: 0 },
      });
    }
  }
  return { entities, figures };
}
