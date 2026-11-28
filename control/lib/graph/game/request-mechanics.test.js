// The request (request-mechanics.js), walked on the bus: taken, a work order in hand, its material had at the yard; each
// spot fixed as the page says; every one fixed, done: the material and the order used, the pay in the bag. Without the
// order, the yard says so; without the material, a spot is no fix; done once.
import { describe, it, expect } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const ctx = { storeSchema: { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'hero', kind: 'character' }] }, player: 'hero', spawn: [0, 0, 0] };
const REQ = { kind: 'request', id: 'fence', job: 'fence', name: 'the fence', from: 'Marjorie', says: 'Raccoons.', thanks: 'Hissing.', spots: [{ at: [60, 0, 0] }, { at: [63, 0, 0] }], yard: { at: [20, 0, 0], half: [4, 4] }, material: { item: 'fence-panel', name: 'stack of fence panels' }, reward: [{ item: 'coin', n: 45 }], after: 'took-fence', done: 'Fence fixed' };
const TASK = { kind: 'task', id: 'fence', app: 'cityline', flag: 'took-fence', name: 'CityLine 311', subscribe: true };

function play(script, vars = {}) {
  const c = composeMechanics([{ kind: 'bag', slice: 'bag' }, REQ, TASK, { kind: 'reach-exit', at: [999, 999, 0] }], ctx), ev = c.events, s = B.createBusState(ev, ev.entities);
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s), g = 0; while (w.length && g++ < 8) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);
  Object.assign(s.vars, vars);
  let prev;
  for (const step of script) {
    if (step.event) pump([{ type: step.event }]);
    if (step.at) for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'hero', position: step.at }], prev, ev.sources); prev = z.prev; pump(z.events); }
  }
  return { vars: s.vars, log: s.log.map((r) => r.type), hud: ev.hud };
}
const take = { event: 'app:take:fence' }, yard = { at: [20, 0, 0] }, fix = (k) => ({ event: `request:fix:fence:${k}` });

describe('the request', () => {
  it('taken, a work order in hand: the material at the yard, each spot fixed, done; the order and material used, paid', () => {
    const r = play([take, yard, fix(1), fix(1), fix(2)], { 'held:bag:work-order': 1 });
    expect(r.vars).toMatchObject({ 'flag-picked-fence': 1, 'fixed-fence': 2, 'flag-done-fence': 1, 'held:bag:work-order': 0, 'held:bag:fence-panel': 0, 'held:bag:coin': 45 });
    expect(r.log).toContain('request:done:fence');
    expect(r.hud.find((h) => h.as === 'banner')).toMatchObject({ text: 'Fence fixed', sub: 'Paid 45 coin · Marjorie: Hissing.' });
    expect(r.hud.find((h) => h.on === 'flag:took-fence').text).toBe('Marjorie: Raccoons.');
  });
  it('no work order: the yard gives nothing and says so; no material: a spot is no fix; not taken: nothing; done once', () => {
    const none = play([take, yard, fix(1), fix(2)]);
    expect(none.log).toContain('request:no-order:fence');
    expect(none.vars).toMatchObject({ 'flag-picked-fence': 0, 'fixed-fence': 0, 'flag-done-fence': 0 });
    expect(play([yard], { 'held:bag:work-order': 1 }).vars['flag-picked-fence']).toBe(0);
    const twice = play([take, yard, fix(1), fix(2), yard, fix(1)], { 'held:bag:work-order': 2 });
    expect(twice.vars).toMatchObject({ 'held:bag:coin': 45, 'held:bag:work-order': 1, 'held:bag:fence-panel': 0 });
  });
});
