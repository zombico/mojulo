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
