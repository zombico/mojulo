// METAL PANELS ON OBJECTS (rupa/panels.js, controllable/rupa.js PANELS): an object's plates keep the dents, dishes and
// holes the distortion law leaves, in the object's own frame, and come off worn out; the page draws them riding it.
import { describe, it, expect } from 'vitest';
import { readPanels, FACES } from './panels.js';
import { blockMatter, MATTER } from './matter.js';
import { composeLive } from '../worlds/controllable/compose.js';
import { controllableChannelScript, panelsViewScript } from '../scene/channels/controllable/index.js';

const CW = composeLive();
const step = (w, k = 1) => { for (let i = 0; i < k; i++) CW.stepWorld(w, {}, 1 / 30, { ground: () => 0 }); return w; };
// a car-sized box, 4 × 1.8 × 1.5, its middle at x = 6, plated on every face but its floor
const car = ({ wall = 0.001, matter, heading = 0, pos = [6, 0, 0.75] } = {}) => {
  const e = { id: 'car', rule: { type: 'static' }, transform: { pos, heading }, body: { type: 'mesh', shape: 'box', size: [4, 1.8, 1.5], color: '#b33' }, panels: { auto: true, wall, ...(matter ? { matter } : {}) } };
  return { ...e, panels: readPanels(e) };
};
const gun = () => ({ id: 'gun', rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, transform: { pos: [0, 0, 0.75], heading: 0 } });
const world = (entities, rupa = {}, breakables = []) => CW.createWorld({ entities, rupa, breakables, breakFloor: 0 });
const fire = (w, from, to) => { w.byId.gun.lastShot = { mode: 'miss', t: w.time, from, to }; return step(w); };
const panel = (w, id) => w.rupa.panels.find((p) => p.id === `car:${id}`);

describe('a panel: a metal plate in its object\'s frame', () => {
  it('is a plate inward of its outer face, its size across the face, its metal\'s numbers for that plate', () => {
    const [p] = readPanels({ id: 'door', panels: [{ id: 'd', face: 'left', at: [0, 0.9, 0.6], size: [1.2, 0.8], color: '#c33' }] });
    expect(p).toMatchObject({ id: 'd', face: 'left', min: [-0.6, 0.899, 0.2], max: [0.6, 0.9, 1], wall: 0.001, matter: 'steel', color: '#c33' });
    const n = blockMatter({ min: p.min, max: p.max }, { matter: 'steel', fill: 1 });
    expect(p.joules).toBe(n.joules);
    expect(p.yield).toBe(MATTER.steel.yield);
    const [q] = readPanels({ id: 'x', panels: [{ face: 'bottom', at: [0, 0, 0], size: [1, 1], wall: 0.01 }] });
    expect([q.min[2], q.max[2]]).toEqual([0, 0.01]);   // a downward face: the plate above it
  });

  it('`true` plates a box body on every face but its floor, in its colour', () => {
    const P = car().panels;
    expect(P.map((p) => p.id)).toEqual(['front', 'back', 'left', 'right', 'top']);
    expect(P.every((p) => p.color === '#b33')).toBe(true);
    expect(P.find((p) => p.id === 'front')).toMatchObject({ min: [1.999, -0.9, -0.75], max: [2, 0.9, 0.75] });
    expect(Object.keys(FACES)).toHaveLength(6);
  });

  it('refuses what cannot be a panel, by name', () => {
    expect(() => readPanels({ id: 'a', panels: [{ face: 'front', at: [0, 0, 0], size: [1, 1], matter: 'glass' }] })).toThrow(/glass does not yield/);
    expect(() => readPanels({ id: 'a', panels: [{ face: 'side', at: [0, 0, 0], size: [1, 1] }] })).toThrow(/face is front, back/);
    expect(() => readPanels({ id: 'a', body: { type: 'figure-rig' }, panels: true })).toThrow(/plates a box body/);
    expect(() => readPanels({ id: 'a', panels: [{ face: 'top', at: [0, 0, 0], size: [1, 1] }, { face: 'top', at: [0, 0, 1], size: [1, 1] }].map((p) => ({ ...p, id: 'same' })) })).toThrow(/another panel's/);
    expect(readPanels({ id: 'a' })).toBeNull();
  });
});

describe('the world\'s blows on a panel, by the distortion law', () => {
  it('a rifle round holes a car-thin panel (no smaller than its bore); a lighter round dents a centimetre plate', () => {
    const w = fire(world([gun(), car()]), [0, 0.2, 0.75], [20, 0.2, 0.75]);
    const [hole] = panel(w, 'back').rupa.dents;
    expect(hole).toMatchObject({ ax: 0, side: -1, hole: true });
    expect(hole.a).toBeGreaterThanOrEqual(0.004);
    expect(w.rupa.hits.at(-1)).toMatchObject({ id: 'car:back', how: 'shot' });
    expect(w.rupa.hits.at(-1).through).toBeGreaterThan(0);
    const p = fire(world([gun(), car({ wall: 0.01 })], { shot: 500 }), [0, 0.2, 0.75], [20, 0.2, 0.75]);
    const [dent] = panel(p, 'back').rupa.dents;
    expect(dent.hole).toBe(false);
    expect(dent.d).toBeGreaterThan(0.001);
    expect(dent.d).toBeLessThan(0.01);
  });

  it('a panel that stops a round spares what stands behind it; one it passes does not', () => {
    const wall = { id: 'wall', min: [9, -1, 0], max: [9.3, 1, 2], hp: 1, ...blockMatter({ min: [9, -1, 0], max: [9.3, 1, 2] }, 'brick') };
    const thick = fire(world([gun(), car({ wall: 0.02 })], { shot: 500 }, [wall]), [0, 0.2, 0.75], [9, 0.2, 0.75]);
    expect(thick.breakables[0].rupa.joules).toBe(thick.breakables[0].rupa.cap);
    const thin = fire(world([gun(), car()], {}, [wall]), [0, 0.2, 0.75], [9, 0.2, 0.75]);
    expect(thin.breakables[0].rupa.joules).toBeLessThan(thin.breakables[0].rupa.cap);
  });

  it('a bat dishes a millimetre panel and rings off a centimetre plate', () => {
    const batter = () => ({ id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, strike: 'melee', strikeReach: 1.4, strikeDur: 0.3, strikeTool: 'bat' }, transform: { pos: [6, -1.5, 0], heading: Math.PI / 2 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } });
    const swing = (wall) => { const w = world([batter(), car({ wall })]); for (let i = 0; i < 40; i++) CW.stepWorld(w, { fire: i < 2 }, 1 / 60, { ground: () => 0 }); return panel(w, 'right').rupa.dents; };
    const thin = swing(0.001);
    expect(thin.some((d) => d.dish)).toBe(true);
    expect(swing(0.01)).toEqual([]);
  });

  it('a blast pushes the whole plate facing it in: a dish as wide as the panel', () => {
    const w = world([gun(), car()]);
    w.bursts.push({ seq: ++w.burstSeq, pos: [2, 0, 0.75], t: w.time, radius: 3 });
    step(w);
    const [d] = panel(w, 'back').rupa.dents;
    expect(d.dish).toBe(true);
    expect(d.a).toBeCloseTo(0.75, 6);   // half its height: the whole panel
    expect(panel(w, 'front').rupa.dents).toEqual([]);   // out of the blast's reach
    // a plate the blast reaches edge-on is struck on its broad face all the same, never on its edge
    expect(w.rupa.panels.flatMap((p) => p.rupa.dents.map((q) => [p.face, q.ax]))).toEqual(w.rupa.panels.flatMap((p) => p.rupa.dents.map(() => [p.face, { front: 0, back: 0, left: 1, right: 1, top: 2 }[p.face]])));
    expect(panel(w, 'left').rupa.dents.length + panel(w, 'top').rupa.dents.length).toBeGreaterThan(0);
  });

  it('a blow lands in the object\'s frame: turned a quarter, the round meets its left side', () => {
    const w = fire(world([gun(), car({ heading: Math.PI / 2 })]), [0, 0.2, 0.75], [20, 0.2, 0.75]);
    expect(panel(w, 'left').rupa.dents).toHaveLength(1);
    expect(panel(w, 'back').rupa.dents).toHaveLength(0);
    // and moved, its dents go with it: the hole is where the panel is, in its own frame
    const h = panel(w, 'left').rupa.dents[0];
    expect(h.at[1]).toBeCloseTo(0.9, 6);
  });

  it('worn out, or struck twice what it holds, a panel comes off as a body of its own', () => {
    const w = world([gun(), car()], { power: 400 });
    fire(w, [0, 0.2, 0.75], [20, 0.2, 0.75]);
    const P = panel(w, 'back');
    expect(P.off).toMatchObject({ how: 'shot' });
    expect(w.rupa.bodies.find((b) => b.id === P.off.body)).toBeTruthy();
    expect(w.rupa.hits.some((h) => h.id === 'car:back' && h.how === 'off')).toBe(true);
    // off, it takes no more blows: the next round meets the panel behind it (the front, from inside)
    fire(w, [0, -0.2, 0.75], [20, -0.2, 0.75]);
    expect(panel(w, 'front').rupa.dents.length + (panel(w, 'front').off ? 1 : 0)).toBeGreaterThan(0);
  });

  it('the same blows leave the same dents', () => {
    const run = () => { const w = world([gun(), car()]); w.bursts.push({ seq: ++w.burstSeq, pos: [2, 0.3, 0.9], t: w.time, radius: 2.5 }); fire(w, [0, 0.1, 0.5], [20, 0.1, 0.5]); return JSON.stringify(w.rupa.panels.map((p) => p.rupa.dents)); };
    expect(run()).toBe(run());
  });
});

describe('on the page: drawn only when an object carries panels', () => {
  const page = (entities, rupa = {}) => controllableChannelScript(entities, null, {}, { rupa });
  it('a page without panels keeps its bytes; a panelled one draws them each step and wakes the runtime', () => {
    const bare = [gun(), { ...car(), panels: undefined }];
    expect(page(bare)).not.toContain('__updatePanels');
    expect(controllableChannelScript([gun(), car()], null, {}, {})).not.toContain('__updatePanels');   // no physics: none
    const html = page([gun(), car()]);
    expect(html).toContain('__updatePanels();');
    expect(html).toMatch(/createWorld\(\{[^\n]*, rupa: \{/);   // the world it runs has the physics, with no block in it
    expect(html).toContain(panelsViewScript());
  });

  it('the view script parses', () => {
    expect(() => new Function('THREE', 'scene', '__world', panelsViewScript())).not.toThrow();
  });
});

describe('in a world', () => {
  it('a physical stage resolves its objects\' panels; any other carries them as written', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const box = { id: 'car', rule: { type: 'static' }, transform: { pos: [6, 0, 0.75] }, body: { type: 'mesh', shape: 'box', size: [4, 1.8, 1.5], color: '#b33' }, panels: true };
    const level = (extra) => ({ manifest: { kind: 'stage', kit: 'isekai-meadow', entities: [hero, box], ...extra }, title: 'panels' });
    const P = (await resolveWorldScene(level({ destruction: 'physical' }))).payload;
    expect(P.rupa).toBeTruthy();
    const plates = P.entities.find((e) => e.id === 'car').panels;
    expect(plates.map((p) => p.id)).toEqual(['front', 'back', 'left', 'right', 'top']);
    expect(plates[0].yield).toBeGreaterThan(0);
    const Q = (await resolveWorldScene(level({}))).payload;
    expect(Q.rupa).toBeUndefined();
    expect(Q.entities.find((e) => e.id === 'car').panels).toBe(true);
  }, 180000);
});
