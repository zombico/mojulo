// musculature: the muscle shirt. The concepts: the dial's laws (level 0 grown at the form end, a finer level rising out
// of its parent, the blends tighter toward the detail end); the smooth union is exactly the skin past every mass's reach
// (absence adds nothing); the shirt put on a flat body: every mass seated, the skin carried out and never in, the left
// the right's mirror, the shells wound outward, the hands grown with the arms (their joints with them), deterministic;
// the dial moves the surface; the door stores it, refuses it on the realistic body and refuses a bad word by name.
import { describe, it, expect } from 'vitest';
import { muscleShirt, validateMuscleShirt, MUSCLE_CARDS, presence, articulation } from './index.js';
import { validateRig, rigNodesAt, correctiveWeight } from '../polygonizer/station-loft-rig.js';
import { correctiveRest } from '../polygonizer/body-relational-correctives.js';
import { blendOf, smin } from './principles.js';
import { densify, grainOf, displace } from './passes.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm } from '../polygonizer/motion-stamp.js';

// the flat body: the large anime cast, minted as the door mints it (no shirt)
const HERO = { head: 'anime', animeStyle: 'z-fighter' };
const flat = expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultForm(HERO)) }).recipe;
const worn = (definition) => muscleShirt(flat, { card: 'saikyo', definition });
const AT1 = worn(1);

describe('the definition dial', () => {
  it('grows level 0 at the form end, brings each finer level out of its parent in its share, and tightens the blends', () => {
    expect(articulation(0, 0, 2).grow).toBeGreaterThan(articulation(0, 1, 2).grow);
    expect([presence(1, 0), presence(1, 0.5), presence(2, 0.5), presence(2, 1)]).toEqual([0, 1, 0, 1]);
    expect(articulation(2, 0, 2).bury).toBe(1);
    expect(articulation(1, 1, 2).sink).toBeGreaterThan(0);
    for (const l of [0, 1, 2]) expect(blendOf(l, 1)).toBeLessThan(blendOf(l, 0));
  });
  it('sums by a smooth minimum that is exactly the lesser past its blend: a mass out of reach adds nothing', () => {
    expect(smin(0, 0.05, 0.02)).toBe(0);
    expect(smin(0, 0.01, 0.02)).toBeLessThan(0);
  });
  it('leaves a skin no mass reaches where it was, point for point', () => {
    const P = densify(flat.parts.thighR, grainOf(flat.parts.thighR, 0.02));
    const far = { id: 'far', group: 'g', level: 0, c: [5, 5, 5], ax: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], r: [0.05, 0.05, 0.05] };
    expect(displace(P, [far], 0.5).part.stations).toEqual(P.stations);
  });
});

describe('the shirt put on a flat body', () => {
  it('seats every mass of the card and takes the pectoral layer off', () => {
    expect(AT1.report.missed).toEqual([]);
    expect(AT1.report.masses).toBe(MUSCLE_CARDS.saikyo.groups.reduce((a, g) => a + g.masses.length, 0));
    expect(Object.keys(AT1.recipe.parts).some((n) => /^pectoral/.test(n))).toBe(false);
  });
  it('carries the skin out, never in: the upper arm\'s widest ring grows', () => {
    const girth = (P) => Math.max(...P.stations.map((x) => P.slots.reduce((a, sl, k) => { const p = x.points[sl], q = x.points[P.slots[(k + 1) % P.slots.length]]; return a + Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }, 0)));
    expect(girth(AT1.recipe.parts.upperArmR)).toBeGreaterThan(1.15 * girth(flat.parts.upperArmR));
  });
  it('makes the left the right\'s mirror and the midline symmetric', () => {
    const R = AT1.recipe.parts.foreArmR, L = AT1.recipe.parts.foreArmL, T = AT1.recipe.parts.torso;
    const sw = (s) => s.replace(/([RL])$/, (m) => (m === 'R' ? 'L' : 'R'));
    for (const i of [0, Math.floor(R.stations.length / 2)]) for (const sl of R.slots) { const p = R.stations[i].points[sl], q = L.stations[i].points[sw(sl)]; expect([-q[0], q[1], q[2]]).toEqual(p); }
    const mid = T.stations[Math.floor(T.stations.length / 2)];
    for (const sl of T.slots.filter((s) => /R$/.test(s))) expect(mid.points[sw(sl)][0]).toBe(-mid.points[sl][0]);
  });
  it('winds every shell it wears outward, its domes included', () => {
    const mesh = compileLayered(AT1.recipe, {}), V = mesh.vertices, by = {};
    mesh.faces.forEach((f) => { (by[mesh.provenance[f[0]].part] ??= []).push(f); });
    for (const n of ['torso', 'pelvis', 'upperArmR', 'shoulderBallR', 'shoulderWebR', 'shankL']) {
      const P = AT1.recipe.parts[n], pts = P.stations.flatMap((s) => Object.values(s.points)), c = [0, 1, 2].map((k) => pts.reduce((a, p) => a + p[k], 0) / pts.length);
      const out = by[n].filter(([a, b, d]) => { const e1 = [0, 1, 2].map((k) => V[b][k] - V[a][k]), e2 = [0, 1, 2].map((k) => V[d][k] - V[a][k]), nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; return [0, 1, 2].reduce((s, k) => s + nn[k] * ((V[a][k] + V[b][k] + V[d][k]) / 3 - c[k]), 0) > 0; });
      expect(out.length / by[n].length).toBeGreaterThan(0.9);
    }
  });
  it('grows the hands with the arms, about the wrist, their joints with them', () => {
    expect(AT1.report.hands).toBeGreaterThan(1.1);
    const J0 = flat.rig.joints, J1 = AT1.recipe.rig.joints, at = (j) => j.at ?? j, d = (a, b) => Math.hypot(...[0, 1, 2].map((k) => at(a)[k] - at(b)[k]));
    expect(d(J1.knucklesR, J1.wristR) / d(J0.knucklesR, J0.wristR)).toBeCloseTo(AT1.report.hands, 5);
    expect(at(J1.elbowR)).toEqual(at(J0.elbowR));
  });
  it('keeps the soles on the ground as the feet grow with the legs, the toes\' joints with them', () => {
    expect(AT1.report.feet).toBeGreaterThan(1.05);
    const low = (R, re) => Math.min(...Object.entries(R.parts).filter(([n]) => re.test(n)).flatMap(([, P]) => P.stations.flatMap((x) => Object.values(x.points).map((p) => p[2]))));
    expect(low(AT1.recipe, /^(foot|toes)R$/)).toBeCloseTo(low(flat, /^(foot|toes)R$/), 5);
    const at = (j) => j.at ?? j;
    expect(at(AT1.recipe.rig.joints.toeTipR)[1]).toBeGreaterThan(at(flat.rig.joints.toeTipR)[1]);
  });
  it('draws the nipples only when asked, as marks on the chest', () => {
    const on = muscleShirt(flat, { card: 'saikyo', definition: 1, nipples: true });
    expect(AT1.report.nipples).toBe(false);
    expect(on.report.moved.nipples).toBe(2);
    expect(JSON.stringify(on.recipe.parts.torso)).not.toBe(JSON.stringify(AT1.recipe.parts.torso));
    expect(JSON.stringify(on.recipe.parts.pelvis)).toBe(JSON.stringify(AT1.recipe.parts.pelvis));
    expect(validateMuscleShirt({ card: 'saikyo', nipples: 'yes' })[0]).toMatch(/nipples: true/);
  });
  it('is deterministic, and the dial moves the surface', () => {
    expect(JSON.stringify(worn(1).recipe)).toBe(JSON.stringify(AT1.recipe));
    expect(JSON.stringify(worn(0).recipe.parts.torso)).not.toBe(JSON.stringify(AT1.recipe.parts.torso));
  });
});

describe('squash and stretch', () => {
  const C = AT1.recipe.correctives, byId = Object.fromEntries((C ?? []).map((c) => [c.id, c]));
  const R = validateRig(AT1.recipe.rig), w = (id, pose) => correctiveWeight(byId[id].driver, rigNodesAt(R, pose).nodes);
  it('reads a bend driver as the joint\'s flexion: none straight, whole at full, the raise as before without one', () => {
    const D = { joint: 'b', to: 'c', bend: 'a', from: 0, full: 90 }, straight = { a: [0, 0, 2], b: [0, 0, 1], c: [0, 0, 0] }, bent = { a: [0, 0, 2], b: [0, 0, 1], c: [0, 1, 1] };
    expect(correctiveWeight(D, straight)).toBe(0);
    expect(correctiveWeight(D, bent)).toBeCloseTo(1, 9);
    const { bend: _b, ...raise } = D;
    expect(correctiveWeight(raise, { ...bent, navel: [0, 0, 0], neckHub: [0, 0, 1] })).toBe(correctiveWeight(raise, { ...straight, b: [0, 0, 1], c: [0, 1, 1], navel: [0, 0, 0], neckHub: [0, 0, 1] }));
  });
  it('wears a corrective a side per joint its groups act at, the left the right\'s mirror', () => {
    expect(Object.keys(byId).sort()).toEqual(['muscleElbowL', 'muscleElbowR', 'muscleKneeL', 'muscleKneeR', 'muscleShoulderL', 'muscleShoulderR']);
    const [id, o] = Object.entries(byId.muscleElbowR.d).find(([k]) => k.startsWith('upperArmR/'));
    const sw = id.replace('upperArmR/', 'upperArmL/').replace(/([RL])$/, (m) => (m === 'R' ? 'L' : 'R'));
    expect(byId.muscleElbowL.d[sw]).toEqual([-o[0], o[1], o[2]]);
  });
  it('drives nothing at rest, and each joint its own as it closes', () => {
    for (const id of Object.keys(byId)) expect(w(id, {})).toBe(0);
    expect(w('muscleElbowR', { elbowR: 130 })).toBeGreaterThan(0.95);
    expect(w('muscleElbowL', { elbowR: 130 })).toBe(0);
    expect(w('muscleKneeR', { kneeR: 110, support: 'L' })).toBeGreaterThan(0.8);
    expect(w('muscleShoulderR', { armR: 'up' })).toBeGreaterThan(0.95);
    const mesh = compileLayered(AT1.recipe, {});
    expect(correctiveRest(mesh, AT1.recipe, rigNodesAt(R, {}).nodes)).toBe(mesh.vertices);
  });
  it('bunches the flexor as the elbow closes: the biceps\' front stands further out', () => {
    const front = Object.entries(byId.muscleElbowR.d).filter(([k]) => /^upperArmR\/st1_st2/.test(k)).map(([, o]) => Math.hypot(...o));
    expect(Math.max(...front)).toBeGreaterThan(0.005);
    expect(Math.max(...Object.values(byId.muscleElbowR.d).map((o) => Math.hypot(...o)))).toBeLessThanOrEqual(0.04);
  });
  it('holds the muscles as at rest when the activity is off', () => {
    expect(muscleShirt(flat, { card: 'saikyo', definition: 1, activity: false }).recipe.correctives).toBeUndefined();
  });
});

describe('the door', () => {
  it('stores the shirt as given, and a hero without one carries no key', () => {
    expect(heroRecord({ ...HERO, muscleShirt: { card: 'saikyo', definition: 0.3 } }).muscleShirt).toEqual({ card: 'saikyo', definition: 0.3 });
    expect('muscleShirt' in heroRecord(HERO)).toBe(false);
  });
  it('refuses it on the realistic body, and a bad word by name', () => {
    expect(() => heroRecord({ form: 'realistic', muscleShirt: 'saikyo' })).toThrow(/muscleShirt: the lofted body's/);
    expect(validateMuscleShirt({ card: 'saikyo', definition: 2 })[0]).toMatch(/definition/);
    expect(validateMuscleShirt({ card: 'saikyo', groups: { abs: 1 } })[0]).toMatch(/not a group of the card \(chest, core/);
    expect(validateMuscleShirt('jojo')[0]).toMatch(/one of saikyo/);
  });
});
