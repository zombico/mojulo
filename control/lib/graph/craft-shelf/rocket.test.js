// The launch realm (rocket-odm.js, rocket-parts.js, rocket-archetypes.js): a launcher stands on its tail, its lowest point
// on the pad, its stages stacked on their tops (an upper stage's engine inside the interstage below it); its grid fins
// and its legs stowed against it until posed out; a strap-on either side of its core; the orbiter on its tank, its belly
// to it and its gear stowed, or on its own gear on the ground; the same twice; named by the registry and parked in a
// level on its tail.
import { describe, it, expect } from 'vitest';
import { assembleCraft, CRAFT_ARCHETYPES, CRAFT_ODM, CRAFT_ROLES } from './index.js';
import { resolveAssemblerPlacements } from '../worlds/workbench-assembler.js';
import { resolveVehicle } from '../vehicle-registry/roster.js';
import { buildOf } from '../vehicle-registry/builds.js';
import { readParked, withParked } from '../vehicle-registry/parked.js';

const LAUNCH = Object.keys(CRAFT_ARCHETYPES).filter((k) => CRAFT_ARCHETYPES[k].realm === 'launch');
const of = (pred) => LAUNCH.find((k) => pred(CRAFT_ARCHETYPES[k]));
// (each item's world box, by its layout id)
const boxes = (manifest) => { const P = resolveAssemblerPlacements(manifest); return new Map(manifest.items.map((it, i) => [it.id, P[i].bounds])); };
const tall = of((a) => a.stand === 'vertical' && a.layout.some((e) => e.id === 'legs'));

describe('a launcher, stood on its tail', () => {
  it('its long axis up, its lowest point on the pad, in its own realm and roles', () => {
    for (const id of LAUNCH.filter((k) => CRAFT_ARCHETYPES[k].stand === 'vertical')) {
      const { manifest, readout } = assembleCraft(id);
      expect(readout.pitch, id).toBe(90);
      expect(readout.measures.height, id).toBeGreaterThan(4 * Math.max(readout.measures.span, readout.measures.length) * 0.5);
      expect(Math.min(...[...boxes(manifest).values()].map((b) => b.min[2])), id).toBeCloseTo(0, 3);
      expect(CRAFT_ROLES[readout.role].realms, id).toEqual(['launch']);
    }
  });
  it('its upper stage on its first stage\'s top, the upper\'s engine inside the interstage', () => {
    const { manifest } = assembleCraft(tall), B = boxes(manifest), s1 = CRAFT_ODM[CRAFT_ARCHETYPES[tall].layout[0].sku];
    expect(B.get('stage2').min[2]).toBeLessThan(B.get('stage1').max[2]);
    expect(B.get('stage2').min[2]).toBeGreaterThan(B.get('stage1').max[2] - s1.build.interstage);
    expect(B.get('fairing')?.min[2] ?? B.get('capsule').min[2]).toBeCloseTo(B.get('stage2').max[2], 1);
  });
  it('its grid fins and legs stowed against it, out when posed', () => {
    const wide = (pose) => { const B = boxes(assembleCraft(tall, { pose }).manifest), b = B.get('legs'); return b.max[0] - b.min[0]; };
    expect(wide({ legs: 1 })).toBeGreaterThan(wide({}) * 2);
    const fins = (pose) => { const b = boxes(assembleCraft(tall, { pose }).manifest).get('fins'); return b.max[0] - b.min[0]; };
    expect(fins({ fins: 1 })).toBeGreaterThan(fins({}) + 1);
  });
  it('a strap-on either side of its core, mirrored', () => {
    const id = of((a) => a.layout.some((e) => e.pair && /^(srb|side)$/.test(e.id))), { manifest } = assembleCraft(id), B = boxes(manifest);
    const pair = CRAFT_ARCHETYPES[id].layout.find((e) => e.pair && /^(srb|side)$/.test(e.id)).id, r = B.get(`${pair}-r`), l = B.get(`${pair}-l`);
    expect((r.min[0] + r.max[0]) / 2).toBeCloseTo(-(l.min[0] + l.max[0]) / 2, 3);
  });
});

describe('the winged orbiter', () => {
  it('on its tank: its belly to the tank, its fin away, its gear stowed; on its own gear on the ground', () => {
    const stack = of((a) => a.layout.some((e) => CRAFT_ODM[e.sku].kind === 'rocket-orbiter') && a.stand === 'vertical');
    const { manifest } = assembleCraft(stack), B = boxes(manifest), tank = B.get('tank'), orb = B.get('orbiter');
    // (the orbiter beside the tank, all of it past the tank's axis on one side: the tank's box reaches it only by the
    // struts that hold it)
    const R = CRAFT_ODM[CRAFT_ARCHETYPES[stack].layout[0].sku].dims.diameter / 2, axisOn = (lo, hi) => (orb.min[1] > tank.min[1] ? lo + R : hi - R);
    const axis = axisOn(tank.min[1], tank.max[1]);
    expect(orb.min[1] > axis + R * 0.9 || orb.max[1] < axis - R * 0.9).toBe(true);
    const orbItem = manifest.items.find((it) => it.id === 'orbiter');
    expect(JSON.stringify(orbItem.source).includes('gear_')).toBe(false);
    const alone = assembleCraft(of((a) => a.layout.length === 1 && CRAFT_ODM[a.layout[0].sku].kind === 'rocket-orbiter'));
    expect(alone.readout.pitch).toBe(0);
    expect(JSON.stringify(alone.manifest).includes('gear_')).toBe(true);
  });
});

describe('a launcher read and placed', () => {
  it('the same twice', () => {
    expect(JSON.stringify(assembleCraft(tall).manifest)).toBe(JSON.stringify(assembleCraft(tall).manifest));
  });
  it('named by the words people say, its realistic build live, parked in a level on its tail', () => {
    expect(resolveVehicle('space shuttle').row.handles.craft).toBe('shuttleStack');
    expect(resolveVehicle('launch vehicle').row.handles.craft).toBe(tall);
    expect(buildOf('rocket', 'realistic', { use: 'parked' }).build).toMatchObject({ via: 'craft', status: 'live' });
    const [p] = readParked([{ vehicle: 'rocket', at: [0, 0, 0] }]);
    expect(p.craft).toBe(tall);
    const { manifest, colliders } = withParked({ parked: [{ vehicle: 'rocket', at: [0, 0, 0] }] });
    expect(Object.values(manifest.figures)[0]).toBeDefined();
    expect(colliders[0].max[2] - colliders[0].min[2]).toBeGreaterThan(60);
  });
});
