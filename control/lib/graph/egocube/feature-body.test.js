// The feature body (feature-body.js) and its face (feature-face.js): the laws of one skin of eggs, on the one build there
// is (the raccoon's family). An egg's fat end is its short end; a tuft is round at its root and a rounded point at its
// tip; the skin is one closed, sound surface; every point's weights sum to one and name only bones whose eggs are near
// it; the mascot sheet in the feature style compiles to that skin on the mascot's rig, shaded smooth, its lids shells
// turning about their globes; a sheet in any other style compiles as it did.
import { describe, it, expect } from 'vitest';
import { egg, eggDistance, eggField, eggSkin, tuft, FEATURE_BUILDS, FEATURE_TRIANGLES } from './feature-body.js';
import { FEATURE_EYE } from './feature-face.js';
import { FEATURE_COAT, strokesOf, coatLayers } from './feature-coat.js';
import { rollMascot } from './mascot.js';
import { mascotPlanFromSheet } from './mascot-form.js';

const along = (E, s) => { let lo = 0, hi = 4 * Math.max(...E.r); for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; (eggDistance(E, E.c.map((x, k) => x + E.u[k] * s * m)) < 0 ? (lo = m) : (hi = m)); } return lo; };

describe('the feature body', () => {
  it('an egg: its thin end (along u) longer than its fat end; an ellipsoid at eggliness 0', () => {
    const E = egg({ c: [0, 0, 0], u: [0, 0, 1], r: [1, 0.8, 0.7], e: 0.4, bone: 'b', join: 0.1 }), O = egg({ c: [0, 0, 0], u: [0, 0, 1], r: [1, 0.8, 0.7], e: 0, bone: 'b', join: 0.1 });
    expect(along(E, 1)).toBeGreaterThan(along(E, -1) * 1.3);
    expect(along(O, 1)).toBeCloseTo(along(O, -1), 6);
  });

  it('a tuft: round at its root, a rounded point at its tip, bending toward its bend', () => {
    const T = tuft({ root: [0, 0, 0], aim: [1, 0, 0], len: 1, r: 0.2, tip: 0.2, curl: 40, bend: [0, 0, -1], bone: 'b', join: 0.05 }), end = T.segs.at(-1);
    expect(end[3]).toBeCloseTo(0.04, 6); expect(T.segs[0][2]).toBeCloseTo(0.2, 6);
    expect(end[1].z).toBeLessThan(-0.1);
    expect(eggDistance(T, [0.5, 0, 0])).toBeLessThan(0); expect(eggDistance(T, [0, 0.5, 0])).toBeGreaterThan(0);
  });

  it('the coat refuses more strokes than its budget (few strokes, well placed)', () => {
    const many = [{ name: 'm', group: 'Patch', strokes: Array.from({ length: FEATURE_COAT.budget + 1 }, () => ({ points: [[0, 0, 0], [0, 0, 1]], r: [0.1, 0.01] })) }];
    expect(strokesOf(many)).toBe(FEATURE_COAT.budget + 1);
    expect(() => coatLayers({ V: [], F: [], field: () => 1, shapes: [], weights: () => ({}) }, many)).toThrow(/budget/);
  });

  it('the skin: one closed sound surface; each point\'s weights sum to one, on bones whose eggs are near it', () => {
    const build = Object.values(FEATURE_BUILDS)[0], h = 0.3;
    const eggs = build.eggs.filter((x) => !/R$/.test(x.name)).map((x) => egg({ ...x, c: x.c.map((v) => v * h), r: x.r.map((v) => v * h), join: x.join * h }));
    const S = eggSkin(eggs, { cell: 0.012, faces: 3000, zones: [{ name: 'nose', group: 'Nose', eggs: ['nose'] }] }), F = Object.values(S.mesh.faces), uses = new Map();
    for (const t of F) for (let a = 0; a < 3; a++) { const k = [t[a], t[(a + 1) % 3]].sort().join('|'); uses.set(k, (uses.get(k) ?? 0) + 1); }
    expect(F.length).toBeGreaterThan(1500);
    expect([...uses.values()].every((n) => n === 2)).toBe(true);
    for (const [id, p] of Object.entries(S.mesh.points)) {
      const w = S.blend[`st0.${id}`], sum = Object.values(w).reduce((s, x) => s + x, 0);
      expect(Math.abs(sum - 1), id).toBeLessThan(1e-6);
      for (const bone of Object.keys(w)) expect(Math.min(...eggs.filter((E) => E.bone === bone).map((E) => eggDistance(E, p) / E.join)), `${id} ${bone}`).toBeLessThan(4);
    }
    // (a zone cut into the skin: the nose's faces are the nose's, its edge a line of points on the skin)
    expect(Object.values(S.mesh.groups)).toContain('Nose');
    expect(eggField(eggs).weights(eggs[0].c)).toEqual({ head: 1 });
    // (the SEAM: where a head shape meets a body shape the blend is tighter, so the surface there sinks into a crease; two
    // body shapes blend as their joins say)
    const pair = (bone) => [egg({ c: [0, 0, 0.3], u: [0, 0, 1], r: [0.2, 0.2, 0.2], bone: 'head', join: 0.1 }), egg({ c: [0, 0, 0], u: [0, 0, 1], r: [0.2, 0.2, 0.2], bone, join: 0.1 })];
    const P = { x: 0.15, y: 0, z: 0.15 };
    expect(eggField(pair('torso'), { seam: 0.01 }).field(P)).toBeGreaterThan(eggField(pair('torso')).field(P) + 1e-3);
    expect(eggField(pair('head'), { seam: 0.01 }).field(P)).toBeCloseTo(eggField(pair('head')).field(P), 9);
  });

  it('a feature-style sheet compiles to the skin on the mascot\'s rig, shaded smooth; any other style as it did', () => {
    const sheet = rollMascot({ brief: 'raccoon', facets: { style: 'feature' } }), P = mascotPlanFromSheet(sheet), plan = P.create.spec.plan;
    expect(P.create.spec.smooth).toBe(true); expect(P.create.spec.toon).toBeUndefined();
    expect(plan.segments[0]).toMatchObject({ name: 'skin', kind: 'mesh' });
    const bound = new Set(Object.values(plan.segments[0].bind.blend).flatMap((w) => Object.keys(w)));
    for (const b of ['pelvis', 'torso', 'head', 'thighR', 'thighL', 'upperArmL', 'handR', 'metaL']) expect(bound.has(b), b).toBe(true);
    expect(Object.keys(plan.clips)).toEqual(expect.arrayContaining(['idle', 'walk', 'blink', 'happy']));
    // THE FACE: each lid a shell about its globe, its chains turning it about the globe's centre (so it never leaves the
    // globe); the blink brings the upper lid's edge down to the lower's; the pupil on the globe about the gaze; the
    // brows on the skin; the mask painted round the eyes
    const seg = (n) => plan.segments.find((x) => x.name === n), at = (j) => plan.rig.joints[j].at, G = at('eyeCR');
    const dist = (p) => Math.hypot(p[0] - G[0], p[1] - G[1], p[2] - G[2]), globeR = Math.max(...Object.values(seg('globeR').mesh.points).map(dist));
    for (const n of ['lidR', 'lidLowR']) expect(Math.min(...Object.values(seg(n).mesh.points).map(dist)), n).toBeGreaterThan(globeR * 1.03);
    for (const c of ['lidR', 'lidLowR', 'lidTiltR', 'browLiftR', 'browR']) expect(plan.rig.chains[c].links[0].pivot, c).toBe('eyeCR');
    const blink = plan.clips.blink[1], up = FEATURE_EYE.upper, low = FEATURE_EYE.lower;
    expect(blink.lidR).toBeGreaterThan(0); expect(blink.lidR).toBeLessThan((up[1] - up[0]) * 1.6 + low - up[1]);
    const gaze = ((t) => { const d = t.map((x, i) => x - G[i]), l = Math.hypot(...d); return d.map((x) => x / l); })(at('eyeTipR'));
    const pupil = Object.entries(seg('globeR').mesh.faces).filter(([f]) => seg('globeR').mesh.groups[f] === 'Pupil').flatMap(([, t]) => t.map((v) => seg('globeR').mesh.points[v]));
    expect(pupil.length).toBeGreaterThan(20);
    for (const p of pupil) { expect(Math.abs(dist(p) - globeR)).toBeLessThan(globeR * 0.02); expect(p.reduce((s, x, i) => s + (x - G[i]) * gaze[i], 0) / globeR).toBeGreaterThan(Math.cos(FEATURE_EYE.pupil * Math.PI / 180) - 0.01); }
    // THE COAT: zones cut into the skin (the paws dark, the belly pale), the markings thin open layers over it (the mask, the
    // tail's rings), each layer's points just off the skin, within the stroke budget
    const groups = Object.values(plan.segments[0].mesh.groups);
    expect(groups.filter((g) => g === 'Patch').length).toBeGreaterThan(100); expect(groups.filter((g) => g === 'Belly').length).toBeGreaterThan(300);
    for (const n of ['coatMask', 'coatStripe', 'coatEars', 'coatRings']) expect(seg(n), n).toMatchObject({ kind: 'mesh', closure: 'open' });
    expect(seg('coatMask').group).toBe('Patch');
    // THE MOUTH, integrated: the line and the open mouth thin open layers on the muzzle, shut at rest (the rest's smile, no
    // opening), opened down by its own bone (joy), its corners on theirs
    for (const n of ['mouthLine', 'mouthOpen']) expect(seg(n), n).toMatchObject({ kind: 'mesh', closure: 'open', group: 'Mouth' });
    expect(Object.values(seg('mouthOpen').mesh.groups)).toContain('Tongue');
    expect(plan.clips.joy[1].jawOpen).toBeGreaterThan(15); expect(plan.clips.sad[1].mouthCornerR).toBeLessThan(0);
    expect(plan.rig.chains.jawOpen.links[0].pivot).toBe('mouthC');
    // THE FINGERS: two bones each, riding the hand, and the skin weighted to them
    for (const b of ['digit1aR', 'digit5bL']) expect(plan.rig.bones.some((x) => x.id === b), b).toBe(true);
    for (const b of ['digit3bR', 'digit2aL']) expect(bound.has(b), b).toBe(true);
    // A DEFAULT GAME MODEL: every part's faces together within the budget; round the belly no clip hangs an arm into it
    expect(plan.segments.reduce((n, x) => n + Object.keys(x.mesh?.faces ?? {}).length, 0)).toBeLessThanOrEqual(FEATURE_TRIANGLES);
    for (const keys of Object.values(plan.clips).map((c) => (Array.isArray(c) ? c : c.keys ?? []))) for (const K of keys) for (const [a, s] of [['armR', 1], ['armL', -1]]) if (K?.[a]?.x !== undefined) expect((s * K[a].x) / Math.hypot(K[a].x, K[a].y, K[a].z)).toBeGreaterThan(0.6);
    const toon = mascotPlanFromSheet(rollMascot({ brief: 'raccoon' }));
    expect(toon.create.spec).toMatchObject({ hullShade: true, toon: { light: true } });
    expect(toon.create.spec.plan.segments.some((s) => s.kind === 'mesh')).toBe(false);
  }, 120_000);
});
