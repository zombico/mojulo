import { describe, it, expect } from 'vitest';
import { assembleAirspace, airspaceOf, validateAirspace } from './airspace.js';
import { planCourse } from './course.js';
import { CLIMB_OUT } from './city.js';

// one small metro on a trainer's island, beside its runway: the smallest map a city and a course share
const M = { kind: 'airspace', map: { form: 'island', craft: 'trainer' }, ground: { pads: [{ at: [0.5, 0.25] }], cities: [{ size: 600 }] } };
const { map, field } = airspaceOf(M);
const town = field.report.cities[0];

describe('a fractal city on a pilot\'s map', () => {
  it('is sited in the field, clear of the runway and its climb-out', () => {
    const F = map.rings.field, [cx, cy] = town.center, [w, d] = town.size;
    expect(Math.abs(cx) + w / 2).toBeLessThanOrEqual(F.hx);
    expect(Math.abs(cy) + d / 2).toBeLessThanOrEqual(F.hy);
    const pad = field.pads[0], half = pad.length / 2;
    // the climb-out: the runway's axis from its departure end, CLIMB_OUT.run on
    const along = pad.along === 'x' ? 0 : 1, across = 1 - along;
    const end = pad.center[along] + pad.depart * half, far = end + pad.depart * CLIMB_OUT.run;
    const lo = Math.min(end, far), hi = Math.max(end, far), c = [cx, cy], s = [w, d];
    const overlapsAlong = c[along] + s[along] / 2 > lo && c[along] - s[along] / 2 < hi;
    const overlapsAcross = Math.abs(c[across] - pad.center[across]) < s[across] / 2 + CLIMB_OUT.half;
    expect(overlapsAlong && overlapsAcross).toBe(false);
  });

  it('reads as a metro from the air: massing only, tall at the core', () => {
    expect(town.profile).toBe('metro');
    expect(town.detail.radius).toBe(0);
    expect(town.masses).toBeGreaterThan(50);
    expect(town.tallest).toBeGreaterThan(60);
  });

  it('draws its masses as instanced boxes on the live page, and as faces in exports', () => {
    const live = assembleAirspace(M, { live: true }), baked = assembleAirspace(M, { live: false });
    const [walls, roofs] = live.repeats;
    expect(walls.transforms.length).toBe(town.masses);
    expect(roofs.transforms.length).toBe(town.masses);
    expect(walls.transforms.every((t) => t.scale.length === 3 && t.scale.every((v) => v > 0))).toBe(true);
    expect(baked.repeats).toBeUndefined();
    expect(baked.faces.filter((f) => f.group === 'city').length).toBeGreaterThan(4 * town.masses);
    // the terrain meshes fine over the city, so its painted streets read
    expect(live.terrain.pins).toHaveLength(1);
    expect(live.cameras.map((c) => c.name)).toContain('city');
  });

  it('counts its roofs as obstacles: a course clears them', () => {
    const [cx, cy] = town.center, [w, d] = town.size;
    let roof = -Infinity, at = null;
    for (let y = cy - d / 2; y < cy + d / 2; y += 10) for (let x = cx - w / 2; x < cx + w / 2; x += 10) { const h = field.topAt(x, y) - field.groundAt(x, y); if (h > roof) { roof = h; at = [x, y]; } }
    expect(roof).toBeGreaterThan(0.9 * town.tallest);
    expect(field.topAt(at[0], at[1])).toBeGreaterThan(field.groundAt(at[0], at[1]));
    const course = planCourse(map, field, { seed: 1 });
    expect(course.laws.find((l) => l.law === 'clear').ok).toBe(true);
  });

  it('adds nothing when absent', () => {
    const bare = airspaceOf({ ...M, ground: { pads: M.ground.pads } }).field;
    expect(bare.report.cities).toBeUndefined();
    expect(bare.cityFaces).toEqual([]);
    expect(bare.topAt(100, 100)).toBe(bare.groundAt(100, 100));
    const page = assembleAirspace({ ...M, ground: { pads: M.ground.pads } }, { live: true });
    expect(page.repeats).toBeUndefined();
    expect(page.terrain.pins).toBeUndefined();
  });

  it('teaches on a bad ask', () => {
    expect(validateAirspace({ kind: 'airspace', ground: { cities: [{ at: [1200, 40] }] } })[0]).toMatch(/\[u, v\] in the field/);
    expect(validateAirspace({ kind: 'airspace', ground: { cities: [{ profile: 'canal' }] } })[0]).toMatch(/profile/);
    expect(validateAirspace({ kind: 'airspace', ground: { cities: [{}, {}, {}, {}] } })[0]).toMatch(/at most 3/);
  });
});
