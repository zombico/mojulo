// body-garment.test.js — GARMENTS WITH VOLUME that follow the body (body-garment.js), and the hero's outfit words
// (hero-dress.js OUTFIT_WORDS) through the plan grammar's `garments` block.
import { describe, it, expect } from 'vitest';
import { humanoidPlan } from './humanoid-plan.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { bindLayered } from './station-loft-rig.js';
import { validateGarments, garmentParts } from './body-garment.js';
import { OUTFIT_WORDS, validateOutfit, lowerOutfit } from './hero-dress.js';

const failures = (m) => Object.entries(auditLayered(m)).filter(([, r]) => !r.pass).map(([n]) => n);
const worn = (opts) => { const plan = humanoidPlan({ detail: 'swimsuit', ...opts }); const recipe = expandPlan(plan); return { plan, recipe, mesh: compileLayered(recipe) }; };
const isGarment = (n) => /_/.test(n);
const centre = (st) => { const v = Object.values(st.points); return [0, 1, 2].map((i) => v.reduce((s, p) => s + p[i], 0) / v.length); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('absent is zero bytes', () => {
  it('no outfit, null outfit: the plan and the recipe are the swimsuit hero\'s', () => {
    for (const preset of ['male', 'female']) {
      const plain = humanoidPlan({ preset, detail: 'swimsuit' });
      expect(humanoidPlan({ preset, detail: 'swimsuit', outfit: null })).toEqual(plain);
      expect(plain.garments).toBeUndefined();
    }
    expect(garmentParts({ a: { layer: 1 } }, [])).toEqual({ a: { layer: 1 } });
  });
});

describe('the grammar', () => {
  it('refuses by name', () => {
    expect(validateGarments('tee')[0]).toMatch(/garments: a list/);
    expect(validateGarments([{ id: 'a', part: 'torso', group: 'Top' }])).toEqual(['garments[0].ease: metres off the body, ≥ 0']);
    expect(validateGarments([{ id: 'a', part: 'torso', ease: 0, group: 'Top' }, { id: 'a', part: 'torso', ease: 0, group: 'Top' }])[0]).toMatch(/worn twice/);
    expect(validateGarments([{ id: 'a.b', part: 'torso', ease: 0, group: 'Top' }])[0]).toMatch(/garments\[0\]\.id/);
    expect(validateGarments([{ id: 'a', part: 'torso', ease: 0, group: 'Top', flare: [1] }])[0]).toMatch(/flare/);
    expect(validateOutfit('cape')[0]).toMatch(/'cape' is not an outfit word/);
    const plan = humanoidPlan({ preset: 'male' });
    expect(() => expandPlan({ ...plan, garments: [{ id: 'a', part: 'tail', ease: 0, group: 'Top' }] })).toThrow(/layered plan: garments\[0\]: 'tail' is not an L1 part/);
    expect(() => expandPlan({ ...plan, garments: [{ id: 'a', part: 'torso', u: [9, 10], ease: 0, group: 'Top' }] })).toThrow(/window covers none of 'torso'/);
  });
});

describe('the outfit words follow the body', () => {
  const all = Object.keys(OUTFIT_WORDS);
  it('every word on both casts and both cores: built, audit clean, bound, the body untouched', () => {
    for (const core of ['structured', 'streamlined']) for (const preset of ['male', 'female']) {
      const bare = worn({ preset, core }).recipe;
      const { plan, recipe, mesh } = worn({ preset, core, outfit: all });
      expect(plan.garments.length).toBeGreaterThan(0);
      expect(failures(mesh), `${core} ${preset}`).toEqual([]);
      expect(() => bindLayered(mesh, recipe)).not.toThrow();
      for (const [n, p] of Object.entries(bare.parts)) if (p.layer === 1) expect(recipe.parts[n].stations, `${core} ${preset} ${n}`).toEqual(p.stations);
    }
  });
  it('each garment ring stands off its body ring by at least its ease', () => {
    const { plan, recipe } = worn({ preset: 'female', outfit: ['trousers', 'tee'] });
    for (const G of plan.garments) for (const [n, p] of Object.entries(recipe.parts).filter(([k]) => k.startsWith(`${G.id}_`))) {
      const body = recipe.parts[n.slice(G.id.length + 1)];
      for (const st of p.stations) { const B = body.stations.find((s) => s.id === st.id); if (!B) continue; const c = centre(B);
        for (const sl of p.slots) expect(dist(st.points[sl], c) - dist(B.points[sl], c), `${n} ${st.id}.${sl}`).toBeGreaterThan(G.ease - 1e-5); }
    }
  });
  it('every garment vertex skins as the skin vertex under it: the garment bends at each joint with the body', () => {
    const { recipe, mesh } = worn({ preset: 'male', outfit: ['shirt', 'trousers', 'boots'] });
    // a shoe has stations of its own (it binds as the foot's nearest), so it is left out here
    const B = bindLayered(mesh, recipe), at = Object.fromEntries(mesh.pointIds.map((id, i) => [id, i]));
    let n = 0;
    mesh.pointIds.forEach((id, i) => { const m = id.match(/^[A-Za-z]+_([^/]+)\/(st\d+)\.(.+)$/); if (!m || /^bootFoot_/.test(id)) return; const j = at[`${m[1]}/${m[2]}.${m[3]}`]; if (j === undefined) return;
      expect(B.joints[i], id).toEqual(B.joints[j]); expect(B.weights[i], id).toEqual(B.weights[j]); n++; });
    expect(n).toBeGreaterThan(300);
  });
  it('a dial that moves a body part moves its garment', () => {
    const { recipe } = worn({ preset: 'female', outfit: 'tee' });
    expect(recipe.dials.bulk.parts).toEqual(expect.arrayContaining(['torso', 'tee_torso', 'teeSleeve_upperArmR']));
    expect(humanoidPlan({ preset: 'female' }).dials.bulk.parts).not.toContain('tee_torso');
  });
  it('worn in order: a tee over trousers stands off them, trousers over a tee tuck its hem in', () => {
    // on every pelvis ring both pieces cover, the mean distance of the outer piece's points from the body ring's centre
    const outside = (r, outer, inner) => { const P = r.parts.pelvis, O = r.parts[outer], I = r.parts[inner];
      const shared = O.stations.filter((s) => I.stations.some((t) => t.id === s.id) && P.stations.some((t) => t.id === s.id));
      expect(shared.length).toBeGreaterThan(1);
      return shared.every((s) => { const c = centre(P.stations.find((t) => t.id === s.id)), t = I.stations.find((x) => x.id === s.id);
        const m = (st) => O.slots.reduce((a, sl) => a + dist(st.points[sl], c), 0) / O.slots.length; return m(s) > m(t); }); };
    expect(outside(worn({ preset: 'male', outfit: ['trousers', 'tee'] }).recipe, 'teeHem_pelvis', 'trousersSeat_pelvis')).toBe(true);
    expect(outside(worn({ preset: 'male', outfit: ['tee', 'trousers'] }).recipe, 'trousersSeat_pelvis', 'teeHem_pelvis')).toBe(true);
  });
  it('the shirt clears the chest\'s layers; ease scales with the cast', () => {
    const { recipe } = worn({ preset: 'female', outfit: 'tee' });
    const front = (n) => Math.max(...recipe.parts[n].stations.flatMap((s) => Object.values(s.points).map((p) => p[1])));
    expect(front('tee_torso')).toBeGreaterThan(front('bustR'));
    const ease = (opts) => lowerOutfit('tee', humanoidPlan({ preset: 'male' }), opts).find((E) => E.id === 'tee').ease;
    expect(ease(1.2)).toBeCloseTo(ease(1) * 1.2, 9);
  });
  it('boots stand on a flat sole: a round heel cup and a flat toe box, holding every foot and toe point', () => {
    for (const core of ['structured', 'streamlined']) for (const preset of ['male', 'female']) {
      const { recipe, mesh } = worn({ preset, core, outfit: 'boots' });
      const boot = recipe.parts.bootFoot_footR, P = boot.stations.flatMap((s) => Object.values(s.points)), sole = Math.min(...P.map((p) => p[2]));
      // flat: every ring's lowest points lie on one plane, and the middle rings sit on it across their width
      for (const st of boot.stations.slice(1, -1)) { const z = Object.values(st.points).map((p) => p[2]); expect(Math.min(...z), `${core} ${preset} ${st.id}`).toBeCloseTo(sole, 6);
        expect(z.filter((x) => Math.abs(x - sole) < 1e-6).length).toBeGreaterThanOrEqual(3); }
      // the heel cup is taller than the toe box
      const top = (st) => Math.max(...Object.values(st.points).map((p) => p[2]));
      expect(top(boot.stations[2])).toBeGreaterThan(top(boot.stations[boot.stations.length - 3]));
      // every foot and toe point above the sole lies inside the boot (ray parity along x and along y)
      const part = (fi) => mesh.provenance[mesh.faces[fi][0]].part;
      const tris = mesh.faces.filter((_, fi) => part(fi) === 'bootFoot_footR').map((f) => f.map((v) => mesh.vertices[v]));
      const crossings = (p, ax) => { let c = 0; for (const [a, b, d] of tris) { const [i, j] = ax === 0 ? [1, 2] : [0, 2];
        const det = (b[i] - a[i]) * (d[j] - a[j]) - (d[i] - a[i]) * (b[j] - a[j]); if (Math.abs(det) < 1e-14) continue;
        const u = ((p[i] - a[i]) * (d[j] - a[j]) - (d[i] - a[i]) * (p[j] - a[j])) / det, v = ((b[i] - a[i]) * (p[j] - a[j]) - (p[i] - a[i]) * (b[j] - a[j])) / det;
        if (u < 0 || v < 0 || u + v > 1) continue; if (a[ax] + u * (b[ax] - a[ax]) + v * (d[ax] - a[ax]) > p[ax]) c++; } return c; };
      const out = mesh.vertices.filter((p, vi) => /^(foot|toes|hallux|toe\d)R$/.test(mesh.provenance[vi].part) && p[2] > sole + 0.004 && crossings(p, 0) % 2 === 0 && crossings(p, 1) % 2 === 0);
      expect(out.length, `${core} ${preset}`).toBe(0);
    }
    expect(validateGarments([{ id: 'a', part: 'foot', ease: 0, group: 'Shoes', fit: 'sock' }])[0]).toMatch(/fit: 'shoe'/);
  });
  it('deterministic: the same words, the same recipe', () => {
    const a = JSON.stringify(worn({ preset: 'female', outfit: ['trousers', 'tee', 'boots'] }).recipe);
    expect(JSON.stringify(worn({ preset: 'female', outfit: ['trousers', 'tee', 'boots'] }).recipe)).toBe(a);
  });
});
