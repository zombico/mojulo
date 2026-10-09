import { describe, it, expect } from 'vitest';
import { createBusState, processEvents, watchEvents, syncToCtrl } from '../../worlds/event-bus.js';
import { composeLive } from '../../worlds/controllable/compose.js';
import { readCues } from './cues.js';
import { readSpots } from './cast.js';
import { lowerPlay, resolvePlayUi } from './direction.js';
import { uiAdvice } from './laws.js';
import { uiBoardHtml } from './board-html.js';

const CW = composeLive();
const DT = 1 / 30;

// a guard, a child minted asleep, a wall in the way, a hero; the cues move them
const ENTITIES = [
  { id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, -6, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7], collide: { a: 0.35, c: 0.85 } } },
  { id: 'guard', rule: { type: 'patrol', speed: 0, turn: 0 }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7], hp: 10, hittable: true, collide: { a: 0.35, c: 0.85 } } },
  { id: 'child', dormant: true, rule: { type: 'static' }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.4, 0.4, 1.1], collide: { a: 0.25, c: 0.55 } } },
  { id: 'wall', rule: { type: 'static' }, transform: { pos: [-6, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [1, 1, 2], heavy: true, collide: { a: 1, c: 1 } } },
];
const SPOTS = [{ id: 'post', at: [4, 2], face: 90, pose: 'stand' }, { id: 'well-side', at: [2, -3] }];

// the page's loop, in node: the world steps, its happenings go up, the bus settles, the cast's ops come down
function level(cues, { menus } = {}) {
  const manifest = { entities: ENTITIES, play: { spots: SPOTS, cues, ...(menus ? { menus } : {}) } };
  const ev = lowerPlay(manifest, { player: 'hero' });
  const world = CW.createWorld({ entities: ENTITIES.map((e) => JSON.parse(JSON.stringify(e))) });
  const bus = createBusState(ev, []);
  let prev;
  const settle = (evs) => { if (evs.length) processEvents(bus, evs); for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
  const tick = (input) => {
    CW.stepWorld(world, input, DT);
    const f = CW.castFacts(world, prev); prev = f.prev;
    settle(f.events);
    syncToCtrl(bus, world.entities, (ops) => CW.castOps(world, ops));
  };
  const begin = () => { tick(); settle(ev.initial || []); syncToCtrl(bus, world.entities, (ops) => CW.castOps(world, ops)); };
  const run = (n, input) => { for (let i = 0; i < n; i++) tick(input); };
  return { ev, world, bus, begin, run, settle, at: (id) => world.byId[id], fired: (type) => bus.log.filter((r) => r.type === type).length };
}

describe('reading the cast', () => {
  it('reads spots, the happenings and the effects, and teaches', () => {
    expect(readSpots({ spots: SPOTS })).toEqual([{ id: 'post', at: [4, 2, 0], face: 90, pose: 'stand' }, { id: 'well-side', at: [2, -3, 0], face: null, pose: null }]);
    const [c] = readCues({ cues: [{ id: 'go', when: { arrive: { who: 'guard', at: 'post' } }, then: [{ walk: { who: 'child', to: ['well-side', [1, 1]], then: 'back' } }, { hurt: { who: 'guard', by: 3 } }] }] });
    expect(c.when).toEqual({ kind: 'arrive', who: 'guard', at: 'post' });
    expect(c.then.map((t) => [t.op, t.who])).toEqual([['walk', 'child'], ['hurt', 'guard']]);
    expect(c.then[0].to).toEqual(['well-side', [1, 1, 0]]);
    const bad = (then) => () => readCues({ cues: [{ id: 'x', when: { start: true }, then }] });
    expect(bad({ hurt: { who: 'guard' } })).toThrow(/by is how much/);
    expect(bad({ walk: { who: 'guard' } })).toThrow(/to is a place/);
    expect(bad({ walk: { who: 'guard', to: 'post', then: 'run' } })).toThrow(/stay, loop, back/);
    expect(bad({ kill: 3 })).toThrow(/character's id/);
    expect(() => readSpots({ spots: [{ id: 'a', at: [0, 0], pose: 'dance' }] })).toThrow(/pose is one of/);
  });

  it('lowers effects to ctrl intents with their places resolved, and marks the world as using the cast', () => {
    const { ev } = level([{ id: 'go', when: { start: true }, then: { walk: { who: 'guard', to: ['well-side', 'post'] } } }]);
    expect(ev.cast).toBe(true);
    expect(ev.reactions).toContainEqual({ on: 'cue:go', do: 'ctrl', op: 'walk', who: 'guard', points: [[2, -3], [4, 2]], names: ['well-side', 'post'], face: 90, pose: 'stand' });
    // a place nobody carries drops the effect (the laws name it)
    const lost = level([{ id: 'go', when: { start: true }, then: { walk: { who: 'guard', to: 'nowhere' } } }]);
    expect((lost.ev.reactions || []).some((r) => r.do === 'ctrl')).toBe(false);
    // no cast, no flag
    expect(lowerPlay({ play: { cues: [{ id: 'hi', when: { start: true }, then: { say: 'hi' } }] } }).cast).toBeUndefined();
  });
});

describe('the cast on the bus (the page loop, in node)', () => {
  it('a walk arrives point by point, takes the spot\'s facing and pose, and the arrival fires a cue', () => {
    const L = level([
      { id: 'go', when: { start: true }, then: { walk: { who: 'guard', to: ['well-side', 'post'], speed: 4 } } },
      { id: 'posted', when: { arrive: { who: 'guard', at: 'post' } }, then: { set: 'posted', to: 1 } },
    ]);
    L.begin();
    L.run(150);
    const g = L.at('guard');
    expect(Math.hypot(g.transform.pos[0] - 4, g.transform.pos[1] - 2)).toBeLessThan(0.35);
    expect(g.route).toBeNull();
    expect(g.held).toBe(true);
    expect(g.pose).toBe('stand');
    expect(g.transform.heading).toBeCloseTo(Math.PI / 2, 5);
    expect(L.fired('arrive')).toBe(2);
    expect(L.bus.vars.posted).toBe(1);
  });

  it('loop keeps walking; back walks the points back and stays', () => {
    const L = level([{ id: 'go', when: { start: true }, then: { walk: { who: 'guard', to: [[2, 0], [2, 2]], speed: 6, then: 'loop' } } }]);
    L.begin(); L.run(200);
    expect(L.at('guard').route).not.toBeNull();
    expect(L.fired('arrive')).toBeGreaterThan(4);
    const B = level([{ id: 'go', when: { start: true }, then: { walk: { who: 'guard', to: [[2, 0], [2, 2]], speed: 6, then: 'back' } } }]);
    B.begin(); B.run(200);
    expect(B.at('guard').route).toBeNull();
    expect(B.at('guard').transform.pos[0]).toBeCloseTo(2, 0);
    expect(B.at('guard').transform.pos[1]).toBeCloseTo(0, 0);
  });

  it('a walk into a solid body is stuck after a second without progress, and the walk drops', () => {
    const L = level([
      { id: 'go', when: { start: true }, then: { walk: { who: 'guard', to: [[-6, 0]] } } },
      { id: 'blocked', when: { stuck: 'guard' }, then: { set: 'blocked', to: 1 } },
    ]);
    L.begin(); L.run(200);
    expect(L.bus.vars.blocked).toBe(1);
    expect(L.at('guard').route).toBeNull();
    expect(L.at('guard').transform.pos[0]).toBeGreaterThan(-6 + 1.2);   // the wall (heavy) held; the guard gave way
    expect(L.at('wall').transform.pos).toEqual([-6, 0, 0]);
  });

  it('hurt takes hp; at 0 the character falls, down fires, and its rule is held', () => {
    const L = level([
      { id: 'hit', when: { on: 'strike' }, then: { hurt: { who: 'guard', by: 4 } } },
      { id: 'fell', when: { down: 'guard' }, then: { set: 'fallen', to: 1 } },
      { id: 'mend', when: { on: 'mend' }, then: { heal: 'guard' } },
    ]);
    L.begin();
    for (let i = 0; i < 2; i++) { L.settle([{ type: 'strike' }]); L.run(1); }
    expect(L.at('guard').body.hp).toBe(2);
    L.settle([{ type: 'mend' }]); L.run(1);
    expect(L.at('guard').body.hp).toBe(10);
    for (let i = 0; i < 3; i++) { L.settle([{ type: 'strike' }]); L.run(1); }
    L.run(1);   // a fall lands after the tick; its happening is read on the next
    expect(L.at('guard').downed).toBe(true);
    expect(L.at('guard').body.hp).toBe(0);
    expect(L.bus.vars.fallen).toBe(1);
    expect(L.fired('down')).toBe(1);
    expect(L.at('guard').castDown).toBe(true);   // the cast's owner holds the body while it lies
  });

  it('spawn wakes one minted asleep where it is told; vanish sends it away; both fire', () => {
    const L = level([
      { id: 'come', when: { on: 'call' }, then: { spawn: { who: 'child', at: 'well-side', face: 180 } } },
      { id: 'came', when: { spawned: 'child' }, then: { set: 'here', to: 1 } },
      { id: 'away', when: { on: 'bye' }, then: { vanish: 'child' } },
      { id: 'went', when: { gone: 'child' }, then: { set: 'here', to: 0 } },
    ]);
    L.begin(); L.run(3);
    expect(L.at('child').gone).toBe(true);
    expect(L.fired('spawned')).toBe(0);   // asleep from the start is not a happening
    L.settle([{ type: 'call' }]); L.run(2);
    expect(L.at('child').gone).toBe(false);
    expect(L.at('child').transform.pos.slice(0, 2)).toEqual([2, -3]);
    expect(L.at('child').transform.heading).toBeCloseTo(Math.PI, 5);
    expect(L.bus.vars.here).toBe(1);
    L.settle([{ type: 'bye' }]); L.run(2);
    expect(L.at('child').gone).toBe(true);
    expect(L.bus.vars.here).toBe(0);
  });

  it('a kill from a menu choice; the same run replays to the same world', () => {
    const play = [{ id: 'talk', when: { on: 'talk' }, then: { open: 'guard-talk' } }];
    const menus = [{ id: 'guard-talk', kind: 'talk', who: 'Guard', lines: ['Halt.'], choices: [{ say: 'Fight', then: { kill: 'guard' } }, { say: 'Leave' }] }];
    const once = () => {
      const L = level(play, { menus });
      L.begin(); L.settle([{ type: 'talk' }, { type: 'menu-pick:guard-talk:0' }]); L.run(30);
      return L;
    };
    const a = once(), b = once();
    expect(a.at('guard').downed).toBe(true);
    expect(a.at('guard').castDown).toBe(true);
    expect(a.fired('down')).toBe(1);
    expect(JSON.stringify(a.world.entities.map((e) => [e.id, e.transform, e.downed, e.gone]))).toBe(JSON.stringify(b.world.entities.map((e) => [e.id, e.transform, e.downed, e.gone])));
  });
});

describe('bodies keep their space', () => {
  it('a walk-rule hero is pushed out of a body on the ground plane; a heavy one holds', () => {
    const w = CW.createWorld({ entities: [
      { id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, 0, 0] }, body: { type: 'none', collide: { a: 0.35, c: 0.85 } } },
      { id: 'post', rule: { type: 'static' }, transform: { pos: [0.5, 0, 0] }, body: { type: 'none', heavy: true, collide: { a: 0.5, c: 1 } } },
    ] });
    CW.stepWorld(w, {}, DT);
    expect(w.byId.post.transform.pos).toEqual([0.5, 0, 0]);
    expect(w.byId.hero.transform.pos[0]).toBeLessThan(0.5 - 0.84);
    expect(w.byId.hero.transform.pos[2]).toBe(0);
  });
});

describe('the laws and the board', () => {
  it('names a character the world lacks, a place it lacks, and a spawn of someone already up', () => {
    const play = { spots: SPOTS, cues: [
      { id: 'a', when: { start: true }, then: [{ walk: { who: 'ghost', to: 'post' } }, { spawn: 'guard' }, { walk: { who: 'guard', to: 'attic' } }] },
    ] };
    const laws = uiAdvice(play, null, { entities: ENTITIES, anchors: [] });
    expect(laws.find((l) => l.law === 'cast-known').at).toBe('ghost');
    expect(laws.find((l) => l.law === 'spawn-asleep').at).toBe('guard');
    expect(laws.find((l) => l.law === 'cast-places').at).toBe('attic');
    expect(uiAdvice({ spots: SPOTS, cues: [{ id: 'b', when: { start: true }, then: { spawn: 'child' } }] }, null, { entities: ENTITIES }).filter((l) => l.law.startsWith('cast') || l.law === 'spawn-asleep')).toEqual([]);
  });

  it('the board says what the cast does', () => {
    const html = uiBoardHtml(resolvePlayUi({ entities: ENTITIES, play: { spots: SPOTS, ui: 'propose', cues: [{ id: 'go', when: { down: 'guard' }, then: { walk: { who: 'child', to: ['well-side', 'post'], then: 'loop' } } }] } }, () => 7));
    expect(html).toContain('guard falls');
    expect(html).toContain('child walks to well-side → post (loop)');
  });
});

describe('the page', () => {
  it('reads the cast\'s happenings and hands it the ops only when the world uses them', async () => {
    const { eventsChannelScript } = await import('../../scene/channels/events.js');
    const { ev } = level([{ id: 'go', when: { start: true }, then: { kill: 'guard' } }]);
    const js = eventsChannelScript(ev);
    expect(js).toContain('window.__mojCtrl.facts(__castPrev)');
    expect(js).toContain(', window.__mojCtrl.cast);');
    const { cast, ...bare } = ev;
    const plain = eventsChannelScript(bare);
    expect(plain).not.toContain('__castPrev');
    expect(plain).toContain('__BUS.syncToCtrl(__busState, window.__mojCtrl.world.entities); // apply respawn/teleport warps');
  });
});
