// setting.test.js — a game's setting loads both dice and carries its tradition to the body; with none, every roll is
// the roll it was.
process.env.SQLITE_PATH = ':memory:';
import { describe, it, expect } from 'vitest';
import { readSetting, leanOf, leanPriors, tuningOf, mascotWeight, GENRES, ERAS } from './setting.js';
import { rollEgocube } from './egocube.js';
import { rollMascot } from './mascot.js';
import { planFromSheet, KITLESS_ERAS } from './plan.js';
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
    expect(Object.keys(ERAS)).toEqual(expect.arrayContaining(KITLESS_ERAS));
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

  it('an era with no gear for the role leaves the fantasy kit off, and says so', () => {
    const era = KITLESS_ERAS[0], role = 'ranged';
    const P = planFromSheet(rollEgocube({ seed: 2, facets: { role }, setting: { era } }), { dress: undefined });
    expect(P.create.spec.adorn).toBeUndefined();
    expect(P.ledger).toContainEqual(expect.objectContaining({ channel: 'dress', from: `setting.era.${era}`, pending: expect.stringMatching(/no .* gear yet/) }));
    expect(planFromSheet(rollEgocube({ seed: 2, facets: { role } })).create.spec.adorn).toBe('ranger');
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
