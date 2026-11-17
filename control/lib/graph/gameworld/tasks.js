/**
 * A LEVEL'S TASKS — its fights in order, each one of the game's kept fights (fights.js `gameworld.fights`, settled in the
 * practice door's game room) laid in a place the level gives, by the room's own rules (gameroom/fight.js layFight). The
 * level is the geocube's (a building's rooms); the fight is the room's; this lays one in the other.
 *
 *   goal: { tasks: [{ fight: '<a kept fight's name>', at: '<a room of the building>' }, …] }
 *     in the order they are fought. Each is sealed at its room's doorways from the moment the hero steps into its ring
 *     until its last wave is down; the last one down ends the level. The hero's hp is the tasks' (a hit FIGHT_HIT of a
 *     hundred); a death begins the fight it fell in again, at the doorway it came in by.
 *
 *   TASK_KINDS                 the closed table (a new kind a row): fight
 *   readTasks(v, { fights, at }) → v, checked (throws, teaching): each names a kept fight and a room
 *   taskFoeIds(G)              → the bestiary ids the levels' tasks wake (they are fielded, so they are made)
 *   layTasks(G, level, stage)  → { laid: [{ task, fight, room, fight: the laid fight, placed, laws }], props, mechanic,
 *                                audits, findings } for a building stage: each fight laid in its room (its doorways the
 *                                ways), its pieces as the stage's props (era/compose-dress.js PIECES), its foes placed,
 *                                the wave gauntlet over them all (an arena a task: entered at its ring, its doorways
 *                                sealed while it stands), and the way a scripted player walks them
 *   tasksCast(G, level, stage, { refs, hero }) → { figures, entities, pilot, props } the foes stood asleep, the pilot
 *                                made hittable, the props (a stage's extra, as a gauntlet's cast is)
 *   PROP_OF                    a room primitive's piece on a stage
 *
 * Pure.
 */
import { layFight } from '../gameroom/fight.js';
import { roomNeeds } from '../gameroom/needs.js';
import { fightLaws, fitsLaw } from '../gameroom/laws.js';
import { PRIMITIVES } from '../gameroom/primitives.js';
import { withProgram } from '../era/programs.js';
import { fightOf, fightCast, fightWaves, fightPlacements, FIGHT_HIT, taskFoeIds } from './fights.js';
export { taskFoeIds };
import { standFoe, bestiaryOf, stompOf, targetRimOf } from './foes.js';
import { PERSON } from './quick.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;
/** A room primitive's piece on a stage (era/compose-dress.js PIECES); a mark and a deck stand none. */
export const PROP_OF = Object.freeze({ 'cover-low': 'barrier', 'cover-tall': 'shelves', pillar: 'pillar', perch: 'perch', urn: 'urn', font: 'font', dais: 'dais', crate: 'crate' });

export { TASK_KINDS, readTasks } from './task-read.js';

// where two joined rooms' doorway stands: the middle of the wall they share
function doorway(a, b) {
  const lo = (u0, u1, v0, v1) => (Math.max(u0, v0) + Math.min(u1, v1)) / 2;
  if (Math.abs(a.x + a.w - b.x) < 1e-6) return [a.x + a.w, lo(a.y, a.y + a.d, b.y, b.y + b.d)];
  if (Math.abs(b.x + b.w - a.x) < 1e-6) return [a.x, lo(a.y, a.y + a.d, b.y, b.y + b.d)];
  if (Math.abs(a.y + a.d - b.y) < 1e-6) return [lo(a.x, a.x + a.w, b.x, b.x + b.w), a.y + a.d];
  if (Math.abs(b.y + b.d - a.y) < 1e-6) return [lo(a.x, a.x + a.w, b.x, b.x + b.w), a.y];
  return null;
}

export function layTasks(G, level, stage) {
  const tasks = G.levels[level]?.goal?.tasks ?? [], plan = withProgram(stage.manifest), needs = roomNeeds(G);
  const rooms = new Map(plan.rooms.map((r) => [r.id, r])), findings = [];
  // each room's doorways, and the one it is come into by (the link that leads to it from the way in)
  const doors = new Map(plan.rooms.map((r) => [r.id, []]));
  for (const L of plan.links) {
    const a = rooms.get(L.from), b = rooms.get(L.to), at = a && b ? doorway(a, b) : null;
    if (!at) continue;
    doors.get(a.id).push({ id: `${L.from}>${L.to}`, at, to: L.to });
    doors.get(b.id).push({ id: `${L.from}>${L.to}`, at, to: L.from, into: true });
  }
  const laid = [], props = [], arenas = [], via = [];
  tasks.forEach((T, k) => {
    const F = fightOf(G, T.fight), R = rooms.get(T.at);
    if (!F) { findings.push(`task ${k + 1}: no kept fight '${T.fight}'`); return; }
    if (!R) { findings.push(`task ${k + 1}: the building has no room '${T.at}' (${plan.rooms.map((r) => r.id).join(', ')})`); return; }
    // (the room it is come into by: a doorway from the way in's side; the building's first room, by its front, -y)
    const ways = doors.get(R.id), entry = ways.find((w) => w.into)?.id ?? null, from = entry ? null : [R.x + R.w / 2, R.y];
    const box = { x: R.x, y: R.y, w: R.w, d: R.d, h: R.h, z: R.z0 ?? 0 };
    const fight = layFight(needs, { kind: F.kind, seed: F.seed, box, ways: ways.map((w) => ({ id: w.id, at: w.at })), entry, from });
    const laws = [...fightLaws(fight.local, needs), fitsLaw(box, needs, F.kind)];
    const placed = fightPlacements(G, fight, fightCast(G, F.kind, F.waves ?? null), { tag: `t${k + 1}` });
    for (const p of fight.primitives) {
      const kind = PROP_OF[p.kind];
      if (!kind || PRIMITIVES[p.kind].mark) continue;
      props.push({ id: `${T.at}/fight/${p.id}`, kind, room: R.id, at: [p.at[0], p.at[1]], facing: p.rot === 90 ? '+x' : '+y' });
    }
    arenas.push({
      waves: placed.map((wave) => ({ foes: wave.map((f) => ({ id: f.id, at: f.at })) })),
      enter: { at: fight.anchors.ring.at.slice(), radius: fight.anchors.ring.r },
      seals: fight.anchors.ways.map((w) => ({ at: w.at.slice(), radius: 1.4, back: w.back.slice() })),
      start: fight.anchors.spawn.slice(),
    });
    // (the way a scripted player takes it: in by its doorway, to its ring)
    via.push(fight.anchors.spawn.slice(), fight.anchors.ring.at.slice());
    laid.push({ task: k + 1, name: T.fight, room: T.at, kind: F.kind, fight, placed, laws, waves: fightWaves(G, F.kind, F.waves ?? null) });
    for (const l of laws) if (!l.holds) findings.push(`task ${k + 1} (${T.fight} in the ${T.at}): ${l.law}: ${l.says}`);
    if (fight.left.length) findings.push(`task ${k + 1} (${T.fight} in the ${T.at}): left out before a doorway: ${fight.left.join(', ')}`);
  });
  const mechanic = arenas.length ? { kind: 'wave-gauntlet', id: 'tasks', arenas, hits: FIGHT_HIT, checkpoint: 1 } : null;
  const last = via.length ? via[via.length - 1] : null;
  const audits = last ? [{ kind: 'walkto', via: via.slice(0, -1).map((p) => p.map(r3)), target: last.map(r3) }] : [];
  return { laid, props, mechanic, audits, findings };
}

export function tasksCast(G, level, stage, { refs = {}, hero = true } = {}) {
  const L = layTasks(G, level, stage);
  if (!L.mechanic) return null;
  const B = bestiaryOf(G), figures = {}, entities = [], part = { figures, entities }, ctx = { rim: targetRimOf(G), sheets: {} };
  for (const t of L.laid) for (const p of t.placed.flat()) standFoe(G, part, { id: p.id, eid: p.eid, entry: p.rank ? { ...B[p.eid], rank: p.rank } : B[p.eid], at: p.at.slice(), heading: p.heading }, { ref: refs[p.eid] ?? null, more: { dormant: true, modeRefs: refs }, ctx });
  const pilot = { ...(hero ? { rule: { stomp: stompOf(G) } } : {}), body: { hittable: true, radius: 0.5, egg: { ...PERSON, cz: hero ? PERSON.c : PERSON.c - 1.7 } } };
  return { figures, entities, pilot, props: L.props };
}
