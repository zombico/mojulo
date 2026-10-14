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
const mean3 = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);

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

// THE KERNEL GROWS (outfit/principles.js, the update law): `proportional` keeps the body's ratios, `dense` rounds a coarse
// ring, `fit: 'panel'` hangs open cloth over an arc of the leg hull. Each is absent → the piece as before.
describe('proportional, dense and panels', () => {
  const ring = (P, part, id) => { const st = P[part].stations.find((s) => s.id === id); const pts = P[part].slots.map((sl) => st.points[sl]);
    let g = 0; for (let i = 0; i < pts.length; i++) g += dist(pts[i], pts[(i + 1) % pts.length]); return g; };
  const shin = (extra) => worn({ preset: 'female', outfit: [{ id: 'leg', part: 'shank', run: [0, 0.94], ease: 0.012, group: 'Bottom', ...extra }] }).recipe.parts;
  it('proportional: the cloth keeps the body\'s calf-to-ankle ratio, where one ease everywhere does not', () => {
    const plain = shin(), prop = shin({ proportional: 0.1 });
    const body = (P, id) => ring(P, 'shankR', id), cloth = (P, id) => ring(P, 'leg_shankR', id);
    const [calf, ankle] = ['st1', 'st1_st2_50'];
    const r = (P) => cloth(P, ankle) / cloth(P, calf), rb = body(plain, ankle) / body(plain, calf);
    expect(Math.abs(r(prop) - rb)).toBeLessThan(0.01);
    expect(r(plain) - rb).toBeGreaterThan(0.03);
  });
  it('dense: a six-sided limb\'s cloth is resampled to twelve, the body\'s own points kept, t addressed as before', () => {
    const P = shin({ dense: true });
    expect(P.leg_shankR.slots).toHaveLength(12); expect(P.shankR.slots).toHaveLength(6);
    expect(P.leg_shankR.slotT.back).toBe(3);   // the dense ring's back is the body family's back (t on ring6's half)
    // the inserted points bow out past the chord between their neighbours (the ring is rounder, never inside the body)
    const st = P.leg_shankR.stations[1], c = centre(st), sl = P.leg_shankR.slots;
    for (let k = 1; k < 12; k += 2) { const a = st.points[sl[k - 1]], b = st.points[sl[(k + 1) % 12]], m = st.points[sl[k]];
      expect(dist(m, c)).toBeGreaterThan(dist([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], c) - 1e-9); }
  });
  it('a panel hangs over its arc from the waist to its hem, closed and skinned, with a root to flow from', () => {
    const { recipe, mesh } = worn({ preset: 'female', core: 'structured', outfit: [{ id: 'tail', fit: 'panel', part: ['pelvis', 'thigh'], from: { part: 'pelvis', u: 6 }, to: { part: 'thigh', run: 1 }, around: [160, 200], ease: 0.01, rigidity: 'soft', group: 'Outer' }] });
    const P = recipe.parts.tail_panel; expect(P).toBeTruthy(); expect(failures(mesh).filter((n) => n.startsWith('tail'))).toEqual([]);
    expect(P.rigidity).toBe('soft'); expect(P.root).toHaveLength(3);
    const pts = P.stations.flatMap((st) => Object.values(st.points));
    expect(pts.every((p) => p[1] < 0)).toBe(true);   // all of it behind the figure (the back arc; +y is the front)
    expect(P.stations[0].points.p0[2]).toBeGreaterThan(P.stations[11].points.p0[2] + 0.2);   // it falls
    expect(validateGarments([{ id: 'x', fit: 'panel', part: 'pelvis', from: { part: 'pelvis', u: 6 }, to: { part: 'thigh', run: 1 }, around: [200, 160], ease: 0, group: 'Top' }])[0]).toMatch(/around/);
    expect(validateGarments([{ id: 'x', part: 'torso', ease: 0, group: 'Top', proportional: 0 }])[0]).toMatch(/proportional/);
  });
  it('a cape hangs from the shoulders round the back and the arms: round, clear of what it covers, draping on the arms', () => {
    const cape = { id: 'cloak', fit: 'cape', part: ['torso', 'upperArm', 'pelvis', 'thigh', 'shank'], from: { part: 'torso', run: 1 }, to: { part: 'shank', run: 0.3 }, around: [70, 290], ease: 0.02, flare: [0, 0.1], rigidity: 'soft', group: 'Outer' };
    const { recipe, mesh } = worn({ preset: 'male', core: 'structured', outfit: [cape] });
    const P = recipe.parts.cloak_cape; expect(P).toBeTruthy(); expect(failures(mesh).filter((n) => n.startsWith('cloak'))).toEqual([]);
    expect(P.rigidity).toBe('soft');
    const z = (st) => Object.values(st.points)[0][2], top = P.stations[0], hem = P.stations[P.stations.length - 1];
    expect(z(top)).toBeGreaterThan(z(hem) + 0.8);   // shoulders to calf
    // no root: it flows as a curtain, a string per share of its width (hero-flow.js)
    expect(P.root).toBeUndefined();
    // it DRAPES ON THE ARMS: the cloth over an arm takes that arm's weight, the cloth down the spine none
    const armW = (key) => Object.entries(P.bind.blend[key] || {}).filter(([b]) => /^(upperArm|foreArm)/.test(b)).reduce((t, [, w]) => t + w, 0);
    const sideKey = Object.keys(P.bind.blend).filter((k) => /^st[1-4]\.p\d+R$/.test(k)).sort((a, b) => armW(b) - armW(a))[0];
    expect(armW(sideKey)).toBeGreaterThan(0.3);
    for (let i = 0; i < P.stations.length; i++) expect(armW(`st${i}.p6R`), `st${i}.p6R`).toBeLessThan(0.02);
    // it WRAPS: on every ring the arc's ends come forward of its middle by a body's depth (a board lies in one plane)
    for (const st of P.stations) expect(st.points.p0[1] - st.points.p6R[1]).toBeGreaterThan(0.1);
    // clear of what it covers: no point of the body under its arc (behind the arc's ends) stands outside its outer face
    const shoulders = recipe.parts.torso.stations.flatMap((st) => Object.values(st.points)).filter((p) => Math.abs(p[2] - z(top)) < 0.08);
    const cy = (Math.min(...shoulders.map((p) => p[1])) + Math.max(...shoulders.map((p) => p[1]))) / 2, rOf = (p) => Math.hypot(p[0], p[1] - cy), angle = (p) => (Math.atan2(p[0], p[1] - cy) * 180 / Math.PI + 360) % 360;
    const body = ['torso', 'upperArmR', 'upperArmL', 'pelvis', 'thighR', 'thighL'].flatMap((n) => recipe.parts[n].stations.flatMap((st) => Object.values(st.points)));
    let poke = 0, seen = 0;
    for (let i = 1; i < P.stations.length; i++) { const zi = z(P.stations[i]), outer = Object.entries(P.stations[i].points).filter(([sl]) => /^p\d+[RL]?$/.test(sl)).map(([, p]) => p).slice(0, 13);
      for (const b of body.filter((q) => Math.abs(q[2] - zi) < 0.02 && angle(q) > 100 && angle(q) < 260)) { const near = outer.reduce((a, p) => (Math.abs(angle(p) - angle(b)) < Math.abs(angle(a) - angle(b)) ? p : a));
        seen++; if (rOf(b) > rOf(near) + 0.005) poke++; } }
    expect(seen).toBeGreaterThan(20); expect(poke).toBe(0);
    expect(validateGarments([{ ...cape, around: undefined }])[0]).toMatch(/around/);
  });
  it('a hood rises from the shoulders over the head: round over it, open at the face, falling to the nape, turning with the head', () => {
    const hb = humanoidPlan({ preset: 'female', detail: 'swimsuit' }).joints.headBase, head = { at: [0, 0, hb[2] + 0.11], r: [0.13, 0.13, 0.11] };
    const hood = { id: 'cowl', fit: 'hood', part: ['torso', 'upperArm', 'neck'], from: { part: 'torso', run: 1 }, head, around: [70, 290], open: 50, ease: 0.02, group: 'Outer' };
    const { recipe, mesh } = worn({ preset: 'female', core: 'structured', outfit: [hood] });
    const P = recipe.parts.cowl_hood; expect(P).toBeTruthy(); expect(failures(mesh).filter((n) => n.startsWith('cowl'))).toEqual([]);
    const z = (st) => mean3(Object.values(st.points))[2], top = P.stations.at(-1);
    expect(z(top)).toBeGreaterThan(head.at[2] + head.r[2]);   // over the crown
    // round over the head: every point of the head's volume behind the face's opening lies inside its outer face
    let seen = 0, out = 0;
    for (const st of P.stations) { const zi = z(st), f = 1 - ((zi - head.at[2]) / head.r[2]) ** 2; if (f <= 0.05) continue;
      for (let a = 80; a <= 280; a += 20) { const t = a * Math.PI / 180, q = [Math.sin(t) * head.r[0] * Math.sqrt(f), Math.cos(t) * head.r[1] * Math.sqrt(f)];
        const near = Object.values(st.points).reduce((b, p) => (Math.abs(Math.atan2(p[0], p[1]) - Math.atan2(q[0], q[1])) < Math.abs(Math.atan2(b[0], b[1]) - Math.atan2(q[0], q[1])) ? p : b));
        seen++; if (Math.hypot(...q) > Math.hypot(near[0], near[1]) + 0.002) out++; } }
    expect(seen).toBeGreaterThan(30); expect(out).toBe(0);
    // open at the face: at the eyes' height no point of it lies within the opening (±50° of the front)
    const eyes = P.stations.reduce((b, st) => (Math.abs(z(st) - head.at[2]) < Math.abs(z(b) - head.at[2]) ? st : b));
    for (const p of Object.values(eyes.points)) expect(Math.abs(Math.atan2(p[0], p[1]) * 180 / Math.PI)).toBeGreaterThan(49);
    // it falls: from its widest ring down no ring is narrower than the one above it
    const width = (st) => Math.max(...Object.values(st.points).map((p) => Math.abs(p[0])));
    const w = P.stations.map(width), widest = w.indexOf(Math.max(...w.slice(0, -1)));
    for (let i = 0; i < widest; i++) expect(w[i]).toBeGreaterThanOrEqual(w[i + 1] - 1e-6);
    // it turns with the head: the crown is the head's, the foot the shoulders'
    expect(Object.keys(P.bind.blend.tip)).toEqual(['head']);
    expect(P.bind.blend['st0.p6R'].head ?? 0).toBe(0);
    expect(validateGarments([{ ...hood, head: undefined }])[0]).toMatch(/head/);
    expect(validateGarments([{ ...hood, open: 200 }])[0]).toMatch(/open/);
  });
});
