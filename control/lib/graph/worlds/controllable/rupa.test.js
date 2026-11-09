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

  it('a hose does not wear a log away: its stagnation pressure is under the wood\'s strength', () => {
    const w = world([block('log', [5, -0.25, 0], [5.5, 0.25, 0.25], 'pine')]);
    CW.spray(w, { at: [0, 0, 0.12], dir: [1, 0, 0.06], speed: 40, flow: 0.02, seconds: 5 });
    step(w, 60 * 5);
    expect(get(w, 'log').rupa.joules).toBe(get(w, 'log').rupa.cap);
    expect(w.rupa.drops.length + w.rupa.wet.landed.length).toBeGreaterThan(0);
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

describe('rupa debris on the runtime', () => {
  const wall = () => [block('w0', [1, -0.5, 0], [1.4, 0.5, 0.5], 'brick'), block('w1', [1, -0.5, 0.5], [1.4, 0.5, 1], 'brick')];
  const blast = (w, r) => { (w.bursts || (w.bursts = [])).push({ seq: 0, pos: [0, 0, 0.3], t: w.time, radius: r }); step(w); };

  it('every break carries its debris, thrown away from the blast; the same blast, the same debris', () => {
    const run = (r) => { const w = world(wall()); blast(w, r); return w.breaks; };
    const a = run(3), b = run(3);
    expect(a.length).toBe(2);
    expect(a.every((br) => br.debris && br.debris.pieces.length > 0)).toBe(true);
    expect(a.every((br) => br.debris.pieces.every((p) => p.vel[0] > 0))).toBe(true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const big = run(4);
    expect(big[0].debris.stats.kinetic).toBeGreaterThan(a[0].debris.stats.kinetic);   // a bigger charge throws harder
  });

  it('a block dropped in a pool splashes', () => {
    const w = world([block('far', [30, 30, 0], [30.5, 30.5, 0.5], 'stone')], { pools: [{ min: [-5, -5, 0], max: [5, 5, 2], density: 1000, viscosity: 1e-3, tension: 0.072 }] });
    CW.throwMatter(w, { size: 0.5, at: [0, 0, 5], vel: [0, 0, 0], matter: 'stone', ...blockMatter({ min: [0, 0, 0], max: [0.5, 0.5, 0.5] }, 'stone') });
    step(w, 120);
    expect(w.rupa.splashes.length).toBe(1);
    expect(w.rupa.splashes[0].droplets.length).toBeGreaterThan(0);
    expect(w.rupa.splashes[0].at[2]).toBe(2);
  });
});

describe('rupa wind: the air moving, by the same law as water', () => {
  const anchor = () => block('far', [60, 60, 0], [60.5, 60.5, 0.5], 'stone');
  const drop = (w, matter, fill, x = 0) => CW.throwMatter(w, { size: 0.5, at: [x, 0, 6], vel: [0, 0, 0], matter, ...blockMatter({ min: [0, 0, 0], max: [0.5, 0.5, 0.5] }, fill ? { matter, fill } : matter) });

  it('the wind carries a light shell far and a solid steel block barely', () => {
    const w = world([anchor()], { wind: { speed: 25, dir: 0 } });
    const shell = drop(w, 'pine', 0.02), steel = drop(w, 'steel', null, 3);
    step(w, 60 * 3);
    const x = (id) => w.rupa.bodies.find((b) => b.id === id).pos[0];
    expect(x(shell)).toBeGreaterThan(2);
    expect(x(steel) - 3).toBeLessThan(0.15);   // ~70 N on 980 kg through a 6 m fall
  });

  it('a pool is a basin: a gale drives a floating block to the far side, not out of the pool', () => {
    const w = world([anchor()], { wind: { speed: 60, dir: 0 }, pools: [{ min: [-3, -3, 0], max: [3, 3, 2], density: 1000, viscosity: 1e-3 }] });
    const id = CW.throwMatter(w, { size: 0.5, at: [0, 0, 2.5], vel: [0, 0, 0], matter: 'pine', ...blockMatter({ min: [0, 0, 0], max: [0.5, 0.5, 0.5] }, 'pine') });
    step(w, 60 * 10);
    const b = w.rupa.bodies.find((q) => q.id === id);
    expect(b.pos[0]).toBeCloseTo(3 - 0.25, 6);
    expect(b.pos[2] - b.half[2]).toBeGreaterThan(1);   // still afloat
  });

  // a leaf: a 6 × 4 cm plate, a third of a millimetre thick, about half a gram
  const leaf = (w, at, id) => CW.throwMatter(w, { id, size: [0.06, 0.04, 0.002], at, vel: [0, 0, 0], mass: 0.06 * 0.04 * 0.0003 * 600, joules: 1, stiff: 1e8, bounce: 0.1 });

  it('a leaf falls through still air at about two metres a second', () => {
    const w = world([anchor()]), id = leaf(w, [0, 0, 20], 'l');
    step(w, 60 * 3);
    const b = w.rupa.bodies.find((q) => q.id === id);
    expect(-b.vel[2]).toBeGreaterThan(1); expect(-b.vel[2]).toBeLessThan(3);
  });

  it('the wind skitters a leaf along the ground; a brick lying there stays', () => {
    const w = world([anchor()], { wind: { speed: 12, dir: 0 } });
    const l = leaf(w, [0, 0, 0.01], 'l'), brick = CW.throwMatter(w, { size: [0.2, 0.1, 0.06], at: [0, 2, 0.04], vel: [0, 0, 0], matter: 'brick', ...blockMatter({ min: [0, 0, 0], max: [0.2, 0.1, 0.06] }, 'brick') });
    step(w, 60 * 4);
    const x = (id) => w.rupa.bodies.find((q) => q.id === id).pos[0];
    expect(x(l)).toBeGreaterThan(3);
    expect(Math.abs(x(brick))).toBeLessThan(0.05);
  });

  it('a wall casts a wind shadow: a leaf falling behind it drifts less than one in the open', () => {
    const w = world([block('wall', [0, -3, 0], [0.4, 3, 3], 'brick'), anchor()], { wind: { speed: 10, dir: 0 } });
    const lee = leaf(w, [2, 0, 2.5], 'lee'), open = leaf(w, [2, 10, 2.5], 'open');
    step(w, 60);
    const dx = (id) => w.rupa.bodies.find((q) => q.id === id).pos[0] - 2;
    expect(dx(lee)).toBeLessThan(dx(open) * 0.6);
  });

  it('a crosswind bends the hose\'s spray', () => {
    const w = world([anchor()], { wind: { speed: 15, dir: 90 } });
    CW.spray(w, { at: [0, 0, 1], dir: [1, 0, 0.5], speed: 25, flow: 0.01, seconds: 0.5, spread: 0 });
    step(w, 60 * 6);
    const ys = w.rupa.wet.landed.map((p) => p[1]);
    expect(ys.reduce((a, b) => a + b, 0) / ys.length).toBeGreaterThan(0.5);
  });

  it('a gale tips a dry-stacked pine pile into falling bodies; a mortared brick wall stands; a breeze moves neither', () => {
    const pile = () => [block('p0', [0, 0, 0], [0.5, 0.5, 0.5], 'pine'), block('p1', [0, 0, 0.5], [0.5, 0.5, 1], 'pine')];
    const wall = () => [0, 1, 2, 3].map((r) => block(`w${r}`, [3, 0, r * 0.5], [3.4, 1, (r + 1) * 0.5], 'brick'));
    const run = (speed) => { const w = world([...pile(), ...wall()], { wind: { speed, dir: 0 } }); step(w, 60); return w; };
    const gale = run(70);
    expect(gale.rupa.toppled.map((t) => t.id).sort()).toEqual(['p0', 'p1']);
    expect(gale.rupa.bodies.some((b) => b.id === 'topple:p1')).toBe(true);
    expect(gale.breakables.filter((b) => b.id.startsWith('w')).every((b) => !b.broken)).toBe(true);
    expect(run(15).rupa.toppled).toEqual([]);
    expect(JSON.stringify(run(70).rupa.toppled)).toBe(JSON.stringify(gale.rupa.toppled));
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

describe('rupa distortion: plastic matter keeps the shape a blow leaves', () => {
  const at = (x, y, z) => [x, y, z];
  const plate = (id, y0, matter = 'steel', t = 0.01, extra = {}) => block(id, [0, y0, 0], [t, y0 + 0.3, 0.3], matter, { bond: 'lateral', ...extra });
  const wallBehind = (t = 0.01) => block('wall', [t, -1, 0], [t + 0.3, 1, 0.3], 'brick');
  const shoot = (w, id, joules, y = 0.15, z = 0.15) => CW.strikeBlock(w, id, joules, 'shot', { dir: [1, 0, 0], at: at(0, y, z) });

  it('a plastic block dents where it is struck and keeps it; brittle stuff breaks or holds whole', () => {
    const w = world([block('steel', [0, -0.5, 0], [0.3, 0.5, 0.5], 'steel'), block('brick', [2, -0.5, 0], [2.3, 0.5, 0.5], 'brick')]);
    const steel = get(w, 'steel');
    shoot(w, 'steel', 2000, 0, 0.25);
    expect(steel.rupa.dents).toHaveLength(1);
    expect(steel.rupa.dents[0]).toMatchObject({ ax: 0, side: -1, hole: false });
    expect(steel.rupa.cap - steel.rupa.joules).toBeCloseTo(2000, 6);   // the work comes off the budget
    expect(steel.rupa.form).toBe(1);
    expect(w.rupa.dents.map((d) => d.how)).toEqual(['dent']);
    CW.strikeBlock(w, 'brick', 2000, 'shot', { dir: [1, 0, 0], at: at(2, 0, 0.25) });
    expect(get(w, 'brick').rupa.dents).toBeUndefined();
  });

  it('blows on one spot deepen one bowl until it goes through; the plate still stands', () => {
    const w = world([plate('p', -0.15, 'steel', 0.03)]);
    const p = get(w, 'p');
    let n = 0;
    while (!p.rupa.dents[0]?.hole && n < 40) { shoot(w, 'p', 2000, 0); n++; }
    expect(n).toBeGreaterThan(1);
    expect(p.rupa.dents).toHaveLength(1);
    expect(p.rupa.dents[0].hole).toBe(true);
    expect(p.broken).toBeNull();
  });

  it('powerscaling: a strong enough round goes through a plate into the wall behind; a person\'s only dents armour', () => {
    const a = world([plate('p', -0.15), wallBehind()]);
    const through = shoot(a, 'p', 2e4, 0);
    expect(through).toBeGreaterThan(0);
    expect(get(a, 'p').broken).toBeNull();
    expect(get(a, 'p').rupa.dents[0].hole).toBe(true);
    expect(get(a, 'wall').rupa.joules).toBeLessThan(get(a, 'wall').rupa.cap);
    const b = world([plate('p', -0.15, 'armour-steel'), wallBehind()]);
    expect(shoot(b, 'p', 2000, 0)).toBe(0);
    expect(get(b, 'wall').rupa.joules).toBe(get(b, 'wall').rupa.cap);
  });

  it('a blow past twice a plate\'s whole budget tears it apart and carries on', () => {
    const w = world([plate('p', -0.15), wallBehind()]), p = get(w, 'p');
    const through = shoot(w, 'p', 3 * p.rupa.cap, 0);
    expect(p.broken).toMatchObject({ how: 'shot' });
    expect(w.breaks.find((x) => x.id === 'p').debris.pieces.length).toBeGreaterThan(0);
    expect(through).toBeCloseTo(2 * p.rupa.cap, 0);
    expect(get(w, 'wall').rupa.joules).toBeLessThan(get(w, 'wall').rupa.cap);
  });

  it('focus fire strips one plate off its weld, whole, and leaves its neighbour', () => {
    const soft = { matter: { is: 'steel', toughness: 1e7 } };   // a thin budget, so a few blows wear it out
    // two thin plates welded side by side up a wall, clear of the floor; a bat dishes them
    const mk = (id, y0) => ({ ...block(id, [0, y0, 1], [0.002, y0 + 0.3, 1.3], null, { bond: 'lateral' }), ...blockMatter({ min: [0, y0, 1], max: [0.002, y0 + 0.3, 1.3] }, soft) });
    const w = world([mk('a', -0.3), mk('b', 0), block('wall', [0.002, -1, 0], [0.302, 1, 1.5], 'brick')]);
    const a = get(w, 'a');
    step(w, 2);
    expect(a.falling).toBeNull();
    for (let i = 0; i < 40 && !a.broken; i++) CW.strikeBlock(w, 'a', 300, 'swing', { dir: [1, 0, 0], from: at(-1, -0.3 + 0.05 + (i % 5) * 0.05, 1.05 + (Math.floor(i / 5) % 5) * 0.05), tool: 'bat' });
    expect(a.broken).toMatchObject({ how: 'strip' });
    expect(a.rupa.dents.every((d) => d.dish)).toBe(true);
    const rec = w.breaks.find((x) => x.id === 'a');
    expect(rec.debris).toBeNull();
    expect(w.rupa.bodies.find((x) => x.id === rec.body)).toBeDefined();
    expect(rec.away[0]).toBeLessThan(0);                                 // back toward the blow, off the wall
    expect(get(w, 'b').rupa.joules).toBe(get(w, 'b').rupa.cap);
    step(w, 30);
    expect(w.rupa.bodies.find((x) => x.id === rec.body).pos[2]).toBeLessThan(1);   // it falls
    expect(get(w, 'b').broken).toBeNull();
  });

  it('soft stuff squashes at constant volume, and what stood on it settles', () => {
    const w = world([block('dough', [0, 0, 0], [0.4, 0.4, 0.2], 'dough'), block('top', [0.1, 0.1, 0.2], [0.3, 0.3, 0.3], 'brick')]);
    const d = get(w, 'dough'), vol = (b) => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]), v0 = vol(d);
    CW.strikeBlock(w, 'dough', 300, 'swing', { ax: 2, side: 1, at: at(0.2, 0.2, 0.2), tool: 'bat' });
    expect(d.rupa.squash).toBeGreaterThan(0);
    expect(d.max[2]).toBeLessThan(0.2);
    expect(d.max[0] - d.min[0]).toBeGreaterThan(0.4);
    expect(vol(d)).toBeCloseTo(v0, 5);
    expect(w.rupa.dents.at(-1)).toMatchObject({ how: 'squash' });
    step(w, 30);
    expect(get(w, 'top').min[2]).toBeCloseTo(d.max[2], 3);
  });

  it('a body punches a plate and carries on; slower, it dents the plate and comes back', () => {
    const fling = (speed) => {
      const w = world([plate('p', -0.15)]);
      const id = CW.throwMatter(w, { size: 0.06, at: [-1, 0, 0.15], vel: [speed, 0, 0], ...blockMatter({ min: [0, 0, 0], max: [0.06, 0.06, 0.06] }, 'steel') });
      step(w, 20);
      return { w, ball: w.rupa.bodies.find((x) => x.id === id), p: get(w, 'p') };
    };
    const fast = fling(600), slow = fling(20);
    expect(fast.ball.pos[0]).toBeGreaterThan(0.01);
    expect(fast.p.broken).toBeNull();
    expect(fast.p.rupa.dents.some((d) => d.hole)).toBe(true);
    expect(slow.ball.pos[0]).toBeLessThan(-1);                          // back past where it was thrown from
    expect(slow.p.rupa.dents.some((d) => d.hole)).toBe(false);
  });

  it('heat softens: the same blow dents hot steel deeper', () => {
    const w = world([block('cold', [0, -2, 0], [0.3, -1, 0.5], 'steel'), block('hot', [0, 1, 0], [0.3, 2, 0.5], 'steel')]);
    const hot = get(w, 'hot');
    CW.heatBlock(w, 'hot', hot.rupa.heatCap * (hot.rupa.soften - 20));
    CW.strikeBlock(w, 'cold', 5e3, 'shot', { dir: [1, 0, 0], at: at(0, -1.5, 0.25) });
    CW.strikeBlock(w, 'hot', 5e3, 'shot', { dir: [1, 0, 0], at: at(0, 1.5, 0.25) });
    expect(hot.rupa.dents[0].d).toBeGreaterThan(get(w, 'cold').rupa.dents[0].d * 1.2);
  });

  it('deterministic: the same blows leave the same dents', () => {
    const run = () => { const w = world([plate('p', -0.15), wallBehind()]); for (let i = 0; i < 6; i++) shoot(w, 'p', 3000, 0.05 * i, 0.1); return JSON.stringify([get(w, 'p').rupa.dents, w.rupa.dents]); };
    expect(run()).toBe(run());
  });
});

describe('rupa tools and cuts: what a blow is struck with', () => {
  const at = (x, y, z) => [x, y, z];
  const sheet = (id, t, matter = 'steel', y0 = 0) => block(id, [0, y0, 0], [t, y0 + 0.6, 0.6], matter);
  const swingAt = (w, id, joules, tool, y = 0.3, z = 0.3, x = -1) => CW.strikeBlock(w, id, joules, 'swing', { dir: [1, 0, 0], from: at(x, y, z), tool });

  it('a wooden bat dishes a thin sheet and leaves a thick plate whole; a heroic one dents the plate', () => {
    const w = world([sheet('thin', 0.001), sheet('thick', 0.01, 'steel', 2)]);
    swingAt(w, 'thin', 300, 'bat'); swingAt(w, 'thick', 300, 'bat', 2.3);
    const thin = get(w, 'thin').rupa, thick = get(w, 'thick').rupa;
    expect(thin.dents).toHaveLength(1);
    expect(thin.dents[0].dish).toBe(true);
    expect(thin.dents[0].d).toBeGreaterThan(0.01); expect(thin.dents[0].d).toBeLessThan(0.06);   // a few centimetres
    expect(thick.dents).toHaveLength(0);
    expect(thick.joules).toBe(thick.cap);                                                         // it rings off: nothing spent
    const hero = world([sheet('thick', 0.01)], { power: 10 });
    swingAt(hero, 'thick', 3000, 'bat');
    expect(get(hero, 'thick').rupa.dents[0]).toMatchObject({ dish: true });
  });

  it('a tool too soft to bite a thick block marks nothing; a hammer\'s force limits its bite', () => {
    const w = world([block('anvil', [0, 0, 0], [0.3, 0.6, 0.6], 'steel')]);
    swingAt(w, 'anvil', 300, 'bat');
    expect(get(w, 'anvil').rupa.joules).toBe(get(w, 'anvil').rupa.cap);
    swingAt(w, 'anvil', 300, 'hammer');
    const spent = get(w, 'anvil').rupa.cap - get(w, 'anvil').rupa.joules;
    expect(spent).toBeGreaterThan(0); expect(spent).toBeLessThan(300);                            // most of the blow rings off
  });

  it('an edge harder than the stuff cuts where it lands, and through a solid parts it in two', () => {
    const w = world([block('post', [0, 0, 0], [0.1, 0.1, 2], 'timber')]);
    let n = 0;
    while (!get(w, 'post').broken && n < 20) { swingAt(w, 'post', 300, 'sword', 0.05, 1.2); n++; }
    expect(n).toBeGreaterThan(1);
    expect(get(w, 'post').broken).toMatchObject({ how: 'cut' });
    const rec = w.breaks.find((x) => x.id === 'post');
    expect(rec).toMatchObject({ how: 'cut', debris: null, plane: { axis: 2, at: 1.2 } });
    const [lo, hi] = rec.into.map((id) => get(w, id));
    expect(lo.max[2]).toBeCloseTo(1.2, 9); expect(hi.min[2]).toBeCloseTo(1.2, 9);
    expect(lo.rupa.mass + hi.rupa.mass).toBeCloseTo(get(w, 'post').rupa.mass, 6);                // the matter is shared out by volume
    expect(hi.skin).toBe('post');
    step(w, 30);
    expect(hi.falling).toBeNull();                                                                // the top rests on the bottom
  });

  it('a chop cuts across the long way; what the cut leaves unheld falls', () => {
    // a beam resting on a post, reaching past it; chopped from above past the post, the end it held falls
    const w = world([block('post', [0, 0, 0], [0.4, 0.2, 1], 'brick'), block('beam', [0, 0, 1], [1, 0.2, 1.2], 'pine')]);
    step(w, 2);
    expect(get(w, 'beam').falling).toBeNull();
    for (let i = 0; i < 40 && !get(w, 'beam').broken; i++) CW.strikeBlock(w, 'beam', 300, 'swing', { ax: 2, side: 1, at: at(0.7, 0.1, 1.2), tool: 'axe' });
    expect(get(w, 'beam').broken).toMatchObject({ how: 'cut' });
    expect(w.breaks.find((x) => x.id === 'beam').plane.axis).toBe(0);
    step(w, 60);
    const near = get(w, 'beam/a'), far = get(w, 'beam/b');
    expect(far.min[2]).toBeLessThan(0.5);                                                         // it fell
    expect(near.min[2]).toBeCloseTo(1, 6);                                                        // what the post holds stays
  });

  it('an edge softer than the stuff does not cut it: a sword on armour rings off', () => {
    const w = world([block('arm', [0, 0, 0], [0.01, 0.6, 0.6], 'armour-steel')]);
    swingAt(w, 'arm', 300, 'sword');
    expect(get(w, 'arm').rupa.cuts).toHaveLength(0);
    expect(get(w, 'arm').rupa.joules).toBe(get(w, 'arm').rupa.cap);
  });

  it('a shell is slit, not parted', () => {
    const w = world([block('locker', [0, 0, 0], [0.5, 0.5, 1.8], 'sheet-metal')]);
    for (let i = 0; i < 20 && !get(w, 'locker').rupa.cuts[0]?.through; i++) swingAt(w, 'locker', 300, 'sword', 0.25, 1);
    expect(get(w, 'locker').rupa.cuts[0].through).toBe(true);
    expect(get(w, 'locker').broken).toBeNull();
    expect(w.breakables).toHaveLength(1);
  });

  it('a striker\'s swing carries the tool on its rule', () => {
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, strike: 'melee', strikeReach: 1.4, strikeDur: 0.3, strikeTool: 'bat' }, transform: { pos: [-0.6, 0.3, 0], heading: 0 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const w = CW.createWorld({ entities: [hero], breakables: [block('door', [0, 0, 0], [0.001, 0.6, 2], 'steel')], rupa: {} });
    for (let i = 0; i < 40; i++) CW.stepWorld(w, { fire: i < 2 }, 1 / 60, { ground: () => 0 });
    expect(get(w, 'door').rupa.dents.some((d) => d.dish)).toBe(true);
    expect(get(w, 'door').rupa.cuts).toHaveLength(0);
  });
});

describe('rupa felling: what a level groove leaves standing', () => {
  const at = (x, y, z) => [x, y, z];
  // a rooted oak trunk with a pine crown; `lean` the crown's offset toward +y
  const tree = (lean) => [
    block('trunk', [-0.15, -0.15, 0], [0.15, 0.15, 3.5], { matter: 'timber', joint: 'mortar' }),
    block('crown', [-1, -1 + lean, 3.5], [1, 1 + lean, 5.5], { matter: 'pine', fill: 0.05 }),
  ];
  const chop = (w, from, dir, max = 400) => { let n = 0; while (!w.rupa.fells.length && !get(w, 'trunk').broken && n < max) { CW.strikeBlock(w, 'trunk', 300, 'swing', { dir, from, tool: 'axe' }); step(w); n++; } return n; };
  const land = (w) => { for (let i = 0; i < 600 && w.rupa.fells.some((f) => !f.done); i++) step(w); return step(w, 30); };

  it('an axe into the lean side fells the tree toward its lean; it lands lying and its stump stands', () => {
    const w = step(world(tree(0.25)), 2);
    const n = chop(w, at(0, 1.2, 0.5), [0, -1, 0]);
    expect(n).toBeGreaterThan(10);
    const f = w.rupa.fells[0];
    expect(f).toBeDefined();
    expect(f.dir).toEqual([0, 1, 0]);                                   // toward the lean
    expect(f.ids).toEqual(['trunk/b', 'crown']);                         // what was above the groove, and what it carried
    land(w);
    const stump = get(w, 'trunk/a'), log = get(w, 'trunk/b'), crown = get(w, 'crown');
    expect(stump.max[2]).toBeCloseTo(0.5, 6);
    expect(log.max[1] - log.min[1]).toBeCloseTo(3, 6);                   // the trunk lies along its fall
    expect(log.max[2] - log.min[2]).toBeCloseTo(0.3, 6);
    expect(log.min[2]).toBeCloseTo(0, 6);
    expect(log.min[1]).toBeGreaterThanOrEqual(stump.max[1] - 1e-6);      // clear of the stump it hinged on
    expect(crown.min[1]).toBeGreaterThan(3);
    expect(f.done).toBe(true);
    expect(w.breaks.some((x) => x.how === 'fell')).toBe(false);          // a felling breaks nothing: no debris
  });

  it('the notch decides the fall: a tree with no lean goes into the groove, and only once its hinge is thin', () => {
    const w = step(world(tree(0)), 2);
    chop(w, at(0, 1.2, 0.5), [0, -1, 0]);
    expect(w.rupa.fells[0].dir).toEqual([0, 1, 0]);                     // toward the side the axe cut away
    expect(get(w, 'trunk').rupa.cuts[0].depth).toBeGreaterThan(0.28);  // its 30 cm held to a hinge of a centimetre or two
    // a block cut clean through with its weight still over its seat stands on it (the post's top, sawn level)
    const post = world([block('post', [0, 0, 0], [0.1, 0.1, 2], 'timber')]);
    for (let i = 0; i < 20 && !get(post, 'post').broken; i++) CW.strikeBlock(post, 'post', 2e3, 'swing', { dir: [1, 0, 0], from: at(-1, 0.05, 1.2), tool: 'sword' });
    step(post, 30);
    expect(post.rupa.fells).toHaveLength(0);
    expect(get(post, 'post/b').min[2]).toBeCloseTo(1.2, 6);
  });

  it('deterministic: the same strokes fell the same way', () => {
    const run = () => { const w = step(world(tree(0.25)), 2); chop(w, at(0, 1.2, 0.5), [0, -1, 0]); land(w); return JSON.stringify(w.breakables.map((b) => [b.id, b.min, b.max])); };
    expect(run()).toBe(run());
  });
});

describe('rupa dust and smoke: their sources on the runtime', () => {
  it('a break leaves its dust as a source, with its grains; what hangs drifts downwind', () => {
    const w = world([block('wall', [0, 0, 0], [0.4, 1, 1], 'brick')], { wind: { speed: 5, dir: 0 } });
    CW.strikeBlock(w, 'wall', 5e6, 'burst', { from: [-0.5, 0.5, 0.5] });
    const src = w.rupa.smoke.find((s) => s.kind === 'dust');
    expect(src).toMatchObject({ id: 'wall', t0: w.time });
    expect(src.grain.x0).toBeGreaterThan(0);
    expect(src.radius).toBeCloseTo(0.6, 6);                                  // as big as what broke
    const S = CW.rupaPhysics.smokeOf(src, w.rupa.wind);
    expect(S.puffs.length).toBeGreaterThan(0);
    const q = CW.rupaPhysics.puffAt(S.puffs[0], w.rupa.wind, w.time + 6);
    expect(q.pos[0]).toBeGreaterThan(S.puffs[0].at[0] + 5);                  // carried toward +x
  });

  it('a burning block gives off a plume while it burns; water on it boils off as steam and its plume ends', () => {
    const w = world([block('log', [0, 0, 0], [1, 0.4, 0.4], 'pine')]);
    const log = get(w, 'log');
    CW.heatBlock(w, 'log', log.rupa.heatCap * 400);
    const plume = w.rupa.smoke.find((s) => s.kind === 'fire');
    expect(plume).toMatchObject({ id: 'log', t1: null });
    expect(plume.Q).toBeCloseTo(log.rupa.burnRate, 6);                       // its real heat release
    expect(plume.at[2]).toBeCloseTo(0.4, 6);
    CW.spray(w, { at: [-2, 0.2, 0.6], dir: [1, 0, -0.15], speed: 12, flow: 0.004, seconds: 4 });
    step(w, 240);
    expect(w.rupa.smoke.some((s) => s.kind === 'steam' && s.kg > 0)).toBe(true);
    expect(log.rupa.burning).toBe(false);
    expect(plume.t1).toBeGreaterThan(plume.t0);
  });
});

describe('rupa combustion: a fire\'s heat leaves it as heat does', () => {
  const crate = (id, x) => block(id, [x, 0, 0], [x + 0.6, 0.6, 0.6], { matter: 'pine', fill: 0.02 });
  const lit = (w, id) => w.rupa.hits.find((h) => h.id === id && h.how === 'ignite');
  const burn = (w, id) => { const b = get(w, id); CW.heatBlock(w, id, b.rupa.heatCap * 400); };

  it('a shell burns on both faces of its walls: planks round air flare, where the solid log smoulders on', () => {
    const shell = blockMatter({ min: [0, 0, 0], max: [1, 1, 1] }, { matter: 'pine', fill: 0.02 }), solid = blockMatter({ min: [0, 0, 0], max: [1, 1, 1] }, 'pine');
    expect(shell.burnRate / solid.burnRate).toBeCloseTo(2, 3);
    expect(shell.fuel / shell.burnRate).toBeLessThan(solid.fuel / solid.burnRate / 50);
  });

  it('its radiation sets alight a crate across a gap, not one far off', () => {
    const w = world([block('log', [0, 0, 0], [1, 0.6, 0.4], 'pine'), crate('near', 2), crate('far', 7)]);
    burn(w, 'log');
    step(w, 60 * 20);
    expect(lit(w, 'near')).toBeDefined();
    expect(lit(w, 'far')).toBeUndefined();
    expect(get(w, 'far').rupa.T).toBeLessThan(get(w, 'far').rupa.ignite);
  });

  it('its plume sets alight what hangs over it before what stands beside it as far off', () => {
    const over = block('over', [-0.2, 0, 1.2], [1.2, 0.2, 1.4], 'pine'), beside = block('beside', [2.2, 0, 0], [3.6, 0.2, 0.2], 'pine');
    const w = world([block('log', [0, 0, 0], [1, 0.6, 0.4], 'pine'), over, beside, block('p1', [-0.6, 0, 0], [-0.4, 0.2, 1.2], 'brick'), block('p2', [1.2, 0, 0], [1.4, 0.2, 1.4], 'brick')]);
    burn(w, 'log');
    step(w, 60 * 10);
    expect(lit(w, 'over')).toBeDefined();
    const tb = lit(w, 'beside');
    expect(!tb || tb.t > lit(w, 'over').t).toBe(true);
  });
});
