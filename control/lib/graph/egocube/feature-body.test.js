// The feature body (feature-body.js) and its face (feature-face.js): the laws of one skin of eggs, on the one build there
// is (the raccoon's family). An egg's fat end is its short end; a tuft is round at its root and a rounded point at its
// tip; the skin is one closed, sound surface; every point's weights sum to one and name only bones whose eggs are near
// it; the mascot sheet in the feature style compiles to that skin on the mascot's rig, shaded smooth, its lids shells
// turning about their globes; a sheet in any other style compiles as it did.
import { describe, it, expect } from 'vitest';
import { egg, eggDistance, eggField, eggSkin, tuft, FEATURE_BUILDS, FEATURE_TRIANGLES, FEATURE_CARRIAGE, featureShapes } from './feature-body.js';
import { speciesTail } from './feature-function.js';
import { pieces, attachAll, gapOf } from './feature-attach.js';
import { resolveTune } from './feature-tune.js';
import { animalCard } from './mascot-animals.js';
import { FEATURE_EYE } from './feature-face.js';
import { FEATURE_COAT, strokesOf, coatLayers } from './feature-coat.js';
import { rollMascot } from './mascot.js';
import { mascotPlanFromSheet } from './mascot-form.js';
import { validateRig, rigNodesAt } from '../polygonizer/station-loft-rig.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { featureBuild, PLAN_OF, PLANS, FEATURE_EXCLUDES } from './feature-grammar.js';
import { SPECIES } from '../fauna/species.js';

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
    const S = eggSkin(eggs, { cell: 0.01, faces: 3000, zones: [{ name: 'nose', group: 'Nose', eggs: ['nose'] }] }), F = Object.values(S.mesh.faces), uses = new Map();
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
    // (on all fours the arms reach down to the floor, the trunk hinged out of their way)
    for (const keys of Object.entries(plan.clips).filter(([n]) => !['fours', 'prowl', 'downDog', 'gallop'].includes(n)).map(([, c]) => (Array.isArray(c) ? c : c.keys ?? []))) for (const K of keys) for (const [a, s] of [['armR', 1], ['armL', -1]]) if (K?.[a]?.x !== undefined) expect((s * K[a].x) / Math.hypot(K[a].x, K[a].y, K[a].z)).toBeGreaterThan(0.6);
    // ON ALL FOURS, posed on the rig: the forepaws at the floor, the hind feet planted, the head held up to look ahead
    const R = validateRig(expandPlan(plan).rig), { nodes } = rigNodesAt(R, plan.clips.fours[1]), height = plan.mascot.height;
    for (const S of ['R', 'L']) { expect(Math.abs(nodes[`knuckles${S}`][2]), S).toBeLessThan(0.08 * height); expect(nodes[`toeBase${S}`][2]).toBeLessThan(0.03 * height); }
    const crown = nodes.headTop.map((v, k) => v - nodes.headBase[k]);
    expect(crown[2] / Math.hypot(...crown)).toBeGreaterThan(0.8);
    expect(plan.clips.prowl.length).toBe(plan.clips.walk.length);
    // THE DOWNWARD DOG, posed on the rig: the forepaws on the floor out in front, straight forward (no share to the side),
    // the hind feet planted, the chest bent down under the hips
    const dog = rigNodesAt(R, plan.clips.downDog[1]).nodes;
    for (const S of ['R', 'L']) {
      expect(Math.abs(dog[`knuckles${S}`][2]), S).toBeLessThan(0.05 * height); expect(dog[`toeBase${S}`][2]).toBeLessThan(0.03 * height);
      const arm = dog[`knuckles${S}`].map((v, k) => v - dog[`shoulder${S}`][k]);
      expect(Math.abs(arm[0]) / Math.hypot(...arm), S).toBeLessThan(0.15); expect(arm[1], S).toBeGreaterThan(0);
    }
    expect(dog.navel[2] - dog.neckHub[2]).toBeGreaterThan(0.08 * height);
    // (FACING FORWARD: the crown near upright, the face looking ahead, not hung between the arms)
    const crownTip = (n) => (Math.atan2(n.headTop[1] - n.headBase[1], n.headTop[2] - n.headBase[2]) * 180) / Math.PI;
    expect(Math.abs(crownTip(dog))).toBeLessThan(30);
    // THE GALLOP, the dog its base: the run's cycle, the waist rounding at the gather and opening at the extension, the
    // forelegs swinging, the face ahead throughout, the forepaws reaching the floor
    const gal = plan.clips.gallop;
    expect(gal.length).toBe(plan.clips.run.length);
    expect(Math.max(...gal.map((k) => k.waist)) - Math.min(...gal.map((k) => k.waist))).toBeGreaterThan(5);
    const posed = gal.map((k) => rigNodesAt(R, k).nodes), paw = posed.map((n) => n.knucklesR[1] - n.shoulderR[1]);
    expect(Math.max(...paw) - Math.min(...paw)).toBeGreaterThan(0.08 * height);
    // (the face ahead, a little down, never tipped up: FEATURE_LOOK; the tail out of the rump, not up the back)
    for (const n of posed) { expect(crownTip(n)).toBeGreaterThan(5); expect(crownTip(n)).toBeLessThan(30); }
    // (0.1: at the strike the trunk tips forward and the rump rises with it, the root still behind the hips)
    for (const n of posed) { expect(n.tailRoot[2] - n.pelvisHub[2]).toBeLessThan(0.1 * height); expect(n.tailRoot[1]).toBeLessThan(n.pelvisHub[1] - 0.1 * height); }
    // (THE STRIKE: one key the trunk tipped forward, the front low on both forepaws, the rump raised, the tail held back
    // near level for balance, the face ahead)
    const slope = (n) => (Math.atan2(n.neckHub[2] - n.pelvisHub[2], n.neckHub[1] - n.pelvisHub[1]) * 180) / Math.PI;
    const strike = posed.reduce((a, n) => (slope(n) < slope(a) ? n : a));
    expect(slope(strike)).toBeLessThan(Math.max(...posed.map(slope)) - 8);
    for (const S of ['R', 'L']) expect(strike[`knuckles${S}`][2], S).toBeLessThan(0.05 * height);
    const runTail = (n) => (Math.atan2(n.tailTip[2] - n.tailRoot[2], -(n.tailTip[1] - n.tailRoot[1])) * 180) / Math.PI;
    for (const n of posed) { expect(runTail(n)).toBeGreaterThan(FEATURE_CARRIAGE.run.least - 2); expect(runTail(n)).toBeLessThan(FEATURE_CARRIAGE.run.most + 2); }
    // (and straight: the tail's far half, on its own bone from the middle, in line with the near half)
    const half = (a, b) => (Math.atan2(b[2] - a[2], -(b[1] - a[1])) * 180) / Math.PI;
    for (const n of posed) expect(Math.abs(half(n.tailMid, n.tailTip) - half(n.tailRoot, n.tailMid))).toBeLessThan(3);
    expect(plan.rig.bones.some((b) => b.id === 'tailEnd')).toBe(true);
    for (const n of ['idle', 'blink']) for (const k of plan.clips[n]) expect(k.tailEnd, n).toBeUndefined();
    // (the tail's ring pattern a layer riding the tail's bones rigidly, each point one bone: it never stretches)
    const rings = plan.segments.find((x) => x.name === 'coatRings');
    expect(rings).toBeTruthy();
    for (const w of Object.values(rings.bind.blend)) { const b = Object.keys(w); expect(b.length).toBe(1); expect(['tail', 'tailEnd']).toContain(b[0]); }
    expect(Math.min(...posed.map((n) => n.knucklesR[2]))).toBeLessThan(0.05 * height);                // (the strike)
    expect(Math.max(...posed.map((n) => n.knucklesR[2]))).toBeGreaterThan(0.06 * height);             // (swung through the air)
    expect(Math.min(...posed.map((n) => n.toeBaseR[1] - n.hipR[1]))).toBeLessThan(-0.1 * height);     // (the hind legs tilted back)
    // AS A REGULAR ANIMAL ON ALL FOURS: the spine level from the hips to the neck's root, the tail carried behind at its
    // animal's carriage (the roster's), a share back toward the mascot's own; standing, the tail as designed (no turn)
    const fours = rigNodesAt(R, plan.clips.fours[1]).nodes, rise = (a, b) => (Math.atan2(b[2] - a[2], Math.abs(b[1] - a[1])) * 180) / Math.PI;
    expect(Math.abs(rise(fours.pelvisHub, fours.neckHub))).toBeLessThan(15);
    const tailRise = (n) => (Math.atan2(n.tailTip[2] - n.tailRoot[2], -(n.tailTip[1] - n.tailRoot[1])) * 180) / Math.PI;
    const real = speciesTail('raccoon') ?? FEATURE_CARRIAGE.none, mascot = tailRise(rigNodesAt(R, { ...plan.clips.fours[1], tail: 0 }).nodes);
    expect(tailRise(fours)).toBeCloseTo(real + FEATURE_CARRIAGE.keep * (mascot - real), 0);
    expect(tailRise(fours)).toBeLessThan(45); expect(mascot).toBeGreaterThan(90);         // (uncarried, it would aim over the back)
    for (const n of ['idle', 'blink', 'happy']) for (const k of plan.clips[n]) expect(k.tail, n).toBeUndefined();
    // (standing, the legs straight: no standing pose bends a knee; on all fours the hind legs keep their bend)
    for (const n of ['idle', 'blink', 'happy']) for (const k of plan.clips[n]) { expect(k.crouch ?? 0, n).toBe(0); expect(k.stance ?? 1, n).toBe(1); }
    expect(Math.max(...plan.clips.fours.map((k) => k.crouch ?? 0))).toBeGreaterThan(0);
    const toon = mascotPlanFromSheet(rollMascot({ brief: 'raccoon' }));
    expect(toon.create.spec).toMatchObject({ hullShade: true, toon: { light: true } });
    expect(toon.create.spec.plan.segments.some((s) => s.kind === 'mesh')).toBe(false);
  }, 120_000);

  it('the attachment rule: every shape attached to the body or to something attached to it, a piece apart moved to it', () => {
    // (one species per family, chosen in code, as designed and at the gen7 tier: its shapes one piece once laid out)
    const fams = {}; for (const [id, sp] of Object.entries(SPECIES)) if (!FEATURE_EXCLUDES.includes(sp.family)) fams[sp.family] ??= id;
    let movedAny = false;
    for (const id of Object.values(fams)) for (const tune of [null, resolveTune({ detail: 'gen7' })]) {
      const { L, moved } = featureShapes(featureBuild(animalCard(id), tune ? { tune } : {}));
      expect(pieces(L.eggs, { seam: L.seam }).length, `${id}${tune ? ' gen7' : ''}`).toBe(1);
      movedAny ||= moved.length > 0;
    }
    expect(movedAny).toBe(true);                                                   // (the rule did work somewhere)
    // (a piece set apart on purpose is brought back, whole, and only as far as it must be: its shape kept)
    const a = egg({ name: 'belly', c: [0, 0, 0.5], u: [0, 0, 1], r: [0.3, 0.3, 0.3], bone: 'pelvis', join: 0.05 });
    const b = egg({ name: 'tail0', c: [0, -0.6, 0.5], u: [0, -1, 0], r: [0.1, 0.1, 0.1], bone: 'pelvis', join: 0.05 });
    const { shapes, moved } = attachAll([a, b]);
    expect(moved).toHaveLength(1); expect(pieces(shapes).length).toBe(1);
    expect(shapes[1].r).toEqual(b.r); expect(shapes[0]).toBe(a);
    expect(gapOf(shapes[0], shapes[1])).toBeGreaterThan(-0.05);                   // (set in by a margin, not swallowed)
    expect(attachAll([a, egg({ ...b, c: [0, -0.35, 0.5], u: [0, -1, 0], r: b.r, join: 0.05 })]).moved).toHaveLength(0);
  });

  it('a long neck turns at its top; a striped coat\'s and a reticulated coat\'s markings are cut into the skin within the budget', async () => {
    const find = (pred) => Object.keys(SPECIES).find((id) => { try { return pred(animalCard(id).kit); } catch { return false; } });
    const g = mascotPlanFromSheet(rollMascot({ facets: { style: 'feature', animal: find((k) => k.neck === 'long') } })).create.spec.plan, J = g.rig.joints;
    const neckBone = J.headBase.at[2] - J.neckHub.at[2], headBone = J.headTop.at[2] - J.headBase.at[2];
    expect(neckBone).toBeGreaterThan(headBone);                                   // (the neck's bone spans the neck)
    const z = mascotPlanFromSheet(rollMascot({ facets: { style: 'feature', animal: find((k) => k.pattern === 'stripes') } })).create.spec.plan;
    expect(z.segments.some((x) => x.name === 'stripes')).toBe(false);             // (a zone, no layer laid over the skin)
    expect(Object.values(z.segments.find((x) => x.name === 'skin').mesh.groups)).toContain('Patch');
    expect(z.segments.reduce((n, x) => n + Object.keys(x.mesh?.faces ?? {}).length, 0)).toBeLessThanOrEqual(FEATURE_TRIANGLES);
    // (a giraffe's network of patches: cut into the skin in its own colour, the roster's, within the budget)
    const gid = find((k) => k.pattern === 'reticulated') ?? Object.keys(SPECIES).find((id) => PLAN_OF[SPECIES[id].family] === 'hoofed' && featureBuild(animalCard(id)).marks.some((m) => m.name === 'network'));
    const gp = mascotPlanFromSheet(rollMascot({ facets: { style: 'feature', animal: gid } })).create.spec.plan;
    expect(Object.values(gp.segments.find((x) => x.name === 'skin').mesh.groups)).toContain('Spot');
    expect(gp.palette.Spot).toBe(SPECIES[gid] && (await import('../fauna/species.js')).speciesParams(gid).colors.ashAlt);
    expect(gp.segments.reduce((n, x) => n + Object.keys(x.mesh?.faces ?? {}).length, 0)).toBeLessThanOrEqual(FEATURE_TRIANGLES);
  }, 180000);

  it('every plan\'s skin is closed: a pinch the net lets go is fanned shut on the surface', () => {
    // (one species per plan, chosen in code; its minted skin: every edge two faces')
    const pick = (pl) => Object.keys(SPECIES).find((id) => PLAN_OF[SPECIES[id].family] === pl && !FEATURE_EXCLUDES.includes(SPECIES[id].family));
    for (const pl of Object.keys(PLANS)) {
      const id = pick(pl), plan = mascotPlanFromSheet(rollMascot({ facets: { style: 'feature', animal: id } })).create.spec.plan;
      const skin = plan.segments.find((x) => x.name === 'skin').mesh, uses = new Map();
      for (const t of Object.values(skin.faces)) for (let a = 0; a < 3; a++) { const k = [t[a], t[(a + 1) % 3]].sort().join('|'); uses.set(k, (uses.get(k) ?? 0) + 1); }
      expect([...uses.values()].filter((n) => n !== 2).length, `${pl}: ${id}`).toBe(0);
      // (and ONE piece: nothing floats apart from the body)
      const up = new Map(), find = (x) => { while (up.get(x) !== x) x = up.get(x); return x; };
      for (const t of Object.values(skin.faces)) for (const v of t) if (!up.has(v)) up.set(v, v);
      for (const t of Object.values(skin.faces)) { const a = find(t[0]); for (const v of t.slice(1)) up.set(find(v), a); }
      expect(new Set([...up.keys()].map(find)).size, `${pl}: ${id} in one piece`).toBe(1);
    }
  }, 180000);
});
