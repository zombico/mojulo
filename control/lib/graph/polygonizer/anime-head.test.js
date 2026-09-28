/** The anime head (anime-head.js): the studio's head, registered and made wearable. Its words compose; every part closes;
 * it sits where the landmark head sits; a hero wears it through the rig gates; the landmark path is untouched. */
import { describe, it, expect } from 'vitest';
import { animeHead, animeHairCoverage, animeCoverageWarnings, animeRecipe, animeLockPart, resolveAnimeFace, validateAnimeFace, animeFaceWarnings, resolveAnimeHair, validateAnimeHair, animeHairWarnings, resolveAnimeExpression, validateAnimeExpression, ANIME_FACE_KEYS } from './anime-head.js';
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
    const r = animeRecipe({ preset: 'male', face: { nose: 1.1, tilt: -0.02 } });
    expect(r.face.nose).toBeCloseTo(1.1, 12); expect(r.face.tilt).toBeCloseTo(0.015, 12); expect(r.face.iris).toBe(0.88);
    expect(animeReadRecipe(r)).toEqual(r);   // a head's recipe is a recipe the studio loads
    // mojulo's anime base: the studio's with the chin set back (ANIME_BASE_ADJUST); otherwise the studio's fresh design
    const fresh = animeFresh('female'); fresh.face.chinProjection = 0.8;
    expect(animeRecipe({ preset: 'female' })).toEqual(fresh); expect(animeRecipe({ preset: 'male' }).face.chinProjection).toBeCloseTo(0.8, 12);
    expect(validateAnimeFace({ jawWidth: 1.1 })[0]).toMatch(/unknown control/); expect(validateAnimeFace({ tilt: -0.05 })).toEqual([]);
    expect(animeFaceWarnings(resolveAnimeFace({ nose: 1.8 }), 'female')[0]).toMatch(/face\.nose 1\.8 .*studio's slider/);
    expect(ANIME_FACE_KEYS.length).toBe(23);
  });
  it('hair: a family word, controls, per-clump locks (summed per axis); advice past the studio', () => {
    const H = resolveAnimeHair(['short', { length: 1.1, sweep: 0.1, locks: { 'fringe-3': { ty: -0.05 } } }, { sweep: 0.05, locks: { 'fringe-3': { ty: -0.05, tx: 0.02 } } }]);
    expect(H).toMatchObject({ style: 'short', length: 1.1, sweep: 0.15, locks: { 'fringe-3': { ty: -0.1, tx: 0.02 } } });
    expect(resolveAnimeHair(null).style).toBeNull();
    expect(validateAnimeHair('mohawk')[0]).toMatch(/unknown anime family 'mohawk'/);
    expect(validateAnimeHair({ locks: { 'fringe-9': { ty: 1 } } })[0]).toMatch(/not a clump/);
    expect(validateAnimeHair({ locks: { 'back-2': { wobble: 1 } } })[0]).toMatch(/not a lock edit/);
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
    for (const p of ['face', 'earR', 'earL', 'irisR', 'irisL', 'pupilR', 'pupilL', 'browR', 'browL', 'lashR', 'lashL', 'lashLowR', 'lashLowL', 'hairCap']) expect(h.parts[p], p).toBeTruthy();
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
