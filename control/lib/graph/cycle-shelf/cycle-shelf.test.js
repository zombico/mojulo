// The cycle shelf's laws, on one machine chosen in code: the inventory's contract, one word one part, the chassis solved
// from its class (the trail derived, never stated), a machine that stands on its tyres on the line it leans about, its
// laws held, its stand leaning it onto three contacts, its front steering about the head, a pair a mirror, the registry
// naming its build. Concepts, not the catalog: no test walks every row.
import { describe, it, expect } from 'vitest';
import { lowerObjectFaces } from '../worlds/workbench.js';
import { resolveAssemblerPlacements } from '../worlds/workbench-assembler.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { CYCLE_ARCHETYPES, CYCLE_KINDS, CYCLE_ODM, assembleCycle, chassisOf, cycleNameIndex, findCyclePart, resolveCyclePart } from './index.js';
import { CYCLE_BUILDERS, beltLoop } from './cycle-parts.js';
import { solveChassis } from './cycle-chassis.js';
import { DEG } from './cycle-common.js';
import { VEHICLES, resolveVehicle, handlesOf } from '../vehicle-registry/roster.js';
import { buildsOf, upscaleOf } from '../vehicle-registry/builds.js';

const ID = Object.keys(CYCLE_ARCHETYPES)[0];
const ROW = CYCLE_ARCHETYPES[ID];
const tris = (recipe) => lowerObjectFaces(recipe).reduce((n, f) => n + f.corners.length - 2, 0);

describe('the inventory', () => {
  it('every row says what the shelf needs, every kind has a builder and a row', () => {
    for (const [sku, r] of Object.entries(CYCLE_ODM)) {
      expect(CYCLE_KINDS[r.kind], sku).toBeTruthy();
      expect(r.mass, sku).toBeGreaterThan(0);
      expect(typeof r.build.family, sku).toBe('string');
      for (const v of Object.values(r.dims)) expect(v > 0 && v < 3, sku).toBe(true);
    }
    expect(Object.keys(CYCLE_BUILDERS).sort()).toEqual(Object.keys(CYCLE_KINDS).sort());
    for (const kind of Object.keys(CYCLE_KINDS)) expect(Object.values(CYCLE_ODM).some((r) => r.kind === kind), kind).toBe(true);
  });
  it('one word names one part', () => {
    expect(() => cycleNameIndex()).not.toThrow();
    const [sku, r] = Object.entries(CYCLE_ODM).find(([, x]) => x.aliases.length);
    expect(findCyclePart(r.aliases[0].toUpperCase())).toBe(sku);
    expect(findCyclePart('no such part')).toBe(null);
  });
  it('builds a part the same twice, in its machine\'s frame', () => {
    const sku = ROW.layout[0].sku;
    expect(resolveCyclePart(sku)).toEqual(resolveCyclePart(sku));
    expect(resolveCyclePart(sku)).toMatchObject({ units: 'm', garage: { machine: ID, localFrame: { forward: '+y', up: '+z' } } });
  });
});

describe('the chassis, solved from its class', () => {
  const G = chassisOf(ID), P = PHYSICS[ROW.physics];
  it('sits on its class\'s wheelbase and its wheels\' radii', () => {
    expect(G.wb).toBe(P.wheelbase);
    expect(G.frontAxle).toEqual([0, P.wheelbase, G.rF]);
    expect(G.rearAxle).toEqual([0, 0, G.rR]);
  });
  it('derives its trail from the rake, the offset and the front wheel, and the steering axis meets the ground there', () => {
    expect(G.trail).toBeCloseTo((G.rF * Math.sin(G.rake) - G.offset) / Math.cos(G.rake), 9);
    expect(G.axis.ground[2]).toBeCloseTo(0, 9);
    expect(G.axis.ground[1] - G.wb).toBeCloseTo(G.trail, 9);
  });
  it('a fork set ahead of the axle\'s lead gives a negative trail, which its band refuses', () => {
    const lead = G.rF * Math.sin(G.rake);
    const bad = solveChassis({ ...ROW.chassis, offset: lead + 0.05 }, P, { front: { radius: G.rF }, rear: { radius: G.rR } });
    expect(bad.trail).toBeLessThan(0);
    expect(bad.trail).toBeLessThan(ROW.laws.trail[0]);
  });
});

describe('the machine', () => {
  const { manifest, readout } = assembleCycle(ID);
  it('stands on two tyres in line, on the line it leans about, at its class\'s size', () => {
    expect(readout.layout).toBe('inline');
    expect(readout.contacts.map((c) => c.at)).toEqual([[0, PHYSICS[ROW.physics].wheelbase, 0], [0, 0, 0]]);
    expect(readout.laws.laws.find((l) => l.id === 'size').ok).toBe(true);
  });
  it('holds every law, and the audit counts its bill of materials', () => {
    expect(readout.laws.laws.filter((l) => !l.ok)).toEqual([]);
    expect(readout.audit.ok).toBe(true);
  });
  it('is the same twice, within its budget', () => {
    expect(assembleCycle(ID)).toEqual({ manifest, readout });
    expect(manifest.items.reduce((n, it) => n + tris(it.source), 0)).toBeLessThan(40000);
  });
  it('says where a rider meets it: the seat, the grips and the pegs, each side the other\'s mirror', () => {
    const R = readout.rider;
    expect(R.seat[2]).toBeGreaterThan(R['peg.r'][2]);
    expect(R['grip.r'][2]).toBeGreaterThan(R.seat[2]);
    expect(R['grip.l']).toEqual([-R['grip.r'][0], R['grip.r'][1], R['grip.r'][2]]);
    expect(R['peg.l']).toEqual([-R['peg.r'][0], R['peg.r'][1], R['peg.r'][2]]);
  });
  it('builds a pair\'s left as the mirror of its right', () => {
    const pair = ROW.layout.find((e) => e.pair);
    const corners = (side) => lowerObjectFaces(resolveCyclePart(pair.sku, { side })).flatMap((f) => f.corners);
    const r = corners('r'), l = corners('l');
    expect(Math.min(...r.map((c) => c[0]))).toBeCloseTo(-Math.max(...l.map((c) => c[0])), 6);
  });
  it('names what moves: the steering about its head, each wheel\'s roll, the swingarm about its pivot', () => {
    const names = readout.joints.map((j) => j.name);
    for (const n of ['steer', 'roll_front', 'roll_rear', 'swingarm']) expect(names).toContain(n);
    const steer = readout.joints.find((j) => j.name === 'steer');
    // (its axis is stored to the millimetre: its rake to a tenth of a degree)
    expect(Math.atan2(-steer.dir[1], steer.dir[2]) / DEG).toBeCloseTo(ROW.chassis.rake, 1);
  });
});

describe('what articulates', () => {
  it('parks on its stand: it leans toward the stand, onto three contacts on the ground', () => {
    const { readout } = assembleCycle(ID, { pose: { stand: 'down' } });
    const [lo, hi] = ROW.laws.stand;
    expect(-readout.lean).toBeGreaterThan(lo);
    expect(-readout.lean).toBeLessThan(hi);
    expect(readout.contacts.length).toBe(3);
    for (const c of readout.contacts) expect(Math.abs(c.at[2])).toBeLessThan(0.003);
    expect(readout.contacts.find((c) => c.id === 'stand').at[0]).toBeLessThan(0);
  });
  it('steers its front about the head, its rear left where it was', () => {
    const at = (pose, id) => { const { manifest } = assembleCycle(ID, { pose }); const i = manifest.items.findIndex((x) => x.id === id); const b = resolveAssemblerPlacements(manifest)[i].bounds; return [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2); };
    const front = ROW.layout.find((e) => e.steers && e.slot === 'front').id, rear = ROW.layout.find((e) => !e.steers && e.slot === 'rear').id;
    expect(at({ steer: 30 }, front)[0]).toBeGreaterThan(at({}, front)[0]);
    expect(at({ steer: -30 }, front)[0]).toBeLessThan(at({}, front)[0]);
    expect(at({ steer: 30 }, rear)).toEqual(at({}, rear));
  });
  it('refuses a stand it does not have', () => {
    expect(() => assembleCycle(ID, { pose: { stand: 'sideways' } })).toThrow(/'up' or 'down'/);
  });
});

describe('the drive', () => {
  it('runs its chain round both sprockets, a closed loop in one plane', () => {
    const loop = beltLoop(-0.1, [0.6, 0.45], 0.05, [0, 0.35], 0.11);
    expect(loop[0]).toEqual(loop.at(-1));
    expect(new Set(loop.map((p) => p[0]))).toEqual(new Set([-0.1]));
    // (every point on a pulley or on a straight between them: no point inside either)
    for (const p of loop) {
      expect(Math.hypot(p[1] - 0.6, p[2] - 0.45)).toBeGreaterThan(0.05 - 1e-9);
      expect(Math.hypot(p[1], p[2] - 0.35)).toBeGreaterThan(0.11 - 1e-9);
    }
  });
});

describe('on the registry', () => {
  it('the row the machine is named by builds it, asleep until a door shows it', () => {
    const row = Object.keys(VEHICLES).find((id) => handlesOf(id).cycle?.includes(ID));
    expect(row).toBeTruthy();
    expect(resolveVehicle(VEHICLES[row].label).id).toBe(row);
    expect(buildsOf(row).find((b) => b.via === 'cycle')).toMatchObject({ tier: 'realistic', status: 'asleep' });
    expect(upscaleOf(row)).toMatchObject({ realistic: 'asleep', via: 'cycle' });
  });
});
