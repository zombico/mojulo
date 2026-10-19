/**
 * A CIVILIZATION'S TECHNOLOGY AS A SKIRMISH SIDE — what a gameworld civilization crafts (world.civilizations.<cid>
 * .technology, tunnelled from words: gameworld/world.js, tech-crafter.js) read into the roster board-rts.js plays it by:
 * its worker, its infantry, its vehicles, its siege, its buildings, every line with why. StarCraft's point is that the
 * sides are not alike; here a side is as unlike the other as the two civilizations' technology is.
 *
 *   rtsRoster(G, cid) → { cid, name, team, units, buildings, worker, base, army, builds, ledger }
 *     G: a read gameworld (readGameworld); the kernel takes the roster as cfg.sides[side] (ledger, name, team ride
 *     along unread)
 *     ledger: [{ of: '<list>/<id>' | null, as: '<unit or building id>' | null, line }]
 *
 * Roles, by what a thing does (its block's functions) and what it is (its form, its tier):
 *   a held weapon arms infantry: blade, polearm, axe melee; bow, gun, staff ranged; a shield a guard
 *   a vehicle or thing that moves and carries is the worker (one: ground before air, vehicles before things)
 *   an armoured vehicle is heavy; a small one or a cycle a scout; an armed one a fighting vehicle; rotor, winged and
 *   airship fly (an unarmed flyer that is not the worker carries, and the skirmish has nothing for it to carry)
 *   a machine weapon (cannon, launcher, siege, ballista) is siege: long range, slow, three times as hard on a building
 *   a turret is a defence (a building that shoots); a barrier or a gate a wall; a thing that makes is the works (the
 *   vehicles and siege train there); a thing that stores, standing, a depot (workers drop gold there)
 * Stats: the role's, then the dials (armour, energy, field, long, barrels, a scale up), a focus rank's showpiece share,
 * a vehicle's form's pace; then the cost from one worth formula over them all (rtsWorth), so no side buys more fight for
 * its gold. What a civilization lacks is filled from the plain tables (a worker, a soldier, an archer), said in the
 * ledger. Pure and deterministic: the same gameworld, the same roster.
 */
import { resolveTechDirection } from '../gameworld/tech-direction.js';
import { RTS_UNITS, RTS_BUILDINGS } from './board-rts.js';

const ROLE = {
  worker: { hp: 40, atk: 3, range: 1.1, rate: 1.0, speed: 2.2 },
  melee: { hp: 80, atk: 8, range: 1.2, rate: 1.0, speed: 1.8 },
  ranged: { hp: 50, atk: 6, range: 4, rate: 1.2, speed: 1.8 },
  guard: { hp: 130, atk: 5, range: 1.2, rate: 1.0, speed: 1.6 },
  heavy: { hp: 260, atk: 16, range: 1.5, rate: 1.4, speed: 1.3 },
  scout: { hp: 70, atk: 5, range: 1.5, rate: 0.8, speed: 3.2 },
  fighting: { hp: 160, atk: 12, range: 2.5, rate: 1.2, speed: 2.2 },
  flyer: { hp: 110, atk: 9, range: 3, rate: 1.2, speed: 2.4, fly: true },
  siege: { hp: 90, atk: 24, range: 6, rate: 3.0, speed: 1.2, siege: 3 },
};
export const RTS_ROLES = Object.freeze(Object.keys(ROLE));
const HOUSE = {
  barracks: { role: 'barracks', hp: 320, cost: 150, time: 20 },
  works: { role: 'works', hp: 400, cost: 200, time: 25, needs: 'barracks' },
  defence: { role: 'defence', hp: 300, cost: 120, time: 15, atk: 10, range: 4.5, rate: 1.2 },
  depot: { role: 'depot', hp: 250, cost: 100, time: 15 },
  wall: { role: 'wall', hp: 500, cost: 30, time: 6 },
};
const MELEE_FORMS = ['blade', 'polearm', 'axe'], RANGED_FORMS = ['bow', 'gun', 'staff'], SIEGE_FORMS = ['cannon', 'launcher', 'siege', 'ballista'];
const FLY_FORMS = ['rotor', 'winged', 'airship'];
// a vehicle's pace, by what it goes on
const PACE = { hover: 1.3, wheeled: 1.15, cycle: 1.4, rotor: 1.15, winged: 1.3, airship: 0.8, tracked: 0.85, walker: 0.9, drawn: 1.0 };

// the price of a fight: hp against the damage it deals a second (siege's share against buildings), its reach and pace,
// and flight; calibrated on the plain soldier (60 gold)
const K = 60 / Math.sqrt(80 * 8);
export function rtsWorth(U) {
  const dps = (U.atk / U.rate) * (U.siege ? (1 + U.siege) / 2 : 1);
  return Math.sqrt(U.hp * dps) * (1 + 0.3 * Math.max(0, U.range - 1.2)) * Math.sqrt(U.speed / 1.8) * (U.fly ? 1.25 : 1);
}
const five = (v) => Math.max(5, 5 * Math.round(v / 5));
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
const named = (id) => { const w = String(id).replace(/[-_]+/g, ' '); return w.charAt(0).toUpperCase() + w.slice(1); };

/** A unit's stats from its role, the thing's dials, its rank and its form; `why` gathers what moved them. */
function statsOf(role, t, rank) {
  const U = { ...ROLE[role] }, d = t?.dials ?? {}, why = [];
  if (d.armour) { U.hp *= 1.5; U.speed *= 0.8; why.push('armour: hp × 1.5, pace × 0.8'); }
  if (d.field) { U.hp *= 1.3; why.push('a field: hp × 1.3'); }
  if (d.energy) { U.atk *= 1.25; why.push('energy: strike × 1.25'); }
  if (d.long && U.range > 2) { U.range += 1; why.push('long: reach + 1'); }
  if (d.barrels) { U.rate *= 0.8; why.push('barrels: strikes × 1.25 as often'); }
  if (typeof d.scale === 'number' && d.scale > 1 && role !== 'scout') { U.hp *= d.scale; U.speed /= Math.sqrt(d.scale); why.push(`a size up × ${d.scale}: hp up, pace down`); }
  if (t?.kind === 'vehicle' && PACE[t.form] && role !== 'worker') { U.speed *= PACE[t.form]; if (PACE[t.form] !== 1) why.push(`${t.form}: pace × ${PACE[t.form]}`); }
  if (rank === 'focus') { U.hp *= 1.25; U.atk *= 1.25; why.push('its showpiece (focus): hp and strike × 1.25'); }
  const out = { role, hp: Math.round(U.hp), atk: r1(U.atk), range: r1(U.range), rate: r2(U.rate), speed: r2(U.speed), ...(U.fly ? { fly: true } : {}), ...(U.siege ? { siege: U.siege } : {}) };
  return { U: out, why };
}

/** The roster a civilization of a read gameworld fields in a skirmish. */
export function rtsRoster(G, cid) {
  const C = G?.civilizations?.[cid];
  if (!C) throw new Error(`board rts: '${cid}' is not one of the world's civilizations (${Object.keys(G?.civilizations ?? {}).join(', ') || 'none'})`);
  const T = C.technology ?? {}, D = resolveTechDirection(G, cid), rankOf = (list, id) => D?.ranks?.[`${list}/${id}`]?.rank;
  const units = {}, buildings = {}, ledger = [], said = (of, as, line) => ledger.push({ of, as, line });
  const taken = new Set(['worker', 'soldier', 'archer', 'base', 'barracks', 'works']);
  const idFor = (id) => { let k = id, n = 2; while (taken.has(k) || units[k] || buildings[k]) k = `${id}-${n++}`; return k; };
  const entries = (list) => Object.entries(T[list] ?? {}).map(([id, t]) => ({ list, id, t, fns: t.block?.functions ?? [], kind: list === 'things' ? 'thing' : list.slice(0, -1) }));
  const vehicles = entries('vehicles'), weapons = entries('weapons'), structures = entries('structures'), things = entries('things');
  const field = (e, role, noun) => {
    const id = idFor(e.id), { U, why } = statsOf(role, { ...e.t, kind: e.kind }, rankOf(e.list, e.id));
    const cost = five(K * rtsWorth(U));
    units[id] = { name: noun ? `${named(e.id)} ${noun}` : named(e.id), ...U, cost, time: Math.max(4, Math.round(cost / 6)) };
    said(`${e.list}/${e.id}`, id, `${e.t.intent}: ${role}${why.length ? ` (${why.join('; ')})` : ''}, ${cost} gold`);
    return id;
  };

  // the worker: what moves and carries, ground before air, vehicles before things
  const carrier = (e) => e.fns.includes('move') && (e.fns.includes('store') || e.fns.includes('lift') || (e.kind === 'thing' && e.t.block?.tier === 'machine'));
  const flies = (e) => e.kind === 'vehicle' && FLY_FORMS.includes(e.t.form);
  const cands = [...vehicles.filter((e) => carrier(e) && !flies(e) && e.t.block?.tier !== 'vessel'), ...things.filter(carrier), ...vehicles.filter((e) => carrier(e) && flies(e))];
  let worker;
  if (cands.length) {
    const e = cands[0], id = idFor(e.id), U = statsOf('worker', { ...e.t, kind: e.kind }, null).U;
    if (e.kind === 'vehicle' || e.t.block?.tier === 'machine') U.hp = Math.round(U.hp * 1.5);
    if (flies(e)) { U.fly = true; U.speed = r2(U.speed * 1.15); }
    U.carry = e.fns.includes('store') ? 8 : 5;
    const cost = five(50 * (U.carry / 5) * Math.sqrt(U.speed / 2.2) * (U.fly ? 1.25 : 1));
    units[id] = { name: named(e.id), ...U, cost, time: Math.max(4, Math.round(cost / 6)) };
    worker = id;
    said(`${e.list}/${e.id}`, id, `${e.t.intent}: the worker, it moves and carries (${U.carry} a trip${U.fly ? ', over anything' : ''}), ${cost} gold`);
  } else {
    units.worker = { ...RTS_UNITS.worker };
    worker = 'worker';
    said(null, 'worker', 'nothing it crafts moves and carries: a plain worker mines for it');
  }

  // infantry, from its hand weapons
  const infantry = [];
  for (const e of weapons) {
    if (e.t.block?.tier !== 'held') continue;
    const role = e.t.form === 'shield' ? 'guard' : MELEE_FORMS.includes(e.t.form) ? 'melee' : RANGED_FORMS.includes(e.t.form) ? 'ranged' : 'melee';
    infantry.push(field(e, role, 'trooper'));
  }
  if (!infantry.some((k) => units[k].role === 'melee' || units[k].role === 'guard')) { units.soldier = { ...RTS_UNITS.soldier }; infantry.unshift('soldier'); said(null, 'soldier', 'no blade, polearm, axe or shield in hand: a plain soldier holds the line'); }
  if (!infantry.some((k) => units[k].role === 'ranged')) { units.archer = { ...RTS_UNITS.archer }; infantry.push('archer'); said(null, 'archer', 'no bow, gun or staff in hand: a plain archer shoots for it'); }

  // the works' roll: vehicles and siege
  const machines = [];
  for (const e of vehicles) {
    if (e === cands[0]) continue;
    if (e.t.block?.tier === 'vessel' || e.t.form === 'ship') { said(`vehicles/${e.id}`, null, `${e.t.intent}: a vessel, waiting for water (the board has none to sail)`); continue; }
    if (e.t.form === 'rail') { said(`vehicles/${e.id}`, null, `${e.t.intent}: it runs on rails, and the board lays none`); continue; }
    const armed = e.fns.includes('strike'), armoured = e.fns.includes('guard');
    if (flies(e)) {
      if (armed || armoured) machines.push(field(e, 'flyer'));
      else said(`vehicles/${e.id}`, null, `${e.t.intent}: an unarmed flyer that carries, and the skirmish has nothing for it to carry`);
      continue;
    }
    if (armoured) machines.push(field(e, 'heavy'));
    else if ((typeof e.t.dials?.scale === 'number' && e.t.dials.scale < 1) || e.t.form === 'cycle') machines.push(field(e, 'scout'));
    else if (armed) machines.push(field(e, 'fighting'));
    else if (e.fns.includes('store')) said(`vehicles/${e.id}`, null, `${e.t.intent}: a second carrier; one worker is enough`);
    else machines.push(field(e, 'scout'));
  }
  for (const e of weapons) if (e.t.block?.tier !== 'held' && SIEGE_FORMS.includes(e.t.form)) machines.push(field(e, 'siege', 'crew'));

  // buildings
  buildings.base = { name: 'Base', ...RTS_BUILDINGS.base, trains: [worker] };
  buildings.barracks = { name: 'Barracks', ...HOUSE.barracks, trains: infantry };
  const builds = ['barracks'];
  if (machines.length) {
    const maker = things.find((e) => e.fns.includes('make'));
    buildings.works = { name: maker ? named(maker.id) : 'Works', ...HOUSE.works, trains: machines };
    builds.push('works');
    said(maker ? `things/${maker.id}` : null, 'works', maker ? `${maker.t.intent}: the works, where its vehicles and siege are made (after a barracks)` : 'nothing it crafts makes: plain works make its vehicles and siege (after a barracks)');
  }
  const house = (e, role, why) => {
    const id = idFor(e.id), H = { name: named(e.id), ...HOUSE[role] }, d = e.t.dials ?? {}, more = [];
    if (role === 'defence') {
      if (d.energy) { H.atk = r1(H.atk * 1.25); more.push('energy: strike × 1.25'); }
      if (d.sensor) { H.range = r1(H.range + 1); more.push('a sensor: reach + 1'); }
      if (d.barrels) { H.rate = r2(H.rate * 0.8); more.push('barrels: more often'); }
    }
    if (d.field) { H.hp = Math.round(H.hp * 1.3); more.push('a field: hp × 1.3'); }
    if (d.armour) { H.hp = Math.round(H.hp * 1.5); more.push('armour: hp × 1.5'); }
    buildings[id] = H;
    said(`${e.list}/${e.id}`, id, `${e.t.intent}: ${why}${more.length ? ` (${more.join('; ')})` : ''}, ${H.cost} gold`);
  };
  for (const e of weapons) if (e.t.block?.tier !== 'held' && e.t.form === 'turret') house(e, 'defence', 'a defence, it shoots what comes in range');
  for (const e of structures) if (e.t.form === 'barrier' || e.t.form === 'gate') house(e, 'wall', 'a wall, cheap and hard to break');
  const depot = things.find((e) => e.fns.includes('store') && !e.fns.includes('move'));
  if (depot) house(depot, 'depot', 'a depot, where workers drop what they mine');
  for (const e of [...structures, ...things]) {
    if (ledger.some((l) => l.of === `${e.list}/${e.id}`)) continue;
    said(`${e.list}/${e.id}`, null, `${e.t.intent}: not fielded (${e.fns.join(', ') || 'no function'})`);
  }
  for (const e of weapons) if (!ledger.some((l) => l.of === `weapons/${e.id}`)) said(`weapons/${e.id}`, null, `${e.t.intent}: not fielded (a ${e.t.form})`);

  const army = [infantry.find((k) => units[k].role !== 'ranged'), infantry.find((k) => units[k].role === 'ranged')].filter(Boolean);
  return { cid, name: C.name, team: D?.team ?? null, units, buildings, worker, base: 'base', army, builds, ledger };
}
