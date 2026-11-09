import { describe, it, expect } from 'vitest';
import { MATTER, LIQUID_IDS, blockMatter } from './matter.js';
import { groundField, crater } from './ground.js';
import { pour, flow, fluidAt, fluidVolume, stepVessels, jetOf } from './fluid.js';
import { rupaPhysics, readMatterSpec } from './index.js';

const flat = (o = {}) => groundField({ origin: [-4, -4], size: [8, 8], cell: 0.25, soil: 'loam', soilDepth: 3, ...o });
const spreadOf = (f) => { const s = []; for (let k = 0; k < f.h.length; k++) if (f.fluid.d[k] > 1e-4) s.push(f.h[k] + f.fluid.d[k]); return s.length ? Math.max(...s) - Math.min(...s) : 0; };
const wetCells = (f) => f.fluid.d.filter((x) => x > 1e-3).length;

describe('liquid: cohesion that holds no shape', () => {
  it('every liquid has no shear strength at rest, and none can be a block', () => {
    for (const id of LIQUID_IDS) { expect(MATTER[id].c).toBe(0); expect(MATTER[id].phi).toBe(0); }
    expect(() => blockMatter({ min: [0, 0, 0], max: [1, 1, 1] }, LIQUID_IDS[0])).toThrow(/liquid/);
  });

  it('a heap of water levels to one surface, every drop kept', () => {
    const f = pour(flat(), { at: [0, 0], volume: 2, radius: 0.5 }), v0 = fluidVolume(f);
    const F = flow(f, { seconds: 30 }).field;
    expect(fluidVolume(F)).toBeCloseTo(v0, 9);
    expect(spreadOf(F)).toBeLessThan(0.01);
    expect(wetCells(F)).toBeGreaterThan(wetCells(f) * 10);
  });

  it('rain over a crater runs into its bowl; its rim dams a thin sheet outside', () => {
    const C = crater(flat(), { at: [1, 0], joules: 8e6 });
    const F = flow(pour(C.field, { at: [0, 0], volume: 2, radius: 3.5 }), { seconds: 40 }).field;
    expect(fluidAt(F, 1, 0).depth).toBeGreaterThan(fluidAt(F, -3, -3).depth + 0.15);
  });

  it('viscosity is how fast: in the same seconds honey spreads less than water; mud stops on its yield and holds a heap', () => {
    const go = (liquid, seconds) => flow(pour(flat(), { at: [0, 0], volume: 1, radius: 0.5, liquid }), { seconds }).field;
    expect(wetCells(go('honey', 3))).toBeLessThan(wetCells(go('water', 3)));
    const mud = go('mud', 60);
    expect(spreadOf(mud)).toBeGreaterThan(0.01);   // it keeps a heap a Newtonian liquid would not
  });
});

describe('Archimedes falls out of pressure on faces', () => {
  const { wet, submerged } = rupaPhysics, pool = { min: [-5, -5, 0], max: [5, 5, 3], density: MATTER.water.density, viscosity: MATTER.water.viscosity };
  const draft = (matter) => {
    const m = blockMatter({ min: [0, 0, 0], max: [1, 1, 1] }, matter);
    let lo = 0, hi = 1;
    for (let i = 0; i < 60; i++) { const d = (lo + hi) / 2, box = { min: [0, 0, 3 - d], max: [1, 1, 4 - d] }; (wet(box, m.mass, [0, 0, 0], pool)?.lift ?? 0) < m.mass * 9.81 ? (lo = d) : (hi = d); }
    return hi;
  };
  it('pine floats a third under, ice nine tenths, a hollow steel hull a sixth; solid steel sinks', () => {
    expect(draft('pine')).toBeCloseTo(MATTER.pine.density / 1000, 3);
    expect(draft('ice')).toBeCloseTo(MATTER.ice.density / 1000, 3);
    expect(draft({ matter: 'steel', fill: 0.02 })).toBeCloseTo((MATTER.steel.density * 0.02) / 1000, 3);
    expect(draft('steel')).toBeCloseTo(1, 3);
  });
  it('the push is the weight of the liquid put aside, at any depth', () => {
    const at = (z) => wet({ min: [0, 0, z], max: [1, 1, z + 1] }, 1000, [0, 0, 0], pool).lift;
    expect(at(1.5)).toBeCloseTo(1000 * 9.81, 6);
    expect(at(0.2)).toBeCloseTo(at(1.5), 6);
    expect(submerged({ min: [0, 0, 2.5], max: [1, 1, 3.5] }, 3)).toBeCloseTo(0.5, 9);
  });
  it('a level declares its pools by liquid', () => {
    expect(readMatterSpec({ pools: [{ min: [0, 0, 0], max: [2, 2, 1], liquid: 'seawater' }] }).pools[0]).toMatchObject({ density: 1025 });
    expect(() => readMatterSpec({ pools: [{ min: [0, 0, 0], max: [2, 2, 1], liquid: 'steel' }] })).toThrow(/not a liquid/);
  });
});

describe('tanks, tubs, pipes, pumps and nozzles', () => {
  const tank = (id, x, volume, o = {}) => ({ id, at: [x, 0, 0], radius: 0.5, height: 3, liquid: 'water', volume, ...o });

  it('joined tanks meet at one level, the volume kept (communicating vessels)', () => {
    const net = { vessels: [tank('a', 0, 2), tank('b', 2, 0.2)], pipes: [{ from: 'a', to: 'b', z: 0.05, radius: 0.03, length: 2 }] };
    const r = stepVessels(net, { seconds: 300 }), [a, b] = r.net.vessels;
    expect(a.volume + b.volume).toBeCloseTo(2.2, 9);
    expect(Math.abs(a.volume - b.volume) / a.area).toBeLessThan(0.01);
  });

  it('honey through the same pipe is slowed by viscosity; water by the opening', () => {
    const run = (liquid) => stepVessels({ vessels: [tank('a', 0, 2, { liquid }), tank('b', 2, 0, { liquid })], pipes: [{ from: 'a', to: 'b', z: 0.05, radius: 0.02, length: 3 }] }, { seconds: 5 }).net.vessels[1].volume;
    expect(run('honey')).toBeLessThan(run('water') / 20);
  });

  it('a cistern bursts by the hoop stress at its foot: brick filled high goes, reinforced concrete holds; the water floods the ground', () => {
    const cistern = (matter) => ({ vessels: [{ id: 'c', at: [0, 0, 0], radius: 1, height: 4, liquid: 'water', volume: Math.PI * 3.5, wall: { matter, thick: 0.1 } }], pipes: [] });
    const brick = stepVessels(cistern('brick'), { seconds: 0.1, ground: flat() }), rc = stepVessels(cistern('reinforced-concrete'), { seconds: 0.1, ground: flat() });
    expect(brick.events.find((e) => e.kind === 'burst')).toBeDefined();
    expect(fluidVolume(brick.ground)).toBeCloseTo(Math.PI * 3.5, 6);
    expect(rc.events.length).toBe(0);
  });

  it('a hydrant and a pump drive a hose to a nozzle: the jet is the pressure behind it', () => {
    const net = { vessels: [], pipes: [{ id: 'hose', from: { source: { pressure: 4e5 } }, to: { nozzle: { at: [0, 0, 1], dir: [1, 0, 0.6] } }, z: 0, radius: 0.0125, length: 30, pump: 6e5 }] };
    const r = stepVessels(net, { seconds: 0.1 }), j = r.jets[0], expect10bar = jetOf(1e6, { radius: 0.0125 });
    expect(j.speed).toBeCloseTo(expect10bar.speed, 6);
    expect(j.flow).toBeCloseTo(expect10bar.flow, 9);
    expect(jetOf(1e6, { radius: 0.0125 }).speed).toBeGreaterThan(jetOf(4e5, { radius: 0.0125 }).speed);   // the pump is reach
  });
});
