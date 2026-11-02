// The field's running gear: a track of links evenly pitched and closed round its path, the path flat on the ground
// under the road wheels and over them on the top run, resting on the rollers and sagging between; the wheels on it,
// their guide horns between their tyres; what turns apart from what stands still; every face a material, the same
// twice, within its budget. One running gear, built in the test at a light tank's proportions. And the classes it carries:
// their rows, their bodies waiting, never a ride.
import { describe, it, expect } from 'vitest';
import { runningGear, trackPath, pinsAlong, TRACK_DEPTH } from './mil-track.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { VEHICLES, resolveVehicle, rowOfHandle } from '../vehicle-registry/roster.js';
import { buildsOf, upscaleOf } from '../vehicle-registry/builds.js';
import { rideableRows } from '../vehicle-registry/ride.js';
import { rollVehicleSheet, UNBUILT } from './sheet.js';
import { compileMilitary } from './military.js';
import { compileRealistic } from './realistic.js';
import { MILITARY_CLASSES, militaryBody, trackedGear, trackedWords } from './road-military.js';
import { CAMO, CAMO_IDS } from './livery-cut.js';

const GEAR = {
  x: 1.12, width: 0.4, hullX: 0.82,
  sprocket: { y: -2.45, z: 0.62, r: 0.3 }, idler: { y: 2.55, z: 0.52, r: 0.27 },
  wheels: [1.85, 0.95, 0.05, -0.85, -1.75].map((y) => ({ y, r: 0.32 })),
  rollers: [{ y: 1.4, z: 0.8, r: 0.08 }, { y: 0, z: 0.8, r: 0.08 }, { y: -1.35, z: 0.8, r: 0.08 }],
};
const right = runningGear({ side: 1, ...GEAR }), left = runningGear({ side: -1, ...GEAR });
const tris = (fs) => fs.reduce((s, f) => s + f.corners.length - 2, 0);
const all = (g) => [...g.faces, ...g.spinners.flatMap((s) => s.faces)];
const area2 = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

describe('the track\'s path', () => {
  it('a closed loop turning anticlockwise, flat on the ground under the road wheels', () => {
    expect(area2(right.path)).toBeGreaterThan(0);
    const ground = right.path.filter((p) => p[1] < TRACK_DEPTH + 1e-6);
    expect(Math.min(...right.path.map((p) => p[1]))).toBeCloseTo(TRACK_DEPTH, 6);
    const ys = ground.map((p) => p[0]);
    expect(Math.min(...ys)).toBeLessThanOrEqual(GEAR.wheels.at(-1).y + 1e-6);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(GEAR.wheels[0].y - 1e-6);
  });
  it('over the top it rests on each roller and sags between them, clear of every road wheel', () => {
    const top = right.path.filter((p) => p[0] > GEAR.sprocket.y && p[0] < GEAR.idler.y && p[1] > 0.6);
    for (const c of GEAR.rollers) {
      const at = top.find((p) => Math.abs(p[0] - c.y) < 1e-6);
      expect(at?.[1], `roller at ${c.y}`).toBeCloseTo(c.z + c.r, 6);
    }
    const between = top.filter((p) => p[0] > GEAR.rollers[1].y && p[0] < GEAR.rollers[0].y);
    expect(Math.min(...between.map((p) => p[1]))).toBeLessThan(GEAR.rollers[0].z + GEAR.rollers[0].r - 0.005);
    const wheelTop = Math.max(...GEAR.wheels.map((w) => w.r + TRACK_DEPTH + w.r));
    expect(Math.min(...top.map((p) => p[1]))).toBeGreaterThan(wheelTop);
  });
  it('without rollers it runs straight over from the idler to the sprocket', () => {
    const P = trackPath({ ...GEAR, wheels: GEAR.wheels.map((w) => ({ ...w, z: w.r + TRACK_DEPTH })), rollers: [], sag: 0 });
    expect(area2(P)).toBeGreaterThan(0);
  });
});

describe('the links', () => {
  it('pinned evenly round the path and closed: every chord one length, near the pitch asked', () => {
    const d = right.pins.map((p, i) => { const q = right.pins[(i + 1) % right.pins.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
    expect(Math.max(...d) / Math.min(...d)).toBeLessThan(1.03);
    expect(Math.abs(d.reduce((a, b) => a + b, 0) / d.length - 0.15)).toBeLessThan(0.01);
    expect(pinsAlong([[0, 0], [1, 0], [1, 1], [0, 1]], 0.25)).toHaveLength(16);
  });
  it('each a shoe, its grouser on the ground and its guide horn in, between the road wheels\' tyres', () => {
    const shoes = right.faces.filter((f) => f.part === 'track.shoe');
    expect(Math.min(...shoes.flatMap((f) => f.corners.map((c) => c[2])))).toBeCloseTo(0, 3);
    // (the horns rise inward from the ground run within the gap the dual tyres leave)
    const horns = shoes.filter((f) => f.corners.every((c) => Math.abs(c[0] - GEAR.x) < 0.022 + 1e-6) && f.corners.some((c) => c[2] > TRACK_DEPTH + 0.05) && f.corners.every((c) => c[2] < 0.3));
    expect(horns.length).toBeGreaterThan(0);
    const tyres = right.spinners.filter((s) => s.kind === 'road').flatMap((s) => s.faces.filter((f) => f.material === 'rubber'));
    for (const f of tyres) for (const c of f.corners) expect(Math.abs(c[0] - GEAR.x)).toBeGreaterThan(0.03);
  });
});

describe('what turns and what stands', () => {
  it('each road wheel, the sprocket, the idler and each roller a spinner on its hub, its radius its own', () => {
    expect(right.spinners.map((s) => s.kind)).toEqual([...GEAR.wheels.map(() => 'road'), 'sprocket', 'idler', ...GEAR.rollers.map(() => 'roller')]);
    expect(new Set(right.spinners.map((s) => s.id)).size).toBe(right.spinners.length);
    for (const s of right.spinners) {
      expect(s.hub[0]).toBeCloseTo(GEAR.x, 6);
      const far = Math.max(...s.faces.flatMap((f) => f.corners.map((c) => Math.hypot(c[1] - s.hub[1], c[2] - s.hub[2]))));
      // (a sprocket's tooth tips stand at its radius, their corners a hair past it)
      expect(far, s.id).toBeLessThanOrEqual(s.r * 1.01);
      expect(far, s.id).toBeGreaterThan(s.r * 0.95);
    }
    // (a road wheel stands on the track: its centre its radius above the track's inner face)
    expect(right.spinners[0].hub[2]).toBeCloseTo(GEAR.wheels[0].r + TRACK_DEPTH, 6);
  });
  it('the left a mirror of the right: as many faces, its extent the right\'s across the middle', () => {
    expect(all(left).length).toBe(all(right).length);
    const box = (fs, k) => { const v = fs.flatMap((f) => f.corners.map((c) => c[k])); return [Math.min(...v), Math.max(...v)]; };
    const [a, b] = box(all(right), 0), [c, d] = box(all(left), 0);
    expect(c).toBeCloseTo(-b, 4); expect(d).toBeCloseTo(-a, 4);
    for (const k of [1, 2]) expect(box(all(left), k)).toEqual(box(all(right), k));
  });
  it('every face a part and a material, its normal unit; the same twice; within its budget', () => {
    for (const f of all(right)) { expect(f.part).toBeTruthy(); expect(f.material).toBeTruthy(); expect(Math.hypot(...f.outNormal)).toBeCloseTo(1, 4); }
    expect(JSON.stringify(runningGear({ side: 1, ...GEAR }))).toBe(JSON.stringify(right));
    expect(tris(all(right))).toBeLessThan(12000);
  });
});

// the classes the running gear carries and their rows: named by the words people say, sized by their numbers, their
// bodies waiting until built, and never a ride (skid steer is not built)

describe('the tracked classes and their rows', () => {
  const TRACKED = Object.keys(PHYSICS).filter((k) => PHYSICS[k].running === 'track');
  it('each a class on a track pair, its row found by the words people say', () => {
    expect(TRACKED.length).toBeGreaterThan(0);
    for (const k of TRACKED) {
      const id = rowOfHandle('physics', k);
      expect(id, k).toBeTruthy();
      expect(VEHICLES[id]).toMatchObject({ role: 'armour' });
      expect(VEHICLES[id].uses).toContain('parked');
      for (const w of [VEHICLES[id].label, ...VEHICLES[id].aliases]) expect(resolveVehicle(w)?.id, w).toBe(id);
      // (its wheelbase the track's length on the ground: the road wheels' span inside its hull)
      expect(PHYSICS[k].wheelbase).toBeLessThan(PHYSICS[k].L);
    }
  });
  it('never a ride: a tracked class\'s realistic build serves no driving, and says what driving needs', () => {
    for (const k of TRACKED) {
      const id = rowOfHandle('physics', k);
      expect(rideableRows()).not.toContain(id);
      expect(buildsOf(id).filter((b) => b.via === 'loft').every((b) => !b.uses.includes('driven'))).toBe(true);
      const up = upscaleOf(id);
      expect(up.realistic).toBe('none');
      expect(up.next).toMatch(UNBUILT[k] ? /not built yet|hull/ : /skid steer/);
    }
  });
  it('a body not built yet is refused by the sheet, naming what is built and what waits', () => {
    for (const k of TRACKED.filter((c) => UNBUILT[c])) {
      expect(UNBUILT[k]).toMatch(/running gear is built/);
      expect(() => rollVehicleSheet({ facets: { pole: 'realistic', class: k }, seed: 1 })).toThrow(/not built yet/);
    }
  });
});

// the light tank's hull on its running gear, compiled as the realistic pole compiles a field vehicle

describe('the light tank\'s hull on its tracks', () => {
  const TANK = Object.keys(MILITARY_CLASSES).find((k) => PHYSICS[k].running === 'track');
  const make = (seed = 3, o = {}) => compileMilitary({ facets: { pole: 'realistic', class: TANK }, seed, given: [] }, { form: true, wear: 'pristine', ...o });
  const c = make(), faces = Object.values(c.form).flat(), gear = trackedGear(TANK);
  it('rolls on its running gear: each wheel, sprocket, idler and roller a bone, its wheelbase its track on the ground, at its class\'s length and width', () => {
    const turning = 2 * (gear.wheels.length + 2 + gear.rollers.length);
    expect(c.figure.bones.filter((b) => /^(road|sprocket|idler|roller)/.test(b.id))).toHaveLength(turning);
    expect(c.figure.bones.map((b) => b.id)).toEqual(expect.arrayContaining(['road1L', 'road1R', 'sprocketL', 'idlerR', 'roller1L']));
    expect(c.figure.wheelbase).toBeCloseTo(PHYSICS[TANK].wheelbase, 3);
    for (const k of ['L', 'W', 'wheelRadius']) { expect(c.census.against[k], k).toBeGreaterThan(0.99); expect(c.census.against[k], k).toBeLessThan(1.01); }
  });
  it('its fenders over the tracks, clear of them; its hull plate, raked and chamfered; the track bare steel', () => {
    const fender = c.form.root.filter((f) => f.part === 'fender' && !f.edge && f.outNormal[2] < -0.99);
    const trackTop = Math.max(...c.form.root.filter((f) => f.part.startsWith('track')).flatMap((f) => f.corners.map((p) => p[2])));
    expect(Math.min(...fender.flatMap((f) => f.corners.map((p) => p[2])))).toBeGreaterThan(trackTop);
    expect(c.form.root.some((f) => f.part === 'hull.glacis' && f.outNormal[1] > 0.2 && f.outNormal[2] > 0.8)).toBe(true);
    expect(c.form.root.filter((f) => f.part.startsWith('hull') && f.edge).length).toBeGreaterThan(10);
    expect(c.form.root.filter((f) => f.part.startsWith('track')).every((f) => f.material === 'steel')).toBe(true);
  });
  it('skirted by its dice or not, the same size either way', () => {
    const skirts = (seed) => militaryBody(TANK, { seed }).hull.some((f) => f.part === 'skirt');
    const seeds = Array.from({ length: 12 }, (_, k) => k + 1);
    expect(seeds.some(skirts)).toBe(true);
    expect(seeds.some((s) => !skirts(s))).toBe(true);
    const bare = make(seeds.find((s) => !skirts(s)));
    expect(bare.census.against.W).toBeGreaterThan(0.99 * 0.985);
    expect(bare.census.against.L).toBeCloseTo(c.census.against.L, 6);
  });
  it('its camo on its plate, never on its track; within its budget, kept, worn and in camo', () => {
    const camo = make(3, { livery: CAMO_IDS.find((k) => !CAMO[k].cell) });
    const links = camo.form.root.filter((f) => f.part.startsWith('track'));
    expect(new Set(links.map((f) => f.albedo))).toEqual(new Set(c.form.root.filter((f) => f.part.startsWith('track')).map((f) => f.albedo)));
    expect(new Set(camo.form.root.filter((f) => f.part.startsWith('hull')).map((f) => f.albedo)).size).toBeGreaterThan(2);
    const tris = (x) => Object.values(x.form).flat().reduce((s, f) => s + f.corners.length - 2, 0);
    expect(tris(c)).toBeLessThan(40000);
    expect(tris(make(3, { wear: 'used' }))).toBeLessThan(75000);
    expect(tris(camo)).toBeLessThan(85000);
  });
});

describe('the light tank\'s turret and gun', () => {
  const TANK = Object.keys(MILITARY_CLASSES).find((k) => MILITARY_CLASSES[k] === 'lightTank');
  const make = (o = {}) => compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: TANK }, seed: 3 }), { form: true, wear: 'pristine', ...o });
  const c = make();
  it('a bone of its own on the ring, held still while the wheels roll', () => {
    const ids = c.figure.bones.map((b) => b.id), t = ids.indexOf('turret'), w = ids.indexOf('road1L'), R = c.figure.clips.roll, n = ids.length;
    expect(t).toBeGreaterThan(0);
    const q = (key, bone) => R.b.slice((key * n + bone) * 7, (key * n + bone) * 7 + 4);
    for (let k = 0; k < R.k; k++) expect(q(k, t)).toEqual([0, 0, 0, 1]);
    expect(new Set(Array.from({ length: R.k }, (_, k) => q(k, w).join(','))).size).toBeGreaterThan(1);
    // (its head on the ring's centre, over the hull's roof)
    const head = c.figure.bones[t].head, ring = c.form.root.filter((f) => f.part === 'turret.ring');
    const xy = ring.flatMap((f) => f.corners.map((p) => [p[0], p[1]]));
    expect(head[0]).toBeCloseTo((Math.min(...xy.map((p) => p[0])) + Math.max(...xy.map((p) => p[0]))) / 2, 2);
    expect(head[1]).toBeCloseTo((Math.min(...xy.map((p) => p[1])) + Math.max(...xy.map((p) => p[1]))) / 2, 2);
  });
  it('carries the gun, the cupola and its blocks, the smoke dischargers and the basket; the gun reaches past the hull, outside its length', () => {
    const parts = new Set(c.form.turret.map((f) => f.part));
    for (const p of ['gun.barrel', 'gun.brake', 'gun.evacuator', 'mantlet', 'cupola', 'vision', 'smoke.cup', 'basket', 'sight']) expect(parts.has(p), p).toBe(true);
    expect(c.form.root.some((f) => f.part.startsWith('gun') || f.part === 'cupola')).toBe(false);
    const muzzle = Math.max(...c.form.turret.filter((f) => f.part.startsWith('gun')).flatMap((f) => f.corners.map((p) => p[1])));
    expect(muzzle).toBeGreaterThan(PHYSICS[TANK].L / 2);
    for (const k of ['L', 'W', 'H']) { expect(c.census.against[k], k).toBeGreaterThan(0.99); expect(c.census.against[k], k).toBeLessThan(1.01); }
  });
  it('its camo and its number turn with it', () => {
    const camo = make({ livery: CAMO_IDS.find((k) => !CAMO[k].cell) });
    expect(new Set(camo.form.turret.filter((f) => f.material === 'milPaint').map((f) => f.albedo)).size).toBeGreaterThan(2);
    expect(camo.form.turret.some((f) => f.part === 'mark')).toBe(true);
  });
  it('the sheet builds it now: parked and watched, never a ride; within its budget', () => {
    expect(UNBUILT[TANK]).toBeUndefined();
    const id = rowOfHandle('physics', TANK);
    expect(rideableRows()).not.toContain(id);
    expect(upscaleOf(id).next).toMatch(/skid steer/);
    const tris = (x) => Object.values(x.form).flat().reduce((s, f) => s + f.corners.length - 2, 0);
    expect(tris(c)).toBeLessThan(50000);
    expect(tris(make({ wear: 'used', livery: CAMO_IDS.find((k) => !CAMO[k].cell) }))).toBeLessThan(90000);
  });
});

describe('the tracked carrier and the light tank\'s variations', () => {
  const kindOf = (kind) => Object.keys(MILITARY_CLASSES).find((k) => MILITARY_CLASSES[k] === kind);
  const CARRIER = kindOf('trackedCarrier'), TANK = kindOf('lightTank');
  const roll = (cls, { seed = 3, brief = '', ...o } = {}) => compileRealistic(rollVehicleSheet({ brief, facets: { pole: 'realistic', class: cls }, seed }), { form: true, wear: 'pristine', ...o });
  it('a track with its sprocket forward wraps the same way: closed, anticlockwise, flat on the ground, on its rollers', () => {
    const fore = { ...GEAR, sprocket: { ...GEAR.idler, r: 0.3, z: 0.62, y: 2.5 }, idler: { ...GEAR.sprocket, r: 0.27, z: 0.5, y: -2.4 } };
    const P = trackPath({ ...fore, wheels: fore.wheels.map((w) => ({ ...w, z: w.r + TRACK_DEPTH })) });
    expect(area2(P)).toBeGreaterThan(0);
    expect(Math.min(...P.map((p) => p[1]))).toBeCloseTo(TRACK_DEPTH, 6);
    for (const c of fore.rollers) expect(P.some((p) => Math.abs(p[0] - c.y) < 1e-6 && Math.abs(p[1] - (c.z + c.r)) < 1e-6), `roller ${c.y}`).toBe(true);
  });
  it('the carrier: its sprocket forward, a ramp, a cupola in an empty mount ring, at its class\'s size, within its budget, never a ride', () => {
    const c = roll(CARRIER), bone = (id) => c.figure.bones.find((b) => b.id === id).head;
    expect(bone('sprocketL')[1]).toBeGreaterThan(bone('idlerL')[1]);
    const parts = new Set(c.form.root.map((f) => f.part));
    for (const p of ['ramp', 'cupola', 'mount.ring', 'trim.vane', 'hatch.driver', 'engine.grille']) expect(parts.has(p), p).toBe(true);
    expect([...parts].some((p) => /^(gun|turret)/.test(p))).toBe(false);
    for (const k of ['L', 'W', 'H', 'wheelRadius']) { expect(c.census.against[k], k).toBeGreaterThan(0.99); expect(c.census.against[k], k).toBeLessThan(1.01); }
    expect(Object.values(c.form).flat().reduce((s, f) => s + f.corners.length - 2, 0)).toBeLessThan(40000);
    expect(rideableRows()).not.toContain(rowOfHandle('physics', CARRIER));
  });
  it('a brief\'s words choose the tank\'s gun, skirts and basket; what it does not say, its dice', () => {
    expect(trackedWords(['a', 'short', 'gun', 'no', 'skirts'])).toEqual({ gun: 'short', skirts: false });
    expect(trackedWords(['long', 'gun', 'with', 'skirts', 'and', 'a', 'basket'])).toEqual({ gun: 'long', skirts: true, basket: true });
    expect(trackedWords(['without', 'basket', 'skirted'])).toEqual({ skirts: true, basket: false });
    const muzzle = (x) => Math.max(...x.form.turret.filter((f) => f.part.startsWith('gun')).flatMap((f) => f.corners.map((p) => p[1])));
    const has = (x, p) => Object.values(x.form).flat().some((f) => f.part === p);
    const short = roll(TANK, { brief: 'a short gun, no skirts, no basket' }), long = roll(TANK, { brief: 'a long gun with skirts and a basket' });
    expect(muzzle(short)).toBeLessThan(muzzle(long) - 0.8);
    expect(has(short, 'skirt')).toBe(false); expect(has(long, 'skirt')).toBe(true);
    expect(has(short, 'basket')).toBe(false); expect(has(long, 'basket')).toBe(true);
    // (the dice, where nothing is said: both guns among a dozen tanks)
    const guns = new Set(Array.from({ length: 12 }, (_, k) => Math.round(muzzle(roll(TANK, { seed: k + 1 })))));
    expect(guns.size).toBeGreaterThan(1);
  });
});
