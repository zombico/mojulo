// THE METRO'S ROOFTOPS AND MASTS: a low or mid-rise roof's kit by its dice, the cell towers, the aviation lights over the
// tallest (and the channel that blinks them), the industrial buildings' windows and a transformer's can on the poles.
import { describe, it, expect } from 'vitest';
import { rooftopPlan, rooftopTemplates, beaconsOf, ROOFTOP, BEACON } from './rooftop.js';
import { industrialPlan } from './industry.js';
import { kitTemplates } from './kit.js';
import { readBeacons, beaconsChannelScript } from '../scene/channels/beacons.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { assembleGeocityScene } from './scene.js';
import { mulberry32 } from '../city/plan/dice.js';
import { DEFAULT_LIGHT } from '../polygonizer/vexar.js';

const shell = (id, group, h, flat = true, w = 30) => ({ id, group, min: [0, 0, 10], max: [w, w, 10 + h], flat });

describe('the rooftops', () => {
  it('dresses a low or mid-rise flat roof by its dice, never a tower\'s, a gable\'s or a kiosk\'s, on its roof', () => {
    const shells = Array.from({ length: 40 }, (_, k) => shell(`m${k}`, 'geocity:midrise', 18));
    const plan = rooftopPlan(shells, 3);
    expect(plan.length).toBeGreaterThan(40);
    for (const it of plan) { expect(it.at[2]).toBe(28); expect(it.at[0]).toBeGreaterThanOrEqual(ROOFTOP.inset - 1e-6); expect(it.at[0]).toBeLessThanOrEqual(30 - ROOFTOP.inset + 1e-6); }
    const keys = new Set(plan.map((p) => p.key.split(':')[0]));
    for (const k of ['hvac', 'sector', 'dish', 'mast', 'satdish']) expect(keys.has(k), k).toBe(true);
    expect(rooftopPlan([shell('t', 'geocity:tower', 200), shell('g', 'geocity:midrise', 18, false), shell('k', 'geocity:kiosk', 18), shell('s', 'geocity:midrise', 18, true, 6)], 3)).toHaveLength(0);
    expect(JSON.stringify(rooftopPlan(shells, 3))).toBe(JSON.stringify(plan));
  });

  it('builds its kit, a dish each way it faces, a cell tower 30 m tall', () => {
    const T = rooftopTemplates(DEFAULT_LIGHT);
    for (const k of ['hvac', 'sector', 'mast', 'satdish', 'celltower']) expect(T[k].length).toBeGreaterThan(4);
    for (const f of ['e', 'w', 'n', 's']) expect(T.dish[f].length).toBeGreaterThan(10);
    expect(Math.max(...T.celltower.flatMap((f) => f.corners.map((c) => c[2])))).toBeGreaterThan(29);
    // (a transformer's can on a hydro pole, hung below its crossarm)
    const can = kitTemplates(DEFAULT_LIGHT).can.e, zs = can.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.min(...zs)).toBeGreaterThan(7);
    expect(Math.max(...zs)).toBeLessThan(10.5);
  });

  it('lights the tallest at two corners of their roofs, the very tallest half way up too, none under its height', () => {
    expect(beaconsOf([{ rect: [0, 0, 30, 30], z0: 0, z1: BEACON.tall - 1 }])).toHaveLength(0);
    const one = beaconsOf([{ rect: [0, 0, 30, 30], z0: 5, z1: 5 + BEACON.tall + 10 }]);
    expect(one).toHaveLength(2);
    for (const p of one) expect(p[2]).toBeGreaterThan(5 + BEACON.tall + 10);
    expect(beaconsOf([{ rect: [0, 0, 30, 30], z0: 0, z1: BEACON.mid + 20 }])).toHaveLength(4);
  });
});

describe('the beacons channel', () => {
  const quad = { corners: [[-9, -9, 0], [9, -9, 0], [9, 9, 0], [-9, 9, 0]], normal: [0, 0, 1], fill: '#777777' };
  it('reads beacons with points and nothing else, and blinks them on the world clock', () => {
    expect(readBeacons(null)).toBe(null);
    expect(readBeacons({ at: [] })).toBe(null);
    expect(readBeacons({ at: [[0, 0, 'x']] })).toBe(null);
    const src = beaconsChannelScript({ at: [[0, 0, 10]] });
    for (const s of ['stepBeacons = (t)', 'sizeAttenuation: false', 'window.__mojBeacons']) expect(src).toContain(s);
  });
  it('adds not one byte without them', () => {
    const bare = emitThreeWorld({ faces: [quad] });
    expect(emitThreeWorld({ faces: [quad], beacons: null })).toBe(bare);
    expect(bare).not.toContain('stepBeacons');
    expect(emitThreeWorld({ faces: [quad], beacons: { at: [[0, 0, 10]] } })).toContain(' stepBeacons(t);');
  });
});

describe('the industrial buildings\' windows', () => {
  const block = (kind) => ({ id: `T.${kind}`, kind, rect: [0, 0, 150, 220], sides: { w: { kind: 'arterial' }, e: { kind: 'street' }, s: { kind: 'street' }, n: { kind: 'street' } } });
  it('glazes a works\' hall in a ribbon high on its long walls, its office a row a storey; none far off', () => {
    const ops = industrialPlan(block('works'), mulberry32(7));
    const ribbon = ops.find((o) => o.op === 'ribbon'), punched = ops.find((o) => o.op === 'punched'), hall = ops.find((o) => o.op === 'gable');
    expect(ribbon.sides).toEqual(['w', 'e']);
    expect(ribbon.z + ribbon.h).toBeLessThan(hall.ze);
    expect(punched.storeys).toBeGreaterThanOrEqual(2);
    expect(industrialPlan(block('works'), mulberry32(7), { far: true }).some((o) => o.op === 'ribbon' || o.op === 'punched')).toBe(false);
  });
});

describe('the details, built', () => {
  const p = assembleGeocityScene({ kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, geocity: { evoke: 'neighbourhood' } });
  it('dresses its roofs, raises its cell towers, lights its tallest, hangs cans on its poles', () => {
    const groups = new Set(p.repeats.map((r) => r.group));
    for (const g of ['geocity:roof-hvac', 'geocity:roof-sector', 'geocity:roof-mast']) expect(groups.has(g), g).toBe(true);
    expect(p.beacons.at.length).toBe(p.geocity.counts.beacons);
    expect(p.beacons.at.length).toBeGreaterThan(0);
    for (const r of p.repeats.filter((x) => x.group.startsWith('geocity:roof-'))) expect(r.near).toBeGreaterThan(0);
    const cans = p.repeats.filter((r) => r.group === 'geocity:can').reduce((a, r) => a + r.transforms.length, 0), poles = p.repeats.filter((r) => r.group === 'geocity:hydro').reduce((a, r) => a + r.transforms.length, 0);
    if (poles > 8) { expect(cans).toBeGreaterThan(0); expect(cans).toBeLessThan(poles / 2); }
  });
});
