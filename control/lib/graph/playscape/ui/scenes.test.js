import { describe, it, expect } from 'vitest';
import { createBusState, processEvents, watchEvents, syncToCtrl } from '../../worlds/event-bus.js';
import { composeLive } from '../../worlds/controllable/compose.js';
import { lowerPlay } from './direction.js';
import { readScenes, sceneProgram, sceneContract, SHOT_FRAMES } from './scenes.js';
import { buildSceneRunner } from './scene-runner.js';
import { sceneScript } from '../../scene/channels/scene-channel.js';
import { eventsChannelScript } from '../../scene/channels/events.js';
import { gameChannelScript } from '../../scene/channels/game.js';

const CW = composeLive(), R = buildSceneRunner();
const DT = 1 / 30;

// a hero the follow camera watches, a mayor who walks to the porch and talks
const ENTITIES = [
  { id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, -6, 0], heading: Math.PI / 2 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } },
  { id: 'mayor', rule: { type: 'static' }, transform: { pos: [6, 0, 0], heading: Math.PI }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } },
];
const SPOTS = [{ id: 'porch', at: [2, -4], face: -90 }];
const ARRIVAL = {
  id: 'arrival', when: { start: true }, names: { mayor: 'Mayor Ilse' },
  beats: [
    { shot: { frame: 'wide', on: ['mayor'] }, for: 1 },
    { do: { walk: { who: 'mayor', to: 'porch' } } },
    { until: { arrive: 'mayor' } },
    { banter: { with: ['mayor', 'hero'], lines: [{ who: 'mayor', say: 'Welcome to the hold.' }, { who: 'hero' }] } },
  ],
};

// the page's loop, in node: the world steps, its facts go up, the bus settles, the cast's ops come down, and the scene
// runner hears the bus and answers with events and camera ops
function level(scenes, extraCues = [], extraPlay = {}) {
  const manifest = { entities: ENTITIES, play: { spots: SPOTS, scenes, cues: extraCues, ...extraPlay } };
  const ev = lowerPlay(manifest, { player: 'hero' });
  const world = CW.createWorld({ entities: ENTITIES.map((e) => JSON.parse(JSON.stringify(e))), camera: { rule: 'follow', target: 'hero' } });
  const bus = createBusState(ev, []), S = R.create(ev.scenes);
  const playerCam = world.camera.rule;
  let prev, seen = 0;
  const settle = (evs) => { if (evs.length) processEvents(bus, evs); for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
  const down = () => syncToCtrl(bus, world.entities, (ops) => CW.castOps(world, ops));
  const tick = (ctl = {}) => {
    CW.stepWorld(world, {}, DT);
    const f = CW.castFacts(world, prev); prev = f.prev;
    settle(f.events);
    down();
    R.hear(S, bus.log.slice(seen).map((x) => x && x.type)); seen = bus.log.length;
    const o = R.step(S, DT, { ...ctl, vars: bus.vars });
    // as the page does: the beats' events, the cast ops they queue handed down, then the runner's own ops
    if (o.fire.length) { settle(o.fire.map((type) => ({ type }))); down(); }
    if (o.ops.length) CW.castOps(world, o.ops);
    return o;
  };
  const begin = () => { settle(ev.initial || []); return tick(); };
  const until = (pred, n = 600, ctl) => { for (let i = 0; i < n; i++) { if (pred()) return true; tick(ctl); } return pred(); };
  return { ev, world, bus, S, begin, tick, until, playerCam, view: () => R.view(S), fired: (t) => bus.log.filter((x) => x && x.type === t).length };
}

describe('scenes, read and lowered', () => {
  it('a scene lowers to cues and a program; a banter becomes a two-shot, then a cut to each speaker', () => {
    const p = sceneProgram({ scenes: [ARRIVAL] })[0];
    expect(p.beats.map((b) => b.kind)).toEqual(['shot', 'fire', 'until', 'shot', 'line', 'shot', 'line']);
    expect(p.beats[3].shot).toEqual({ frame: 'two', on: ['mayor', 'hero'] });
    expect(p.beats[5].shot).toEqual({ frame: 'over', on: ['hero', 'mayor'] });
    expect(p.beats[4]).toMatchObject({ name: 'Mayor Ilse', text: 'Welcome to the hold.' });
    expect(p.beats[6]).toMatchObject({ name: 'Hero', text: '[Hero: line 2]' });   // the words are a slot
    const ev = lowerPlay({ entities: ENTITIES, play: { spots: SPOTS, scenes: [ARRIVAL] } }, { player: 'hero' });
    expect(ev.scenes).toEqual([p]);
  });

  it('teaches a bad scene', () => {
    const bad = (beats, extra = {}) => () => readScenes({ scenes: [{ id: 's', when: { start: true }, beats, ...extra }] });
    expect(bad([{ shot: { frame: 'dolly', on: 'hero' } }])).toThrow(/frame is one of wide, low, profile, corner, overhead, two, close, over/);
    expect(bad([{ shot: { frame: 'over', on: ['hero'] } }])).toThrow(/over-the-shoulder frames two/);
    expect(bad([{ wait: 2, line: { who: 'hero' } }])).toThrow(/is one beat .* it names wait and line/);
    expect(bad([{ banter: { with: ['a', 'b'], lines: [{ who: 'c' }] } }])).toThrow(/'c' is not one of the two talking/);
    expect(bad([{ do: { fly: 'hero' } }])).toThrow();
    expect(bad([{ wait: 1 }], { when: 'start' })).toThrow(/when is a cue's when/);
    expect(Object.keys(SHOT_FRAMES)).toContain('over');
  });
});

describe('a scene played', () => {
  it('takes the camera, moves the cast, waits for the walk, talks, and hands the camera back', () => {
    const L = level([ARRIVAL]);
    const o = L.begin();
    expect(o.started).toEqual(['arrival']);
    expect(L.world.camera.rule).toMatchObject({ type: 'shot', frame: 'wide', on: ['mayor'] });
    expect(L.world.camera.heldRule).toBe(L.playerCam);
    expect(L.view()).toMatchObject({ on: true, line: null });
    // the shot holds a second, then the mayor walks to the porch and the scene waits on the arrival
    expect(L.until(() => L.fired('scene:arrival:1') === 1, 40)).toBe(true);
    expect(L.view().line).toBeNull();
    expect(L.until(() => !!L.view().line, 600)).toBe(true);
    const m = L.world.byId.mayor.transform.pos;
    expect(Math.hypot(m[0] - 2, m[1] + 4)).toBeLessThan(0.6);
    // the banter: the two-shot, the mayor's line typing on, a press shows it whole, the next goes on
    expect(L.world.camera.rule).toMatchObject({ frame: 'two', on: ['mayor', 'hero'] });
    L.tick();
    expect(L.view().line.full).toBe(false);
    L.tick({ next: true });
    expect(L.view().line).toMatchObject({ name: 'Mayor Ilse', text: 'Welcome to the hold.', full: true });
    L.tick({ next: true });
    expect(L.view().line).toMatchObject({ name: 'Hero', text: '' });
    expect(L.world.camera.rule).toMatchObject({ frame: 'over', on: ['hero', 'mayor'] });
    L.tick({ next: true }); L.tick({ next: true });
    // the end: the player's own camera rule back, the same object; scene-end on the bus
    expect(L.view().on).toBe(false);
    expect(L.world.camera.rule).toBe(L.playerCam);
    expect(L.world.camera.heldRule).toBeNull();
    expect(L.fired('scene-end:arrival')).toBe(1);
  });

  it('a skip lands the end state: the walk finished, the camera handed back', () => {
    const L = level([ARRIVAL]);
    L.begin();
    L.until(() => L.fired('scene:arrival:1') === 1, 40);
    L.tick({ skip: true });
    expect(L.view().on).toBe(false);
    const m = L.world.byId.mayor;
    expect([m.transform.pos[0], m.transform.pos[1]]).toEqual([2, -4]);
    expect(m.route).toBeNull();
    expect(L.world.camera.rule).toBe(L.playerCam);
    expect(L.fired('scene-end:arrival')).toBe(1);
  });

  it('a skip before the cast has moved still lands it: the walk the skip fires finishes', () => {
    const L = level([ARRIVAL]);
    L.begin();
    expect(L.fired('scene:arrival:1')).toBe(0);
    L.tick({ skip: true });
    const m = L.world.byId.mayor;
    expect([m.transform.pos[0], m.transform.pos[1]]).toEqual([2, -4]);
    expect(m.route).toBeNull();
    expect(L.world.camera.rule).toBe(L.playerCam);
  });

  it('holding the advance key skips too; a short press only advances', () => {
    const L = level([{ id: 'talk', when: { start: true }, beats: [{ line: { who: 'mayor', say: 'One.' } }, { line: { who: 'mayor', say: 'Two.' } }] }]);
    L.begin();
    L.tick({ next: true, held: true });
    expect(L.view().line.full).toBe(true);
    for (let i = 0; i < Math.ceil(R.HOLD / DT) - 2; i++) L.tick({ held: true });
    expect(L.view().on).toBe(true);
    L.tick({ held: true }); L.tick({ held: true });
    expect(L.view().on).toBe(false);
  });

  it('once by default: the scene plays the first time its happening comes', () => {
    const L = level([{ id: 'hello', when: { on: 'ring' }, beats: [{ wait: 0.1 }] }]);
    L.begin();
    for (let k = 0; k < 2; k++) { processEvents(L.bus, [{ type: 'ring' }]); L.until(() => false, 10); }
    expect(L.fired('scene-end:hello')).toBe(1);
  });

  it('a scene-end can start what follows (a cue on it)', () => {
    const L = level([{ id: 'a', when: { start: true }, beats: [{ wait: 0.1 }] }], [{ id: 'after', when: { on: 'scene-end:a' }, then: { set: 'done', to: 1 } }]);
    L.begin();
    L.until(() => L.bus.vars.done === 1, 30);
    expect(L.bus.vars.done).toBe(1);
  });
});

describe('conditions and flags', () => {
  const quick = (id, extra = {}) => ({ id, when: { on: 'ring' }, beats: [{ wait: 0.1 }], ...extra });
  const ring = (L) => { processEvents(L.bus, [{ type: 'ring' }]); L.until(() => false, 10); };

  it('if gates a scene; sets writes the flag as it ends, and the next scene reads it', () => {
    const L = level([quick('greet', { if: { not: 'met' }, sets: ['met'] }), quick('again', { if: { flag: 'met' }, once: false })]);
    L.begin();
    ring(L);
    expect([L.fired('scene-end:greet'), L.fired('scene-end:again')]).toEqual([1, 0]);
    expect(L.bus.vars['flag-met']).toBe(1);
    ring(L); ring(L);
    expect([L.fired('scene-end:greet'), L.fired('scene-end:again')]).toEqual([1, 2]);
  });

  it('a scene whose conditions failed plays when its happening comes again and they hold (once counts plays)', () => {
    const L = level([quick('rich', { if: { var: 'coins', gte: 2 } })], [], {});
    L.begin();
    L.bus.vars.coins = 0; ring(L);
    expect(L.fired('scene-end:rich')).toBe(0);
    L.bus.vars.coins = 2; ring(L);
    expect(L.fired('scene-end:rich')).toBe(1);
    ring(L);
    expect(L.fired('scene-end:rich')).toBe(1);
  });

  it('carried in: a start scene waits for flags-ready and reads the flags the game pushed first', () => {
    const scenes = [{ id: 'welcome-back', when: { start: true }, if: { flag: 'met' }, beats: [{ wait: 0.1 }] }, { id: 'first', when: { start: true }, if: { not: 'met' }, sets: ['met'], beats: [{ wait: 0.1 }] }];
    const held = level(scenes, [], { carry: 'story' });
    held.begin();
    held.until(() => false, 5);
    expect(held.fired('scene:welcome-back') + held.fired('scene:first')).toBe(0);   // nothing yet: no flags-ready
    processEvents(held.bus, [{ type: 'flag-carried:met' }, { type: 'flags-ready' }]);
    held.until(() => false, 10);
    expect([held.fired('scene-end:welcome-back'), held.fired('scene-end:first')]).toEqual([1, 0]);
    const fresh = level(scenes, [], { carry: 'story' });
    fresh.begin();
    processEvents(fresh.bus, [{ type: 'flags-ready' }]);
    fresh.until(() => false, 10);
    expect([fresh.fired('scene-end:welcome-back'), fresh.fired('scene-end:first')]).toEqual([0, 1]);
    expect(fresh.fired('flag:met')).toBe(1);
    // without carry, a start scene starts on the level's start, as before
    const plain = level([{ id: 'p', when: { start: true }, beats: [{ wait: 0.1 }] }]);
    expect(plain.begin().started).toEqual(['p']);
  });

  it('the contract writes what scenes set to the carry slice and pushes what they read', () => {
    const play = { carry: 'story', scenes: [{ id: 'a', when: { start: true }, if: { flag: 'seen-gate' }, sets: ['met'], beats: [{ wait: 1 }] }] };
    const g = sceneContract({ levelRef: 'l', produces: { events: [] } }, play);
    expect(g.on['flag:met']).toEqual({ emit: { type: 'setFlag', slice: 'story', key: 'met', value: true } });
    expect(g.on['flag:seen-gate']).toBeUndefined();   // read, not set here
    expect(g.flags).toEqual({ slice: 'story', names: ['met', 'seen-gate'] });
    expect(g.consumes).toEqual([{ slice: 'story' }]);
    expect(g.produces.events).toEqual([{ type: 'setFlag', slice: 'story' }]);
    const game = { levelRef: 'l' };
    expect(sceneContract(game, { scenes: play.scenes })).toBe(game);   // no carry: the same object
  });

  it('has and done: carried in from the store, or an item picked up here', () => {
    const scenes = [quick('rich', { if: { has: 'rune' } }), quick('vet', { if: { done: 'cave' } })];
    const from = { carryFrom: { items: ['bag'], campaign: 'campaign', levels: { cave: 'gw-level-cave-0' } } };
    const L = level(scenes, [], from);
    L.begin();
    ring(L);
    expect([L.fired('scene-end:rich'), L.fired('scene-end:vet')]).toEqual([0, 0]);
    processEvents(L.bus, [{ type: 'pickup:rune' }]); ring(L);
    expect(L.fired('scene-end:rich')).toBe(1);
    processEvents(L.bus, [{ type: 'done-carried:cave' }]); ring(L);
    expect(L.fired('scene-end:vet')).toBe(1);
    // the contract: the slices the conditions read, consumed, and what the game channel pushes from them
    const g = sceneContract({ levelRef: 'l', produces: { events: [] } }, { scenes, ...from });
    expect(g.flags).toEqual({ names: [], items: { slices: ['bag'], names: ['rune'] }, done: { slice: 'campaign', levels: { cave: 'gw-level-cave-0' } } });
    expect(g.consumes).toEqual([{ slice: 'bag' }, { slice: 'campaign' }]);
    expect(g.on).toBeUndefined();
    // the page pushes them: an item held in a carried inventory, a level the campaign records
    const gameJs = gameChannelScript({ ...g, levelRef: 'l' });
    expect(gameJs).toContain("'has-carried:' + n");
    expect(gameJs).toContain("'done-carried:' + k");
    expect(gameChannelScript({ levelRef: 'l', produces: { events: [] } })).not.toContain('flags-ready');
  });

  it('teaches a bad condition', () => {
    const bad = (cond) => () => readScenes({ scenes: [{ id: 's', when: { start: true }, if: cond, beats: [{ wait: 1 }] }] });
    expect(bad({ flag: 'Met Mayor' })).toThrow(/a lowercase name/);
    expect(bad({ var: 'coins' })).toThrow(/one of gte, gt/);
    expect(bad({ owns: 'rune' })).toThrow(/\{ flag \} \| \{ not \} \| \{ has \} \| \{ done \}/);
    expect(bad({ has: 'Rune Stone' })).toThrow(/is \{ has: '<item>' \}/);
    expect(() => readScenes({ scenes: [{ id: 's', when: { start: true }, sets: 'met', beats: [{ wait: 1 }] }] })).toThrow(/sets is a list of flags/);
  });
});

describe('the shot camera', () => {
  // is a point inside the camera's view cone (the look direction, half the fov)?
  const seen = (cam, p, fov = 50) => {
    const c = cam.transform.pos, l = cam.lookAt, a = [l[0] - c[0], l[1] - c[1], l[2] - c[2]], b = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b);
    return Math.acos(Math.min(1, cos)) < (fov / 2) * Math.PI / 180;
  };
  const shoot = (shot, steps = 3) => {
    const w = CW.createWorld({ entities: ENTITIES.map((e) => JSON.parse(JSON.stringify(e))), camera: { rule: 'follow', target: 'hero' } });
    CW.castOps(w, [{ op: 'shot', shot }]);
    for (let i = 0; i < steps; i++) CW.stepWorld(w, {}, DT);
    return w;
  };
  it('every frame word keeps its subjects in view, head and feet', () => {
    for (const frame of ['wide', 'low', 'profile', 'corner', 'overhead', 'two', 'close']) {
      const on = frame === 'close' ? ['mayor'] : ['mayor', 'hero'], w = shoot({ frame, on });
      for (const id of on) {
        const p = w.byId[id].transform.pos;
        expect(seen(w.camera, [p[0], p[1], p[2] + 1.4]), `${frame}: ${id}'s head`).toBe(true);
        if (frame !== 'close') expect(seen(w.camera, p), `${frame}: ${id}'s feet`).toBe(true);
      }
    }
  });
  it('frames a place: a spot named in a shot is a point, seen from where the pilot stands', () => {
    const p = sceneProgram({ spots: SPOTS, scenes: [{ id: 's', when: { start: true }, beats: [{ shot: { frame: 'wide', on: ['porch'] } }] }] })[0];
    expect(p.beats[0].shot).toEqual({ frame: 'wide', on: [], at: [[2, -4]] });
    const w = CW.createWorld({ entities: ENTITIES.map((e) => ({ ...JSON.parse(JSON.stringify(e)), ...(e.id === 'hero' ? { pilotable: true } : {}) })), camera: { rule: 'follow', target: 'hero' } });
    expect(w.pilotId).toBe('hero');
    CW.castOps(w, [{ op: 'shot', shot: p.beats[0].shot }]);
    CW.stepWorld(w, {}, DT);
    expect(seen(w.camera, [2, -4, 0])).toBe(true);
    // the camera stands on the hero's side of the porch
    const c = w.camera.transform.pos, h = w.byId.hero.transform.pos;
    expect(Math.hypot(c[0] - h[0], c[1] - h[1])).toBeLessThan(Math.hypot(c[0] - 2, c[1] + 4) + 1);
  });

  it('a two-shot keeps the side of the line the camera was on (the player\'s side of the action)', () => {
    const sideOf = (w) => { const a = w.byId.hero.transform.pos, b = w.byId.mayor.transform.pos, c = w.camera.transform.pos; return Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); };
    for (const start of [[0, 8, 3], [6, -10, 3]]) {
      const w = CW.createWorld({ entities: ENTITIES.map((e) => JSON.parse(JSON.stringify(e))), camera: { rule: 'follow', target: 'hero' } });
      w.camera.transform.pos = start.slice();
      const before = sideOf(w);
      CW.castOps(w, [{ op: 'shot', shot: { frame: 'two', on: ['mayor', 'hero'] } }]);
      CW.stepWorld(w, {}, DT);
      expect(sideOf(w)).toBe(before);
    }
  });

  it('a shot finds a clear view: a wall between the framing and its subject moves the camera round it', () => {
    // a 5 m wall, 3 wide, between the mayor (facing -x) and where a wide shot of her would stand
    const wall = (p) => (p[0] > 3 && p[0] < 5 && Math.abs(p[1]) < 1.5 ? 5 : 0);
    const shoot2 = (ground) => {
      const w = CW.createWorld({ entities: ENTITIES.map((e) => JSON.parse(JSON.stringify(e))), camera: { rule: 'follow', target: 'hero' } });
      CW.castOps(w, [{ op: 'shot', shot: { frame: 'wide', on: ['mayor'] } }]);
      CW.stepWorld(w, {}, DT, { ground });
      return w.camera.transform.pos;
    };
    const open = shoot2(() => 0), walled = shoot2(wall);
    const blocked = (c) => { const m = [6, 0, 1.4]; for (let k = 1; k < 8; k++) { const u = k / 8, x = c[0] + (m[0] - c[0]) * u, y = c[1] + (m[1] - c[1]) * u, z = c[2] + (m[2] - c[2]) * u; if (wall([x, y]) > z - 0.3) return true; } return false; };
    expect(blocked(open)).toBe(true);     // the framing it would take with no wall is behind it
    expect(blocked(walled)).toBe(false);  // with the wall, it stands where it sees her
  });

  it('over the shoulder: the speaker in view, the camera behind the listener', () => {
    const w = shoot({ frame: 'over', on: ['mayor', 'hero'] });
    const c = w.camera.transform.pos, m = w.byId.mayor.transform.pos, h = w.byId.hero.transform.pos;
    expect(seen(w.camera, [m[0], m[1], m[2] + 1.4])).toBe(true);
    expect(Math.hypot(c[0] - m[0], c[1] - m[1])).toBeGreaterThan(Math.hypot(h[0] - m[0], h[1] - m[1]));
  });
  it('a cut lands at once; hold stays where it cut; orbit moves; unshot gives the same rule back', () => {
    const w = shoot({ frame: 'wide', on: ['mayor'] }, 1), at = w.camera.transform.pos.slice();
    for (let i = 0; i < 30; i++) CW.stepWorld(w, {}, DT);
    expect(w.camera.transform.pos).toEqual(at);
    const o = shoot({ frame: 'wide', on: ['mayor'], move: 'orbit' }, 1), o0 = o.camera.transform.pos.slice();
    for (let i = 0; i < 30; i++) CW.stepWorld(o, {}, DT);
    expect(Math.hypot(o.camera.transform.pos[0] - o0[0], o.camera.transform.pos[1] - o0[1])).toBeGreaterThan(0.5);
    const held = w.camera.heldRule;
    CW.castOps(w, [{ op: 'shot', shot: { frame: 'close', on: ['mayor'] } }]);
    expect(w.camera.heldRule).toBe(held);   // a second shot keeps the player's rule aside, not the first shot
    CW.castOps(w, [{ op: 'unshot' }]);
    expect(w.camera.rule).toBe(held);
    expect(w.camera.rule.type).toBe('follow');
  });
});

describe('the page', () => {
  it('steps the runner with the bus vars, so conditions read the level (and what was carried in)', () => {
    expect(sceneScript()).toMatch(/__SCN\.step\(__scn, dtSec, \{[^}]*vars: __busState\.vars \}\)/);
  });
  it('carries the scene runtime only when the events have scenes', () => {
    const ev = lowerPlay({ entities: ENTITIES, play: { spots: SPOTS, scenes: [ARRIVAL] } }, { player: 'hero' });
    expect(eventsChannelScript(ev)).toContain('__stepScenes(dtSec)');
    const { scenes: _, ...none } = ev;
    expect(eventsChannelScript(none)).not.toContain('__SCN');
  });
});

