import { describe, it, expect } from 'vitest';
import { createBusState, processEvents, watchEvents, deriveZoneEvents } from '../../worlds/event-bus.js';
import { composeLive } from '../../worlds/controllable/compose.js';
import { standPoints } from './cast.js';
import { lowerPlay } from './direction.js';
import { uiAdvice } from './laws.js';

const CW = composeLive();
const DT = 1 / 30;

describe('box bodies', () => {
  const world = (heroAt, more = []) => CW.createWorld({ entities: [
    { id: 'hero', rule: { type: 'walk' }, transform: { pos: heroAt }, body: { type: 'none', collide: { a: 0.35, c: 0.85 } } },
    { id: 'gate', rule: { type: 'static' }, transform: { pos: [0, 0, 1] }, body: { type: 'none', heavy: true, collide: { box: [2, 0.2, 1] } } },
    ...more,
  ] });

  it('a wide gate blocks its whole width: the walker is pushed off its face on the ground plane, and the gate holds', () => {
    // 1.6 m along the gate, where a round collide of the same width (a = 2) would be a disc and a box is still a wall
    const w = world([1.6, 0.3, 0]);
    CW.stepWorld(w, {}, DT);
    expect(w.byId.gate.transform.pos).toEqual([0, 0, 1]);
    expect(w.byId.hero.transform.pos[1]).toBeCloseTo(0.2 + 0.35, 5);
    expect(w.byId.hero.transform.pos[0]).toBeCloseTo(1.6, 5);
    expect(w.byId.hero.transform.pos[2]).toBe(0);
    // a centre inside the footprint leaves through the nearest side
    const w2 = world([1.9, 0.05, 0]);
    CW.stepWorld(w2, {}, DT);
    expect(w2.byId.hero.transform.pos[0]).toBeCloseTo(2 + 0.35, 5);
    // past its end, nothing touches
    const w3 = world([2.5, 0, 0]);
    CW.stepWorld(w3, {}, DT);
    expect(w3.byId.hero.transform.pos).toEqual([2.5, 0, 0]);
  });

  it('gone, it frees the way; two boxes leave each other be; an egg above its top passes', () => {
    const w = world([1.6, 0.3, 0]);
    w.byId.gate.gone = true;
    CW.stepWorld(w, {}, DT);
    expect(w.byId.hero.transform.pos).toEqual([1.6, 0.3, 0]);
    const crate = { id: 'crate', rule: { type: 'walk' }, transform: { pos: [0.5, 0.1, 1] }, body: { type: 'none', collide: { box: [0.5, 0.5, 0.5] } } };
    const w2 = world([9, 9, 0], [crate]);
    CW.stepWorld(w2, {}, DT);
    expect(w2.byId.crate.transform.pos.slice(0, 2)).toEqual([0.5, 0.1]);
    const w3 = world([1.6, 0.3, 3]);
    CW.stepWorld(w3, {}, DT);
    expect(w3.byId.hero.transform.pos.slice(0, 2)).toEqual([1.6, 0.3]);
  });
});

describe('stand points', () => {
  const ANCHORS = [
    { id: 'doorway-nave-crypt', kind: 'doorway', between: ['nave', 'crypt'], at: [4, 0, 0], N: [1, 0, 0] },
    { id: 'west', kind: 'door', at: [0, -3, 0], N: [0, -1, 0] },
    { id: 'coffin-2', kind: 'item', at: [1, 1, 0] },
  ];

  it('a doorway gives a place in each room, a door its front and back, each 0.75 m off the sill and facing it', () => {
    expect(standPoints(ANCHORS)).toEqual([
      { id: 'doorway-nave-crypt@nave', kind: 'stand', of: 'doorway-nave-crypt', at: [3.25, 0, 0], face: 0, pose: null },
      { id: 'doorway-nave-crypt@crypt', kind: 'stand', of: 'doorway-nave-crypt', at: [4.75, 0, 0], face: 180, pose: null },
      { id: 'west@front', kind: 'stand', of: 'west', at: [0, -3.75, 0], face: 90, pose: null },
      { id: 'west@back', kind: 'stand', of: 'west', at: [0, -2.25, 0], face: -90, pose: null },
    ]);
  });

  it('they are places: a walk goes there and takes the facing; a cue zone and a use find them; the laws know them', () => {
    const play = { cues: [
      { id: 'go', when: { start: true }, then: { walk: { who: 'guard', to: 'doorway-nave-crypt@crypt' } } },
      { id: 'knock', when: { use: 'west@front', prompt: 'knock' }, then: { set: 'knocked', to: 1 } },
    ] };
    const ev = lowerPlay({ play }, { anchors: ANCHORS, player: 'hero' });
    expect(ev.reactions).toContainEqual({ on: 'cue:go', do: 'ctrl', op: 'walk', who: 'guard', points: [[4.75, 0]], names: ['doorway-nave-crypt@crypt'], face: 180 });
    expect(ev.sources.find((s) => s.use)).toMatchObject({ zone: 'use-west@front', at: [0, -3.75, 0], use: 'west@front', prompt: 'knock' });
    const laws = uiAdvice(play, null, { anchors: ANCHORS, entities: [{ id: 'guard' }, { id: 'hero' }] });
    expect(laws.filter((l) => l.law === 'cast-places' || l.law === 'cue-anchor')).toEqual([]);
  });
});

describe('zones that watch anyone', () => {
  const ENTS = [{ id: 'hero', transform: { pos: [0, 0, 0] } }, { id: 'guard', transform: { pos: [9, 9, 0] } }];
  const play = { cues: [{ id: 'gate-watch', when: { near: { at: [5, 5], r: 1, who: 'guard' } }, then: { set: 'guard-at-gate', to: 1 } }] };

  it('a zone with who fires for that character, not the player; one sent away stands in no zone', () => {
    const ev = lowerPlay({ play }, { player: 'hero' });
    expect(ev.sources).toEqual([{ type: 'zone', zone: 'cue-gate-watch', at: [5, 5, 0], radius: 1, planar: true, watch: 'guard' }]);
    const bus = createBusState(ev, []);
    const run = (evs) => { processEvents(bus, evs); for (let k = 0; k < 4; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
    ENTS[0].transform.pos = [5, 5, 0];
    let z = deriveZoneEvents(ENTS, null, ev.sources);
    run(z.events);
    expect(bus.vars['guard-at-gate'] ?? 0).toBe(0);
    ENTS[1].transform.pos = [5, 5.5, 0];
    ENTS[1].gone = true;
    z = deriveZoneEvents(ENTS, z.prev, ev.sources);
    expect(z.events).toEqual([]);
    delete ENTS[1].gone;
    z = deriveZoneEvents(ENTS, z.prev, ev.sources);
    run(z.events);
    expect(bus.vars['guard-at-gate']).toBe(1);
  });

  it('teaches who, and the laws name a who the world lacks', () => {
    expect(() => lowerPlay({ play: { cues: [{ id: 'x', when: { near: { at: [0, 0], r: 1, who: 3 } }, then: { set: 'a', to: 1 } }] } })).toThrow(/who is a character's id/);
    const laws = uiAdvice({ cues: [{ id: 'x', when: { enter: { at: [0, 0], r: 1, who: 'ghost' } }, then: { set: 'a', to: 1 } }] }, null, { entities: [{ id: 'hero' }] });
    expect(laws.find((l) => l.law === 'cast-known').at).toBe('ghost');
  });
});

describe('the laws', () => {
  it('a stuck walk retried every time, and a wide heavy thing colliding round', () => {
    const ents = [{ id: 'guard' }, { id: 'gate', body: { heavy: true, collide: { a: 2, c: 1 } } }, { id: 'counter', body: { heavy: true, collide: { box: [1.5, 0.5, 0.55] } } }, { id: 'post', body: { heavy: true, collide: 0.5 } }];
    const cues = (once) => [{ id: 'retry', when: { stuck: 'guard' }, then: { walk: { who: 'guard', to: [[0, 5]] } }, ...(once ? { once } : {}) }];
    const laws = uiAdvice({ cues: cues(false) }, null, { entities: ents });
    expect(laws.find((l) => l.law === 'stuck-retry').at).toBe('cue retry');
    expect(laws.filter((l) => l.law === 'round-collide').map((l) => l.at)).toEqual(['gate']);
    expect(uiAdvice({ cues: cues(true) }, null, { entities: ents }).some((l) => l.law === 'stuck-retry')).toBe(false);
  });
});
