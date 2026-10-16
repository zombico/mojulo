// setting.test.js — a game's setting loads both dice and carries its tradition to the body; with none, every roll is
// the roll it was.
process.env.SQLITE_PATH = ':memory:';
import { describe, it, expect } from 'vitest';
import { readSetting, leanOf, leanPriors, tuningOf, mascotWeight, GENRES, ERAS } from './setting.js';
import { rollEgocube } from './egocube.js';
import { rollMascot } from './mascot.js';
import { planFromSheet, KIT_ERAS } from './plan.js';
import { ERA_LOOKS, eraLookOf, lookGear, ERA_GEAR } from './outfit.js';
import { SEEDED_OUTFITS } from '../outfit/styles.js';
import { rollStored, egocubeCreate, readEgocubeKind } from './kind.js';
import { mascotOfPerson } from './mascot-from-person.js';
import { ANIME_SCULPT } from '../polygonizer/anime-sculpt.js';
import { hexLch } from '../polygonizer/station-loft-shade.js';
import { validateHeroSpec } from '@/lib/mcp/tools/layered.js';

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const without = (sheet, k = 'setting') => { const { [k]: _x, ...rest } = sheet; return rest; };
const share = (sheets, pick) => sheets.filter(pick).length / sheets.length;
// one case per procedure, chosen from the tables: a genre that has no children in it, one that leans hard to one role
const COMBAT = Object.keys(GENRES).find((g) => GENRES[g].person.age?.child === 0);
const [ROLE_GENRE, ROLE] = Object.entries(GENRES).flatMap(([g, G]) => Object.entries(G.person.role || {}).map(([r, w]) => [g, r, w])).sort((a, b) => b[2] - a[2])[0];
const RAMPS = [{ name: 'paint', stops: ['#202020', '#604030', '#a06040', '#d09060', '#f0d0a0'] }, { name: 'timber', stops: ['#101830', '#203060', '#3050a0'] }];

describe('the setting', () => {
  it('reads its words and refuses the rest by name', () => {
    expect(readSetting({ tradition: 'anime', era: 'rustic', genre: 'farm', ramps: RAMPS })).toBeTruthy();
    expect(() => readSetting({ mood: 'grim' })).toThrow(/'mood' is not a setting word/);
    expect(() => readSetting({ tradition: 'manga' })).toThrow(/tradition is 'anime' or 'western'/);
    expect(() => readSetting({ genre: 'golf' })).toThrow(/genre is a quick game's goal/);
    expect(() => readSetting({ ramps: [{ name: 'x', stops: ['red'] }] })).toThrow(/ramps are/);
    expect(() => readSetting({ lean: { robot: {} } })).toThrow(/lean\.robot is not a tuning/);
    expect(() => readSetting({ lean: { person: { age: { child: -1 } } } })).toThrow(/a weight ≥ 0/);
  });

  it('with nothing to say, rolls every person and mascot as it always did', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const roll = { seed, brief: seed % 2 ? 'a weary paladin' : '' };
      expect(without(rollEgocube({ ...roll, setting: {} }))).toEqual(rollEgocube(roll));
      expect(without(rollMascot({ ...roll, setting: {} }))).toEqual(rollMascot(roll));
    }
    expect(rollEgocube({ seed: 3 })).not.toHaveProperty('setting');
    expect(leanOf(undefined)).toEqual({});
    expect(leanPriors({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it('leans the dice toward the people its genre has', () => {
    const plain = SEEDS.map((seed) => rollEgocube({ seed }));
    const leaned = SEEDS.map((seed) => rollEgocube({ seed, setting: { genre: ROLE_GENRE } }));
    expect(share(leaned, (s) => s.facets.role === ROLE)).toBeGreaterThan(share(plain, (s) => s.facets.role === ROLE) + 0.25);
    // a genre with no children in it rolls none, unless one is asked for: the operator's ask beats the setting
    expect(SEEDS.map((seed) => rollEgocube({ seed, setting: { genre: COMBAT } })).some((s) => s.facets.age === 'child')).toBe(false);
    expect(rollEgocube({ seed: 1, facets: { age: 'child' }, setting: { genre: COMBAT } }).facets.age).toBe('child');
    // the creator's own lean multiplies over the tables'
    expect(leanOf({ genre: ROLE_GENRE, lean: { person: { role: { [ROLE]: 0.5 } } } }).role[ROLE]).toBe(GENRES[ROLE_GENRE].person.role[ROLE] * 0.5);
    // a lean that leaves nothing standing is ignored, not a roll with no answer
    expect(leanPriors({ a: 1, b: 1 }, { a: 0, b: 0 })).toEqual({ a: 1, b: 1 });
  });

  it('leans an era\'s roles: no spells in the modern world', () => {
    const lean = leanOf({ era: 'modern' });
    expect(lean.role.caster).toBeLessThan(1);
    expect(Object.keys(ERAS)).toEqual(expect.arrayContaining(KIT_ERAS));
  });

  it('chooses person or mascot on its own die, at its genre\'s weight', () => {
    expect(tuningOf({}, 1)).toBe('person');
    expect(mascotWeight({})).toBe(0);
    const genre = Object.keys(GENRES).sort((a, b) => GENRES[b].weight - GENRES[a].weight)[0];
    const tunings = SEEDS.map((seed) => tuningOf({ genre }, seed, 'racer'));
    expect(share(tunings.map((t) => ({ t })), (x) => x.t === 'mascot')).toBeGreaterThan(0.5);
    expect(tuningOf({ genre }, 7, 'racer')).toBe(tuningOf({ genre }, 7, 'racer'));
  });
});

describe('the tradition, carried to the body', () => {
  const anime = { tradition: 'anime', ramps: RAMPS };

  it('an anime game\'s person wears the anime head, its proportions, the light and its graphic face', () => {
    const sheet = SEEDS.map((seed) => rollEgocube({ seed, setting: anime })).find((s) => s.ancestry.door === 'hero' && Object.values(s.derives).flat().some((x) => x.startsWith('sculpt.')));
    const P = planFromSheet(sheet);
    expect(P.create).toMatchObject({ as: 'hero', toon: { light: true }, spec: { head: 'anime', proportions: 'anime' } });
    for (const [k, v] of Object.entries(P.create.spec.sculpt)) {
      const [lo, hi] = ANIME_SCULPT.RANGES[k];
      expect(v).toBeGreaterThanOrEqual(lo); expect(v).toBeLessThanOrEqual(hi);
      expect(v).not.toBe(ANIME_SCULPT.DEFAULT[k]);
    }
    expect(P.ledger.some((r) => r.at?.includes('spec.sculpt'))).toBe(true);
    expect(validateHeroSpec(P.create.spec)).toEqual([]);
    // dressed in the world's colours
    expect(P.create.spec.palette).toHaveProperty('Top');
    expect(P.create.spec.palette).toHaveProperty('Bottom');
    // the same sheet with no setting is the western landmark body, as before
    const plain = planFromSheet(rollEgocube({ seed: sheet.seed }));
    expect(plain.create.spec.head).toBeUndefined();
    expect(plain.create.toon).toBeUndefined();
  });

  it('dresses a cast in the world\'s colours, cloth never reading as the skin under it, top and bottom apart', () => {
    const L = (h) => hexLch(h)[0];
    const plans = SEEDS.slice(0, 16).map((seed) => planFromSheet(rollEgocube({ seed, setting: anime }))).filter((p) => p.create.as === 'hero');
    for (const { create: { spec: { palette: p } } } of plans) {
      expect(Math.abs(L(p.Top) - L(p.Skin))).toBeGreaterThanOrEqual(18);
      expect(Math.abs(L(p.Bottom) - L(p.Skin))).toBeGreaterThanOrEqual(18);
      expect(Math.abs(L(p.Top) - L(p.Bottom))).toBeGreaterThanOrEqual(10);
    }
    // most of it from the ramps themselves, and not one shirt for the whole cast
    const stops = new Set(RAMPS.flatMap((r) => r.stops));
    expect(plans.filter((p) => stops.has(p.create.spec.palette.Top)).length).toBeGreaterThan(plans.length / 2);
    expect(new Set(plans.map((p) => p.create.spec.palette.Top)).size).toBeGreaterThan(2);
    // a world with no ramps (a room kit) dresses by the archetype's own palette
    const roomy = planFromSheet(rollEgocube({ seed: 1, setting: { tradition: 'anime' } }));
    expect(roomy.create.spec.palette.Top).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('a modern or future person wears its rolled look and the role\'s kit as the look wears it, never the jerkin or the ranger\'s kit', () => {
    const era = KIT_ERAS[0], role = 'frontline';
    const sheet = rollEgocube({ seed: 2, facets: { role }, setting: { era } }), P = planFromSheet(sheet, { dress: undefined }), look = eraLookOf(sheet);
    expect(P.create.spec.adorn).toBeUndefined();
    expect(P.create.spec.detail).toBeUndefined();
    expect(P.create.spec.outfit.style).toBe(look.style);
    expect((P.create.spec.outfit.pieces ?? []).map((p) => p.kind)).toEqual(lookGear(ERA_GEAR[era], look, role).map((g) => g.kind));
    expect(P.ledger).toContainEqual(expect.objectContaining({ channel: 'dress', from: `setting.era.${era}`, at: expect.stringMatching(/spec\.outfit/) }));
    expect(P.ledger.some((r) => r.pending && r.from.startsWith('setting.'))).toBe(false);
    expect(planFromSheet(rollEgocube({ seed: 2, facets: { role } })).create.spec.adorn).toBe('ranger');
  });

  it('a crowd of one role is several looks, leaned by who each one is', () => {
    const era = KIT_ERAS[0], styles = new Set();
    for (let seed = 1; seed <= 10; seed++) styles.add(eraLookOf(rollEgocube({ seed, facets: { role: 'frontline' }, setting: { era } })).id);
    expect(styles.size).toBeGreaterThan(2);
    // a ruler who works the room is most often in a suit; a frontline hero most often in tactical clothes
    const count = (facets) => { const n = {}; for (let seed = 1; seed <= 24; seed++) { const id = eraLookOf(rollEgocube({ seed, facets, setting: { era } })).id; n[id] = (n[id] ?? 0) + 1; } return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0]; };
    expect(count({ archetype: 'ruler', role: 'controller' })).toBe('suit');
    expect(count({ archetype: 'hero', role: 'frontline' })).toBe('tactical');
    for (const looks of Object.values(ERA_LOOKS)) for (const L of Object.values(looks)) expect(SEEDED_OUTFITS[L.style]).toBeDefined();
  });

  it('a look wears the kit it can: a suit nothing over its clothes, tactical clothes the whole carrier; its own tones stand', () => {
    const kit = ERA_GEAR.modern;
    expect(lookGear(kit, { ...ERA_LOOKS.modern.suit }, 'frontline')).toEqual([]);
    expect(lookGear(kit, { ...ERA_LOOKS.modern.biker }, 'frontline').map((g) => g.kind)).toEqual([]);
    expect(lookGear(kit, { ...ERA_LOOKS.modern.tactical }, 'frontline').map((g) => g.kind)).toEqual(['vest', 'kneepads']);
    expect(lookGear(kit, { ...ERA_LOOKS.modern.tactical }, 'flanker')).toEqual(kit.gear.flanker.map((g) => ({ ...g })));
    expect(lookGear(kit, { ...ERA_LOOKS.modern.fatigues }, 'frontline')[0]).toMatchObject({ kind: 'vest', cut: 'slick' });
    // a biker's jacket is black hide in any world
    for (let seed = 1; seed <= 30; seed++) {
      const sheet = rollEgocube({ seed, facets: { archetype: 'outlaw', role: 'flanker' }, setting: { era: 'modern', ramps: [{ name: 'timber', stops: ['#3b2a1a', '#7a5a3a', '#c8a070'] }] } });
      if (eraLookOf(sheet).id !== 'biker') continue;
      expect(planFromSheet(sheet).create.spec.palette.Outer).toBe(SEEDED_OUTFITS.biker.tones.Outer);
      return;
    }
    throw new Error('no outlaw flanker rolled the biker look in 30 seeds');
  });

  it('a designed dress in a modern or future world carries the era\'s kit, never the myth\'s', () => {
    const myth = new Set(['quiver', 'baldric', 'cloak', 'mantle']);
    for (const era of KIT_ERAS) {
      const P = planFromSheet(rollEgocube({ seed: 5, facets: { role: 'ranged', archetype: 'outlaw' }, setting: { era } }), { dress: 'designed' });
      const kinds = P.create.spec.outfit.pieces.map((p) => p.kind);
      expect(kinds.filter((k) => myth.has(k))).toEqual([]);
    }
    // with no setting the same roll keeps the ranger's quiver
    const kinds = planFromSheet(rollEgocube({ seed: 5, facets: { role: 'ranged', archetype: 'outlaw' } }), { dress: 'designed' }).create.spec.outfit.pieces.map((p) => p.kind);
    expect(kinds).toContain('quiver');
  });

  it('a mascot takes the tradition as its style, under the operator\'s own word', () => {
    expect(rollMascot({ seed: 4, setting: { tradition: 'anime' } }).facets.style).toBe('anime');
    expect(rollMascot({ seed: 4, setting: { tradition: 'western' } }).facets.style).toBe('toon');
    expect(rollMascot({ seed: 4, brief: 'western', setting: { tradition: 'anime' } }).facets.style).toBe('toon');
    expect(rollMascot({ seed: 4, setting: { tradition: 'anime' } }).given).not.toContain('style');
    // a person read into a mascot keeps the game it was made for
    expect(mascotOfPerson(rollEgocube({ seed: 4, setting: { tradition: 'anime' } })).facets.style).toBe('anime');
  });

  it('a stored cube keeps the setting it was rolled in, and lowers it', () => {
    const m = rollStored(readEgocubeKind({ kind: 'egocube', roll: { seed: 9, setting: anime } }));
    expect(m.sheet.setting).toEqual(anime);
    const C = egocubeCreate(m, { dress: 'kit' });
    if (C.create.as === 'hero') expect(C.create).toMatchObject({ toon: { light: true }, spec: { head: 'anime' } });
  });
});
