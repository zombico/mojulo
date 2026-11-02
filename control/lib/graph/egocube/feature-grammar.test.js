// The feature grammar (feature-grammar.js): the converter's laws, one species per body plan (chosen in code from the roster,
// never a catalog walk). Every plan builds; structure and decoration are apart (the decoration dials at 0 leave every mass
// where it was and lay no tuft and no marking layer); a plan's own solution is there (a bird's wings and beak, a hoofed
// animal's hooves, a scaled skin's spines, an orb's missing neck); a species' measures size its ears; and a plan other
// than the raccoon's goes through the whole pipeline to one skin on the rig. The silhouettes vary with the species' body
// (one per silhouette, chosen from the roster in code), the belly is the species' own or none, a bird stands as a bird.
// A quadruped is functional (it drops onto all fours: its paws reach the floor, its trunk clears it, big hind legs stay
// big); a bird's side silhouette falls in φ, its beak is its own and its wings carry its silhouette; no fish is drawn.
import { describe, it, expect } from 'vitest';
import { featureBuild, PLAN_OF, PLANS, speciesMeasures, FEATURE_PROPORTION, FEATURE_EXCLUDES, BIRD_REST, SPECIES_KIT } from './feature-grammar.js';
import { featureFace } from './feature-face.js';
import { FEATURE_BIRD_LEAN } from './mascot.js';
import { FEATURE_FOURS, FEATURE_DOG, speciesLimbs } from './feature-function.js';
import { PHI, beakParts, plumageOf, extentAlong } from './feature-birds.js';
import { SILHOUETTES, silhouetteOf, speciesMetrics, BELLY_CONTRAST, FRONT_RATIO, FRONT_SILHOUETTES } from './feature-silhouettes.js';
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

  it('a horse and a deer read as their animals: a long face, a flowing mane and a hair tail; antlers and big ears', () => {
    // (one species of each family, chosen in code: the first whose own kit does not override the family's)
    const fam = (f) => Object.keys(SPECIES).find((id) => SPECIES[id].family === f && !SPECIES_KIT[id]);
    const horse = featureBuild(animalCard(fam('equine'))), deer = featureBuild(animalCard(fam('cervid'))), stander = featureBuild(animalCard('raccoon'));
    const front = (b) => Math.max(...b.eggs.filter((e) => e.bone === 'head').map((e) => e.c[1] + e.r[0]));
    expect(front(horse)).toBeGreaterThan(front(stander) * 1.4);                  // (the long face)
    expect(horse.tufts.filter((t) => /^mane\d$/.test(t.name) && t.group === 'Mane').length).toBe(6);
    expect(horse.tufts.some((t) => t.name === 'forelock')).toBe(true); expect(horse.tufts.some((t) => /^crown/.test(t.name))).toBe(false);
    expect(horse.tufts.find((t) => t.name === 'tail')).toMatchObject({ group: 'Mane' });
    expect(horse.tufts.find((t) => t.name === 'tail').len).toBeGreaterThan(1);
    expect(deer.tufts.filter((t) => /^antler/.test(t.name)).length).toBe(4);     // (a beam and its three tines)
    const ear = deer.eggs.find((e) => e.name === 'earR');
    expect(ear.u[0]).toBeGreaterThan(0.6);                                        // (out to the side)
    expect(deer.eggs.find((e) => e.name === 'chin').group).toBe('Belly');
    // (no pale cheek discs on a hoofed face)
    for (const b of [horse, deer]) expect(b.marks.some((m) => m.name === 'muzzle')).toBe(false);
    // (the horns' dial still rules the antlers, the mane's the mane)
    expect(featureBuild(animalCard(fam('cervid')), { decor: { horns: 0 } }).tufts.some((t) => /^antler/.test(t.name))).toBe(false);
    expect(featureBuild(animalCard(fam('equine')), { decor: { mane: 0 } }).tufts.some((t) => /^mane|forelock/.test(t.name))).toBe(false);
  });

  it('a long neck stands as one, slim under a raised head; a striped coat is rings from the feet to under the jaw', () => {
    // (one species of each, chosen in code from the kits)
    const longNeck = Object.keys(SPECIES).find((id) => { try { return animalCard(id).kit.neck === 'long'; } catch { return false; } });
    const striped = Object.keys(SPECIES).find((id) => { try { return animalCard(id).kit.pattern === 'stripes'; } catch { return false; } });
    const g = featureBuild(animalCard(longNeck)), neck = g.eggs.find((e) => e.name === 'neckLong'), chest = g.eggs.find((e) => e.name === 'chest');
    expect(g.headLift).toBeGreaterThanOrEqual(FEATURE_PROPORTION.longNeck);
    expect(Math.max(neck.r[1], neck.r[2])).toBeLessThan(Math.max(chest.r[1], chest.r[2]) / 2);   // (slim: never a second body)
    const z = featureBuild(animalCard(striped)), rings = z.marks.find((m) => m.name === 'stripes');
    expect(rings.cut).toBe(true); expect(rings.bands.length).toBeGreaterThanOrEqual(8);
    const headBase = z.neckZ + z.headLift;
    for (const B of rings.bands) expect(B.c[2]).toBeLessThan(headBase);         // (never across the face)
    // (as a body wears them: over the legs rings, above them arcs from the spine (the back) round each flank to a point
    // at the belly; a cat's stop short of its pale belly)
    const legs = rings.bands.filter((B) => B.c[2] < z.joints.hip[2] - 0.1), body = rings.bands.filter((B) => B.c[2] >= z.joints.hip[2] - 0.1);
    expect(legs.length).toBeGreaterThan(0); for (const B of legs) expect(B.arc).toBeUndefined();
    expect(body.length).toBeGreaterThan(2); for (const B of body) { expect(B.arc.back).toEqual([0, -1, 0]); expect(B.arc.end).toBeGreaterThan(90); }
    const stripedOf = (pred) => Object.keys(SPECIES).find((id) => { try { return pred(SPECIES[id].family) && animalCard(id).kit.pattern === 'stripes'; } catch { return false; } });
    const endOf = (id) => featureBuild(animalCard(id)).marks.find((m) => m.name === 'stripes').bands.find((B) => B.arc).arc.end;
    const cat = stripedOf((f) => f === 'feline'), other = stripedOf((f) => f !== 'feline');
    if (other) expect(endOf(other)).toBe(180);                                    // (a zebra's meet under it)
    if (cat) expect(endOf(cat)).toBeLessThan(180);                                // (a cat's stop short of its pale belly)
    expect(featureBuild(animalCard(striped), { decor: { markings: 0 } }).marks.some((m) => m.name === 'stripes')).toBe(false);
    // (a reticulated coat: a network of patches in its own colour, below the head)
    const net = Object.keys(SPECIES).find((id) => { try { return featureBuild(animalCard(id)).marks.some((m) => m.name === 'network'); } catch { return false; } });
    const nb = featureBuild(animalCard(net)), mk = nb.marks.find((m) => m.name === 'network');
    expect(mk).toMatchObject({ group: 'Spot', cut: true }); expect(mk.cells[0].seeds.length).toBeGreaterThan(20);
    expect(mk.cells[0].top).toBeLessThan(nb.neckZ + nb.headLift);
    expect(featureBuild(animalCard(net)).marks.find((m) => m.name === 'network').cells[0].seeds).toEqual(mk.cells[0].seeds);   // (seeded: the same every time)
  });

  it('a moose wears broad flat palms and a big droopy nose; a cat has a nose on pale whisker pads', () => {
    const palmate = Object.keys(SPECIES_KIT).find((id) => SPECIES_KIT[id].horns === 'palmate'), m = featureBuild(animalCard(palmate));
    const palm = m.eggs.find((e) => e.name === 'palmR');
    expect(palm.group).toBe('Horn');
    expect(Math.min(...palm.r)).toBeLessThan(Math.max(...palm.r) / 5);            // (flat: a plate, never a club)
    expect(m.tufts.filter((t) => /^palmTine/.test(t.name)).length).toBeGreaterThanOrEqual(4);
    expect(m.tufts.some((t) => /^antlerTine/.test(t.name))).toBe(false);          // (not the deer's branching ones)
    // (its broad face to the front: the plate's thin axis mostly front to back)
    const U = palm.u.map((x) => x / Math.hypot(...palm.u)), h = palm.hint, d = h[0] * U[0] + h[1] * U[1] + h[2] * U[2];
    const V = [h[0] - U[0] * d, h[1] - U[1] * d, h[2] - U[2] * d].map((x, _, a) => x / Math.hypot(...a)), W = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
    expect(Math.abs(W[1])).toBeGreaterThan(0.8);
    // (its big droopy nose: a bulb past the end of its face and hanging below it, fat at its foot, its nostrils dark)
    const face = m.eggs.find((e) => e.name === 'muzzle'), bulb = m.eggs.find((e) => e.name === 'noseBulb');
    expect(bulb.c[1]).toBeGreaterThan(face.c[1]); expect(bulb.c[2]).toBeLessThan(face.c[2]);
    expect(Math.max(...bulb.r)).toBeGreaterThan(Math.max(face.r[1], face.r[2])); expect(bulb.u[2]).toBeGreaterThan(0.8);
    expect(m.eggs.find((e) => e.name === 'nostrilR').group).toBe('Ink');
    // (one cat, chosen in code: its nose an inverted triangle at the top of two pale whisker pads and a pale chin)
    const cat = Object.keys(SPECIES).find((id) => SPECIES[id].family === 'feline' && !SPECIES_KIT[id]), c = featureBuild(animalCard(cat));
    const nose = c.eggs.find((e) => e.name === 'nose');
    expect(nose.group).toBe('Nose'); expect(nose.u[2]).toBeLessThan(-0.8); expect(nose.e).toBeGreaterThan(0.4);   // (its point down)
    expect(c.eggs.some((e) => e.name === 'padR')).toBe(true);
    expect(c.marks.find((x) => x.name === 'throat').eggs).toEqual(expect.arrayContaining(['padR', 'padL', 'chin']));
  });

  it('from the front a standing animal reads thigh : body : thigh as 1 : 4 : 1, the thighs alongside the body', () => {
    // (one species per standing silhouette, chosen in code; the function may grow big hind legs after, so the ones it
    // leaves as designed)
    for (const sil of FRONT_SILHOUETTES) {
      const id = Object.keys(SPECIES).find((i) => { try { return ['stander', 'hoofed', 'reptile'].includes(PLAN_OF[SPECIES[i].family]) && silhouetteOf(i, SPECIES[i].family, PLAN_OF[SPECIES[i].family]) === sil && featureBuild(animalCard(i)).fit?.hind === 1; } catch { return false; } });
      if (!id) continue;
      const b = featureBuild(animalCard(id)), belly = b.eggs.find((e) => e.name === 'belly'), h = b.eggs.find((e) => e.name === 'haunchR');
      // (a body too slim for 1 : 4 keeps its thighs at the floor, `least`: never stick legs, the ratio a little thicker)
      const ratio = (2 * belly.r[1]) / (2 * h.r[1]);
      if (h.r[1] > FRONT_RATIO.least + 1e-6) expect(ratio, `${sil}: ${id}`).toBeCloseTo(FRONT_RATIO.body / FRONT_RATIO.thigh, 1);
      else expect(ratio, `${sil}: ${id}`).toBeLessThanOrEqual(FRONT_RATIO.body / FRONT_RATIO.thigh + 1e-6);
      // (the thigh's middle at the body's side, half of it over the belly: never hidden inside the body's outline)
      expect(b.joints.hip[0] - h.r[1] * (1 - FRONT_RATIO.overlap), `${sil}: ${id}`).toBeCloseTo(belly.r[1], 2);
      expect(h.r[1], `${sil}: ${id}`).toBeGreaterThanOrEqual(FRONT_RATIO.least - 1e-9);
    }
  });

  it('everyone on all fours can downward dog: the hips high on straight legs, the rib ball bent down under the pelvis ball, the forepaws on the floor', () => {
    // (one species per silhouette of an animal that goes on all fours, chosen in code: the two-ball trunk's test)
    const seen = new Set();
    for (const id of Object.keys(SPECIES)) {
      let b; try { b = featureBuild(animalCard(id)); } catch { continue; }
      if (!b.fours || seen.has(b.silhouette)) continue;
      seen.add(b.silhouette);
      expect(b.dog, `${b.silhouette}: ${id}`).toBeTruthy();
      expect(b.dog.bow, `${b.silhouette}: ${id}`).toBeGreaterThanOrEqual(FEATURE_DOG.bow - 1e-9);
      expect(b.dog.clearance, `${b.silhouette}: ${id}`).toBeGreaterThan(-FEATURE_FOURS.brush - 1e-6);
      expect(b.dog.shoulder, `${b.silhouette}: ${id}`).toBeLessThanOrEqual(b.dog.reach + 1e-6);
      // (and on all fours the trunk bends at the waist too: the push-up's)
      expect(b.fours.waist, `${b.silhouette}: ${id}`).toBeGreaterThan(0);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
    // (an animal that does not go on all fours (a bird) takes no dog)
    const bird = Object.keys(SPECIES).find((i) => PLAN_OF[SPECIES[i].family] === 'bird');
    if (bird) expect(featureBuild(animalCard(bird)).dog).toBeUndefined();
  });

  it('a rodent has buck teeth; a chunky one a blunt face on whisker pads and its own tail', () => {
    const rodents = Object.keys(SPECIES).filter((id) => SPECIES[id].family === 'rodent');
    const plain = rodents.find((id) => !SPECIES_KIT[id]), b = featureBuild(animalCard(plain));
    const tooth = b.eggs.find((e) => e.name === 'incisorR');
    expect(tooth.group).toBe('Teeth'); expect(tooth.c[2]).toBeLessThan(b.mouth.centre[2]);       // (under the mouth)
    expect(featureBuild(animalCard('hedgehog')).eggs.some((e) => e.group === 'Teeth')).toBe(false); // (no rodent)
    // (the chunky ones, each its own face and tail: chosen from the species kit)
    const chunky = rodents.filter((id) => SPECIES_KIT[id]?.muzzle === 'blunt');
    expect(chunky.length).toBeGreaterThanOrEqual(3);
    for (const id of chunky) { const c = featureBuild(animalCard(id)); expect(c.eggs.some((e) => e.name === 'padR'), id).toBe(true); expect(c.eggs.some((e) => e.group === 'Teeth'), id).toBe(true); }
    const paddle = rodents.find((id) => SPECIES_KIT[id]?.tail === 'paddle'), p = featureBuild(animalCard(paddle));
    const pad = p.eggs.find((e) => e.name === 'tail0'); expect(pad.c[2] - pad.r[2]).toBeLessThan(0.1);   // (lying on the ground)
    expect(Math.min(...pad.r)).toBeLessThan(Math.max(...pad.r) / 4);                                     // (flat)
    const tailless = rodents.find((id) => SPECIES_KIT[id]?.tail === 'none');
    expect(featureBuild(animalCard(tailless)).eggs.some((e) => /^tail/.test(e.name))).toBe(false);
    // (the capybara: the roster's own, its boxy head longer than a stander's, its coat short: no crown)
    const capy = featureBuild(animalCard('capybara'));
    expect(capy.eggs.find((e) => e.name === 'cranium').r[0]).toBeGreaterThan(featureBuild(animalCard(plain)).eggs.find((e) => e.name === 'cranium').r[0]);
    expect(capy.tufts.some((t) => /^crown/.test(t.name))).toBe(false);
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
