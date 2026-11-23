/**
 * A BOSS STOOD — a boss off the shelf as the words a level's entity carries for the director (worlds/controllable/boss.js):
 * its moves resolved to their tuned patterns (so the page needs no shelf), its phases, its mind a boss's (a human's), its
 * body (a vehicle's: a hull sized to it, its hit shape spanning it; its parts drawn by the page, boss-view.js).
 *
 *   bossRule(id, { arena?, seed?, first?, figures? }) → rule.boss for a human boss (BOSSES); `figures` { <look>: <figure> }
 *                                                 the figure each of its looks wears (a phase's `look` swaps to it)
 *   bossMind(id)                                → its rule.mind: { rank: 'boss', phases } (mind.js crosses them)
 *   vehicleRule(id, { route?, runs?, packages?, seed?, first? }) → rule.boss for a vehicle boss (VEHICLES); a carrier's
 *                                                 `packages` ([{ id, at }]: what its hacked drones fetch)
 *   vehicleEntity(id, { at, heading?, hp?, route?, runs?, packages?, team?, seed? }) → a whole entity: its rule its own
 *                                                 (nothing else drives it), its body hittable, its boss words; a vehicle of
 *                                                 the mecha shelf (`frame`) drawn as its figure (the figure named its id:
 *                                                 gameworld/combat/boss-figures.js builds it)
 *   carrierEntities(id, { at, heading?, crewBody, droneFigure?, team? }) → a carrier's gunners (people, `crewBody` the
 *                                                 body each is drawn with) and its drones (`droneFigure` theirs), each
 *                                                 riding it as the director places it (worlds/controllable/boss.js)
 *
 * Pure.
 */
import { readBoss, moveOf, mindPhases, mindOf } from './bosses.js';
import { readVehicle } from './vehicles.js';
import { readPattern } from './patterns.js';

const tuned = (m) => { const P = readPattern(m.pattern), T = m.tune || {}; return { ...P, pattern: m.pattern, says: m.says, ...(T.reach ? { reach: T.reach } : {}), tell: { ...P.tell, says: m.says }, hazards: P.hazards.map((h) => ({ ...h, ...(T.harm ? { harm: T.harm } : {}) })) }; };

export function bossRule(id, { arena = null, seed = 1, first = 2.5, figures = null } = {}) {
  const B = readBoss(id);
  return { kind: 'human', name: B.name, title: B.title, look: { ...B.look }, seed, first,
    moves: Object.fromEntries(Object.keys(B.moves).map((m) => [m, { ...moveOf(B, m), pattern: B.moves[m].pattern }])),
    phases: B.phases.map((p) => ({ moves: { ...p.moves }, tempo: p.tempo, ...(p.event ? { event: p.event } : {}), ...(p.look && figures && figures[p.look] ? { figure: figures[p.look] } : {}) })),
    ...(B.counters ? { counters: JSON.parse(JSON.stringify(B.counters)) } : {}),
    // (the figures its looks wear, `figures`: { <look>: <figure name> }, the page building each so a phase's swap is warm)
    ...(figures ? { figures: Object.values(figures) } : {}),
    ...(arena ? { arena } : {}) };
}

export const bossMind = (id) => ({ ...mindOf(id), rank: 'boss', phases: mindPhases(id) });

export function vehicleRule(id, { route = null, runs = null, packages = null, seed = 1, first = 3 } = {}) {
  const V = readVehicle(id);
  return { kind: 'vehicle', name: V.name, title: V.title || V.reads, look: { ...V.look }, size: [...V.size], speed: V.speed, seed, first,
    parts: JSON.parse(JSON.stringify(V.parts)), dress: JSON.parse(JSON.stringify(V.dress || [])), states: JSON.parse(JSON.stringify(V.states)), start: Object.keys(V.states)[0],
    moves: Object.fromEntries(Object.entries(V.moves).map(([m, x]) => [m, tuned(x)])),
    ...(route ? { route: route.map((q) => [q[0], q[1]]) } : {}), ...(runs ? { runs: runs.map((q) => [q[0], q[1]]) } : {}),
    ...(V.frame ? { frame: V.frame, ...(V.stride ? { stride: { ...V.stride } } : {}) } : {}), ...(V.turn ? { turn: V.turn } : {}),
    ...(V.carrier ? { carrier: { ...JSON.parse(JSON.stringify(V.carrier)), packages: (packages || []).map((k) => ({ id: k.id, at: [k.at[0], k.at[1], k.at[2] ?? 0] })) } } : {}) };
}

export function vehicleEntity(id, { at, heading = 0, hp = 1000, route = null, runs = null, packages = null, team = 'guards', seed = 1 } = {}) {
  const V = readVehicle(id), [L, W, H] = V.size, R = vehicleRule(id, { route, runs, packages, seed });
  const hit = { hittable: true, hp, radius: Math.max(L, W) / 2, egg: { a: Math.max(L, W) / 2, c: H / 2, cz: H / 2 } };
  return { id, team, rule: { type: 'boss-vehicle', boss: R },
    body: V.frame ? { type: 'figure-rig', figure: id, ...hit, hpBar: 'none' } : { type: 'mesh', shape: 'box', size: [0.2, 0.2, 0.2], color: 0x3f4640, ...hit },
    transform: { pos: [at[0], at[1], at[2] ?? 0], heading } };
}

export function carrierEntities(id, { at, heading = 0, crewBody, droneFigure = `${id}-drone`, team = 'guards' } = {}) {
  const C = readVehicle(id).carrier;
  if (!C) throw new Error(`boss stand: the ${id} carries nothing`);
  if (!crewBody || !crewBody.figure) throw new Error('boss stand: a carrier\'s gunners need a body to be drawn with (crewBody: { figure, ... })');
  const pos = [at[0], at[1], at[2] ?? 0], D = C.drones;
  const crew = C.crew.map((c) => ({ id: `${id}:${c.id}`, team, rule: { type: 'static', bossCrew: { boss: id, crew: c.id } }, body: { hittable: true, hp: 100, radius: 0.3, egg: { a: 0.35, c: 0.9, cz: 0.9 }, ...crewBody, type: 'figure-rig' }, transform: { pos: pos.slice(), heading } }));
  // (its drones two to a bay, its couriers the first bay's and the last's)
  const drones = Array.from({ length: D.count }, (_, i) => {
    const role = i < D.couriers / 2 || i >= D.count - D.couriers / 2 ? 'courier' : 'hunter';
    return { id: `${id}:drone${i + 1}`, team, rule: { type: 'static', bossDrone: { boss: id, role, bay: i % C.bays.length } }, body: { type: 'figure-rig', figure: droneFigure, hittable: false, hp: D[role].hp, radius: 0.6, egg: { a: 0.6, c: 0.35, cz: 0 }, hpBar: 'none' }, transform: { pos: pos.slice(), heading } };
  });
  return [...crew, ...drones];
}
