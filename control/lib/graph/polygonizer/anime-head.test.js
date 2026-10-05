/** The anime head (anime-head.js): the studio's head, registered and made wearable. Its words compose; every part closes;
 * it sits where the landmark head sits; a hero wears it through the rig gates; the landmark path is untouched. */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { animeHead, animeHairCoverage, animeCoverageWarnings, animeRecipe, animeLockPart, resolveAnimeFace, validateAnimeFace, animeFaceWarnings, resolveAnimeHair, validateAnimeHair, animeHairWarnings, resolveAnimeExpression, validateAnimeExpression, ANIME_FACE_KEYS, ANIME_POSES, ANIME_HAIR_BASE, ANIME_HAIR_FORM_WORDS, ANIME_HAIR_MOVES, animeHairForm } from './anime-head.js';
import { ANIME_SCULPT, ANIME_SCULPT_KEYS, GRAPHIC_BASE, FEATURE_BANDS, resolveAnimeSculpt, validateAnimeSculpt, sparseSculpt, sculptBuild, animeSculptWarnings } from './anime-sculpt.js';
import { resolveToonLight } from './vexar.js';
import { buildAnime, animeFresh, animeReadRecipe } from './anime-form.js';
import { REGISTRATION } from './humanoid-head-fit.js';
import { humanoidHead } from './humanoid-head.js';
import { humanoidPlan } from './humanoid-plan.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { validateRig, bindLayered, auditRig, layeredClip } from './station-loft-rig.js';
import { layeredExposure } from './station-loft-exposure.js';

const failures = (m) => Object.entries(auditLayered(m)).filter(([, r]) => !r.pass).map(([n, r]) => `${n} b${r.boundaryEdges} nm${r.nonManifold} w${r.windingErrors} d${r.degenerate}`);
const volume = (mesh, part) => { let v = 0; mesh.faces.forEach((f) => { if (mesh.provenance[f[0]].part !== part) return; const [a, b, c] = f.map((i) => mesh.vertices[i]); v += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]); }); return v / 6; };

describe('anime head: the words', () => {
  it('face: 1 is the base; ratios compose by product, the lift by sum; the recipe is the studio slider', () => {
    const F = resolveAnimeFace([{ eyeHeight: 1.1, tilt: 0.02 }, { eyeHeight: 1.1, tilt: 0.01 }, { eyes: 1.05 }]);
    expect(F.eyeHeight).toBeCloseTo(1.1 * 1.1 * 1.05, 6); expect(F.tilt).toBeCloseTo(0.03, 9); expect(F.eyeWidth).toBe(1.05);
    // `sculpt: false` is the studio's face: the words are its sliders
    const r = animeRecipe({ preset: 'male', face: { nose: 1.1, tilt: -0.02 }, sculpt: false });
    expect(r.face.nose).toBeCloseTo(1.1, 12); expect(r.face.tilt).toBeCloseTo(0.015, 12); expect(r.face.iris).toBe(0.88); expect(r.sculpt).toBeUndefined();
    expect(animeReadRecipe(r)).toEqual(r);   // a head's recipe is a recipe the studio loads
    // mojulo's anime base: the studio's with the chin set back (ANIME_BASE_ADJUST); otherwise the studio's fresh design
    const fresh = animeFresh('female'); fresh.face.chinProjection = 0.8;
    expect(animeRecipe({ preset: 'female', sculpt: false })).toEqual(fresh); expect(animeRecipe({ preset: 'male', sculpt: false }).face.chinProjection).toBeCloseTo(0.8, 12);
    // the male base is carried at 3° chin up (the studio's 6°, headPitch 1, less 0.25 of its 12° per unit)
    expect(animeRecipe({ preset: 'male', sculpt: false }).face.headPitch).toBe(0.75); expect(animeRecipe({ preset: 'female', sculpt: false }).face.headPitch).toBe(1);
    // the graphic face (the default): the base's face layer under the words, its sculpt beside them
    const g = animeRecipe({ preset: 'male', face: { nose: 1.1 } });
    expect(g.face.nose).toBeCloseTo(GRAPHIC_BASE.male.face.nose * 1.1, 12); expect(g.face.eyeHeight).toBeCloseTo(GRAPHIC_BASE.male.face.eyeHeight, 12);
    expect(g.sculpt).toEqual(sculptBuild('male', resolveAnimeSculpt({}))); expect(g.sculpt.mouthWidth).toBe(2.2);
    expect(validateAnimeFace({ jawWidth: 1.1 })[0]).toMatch(/unknown control/); expect(validateAnimeFace({ tilt: -0.05 })).toEqual([]);
    expect(animeFaceWarnings(resolveAnimeFace({ nose: 1.8 }), 'female', { sculpt: false })[0]).toMatch(/face\.nose 1\.8 .*studio's slider/);
    // under the graphic face the slider read is the layer times the word, the range widened by the layer: the male
    // layer sits at the studio's eye-height floor, so a narrower opening still builds without advice
    expect(animeFaceWarnings(resolveAnimeFace({ nose: 1.8 }), 'female')).toEqual([]); expect(animeFaceWarnings(resolveAnimeFace({ nose: 3 }), 'female')[0]).toMatch(/face\.nose 3 puts the studio's slider at 1\.8,/);
    expect(animeFaceWarnings(resolveAnimeFace('narrow-eyes'), 'male')).toEqual([]); expect(animeFaceWarnings(resolveAnimeFace('narrow-eyes'), 'male', { sculpt: false })).toEqual([]);
    expect(ANIME_FACE_KEYS.length).toBe(23);
  });
  it('hair: a family word, controls, per-clump locks (summed per axis); advice past the studio', () => {
    const H = resolveAnimeHair(['short', { length: 1.1, sweep: 0.1, locks: { 'fringe-3': { ty: -0.05 } } }, { sweep: 0.05, locks: { 'fringe-3': { ty: -0.05, tx: 0.02 } } }]);
    expect(H).toMatchObject({ style: 'short', length: 1.1, sweep: 0.15, locks: { 'fringe-3': { ty: -0.1, tx: 0.02 } } });
    expect(resolveAnimeHair(null).style).toBeNull();
    expect(validateAnimeHair('mohawk')[0]).toMatch(/unknown anime family 'mohawk'/);
    expect(validateAnimeHair({ locks: { 'fringe-9': { ty: 1 } } })[0]).toMatch(/not a clump/);
    expect(validateAnimeHair({ locks: { 'back-2': { wobble: 1 } } })[0]).toMatch(/not a lock edit/);
    // a lock edit is bounded like the sweep fields: 1e308 used to validate and then throw a TypeError in the plan
    expect(validateAnimeHair({ style: 'bob', locks: { 'fringe-1': { ty: 1e308 } } })).toEqual(["hair.locks.fringe-1.ty: 1e+308 is past ±3 construction units (the studio's own edits stay within ±0.2)"]);
    expect(validateAnimeHair({ locks: { 'fringe-1': { tx: -3.5 } } })[0]).toMatch(/fringe-1\.tx: -3\.5 is past ±3/);
    expect(validateAnimeHair({ locks: { 'fringe-1': { tx: -3, ty: 2.9 } } })).toEqual([]);
    for (const [w, m] of Object.entries(ANIME_HAIR_MOVES)) expect(validateAnimeHair(m.hair ? { ...m.hair } : w), w).toEqual([]);   // every built-in move's edits pass
    expect(animeHairWarnings(resolveAnimeHair(['bob', { locks: { 'crown-1-0': { tx: 0.3 } } }]))).toEqual([expect.stringMatching(/only the short family/), expect.stringMatching(/past the studio's ±0\.2/)]);
    expect(animeLockPart('left-temple-2')).toBe('hairTempleL2'); expect(animeLockPart('crown--1-0')).toBe('hairCrownL0');
  });
  it('expression: a pose resets, amounts adjust', () => {
    expect(resolveAnimeExpression(['smile', { brow: -0.2 }])).toEqual({ blink: 0.12, smile: 1, open: 0, brow: -0.2 });
    expect(validateAnimeExpression('furious')[0]).toMatch(/unknown anime pose/);
  });
});

describe('anime head: the geometry', () => {
  const CASES = [];
  for (const preset of ['female', 'male']) for (const hair of ['bob', 'short', 'long', 'none']) CASES.push({ preset, hair });
  for (const expression of ['blink', 'smile', 'open']) CASES.push({ preset: 'female', expression }, { preset: 'male', expression, register: 'lowpoly' });
  CASES.push({ preset: 'female', sculpt: false }, { preset: 'male', hair: 'short', expression: 'smile', register: 'lowpoly', sculpt: false });   // the studio's face
  CASES.push({ preset: 'male', face: resolveAnimeFace(Object.fromEntries(ANIME_FACE_KEYS.map((k) => [k, k === 'tilt' ? 0.08 : 1.15]))), hair: { style: 'long', locks: { 'back-5': { tx: -0.2, ty: 0.2 } } } });
  CASES.push({ preset: 'female', face: resolveAnimeFace(Object.fromEntries(ANIME_FACE_KEYS.map((k) => [k, k === 'tilt' ? -0.08 : 0.88]))), hair: ['short', { sweep: -0.3, part: 0.18 }] });
  for (const spec of CASES) it(`closed, outward, symmetric where asked, the eyes read: ${JSON.stringify(spec).slice(0, 90)}`, () => {
    const h = animeHead(spec), mesh = compileLayered(h);
    expect(failures(mesh)).toEqual([]);
    for (const p of Object.keys(h.parts)) expect(volume(mesh, p), p).toBeGreaterThan(0);
    if (spec.expression !== 'blink') { const ex = layeredExposure(mesh, { res: 256 }); for (const e of ['irisR', 'irisL']) expect(ex.parts[e].flag).toBe('reads'); }
    expect(Object.keys(h.parts).filter((k) => h.parts[k].layer === 1)).toEqual(['cranium']);
  });
  it('registered where the landmark head sits: crown to chin, the chin at the menton', () => {
    for (const preset of ['female', 'male']) {
      const h = animeHead({ preset, hair: 'none' }), R = REGISTRATION[preset];
      expect(h.landmarks.crown[2] - h.landmarks.menton[2]).toBeCloseTo(R.height, 5); expect(h.landmarks.menton[2]).toBeCloseTo(R.menton, 5); expect(h.chinZ).toBeCloseTo(R.menton, 5);
      expect(Math.abs(h.landmarks.crown[0])).toBeLessThan(0.01); expect(h.landmarks.eyeR[0]).toBeCloseTo(-h.landmarks.eyeL[0], 9);
      const land = humanoidHead({ preset, hair: 'none' }).landmarks;
      expect(Math.abs(h.landmarks.menton[2] - land.menton[2])).toBeLessThan(0.002);
    }
  });
  it('the parts are the studio parts: every clump is its own part, named by the studio clump', () => {
    const h = animeHead({ preset: 'male', hair: 'short' }), model = buildAnime(animeRecipe({ preset: 'male', hair: 'short' }));
    expect(model.locks.map((l) => animeLockPart(l.name)).every((n) => h.parts[n])).toBe(true);
    // the graphic face (the default) names its ink by key: the lower rim, the lid band, the brow block, the nose line, and
    // the catchlight a lens; the studio's face ranks its three ribbons by height (brow, lash, lower rim)
    const face = (x) => Object.keys(x.parts).filter((k) => !k.startsWith('hair')).sort();
    expect(face(h)).toEqual(['browL', 'browR', 'catchL', 'catchR', 'cranium', 'earL', 'earR', 'face', 'irisL', 'irisR', 'lashLowL', 'lashLowR', 'lidL', 'lidR', 'noseLine', 'pupilL', 'pupilR']);
    const studio = animeHead({ preset: 'male', hair: 'short', sculpt: false });
    expect(face(studio)).toEqual(['browL', 'browR', 'cranium', 'earL', 'earR', 'face', 'irisL', 'irisR', 'lashL', 'lashLowL', 'lashLowR', 'lashR', 'pupilL', 'pupilR']);
    for (const p of ['face', 'earR', 'earL', 'irisR', 'irisL', 'pupilR', 'pupilL', 'browR', 'browL', 'lashR', 'lashL', 'lashLowR', 'lashLowL', 'hairCap']) expect(studio.parts[p], p).toBeTruthy();
    expect(new Set(Object.values(h.parts.face.groups))).toEqual(new Set(['Skin', 'Sclera', 'Mouth']));
    expect(animeHead({ preset: 'male', hair: 'none' }).parts.hairCap).toBeUndefined();
  });
  it('the head scale scales the core, the offsets and the anchors together; the build is deterministic', () => {
    const a = animeHead({ preset: 'female' }), b = animeHead({ preset: 'female', scale: 1.2 });
    expect(b.landmarks.crown[2]).toBeCloseTo(a.landmarks.crown[2] * 1.2, 5); expect(b.measures.head_m).toBeCloseTo(a.measures.head_m * 1.2, 2);
    expect(JSON.stringify(animeHead({ preset: 'female' }))).toBe(JSON.stringify(a));
  });
  it("the hidden core stays inside the face: no core point is outside the face's box shrunk by 10 %", () => {
    const h = animeHead({ preset: 'male', hair: 'none' }), mesh = compileLayered(h);
    const pts = (part) => mesh.vertices.filter((_, i) => mesh.provenance[i].part === part);
    const face = pts('face'), lo = [0, 1, 2].map((k) => Math.min(...face.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...face.map((p) => p[k])));
    for (const p of pts('cranium')) for (let k = 0; k < 3; k++) { const m = 0.1 * (hi[k] - lo[k]); expect(p[k]).toBeGreaterThan(lo[k] + m); expect(p[k]).toBeLessThan(hi[k] - m); }
  });
});

describe('anime head: worn by the hero', () => {
  for (const [preset, extra] of [['female', {}], ['male', { register: 'lowpoly', hair: 'long', expression: 'smile', detail: 'clothed', adorn: 'ranger' }]]) {
    it(`${preset} ${JSON.stringify(extra)}: closed at rest and at lean 25, the rig gates hold`, () => {
      const plan = humanoidPlan({ preset, head: 'anime', ...extra }), recipe = expandPlan(plan), mesh = compileLayered(recipe);
      expect(failures(mesh)).toEqual([]); expect(failures(compileLayered(recipe, { lean: 25 }))).toEqual([]);
      const R = validateRig(recipe.rig), skin = bindLayered(mesh, recipe, R); for (const keys of Object.values(recipe.clips)) layeredClip(keys, R);
      const a = auditRig(mesh, skin, R, Object.values(recipe.clips).flat());
      expect(a.badWeights).toBe(0); expect(a.restIdentity).toBeLessThan(1e-9); expect(a.maxPlantedDrift).toBeLessThan(1e-9);
      expect(Object.keys(recipe.clips)).toEqual(['idle', 'walk', 'wave']);
      expect(recipe.rig.bones.some((b) => b.id === 'jaw')).toBe(false); expect(recipe.dials.jawOpen).toBeUndefined();
      expect(plan.include[0].faceMeasures.head_m).toBeGreaterThan(0.2); expect(plan.frame.note).toMatch(/the anime head \(Anime Form Studio/);
    });
  }
  it('the landmark head is untouched: its plan is the same with and without the anime head in the build', () => {
    const plan = humanoidPlan({ preset: 'female' });
    expect(plan.rig.bones.some((b) => b.id === 'jaw')).toBe(true); expect(plan.dials.lean.parts).toContain('jaw');
    expect(plan.include[0].faceMeasures).toBeUndefined();
  });
});

// hair-passes: the hair seats on the head it grows on. The studio's cap is a fixed ellipsoid and its clumps grow from
// fixed points; the fit lifts the cap off the head's own surface and drapes every clump outside the head's section.
describe('anime head: the hair fit (hair-passes)', () => {
  const worst = (h) => Math.max(...Object.values(h.hairCoverage.views));
  it('covers the scalp from every view on every family and both bases; the studio\'s own hair did not', () => {
    for (const preset of ['female', 'male']) {
      for (const hair of ['bob', 'short', 'long', 'hime']) expect(worst(animeHead({ preset, hair })), `${preset} ${hair}`).toBeLessThanOrEqual(0.02);
      const studio = animeHead({ preset, hair: 'bob', hairFit: false });
      expect(studio.hairCoverage.views.back).toBeGreaterThan(0.2);   // the bald oval at the occiput, measured
      expect(animeCoverageWarnings(studio.hairCoverage)[0]).toMatch(/the scalp shows from the back/);
    }
  });
  it('a close, thin head of hair still covers: sleek and the lowest volume stay within the advice', () => {
    for (const preset of ['female', 'male']) {
      expect(worst(animeHead({ preset, hair: ['bob', 'sleek'] }))).toBeLessThanOrEqual(0.05);
      expect(worst(animeHead({ preset, hair: ['short', { volume: 0.93 }] }))).toBeLessThanOrEqual(0.06);
    }
  });
  it('reads the face it sits on: with the fullest cheeks, deepest face and fullest occiput the clumps stay outside the head', () => {
    const extreme = { cheekVolume: 1.34, lowerCheekVolume: 1.22, depth: 1.18, foreheadDepth: 1.3, browDepth: 1.3, backDepth: 1.18, occiput: 1.25, width: 1.12 };
    for (const [hair, partsToCheck] of [[['bob', { strands: 1 }], ['hairTempleR0', 'hairTempleL1', 'hairBack3', 'hairBack6', 'hairFringe2', 'hairFringe4', 'hairFringe6']], ['bob', ['hairFormSideR', 'hairFormSideL', 'hairFormBackR', 'hairFormBackC', 'hairFormFringeC']]]) {
    const h = animeHead({ preset: 'male', face: extreme, hair }), mesh = compileLayered(h), V = mesh.vertices;
    const tris = mesh.faces.filter((f) => mesh.provenance[f[0]].part === 'face');
    const inside = (p) => { let n = 0; for (const [a, b, c] of tris) { const A = V[a], B = V[b], C = V[c], e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], d = [1, 1.23e-4, 5.7e-5];
      const hh = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * hh[0] + e1[1] * hh[1] + e1[2] * hh[2]; if (Math.abs(det) < 1e-15) continue;
      const sv = [p[0] - A[0], p[1] - A[1], p[2] - A[2]], u = (sv[0] * hh[0] + sv[1] * hh[1] + sv[2] * hh[2]) / det; if (u < 0 || u > 1) continue;
      const q = [sv[1] * e1[2] - sv[2] * e1[1], sv[2] * e1[0] - sv[0] * e1[2], sv[0] * e1[1] - sv[1] * e1[0]], v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det; if (v < 0 || u + v > 1) continue;
      if ((e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det > 0) n++; } return n % 2 === 1; };
    // the falling half of each clump (below its own median height): the root, by the studio's design, sits in the scalp
    // under the cap; what hangs must hang outside the head
    for (const part of partsToCheck) {
      const all = V.filter((_, i) => mesh.provenance[i].part === part), mid = [...all.map((p) => p[2])].sort((a, b) => a - b)[Math.floor(all.length / 2)];
      expect(all.length, part).toBeGreaterThan(0);
      const pts = all.filter((p) => p[2] < mid);
      expect(pts.filter(inside).length, part).toBe(0);
    }
    expect(worst(h)).toBeLessThanOrEqual(0.02);
    }
  });
  it('hime: a blunt fringe cut level at the brow, the front sidelocks squared at the jaw', () => {
    const lowest = (h, part) => { const m = compileLayered(h); return Math.min(...m.vertices.filter((_, i) => m.provenance[i].part === part).map((p) => p[2])); };
    const hime = animeHead({ preset: 'female', hair: 'hime' }), bob = animeHead({ preset: 'female', hair: ['bob', { strands: 1 }] });
    const spread = (h, parts) => { const z = parts.map((p) => lowest(h, p)); return Math.max(...z) - Math.min(...z); };
    expect(spread(hime, ['hairFormFringeL', 'hairFormFringeC', 'hairFormFringeR'])).toBeLessThan(0.006); expect(spread(bob, [1, 2, 3, 4, 5, 6, 7].map((i) => `hairFringe${i}`))).toBeGreaterThan(0.012);
    const jaw = lowest(hime, 'hairTempleR0'); expect(jaw).toBeGreaterThan(hime.landmarks.menton[2]); expect(jaw).toBeLessThan(hime.landmarks.stomion[2]);
    expect(lowest(hime, 'hairFormBackC')).toBeLessThan(hime.landmarks.menton[2] - 0.03);   // the long back
  });
  it('ahoge: one closed curl above the crown, an amount (0 is none), directed like any clump', () => {
    const h = animeHead({ preset: 'female', hair: ['bob', 'ahoge'] }), m = compileLayered(h);
    expect(failures(m)).toEqual([]); expect(h.parts.hairAhoge).toBeTruthy(); expect(animeHead({ preset: 'female' }).parts.hairAhoge).toBeUndefined();
    const top = (mesh) => Math.max(...mesh.vertices.filter((_, i) => mesh.provenance[i].part === 'hairAhoge').map((p) => p[2]));
    expect(top(m)).toBeGreaterThan(h.landmarks.crown[2] + 0.02);
    const bigger = compileLayered(animeHead({ preset: 'female', hair: ['bob', { ahoge: 1.5 }] })); expect(top(bigger)).toBeGreaterThan(top(m));
    const bent = animeHead({ preset: 'female', hair: ['bob', 'ahoge', { locks: { ahoge: { tx: 0.1 } } }] }); expect(bent.parts.hairAhoge.offsets).not.toEqual(h.parts.hairAhoge.offsets);
    expect(animeRecipe({ preset: 'female', hair: 'bob' }).hair.ahoge).toBeUndefined();   // the studio's recipe shape unless an ahoge grows
  });
});

// hair forms: the bob, long and hime families consolidate their clumps into sections (anime-form `forms`)
describe('anime head: the hair forms', () => {
  const hairParts = (h) => Object.keys(h.parts).filter((k) => k.startsWith('hair')).sort();
  it('the female families are a few sections, not a comb of strands; `strands: 1` is the studio\'s clumps', () => {
    const forms = ['hairCap', 'hairFormBackC', 'hairFormBackL', 'hairFormBackR', 'hairFormFringeC', 'hairFormFringeL', 'hairFormFringeR', 'hairFormSideL', 'hairFormSideR'];
    for (const fam of ['bob', 'long']) expect(hairParts(animeHead({ preset: 'female', hair: fam }))).toEqual(forms);
    expect(hairParts(animeHead({ preset: 'female', hair: 'hime' }))).toEqual([...forms, 'hairTempleL0', 'hairTempleR0'].sort());   // the hime's squared front sidelocks
    expect(hairParts(animeHead({ preset: 'female', hair: ['bob', { strands: 1 }] })).length).toBe(25);
    expect(hairParts(animeHead({ preset: 'male', hair: 'short' })).length).toBe(31);   // the short family stays spiky strands
  });
  it('a clump\'s lock edit moves only the sections it belongs to', () => {
    const a = animeHead({ preset: 'female', hair: 'long' }), b = animeHead({ preset: 'female', hair: ['long', { locks: { 'fringe-3': { ty: -0.1, tx: 0.05 } } }] });
    expect(Object.keys(a.parts).filter((k) => JSON.stringify(a.parts[k]) !== JSON.stringify(b.parts[k]))).toEqual(['hairFormFringeL', 'hairFormFringeC']);
  });
  it('each section ends in ONE point near its centre (a V hem); the hime is cut straight', () => {
    const lowestX = (h, part) => { const m = compileLayered(h), pts = m.vertices.filter((_, i) => m.provenance[i].part === part); return pts.reduce((b, p) => (p[2] < b[2] ? p : b))[0]; };
    const bob = animeHead({ preset: 'female', hair: 'bob' });
    expect(Math.abs(lowestX(bob, 'hairFormBackC'))).toBeLessThan(0.02);   // the centre back section points down the middle
    expect(lowestX(bob, 'hairFormBackR')).toBeGreaterThan(0.02); expect(lowestX(bob, 'hairFormBackL')).toBeLessThan(-0.02);
    const hemSpread = (h, part) => { const m = compileLayered(h), z = m.vertices.filter((_, i) => m.provenance[i].part === part).map((p) => p[2]).sort((x, y) => x - y); return z[Math.floor(z.length * 0.08)] - z[0]; };
    expect(hemSpread(bob, 'hairFormBackC')).toBeGreaterThan(hemSpread(animeHead({ preset: 'female', hair: 'hime' }), 'hairFormBackC'));
  });
});

// anime proportions: the body re-proportioned for the anime head (hero-form ANIME_CASTS)
describe('anime head: the body in anime proportions', () => {
  const measure = (opts) => {
    const plan = humanoidPlan(opts), mesh = compileLayered(expandPlan(plan)), z = mesh.vertices.map((p) => p[2]), H = Math.max(...z) - Math.min(...z);
    const face = mesh.vertices.filter((_, i) => mesh.provenance[i].part === (opts.head === 'anime' ? 'face' : 'cranium')).map((p) => p[2]);
    const headH = opts.head === 'anime' ? Math.max(...face) - Math.min(...face) : plan.include[0].parts.cranium.stations.at(-1).points.front[2] - plan.include[0].parts.jaw.stations[0].points.front[2];
    const torso = mesh.vertices.filter((_, i) => mesh.provenance[i].part === 'torso').map((p) => p[0]);
    return { heads: H / headH, inseam: (plan.joints.hip[2] - Math.min(...z)) / H, shoulders: (Math.max(...torso) - Math.min(...torso)) / headH, height: H };
  };
  it('about 6.5 heads tall on the female, 7 on the male; the inseam at half the height; narrower shoulders; the height kept', () => {
    const f = measure({ preset: 'female', head: 'anime' }), m = measure({ preset: 'male', head: 'anime' });
    expect(f.heads).toBeGreaterThan(6.35); expect(f.heads).toBeLessThan(6.65); expect(m.heads).toBeGreaterThan(6.85); expect(m.heads).toBeLessThan(7.15);
    expect(f.inseam).toBeGreaterThan(0.515); expect(m.inseam).toBeGreaterThan(0.505);
    expect(f.shoulders).toBeLessThan(1.62); expect(m.shoulders).toBeLessThan(2.05);
    expect(f.height).toBeGreaterThan(1.58); expect(m.height).toBeGreaterThan(1.69);
  });
  it("`proportions: 'hero'` keeps the realistic body under the anime head; the landmark head keeps its own by default", () => {
    const hero = measure({ preset: 'female', head: 'anime', proportions: 'hero' });
    expect(hero.heads).toBeGreaterThan(7.3);
    expect(humanoidPlan({ preset: 'female' }).frame.note).not.toMatch(/anime proportions/);
    expect(humanoidPlan({ preset: 'female', head: 'anime' }).frame.note).toBe(humanoidPlan({ preset: 'female', head: 'anime' }).frame.note);
  });
});

// the GRAPHIC FACE (anime-sculpt.js): the anime head's default; `sculpt: false` is the studio's face exactly
describe('anime head: the graphic face', () => {
  const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
  const faceLists = (h) => Object.fromEntries(Object.entries(h.parts).filter(([, p]) => p.layer === 2).map(([k, p]) => [k, JSON.stringify(p.faces)]));
  it("`sculpt: false` is the studio's face: the female's hash from before the graphic face; the male's the same once his rest carriage is carried back", () => {
    expect(hash(animeHead({ preset: 'female', sculpt: false }))).toBe('d54c4a169430908e');
    // re-pinned for the male base's rest carriage (ANIME_BASE_ADJUST.male headPitch −0.25: 3° chin up instead of 6°); a
    // headPitch word of 1.25 carries it back, and with the face record it stores set back to the base the head is the
    // hash it gave before the graphic face existed
    expect(hash(animeHead({ preset: 'male', register: 'lowpoly', expression: 'smile', sculpt: false }))).toBe('85f729246f5d520b');
    expect(hash({ ...animeHead({ preset: 'male', register: 'lowpoly', expression: 'smile', sculpt: false, face: { headPitch: 1.25 } }), face: resolveAnimeFace({}) })).toBe('c33aae77c545dec5');
  });
  it('the words: ratios about the base and offsets compose; shape words ride beside; the stored layer is sparse; unknown words refused', () => {
    const R = resolveAnimeSculpt(['heavy-lid', { lidWeight: 1.1, browAngle: 4, fissureShape: 'tri' }, { browAngle: 2 }]);
    expect(R.lidWeight).toBeCloseTo(1.25 * 1.1, 6); expect(R.lidCover).toBe(1.3); expect(R.browAngle).toBe(6); expect(R.fissureShape).toBe('tri');
    expect(sparseSculpt(R)).toEqual({ lidWeight: R.lidWeight, lidCover: 1.3, browAngle: 6, fissureShape: 'tri' });
    expect(sparseSculpt(resolveAnimeSculpt({ lidWeight: 1, eyeLevel: 0 }))).toBeNull(); expect(sparseSculpt(resolveAnimeSculpt(false))).toBe(false);
    expect(validateAnimeSculpt({ lidWidth: 1.2 })[0]).toMatch(/sculpt\.lidWidth: unknown control/);
    expect(validateAnimeSculpt('big-eyes')[0]).toMatch(/unknown sculpt move 'big-eyes'/);
    expect(validateAnimeSculpt({ fissureShape: 'oval' })[0]).toMatch(/fissureShape: one of round, almond, rect, tri/);
    expect(validateAnimeSculpt({ lidWeight: 0 })[0]).toMatch(/> 0/); expect(validateAnimeSculpt({ catchlight: 0, noseLine: 0 })).toEqual([]);
    expect(() => animeHead({ preset: 'female', sculpt: { lidWidth: 1 } })).toThrow(/unknown control/);
    // the range advice promises no closure for a sculpt word (a lip line far past its range leaves the lattice's mouth
    // opening): it points at the closure check instead
    expect(animeSculptWarnings(resolveAnimeSculpt({ stomion: 0.06 }))).toEqual([expect.stringMatching(/^sculpt\.stomion 0\.06 is outside the comfortable range \[-0\.03, 0\.03\]: the read past this is the operator's call, and far past it the face may open \(the closure check says\)$/)]);
    // an offset is in fractions of the head height: eyeLevel +0.01 raises the eye by 0.022 studio units
    expect(sculptBuild('male', resolveAnimeSculpt({ eyeLevel: 0.01 })).eyeLevel).toBeCloseTo(GRAPHIC_BASE.male.sculpt.eyeLevel + 0.022, 9);
  });
  it('constant topology across every expression: the same parts and face lists (the lenses stay, behind the lids when shut)', () => {
    for (const [preset, register] of [['female', 'round'], ['male', 'round'], ['male', 'lowpoly']]) {
      const ref = faceLists(animeHead({ preset, register, hair: 'none' }));
      for (const expression of Object.keys(ANIME_POSES)) expect(faceLists(animeHead({ preset, register, hair: 'none', expression })), `${preset} ${register} ${expression}`).toEqual(ref);
    }
    // the studio's face keeps its own behaviour: the lenses vanish when the lids shut
    expect(animeHead({ preset: 'female', hair: 'none', expression: 'blink', sculpt: false }).parts.irisR).toBeUndefined();
  }, 120000);
  it('at a blink the iris is built but buried behind the lid skin; closed at every expression', () => {
    for (const preset of ['female', 'male']) {
      const h = animeHead({ preset, hair: 'none', expression: 'blink' }), mesh = compileLayered(h);
      expect(failures(mesh)).toEqual([]); expect(h.parts.irisR).toBeTruthy();
      const ex = layeredExposure(mesh, { res: 256 }); for (const e of ['irisR', 'irisL', 'pupilR', 'pupilL', 'catchR', 'catchL']) expect(ex.parts[e].exposed, `${preset} ${e}`).toBe(0);
    }
  }, 60000);
  it('parts by key: a word switched off drops only its own parts; a word turned never renames or splits another', () => {
    const keys = (h) => Object.keys(h.parts).sort(), base = keys(animeHead({ preset: 'male', hair: 'none' }));
    expect(keys(animeHead({ preset: 'male', hair: 'none', sculpt: { catchlight: 0 } }))).toEqual(base.filter((k) => !/^catch/.test(k)));
    expect(keys(animeHead({ preset: 'male', hair: 'none', sculpt: { noseLine: 0 } }))).toEqual(base.filter((k) => k !== 'noseLine'));
    for (const sculpt of [{ lidWeight: 1.5, lidTail: 0 }, { browThick: 1.6, browShape: 'taper', browLength: 1.25 }, { fissureShape: 'tri', lidCover: 1.6 }, 'sharp-eyes']) expect(keys(animeHead({ preset: 'male', hair: 'none', sculpt })), JSON.stringify(sculpt)).toEqual(base);
  }, 60000);
  it('every word at its range ends closes (sampled across the bases and the families); the eyes read', () => {
    const families = ['bob', 'short', 'long', 'hime'], bad = [];
    ANIME_SCULPT_KEYS.forEach((k, i) => ANIME_SCULPT.RANGES[k].forEach((v, j) => {
      // a family on every third build (the words reach the hair only through the fit's drape), bald otherwise
      const preset = (i + j) % 2 ? 'male' : 'female', hair = (i + j) % 3 ? 'none' : families[i % 4], h = animeHead({ preset, hair, sculpt: { [k]: v } }), mesh = compileLayered(h);
      const f = failures(mesh); if (f.length) bad.push(`${preset} ${hair} ${k}=${v}: ${f.join(', ')}`);
      if (j === 1) { const ex = layeredExposure(mesh, { res: 128 }); for (const e of ['irisR', 'irisL']) if (!['reads', 'faint'].includes(ex.parts[e].flag)) bad.push(`${preset} ${k}=${v}: ${e} ${ex.parts[e].flag}`); }
    }));
    expect(bad).toEqual([]);
  }, 180000);
  it('the feature table sits inside its bands on both default bases, in ratios (the scale never moves it)', () => {
    for (const preset of ['female', 'male']) {
      const F = animeHead({ preset }).measures.features;
      expect(F.advice, preset).toEqual([]);
      for (const [k, [lo, hi]] of Object.entries(FEATURE_BANDS[preset])) { expect(F[k], `${preset} ${k}`).toBeGreaterThanOrEqual(lo); expect(F[k], `${preset} ${k}`).toBeLessThanOrEqual(hi); }
      expect(animeHead({ preset, scale: 1.2 }).measures.features).toEqual(F);
      expect(animeHead({ preset, expression: 'blink' }).measures.features).toEqual(F);   // always of the face at rest
      // read at the studio's carriage: the head's own carriage (the base's rest pitch, a headPitch word) never moves it
      expect(animeHead({ preset, face: { headPitch: 1.25 } }).measures.features).toEqual(F);
    }
    const male = animeHead({ preset: 'male' }).measures.features;
    expect(male.mouthWidth).toBeCloseTo(0.30, 2); expect(male.browAngle).toBeGreaterThan(15);   // the male mouth at about 0.30 W; the brow's inner end down
    // the advice names the word the way the door takes it (the stored sculpt is sparse: the object first, then the path)
    expect(animeHead({ preset: 'male', sculpt: { mouthWidth: 0.8 } }).measures.features.advice).toEqual([expect.stringMatching(/the mouth width \(of W\) is 0\.2\d+, outside the male band \[0\.3, 0\.38\]: \/hero\/sculpt \{ mouthWidth: … \} moves it \(then \/hero\/sculpt\/<word>\)$/)]);
    // the ear spans the eye level to the nose tip on both bases (its centre within 0.03 H of their midpoint); a word moves it
    expect(animeHead({ preset: 'female', sculpt: { earLevel: -0.05 } }).measures.features.advice).toEqual([expect.stringMatching(/the ear centre from midway between the eye level and the nose tip \(of H\) is -0\.0\d+, outside the female band \[-0\.03, 0\.03\]: \/hero\/sculpt \{ earLevel: … \}/)]);
    // a lip line moved up past the nose (a word far past its range) leaves the nose's ratios unmeasured and says so: the
    // head still builds, never a thrown error inside the measurement
    const past = animeHead({ preset: 'female', sculpt: { stomion: 0.2 } }).measures.features;
    expect([past.pronasale, past.noseToMouth, past.noseProjection]).toEqual([null, null, null]); expect(past.advice).toContainEqual(expect.stringMatching(/the nose tip could not be measured/));
    expect(animeHead({ preset: 'male', sculpt: false }).measures.features).toBeUndefined();
  }, 60000);
  it('the lenses on the lowpoly register take the game budget: at most 900 triangles for both eyes', () => {
    const lensTris = (h) => ['irisR', 'irisL', 'pupilR', 'pupilL', 'catchR', 'catchL'].reduce((s, k) => s + (h.parts[k] ? Object.keys(h.parts[k].faces).length : 0), 0);
    for (const preset of ['female', 'male']) expect(lensTris(animeHead({ preset, hair: 'none', register: 'lowpoly' })), preset).toBeLessThanOrEqual(900);
  }, 30000);
  it("the nose line on the shade side of the default key; the brows and lids drawn through the fringe, the fringe's parts veil them", () => {
    const h = animeHead({ preset: 'female', hair: 'bob' }), key = resolveToonLight(true).toLight, mesh = compileLayered(h);
    const noseX = mesh.vertices.filter((_, i) => mesh.provenance[i].part === 'noseLine').reduce((s, p, _, a) => s + p[0] / a.length, 0);
    expect(Math.sign(noseX)).toBe(-Math.sign(key[0])); expect(key[0]).not.toBe(0);
    const flagged = (x, f) => Object.keys(x.parts).filter((k) => x.parts[k][f]).sort();
    expect(flagged(h, 'through')).toEqual(['browL', 'browR', 'lidL', 'lidR']); expect(h.parts.browR.through).toBe('fringe');
    expect(flagged(h, 'veil')).toEqual(['hairFormFringeC', 'hairFormFringeL', 'hairFormFringeR']); expect(h.parts.hairFormFringeC.veil).toBe('fringe');
    expect(flagged(animeHead({ preset: 'female', hair: ['bob', { strands: 1 }] }), 'veil')).toEqual([1, 2, 3, 4, 5, 6, 7].map((i) => `hairFringe${i}`));
    const studio = animeHead({ preset: 'female', hair: 'bob', sculpt: false }); expect([...flagged(studio, 'through'), ...flagged(studio, 'veil')]).toEqual([]);
  }, 30000);
});

// the HAIR FORM (mojulo's words on the hair: the lift, the section, the crown accents, the cut's words) and the HAIR
// BASES (the anime hero's default hair per design base: a form under every family, a cut while no family is named)
describe('anime head: the hair form and the hair bases', () => {
  const zTop = (mesh, re) => { let z = -Infinity; mesh.faces.forEach((f) => { if (re.test(mesh.provenance[f[0]].part)) for (const i of f) z = Math.max(z, mesh.vertices[i][2]); }); return z; };
  const baseHair = (pole, cut = true) => resolveAnimeHair([ANIME_HAIR_BASE[pole].form, ...(cut ? [ANIME_HAIR_BASE[pole].cut] : [])]);
  it('the words ride on the hair SPARSE, compose last-wins (an object word key by key), false and null; never in the studio recipe', () => {
    const plain = resolveAnimeHair('bob');
    expect(Object.keys(plain)).toEqual(['style', 'volume', 'length', 'fringe', 'clump', 'thickness', 'taper', 'sweep', 'part', 'ahoge', 'strands', 'locks']);
    const H = resolveAnimeHair([{ lift: { crown: 0.1, temple: 0.05 }, ridge: 0.5 }, 'long', { lift: { crown: 0.2 }, sweepBack: 0.5 }, { sweepBack: { rise: 1.5 }, ridge: null, section: 'ridge' }]);
    expect(H.lift).toEqual({ crown: 0.2, temple: 0.05 }); expect(H.sweepBack).toEqual({ amount: 0.5, rise: 1.5 }); expect(H.ridge).toBe(0.5); expect(H.style).toBe('long');
    expect(Object.keys(H).slice(12)).toEqual(ANIME_HAIR_FORM_WORDS.filter((k) => k in H));   // after the locks, in the words' order
    expect(resolveAnimeHair([{ lift: { crown: 0.1 } }, { lift: false }]).lift).toBe(false);   // false: the studio's construction, over a base
    // the build's units: the lift by the studio's region names, draped over the dome; grow is the studio's crown
    expect(animeHairForm({ lift: { crown: 0.16, fringe: 0.06, nape: 0.05 }, crownAccents: 'grow', section: 'round', sweepSides: 0.5 })).toEqual({ lift: { crown: 0.16, temple: 0, front: 0.06, back: 0.05 }, section: 'round', sweepSides: { amount: 0.5 }, dome: true });
    expect(animeHairForm({ lift: false, crownAccents: 'grow', sweepBack: 0, ridge: undefined })).toBeNull(); expect(animeHairForm(plain)).toBeNull();
    const r = animeRecipe({ preset: 'male', hair: baseHair('male') });
    expect(ANIME_HAIR_FORM_WORDS.filter((k) => k in r.hair)).toEqual([]); expect(r.hair.thickness).toBe(1.5);
    expect(validateAnimeHair({ lift: { crown: 'high' }, flute: 2, sweepSides: { amount: 1, from: 3 }, hairline: { front: 2 } }).map((e) => e.split(':')[0])).toEqual(['hair.lift.crown', 'hair.flute', 'hair.hairline.front', 'hair.sweepSides.from']);
    expect(validateAnimeHair([baseHair('female'), 'swept-back', 'side-parted'])).toEqual([]);
  });
  it('the words: an absent or all-neutral form builds the head it built before them, part for part', () => {
    for (const preset of ['female', 'male']) {
      const ref = animeHead({ preset, hair: 'bob' });
      for (const extra of [{}, { lift: false, section: 'round', crownAccents: 'grow', ridge: 0, flute: 0, sweepBack: 0, sweepSides: false, hairline: false, fringeGroups: false, backNotch: false, fringeNotch: false, flip: 0, spikes: { amount: 0 }, sideTail: false }]) {
        const h = animeHead({ preset, hair: { style: 'bob', ...extra } });
        expect(JSON.stringify(h.parts), preset).toBe(JSON.stringify(ref.parts)); expect(h.hairCoverage).toEqual(ref.hairCoverage);
        // the whole head include is the same but for its `hair` record, which echoes the words as given (the operator's
        // own record, by design: a neutral word stays readable where it was set)
        const { hair: _h, ...built } = h, { hair: _r, ...refBuilt } = ref; expect(JSON.stringify(built), preset).toBe(JSON.stringify(refBuilt));
      }
    }
  });
  it('the bases close; the scalp stays covered (≤ 2 % from every view) under every family; the lifted hull and the whole mass stand 13–27 mm off the skull crown', () => {
    for (const pole of ['female', 'male']) {
      const h = animeHead({ preset: pole, hair: baseHair(pole) }), mesh = compileLayered(h);
      expect(failures(mesh), pole).toEqual([]);
      expect(Math.max(...Object.values(h.hairCoverage.views)), pole).toBeLessThanOrEqual(0.02);
      const crown = zTop(mesh, /^face$/), hull = (zTop(mesh, /^hairCap$/) - crown) * 1000, top = (zTop(mesh, /^hair/) - crown) * 1000;
      expect(hull, pole).toBeGreaterThanOrEqual(13); expect(hull, pole).toBeLessThanOrEqual(27);
      // the whole mass on both bases: the female's sheet sits on the hull; the male's swept crest rises above it (his fringe
      // arches over the crown) with its tips laid onto the mass, never standing past the band
      expect(top, pole).toBeGreaterThanOrEqual(13); expect(top, pole).toBeLessThanOrEqual(27);
      if (pole === 'male') expect(top).toBeGreaterThan(hull);
      expect(h.hairMeasures.top_m).toBeCloseTo(top / 1000, 3);
      // the form under every other family still covers
      for (const style of ['bob', 'short', 'long', 'hime']) expect(Math.max(...Object.values(animeHead({ preset: pole, hair: [ANIME_HAIR_BASE[pole].form, style] }).hairCoverage.views)), `${pole} ${style}`).toBeLessThanOrEqual(0.02);
    }
    // the scalp's hairline follows the cut's: the swept-back cut's forehead (the front hairline raised) is not scalp
    const raised = animeHead({ preset: 'male', hair: baseHair('male') }), level = animeHead({ preset: 'male', hair: [baseHair('male'), { hairline: false }] });
    expect(raised.scalp.length).toBeLessThan(level.scalp.length);
  }, 60000);
  it('every word at its range ends closes (sampled on its family, both bases)', () => {
    const ends = [
      ['short', { lift: { crown: 0.3, temple: 0.14, fringe: 0.12, nape: 0.14 } }], ['short', { lift: { crown: 0, temple: 0, fringe: 0, nape: 0 } }], ['short', { section: 'ridge', crownAccents: 'tuck' }],
      ['short', { sweepBack: { amount: 0.5 } }], ['short', ANIME_HAIR_MOVES['swept-back'].hair], ['short', { sweepSides: { amount: 1, from: 0 } }], ['short', { hairline: { front: 1 } }],
      ['long', { ridge: 2, flute: 1 }], ['long', { fringeGroups: [[1, 2, 3, 4, 5, 6, 7]], backNotch: 1 }], ['bob', { fringeGroups: [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]], backNotch: 0.5 }], ['long', ANIME_HAIR_MOVES['side-parted'].hair],
      ['long', { flip: { amount: 1, out: 1, rise: 1, hold: 1 } }], ['bob', { flip: 0.5, fringeNotch: 1 }], ['short', { spikes: { amount: 1, reach: 3, width: 3, up: 1 } }], ['short', { spikes: 0.4, crownAccents: 'tuck' }],
      ['long', { sideTail: { amount: 1, side: 'right', length: 2, width: 2, height: 1 } }], ['bob', { sideTail: { amount: 0.5, side: 'left', length: 0.3, width: 0.3, height: -1 } }],
      ...['flipped-long', 'blunt-bob', 'side-tail', 'wild-spikes'].map((w) => [ANIME_HAIR_MOVES[w].hair.style, ANIME_HAIR_MOVES[w].hair]),
    ];
    for (const preset of ['female', 'male']) for (const [style, words] of ends) {
      const h = animeHead({ preset, hair: [ANIME_HAIR_BASE[preset].form, { ...words, style }] });
      expect(failures(compileLayered(h)), `${preset} ${style} ${JSON.stringify(words).slice(0, 80)}`).toEqual([]);
    }
  }, 60000);
});

describe('anime head: the sketch cuts (flipped-long, blunt-bob, side-tail, wild-spikes)', () => {
  const on = (preset, hair) => { const h = animeHead({ preset, hair: [ANIME_HAIR_BASE[preset].form, ...(Array.isArray(hair) ? hair : [hair])] }); return { h, mesh: compileLayered(h) }; };
  const box = (mesh, re) => { const ps = mesh.pointIds.map((id, i) => (re.test(id.split('/')[0]) ? mesh.vertices[i] : null)).filter(Boolean); return [0, 1, 2].map((k) => [Math.min(...ps.map((p) => p[k])), Math.max(...ps.map((p) => p[k]))]); };
  it('each cut closes on both bases and keeps the scalp covered', () => {
    for (const cut of ['flipped-long', 'blunt-bob', 'side-tail', 'wild-spikes']) for (const preset of ['female', 'male']) {
      const { h, mesh } = on(preset, cut);
      expect(failures(mesh), `${preset} ${cut}`).toEqual([]);
      expect(Math.max(...Object.values(h.hairCoverage.views)), `${preset} ${cut}`).toBeLessThanOrEqual(0.02);
    }
  }, 60000);
  it('the words validate by name: the new form words, their fields and the tail clump', () => {
    expect(validateAnimeHair(['flipped-long', 'blunt-bob', 'side-tail', 'wild-spikes'])).toEqual([]);
    expect(validateAnimeHair({ flip: 2, fringeNotch: 0, sideTail: { amount: 1, side: 'up' }, spikes: { reach: 1 } }).map((e) => e.split(':')[0])).toEqual(['hair.fringeNotch', 'hair.flip', 'hair.spikes', 'hair.sideTail.side']);
    expect(validateAnimeHair({ locks: { tail: { ty: 0.1 } } })).toEqual([]); expect(animeLockPart('tail')).toBe('hairTail');
    expect(resolveAnimeHair([{ flip: 0.5 }, { flip: { out: 0.2 } }]).flip).toEqual({ amount: 0.5, out: 0.2 });
  });
  it('flipped-long: the side and back ends kicked out past the plain long sheet', () => {
    const flip = on('female', 'flipped-long').mesh, plain = on('female', ['flipped-long', { flip: false }]).mesh;
    const reach = (m) => Math.max(...box(m, /^hairFormSide[LR]$/)[0].map(Math.abs));
    expect(reach(flip)).toBeGreaterThan(reach(plain) + 0.03);
  });
  it('blunt-bob: a level fringe; the left side falls past the jaw, the right stays at it', () => {
    const { mesh } = on('female', 'blunt-bob');
    const [a, b] = [box(mesh, /^hairFormFringeA$/)[2][0], box(mesh, /^hairFormFringeB$/)[2][0]];
    expect(Math.abs(a - b)).toBeLessThan(0.006);
    expect(box(mesh, /^hairFormSideL$/)[2][0]).toBeLessThan(box(mesh, /^hairFormSideR$/)[2][0] - 0.06);
  });
  it('side-tail: one round tail hanging on the left below the chin; the left side gathered into it', () => {
    const { h, mesh } = on('female', 'side-tail'), plain = on('female', 'side-parted').mesh;
    expect(h.parts.hairTail).toBeDefined(); expect(on('female', 'side-parted').h.parts.hairTail).toBeUndefined();
    const tail = box(mesh, /^hairTail$/), chin = box(mesh, /^face$/)[2][0];
    expect(tail[0][1]).toBeLessThan(0); expect(tail[2][0]).toBeLessThan(chin - 0.1);
    expect(tail[0][1] - tail[0][0]).toBeGreaterThan(0.06);   // round, not a ribbon, from the front
    expect(box(mesh, /^hairFormSideL$/)[2][0]).toBeGreaterThan(box(plain, /^hairFormSideL$/)[2][0] + 0.05);
    expect(box(on('female', ['side-tail', { sideTail: { amount: 1, side: 'right' } }]).mesh, /^hairTail$/)[0][0]).toBeGreaterThan(0);
  });
  it('wild-spikes: a swept mass and thorn spikes standing well above and out from the short crop', () => {
    const spikes = on('male', 'wild-spikes'), crop = on('male', 'short');
    expect(spikes.h.hairMeasures.top_m).toBeGreaterThan(crop.h.hairMeasures.top_m + 0.08);
    expect(box(spikes.mesh, /^hair/)[0][1]).toBeGreaterThan(box(crop.mesh, /^hair/)[0][1] + 0.05);
    // the first shapes recipe: peppers, bananas and carrots in place of the studio's clumps
    expect(Object.keys(spikes.h.parts).filter((k) => /^hair(Pepper|Banana|Carrot)\d+$/.test(k)).length).toBe(19);
    expect(Object.keys(spikes.h.parts).some((k) => /^hair(Fringe|Temple|Back|Crown)/.test(k))).toBe(false);
  });
  it('the shapes: validated by name, built closed, the replaced groups gone and the rest kept', () => {
    expect(validateAnimeHair({ shapes: { replace: ['fringe', 'mane'], peppers: [{ at: [0, 120] }], bananas: [{ at: [0, 10] }], carrots: [{ at: [0, 40], dir: [0, 0, 0], base: 2 }], beans: [] } }).map((e) => e.split(':')[0]))
      .toEqual(['hair.shapes.replace', 'hair.shapes.peppers[0].at', 'hair.shapes.bananas[0].dir', 'hair.shapes.carrots[0].dir', 'hair.shapes.carrots[0].base', 'hair.shapes.beans']);
    const one = on('male', ['short', { shapes: { replace: ['crown'], peppers: [{ at: [180, 60] }], bananas: [{ at: [0, 5], dir: [0, -1, -0.2] }], carrots: [{ at: [90, 50], dir: [1, 0.3, 0.3] }] } }]);
    expect(failures(one.mesh)).toEqual([]);
    expect(['hairPepper0', 'hairBanana0', 'hairCarrot0', 'hairFringe1', 'hairBack1'].every((k) => one.h.parts[k])).toBe(true);
    expect(one.h.parts.hairCrownL0).toBeUndefined(); expect(animeLockPart('carrot-12')).toBe('hairCarrot12');
    // a carrot reaches along its direction; a pepper stands off the head
    expect(box(one.mesh, /^hairCarrot0$/)[0][1]).toBeGreaterThan(box(one.mesh, /^face$/)[0][1] + 0.05);
  });
});
