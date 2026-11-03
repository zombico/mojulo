import { describe, it, expect } from 'vitest';
import { composeLive, composeControllable, EMISSION, emissionSource } from './compose.js';
import { blockMatter, MATTER } from '../../rupa/matter.js';
import { rupaPhysics } from '../../rupa/index.js';

const CW = composeLive();
const block = (id, min, max, matter, extra = {}) => ({ id, min, max, hp: 1, ...(matter ? blockMatter({ min, max }, matter) : {}), ...extra });
const world = (breakables, rupa = {}) => CW.createWorld({ entities: [], breakables, rupa });
const step = (w, n = 1) => { for (let i = 0; i < n; i++) CW.stepWorld(w, {}, 1 / 60, { ground: () => 0 }); return w; };
const get = (w, id) => w.breakables.find((b) => b.id === id);
const burst = (w, pos, radius) => { (w.bursts || (w.bursts = [])).push({ seq: 0, pos, t: w.time, radius }); };

describe('rupa on the runtime: opt-in, energy instead of a count', () => {
  it('blocks without matter keep the count, and a page without it keeps every byte', () => {
    const w = world([block('a', [0, 0, 0], [1, 0.4, 0.5])]);
    expect(w.rupa).toBeUndefined();
    expect(get(w, 'a').hp).toBe(1);
    expect(emissionSource({})).not.toContain('rupa-blows');
    expect(emissionSource({ rupa: true })).toContain('rupa-blows');
    expect(composeControllable(EMISSION).pipelineOrder().worldPasses).not.toContain('rupa-load');
  });

  it('one burst, two walls the same size at the same distance: the brick breaks, the steel holds', () => {
    const w = world([block('brick', [1, -0.5, 0], [1.4, 0.5, 0.5], 'brick'), block('steel', [-1.4, -0.5, 0], [-1, 0.5, 0.5], 'steel')]);
    expect(w.rupa).toBeDefined();
    burst(w, [0, 0, 0.25], 3);
    step(w);
    expect(get(w, 'brick').broken).toMatchObject({ how: 'burst' });
    expect(get(w, 'steel').broken).toBeNull();
    expect(get(w, 'steel').rupa.joules).toBeLessThan(get(w, 'steel').rupa.cap);   // a dent
  });

  it('power scales the blow: what a person\'s burst leaves standing, a titan\'s takes', () => {
    const far = () => [block('w', [5, -0.5, 0], [5.4, 0.5, 0.5], 'stone')];
    const a = world(far()), b = world(far(), { power: 1e5 });
    for (const w of [a, b]) { burst(w, [0, 0, 0.25], 5.5); step(w); }
    expect(get(a, 'w').broken).toBeNull();
    expect(get(b, 'w').broken).not.toBeNull();
  });

  it('a lintel on two jambs holds; take a jamb and the span it now cantilevers snaps', () => {
    const jamb = (id, x) => block(id, [x, 0, 0], [x + 0.5, 0.3, 2], 'brick');
    const lintel = block('lintel', [0.5, 0, 1.7], [2.5, 0.3, 2], 'brick', { bond: 'lateral' });
    const w = step(world([jamb('L', 0), jamb('R', 2.5), lintel]), 5);
    expect(get(w, 'lintel').falling).toBeNull();
    expect(get(w, 'lintel').broken).toBeNull();
    CW.breakBlock(w, 'R');
    step(w, 3);
    expect(get(w, 'R').broken).toMatchObject({ how: 'call' });
    expect(get(w, 'lintel').bond).toBeNull();
    expect(get(w, 'lintel').falling || get(w, 'lintel').landed || get(w, 'lintel').broken).toBeTruthy();
  });
});

describe('rupa bodies: matter thrown into matter', () => {
  // a wall two blocks thick, four courses high, across the line of fire at x = 0
  const wall = (matter) => { const out = []; for (let r = 0; r < 4; r++) for (const [x0, x1] of [[0, 0.3], [0.3, 0.6]]) out.push(block(`${matter}:${r}:${x0}`, [x0, -0.6, r * 0.5], [x1, 0.6, (r + 1) * 0.5], matter)); return out; };
  const throwAt = (w, matter, size, speed) => CW.throwMatter(w, { size, at: [-3, 0, 0.75], vel: [speed, 0, 0], matter, ...blockMatter({ min: [0, 0, 0], max: [size, size, size] }, matter) });
  const body = (w, id) => w.rupa.bodies.find((b) => b.id === id);

  it('a steel ball punches through a brick wall and carries on, slower; the same pine ball breaks on it and the wall holds', () => {
    const a = world(wall('brick')), sid = throwAt(a, 'steel', 0.2, 30);
    step(a, 90);
    const s = body(a, sid);
    expect(a.breakables.filter((b) => b.broken && b.broken.how === 'shot').length).toBeGreaterThanOrEqual(2);
    expect(s.broken).toBeNull();
    expect(s.pos[0]).toBeGreaterThan(0.6);                        // through
    expect(s.hits.every((h) => h.broke)).toBe(true);
    const b = world(wall('brick')), pid = throwAt(b, 'pine', 0.2, 30);
    step(b, 90);
    expect(body(b, pid).broken).toMatchObject({ how: 'impact' });
    expect(b.breakables.some((x) => x.broken)).toBe(false);
  });

  it('a wall the ball cannot break sends it back: steel off a steel wall', () => {
    const w = world(wall('steel')), id = throwAt(w, 'steel', 0.2, 30);
    step(w, 30);
    expect(body(w, id).vel[0]).toBeLessThan(0);
    expect(w.breakables.some((x) => x.broken)).toBe(false);
  });

  it('a falling block lands as an impact: on glass it breaks the glass', () => {
    const pane = block('pane', [0, 0, 0], [1, 1, 0.05], 'glass'), w = world([pane]);
    CW.throwMatter(w, { size: 0.5, at: [0.5, 0.5, 3], vel: [0, 0, 0], matter: 'stone', ...blockMatter({ min: [0, 0, 0], max: [0.5, 0.5, 0.5] }, 'stone') });
    step(w, 60);
    expect(get(w, 'pane').broken).toMatchObject({ how: 'shot' });
  });

  it('deterministic: the same throw breaks the same blocks', () => {
    const run = () => { const w = world(wall('concrete')); throwAt(w, 'steel', 0.15, 200); step(w, 60); return JSON.stringify([w.breakables.map((b) => b.broken), w.rupa.bodies]); };
    expect(run()).toBe(run());
  });
});

describe('rupa water: pools and the hose', () => {
  const pool = { min: [-10, -10, 0], max: [10, 10, 2], density: 1000, viscosity: 1e-3 };
  const drop = (w, matter, fill) => CW.throwMatter(w, { size: 0.5, at: [0, 0, 3], vel: [0, 0, 0], matter, ...blockMatter({ min: [0, 0, 0], max: [0.5, 0.5, 0.5] }, fill ? { matter, fill } : matter) });
  const anchor = () => block('far', [30, 30, 0], [30.5, 30.5, 0.5], 'stone');

  it('in a pool, pine floats about a third under, a hollow steel hull a sixth, solid steel sinks to the bottom', () => {
    const w = world([anchor()], { pools: [pool] });
    const pine = drop(w, 'pine'), hull = drop(w, 'steel', 0.02), steel = drop(w, 'steel');
    step(w, 60 * 20);
    const under = (id) => { const b = w.rupa.bodies.find((q) => q.id === id); return (2 - (b.pos[2] - b.half[2])) / (2 * b.half[2]); };
    expect(under(pine)).toBeCloseTo(MATTER.pine.density / 1000, 1);
    expect(under(hull)).toBeCloseTo((MATTER.steel.density * 0.02) / 1000, 1);
    expect(w.rupa.bodies.find((q) => q.id === steel).rest).toBe(true);
  });

  it('a hose on a burning block puts it out before it is ash; left alone it burns down', () => {
    const fire = (hose) => {
      const w = world([block('log', [5, -0.25, 0], [5.5, 0.25, 0.25], 'pine')], { fireTime: 600 });
      CW.heatBlock(w, 'log', get(w, 'log').rupa.heatCap * 900);
      if (hose) CW.spray(w, { at: [0, 0, 0.12], dir: [1, 0, 0.06], speed: 20, flow: 0.01, seconds: 3 });
      step(w, 60 * 12);
      return get(w, 'log');
    };
    const out = fire(true), left = fire(false);
    expect(out.broken).toBeNull();
    expect(out.rupa.burning).toBe(false);
    expect(left.broken).toMatchObject({ how: 'burn' });
  });

  it('the spray lands where a jet would, short of the drag-free arc', () => {
    const w = world([anchor()]);
    CW.spray(w, { at: [0, 0, 1], dir: [1, 0, 1], speed: 30, flow: 0.01, seconds: 0.5, spread: 0 });
    step(w, 60 * 8);
    const far = Math.max(...w.rupa.wet.landed.map((p) => p[0]));
    expect(far).toBeGreaterThan(20);
    expect(far).toBeLessThan((30 * 30) / 9.81 + 1);
    expect(w.rupa.wet.volume).toBeCloseTo(0.005, 3);
  });
});

describe('rupa heat: melt, burn, weaken', () => {
  it('heat factor: whole where it started, half at its soften, nothing at its melt', () => {
    const { heatFactor } = rupaPhysics, s = MATTER.steel;
    expect(heatFactor(20, s.soften, s.melt)).toBe(1);
    expect(heatFactor(s.soften, s.soften, s.melt)).toBeCloseTo(0.5, 9);
    expect(heatFactor(s.melt, s.soften, s.melt)).toBe(0);
  });

  it('ice takes its heat, then its latent heat, then melts', () => {
    const w = world([block('ice', [0, 0, 0], [1, 1, 1], 'ice')]), b = get(w, 'ice');
    expect(b.rupa.T).toBeLessThan(0);
    CW.heatBlock(w, 'ice', b.rupa.heatCap * 5 + b.rupa.fuse * 0.5);
    expect(b.broken).toBeNull();
    expect(b.rupa.T).toBe(0);
    CW.heatBlock(w, 'ice', b.rupa.fuse);
    expect(b.broken).toMatchObject({ how: 'melt' });
  });

  it('a heated steel post carries less: the load it holds cold crushes it hot', () => {
    const post = block('post', [0, 0, 0], [0.1, 0.1, 1], 'steel'), mass = (MATTER.steel.compressive * 0.01 * 0.7) / 9.81;
    const load = block('load', [-1, -1, 1], [1, 1, 1.5], 'steel', { mass });
    const w = step(world([post, load]), 2);
    expect(get(w, 'post').broken).toBeNull();
    CW.heatBlock(w, 'post', get(w, 'post').rupa.heatCap * (MATTER.steel.soften - 20));   // to its soften: half its strength
    step(w, 20);
    expect(get(w, 'post').broken).toMatchObject({ how: 'crush' });
  });

  it('timber past its ignition burns to ash, and the fire spreads to what it touches; steel does not catch', () => {
    const a = block('a', [0, 0, 0], [1, 0.5, 0.4], 'pine'), b = block('b', [1, 0, 0], [2, 0.5, 0.4], 'pine'), c = block('c', [2, 0, 0], [3, 0.5, 0.4], 'steel');
    const w = world([a, b, c], { fireTime: 6000 });
    CW.heatBlock(w, 'a', get(w, 'a').rupa.heatCap * 300);
    expect(get(w, 'a').rupa.burning).toBe(true);
    step(w, 600);
    expect(get(w, 'a').broken).toMatchObject({ how: 'burn' });
    expect(get(w, 'b').rupa.burning || get(w, 'b').broken).toBeTruthy();
    expect(get(w, 'c').rupa.burning).toBe(false);
  });

  it('deterministic: the same fire burns the same way', () => {
    const run = () => { const w = world([block('a', [0, 0, 0], [1, 0.5, 0.4], 'pine'), block('b', [1, 0, 0], [2, 0.5, 0.4], 'pine')], { fireTime: 6000 }); CW.heatBlock(w, 'a', 1e8); step(w, 120); return JSON.stringify(w.breakables.map((x) => x.rupa)); };
    expect(run()).toBe(run());
  });
});
