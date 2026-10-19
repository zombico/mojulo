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
 *   airship fly; what carries or shelters and is not the worker, unarmed, is a transport (a flyer's over anything);
 *   what its words call medical (a medic, an ambulance) mends its own
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
  // fighters without a weapon: what carries units, what mends them
  transport: { hp: 150, atk: 0, range: 0, rate: 1, speed: 2.2, carries: 4 },
  medic: { hp: 60, atk: 0, range: 3, rate: 1, speed: 2.0, heals: 4 },
};
export const RTS_ROLES = Object.freeze(Object.keys(ROLE));
const HOUSE = {
  barracks: { role: 'barracks', hp: 320, cost: 150, time: 20 },
  works: { role: 'works', hp: 400, cost: 200, time: 25, needs: 'barracks' },
  defence: { role: 'defence', hp: 300, cost: 120, time: 15, atk: 10, range: 4.5, rate: 1.2 },
  depot: { role: 'depot', hp: 250, cost: 100, time: 15, depot: true },
  wall: { role: 'wall', hp: 500, cost: 30, time: 6 },
  research: { role: 'research', hp: 300, cost: 150, time: 20, needs: 'barracks' },
};
// the ladder: what each step costs and how long it takes
const STEP = { tier2: { cost: 150, time: 30 }, tier3: { cost: 250, time: 45 }, income: { cost: 100, time: 25 } };
const INCOME = 0.2, INCOMES = 2;
const RESEARCH_FORMS = ['tower', 'dish', 'launch', 'portal'];
const MELEE_FORMS = ['blade', 'polearm', 'axe'], RANGED_FORMS = ['bow', 'gun', 'staff'], SIEGE_FORMS = ['cannon', 'launcher', 'siege', 'ballista'];
const FLY_FORMS = ['rotor', 'winged', 'airship'];
// what its words call medical mends its own (no function says it: the words do)
const MEDICAL = /\b(medic|medics|medical|ambulance|hospital|healer|healing|infirmary|nurse|surgeon|triage)\b/i;
// what they call deployable is carried folded and set up where it stops
const DEPLOY = /\b(deployable|portable|mobile|packed|collapsible|foldable|drop)\b/i;
// and what they call a carrier of people carries them, whatever its functions read
const CARRIER = /\b(transport|transports|troop|troops|carrier|apc|shuttle|dropship|ferry|bus|personnel)\b/i;
// a vehicle's pace, by what it goes on
const PACE = { hover: 1.3, wheeled: 1.15, cycle: 1.4, rotor: 1.15, winged: 1.3, airship: 0.8, tracked: 0.85, walker: 0.9, drawn: 1.0 };

// the price of a fight: hp against the damage it deals a second (siege's share against buildings), its reach and pace,
// and flight; calibrated on the plain soldier (60 gold)
const K = 60 / Math.sqrt(80 * 8);
export function rtsWorth(U) {
  // what fights no fight is worth what it carries or mends
  if (!U.atk) return (U.carries ? 10 + 4 * U.carries + U.hp / 30 : Math.sqrt(U.hp * (U.heals || 0) * 2)) * Math.sqrt(U.speed / 1.8) * (U.fly ? 1.25 : 1);
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
  if (role === 'transport' && typeof d.scale === 'number' && d.scale > 1) { U.carries += 2; why.push('a size up: carries 2 more'); }
  const out = { role, hp: Math.round(U.hp), atk: r1(U.atk), range: r1(U.range), rate: r2(U.rate), speed: r2(U.speed), ...(U.fly ? { fly: true } : {}), ...(U.siege ? { siege: U.siege } : {}), ...(U.carries ? { carries: U.carries } : {}), ...(U.heals ? { heals: U.heals } : {}) };
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
  // a machine is tier 2, a showpiece (focus rank) tier 3; infantry and the worker tier 1
  const field = (e, role, noun, machine, fly) => {
    const rank = rankOf(e.list, e.id), id = idFor(e.id), { U, why } = statsOf(role, { ...e.t, kind: e.kind }, rank);
    if (fly && !U.fly) { U.fly = true; why.push('it flies: over anything'); }
    const cost = five(K * rtsWorth(U)), tier = machine ? (rank === 'focus' ? 3 : 2) : 1;
    units[id] = { name: noun ? `${named(e.id)} ${noun}` : named(e.id), ...U, cost, time: Math.max(4, Math.round(cost / 6)), ...(tier > 1 ? { tier } : {}), ...(machine ? { machine: true } : {}) };
    said(`${e.list}/${e.id}`, id, `${e.t.intent}: ${role}${why.length ? ` (${why.join('; ')})` : ''}, ${cost} gold${tier > 1 ? `, tier ${tier}` : ''}`);
    return id;
  };

  // the worker: what moves and carries, ground before air, vehicles before things
  const carrier = (e) => e.fns.includes('move') && (e.fns.includes('store') || e.fns.includes('lift') || (e.kind === 'thing' && e.t.block?.tier === 'machine'));
  const flies = (e) => e.kind === 'vehicle' && FLY_FORMS.includes(e.t.form);
  const cands = [...vehicles.filter((e) => carrier(e) && !flies(e) && e.t.block?.tier !== 'vessel'), ...things.filter(carrier), ...vehicles.filter((e) => carrier(e) && flies(e))];
  let worker;
  if (cands.length) {
    const e = cands[0], id = idFor(e.id), U = statsOf('worker', { ...e.t, kind: e.kind }, null).U;
    // a machine that mines: sturdier, and mended rather than healed
    if (e.kind === 'vehicle' || e.t.block?.tier === 'machine') { U.hp = Math.round(U.hp * 1.5); U.machine = true; }
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
    if (MEDICAL.test(e.t.intent)) { machines.push(field(e, 'medic', null, true, flies(e))); continue; }
    // unarmed, and it carries, shelters or lifts: a transport, armoured or not
    if (!armed && (e.fns.includes('store') || e.fns.includes('keep') || e.fns.includes('lift') || CARRIER.test(e.t.intent))) { machines.push(field(e, 'transport', null, true, flies(e))); continue; }
    if (flies(e)) { machines.push(field(e, armed || armoured ? 'flyer' : 'transport', null, true, !(armed || armoured))); continue; }
    if (armoured) machines.push(field(e, 'heavy', null, true));
    else if ((typeof e.t.dials?.scale === 'number' && e.t.dials.scale < 1) || e.t.form === 'cycle') machines.push(field(e, 'scout', null, true));
    else if (armed) machines.push(field(e, 'fighting', null, true));
    else machines.push(field(e, 'scout', null, true));
  }
  for (const e of weapons) if (e.t.block?.tier !== 'held' && SIEGE_FORMS.includes(e.t.form)) machines.push(field(e, 'siege', 'crew', true));
  // siege deploys to fire: farther and harder, but still until it packs up
  for (const k of machines) {
    const U = units[k];
    if (U.role !== 'siege') continue;
    U.modes = { deployed: { range: r1(U.range + 2), atk: r1(U.atk * 1.25), still: true, time: 3 } };
    ledger.find((l) => l.as === k).line += `; it deploys to fire (reach ${U.modes.deployed.range}, strike ${U.modes.deployed.atk}, still; 3 s to set up or pack)`;
  }

  // buildings
  buildings.base = { name: 'Base', ...RTS_BUILDINGS.base, trains: [worker] };
  // the base grows into its civilization's fort once its machines are known: harder, and it shoots farther
  const fortName = typeof C.fort === 'string' ? `${named(C.fort)} fort` : 'Fort';
  buildings.barracks = { name: 'Barracks', ...HOUSE.barracks, trains: infantry };
  const builds = ['barracks'];
  // the ladder: the machines (tier 2), then the showpieces (tier 3), and income steps between, researched at what
  // signals, senses or lifts (a mast, a dish, a launch gantry), else a plain lab
  const incomes = [...structures, ...things].filter((e) => !e.fns.includes('make') && !e.fns.includes('move') && (e.fns.includes('power') || e.fns.includes('grow'))).slice(0, INCOMES);
  const research = {}, study = [];
  if (machines.length || incomes.length) {
    const lab = structures.find((e) => RESEARCH_FORMS.includes(e.t.form)), at = lab ? idFor(lab.id) : 'lab';
    buildings[at] = { name: lab ? named(lab.id) : 'Lab', ...HOUSE.research };
    builds.push(at);
    said(lab ? `structures/${lab.id}` : null, at, lab ? `${lab.t.intent}: where it researches (after a barracks), ${HOUSE.research.cost} gold` : `nothing it crafts signals, senses or lifts: a plain lab researches for it (after a barracks), ${HOUSE.research.cost} gold`);
    const opens = (t) => machines.filter((k) => (units[k].tier ?? 1) === t);
    if (opens(2).length || opens(3).length) research.tier2 = { name: 'Machines', ...STEP.tier2, at, gives: { tier: 2 }, opens: [...opens(2), 'works'] };
    if (opens(3).length) research.tier3 = { name: 'Showpieces', ...STEP.tier3, at, needs: 'tier2', gives: { tier: 3 }, opens: opens(3) };
    let prev = null;
    incomes.forEach((e) => {
      const id = research[e.id] ? `${e.id}-income` : e.id;
      research[id] = { name: named(e.id), ...STEP.income, at, ...(prev ? { needs: prev } : {}), gives: { income: INCOME } };
      prev = id;
      said(`${e.list}/${e.id}`, null, `${e.t.intent}: an income step, researched (every trip pays ${Math.round(INCOME * 100)}% more), ${STEP.income.cost} gold`);
    });
    // the mind's order: the machines, an income step, the showpieces, the rest
    const inc = Object.keys(research).filter((k) => research[k].gives.income);
    study.push(...['tier2', inc[0], 'tier3', ...inc.slice(1)].filter((k) => k && research[k]));
    // the lab's research capability: every step of the ladder is researched there
    buildings[at].studies = Object.keys(research);
    if (research.tier2) {
      buildings.fort = { ...RTS_BUILDINGS.base, name: fortName, hp: 1600, atk: 10, range: 5, trains: [worker] };
      buildings.base.upgrades = { to: 'fort', cost: 200, time: 40, tier: 2 };
      said(null, 'fort', `its base grows into its fort (${fortName.toLowerCase()}) once its machines are known: hp 1600, it shoots farther, 200 gold, 40 s`);
    }
  }
  if (machines.length) {
    const maker = things.find((e) => e.fns.includes('make'));
    buildings.works = { name: maker ? named(maker.id) : 'Works', ...HOUSE.works, tier: 2, trains: machines };
    builds.push('works');
    said(maker ? `things/${maker.id}` : null, 'works', maker ? `${maker.t.intent}: the works, where its vehicles and siege are made (after a barracks, once the machines are researched)` : 'nothing it crafts makes: plain works make its vehicles and siege (after a barracks, once the machines are researched)');
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
  // what is deployable comes out of the works folded, a unit, and is set up where it stops
  const folded = [];
  for (const k of Object.keys(buildings)) {
    const l = ledger.find((x) => x.as === k && x.of), e = l && [...weapons, ...structures, ...things].find((x) => `${x.list}/${x.id}` === l.of);
    if (!e || !DEPLOY.test(e.t.intent) || !buildings[k].cost) continue;
    const id = idFor(`${k}-kit`), H = buildings[k];
    units[id] = { name: `${H.name} (folded)`, role: 'deploy', hp: Math.round(H.hp * 0.4), atk: 0, range: 0, rate: 1, speed: 1.6, cost: H.cost, time: Math.max(4, Math.round(H.cost / 6)), tier: 2, machine: true, deploys: k };
    H.time = Math.min(H.time, 8);
    folded.push(id);
    l.line += `; deployable: it comes out of the works folded (${units[id].name}) and is set up where it stops`;
    said(null, id, `${H.name} folded: carried out of the works and set up where it stops into the ${H.name.toLowerCase()} (${H.cost} gold)`);
  }
  // the works makes them (with the machines); a side with no works, its barracks, from the start
  if (folded.length && buildings.works) { buildings.works.trains.push(...folded); if (research.tier2) research.tier2.opens.splice(-1, 0, ...folded); }
  else if (folded.length) { for (const id of folded) delete units[id].tier; buildings.barracks.trains.push(...folded); }
  for (const e of structures) if (e.t.form === 'barrier' || e.t.form === 'gate') house(e, 'wall', 'a wall, cheap and hard to break');
  const depot = things.find((e) => e.fns.includes('store') && !e.fns.includes('move'));
  if (depot) house(depot, 'depot', 'a depot, where workers drop what they mine');
  for (const e of [...structures, ...things]) {
    if (ledger.some((l) => l.of === `${e.list}/${e.id}`)) continue;
    said(`${e.list}/${e.id}`, null, `${e.t.intent}: not fielded (${e.fns.join(', ') || 'no function'})`);
  }
  for (const e of weapons) if (!ledger.some((l) => l.of === `weapons/${e.id}`)) said(`weapons/${e.id}`, null, `${e.t.intent}: not fielded (a ${e.t.form})`);

  const army = [infantry.find((k) => units[k].role !== 'ranged'), infantry.find((k) => units[k].role === 'ranged')].filter(Boolean);
  return { cid, name: C.name, team: D?.team ?? null, units, buildings, worker, base: 'base', army, builds, ...(study.length ? { research, study } : {}), ledger };
}
