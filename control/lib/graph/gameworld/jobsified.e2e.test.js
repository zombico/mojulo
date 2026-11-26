// Jobsified laid in a played district (jobsified.js, levels.js): Hijack City's starter, its bin round and its heavy
// haul and its bus route. A whole district made (minutes), so the e2e tier. The laws: the district builds a dump on a car park; the bin
// round is laid at the works yard nearest the start, its cabs the yard's own garbage trucks among the level's bodies, its
// piles places of the district's apart from each other and the yard, emptied at the dump; the heavy haul's truck is issued
// at a kerb by the yard as a cab after all others, and sent to a building site across the district; the bus route's bus
// is issued the same way, its stops in order, people waiting at each; groundskeeping's mower is kept in a shed by
// a park's path, a round on the clock over the park's own long grass; each is on
// Jobsified; the guide leads them, and the errand proof drives each on the bus to its pay.
import { describe, it, expect } from 'vitest';
import { hijackCityWorld } from './hijack-city.js';
import { runSteps } from './runner.js';
import { cityGuide } from './city-guide.js';
import { phoneUi } from './phone-ui.js';
import { proveErrands, lastStageManifests } from './errand-proof.js';
import { SHIFT, SHIFTS, HEAVY_VEHICLES, FREIGHT_VEHICLES, MOW, MOW_ROUND } from './jobsified.js';

const world = hijackCityWorld(), steps = runSteps(world, { ref: 'hc' }), level = steps.find((x) => x.key.startsWith('level-')).order.manifest, M = level.game.mechanics;
const bins = M.find((m) => m.kind === 'shift' && m.id === 'bin-round'), haul = M.find((m) => m.kind === 'shift' && m.id === 'heavy-haul'), bus = M.find((m) => m.kind === 'shift' && m.id === 'bus-route'), dig = M.find((m) => m.kind === 'shift' && m.id === 'dig-and-load'), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cab = (id) => level.entities.find((x) => x.id === id);

describe('Hijack City\'s driving jobs, laid', () => {
  it('the bin round: at the works yard, its cabs the yard\'s garbage trucks, its piles apart, emptied at the dump', () => {
    expect(bins).toMatchObject({ mode: 'collect', vehicle: SHIFTS.garbage.vehicle, yard: 'works yard', load: SHIFTS.garbage.load, repeat: true, after: 'took-bin-round' });
    expect(bins.unload?.half).toHaveLength(2);
    expect(d(bins.unload.at, bins.depot)).toBeGreaterThan(SHIFT.apart);
    for (const id of bins.cabs) {
      const e = cab(id);
      expect(e?.mount?.cab).toBe(true);
      expect(e.mount.pool).toMatchObject({ model: 'loft:refuseTruck', gate: { tip: expect.any(Number) } });
      for (const i of [0, 1]) expect(Math.abs(e.transform.pos[i] - bins.depot[i])).toBeLessThan(bins.half[i]);
    }
    expect(bins.stops).toHaveLength(SHIFTS.garbage.stops);
    for (const q of bins.stops) expect(d(q.at, bins.depot)).toBeGreaterThanOrEqual(SHIFT.apart);
    for (let i = 0; i < bins.stops.length; i++) for (let j = i + 1; j < bins.stops.length; j++) expect(d(bins.stops[i].at, bins.stops[j].at)).toBeGreaterThanOrEqual(SHIFT.apart);
  });
  it('the heavy vehicle call: its trucks and machines issued at kerbs as cabs after all others, each sent to a building site across the district', () => {
    expect(haul).toMatchObject({ mode: 'haul', repeat: true, after: 'took-heavy-haul', site: { to: SHIFTS.heavy.to } });
    expect(haul.calls).toHaveLength(SHIFTS.heavy.calls);
    const models = haul.calls.map((C) => cab(C.cab).mount.pool.model);
    for (const m of models) expect(HEAVY_VEHICLES.map((v) => v.model)).toContain(m);
    expect(models.some((m) => m.startsWith('site:'))).toBe(true);
    expect(models.some((m) => m.startsWith('loft:'))).toBe(true);
    for (const C of haul.calls) { expect(d(cab(C.cab).transform.pos, C.back)).toBeLessThan(0.01); expect(d(C.site.at, C.back)).toBeGreaterThanOrEqual(SHIFT.haul); }
    const e = cab(haul.cabs[0]), ids = level.entities.filter((x) => x.mount?.cab && !x.mount.spare && x.id.startsWith('car-')).map((x) => Number(x.id.slice(4)));
    expect(e?.mount?.cab).toBe(true);
    // (the issued vehicles are the level's last cabs, the call's and the bus's)
    const orders = M.find((m) => m.kind === 'shift' && m.id === 'materials'), sweeper = M.find((m) => m.kind === 'shift' && m.id === 'street-sweeping'), mower = M.find((m) => m.kind === 'shift' && m.id === 'groundskeeping'), issued = [...haul.cabs, bus.cabs[0], ...sweeper.cabs, ...mower.cabs, ...orders.cabs].map((c) => Number(c.slice(4))).sort((a, b) => a - b);
    expect(issued).toEqual(ids.sort((a, b) => a - b).slice(-issued.length));
    expect(e.mount.pool.gate).toBeUndefined();
    expect(d(e.transform.pos, haul.back)).toBeLessThan(0.01);
    expect(d(haul.site.at, haul.back)).toBeGreaterThanOrEqual(SHIFT.haul);
  });
  it('the heavy vehicle call asks for a licence: the forger sells one at a shop front a drive from the start', () => {
    const F = M.find((m) => m.kind === 'forger'), T = M.find((m) => m.kind === 'task' && m.id === 'heavy-haul');
    expect(F).toMatchObject({ item: 'fake-id', name: 'heavy machinery licence', price: 150 });
    expect(d(F.at, level.entities.find((e) => e.pilotable).transform.pos)).toBeGreaterThanOrEqual(140);
    expect(T.needs).toEqual({ item: 'fake-id', name: 'heavy machinery licence' });
    expect(M.find((m) => m.kind === 'task' && m.id === 'bin-round').needs).toBeUndefined();
    expect(phoneUi(level).apps.find((a) => a.name === 'Jobsified').tasks.find((t) => t.id === 'heavy-haul')).toMatchObject({ needs: 'heavy machinery licence', has: 'held:bag:fake-id' });
  });
  it('the bus route: its bus issued at a kerb as a cab, its stops in order across the district, people waiting at each', () => {
    expect(bus).toMatchObject({ mode: 'route', vehicle: 'bus', repeat: true, hold: SHIFTS.bus.hold, after: 'took-bus-route' });
    expect(cab(bus.cabs[0]).mount.pool.model).toBe('loft:bus');
    expect(bus.stops).toHaveLength(SHIFTS.bus.stops);
    for (const q of bus.stops) { expect(q.riders).toBeGreaterThanOrEqual(SHIFTS.bus.riders[0]); expect(q.riders).toBeLessThanOrEqual(SHIFTS.bus.riders[1]); expect(q.N).toHaveLength(2); }
    for (let i = 0; i < bus.stops.length; i++) for (let j = i + 1; j < bus.stops.length; j++) expect(d(bus.stops[i].at, bus.stops[j].at)).toBeGreaterThanOrEqual(SHIFT.apart);
  });
  it('dig and load: a building site\'s excavator operated where it was staged, its pile and its tipper beside it along the band; it asks for the licence', () => {
    expect(dig).toMatchObject({ mode: 'dig', machine: SHIFTS.excavator.machine, loads: SHIFTS.excavator.loads, cabs: ['op-dig-and-load'], truck: 'op-dig-and-load-truck' });
    const op = cab('op-dig-and-load'), truck = cab('op-dig-and-load-truck');
    expect(op).toMatchObject({ rule: { type: 'static' }, mount: { cab: true, operate: 'dig-and-load' } });
    expect(truck.mount.pool.model).toBe('site:tipperTruck');
    expect(d(op.transform.pos, dig.pile.at)).toBeCloseTo(7, 1);
    expect(d(truck.transform.pos, op.transform.pos)).toBeGreaterThan(6);
    expect(M.find((m) => m.kind === 'task' && m.id === 'dig-and-load').needs).toMatchObject({ item: 'fake-id' });
  });
  it('the Dockers\' delivery orders: told by the foreman once the pit is dug, checked in for at the Dockers\' HQ, trucks from the dock\'s bays to building sites; the highways given ramps', () => {
    const orders = M.find((m) => m.kind === 'shift' && m.id === 'materials'), call = M.find((m) => m.kind === 'call' && m.id === 'materials'), hq = M.find((m) => m.kind === 'offer' && m.id === 'materials');
    const join = M.find((m) => m.kind === 'join' && m.faction === 'dockers');
    expect(call).toMatchObject({ flag: 'told-materials', on: 'errand:done:dig-and-load', from: 'Foreman' });
    expect(hq).toMatchObject({ flag: 'took-materials', after: 'told-materials', hq: 'dockers' });
    expect(hq.at).toEqual(join.at);
    expect(orders).toMatchObject({ mode: 'haul', repeat: true, after: 'took-materials' });
    expect(orders.calls).toHaveLength(SHIFTS.freight.calls);
    for (const C of orders.calls) { expect(FREIGHT_VEHICLES.map((v) => v.model)).toContain(cab(C.cab).mount.pool.model); expect(C.site.to).toBe(SHIFTS.freight.to); }
    // (its trucks at the dock's own bays, a row before its warehouse)
    expect(new Set(orders.calls.map((C) => C.back[1])).size).toBe(1);
    expect(M.some((m) => m.kind === 'task' && m.id === 'materials')).toBe(false);
  });
  it('street sweeping: its sweeper issued at a kerb by the works yard, litter along the kerb side of the streets nearest the yard', () => {
    const sw = M.find((m) => m.kind === 'shift' && m.id === 'street-sweeping');
    expect(sw).toMatchObject({ mode: 'sweep', vehicle: 'street sweeper', repeat: true });
    expect(cab(sw.cabs[0]).mount.pool.model).toBe('loft:streetSweeper');
    expect(sw.stops.length).toBeGreaterThanOrEqual(12);
    for (const q of sw.stops) expect(q.at).toHaveLength(3);
  });
  it('groundskeeping: its mower kept in a shed by the park\'s path, a round on the clock over the park\'s own long grass', () => {
    const gk = M.find((m) => m.kind === 'shift' && m.id === 'groundskeeping'), e = cab(gk.cabs[0]);
    expect(gk).toMatchObject({ mode: 'mow', vehicle: 'ride-on mower', yard: 'park', repeat: true, pitch: SHIFTS.groundskeeper.pitch, time: MOW_ROUND.time, goal: MOW_ROUND.goal, shed: { half: MOW.shedHalf } });
    expect(e.mount.pool.model).toBe('loft:rideOnMower');
    // (in the shed, sent back there when left)
    expect(d(e.transform.pos, gk.shed.at)).toBeLessThan(0.01);
    expect(d(gk.back, gk.shed.at)).toBeLessThan(0.01);
    expect(gk.stops.length).toBeGreaterThanOrEqual(40);
    for (const q of gk.stops) expect(q.half).toEqual([MOW.cell / 2, MOW.cell / 2]);
    // (no other mower in the city; no minigame window)
    expect(level.entities.filter((x) => x.mount?.pool?.model === 'loft:rideOnMower')).toHaveLength(1);
    expect(level.play?.minigames).toBeUndefined();
    // (a licence's job: taken only with the forger's papers)
    expect(M.find((m) => m.kind === 'task' && m.id === 'groundskeeping').needs).toMatchObject({ item: 'fake-id' });
  });
  it('each is on Jobsified; the guide leads each when it is taken; the errand proof drives each to its pay', () => {
    expect(phoneUi(level).apps.map((a) => [a.name, a.tasks.map((t) => t.id)])).toEqual([['TaskFu', ['fare']], ['Jobsified', ['bin-round', 'heavy-haul', 'bus-route', 'street-sweeping', 'groundskeeping', 'dig-and-load']]]);
    const g = cityGuide(level);
    // (the delivery orders' two: taken at the HQ, its first truck; its call come, the HQ)
    expect(g.rounds.map((r) => g.steps[r.at].id)).toEqual(['clock-bin-round', 'clock-heavy-haul-1', 'clock-bus-route', 'clock-street-sweeping', 'clock-groundskeeping', 'clock-dig-and-load', 'clock-materials-1', 'hq-materials']);
    const P = proveErrands(world, lastStageManifests(steps));
    for (const id of ['bin-round', 'heavy-haul', 'bus-route', 'street-sweeping', 'groundskeeping', 'dig-and-load', 'materials']) expect(P.find((x) => x.errand === id), JSON.stringify(P.find((x) => x.errand === id))).toMatchObject({ proved: true });
  });
});
