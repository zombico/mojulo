// The feature tune (feature-tune.js): the operator's hand on a feature animal, by the style's two halves and its detail
// tier. The laws: a tune is validated (each dial in its range, a tier by name) and absent is nothing (the sheet carries no
// tune, the build is the designed one); the brief's tuning words are read only in the feature style, and a tier's word
// asks for the style; each structure dial moves its own mass (the head about its seat, the trunk's girth, the legs, the
// tail, the ears, the muzzle, the eyes) and the function still holds on a tuned quadruped; a decoration dial at 0 drops
// its decoration; the gen7 tier makes a denser skin within its budget, more pointed details, and bakes its light. One
// species per procedure, chosen in code from the roster.
import { describe, it, expect } from 'vitest';
import { validateTune, resolveTune, readTuneBrief, mergeTune, FEATURE_TUNE, FEATURE_DETAIL, TUNE_LEXICON, DETAIL_WORDS, FAMILY_SIZES, sizesOf } from './feature-tune.js';
import { featureBuild, PLAN_OF, PLANS } from './feature-grammar.js';
import { HEAD_TUFTS, TUFT_SKULL, TUFT_COLOURS, tuftLocks, tuftColour, resolveTuft } from './feature-tufts.js';
import { FEATURE_FOURS } from './feature-function.js';
import { silhouetteOf, SPECIES } from './feature-silhouettes.js';
import { animalCard } from './mascot-animals.js';
import { rollMascot, MASCOT_LEXICON } from './mascot.js';
import { mascotPlanFromSheet } from './mascot-form.js';

const sil = (id) => silhouetteOf(id, SPECIES[id].family, PLAN_OF[SPECIES[id].family]);
const first = (pred) => Object.keys(SPECIES).find((id) => { try { return pred(id); } catch { return false; } });
// (a furred stander on the pear, a family the style draws as designed; a hoofed leggy animal; a bird)
const pear = first((id) => PLAN_OF[SPECIES[id].family] === 'stander' && sil(id) === 'pear' && !FAMILY_SIZES[SPECIES[id].family]);
const bird = first((id) => PLAN_OF[SPECIES[id].family] === 'bird' && sil(id) === 'perch');
const egg = (b, n) => b.eggs.find((e) => e.name === n);
const tuned = (id, structure, extra = {}) => featureBuild(animalCard(id), { tune: resolveTune({ structure, ...extra }) });

describe('the feature tune', () => {
  it('is validated: each structure dial in its range, decoration 0–3, a tier by name; absent, nothing', () => {
    expect(validateTune(undefined)).toEqual([]);
    expect(validateTune({ structure: { head: 1.2, ears: 2 }, decoration: { tufts: 0 }, detail: 'gen7' })).toEqual([]);
    const errs = validateTune({ structure: { head: FEATURE_TUNE.head[1] + 1, wings: 1 }, decoration: { tufts: 4 }, detail: 'ps2', colour: 1 });
    expect(errs.join('\n')).toMatch(/structure\.head/); expect(errs.join('\n')).toMatch(/structure\.wings/);
    expect(errs.join('\n')).toMatch(/decoration\.tufts/); expect(errs.join('\n')).toMatch(/detail/); expect(errs.join('\n')).toMatch(/tune\.colour/);
    expect(resolveTune(undefined).detail.id).toBe('game');
    expect(Object.values(resolveTune(undefined).structure).every((v) => v === 1)).toBe(true);
  });

  it('absent from the sheet, nothing: no tune on the sheet, the build as designed', () => {
    const s = rollMascot({ facets: { style: 'feature', animal: pear } });
    expect(s).not.toHaveProperty('tune');
    const a = featureBuild(animalCard(pear)), b = featureBuild(animalCard(pear), { tune: resolveTune({}) });
    expect(b.eggs).toEqual(a.eggs); expect(b.tufts).toEqual(a.tufts); expect(b.limbs).toEqual(a.limbs); expect(a).not.toHaveProperty('tune');
  });

  it('the brief\'s tuning words are read in the feature style only; a tier\'s word asks for the style', () => {
    const r = readTuneBrief(`a 7th gen ${pear} with big ears`);
    expect(r.tune).toEqual({ structure: { ears: TUNE_LEXICON['big ears'].ears }, detail: 'gen7' }); expect(r.facets.style).toBe('feature');
    expect(r.rest).toBe(`a ${pear} with`);
    const s = rollMascot({ brief: `a 7th gen ${pear} with big ears` });
    expect(s.facets.style).toBe('feature'); expect(s.tune.detail).toBe('gen7'); expect(s.unread.words).toEqual([]);
    // (in the toon the same words are left as they always were)
    const toon = rollMascot({ brief: `a ${pear} with big ears`, facets: { style: 'toon' } });
    expect(toon).not.toHaveProperty('tune'); expect(toon.unread.words).toEqual(['big', 'ears']);
    // (an explicit tune over the brief's; a tune asks for the style, and is refused in another)
    expect(mergeTune({ structure: { ears: 1.4, head: 1.2 } }, { structure: { ears: 0.8 } })).toEqual({ structure: { ears: 0.8, head: 1.2 } });
    expect(rollMascot({ facets: { animal: pear }, tune: { structure: { head: 1.2 } } }).facets.style).toBe('feature');
    expect(() => rollMascot({ facets: { animal: pear, style: 'anime' }, tune: {} })).toThrow(/feature style/);
  });

  it('no tuning phrase is one the mascot lexicon already owns', () => {
    for (const k of [...Object.keys(TUNE_LEXICON), ...DETAIL_WORDS]) expect(MASCOT_LEXICON[k]).toBeUndefined();
  });

  it('each structure dial moves its own mass', () => {
    const a = featureBuild(animalCard(pear));
    // (the head grows about its seat: the cranium bigger, its underside where it was within a little)
    const h = tuned(pear, { head: 1.3 }), ca = egg(a, 'cranium'), ch = egg(h, 'cranium');
    expect(ch.r[0] / ca.r[0]).toBeCloseTo(1.3, 3);
    const jawLow = (b) => egg(b, 'jaw').c[2] - egg(b, 'jaw').r[2];
    expect(Math.abs(jawLow(h) - jawLow(a))).toBeLessThan(0.08);
    // (the girth: the belly broader and deeper; the legs: the hips higher; the tail, the ears: bigger)
    expect(egg(tuned(pear, { girth: 1.3 }), 'belly').r[1]).toBeCloseTo(egg(a, 'belly').r[1] * 1.3, 3);
    expect(tuned(pear, { legs: 1.4 }).joints.hip[2]).toBeGreaterThan(a.joints.hip[2] * 1.2);
    const tailR = (b) => Math.max(0, ...b.eggs.filter((e) => /^tail/.test(e.name)).map((e) => e.r[0]), ...b.tufts.filter((t) => /^tail/.test(t.name)).map((t) => t.len));
    expect(tailR(tuned(pear, { tail: 1.5 }))).toBeGreaterThan(tailR(a) * 1.4);
    if (egg(a, 'earR')) expect(egg(tuned(pear, { ears: 1.6 }), 'earR').r[0]).toBeGreaterThan(egg(a, 'earR').r[0] * 1.4);
    // (the muzzle: its nose further out; the eyes: bigger globes)
    const nose = (b) => (egg(b, 'nose') ?? egg(b, 'muzzle')).c[1];
    expect(nose(tuned(pear, { muzzle: 1.5 }))).toBeGreaterThan(nose(a) + 0.1);
    expect(tuned(pear, { eyes: 1.3 }).eye.r).toBeCloseTo(a.eye.r * 1.3, 3);
    // (the belly's zone moves with the tuned body: as high over the hips as on the designed one)
    const zoneOf = (b) => b.marks.find((m) => m.name === 'belly')?.regions?.[0], g = tuned(pear, { girth: 1.4 });
    if (zoneOf(a)) expect(zoneOf(g).c[2] - g.joints.hip[2]).toBeCloseTo(zoneOf(a).c[2] - a.joints.hip[2], 3);
    // (the read-back names what moved)
    expect(tuned(pear, { girth: 1.3 }).tune.structure).toEqual({ girth: 1.3 });
  });

  it('the function holds on a tuned quadruped: on all fours the paws reach and the trunk clears the floor', () => {
    for (const structure of [{ arms: 0.6, legs: 0.7, girth: 1.5 }, { legs: 1.6, arms: 1.4, girth: 0.7 }]) {
      const b = tuned(pear, structure);
      expect(b.fours).toBeTruthy();
      expect(b.fours.clearance).toBeGreaterThan(-FEATURE_FOURS.brush - 1e-6);
      expect(b.fours.shoulder).toBeLessThanOrEqual(b.fours.reach + 1e-6);
    }
    expect(tuned(pear, { arms: 0.6 }).tune.notes?.join(' ')).toMatch(/forepaws need to reach the floor/);
  });

  it('a decoration dial at 0 drops its decoration; more is bolder; no mass moves', () => {
    const a = featureBuild(animalCard(pear)), bare = featureBuild(animalCard(pear), { tune: resolveTune({ decoration: { tufts: 0, crown: 0 } }) });
    expect(bare.tufts.filter((t) => /^cheek|^crown/.test(t.name))).toEqual([]);
    expect(bare.eggs).toEqual(a.eggs);
    const bold = featureBuild(animalCard(pear), { tune: resolveTune({ decoration: { tufts: 2 } }) }), len = (b, n) => b.tufts.find((t) => t.name === n)?.len ?? 0;
    expect(len(bold, 'cheekAR')).toBeGreaterThan(len(a, 'cheekAR'));
  });

  it('a family\'s designed sizes multiply under the operator\'s', () => {
    const [fam, F] = Object.entries(FAMILY_SIZES)[0], [k, v] = Object.entries(F)[0];
    expect(sizesOf(fam, null)[k]).toBe(v); expect(sizesOf(fam, { [k]: 1.2 })[k]).toBeCloseTo(v * 1.2, 4);
    expect(sizesOf(SPECIES[pear].family, null)).toBeNull();
  });

  it('the gen7 tier: more pointed details than the game model; a bird\'s coverts', () => {
    const game = featureBuild(animalCard(pear)), g7 = featureBuild(animalCard(pear), { tune: resolveTune({ detail: 'gen7' }) });
    expect(g7.tufts.length).toBeGreaterThan(game.tufts.length + 3);
    expect(g7.eggs).toEqual(game.eggs);
    expect(featureBuild(animalCard(bird), { tune: resolveTune({ detail: 'gen7' }) }).tufts.some((t) => /^covert/.test(t.name))).toBe(true);
    // (its dial still rules it: tufts 0, no clumps)
    expect(featureBuild(animalCard(pear), { tune: resolveTune({ detail: 'gen7', decoration: { tufts: 0, crown: 0 } }) }).tufts.filter((t) => /Tuft|^cheek|^crown|^tailTip/.test(t.name))).toEqual([]);
  });

  it('the gen7 tier compiles to a denser skin within its budget, its light baked into its corners; the game model bakes none', () => {
    const P7 = mascotPlanFromSheet(rollMascot({ facets: { style: 'feature', animal: pear }, tune: { detail: 'gen7' } }));
    const P0 = mascotPlanFromSheet(rollMascot({ facets: { style: 'feature', animal: pear } }));
    const tris = (P) => P.create.spec.plan.segments.reduce((n, x) => n + Object.keys(x.mesh?.faces ?? {}).length, 0);
    const skin = (P) => Object.keys(P.create.spec.plan.segments.find((s) => s.name === 'skin').mesh.faces).length;
    expect(skin(P7)).toBeGreaterThan(skin(P0) * 1.4);
    expect(tris(P7)).toBeLessThanOrEqual(FEATURE_DETAIL.gen7.triangles);
    expect(P7.create.spec.bake.finish['*']).toBeTruthy(); expect(P7.create.spec.bake.finish.Sclera).toBe('eye');
    expect(P0.create.spec).not.toHaveProperty('bake');
    expect(P7.create.spec.plan.mascot.tune.detail).toBe('gen7'); expect(P0.create.spec.plan.mascot).not.toHaveProperty('tune');
  }, 120000);

  it('a head tuft is worn by every plan in place of the designed crown, its look a card, its colour and size its own', () => {
    // (one species per plan, chosen in code)
    const plans = Object.keys(PLANS), ids = plans.map((pl) => first((id) => PLAN_OF[SPECIES[id].family] === pl && !['teleost', 'chondrichthyan'].includes(SPECIES[id].family))).filter(Boolean);
    expect(ids.length).toBe(plans.length);
    for (const id of ids) {
      const b = featureBuild(animalCard(id), { tune: resolveTune({ tuft: 'mohawk' }) }), locks = b.tufts.filter((t) => t.group === 'Tuft');
      expect(locks.length, id).toBe(HEAD_TUFTS.mohawk.locks.length);
      expect(b.tufts.some((t) => /^crown[A-C]$/.test(t.name)), id).toBe(false);
      expect(b.tune.tuft.style).toBe('mohawk');
    }
    // (none takes the designed crown away; the crown's dial at 0 takes a tuft away)
    expect(featureBuild(animalCard(pear), { tune: resolveTune({ tuft: 'none' }) }).tufts.some((t) => /^crown/.test(t.name) || t.group === 'Tuft')).toBe(false);
    expect(featureBuild(animalCard(pear), { tune: resolveTune({ tuft: 'crest', decoration: { crown: 0 } }) }).tufts.some((t) => t.group === 'Tuft')).toBe(false);
    // (every card's locks stand out of the skull: rooted in it, the tip outside it)
    const S = TUFT_SKULL, inside = (p) => Math.hypot((p[0] - S.c[0]) / S.r[0], (p[1] - S.c[1]) / S.r[1], (p[2] - S.c[2]) / S.r[2]);
    for (const style of Object.keys(HEAD_TUFTS)) for (const L of tuftLocks(resolveTuft(style))) {
      expect(inside(L.root), `${style} ${L.name}`).toBeLessThan(1);
      expect(inside(L.root.map((x, k) => x + L.aim[k] * L.len)), `${style} ${L.name}`).toBeGreaterThan(1);
    }
    // (its size grows it; its colour a palette's group by name, or its own)
    const [a, b2] = [1, 1.6].map((size) => tuftLocks(resolveTuft({ style: 'mohawk', size }))[0].len);
    expect(b2).toBeCloseTo(a * 1.6, 3);
    const pal = { Body: '#111111', Belly: '#eeeeee', Patch: '#222222', Hair: '#333333' };
    expect(tuftColour(resolveTuft({ style: 'mop', colour: 'pale' }), pal)).toBe(pal[TUFT_COLOURS.pale]);
    expect(tuftColour(resolveTuft({ style: 'mop', colour: '#c0392b' }), pal)).toBe('#c0392b');
    expect(validateTune({ tuft: { style: 'afro', colour: 'red', size: 9 } }).length).toBe(3);
    // (the brief says it)
    expect(rollMascot({ brief: `a stylized ${pear} with a mohawk` }).tune.tuft).toBe('mohawk');
  });

  it('side hips (as designed): a round animal\'s legs on the sides of its ball, so it drops onto all fours rolling in place; \'below\' the old way', () => {
    // (one round species, chosen in code: the pear's own, a family the style draws as designed)
    const below = featureBuild(animalCard(pear), { tune: resolveTune({ hips: 'below' }) }), side = featureBuild(animalCard(pear));
    expect(featureBuild(animalCard(pear), { tune: resolveTune({ hips: 'side' }) }).joints.hip).toEqual(side.joints.hip);
    expect(validateTune({ hips: 'sideways' }).join(' ')).toMatch(/tune\.hips/);
    expect(resolveTune({}).hips).toBeUndefined();                                    // (absent: as designed, the sides)
    const belly = side.eggs.find((e) => e.name === 'belly');
    expect(side.joints.hip[0]).toBeGreaterThan(belly.r[1] * 0.6);                    // (on the ball's side)
    expect(side.joints.hip[2]).toBeGreaterThan(below.joints.hip[2]);                 // (up at its centre, not its bottom)
    // (standing, the legs straight and toed in, \\| |/ from the front: the inner edge straight down from the thigh to the
    // ankle, the ankle leaning in toward the other leg, the foot pointing ahead; the knee under the hip from the side; the
    // butt low, nearer the ground than the old way's)
    const J = side.joints, th = side.limbs.find((l) => l.name === 'thighR'), sh = side.limbs.find((l) => l.name === 'shinR');
    expect(Math.abs((J.hip[0] - th.ra) - (J.knee[0] - th.rb))).toBeLessThan(1e-6);
    expect(Math.abs((J.hip[0] - th.ra) - (J.ankle[0] - sh.rb))).toBeLessThan(0.02);
    expect(J.ankle[0]).toBeLessThan(J.hip[0] - (th.ra - sh.rb) * 0.5);
    expect(Math.abs(J.toeTip[0] - J.toeBase[0])).toBeLessThan((J.toeTip[1] - J.toeBase[1]) * 0.25);
    expect(Math.abs(J.knee[1] - J.hip[1])).toBeLessThan(0.05);
    expect(belly.c[2] - belly.r[2]).toBeLessThan(below.eggs.find((e) => e.name === 'belly').c[2] - below.eggs.find((e) => e.name === 'belly').r[2]);
    // (from the side a drumstick: the thigh deeper than it is broad, its tapered end out under the ball)
    const haunch = side.eggs.find((e) => e.name === 'haunchR');
    expect(haunch.r[2]).toBeGreaterThan(haunch.r[1] * 1.5); expect(haunch.c[2] - haunch.r[0] * (1 + haunch.e / 2)).toBeLessThan(belly.c[2] - belly.r[2]);
    // (on all fours the hind legs keep their natural bend)
    expect(side.fours.crouch).toBeGreaterThanOrEqual(FEATURE_FOURS.natural - 1e-9);
    // (the transition: the fit raises the legs far less, the trunk's centre travels less, and the function holds)
    expect(side.fit.rise).toBeLessThan(below.fit.rise / 2);
    const centre = (b) => { const es = b.eggs.filter((e) => ['belly', 'chest'].includes(e.name)); return es.reduce((a, e) => a.map((x, k) => x + e.c[k] / es.length), [0, 0, 0]); };
    const travel = (b) => { const c = centre(b), hz = b.joints.hip[2], a = (b.fours.hinge * Math.PI) / 180, y = c[1], z = c[2] - hz;
      return Math.hypot(y * Math.cos(a) + z * Math.sin(a) - y, hz - b.fours.crouch * 0.45 * (hz - 0.05) + z * Math.cos(a) - y * Math.sin(a) - c[2]); };
    expect(travel(side)).toBeLessThan(travel(below) * 0.7);
    expect(side.fours.clearance).toBeGreaterThan(-FEATURE_FOURS.brush - 1e-6); expect(side.fours.shoulder).toBeLessThanOrEqual(side.fours.reach + 1e-6);
    // (a silhouette that is no ball is left as it is)
    const leggy = first((id) => PLAN_OF[SPECIES[id].family] === 'stander' && sil(id) === 'leggy' && !FAMILY_SIZES[SPECIES[id].family]);
    if (leggy) expect(featureBuild(animalCard(leggy), { tune: resolveTune({ hips: 'side' }) }).joints.hip).toEqual(featureBuild(animalCard(leggy)).joints.hip);
  });
});
