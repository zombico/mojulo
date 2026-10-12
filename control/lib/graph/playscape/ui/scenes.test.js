import { describe, it, expect } from 'vitest';
import { createBusState, processEvents, watchEvents, syncToCtrl } from '../../worlds/event-bus.js';
import { composeLive } from '../../worlds/controllable/compose.js';
import { lowerPlay } from './direction.js';
import { readScenes, sceneProgram, SHOT_FRAMES } from './scenes.js';
import { buildSceneRunner } from './scene-runner.js';

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
function level(scenes, extraCues = []) {
  const manifest = { entities: ENTITIES, play: { spots: SPOTS, scenes, cues: extraCues } };
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
    const o = R.step(S, DT, ctl);
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
