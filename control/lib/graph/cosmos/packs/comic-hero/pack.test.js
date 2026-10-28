// The comic hero pack is data the tree reads today: its cubes validate as cubes, its looks read as geocubes and hero
// directions, its laws advise and never refuse, and its wants are registry words. One case per procedure, chosen from
// the pack in code; the pack's own contract (every cube valid, every want known) is held whole, as the fixtures' is.
import { describe, it, expect } from 'vitest';
import { PACK, packReport, qaOrders } from './pack.js';
import { PACK_CUBES, packCube } from './cubes.js';
import { LOOKS, DIAL, lookOf } from './looks.js';
import { LAWS, resonance } from './resonance.js';
import { validateCube, facetDepth } from '../../cosmos.js';
import { readGeocube } from '../../../era/geocube.js';
import { resolveDirection, TRADITIONS } from '../../../gameworld/characters.js';
import { readGameworld, resolveLevel } from '../../../gameworld/index.js';

describe('comic hero pack: cubes', () => {
  it('are valid cubes at depth 0–1 with unique ids, a why, words, and a look the pack has', () => {
    expect(new Set(PACK_CUBES.map((c) => c.id)).size).toBe(PACK_CUBES.length);
    for (const c of PACK_CUBES) {
      expect(() => validateCube(c.cube), c.id).not.toThrow();
      expect(c.why && c.words.length, c.id).toBeTruthy();
      expect(LOOKS[c.look], `${c.id} look ${c.look}`).toBeTruthy();
      for (const spec of Object.values(c.cube)) expect(facetDepth(spec), c.id).toBeLessThanOrEqual(1);
    }
    expect(() => packCube('mmo')).toThrow(/no cube 'mmo' \(known: street-brawler/);
  });
  it('never name a want in the cube itself: the cube runs today, the want is the gap', () => {
    for (const c of PACK_CUBES) {
      const said = Object.entries(c.cube).flatMap(([f, S]) => Object.entries(S).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => `${f}.${k}=${x}`)));
      for (const w of c.wants) expect(said, c.id).not.toContain(w);
    }
  });
  it('report: every want is a registry word, planned and absent today; no cube is blocked by its own words', () => {
    const R = packReport();
    expect(R.wants.length).toBeGreaterThan(0);
    for (const w of R.wants) expect(w.status, w.value).toBe('absent');
    for (const c of R.cubes) expect(c.blocked, c.id).toEqual([]);
    // the report is the dry run's: a cube the core already names a gap for says so
    expect(R.cubes.find((c) => c.id === 'rooftop-courier').gaps).toEqual(['space.topology=open']);
  });
});

describe('comic hero pack: looks', () => {
  it('walk the dial from the tiered body to the realistic body, every stop named by a look', () => {
    expect(DIAL[0].body).toBe('tiered');
    expect(DIAL[DIAL.length - 1].body).toBe('realistic');
    const stops = new Set(DIAL.map((d) => d.id));
    for (const [id, L] of Object.entries(LOOKS)) expect(stops.has(L.stop), id).toBe(true);
    for (const d of DIAL) expect(Object.values(LOOKS).some((L) => L.stop === d.id), d.id).toBe(true);
    expect(() => lookOf('noir')).toThrow(/no look 'noir' \(known: anime-day/);
  });
  it('every look reads as a geocube, and its paint is the city\'s (an hour word, a cloud kind)', () => {
    for (const [id, L] of Object.entries(LOOKS)) {
      expect(() => readGeocube(L.geocube), id).not.toThrow();
      expect(['dawn', 'morning', 'noon', 'afternoon', 'golden', 'dusk', 'night'], id).toContain(L.paint.hour);
      expect(['clear', 'fair', 'overcast', 'storm', 'haze', 'high'], id).toContain(L.paint.clouds);
    }
  });
  it('each register has its own light: the anime the isekai bake (no polygon land), the golden hour baked, the film gen-7', () => {
    const one = Object.fromEntries(DIAL.map((d) => [d.id, readGeocube(Object.values(LOOKS).find((L) => L.stop === d.id).geocube)]));
    // the anime: the outside drawn by the isekai shell's own light, never inked (no cel register)
    expect([one.anime.outside.land, one.anime.register.outline, one.anime.era]).toEqual([false, undefined, 'gen-6']);
    // the golden hour: baked (gen-6), solved by the theorist, gritty (its ground drawn from relief), the sky the brightest
    // thing: the figure stands backlit against it
    const lum = (h) => [1, 3, 5].reduce((s, i, k) => s + [0.2126, 0.7152, 0.0722][k] * parseInt(h.slice(i, i + 2), 16) / 255, 0);
    expect([one.dcau.era, Number.isInteger(one.dcau.palette.seed), one.dcau.grit >= 0.35, lum(one.dcau.light.sky.horizon) > lum(one.dcau.colour.stone)]).toEqual(['gen-6', true, true, true]);
    // the film: the seventh generation's form render
    expect(one.realistic.era).toBe('gen-7');
  });
  it('each stop reads as a hero direction: the anime tradition and its light at the anime stop, the western elsewhere', () => {
    const TRADITION = { anime: ['anime', true, 'anime'], dcau: ['western', false, 'hero'], realistic: ['western', false, 'hero'] };
    for (const [id, L] of Object.entries(LOOKS)) {
      const { form, ...direction } = L.hero;
      const D = resolveDirection({ characters: { direction }, style: { kit: 'island-plaza', civilization: 'a' }, civilizations: {}, seed: 1 });
      expect([D.tradition, D.hero.toon, D.hero.proportions], id).toEqual(TRADITION[L.stop]);
      expect(form, id).toBe(L.stop === 'realistic' ? 'realistic' : undefined);
    }
    expect([TRADITIONS.western.toon, TRADITIONS.anime.toon]).toEqual([false, true]);
  });
});

describe('comic hero pack: resonance', () => {
  it('advises and never refuses: words or nothing, the same for the same cube, on a core cube too', () => {
    const brawler = packCube('street-brawler').cube;
    const a = resonance(brawler);
    expect(a.map((x) => x.law)).toEqual(['comic-hero.bursts-want-drawn', 'comic-hero.night-wants-backlight']);
    expect(resonance(brawler)).toEqual(a);
    for (const L of LAWS) expect([typeof L.advice({}), L.advice({})], L.id).toEqual(['object', null]);
    expect(resonance({ reality: { look: 'gothic-night' }, power: { combat: ['melee'] } })).toEqual([]);
  });
  it('each law fires on one cube of the pack: a law no cube reaches is dead weight', () => {
    const fired = new Set(PACK_CUBES.flatMap((c) => resonance(c.cube).map((a) => a.law)));
    for (const L of LAWS) expect(fired.has(`comic-hero.${L.id}`), L.id).toBe(true);
  });
});

describe('comic hero pack: QA orders', () => {
  it('set the table for one stop: a gameworld the tree reads, its downtown painted by the look, the hero at that pole', () => {
    const [world, hero] = qaOrders('realistic-night');
    expect(world.tool).toBe('create_sketch');
    const M = world.args.manifest;
    expect(M.characters.direction).toMatchObject({ tradition: 'western' });
    expect(M.characters.direction.form).toBeUndefined();
    expect(() => validateCube(M.intent.cube)).not.toThrow();
    const { kind, ...W } = M;
    expect(kind).toBe('gameworld');
    const G = readGameworld(W);
    expect(G.intent.cube).toEqual(M.intent.cube);
    expect(resolveLevel(G, 'downtown').city.plan.paint).toEqual({ geocube: LOOKS['realistic-night'].geocube, ...LOOKS['realistic-night'].paint });
    expect(resolveDirection(G).hero.toon).toBe(false);
    expect([hero.tool, hero.args.kind, hero.args.via, hero.args.spec.form, hero.args.toon]).toEqual(['mint_solid', 'layered', 'hero', 'realistic', undefined]);
    // the golden hour's world reads too: the tiered body, no toon
    const { kind: _k, ...golden } = qaOrders('dcau-golden')[0].args.manifest;
    expect(resolveDirection(readGameworld(golden)).hero).toEqual({ head: 'landmark', proportions: 'hero', toon: false });
    const goldenHero = qaOrders('dcau-golden')[1].args;
    expect([goldenHero.toon, goldenHero.spec.form]).toEqual([undefined, undefined]);
    // the anime stop is seen on open ground (the city kind lights itself, never by the isekai bake), its hero the anime head
    const { kind: _a, ...anime } = qaOrders('anime-day')[0].args.manifest, A = readGameworld(anime);
    expect([A.levels.field.style.geocube, A.levels.downtown]).toEqual([LOOKS['anime-day'].geocube, undefined]);
    expect(resolveDirection(A).hero).toMatchObject({ head: 'anime', toon: true });
    expect(qaOrders('anime-day')[1].args.spec.head).toBe('anime');
    expect(PACK.wants).toContain('reality.look=comic-day');
  });
});
