// The sport kits: a few words on the hero door lowered every read into the dress the body has (the authored body bare
// with the kit painted on, the realistic body in the athlete's outfit card), the operator's own words over them.
import { describe, it, expect } from 'vitest';
import { readKit, resolveKit, kitDress, kitSportOf, SPORT_KITS, KIT_PATTERNS } from './kits.js';
import { heroRecord, validateHeroSpec, expandLayeredManifest, kittedHero } from '../../mcp/tools/layered.js';

const groupsOf = (recipe) => new Set(Object.values(recipe.parts).flatMap((p) => [...Object.values(p.bandGroups || {}).flat(), p.group, ...Object.values(p.capGroups || {})]));
const worn = (spec) => expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });

describe('the sport kits', () => {
  it('reads the words and refuses what is not a kit, teaching', () => {
    expect(readKit('soccer')).toEqual([]);
    expect(readKit({ sport: 'hockey', colours: ['#112233'], pattern: 'hoops', trim: false, socks: 'ankle' })).toEqual([]);
    expect(readKit('quidditch')[0]).toMatch(/'quidditch' is not a sport's kit/);
    expect(readKit({ colours: ['red'] })[0]).toMatch(/kit.colours: 1 to 3 colours/);
    expect(readKit({ pattern: 'tartan' })[0]).toMatch(/kit.pattern: one of plain, hoops/);
    expect(readKit({ number: 10 })[0]).toMatch(/kit.number: not a kit word/);
  });

  it('fills the card\'s defaults; one colour given stands for the card\'s second where the card has one colour', () => {
    expect(resolveKit('soccer')).toMatchObject({ sport: 'soccer', pattern: 'plain', colours: SPORT_KITS.soccer.colours, socks: 'knee' });
    expect(resolveKit({ sport: 'tennis', colours: ['#f4f4f0'] }).colours.slice(0, 2)).toEqual(['#f4f4f0', '#f4f4f0']);
    expect(resolveKit({ colours: ['#c8102e'] }).sport).toBe('soccer');
    expect(kitSportOf('meet')).toBe('track'); expect(kitSportOf('golf')).toBe('golf'); expect(kitSportOf('team')).toBe('soccer');
  });

  it('lowers to the bare body painted, its tones the kit\'s colours by role; the realistic body to the athlete\'s card', () => {
    const D = kitDress({ sport: 'soccer', colours: ['#c8102e', '#ffffff', '#111111'], pattern: 'hoops' });
    expect(D.detail).toBe('swimsuit');
    expect(D.paint.slice(0, 2)).toEqual(['tee', 'bikeShorts']);
    expect(D.tones).toMatchObject({ Top: '#c8102e', Kit: '#ffffff', Trim: '#111111', Bottom: '#ffffff', Socks: '#c8102e', Swim: '#ffffff' });
    for (const P of KIT_PATTERNS.hoops) expect(D.paint).toContainEqual(P);
    expect(kitDress('hockey').paint).toContain('gloves');
    expect(kitDress('soccer', { realistic: true })).toMatchObject({ outfit: { type: 'outfit', style: 'athlete' }, tones: { Top: SPORT_KITS.soccer.colours[0] } });
  });

  it('is a word on the hero door: stored as words, worn on the body, the pattern painted over the shirt only', () => {
    expect(validateHeroSpec({ cast: 'male', kit: { sport: 'soccer', pattern: 'stripes' } })).toEqual([]);
    expect(validateHeroSpec({ cast: 'male', kit: 'quidditch' }).join(' ')).toMatch(/not a sport's kit/);
    const spec = { cast: 'male', kit: { sport: 'soccer', colours: ['#c8102e', '#ffffff', '#111111'], pattern: 'hoops' } };
    expect(heroRecord(spec).kit).toEqual(spec.kit);
    expect(heroRecord(spec).paint).toBeUndefined();
    const { recipe } = worn(spec), groups = groupsOf(recipe);
    for (const g of ['Top', 'Kit', 'Trim', 'Bottom', 'Socks', 'Shoes', 'Skin']) expect(groups, g).toContain(g);
    expect(recipe.palette).toMatchObject({ Top: '#c8102e', Kit: '#ffffff', Bottom: '#ffffff' });
    // the same words are the same body; without the pattern, no Kit band
    expect(JSON.stringify(worn(spec).recipe)).toBe(JSON.stringify(recipe));
    expect(groupsOf(worn({ cast: 'male', kit: 'soccer' }).recipe)).not.toContain('Kit');
  });

  it('the operator\'s own words win: their palette over the kit\'s colours, their paint after the kit\'s', () => {
    const H = kittedHero(heroRecord({ cast: 'female', kit: 'tennis', palette: { Top: '#123456' }, paint: ['gloves'] }));
    expect(H.palette.Top).toBe('#123456');
    expect(H.paint.at(-1)).toBe('gloves');
    expect(H.kit).toBeUndefined();
    expect(kittedHero(heroRecord({ cast: 'male' }))).toEqual(heroRecord({ cast: 'male' }));
  });

  it('a pattern paints on the anime body and the streamlined core as on the default (one per procedure: bands up the trunk, around it, a limb whole)', () => {
    for (const pattern of ['hoops', 'stripes', 'sleeves']) {
      for (const extra of [{ head: 'anime', proportions: 'anime' }, { core: 'streamlined' }]) {
        const groups = groupsOf(worn({ cast: 'female', ...extra, kit: { sport: 'soccer', pattern } }).recipe);
        expect(groups, `${pattern} ${JSON.stringify(extra)}`).toContain('Kit');
      }
    }
  });
});
