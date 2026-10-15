// The racer's smooth finish: the supercar's corner normals and baked light on a cartoon racer, opt-in. The concepts:
// absent, nothing changes; the shape is the same shape; a rounded shell grades across its rings where a chamfered one
// keeps its creases; a lamp is never shaded; every face is tagged; the census counts what is drawn; a recipe carries
// it; deterministic. One driver per body procedure: a smooth motif and a hard-edged one, chosen from the archetypes.
import { describe, it, expect } from 'vitest';
import { rollEgocube } from '../egocube/egocube.js';
import { ARCHETYPES } from '../egocube/facets.js';
import { racerFromSheet, solveRacer } from './racer.js';
import { racerSpec, racerOf } from './roster.js';
import { shadeRacerFaces, racerReviewInput, CREASE, KART_MATERIALS } from './racer-shade.js';
import { packVehicleReview } from './vehicle-review.js';

const read = (archetype) => racerFromSheet(rollEgocube({ facets: { archetype }, seed: 11 }), { seed: 3 });
const readings = Object.keys(ARCHETYPES).map(read);
const round = readings.find((R) => R.vehicle.facets.motif === 'smooth');
const hard = readings.find((R) => CREASE[R.vehicle.facets.motif] <= 30);
const cel = new Map([round, hard].map((R) => [R, solveRacer(R, { seed: 3 })]));
const smooth = new Map([round, hard].map((R) => [R, solveRacer(R, { seed: 3, shade: 'smooth' })]));
const all = (S) => [S.faces.root, ...S.faces.wheels.map((w) => w.faces), ...S.faces.bones.map((b) => b.faces)];

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const gap = (a, b) => Math.hypot(...rgb(a).map((x, i) => x - rgb(b)[i]));
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const normal = (c) => { let n = [0, 0, 0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; } return unit(n); };
// the colour step across each edge two faces of one albedo share: [cos of their dihedral, the cel step, the smooth step]
function steps(celFaces, smoothFaces) {
  const edges = new Map();
  smoothFaces.forEach((f, i) => f.corners.forEach((p, j) => {
    const q = f.corners[(j + 1) % f.corners.length], k = `${f.albedo}|${[p.join(), q.join()].sort().join('|')}`;
    if (!edges.has(k)) edges.set(k, []); edges.get(k).push({ i, j, jn: (j + 1) % f.corners.length });
  }));
  const out = [];
  for (const sides of edges.values()) {
    if (sides.length !== 2) continue;
    const [a, b] = sides, A = smoothFaces[a.i], B = smoothFaces[b.i], d = normal(A.corners).reduce((s, x, i) => s + x * normal(B.corners)[i], 0);
    const at = (F, c) => F.cornerFills[F.corners.findIndex((p) => p.join() === c)];
    const ends = [A.corners[a.j].join(), A.corners[a.jn].join()];
    out.push([d, gap(celFaces[a.i].fill, celFaces[b.i].fill), Math.max(...ends.map((c) => gap(at(A, c), at(B, c))))]);
  }
  return out;
}
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);

describe('the racer\'s smooth finish', () => {
  it('found a rounded and a hard-edged body among the archetypes', () => {
    expect(round).toBeTruthy();
    expect(hard).toBeTruthy();
  });

  it('absent, it is the cel light: an explicit cel is the default, and an unknown shade is refused', () => {
    expect(JSON.stringify(solveRacer(round, { seed: 3, shade: 'cel' }).figure)).toBe(JSON.stringify(cel.get(round).figure));
    expect(cel.get(round).faces.root.every((f) => f.cornerFills === undefined && f.material === undefined)).toBe(true);
    expect(() => solveRacer(round, { shade: 'phong' })).toThrow(/shade is one of cel, smooth/);
  });

  it('changes the light, never the shape', () => {
    for (const R of [round, hard]) {
      const a = all(cel.get(R)).flat(), b = all(smooth.get(R)).flat();
      expect(b.map((f) => f.corners)).toEqual(a.map((f) => f.corners));
      expect(smooth.get(R).physics).toEqual(cel.get(R).physics);
      for (const f of b) {
        expect(f.cornerFills).toHaveLength(f.corners.length);
        expect(KART_MATERIALS[f.material], f.material).toBeTruthy();
        expect(f.albedo).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('grades a rounded shell across its rings, and keeps a hard body\'s creases', () => {
    const body = (S) => S.faces.root;
    const r = steps(body(cel.get(round)), body(smooth.get(round)));
    const soft = r.filter(([d]) => d > Math.cos((CREASE.smooth * Math.PI) / 180) && d < 0.999);
    expect(soft.length).toBeGreaterThan(50);
    expect(mean(soft.map((s) => s[2]))).toBeLessThan(mean(soft.map((s) => s[1])) * 0.5);
    const crease = Math.cos((CREASE[hard.vehicle.facets.motif] * Math.PI) / 180);
    const kept = steps(body(cel.get(hard)), body(smooth.get(hard))).filter(([d, c]) => d < crease && c > 8);
    expect(kept.length).toBeGreaterThan(5);
    expect(mean(kept.map((s) => s[2]))).toBeGreaterThan(mean(kept.map((s) => s[1])) * 0.5);
  });

  it('leaves a lamp its colour', () => {
    const lamps = all(smooth.get(round)).flat().filter((f) => f.material === 'lamp' || f.material === 'tail');
    expect(lamps.length).toBeGreaterThan(0);
    for (const f of lamps) for (const c of f.cornerFills) expect(c).toBe(f.fill);
    const sun = unit([0.35, -0.55, 0.76]), q = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
    const [lit] = shadeRacerFaces([{ corners: q, slot: 'tech:light', value: 0.6 }], { palette: { 'tech:light': '#fff1bd' }, motif: 'smooth', sun });
    expect(lit.fill).toBe('#fff1bd');
  });

  it('counts what it draws against the budget law\'s ceiling', () => {
    for (const S of [cel.get(round), smooth.get(hard)]) {
      const drawn = all(S).flat().reduce((t, f) => t + f.corners.length - 2, 0);
      expect(S.census.triangles).toBe(drawn);
      expect(Object.values(S.census.byBone).reduce((t, x) => t + x, 0)).toBe(drawn);
      expect(S.census.faces).toBeLessThanOrEqual(S.census.faceBudget);
      expect(S.laws.some((l) => l.law === 'budget')).toBe(false);
    }
  });

  it('opens in the vehicle review page when smooth, one draw a material', () => {
    const groups = packVehicleReview(racerReviewInput(smooth.get(round)));
    expect(groups.length).toBe(new Set(all(smooth.get(round)).flat().map((f) => f.material)).size);
    expect(groups.reduce((t, g) => t + g.indices.length / 3, 0)).toBe(smooth.get(round).census.triangles);
    expect(() => racerReviewInput(cel.get(round))).toThrow(/shade: 'smooth'/);
  });

  it('rides a racer\'s recipe, and is deterministic', () => {
    const arch = round.archetype;
    expect(racerSpec({ archetype: arch, seed: 3, shade: 'smooth' })).toEqual({ facets: { archetype: arch }, seed: 3, shade: 'smooth' });
    expect(() => racerSpec({ archetype: arch, shade: 'glossy' })).toThrow(/shade is one of/);
    const a = racerOf({ facets: { archetype: hard.archetype }, seed: 5, shade: 'smooth' }).S.figure;
    const b = racerOf({ facets: { archetype: hard.archetype }, seed: 5, shade: 'smooth' }).S.figure;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(racerOf({ facets: { archetype: hard.archetype }, seed: 5 }).S.figure));
  });
});
