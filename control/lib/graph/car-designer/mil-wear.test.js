// The field's wear: the words read and refused; a soil read from the livery's camo; mud cut low and round the arches,
// more of it the harder the wear, the area kept; chips only where an edge is seen or a hand goes; dust rising from the
// ground and settling on what faces up; grounding laid at every wear; a wheel's rubber muddied; the same twice. One case
// per procedure, on a small hull built here.
import { describe, it, expect } from 'vitest';
import { readWear, soilFor, weather, weatherWheel, WEAR, WEAR_LEVELS, SOILS } from './mil-wear.js';
import { readLivery, CAMO_IDS } from './livery-cut.js';
import { plate, flatNormals } from './mil-hull.js';
import { milWheel } from './mil-wheel.js';

const BASE = '#4b5320';
const areaOf = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += a[1] * b[2] - a[2] * b[1]; n[1] += a[2] * b[0] - a[0] * b[2]; n[2] += a[0] * b[1] - a[1] * b[0]; } return Math.hypot(...n) / 2; };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
// a slab of a hull from the ground clearance up, a wheel's hub beside its rear, a handled bar on top
const HUB = [0.8, -1, 0.4];
const hull = () => flatNormals([
  ...plate({ axis: 'y', profile: [[-0.95, 0.45], [0.95, 0.45], [0.95, 1.2], [-0.95, 1.2]], from: -2, to: 2, r: 0.03, seg: 2, look: { part: 'tub.side', material: 'milPaint', albedo: BASE } }),
  ...plate({ axis: 'x', profile: [[-0.2, 1.2], [0.2, 1.2], [0.2, 1.25], [-0.2, 1.25]], from: -0.1, to: 0.1, r: 0.01, seg: 1, look: { part: 'grab', material: 'milPaint', albedo: BASE } }),
]);
const of = (fs, m) => fs.filter((f) => f.material === m);
const W = (level) => readWear(level);
const wear = (level, seed = 3) => weather(hull(), W(level), { hubs: [HUB], r: 0.41, zones: { floor: 0.6 }, seed, soil: 'mud' });

describe('the words', () => {
  it('reads a level or the object, refusing what it does not take', () => {
    expect(readWear('battered')).toMatchObject({ level: 'battered', ...WEAR.battered });
    expect(readWear({ level: 'used', soil: 'dust' })).toMatchObject({ level: 'used', soil: 'dust' });
    expect(() => readWear('filthy')).toThrow(new RegExp(WEAR_LEVELS.join(' \\| ')));
    expect(() => readWear({ level: 'used', soil: 'lava' })).toThrow(/no soil/);
    expect(() => readWear({ level: 'used', grime: 1 })).toThrow(/not one of its words/);
  });
  it('reads the soil from the livery\'s camo: the setting\'s ground, mud where it says nothing', () => {
    const soils = new Set(CAMO_IDS.map((c) => soilFor(readLivery(c))));
    expect(soils.size).toBeGreaterThan(1);
    for (const s of soils) expect(SOILS).toHaveProperty(s);
    expect(soilFor(null)).toBe('mud');
  });
});

describe('the wear', () => {
  const total = (fs) => fs.reduce((s, f) => s + areaOf(f.corners), 0), base = total(hull());
  it('cakes mud low and round the arch, more the harder the wear, the area kept', () => {
    const used = wear('used'), battered = wear('battered'), pristine = wear('pristine');
    expect(of(pristine, 'mud')).toEqual([]);
    expect(total(of(battered, 'mud'))).toBeGreaterThan(total(of(used, 'mud')));
    for (const out of [used, battered]) expect(total(out) / base).toBeCloseTo(1, 3);
    // (high on the hull, away from the wheel, no mud)
    const high = of(battered, 'mud').filter((f) => Math.min(...f.corners.map((p) => p[2])) > W('battered').mudTop + 0.35 && Math.hypot(f.corners[0][1] - HUB[1], f.corners[0][2] - HUB[2]) > 0.8);
    expect(high).toEqual([]);
    for (const f of of(battered, 'mud')) expect(f.albedo).toBe(SOILS.mud.caked);
  });
  it('chips to bare steel only where an edge is seen or a hand goes', () => {
    const worn = of(wear('battered'), 'worn');
    expect(worn.length).toBeGreaterThan(0);
    for (const f of worn) expect(f.edge || f.part === 'grab').toBe(true);
  });
  it('lays dust rising from the ground and settling on what faces up; grounding at every wear', () => {
    const out = wear('used'), side = out.filter((f) => f.material === 'milPaint' && Math.abs(f.outNormal[0]) > 0.9 && f.cornerAlbedo);
    // on a side, a corner low on it is nearer the soil's dust than one high on it
    const lows = [], highs = [];
    for (const f of side) f.corners.forEach((p, j) => (p[2] < 0.6 ? lows : p[2] > 1.1 ? highs : []).push(dist(f.cornerAlbedo[j], SOILS.mud.dust)));
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(mean(lows)).toBeLessThan(mean(highs));
    // grounding, laid at every wear: a plate in the wheel's well darkens, the more the nearer the hub
    const liner = flatNormals(plate({ axis: 'x', profile: [[HUB[1] - 0.1, HUB[2] + 0.2], [HUB[1] + 0.1, HUB[2] + 0.2], [HUB[1] + 0.1, HUB[2] + 0.55], [HUB[1] - 0.1, HUB[2] + 0.55]], from: HUB[0] - 0.05, to: HUB[0] + 0.05, look: { part: 'liner', material: 'milPaint', albedo: BASE } }));
    const dark = weather(liner, W('pristine'), { hubs: [HUB], r: 0.41, zones: { floor: 0.2 } }).find((f) => f.outNormal[0] > 0.9);
    const black = (c) => dist(c, '#000000'), at = dark.corners.map((p) => p[2]);
    const lo = at.indexOf(Math.min(...at)), hi = at.indexOf(Math.max(...at));
    expect(black(dark.cornerAlbedo[lo])).toBeLessThan(black(dark.cornerAlbedo[hi]));
    expect(black(dark.cornerAlbedo[hi])).toBeLessThanOrEqual(black(BASE));
  });
  it('is the same twice, and another seed breaks it another way', () => {
    expect(JSON.stringify(wear('used', 3))).toBe(JSON.stringify(wear('used', 3)));
    expect(JSON.stringify(wear('used', 4))).not.toBe(JSON.stringify(wear('used', 3)));
  });
  it('muddies a wheel\'s rubber and dusts its rim; a pristine wheel as it was', () => {
    const wheel = milWheel({ hub: HUB, r: 0.41, width: 0.3 });
    expect(weatherWheel(wheel, W('pristine'))).toBe(wheel);
    const out = weatherWheel(wheel, W('battered'), { soil: 'mud' });
    const tread = (fs) => fs.find((f) => f.part === 'tyre.lug').albedo;
    expect(dist(tread(out), SOILS.mud.caked)).toBeLessThan(dist(tread(wheel), SOILS.mud.caked));
  });
});
