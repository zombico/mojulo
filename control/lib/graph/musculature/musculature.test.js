// musculature: the muscle shirt. The concepts: the dial's laws (level 0 grown at the form end, a finer level rising out
// of its parent, the blends tighter toward the detail end); the smooth union is exactly the skin past every mass's reach
// (absence adds nothing); the shirt put on a flat body: every mass seated, the skin carried out and never in, the left
// the right's mirror, the shells wound outward, the hands grown with the arms (their joints with them), deterministic;
// the dial moves the surface; the door stores it, refuses it on the realistic body and refuses a bad word by name.
import { describe, it, expect } from 'vitest';
import { muscleShirt, validateMuscleShirt, MUSCLE_CARDS, presence, articulation } from './index.js';
import { validateRig, rigNodesAt, correctiveWeight, bindLayered, boneFrames, skinLayered } from '../polygonizer/station-loft-rig.js';
import { correctiveRest } from '../polygonizer/body-relational-correctives.js';
import { blendOf, smin } from './principles.js';
import { densify, grainOf, displace, frames, nipplesOn, keptInOrder, MOST_MOVE, SLOPE } from './passes.js';
import { NIPPLE } from './principles.js';
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

describe('the skin between the masses', () => {
  // a thigh's dense skin and one mass on its front: an egg whose centre lies on the skin meets it square on
  const P = densify(flat.parts.thighR, grainOf(flat.parts.thighR, 0.012)), mid = P.stations[Math.floor(P.stations.length / 2)];
  const c = P.slots.reduce((a, sl) => a.map((v, k) => v + mid.points[sl][k] / P.slots.length), [0, 0, 0]);
  const front = P.slots.map((sl) => mid.points[sl]).reduce((a, p) => (p[1] > a[1] ? p : a));
  const n = [front[0] - c[0], front[1] - c[1], front[2] - c[2]], nl = Math.hypot(...n), ax = [[0, 0, 1], [1, 0, 0], n.map((v) => v / nl)];
  const egg = (r) => ({ id: 'm', group: 'g', level: 0, c: front, ax, r });
  // each point's move along its ray, and its distance to its neighbours on the grid
  const steps = (S) => {
    const mv = P.stations.map((x, i) => P.slots.map((sl) => Math.hypot(...S.stations[i].points[sl].map((v, k) => v - x.points[sl][k]))));
    let worst = 0;
    P.stations.forEach((x, i) => P.slots.forEach((sl, j) => {
      const nb = P.slots[(j + 1) % P.slots.length], d = Math.hypot(...x.points[sl].map((v, k) => v - x.points[nb][k]));
      worst = Math.max(worst, Math.abs(mv[i][j] - mv[i][(j + 1) % P.slots.length]) - SLOPE * d);
    }));
    return { mv, worst };
  };
  it('climbs onto a mass that meets the skin square on in a ramp, never a step', () => {
    const { mv, worst } = steps(displace(P, [egg([0.06, 0.06, 0.035])], 0).part);
    expect(Math.max(...mv.flat())).toBeGreaterThan(0.02);
    expect(worst).toBeLessThan(0.002);
  });
  it('holds a point carried past the most the shirt moves AT the most, never back on the skin', () => {
    const D = displace(P, [egg([0.09, 0.09, 0.12])], 0), { mv } = steps(D.part);
    expect(D.capped.size).toBeGreaterThan(0);
    expect(Math.max(...mv.flat())).toBeLessThanOrEqual(MOST_MOVE + 1e-6);
    const j = P.slots.indexOf(P.slots.find((sl) => mid.points[sl] === front)), i = P.stations.indexOf(mid);
    expect(mv[i][j]).toBeCloseTo(MOST_MOVE, 4);
  });
  it('keeps a hidden shell under the one over it, though the shirt carried it out further', () => {
    // a shell 3 mm inside the thigh's (the flat body's order), carried out by a mass the thigh does not wear
    const A0 = P, B0 = { ...P, stations: P.stations.map((x) => ({ ...x, points: Object.fromEntries(P.slots.map((sl) => [sl, x.points[sl].map((v, k) => v + (c[k] - v) * 0.03)])) })) };
    const A = displace(A0, [egg([0.06, 0.06, 0.035])], 1).part, B = displace(B0, [egg([0.07, 0.07, 0.045])], 1).part;
    const r = (S, i, sl) => Math.hypot(S.stations[i].points[sl][0] - c[0], S.stations[i].points[sl][1] - c[1]);
    const i = P.stations.indexOf(mid), j = P.slots.find((sl) => mid.points[sl] === front);
    expect(r(B, i, j)).toBeGreaterThan(r(A, i, j));
    const K = keptInOrder(B0, B, [{ A0, A, gap: 0.002 }]);
    for (const sl of P.slots) expect(r(K, i, sl)).toBeLessThan(r(A, i, sl) - 0.001);
  });
  it('wears a limb\'s shells by the limb\'s groups only: the chest taken off the card leaves the arm as it was', () => {
    const card = { ...MUSCLE_CARDS.saikyo, groups: MUSCLE_CARDS.saikyo.groups.filter((g) => g.id !== 'chest') };
    const without = muscleShirt(flat, { card, definition: 1 });
    expect(without.recipe.parts.upperArmR.stations).toEqual(AT1.recipe.parts.upperArmR.stations);
    expect(without.recipe.parts.torso.stations).not.toEqual(AT1.recipe.parts.torso.stations);
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

describe('the shirt in a pose', () => {
  // (a face folded: its posed normal more than a right angle from its edge neighbours' mean)
  const folds = (recipe, pose) => {
    const R = validateRig(recipe.rig), mesh = compileLayered(recipe, {}), skin = bindLayered(mesh, recipe, R), { nodes } = rigNodesAt(R, pose);
    const V = skinLayered({ ...mesh, vertices: correctiveRest(mesh, recipe, nodes) }, skin, boneFrames(R, R.joints, nodes));
    const fi = mesh.faces.map((_, i) => i).filter((i) => /^(torso|upperArmR|shoulder(Ball|Web|Cone)R)$/.test(mesh.provenance[mesh.faces[i][0]].part));
    const N = new Map(fi.map((i) => { const [a, b, c] = mesh.faces[i].map((k) => V[k]), e1 = b.map((x, k) => x - a[k]), e2 = c.map((x, k) => x - a[k]); return [i, [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]]; }));
    const edge = new Map(); for (const i of fi) { const f = mesh.faces[i]; for (let k = 0; k < 3; k++) { const a = f[k], b = f[(k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`; (edge.get(key) ?? edge.set(key, []).get(key)).push(i); } }
    const avg = new Map(); for (const L of edge.values()) for (const i of L) for (const j of L) if (i !== j) { const q = avg.get(i) ?? [0, 0, 0], n = N.get(j), l = Math.hypot(...n) || 1; avg.set(i, [q[0] + n[0] / l, q[1] + n[1] / l, q[2] + n[2] / l]); }
    return fi.filter((i) => { const n = N.get(i), q = avg.get(i); return q && n[0] * q[0] + n[1] * q[1] + n[2] * q[2] < 0; }).length;
  };
  it('folds the shoulder\'s shells no more than the flat body does, the arm raised overhead, held out and forward', () => {
    for (const pose of [{ armR: 'up' }, { armR: 'outward' }, { armR: 'forward' }]) expect(folds(AT1.recipe, pose), JSON.stringify(pose)).toBeLessThanOrEqual(folds(flat, pose) + 3);
  }, 120000);
  it('leaves a shell no group wears as it was: the shoulder\'s cone', () => {
    expect(AT1.recipe.parts.shoulderConeR).toEqual(flat.parts.shoulderConeR);
  });
  it('seats the nipples on the mid-clavicular line, low on the chest', () => {
    const F = frames(flat.rig), [areola] = nipplesOn(AT1.recipe.parts.torso, F, NIPPLE.on, NIPPLE);
    expect(Math.abs(areola.c[0] / F.W - NIPPLE.on.x)).toBeLessThan(0.05);
    expect(areola.c[2]).toBeLessThan((flat.rig.joints.shoulderR.at ?? flat.rig.joints.shoulderR)[2] - 0.08);
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
