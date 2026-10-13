import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MECHANISMS, MADE, DRIVEN, SETTING_BY_FINISH, pickDress, resolveMechanism, PROMOTE_PX } from './mech-kit.js';
import { fitter, chassisManifest, lowerChassis } from './tech-chassis.js';
import { craftTech } from './tech-crafter.js';
import { lowerObjectFaces } from '../worlds/workbench.js';

const { fit, fitLen } = fitter(173, 40, 1, 1.5);
const lower = (ms) => ms.flatMap((m) => lowerObjectFaces({ kind: 'workbench', units: 'm', [m.kind]: [m.spec] }));
const zMin = (faces) => Math.min(...faces.flatMap((f) => f.corners.map((p) => p[2])));
const S = (made, driven) => ({ made, driven });
const WHEEL = { mechanism: 'wheel', id: 'w', centre: [0, 1, 0.6], axle: [0, 1, 0], r: 0.6, w: 0.14 };
const TRACK = { mechanism: 'track', id: 't', x: [-2.2, 2.2], y: [1, 1.55], r: 0.42 };
const area = (pts) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

describe('the mechanism kit: one wheel, one track, many dresses', () => {
  it('names no form; every dress answers to a setting\'s words', () => {
    const src = readFileSync(new URL('./mech-kit.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/t\.form/);
    for (const form of ['walker', 'tracked', 'hover', 'ship', 'tower', 'gate', 'turret', 'cannon', 'cart', 'tank']) expect(src, form).not.toMatch(new RegExp(`'${form}'`));
    for (const [id, M] of Object.entries(MECHANISMS)) for (const [d, D] of Object.entries(M.dresses)) {
      expect(D.read, `${id}/${d}`).toBeTruthy();
      for (const x of D.made) expect(MADE, `${id}/${d}`).toContain(x);
      for (const x of D.driven) expect(DRIVEN, `${id}/${d}`).toContain(x);
    }
    for (const s of Object.values(SETTING_BY_FINISH)) { expect(MADE).toContain(s.made); expect(DRIVEN).toContain(s.driven); }
  });

  it('a dress is picked by what it is made of, then what drives it; the others are refused with reasons', () => {
    expect(pickDress('wheel', { setting: S('timber-and-rope', 'muscle') }).dress).toBe('spoked');
    expect(pickDress('wheel', { setting: S('iron-and-rivet', 'steam') }).dress).toBe('disc');
    expect(pickDress('wheel', { setting: S('steel-and-rubber', 'combustion') }).dress).toBe('road');
    expect(pickDress('wheel', { setting: S('alloy-and-glass', 'field') }).dress).toBe('pad');
    expect(pickDress('track', { setting: S('iron-and-rivet', 'steam') }).dress).toBe('link');
    expect(pickDress('track', { setting: S('steel-and-rubber', 'combustion') }).dress).toBe('band');
    const p = pickDress('wheel', { setting: S('timber-and-rope', 'muscle') });
    expect(p.why).toBe('made of timber-and-rope and driven by muscle');
    expect(p.refused.map((x) => x.dress).sort()).toEqual(['disc', 'pad', 'road', 'wire']);
    for (const x of p.refused) expect(x.why).toMatch(/not timber-and-rope, muscle/);
    expect(pickDress('wheel', { dress: 'disc' })).toMatchObject({ dress: 'disc', why: 'said' });
    expect(() => pickDress('wheel', { dress: 'cog' })).toThrow(/not a wheel's dress/);
    expect(() => pickDress('gear')).toThrow(/not a mechanism/);
  });

  it('every wheel turns on its axle, its hub on the axle line, its rim at its contact; a pad lifts instead', () => {
    for (const [setting, dress] of [[S('timber-and-rope', 'muscle'), 'spoked'], [S('iron-and-rivet', 'steam'), 'disc'], [S('steel-and-rubber', 'combustion'), 'road'], [S('alloy-and-glass', 'field'), 'pad']]) {
      const M = resolveMechanism(WHEEL, { setting, fit, fitLen, pxPerM: 173 });
      expect(M.dress).toBe(dress);
      const hub = M.cage.find((x) => x.spec.id === 'w-hub').spec;
      if (dress === 'pad') {
        expect(M.joints).toEqual([]);
        expect(zMin(lower(M.cage))).toBeCloseTo(M.lift.gap - 0.02, 2);
        continue;
      }
      // the hub's axis lies on the axle line through the centre
      for (const end of [hub.axisFrom, hub.axisTo]) { expect(end.x).toBeCloseTo(0, 3); expect(end.z).toBeCloseTo(0.6, 3); }
      expect(Math.abs(zMin(lower(M.cage)))).toBeLessThan(0.02);
      expect(M.joints).toEqual([expect.objectContaining({ id: 'w', axis: [0, 1, 0], range: [0, 360], pivot: [0, 1, 0.6] })]);
      expect(M.joints[0].pieces).toEqual(expect.arrayContaining(M.cage.map((x) => x.spec.id)));
    }
    // a spoked wheel's spokes run from its hub to its rim
    const sp = resolveMechanism(WHEEL, { setting: S('timber-and-rope', 'muscle'), fit, fitLen }).cage.filter((x) => x.spec.id.includes('spoke'));
    expect(sp.length).toBeGreaterThanOrEqual(8);
    for (const x of sp) { const [a, b] = x.spec.path, d = (p) => Math.hypot(p[0], p[2] - 0.6); expect(d(a)).toBeLessThan(0.15); expect(d(b)).toBeGreaterThan(0.45); }
  });

  it('a track: the sprocket at the rear, the idler raised at the front, three road wheels on the ground, the belt round them all', () => {
    for (const [setting, dress] of [[S('iron-and-rivet', 'steam'), 'link'], [S('steel-and-rubber', 'combustion'), 'band']]) {
      const M = resolveMechanism(TRACK, { setting, fit, fitLen, pxPerM: 173 });
      expect(M.dress).toBe(dress);
      const ids = M.cage.map((x) => x.spec.id), road = ids.filter((x) => x.startsWith('t-road-')), rollers = ids.filter((x) => x.startsWith('t-roller-'));
      expect(road.length).toBeGreaterThanOrEqual(3);
      expect(rollers.length > 0).toBe(dress === 'link');
      const at = (id) => M.joints.find((j) => j.id === id).pivot;
      for (const r of road) { expect(at('t-sprocket')[0]).toBeLessThan(at(r)[0]); expect(at('t-idler')[0]).toBeGreaterThan(at(r)[0]); expect(at('t-idler')[2]).toBeGreaterThan(at(r)[2]); }
      // the road wheels carry it: their bottoms at the belt's thickness, the belt's at the ground
      const belt = M.cage.find((x) => x.spec.id === 't'), B = lower([belt]);
      expect(Math.abs(zMin(B))).toBeLessThan(0.01);
      for (const r of road) expect(zMin(lower(M.cage.filter((x) => x.spec.id === r)))).toBeLessThan(0.06);
      // the belt's outline wraps every wheel it carries, and every profile is wound counter-clockwise
      const hull = belt.spec.profile.points;
      for (const id of ['t-sprocket', 't-idler', ...road]) {
        const [x, , z] = at(id);
        for (let k = 0; k < hull.length; k++) { const a = hull[k], b = hull[(k + 1) % hull.length]; expect((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (-x - a[0])).toBeGreaterThan(0); }
      }
      for (const x of [...M.cage, ...M.detail].filter((m) => m.kind === 'extrudes')) expect(area(x.spec.profile.points), x.spec.id).toBeGreaterThan(0);
      for (const id of ['t-sprocket', 't-idler', ...road, ...rollers]) expect(M.joints.find((j) => j.id === id)).toMatchObject({ parent: 'core', range: [0, 360] });
    }
  });

  it('detail is kept for the bake; what stands in the silhouette joins the cage once the camera resolves it', () => {
    const iron = S('iron-and-rivet', 'steam');
    const far = resolveMechanism(TRACK, { setting: iron, fit, fitLen, pxPerM: 120 }), near = resolveMechanism(TRACK, { setting: iron, fit, fitLen, pxPerM: 600 });
    const grousers = (M) => M.cage.filter((x) => x.spec.id.includes('grouser')).length;
    expect(grousers(far)).toBe(0);
    expect(far.detail.length).toBeGreaterThan(20);
    expect(grousers(near)).toBe(far.detail.length);
    expect(near.promoted).toBe(far.detail.length);
    expect(0.42 * 0.06 * 600).toBeGreaterThanOrEqual(PROMOTE_PX);
    // bolts on a hub never stand in the silhouette: they stay for the bake at any distance
    const disc = resolveMechanism(WHEEL, { setting: iron, fit, fitLen, pxPerM: 2000 });
    expect(disc.cage.some((x) => x.spec.id.includes('bolt'))).toBe(false);
    expect(disc.detail.filter((x) => x.spec.id.includes('bolt'))).toHaveLength(8);
    expect(JSON.stringify(resolveMechanism(TRACK, { setting: iron, fit, fitLen, pxPerM: 173 }))).toBe(JSON.stringify(resolveMechanism(TRACK, { setting: iron, fit, fitLen, pxPerM: 173 })));
  });

  it('the body plans build their wheels and tracks from the kit, dressed by the setting', () => {
    const thing = (kind, intent) => ({ ...craftTech(kind, intent).plan, intent });
    const tank = chassisManifest(thing('vehicle', 'a battle tank'), { kind: 'vehicle', setting: S('iron-and-rivet', 'steam') });
    expect(tank.mechanisms.map((m) => [m.id, m.dress])).toEqual([['track-l', 'link'], ['track-r', 'link']]);
    expect(Object.keys(tank.pieces)).toEqual(expect.arrayContaining(['track-l', 'track-l-sprocket', 'track-l-idler', 'track-l-road-1', 'track-r-roller-1']));
    expect(tank.detail.length).toBeGreaterThan(0);
    const cannon = (setting) => chassisManifest(thing('weapon', 'a field cannon'), { kind: 'weapon', setting });
    expect(cannon(S('timber-and-rope', 'muscle')).mechanisms[0]).toMatchObject({ mechanism: 'wheel', dress: 'spoked' });
    expect(cannon().mechanisms[0].dress).toBe('road');
    const pads = cannon(S('alloy-and-glass', 'field'));
    expect(pads.mechanisms[0]).toMatchObject({ dress: 'pad', lift: { cue: 'emitter' } });
    expect(zMin(lowerChassis(pads.manifest, pads.pieces))).toBeGreaterThan(0.05);
  });
});
