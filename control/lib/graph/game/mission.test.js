// A STORY MISSION (mission-mechanics.js lowerMission), walked on the bus: it starts as its job is taken, its goods bring
// the law's stars, its clock runs down; wasted, busted or out of time it fails and starts again a few seconds on;
// done while on, it is passed. A clean hand-in (errand-mechanics.js `clean`) waits for the stars to go.
import { describe, it, expect } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const ctx = { storeSchema: { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'hero', kind: 'character' }] }, player: 'hero', spawn: [0, 0, 0] };
const MISSION = { kind: 'mission', id: 'heist', flag: 'took-heist', name: 'The jeweller', time: 30, heat: 2, hot: 'had-diamonds' };
const WANT = { kind: 'wanted', police: ['police-1', 'police-2', 'police-3', 'police-4'], per: 2, stars: 3 };
const DELIVER = { kind: 'deliver', id: 'heist', at: [50, 0, 0], wants: [{ item: 'diamonds' }], clean: true, open: true, after: 'took-heist' };

function play(M, script, { bag = {}, vars = {} } = {}) {
  const c = composeMechanics([{ kind: 'bag', slice: 'bag' }, ...M, { kind: 'reach-exit', at: [999, 999, 0] }], ctx), ev = c.events, s = B.createBusState(ev, ev.entities);
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s), g = 0; while (w.length && g++ < 8) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);
  for (const [k, n] of Object.entries(bag)) s.vars[`held:bag:${k}`] = n;
  Object.assign(s.vars, vars);
  let prev;
  for (const step of script) {
    if (step.event) pump([{ type: step.event }]);
    if (step.wait) for (let k = 0; k < step.wait; k++) pump(B.tickTimers(s, 1));
    if (step.at) for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'hero', position: step.at }], prev, ev.sources); prev = z.prev; pump(z.events); }
  }
  return { vars: s.vars, log: s.log.map((r) => r.type) };
}
const take = { event: 'flag:took-heist' }, had = { event: 'flag:had-diamonds' };

describe('a story mission', () => {
  it('starts as its job is taken, its clock set and shown; its goods bring the law\'s stars', () => {
    const r = play([MISSION, WANT], [take, had]);
    expect(r.log).toContain('mission:heist');
    expect(r.vars).toMatchObject({ 'mission-on-heist': 1, 'mission-time-heist': 30, 'ui-mission-clock-heist': 1, wanted: 2 });
    // (goods had before it is taken bring nothing)
    expect(play([MISSION, WANT], [had]).vars.wanted).toBe(0);
  });
  it('out of time, wasted or busted it fails, and starts again a few seconds on, its clock whole', () => {
    const late = play([MISSION, WANT], [take, { wait: 31 }]);
    expect(late.log).toContain('mission-failed:heist');
    const back = play([MISSION, WANT], [take, { wait: 31 }, { wait: 5 }]);
    expect(back.log.filter((t) => t === 'mission:heist')).toHaveLength(2);
    expect(back.vars['mission-time-heist']).toBeGreaterThanOrEqual(29);
    for (const ev of ['wasted', 'busted']) expect(play([MISSION, WANT], [take, { event: ev }]).log).toContain('mission-failed:heist');
    // (not on, nothing fails)
    expect(play([MISSION, WANT], [{ event: 'wasted' }]).log).not.toContain('mission-failed:heist');
  });
  it('a clean hand-in waits for the stars to go; done while on, it is passed', () => {
    const hot = play([MISSION, WANT, DELIVER], [take, had, { at: [50, 0, 0] }], { bag: { diamonds: 1 }, vars: { 'flag-took-heist': 1 } });
    expect(hot.log).toContain('errand:hot:heist'); expect(hot.log).not.toContain('errand:done:heist');
    const cool = play([MISSION, WANT, DELIVER], [take, { at: [50, 0, 0] }], { bag: { diamonds: 1 }, vars: { 'flag-took-heist': 1 } });
    expect(cool.log).toContain('errand:done:heist'); expect(cool.log).toContain('mission-passed:heist');
    expect(cool.vars['ui-mission-clock-heist']).toBe(0);
  });
  it('handed in while it waits to start again, it is passed and the restart called off; a done one-off\'s hand-in is quiet after', () => {
    const r = play([MISSION, WANT, DELIVER], [take, { event: 'busted' }, { at: [50, 0, 0] }, { wait: 10 }], { bag: { diamonds: 2 }, vars: { 'flag-took-heist': 1 } });
    expect(r.log).toContain('mission-failed:heist'); expect(r.log).toContain('mission-passed:heist');
    expect(r.log.filter((t) => t === 'mission:heist')).toHaveLength(1);
    expect(r.vars['mission-on-heist']).toBe(0);
    const twice = play([MISSION, WANT, DELIVER], [take, { at: [50, 0, 0] }, { at: [80, 0, 0] }, { at: [50, 0, 0] }], { bag: { diamonds: 2 }, vars: { 'flag-took-heist': 1 } });
    expect(twice.log.filter((t) => t === 'errand:done:heist')).toHaveLength(1);
    expect(twice.log).not.toContain('errand:short:heist');
  });
});

describe('a mission in a game continued', () => {
  it('the save handed back (`resumed`): one taken and not passed starts again; one passed, or never taken, does not', () => {
    expect(play([MISSION, WANT], [{ event: 'resumed' }], { vars: { 'flag-took-heist': 1 } }).log).toContain('mission:heist');
    expect(play([MISSION, WANT], [{ event: 'resumed' }], { vars: { 'flag-took-heist': 1, 'mission-done-heist': 1 } }).log).not.toContain('mission:heist');
    expect(play([MISSION, WANT], [{ event: 'resumed' }]).log).not.toContain('mission:heist');
  });
});

describe('a story told in jobs (gameworld/errand.js `mission`)', () => {
  it('its missions keep the level open but the last, whose hand-in ends it; a clean one asks for no stars', async () => {
    const { errandLegs } = await import('../gameworld/errand.js');
    const job = (id, mission) => ({ id, giver: 'city', reward: [], list: [{ item: `${id}-goods`, at: 'city', count: 1, needs: [] }], roots: [`${id}-goods`], order: [`${id}-goods`], mission });
    const legs = errandLegs([job('first', {}), job('hot', { heat: 2, clean: true }), job('last', { final: true })], 'city').filter((l) => l.kind === 'deliver');
    expect(legs.map((l) => [l.id, !!l.open, !!l.clean])).toEqual([['first', true, false], ['hot', true, true], ['last', false, false]]);
  });
});
