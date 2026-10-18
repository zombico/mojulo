import { describe, it, expect } from 'vitest';
import { createBusState, processEvents, watchEvents, syncToCtrl } from '../../worlds/event-bus.js';
import { composeLive } from '../../worlds/controllable/compose.js';
import { lowerPlay } from './direction.js';
import { readParty, partyCues, partyFlags } from './party.js';
import { sceneContract } from './scenes.js';

const CW = composeLive(), DT = 1 / 30;
const box = { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] };
const TEO = (extra = {}) => ({ id: 'teo', rule: { type: 'ai', mind: { motivation: 'escort' }, escort: 'hero', followDist: 3, eye: 0, speed: 3 }, team: 'party', transform: { pos: [6, 0, 0], heading: 0 }, body: box, ...extra });
const SPOTS = [{ id: 'gate', at: [6, 0] }];

// the page's loop in node (as scenes.test.js): the world steps, its facts go up, the bus settles, the cast's ops come down
function level(party, teo = TEO()) {
  const entities = [{ id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 }, body: box }, teo];
  const manifest = { entities, play: { spots: SPOTS, party, carry: 'story' } };
  const ev = lowerPlay(manifest, { player: 'hero' });
  const world = CW.createWorld({ entities: JSON.parse(JSON.stringify(entities)), camera: { rule: 'follow', target: 'hero' } });
  const bus = createBusState(ev, []);
  let prev;
  const settle = (evs) => { if (evs.length) processEvents(bus, evs); for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
  const tick = () => { CW.stepWorld(world, {}, DT); const f = CW.castFacts(world, prev); prev = f.prev; settle(f.events); syncToCtrl(bus, world.entities, (ops) => CW.castOps(world, ops)); };
  const run = (s) => { for (let i = 0; i < s / DT; i++) tick(); };
  const fire = (type) => { settle([{ type }]); syncToCtrl(bus, world.entities, (ops) => CW.castOps(world, ops)); };
  const at = (id) => world.entities.find((e) => e.id === id).transform.pos;
  const hero = world.entities.find((e) => e.id === 'hero');
  settle(ev.initial || []); tick();
  return { ev, bus, world, run, fire, at, hero, teo: () => world.entities.find((e) => e.id === 'teo') };
}
const far = (L) => Math.hypot(L.at('teo')[0] - L.hero.transform.pos[0], L.at('teo')[1] - L.hero.transform.pos[1]);

describe('the party', () => {
  it('held at its spot until it joins, then it follows the pilot', () => {
    const L = level([{ who: 'teo', joins: 'joined-teo', at: 'gate' }]);
    L.hero.transform.pos = [-20, 0, 0];
    L.run(3);
    expect(L.at('teo')[0]).toBeCloseTo(6, 0);   // waiting at the gate
    L.fire('flag:joined-teo');
    L.run(10);
    expect(far(L)).toBeLessThan(4.5);   // came to the pilot, and keeps its distance
    expect(L.bus.vars['flag-joined-teo']).toBe(1);
  });

  it('not here until it joins: minted asleep, woken by the flag carried in, then it follows', () => {
    const L = level([{ who: 'teo', joins: 'joined-teo' }], TEO({ dormant: true }));
    L.run(1);
    expect(L.teo().gone || L.teo().dormant).toBeTruthy();
    L.fire('flag-carried:joined-teo');
    L.hero.transform.pos = [-15, 0, 0];
    L.run(10);
    expect(L.teo().dormant).toBeFalsy();
    expect(far(L)).toBeLessThan(4.5);
  });

  it('the join is carried: the contract writes the flag to the story slice and pushes it in', () => {
    const g = sceneContract({ levelRef: 'l', produces: { events: [] } }, { carry: 'story', party: [{ who: 'teo', joins: 'joined-teo' }] });
    expect(g.on['flag:joined-teo']).toEqual({ emit: { type: 'setFlag', slice: 'story', key: 'joined-teo', value: true } });
    expect(g.flags.names).toEqual(['joined-teo']);
  });

  it('a member with no joins flag is with the pilot from the start: woken as the level starts, no flag to carry', () => {
    const play = { party: [{ who: 'mira' }, { who: 'teo', joins: 'joined-teo' }] };
    expect(partyCues(play)[0]).toEqual({ id: 'party-mira-start', when: { start: true }, then: { spawn: 'mira' } });
    expect(partyFlags(play)).toEqual(['joined-teo']);
    const L = level([{ who: 'teo' }], TEO({ dormant: true }));
    L.hero.transform.pos = [-15, 0, 0];
    L.run(10);
    expect(L.teo().dormant).toBeFalsy();
    expect(far(L)).toBeLessThan(4.5);
  });

  it('teaches a bad member', () => {
    const bad = (party) => () => readParty({ party });
    expect(bad({})).toThrow(/is a list of \{ who, joins\?, at\? \}/);
    expect(bad([{ who: 'teo', joins: 'Joined' }])).toThrow(/joins is the flag/);
    expect(bad([{ who: 'teo', at: 'start' }])).toThrow(/with the pilot from the start waits nowhere/);
    expect(bad([{ who: 'teo', joins: 'x', role: 'tank' }])).toThrow(/role is not part of a member/);
    expect(bad([{ who: 'teo', joins: 'x' }, { who: 'teo', joins: 'y' }])).toThrow(/'teo' appears twice/);
  });
});
