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
  it('walk the dial from the banded pole to the material pole, every stop named by a look', () => {
    expect(DIAL[0].pole).toBe('banded');
    expect(DIAL[DIAL.length - 1].pole).toBe('material');
    const stops = new Set(DIAL.map((d) => d.id));
    for (const [id, L] of Object.entries(LOOKS)) expect(stops.has(L.stop), id).toBe(true);
    for (const d of DIAL) expect(Object.values(LOOKS).some((L) => L.stop === d.id), d.id).toBe(true);
    expect(() => lookOf('noir')).toThrow(/no look 'noir' \(known: comic-day/);
  });
  it('each stop reads as a geocube today with the register it says, and as a hero direction', () => {
    const REGISTER = { comic: 'cel', painted: 'ink-wash', realistic: 'continuous' };
    const one = Object.fromEntries(DIAL.map((d) => [d.id, Object.entries(LOOKS).find(([, L]) => L.stop === d.id)]));
    for (const [stop, [id, L]] of Object.entries(one)) {
      const c = readGeocube(L.geocube);
      expect(c.register.name, id).toBe(REGISTER[stop]);
      const { form, ...direction } = L.hero;
      const D = resolveDirection({ characters: { direction }, style: { kit: 'island-plaza', civilization: 'a' }, civilizations: {}, seed: 1 });
      expect(D.tradition, id).toBe(L.hero.tradition);
      // the material pole is the western tradition's realistic hero; the banded pole keeps heroic proportions (comic, not anime)
      if (stop === 'realistic') expect([form, D.hero.toon], id).toEqual(['realistic', false]);
      else expect(D.hero.proportions, id).toBe('hero');
    }
    expect(TRADITIONS.western.pole).toBe('material');
  });
  it('the night look differs from the day look only in its base and its secondary element: one dial, not two packs', () => {
    const day = LOOKS['comic-day'], night = LOOKS['comic-night'];
    expect(night.geocube.register).toBe(day.geocube.register);
    expect(night.hero.tradition).toBe(day.hero.tradition);
    expect(night.hero.bridge).toEqual(day.hero.bridge);
    expect(night.geocube.from).not.toBe(day.geocube.from);
  });
});

describe('comic hero pack: resonance', () => {
  it('advises and never refuses: words or nothing, the same for the same cube, on a core cube too', () => {
    const brawler = packCube('street-brawler').cube;
    const a = resonance(brawler);
    expect(a.map((x) => x.law)).toEqual(['comic-hero.bursts-want-bands', 'comic-hero.night-wants-rim']);
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
    const [world, hero] = qaOrders('realistic-city');
    expect(world.tool).toBe('create_sketch');
    const M = world.args.manifest;
    expect(M.characters.direction).toMatchObject({ tradition: 'western' });
    expect(M.characters.direction.form).toBeUndefined();
    expect(() => validateCube(M.intent.cube)).not.toThrow();
    const { kind, ...W } = M;
    expect(kind).toBe('gameworld');
    const G = readGameworld(W);
    expect(G.intent.cube).toEqual(M.intent.cube);
    expect(resolveLevel(G, 'downtown').city.plan.paint).toEqual({ geocube: LOOKS['realistic-city'].geocube });
    expect(resolveDirection(G).hero.toon).toBe(false);
    expect([hero.tool, hero.args.form, hero.args.toon]).toEqual(['mint_solid', 'realistic', false]);
    // the banded pole: the comic stop's world reads too, its hero lit as a character
    const { kind: _k, ...day } = qaOrders('comic-day')[0].args.manifest;
    expect(resolveDirection(readGameworld(day)).hero).toEqual({ head: 'landmark', proportions: 'hero', toon: true });
    expect(qaOrders('comic-day')[1].args).toMatchObject({ toon: true });
    expect(PACK.wants).toContain('reality.look=comic-day');
  });
});
