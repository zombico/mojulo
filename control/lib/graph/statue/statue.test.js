// The statue build on the hero door (statue/expand.js): the cards are data, the refusals name the choices, an absent
// statue is zero bytes, and every card carves, cuts, surfaces and stands on its base.
import { describe, it, expect } from 'vitest';
import { heroRecord, heroPlanOf, expandLayeredManifest, validateHeroSpec } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { SEEDED_STATUES, STATUE_STYLES } from './styles.js';
import { validateStatueBuild, validateStatueCard, statueHero, statueWords, statueMaterial, statueBaseOf, STATUE_LAWS_VERSION } from './expand.js';
import { STATUE_MATERIALS, SEATED_POSE, MOUNTED_POSE, MOUNT_GROUP } from './principles.js';
import { validateCreatureStatue, creatureStatue, saddleOf } from './creature.js';
import { animalWorldFaces } from '../polygonizer/figure-render.js';
import { ZOO_BUILDS } from '../polygonizer/figure-animal-build.js';
import { THRONE_GROUP } from './base.js';
import { validateOutfitCard } from '../outfit/styles.js';

const hero = (spec) => expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
const scene = async (spec) => { const m = hero(spec); const { payload } = await resolveWorldScene({ ref: 'x', title: 't', manifest: m }); return { m, faces: payload.faces.filter((f) => !f.studio) }; };
const zRange = (faces) => { let lo = Infinity, hi = -Infinity; for (const f of faces) for (const c of f.corners) { lo = Math.min(lo, c[2]); hi = Math.max(hi, c[2]); } return [lo, hi]; };

describe('the statue cards', () => {
  it('are plain JSON and valid, with valid drapery', () => {
    for (const [id, card] of Object.entries(SEEDED_STATUES)) {
      expect(JSON.parse(JSON.stringify(card))).toEqual(card);
      expect(card.id).toBe(id);
      expect(validateStatueCard(card)).toEqual([]);
      for (const s of ['male', 'female']) if (card.drape?.[s]) expect(validateOutfitCard(card.drape[s])).toEqual([]);
      expect(card.basis).toBe('unverified');
      expect(card.after.length).toBeGreaterThan(0);
    }
  });
});

describe('refusals name the choices', () => {
  const errs = (statue, spec = {}) => validateStatueBuild(statue, spec).join('\n');
  it('a build field, a card, a material, a format, a loss, a base, a dial', () => {
    expect(errs('doric')).toMatch(/not a card \(archaic, classical/);
    expect(errs({ type: 'statue', material: 'jade' })).toMatch(/statue.material: one of marble/);
    expect(errs({ type: 'statue', crop: 'head' })).toMatch(/statue.crop: one of full, bust, herm, torso/);
    expect(errs({ type: 'statue', lose: ['nose'] })).toMatch(/'nose' is not a loss word \(head, handR/);
    expect(errs({ type: 'statue', base: 'column' })).toMatch(/statue.base: one of none, block/);
    expect(errs({ type: 'statue', dials: { wear: 2 } })).toMatch(/wear: a number 0–1/);
    expect(errs({ type: 'statue', dials: { age: 1 } })).toMatch(/not a dial \(wear\)/);
    expect(errs({ type: 'statue', colour: 'red' })).toMatch(/statue.colour: not a build field/);
    expect(errs({ type: 'statue', laws: 99 })).toMatch(/statue laws 1/);
  });
  it('the bodies it is not carved from yet, and a headless bust', () => {
    expect(errs('classical', { head: 'anime' })).toMatch(/anime head's graphic face is not carved yet/);
    expect(errs('classical', { gear: { right: { item: 'sword' } } })).toMatch(/held gear is not carved yet/);
    expect(errs({ type: 'statue', crop: 'bust', lose: ['head'] })).toMatch(/a bust is a head/);
    expect(validateHeroSpec({ statue: 'doric' }).join('\n')).toMatch(/not a card/);
  });
});

describe('absent is zero bytes', () => {
  it('no statue: no key on the record, the hero untouched, no base and no surface tags', async () => {
    const rec = heroRecord({ cast: 'male' });
    expect('statue' in rec).toBe(false);
    expect(statueHero(rec)).toBe(rec);
    const m = hero({ cast: 'male' });
    expect(m.recipe.statue).toBeUndefined(); expect(m.recipe.surfaces).toBeUndefined();
    const { faces } = await scene({ cast: 'male' });
    expect(faces.some((f) => f.group === 'base' || f.pbr || f.metal)).toBe(false);
  });
  it('a style word is stored as its build, stamped with the laws; the card hair set at mint', () => {
    const rec = heroRecord({ cast: 'male', statue: 'archaic' });
    expect(rec.statue).toEqual({ type: 'statue', style: 'archaic', laws: STATUE_LAWS_VERSION });
    expect(rec.hair.style).toBe('braid');
    expect(heroRecord({ cast: 'male', statue: 'archaic', hair: 'crew' }).hair.style).toBe('crew');   // the hero's own wins
  });
});

describe('passes 1 and 2: the card beneath the hero', () => {
  it('stands, stills and drapes when the hero names none; its own words win', () => {
    const rec = heroRecord({ cast: 'female', statue: 'archaic' });
    const h = statueHero(rec, { female: true });
    expect(h.gesture).toEqual(SEEDED_STATUES.archaic.gesture);
    expect(h.clips).toEqual({ idle: false, walk: false, wave: false });
    expect(h.outfit).toEqual({ type: 'outfit', style: SEEDED_STATUES.archaic.drape.female });
    const own = statueHero({ ...rec, gesture: 'guard', clips: { wave: false } }, { female: true });
    expect(own.gesture).toBe('guard'); expect(own.clips).toEqual({ wave: false });
    // the plan carries no motion clip but the stand
    expect(Object.keys(heroPlanOf(rec).clips)).toEqual(['gesture']);
  });
  it('a bust stands at rest; the streamlined mitten drops the card hand words', () => {
    expect(statueHero(heroRecord({ cast: 'male', statue: { type: 'statue', style: 'classical', crop: 'bust' } })).gesture).toBe('rest');
    expect(statueHero(heroRecord({ cast: 'male', statue: 'egyptian' }), { structured: false }).gesture).toEqual({ legL: { x: 0, y: 0.3, z: -1 } });
  });
});

describe('every card carves, surfaces and stands on its base', () => {
  for (const style of STATUE_STYLES) for (const cast of ['male', 'female']) {
    it(`${style} · ${cast}`, async () => {
      const { m, faces } = await scene({ cast, statue: style });
      const words = statueWords(style), base = faces.filter((f) => f.group === 'base'), fig = faces.filter((f) => f.group !== 'base');
      // law 1: one tone over every group
      const { tone } = statueMaterial(words.material, { card: words.card, female: cast === 'female' });
      expect(new Set(Object.values(m.recipe.palette))).toEqual(new Set([tone]));
      // every face carries its surface: metallic on a metal figure, stone elsewhere (and the base always stone)
      expect(faces.every((f) => f.pbr)).toBe(true);
      expect(fig.every((f) => (f.pbr[0] === 1) === !!STATUE_MATERIALS[words.material].metal)).toBe(true);
      expect(base.every((f) => f.pbr[0] === 0)).toBe(true);
      // law 7: on its base, the base on the floor and the figure's lowest point on the base's top
      expect(base.length).toBeGreaterThan(0);
      const [bLo, bHi] = zRange(base), [fLo] = zRange(fig);
      expect(bLo).toBeCloseTo(0, 6); expect(fLo).toBeCloseTo(bHi, 6);
      expect(m.recipe.statue).toMatchObject({ style, material: words.material, crop: words.crop, base: words.base, basis: 'unverified' });
      expect(m.recipe.statue.caption).toMatch(/^inspired by /);
    });
  }
});

describe('pass 3: the formats and the losses', () => {
  const partsOf = (spec) => Object.keys(hero(spec).recipe.parts);
  it('a bust keeps head, neck, chest and the upper arms\' stumps', () => {
    const full = hero({ cast: 'male', statue: 'roman' }).recipe.parts, bust = hero({ cast: 'male', statue: 'roman-bust' }).recipe.parts;
    for (const gone of ['pelvis', 'thighR', 'shankL', 'footR', 'foreArmR', 'handL']) expect(Object.keys(bust).some((n) => n === gone || n.endsWith(`_${gone}`))).toBe(false);
    for (const kept of ['torso', 'neck', 'cranium', 'upperArmR', 'upperArmL']) expect(bust[kept]).toBeTruthy();
    expect(bust.upperArmR.stations.length).toBeLessThan(full.upperArmR.stations.length);
    expect(bust.torso.stations.length).toBeLessThan(full.torso.stations.length);
  });
  it('a torso study has no head and no arms, its thighs and neck cut', () => {
    const P = hero({ cast: 'male', statue: { type: 'statue', style: 'hellenistic', crop: 'torso' } }).recipe.parts;
    for (const gone of ['cranium', 'jaw', 'upperArmR', 'foreArmL', 'shankR']) expect(P[gone]).toBeUndefined();
    expect(P.thighR && P.neck && P.torso).toBeTruthy();
  });
  it('a loss takes the part and what it carries, on its side alone', () => {
    const P = partsOf({ cast: 'male', statue: { type: 'statue', style: 'roman', lose: ['forearmR'] } });
    for (const gone of ['foreArmR', 'handR', 'thumbR', 'indexR']) expect(P.some((n) => n === gone || n.endsWith(`_${gone}`))).toBe(false);
    for (const kept of ['upperArmR', 'foreArmL', 'handL']) expect(P).toContain(kept);
    expect(hero({ cast: 'male', statue: { type: 'statue', style: 'roman', lose: ['forearmR'] } }).recipe.statue.lost).toEqual(expect.arrayContaining(['foreArm', 'hand']));
  });
  it('a lost head leaves a cut neck', () => {
    const P = hero({ cast: 'male', statue: { type: 'statue', lose: ['head'] } }).recipe.parts;
    expect(P.cranium).toBeUndefined(); expect(P.hairCap).toBeUndefined();
    expect(P.neck.stations.length).toBeLessThan(hero({ cast: 'male', statue: 'classical' }).recipe.parts.neck.stations.length);
  });
});

describe('pass 4: carve, paint and wear', () => {
  it('painted keeps the face and the cloth apart, says it is conjecture, and paints the bare body as skin', () => {
    const m = hero({ cast: 'male', statue: { type: 'statue', style: 'egyptian', material: 'painted' } });
    const P = m.recipe.palette;
    expect(P.Skin).not.toBe(P.Bottom); expect(P.Hair).toBe(statueMaterial('painted', { card: SEEDED_STATUES.egyptian }).paint.Hair);
    expect(m.recipe.statue.warnings.join('\n')).toMatch(/reconstruction/);
    // the bare torso (the mannequin's Top zone) is skin under paint; the kilt (a garment) keeps its cloth
    expect(m.recipe.parts.torso.group).toBe('Skin');
    expect(Object.values(m.recipe.parts).some((p) => p.garment && p.group === 'Bottom')).toBe(true);
  });
  it('wear dulls stone and ages bronze to verdigris; a bronze stands on limestone', () => {
    const fresh = statueMaterial('marble'), worn = statueMaterial('marble', { wear: 1 });
    expect(worn.tone).not.toBe(fresh.tone);
    expect(statueMaterial('bronze', { wear: 1 }).surface).toMatchObject({ preset: 'bronze', base: statueMaterial('bronze', { wear: 1 }).tone });
    expect(statueMaterial('bronze').tone).not.toBe(statueMaterial('bronze', { wear: 1 }).tone);
    expect(statueBaseOf('classical')).toMatchObject({ kind: 'block', tone: STATUE_MATERIALS.limestone.tone });
  });
});

describe('law 9: seated', () => {
  const seated = (spec = {}) => ({ cast: 'male', statue: { type: 'statue', style: 'egyptian', stand: 'seated' }, ...spec });
  it('refuses a gesture, a bust and an unknown stand by name', () => {
    expect(validateStatueBuild({ type: 'statue', stand: 'kneeling' }).join()).toMatch(/statue.stand: one of standing, seated/);
    expect(validateStatueBuild({ type: 'statue', stand: 'seated' }, { gesture: 'relaxed' }).join()).toMatch(/seated statue's stand is the seat/);
    expect(validateStatueBuild({ type: 'statue', stand: 'seated', crop: 'bust' }).join()).toMatch(/a bust has no lap/);
    expect(validateStatueCard({ stand: 'lying' }).join()).toMatch(/stand: one of standing, seated/);
  });
  it('sits the figure: the seated stand, its legs free, a long skirt cut at the knee', () => {
    const h = statueHero(heroRecord(seated()));
    expect(h.gesture).toEqual(SEATED_POSE);
    const f = statueHero(heroRecord({ cast: 'female', statue: { type: 'statue', style: 'egyptian', stand: 'seated' } }), { female: true });
    expect(SEEDED_STATUES.egyptian.drape.female.language.bottom.leg).toBe('maxi');
    expect(f.outfit.style.language.bottom.leg).toBe('knee');
    expect(hero(seated()).recipe.statue.stand).toBe('seated');
    expect('stand' in hero({ cast: 'male', statue: 'egyptian' }).recipe.statue).toBe(false);   // standing: the trace as it was
  });
  it('on a throne on its base: the feet on the base top, the lap on the throne, the throne riding with the figure', async () => {
    const { faces } = await scene(seated());
    const base = faces.filter((f) => f.group === 'base'), throne = faces.filter((f) => f.group === THRONE_GROUP), fig = faces.filter((f) => f.group !== 'base' && f.group !== THRONE_GROUP);
    expect(throne.length).toBeGreaterThan(0);
    const [, bHi] = zRange(base), [tLo, tHi] = zRange(throne), [fLo, fHi] = zRange(fig);
    expect(fLo).toBeCloseTo(bHi, 6); expect(tLo).toBeCloseTo(bHi, 6);
    expect(tHi - tLo).toBeGreaterThan(0.15 * (fHi - fLo)); expect(tHi - tLo).toBeLessThan(0.45 * (fHi - fLo));
    // the throne's top meets the figure: some corner of the lap lies on it
    expect(fig.some((f) => f.corners.some((c) => Math.abs(c[2] - tHi) < 1e-6))).toBe(true);
    expect(throne.every((f) => f.pbr && f.pbr[0] === 0)).toBe(true);
  });
});

describe('law 10: the creature filter and the mount', () => {
  it('an animal carved: refusals by name, one material over every face, on an oblong base', async () => {
    expect(validateCreatureStatue({ type: 'statue', material: 'painted' }).join()).toMatch(/painted polychromy has no zones/);
    expect(validateCreatureStatue({ type: 'statue', crop: 'bust' }).join()).toMatch(/statue.crop: not a field/);
    expect(validateCreatureStatue('lion').join()).toMatch(/the animal carved as sculpture/);
    expect(validateCreatureStatue(true)).toEqual([]);
    const B = ZOO_BUILDS.lion, plain = { kind: 'animal', species: 'lion', archetype: B.archetype, opts: B.opts };
    const { payload: a } = await resolveWorldScene({ ref: 'l', title: 'l', manifest: plain });
    const { payload: b } = await resolveWorldScene({ ref: 'l', title: 'l', manifest: { ...plain, statue: { type: 'statue', material: 'bronze' } } });
    expect(a.faces.some((f) => f.pbr)).toBe(false);   // absent: the animal as it was
    const base = b.faces.filter((f) => f.group === 'base'), body = b.faces.filter((f) => f.group !== 'base');
    expect(body.every((f) => f.pbr && f.pbr[0] === 1)).toBe(true); expect(base.every((f) => f.pbr[0] === 0)).toBe(true);
    const [bLo, bHi] = zRange(base), [fLo] = zRange(body); expect(bLo).toBeCloseTo(0, 6); expect(fLo).toBeCloseTo(bHi, 6);
    // oblong: the base runs the body's length
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity; for (const f of base) for (const c of f.corners) { y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); }
    expect(y1 - y0).toBeGreaterThan(1.5 * (x1 - x0));
  });
  it('mounted: the ride stand, refused with a gesture or on a bust; horse and rider on one base, the rider on the saddle', async () => {
    expect(validateStatueBuild({ type: 'statue', stand: 'mounted' }, { gesture: 'guard' }).join()).toMatch(/mounted statue's stand is the ride/);
    expect(validateStatueBuild({ type: 'statue', stand: 'mounted', crop: 'bust' }).join()).toMatch(/a bust has no lap/);
    const spec = { cast: 'male', statue: { type: 'statue', style: 'roman', stand: 'mounted' } };
    expect(statueHero(heroRecord(spec)).gesture).toEqual(MOUNTED_POSE);
    expect(hero(spec).recipe.statue.stand).toBe('mounted');
    const { faces } = await scene(spec);
    const horse = faces.filter((f) => f.group === MOUNT_GROUP), base = faces.filter((f) => f.group === 'base'), rider = faces.filter((f) => f.group !== MOUNT_GROUP && f.group !== 'base');
    expect(horse.length).toBeGreaterThan(1000);
    const [, bHi] = zRange(base), [hLo] = zRange(horse), [rLo, rHi] = zRange(rider), [, hHi] = zRange(horse);
    expect(hLo).toBeCloseTo(bHi, 6);                   // the hooves on the base
    expect(rLo).toBeGreaterThan(bHi + 0.4);            // the rider's feet off the ground, down the flank
    expect(rHi).toBeGreaterThan(hHi);                  // the rider above the horse's ears
    expect(horse.every((f) => f.pbr && f.pbr[0] === 0)).toBe(true);   // marble, as the rider
    // the saddle is on the back, between the rump and the withers
    const [, sy] = saddleOf(horse); let y0 = Infinity, y1 = -Infinity; for (const f of horse) for (const c of f.corners) { y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); }
    expect((sy - y0) / (y1 - y0)).toBeGreaterThan(0.3); expect((sy - y0) / (y1 - y0)).toBeLessThan(0.55);
  });
});

describe('determinism', () => {
  it('the same build regenerates the same recipe and faces', async () => {
    const spec = { cast: 'female', statue: { type: 'statue', style: 'hellenistic', lose: ['armR'], dials: { wear: 0.4 } } };
    expect(JSON.stringify(hero(spec).recipe)).toBe(JSON.stringify(hero(spec).recipe));
    expect(JSON.stringify((await scene(spec)).faces)).toBe(JSON.stringify((await scene(spec)).faces));
  });
});
