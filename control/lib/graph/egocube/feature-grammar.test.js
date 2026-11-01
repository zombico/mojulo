// The feature grammar (feature-grammar.js): the converter's laws, one species per body plan (chosen in code from the roster,
// never a catalog walk). Every plan builds; structure and decoration are apart (the decoration dials at 0 leave every mass
// where it was and lay no tuft and no marking layer); a plan's own solution is there (a bird's wings and beak, a hoofed
// animal's hooves, a scaled skin's spines, an orb's missing neck); a species' measures size its ears; and a plan other
// than the raccoon's goes through the whole pipeline to one skin on the rig. The silhouettes vary with the species' body
// (one per silhouette, chosen from the roster in code), the belly is the species' own or none, a bird stands as a bird.
// A quadruped is functional (it drops onto all fours: its paws reach the floor, its trunk clears it, big hind legs stay
// big); a bird's side silhouette falls in φ, its beak is its own and its wings carry its silhouette; no fish is drawn.
import { describe, it, expect } from 'vitest';
import { featureBuild, PLAN_OF, PLANS, speciesMeasures, FEATURE_PROPORTION, FEATURE_EXCLUDES, BIRD_REST } from './feature-grammar.js';
import { featureFace } from './feature-face.js';
import { FEATURE_BIRD_LEAN } from './mascot.js';
import { FEATURE_FOURS, speciesLimbs } from './feature-function.js';
import { PHI, beakParts, plumageOf, extentAlong } from './feature-birds.js';
import { SILHOUETTES, silhouetteOf, speciesMetrics, BELLY_CONTRAST } from './feature-silhouettes.js';
import { animalCard } from './mascot-animals.js';
import { SPECIES } from '../fauna/species.js';
import { rollMascot } from './mascot.js';
import { mascotPlanFromSheet } from './mascot-form.js';
import { egg, eggDistance } from './feature-body.js';

// (the first species of the first family of each plan)
const ONE = Object.fromEntries(Object.keys(PLANS).map((plan) => { const fam = Object.keys(PLAN_OF).find((f) => PLAN_OF[f] === plan); return [plan, Object.keys(SPECIES).find((id) => SPECIES[id].family === fam)]; }));
const NO_DECOR = { tufts: 0, crown: 0, markings: 0, horns: 0, spines: 0, mane: 0, fins: 0 };

describe('the feature grammar', () => {
  it('every plan builds; its names are its own; the decoration dials at 0 leave the masses and lay no tuft or layer', () => {
    for (const [plan, id] of Object.entries(ONE)) {
      const card = animalCard(id), b = featureBuild(card), bare = featureBuild(card, { decor: NO_DECOR });
      expect(b.plan, id).toBe(plan);
      const names = [...b.eggs, ...b.tufts, ...b.limbs].map((x) => x.name);
      expect(new Set(names).size, id).toBe(names.length);
      expect(bare.eggs, id).toEqual(b.eggs); expect(bare.limbs, id).toEqual(b.limbs);
      // (the tufts left bare are structure: a thin tail, a trunk, a fluke's stock; no fan, crown, horn, spine or mane)
      expect(bare.tufts.map((t) => t.name).filter((n) => /^(cheek|crown|primary|tailFeather|spine|horn|mane|crest|ear)/.test(n)), id).toEqual([]);
      expect(bare.marks.filter((m) => m.strokes || m.bands), id).toEqual([]);
      expect(b.mouth.corner[0], id).toBeGreaterThan(0); expect(b.eye.r, id).toBeGreaterThan(0);
    }
  });

  it('each plan carries its solution: wings and a beak, hooves, spines, no neck on an orb', () => {
    const b = (plan) => featureBuild(animalCard(ONE[plan]));
    expect(b('bird').tufts.some((t) => t.name === 'beak') || b('bird').eggs.some((e) => e.name === 'bill')).toBe(true);
    expect(b('bird').tufts.some((t) => t.name.startsWith('primary'))).toBe(true); expect(b('bird').digits).toBeUndefined();
    expect(b('hoofed').marks.find((m) => m.group === 'Hoof')?.eggs).toEqual(expect.arrayContaining(['pawR', 'footL']));
    expect(b('reptile').tufts.filter((t) => t.name.startsWith('spine')).length).toBeGreaterThan(3);
    expect(b('orb').eggs.some((e) => e.name === 'neck')).toBe(false);
    expect(SILHOUETTES[b('orb').silhouette].neck).toBe('merged');
    expect(b('stander').digits.at.length).toBeGreaterThan(2);
  });

  it('a species\' measures size its ears: a mouse\'s bigger and rounder than a squirrel\'s; never below the module', () => {
    const mouse = speciesMeasures('mouse').ear, squirrel = speciesMeasures('squirrel').ear;
    expect(mouse.size).toBeGreaterThan(squirrel.size); expect(mouse.round).toBeGreaterThan(squirrel.round);
    for (const id of Object.values(ONE)) expect(speciesMeasures(id).ear?.size ?? 1).toBeGreaterThanOrEqual(1);
  });

  it('a bird goes through the whole pipeline: one skin on the rig, its wings bound to the hands, no finger bones', () => {
    const P = mascotPlanFromSheet(rollMascot({ facets: { style: 'feature', animal: ONE.bird } })), plan = P.create.spec.plan;
    const bound = new Set(Object.values(plan.segments[0].bind.blend).flatMap((w) => Object.keys(w)));
    expect(bound.has('handR') && bound.has('head') && bound.has('pelvis')).toBe(true);
    expect(plan.rig.bones.some((b) => /^digit/.test(b.id))).toBe(false);
  }, 120_000);

  // (one species per silhouette, the first the roster reads as it)
  const SIL = {}; for (const id of Object.keys(SPECIES)) { const f = SPECIES[id].family, s = silhouetteOf(id, f, PLAN_OF[f] ?? 'stander'); SIL[s] ??= id; }

  it('the silhouettes vary with the body: every one is cast from the roster, each a different set of masses and proportions', () => {
    expect(Object.keys(SIL).sort()).toEqual(Object.keys(SILHOUETTES).sort());
    const shapes = Object.entries(SIL).map(([s, id]) => { const b = featureBuild(animalCard(id)); expect(b.silhouette, id).toBe(s); return JSON.stringify([b.heads, b.eggs.filter((e) => e.bone !== 'head').map((e) => [e.c, e.r])]); });
    expect(new Set(shapes).size).toBe(shapes.length);
    expect(featureBuild(animalCard('raccoon')).silhouette).toBe('pear');
  });

  it('a belly is the species\' own: none where the roster shows no belly, its own colour where it does, a breast on a bird', () => {
    for (const id of Object.values(SIL)) {
      const b = featureBuild(animalCard(id)), c = speciesMetrics(id).bellyContrast, tune = ['procyonid', 'canine', 'feline'].includes(SPECIES[id].family);
      const pale = b.marks.find((m) => m.name === 'belly');
      if (!tune && b.belly !== 'tuxedo' && (c == null || Math.abs(c) < BELLY_CONTRAST)) { expect(b.belly, id).toBe('none'); expect(pale, id).toBeUndefined(); }
      else expect(pale?.regions.length, id).toBeGreaterThan(0);
    }
    const birdId = Object.keys(SPECIES).find((id) => PLAN_OF[SPECIES[id].family] === 'bird' && silhouetteOf(id, SPECIES[id].family, 'bird') === 'perch' && Math.abs(speciesMetrics(id).bellyContrast ?? 0) >= BELLY_CONTRAST);
    expect(featureBuild(animalCard(birdId)).belly).toBe('breast');
  });

  it('a standing bird is built as a bird: wings folded on its sides as panels, primaries back along the fold, thin legs, toes', () => {
    const b = featureBuild(animalCard(SIL.perch));
    const wing = b.eggs.find((e) => e.name === 'wingR'), prim = b.tufts.filter((t) => t.name.startsWith('primary'));
    expect(wing && b.eggs.some((e) => e.name === 'wingForeR')).toBe(true);
    expect(Math.min(...wing.r)).toBeLessThan(wing.r[1] / 4);                     // (a panel: thin)
    for (const t of prim) expect(t.aim[1], t.name).toBeLessThan(-0.5);           // (folded back, not spread out)
    expect(b.limbs.filter((l) => /^toe/.test(l.name)).length).toBe(4);
    // (round legs, a mascot's: thinner than a mammal's, never a stick)
    const shin = b.limbs.find((l) => l.name === 'shinR');
    expect(shin.rb).toBeGreaterThanOrEqual(FEATURE_PROPORTION.birdLeg[1]); expect(shin.rb).toBeLessThan(FEATURE_PROPORTION.leg[1]);
    // (the wing carries the silhouette: a wide panel, the primaries reaching back past the body's rear, the trailing edge
    // scalloped)
    const body = b.eggs.filter((e) => ['belly', 'chest'].includes(e.name)), A = b.eggs.find((e) => e.name === 'belly').u, [, rear] = extentAlong(body, A);
    const tipAlong = (t) => t.root.reduce((acc, x, k) => acc + (x + t.aim[k] * t.len) * A[k], 0) / Math.hypot(...A);
    expect(Math.max(...prim.map(tipAlong))).toBeGreaterThan(rear - 0.3);
    expect(wing.r[1]).toBeGreaterThan(0.5);
    expect(b.tufts.filter((t) => t.name.startsWith('secondary')).length).toBeGreaterThan(2);
    expect(b.tufts.some((t) => t.name.startsWith('crown'))).toBe(false);
    // (the folded wing reads in profile: its panel stands out of the body, not sunk in its flank; its tip lies back along
    // the body, never splayed sideways)
    const trunk = b.eggs.filter((e) => ['belly', 'chest'].includes(e.name)).map((e) => egg(e));
    expect(Math.min(...trunk.map((E) => eggDistance(E, wing.c)))).toBeGreaterThan(0);
    for (const t of prim) expect(Math.abs(t.aim[0]), t.name).toBeLessThan(0.2);
    // (the beak is broad at its root: wider across than deep, from the front a wedge, never a spike)
    const beak = b.tufts.find((t) => t.name === 'beak'), side = b.tufts.find((t) => t.name === 'beakSideR');
    if (beak) expect(side.root[0] + side.r).toBeGreaterThan(beak.r * 1.15);
  });

  it('a frog sits on its own all fours: its hands planted, its webbed feet on its ankles, its eyes bulging on domes on top', () => {
    const id = SIL.squat, b = featureBuild(animalCard(id));
    expect(b.fours, id).toBeUndefined();                                         // (a sitter: never fitted to drop onto them)
    expect(b.joints.knuckles[2], id).toBeLessThan(0.2);                          // (its hands reach the floor where it sits)
    const foot = b.eggs.find((e) => e.name === 'footR');
    expect(eggDistance(egg(foot), b.joints.ankle), id).toBeLessThan(0.12);      // (the foot on the ankle, not a disc apart)
    expect(b.tufts.filter((t) => /^webToe/.test(t.name)).length).toBe(3);
    expect(b.eggs.some((e) => e.name === 'eyeDomeR')).toBe(true); expect(b.eye.el).toBeGreaterThan(35);
    expect(b.eggs.some((e) => e.name === 'chin')).toBe(true);                   // (the frog's own muzzle, a pale throat)
    expect(b.marks.some((m) => m.name === 'throat')).toBe(true);
  });

  it('a bird rests open and bright: its default face a bright one, its lids more open and its brows higher, every clip the same', () => {
    // (the roll leans a feature bird bright; an asked face wins; one bird chosen in code)
    const bird = Object.keys(SPECIES).find((i) => PLAN_OF[SPECIES[i].family] === 'bird');
    const bright = ['happy', 'grin', 'joy', 'surprised'], rolled = Array.from({ length: 24 }, (_, k) => rollMascot({ facets: { style: 'feature', animal: bird }, seed: k + 1 }).facets.expression);
    expect(rolled.filter((e) => bright.includes(e)).length / rolled.length).toBeGreaterThan(0.75);
    expect(Object.keys(FEATURE_BIRD_LEAN)).toEqual(['expression']);
    expect(rollMascot({ facets: { style: 'feature', animal: bird, expression: 'sad' } }).facets.expression).toBe('sad');
    // (its plan's resting face: carried on the build's eye, a mammal's none)
    expect(featureBuild(animalCard(bird)).eye.rest).toEqual(BIRD_REST); expect(featureBuild(animalCard('raccoon')).eye.rest).toBeUndefined();
    // (on a ball of a head: the upper lid's edge higher and the brow higher with the rest; the brows' channels unchanged)
    const field = ({ x, y, z }) => Math.hypot(x, y, z) - 0.1, H = { C: [0, 0, 0], rx: 0.1, ry: 0.1, rz: 0.1 };
    const mouth = { nose: [0, 0.1, 0], centre: [0, 0.098, -0.012], corner: [0.022, 0.095, -0.016], pivot: [0, 0.08, -0.01], rise: 0.004, sag: 0.001 };
    const eye = { az: 30, el: 4, r: 0.016, proud: 0.42 }, face = (e) => featureFace({ field, H, eye: e, rest: 'happy', mouth, groups: { lid: 'Body', brow: 'Belly' } });
    const plain = face(eye), rested = face({ ...eye, rest: BIRD_REST });
    const lowest = (F, n) => Math.min(...Object.values(F.segments.find((x) => x.name === n).mesh.points).map((p) => p[2]));
    const middle = (F, n) => { const P = Object.values(F.segments.find((x) => x.name === n).mesh.points); return P.reduce((a, p) => a + p[2], 0) / P.length; };
    expect(lowest(rested, 'lidR')).toBeGreaterThan(lowest(plain, 'lidR'));
    expect(middle(rested, 'browR')).toBeGreaterThan(middle(plain, 'browR'));
    for (const x of ['happy', 'determined', 'sad', 'surprised']) for (const k of ['browLiftR', 'browR', 'browL']) expect(rested.channels(x)[k] ?? 0, `${x} ${k}`).toBe(plain.channels(x)[k] ?? 0);
  });

  it('a quadruped is functional: it drops onto all fours, its paws on the floor and its trunk clear of it; big hind legs stay big', () => {
    const quads = Object.entries(SIL).filter(([sil]) => ['pear', 'wedge', 'barrel', 'noodle', 'leggy'].includes(sil)).map(([, id]) => id);
    for (const id of quads) {
      const b = featureBuild(animalCard(id));
      expect(b.fours, id).toBeTruthy();
      expect(b.fours.clearance, id).toBeGreaterThanOrEqual(-FEATURE_FOURS.brush - 1e-6);
      expect(b.fours.shoulder, id).toBeLessThanOrEqual(b.fours.reach + 1e-6);
      expect(b.fours.shoulder, id).toBeGreaterThanOrEqual(FEATURE_FOURS.bend * b.fours.reach - 1e-6);
    }
    // (the species' own limbs: one with big hind legs and one without, chosen from the roster in code)
    const ratio = (id) => speciesLimbs(id).ratio ?? 1, stander = (id) => PLAN_OF[SPECIES[id].family] === 'stander';
    const bigId = Object.keys(SPECIES).find((id) => stander(id) && ratio(id) > FEATURE_FOURS.big + 0.5);
    const evenId = Object.keys(SPECIES).find((id) => stander(id) && ratio(id) > 1 && ratio(id) < 1.3);
    const big = featureBuild(animalCard(bigId)), even = featureBuild(animalCard(evenId));
    expect(big.fit.hind, bigId).toBeGreaterThan(1); expect(even.fit.hind, evenId).toBe(1);
    expect(big.fours.crouch, bigId).toBeGreaterThan(0);        // (it folds its hind legs under it, as a rabbit or a kangaroo does)
    // (an ape's long arms: the fore longer than the hind lengthens the arms)
    const ape = Object.keys(SPECIES).find((id) => stander(id) && ratio(id) < 0.9);
    expect(featureBuild(animalCard(ape)).fit.arms, ape).toBeGreaterThan(1.1);
  });

  it('a bird\'s side silhouette falls in φ: the tail, the head and the body as 1 : φ : φ² (the beak apart)', () => {
    for (const sil of ['perch', 'wader', 'teardrop']) {
      const id = Object.keys(SPECIES).find((i) => PLAN_OF[SPECIES[i].family] === 'bird' && silhouetteOf(i, SPECIES[i].family, 'bird') === sil), b = featureBuild(animalCard(id));
      const head = extentAlong(b.eggs.filter((e) => ['cranium', 'jaw'].includes(e.name)), [0, 1, 0]), Lh = head[1] - head[0];
      const body = b.eggs.filter((e) => ['belly', 'chest'].includes(e.name)), A = b.eggs.find((e) => e.name === 'belly').u;
      const [lo, hi] = extentAlong(body, A), Lb = hi - lo;
      const TA = A[1] < -0.5 ? A : [0, -1, -0.35].map((x) => x / Math.hypot(1, 0.35)), [, rear] = extentAlong(body, TA);
      // (the tail's middle feathers, each reaching a little short of the full length by its fan angle)
      const f = b.tufts.find((t) => t.name === 'tailFeather1'), Lt = f.root.reduce((acc, x, k) => acc + (x + f.aim[k] * f.len) * TA[k], 0) - rear;
      expect(Lb / Lh, `${id} body:head`).toBeCloseTo(PHI, 1);
      expect(Lh / (Lt / (1 - 14 * 0.004)), `${id} head:tail`).toBeCloseTo(PHI, 1);
    }
  });

  it('a bird\'s beak is its own, and its head matches it: a bill, a hook under a brow, a deep beak, a needle', () => {
    expect(beakParts({ len: 0.8, slender: 1.9, wide: 1.4, droop: 0, hook: 0.04 }).kind).toBe('bill');
    expect(beakParts({ len: 0.8, slender: 1, wide: 0.5, droop: -0.6, hook: -0.08 }).kind).toBe('hook');
    expect(beakParts({ len: 0.6, slender: 0.5, wide: 0.4, droop: -1.3, hook: -0.14 }).kind).toBe('deep');
    expect(beakParts({ len: 1, slender: 4, wide: 0.4, droop: 0, hook: 0.02 }).kind).toBe('needle');
    // (longer and slenderer measures make a longer, thinner beak)
    const a = beakParts({ len: 0.5, slender: 1, wide: 0.4, droop: 0, hook: 0.05 }).tufts[0], c = beakParts({ len: 1, slender: 3, wide: 0.4, droop: 0, hook: 0.05 }).tufts[0];
    expect(c.len).toBeGreaterThan(a.len); expect(c.r / c.len).toBeLessThan(a.r / a.len);
    // (a raptor's head frowns under a brow ridge: the first bird whose own beak is hooked)
    const raptorId = Object.keys(SPECIES).find((i) => PLAN_OF[SPECIES[i].family] === 'bird' && featureBuild(animalCard(i)).tufts.some((t) => t.name === 'beak' && t.curl > 18));
    expect(featureBuild(animalCard(raptorId)).eggs.some((e) => e.name === 'browRidgeR'), raptorId).toBe(true);
  });

  it('a bird\'s plumage is its pattern: a crown of its own colour where its head has one, the legs in theirs', () => {
    const id = Object.keys(SPECIES).find((i) => PLAN_OF[SPECIES[i].family] === 'bird' && plumageOf(i).crown), b = featureBuild(animalCard(id));
    expect(b.marks.find((m) => m.name === 'crown')?.eggs, id).toEqual(expect.arrayContaining(['cranium', 'jaw']));
    expect(b.limbs.find((l) => l.name === 'shinR').group).toBe('Sock');
  });

  it('the style draws no fish: one asked for is drawn as a toon, and the sheet says so', () => {
    const fish = Object.keys(SPECIES).find((i) => FEATURE_EXCLUDES.includes(SPECIES[i].family));
    const sheet = rollMascot({ facets: { style: 'feature', animal: fish } });
    expect(sheet.facets.style).toBe('toon');
    expect(sheet.notes.frame.some((n) => /no fish/.test(n.line))).toBe(true);
  });
});
