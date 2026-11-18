import { describe, it, expect } from 'vitest';
import { readLook, lookOfBrief, heroLook, lookSpec, LOOK_HAIR, HAIR_COLOURS } from './hero-look.js';
import { egocubeCreate, rollStored } from '../egocube/kind.js';
import { brawlBody } from './quick.js';
import { validateHeroSpec } from '../../mcp/tools/layered.js';

const sheet = (tradition, pole = 'female') => egocubeCreate(rollStored({ kind: 'egocube', roll: { brief: 'a weather witch', facets: { pole }, seed: 5, setting: { tradition } } }));

describe('a look read from a description (lookOfBrief)', () => {
  it('reads the hair\'s length, colour and fall and what hangs loose, and nothing it was not told', () => {
    const { look, read } = lookOfBrief('a weather witch: long white hair down to her waist, a flowing dark cape, a silver circlet');
    expect(look).toEqual({ colour: HAIR_COLOURS.white, hair: 'long', length: 2, cape: 'ankle' });
    expect(read).toContain('to the waist');
    // (the circlet's silver is not the hair's; the cape's dark is not either)
    expect(lookOfBrief('a courier who outran lightning').look).toBe(null);
  });
  it('a style said alone, a colour said as "-haired", a skirt\'s hem from the word before it', () => {
    expect(lookOfBrief('a swordswoman with a black ponytail and a long red skirt').look).toEqual({ hair: 'ponytail', gown: 'ankle' });
    expect(lookOfBrief('a silver-haired knight in a short skirt').look).toEqual({ colour: HAIR_COLOURS.silver, gown: 'knee' });
  });
});

describe('a look said outright (readLook, heroLook)', () => {
  it('is checked word by word, teaching', () => {
    expect(readLook({ hair: 'braid', length: 1.4, colour: 'red', cape: 'shin' })).toEqual({ hair: 'braid', length: 1.4, colour: HAIR_COLOURS.red, cape: 'shin' });
    expect(() => readLook({ hair: 'mohawk' })).toThrow(/style/);
    expect(() => readLook({ length: 4 })).toThrow(/length/);
    expect(() => readLook({ colour: 'plaid' })).toThrow(/colour/);
    expect(() => readLook({ cape: 'ground' })).toThrow(/hem/);
    expect(() => readLook({ hat: true })).toThrow(/look's word/);
  });
  it('its words win over the description\'s; neither said is no look', () => {
    expect(heroLook('long white hair and a cape', { colour: '#112233', cape: false })).toEqual({ hair: 'long', colour: '#112233', cape: false });
    expect(heroLook('a courier', undefined)).toBe(null);
  });
});

describe('a look laid over a sheet (lookSpec, brawlBody)', () => {
  const LOOK = { hair: 'ponytail', length: 1.6, colour: '#eeeeee', cape: 'ankle', gown: true };
  it('in the words each head wears, which the hero door takes; the sheet\'s other pieces and colours kept', () => {
    for (const [tradition, head] of [['anime', 'anime'], ['western', 'landmark']]) {
      const C = sheet(tradition), body = brawlBody(C, false, LOOK), spec = { ...C.create.spec, ...body };
      expect(spec.head, tradition).toBe(head);
      expect(spec.hair[0], tradition).toBe(head === 'anime' ? LOOK_HAIR.ponytail[0] : LOOK_HAIR.ponytail[1]);
      expect(spec.palette.Hair).toBe('#eeeeee');
      expect(spec.palette.Skin).toBe(C.create.spec.palette.Skin);
      const kinds = spec.outfit.pieces.map((p) => p.kind);
      expect(kinds).toEqual(expect.arrayContaining(['cloak', 'gown', ...C.create.spec.outfit.pieces.map((p) => p.kind)]));
      expect(validateHeroSpec(spec), tradition).toEqual([]);
    }
  });
  it('no look lays nothing: the brawler\'s body as it was', () => {
    const C = sheet('western', 'male');
    expect(brawlBody(C, false, null)).toEqual(brawlBody(C));
    expect(lookSpec(null, C.create.spec)).toEqual({});
  });
  it('a length alone lengthens the sheet\'s own style', () => {
    const C = sheet('anime');
    expect(lookSpec({ length: 1.8 }, C.create.spec, 'anime').hair[1]).toEqual({ length: 1.8 });
  });
});
