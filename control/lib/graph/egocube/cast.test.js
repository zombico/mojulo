import { describe, it, expect } from 'vitest';
import { rollCast, readCastRequest, castOfScale, facetDistance, silhouetteOf, RELATIONS, BEASTS, PARTY_BEASTS, BEASTKIN, SCALES } from './cast.js';
import { rollEgocube } from './egocube.js';
import { AGES } from './facets.js';
import { ARCHETYPE_HUE } from './mascot-from-person.js';
import { SPECIES } from '../fauna/species.js';

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const seeds = (n) => Array.from({ length: n }, (_, i) => i + 1);
const mind = (m) => m.temperament ?? m.sheet.facets;

describe('the cast roller', () => {
  it('is deterministic, and the anchor with no setting is the plain roll', () => {
    const q = { seed: 7, anchor: { brief: 'a weary paladin' }, cast: castOfScale('journey') };
    expect(JSON.stringify(rollCast(q))).toBe(JSON.stringify(rollCast(q)));
    expect(rollCast(q).members.hero.sheet).toEqual(rollEgocube({ brief: 'a weary paladin', facets: {}, seed: 7, path: 'hero' }));
  });

  it('only grows: a member added at the end moves no one rolled before it', () => {
    const before = rollCast({ seed: 3, cast: { rival: { relation: 'rival' }, party: { relation: 'party', n: 2 } } });
    const after = rollCast({ seed: 3, cast: { rival: { relation: 'rival' }, party: { relation: 'party', n: 2 }, mentor: { relation: 'mentor' } } });
    for (const p of before.order) expect(after.members[p]).toEqual(before.members[p]);
    expect(after.order).toEqual([...before.order, 'hero/mentor']);
  });

  it('a scale is the cast a game of that size asks for, the poles first', () => {
    expect(rollCast({ cast: castOfScale('hero') }).order).toEqual(['hero']);
    expect(Object.keys(SCALES)).toEqual(['hero', 'rival', 'party', 'journey']);
    const J = rollCast({ seed: 2, cast: castOfScale('journey', { n: 2 }) });
    expect(J.order.slice(0, 2)).toEqual(['hero', 'hero/mastermind']);
    expect(J.bookends.poles).toEqual(['hero', 'hero/mastermind']);
    expect(J.order.filter((p) => J.members[p].bond === 'party')).toEqual(['hero', 'hero/party-1', 'hero/party-2']);
  });

  it('echo lands nearer the anchor than contrast, measured on a sweep', () => {
    const near = [], far = [], older = [];
    for (const seed of seeds(40)) {
      const C = rollCast({ seed, cast: { rival: { relation: 'rival', body: 'person' }, foil: { relation: 'foil' }, mentor: { relation: 'mentor' } } });
      const a = C.members.hero.sheet.facets;
      near.push(facetDistance('archetype', C.members['hero/rival'].sheet.facets.archetype, a.archetype));
      far.push(facetDistance('archetype', C.members['hero/foil'].sheet.facets.archetype, a.archetype));
      older.push(Object.keys(AGES).indexOf(C.members['hero/mentor'].sheet.facets.age) - Object.keys(AGES).indexOf(a.age));
    }
    expect(mean(far)).toBeGreaterThan(mean(near) + 0.3);
    expect(mean(older)).toBeGreaterThan(1);
  });

  it('a shadow reflects motivation; a mastermind is self-serving; a pull is never an ask', () => {
    const C = rollCast({ seed: 5, anchor: { facets: { motivation: 0.1 } }, cast: { shadow: { relation: 'shadow' }, boss: { relation: 'mastermind' } } });
    expect(Math.abs(C.members['hero/shadow'].sheet.facets.motivation - 0.9)).toBeLessThan(0.25);
    expect(C.members['hero/boss'].sheet.facets.motivation).toBeGreaterThanOrEqual(0.85);
    expect(C.members['hero/boss'].sheet.given).not.toContain('motivation');
  });

  it('the laws hold, or the sheet names the member it kept and why', () => {
    for (const seed of seeds(12)) {
      const C = rollCast({ seed, cast: castOfScale('journey') });
      const kept = new Set(C.kept.map((k) => `${k.law}:${k.path}`));
      const party = C.order.map((p) => C.members[p]).filter((m) => m.bond === 'party');
      party.forEach((m, i) => { if (party.slice(0, i).some((o) => o.silhouette === m.silhouette)) expect(kept.has(`party-silhouette:${m.path}`)).toBe(true); });
      const [lo, hi] = [Math.min(...C.bookends.motivation), Math.max(...C.bookends.motivation)];
      for (const m of party.slice(1)) expect(mind(m).motivation >= lo - 0.05 && mind(m).motivation <= hi + 0.05 || kept.has(`bookends:${m.path}`)).toBe(true);
    }
  });

  it('an explicit ask is never drawn again: a law it breaks is held', () => {
    const C = rollCast({ seed: 1, anchor: { facets: { role: 'frontline', archetype: 'hero', motivation: 0.1 } }, cast: { twin: { relation: 'party', facets: { role: 'frontline', archetype: 'hero' } } } });
    expect(C.redraws).toEqual([]);
    expect(C.kept).toContainEqual(expect.objectContaining({ path: 'hero/twin', law: 'party-silhouette', held: true }));
  });

  it('bonds and bodies: a familiar wears its keeper\'s accent; a beast is a real species; beast-kin is a beast lineage', () => {
    const C = rollCast({ seed: 2, cast: { pet: { relation: 'familiar', body: 'mascot' }, wolf: { relation: 'familiar', body: 'beast', species: 'wolf' }, kin: { relation: 'party', body: 'beastkin' }, red: { relation: 'party', body: 'beast' } } });
    const hue = ARCHETYPE_HUE[C.members.hero.sheet.facets.archetype];
    expect(C.members['hero/pet'].sheet.facets.hue).toBe(hue);
    expect(C.members['hero/wolf']).toMatchObject({ bond: 'familiar', accent: hue, beast: { species: 'wolf', family: 'canine' } });
    expect(BEASTKIN).toContain(C.members['hero/kin'].sheet.facets.ancestry);
    expect(C.members['hero/kin'].sheet.ancestry.kind).toBe('lineage');   // its humanity says which door: cat-folk or Kimahri
    expect(Object.values(PARTY_BEASTS).flat().map(([id]) => id)).toContain(C.members['hero/red'].beast.species);
    expect(silhouetteOf(C.members['hero/red'])).toMatch(/^beast:/);
    for (const [id, family] of [...Object.values(BEASTS), ...Object.values(PARTY_BEASTS)].flat()) expect(SPECIES[id]?.family, id).toBe(family);
  });

  it('a faction is its own setting over the game\'s', () => {
    const C = rollCast({ seed: 4, setting: { era: 'myth' }, factions: { invader: { tradition: 'anime', era: 'future' } }, cast: { boss: { relation: 'mastermind', faction: 'invader' }, 'boss/hand': { relation: 'lieutenant' } } });
    expect(C.members['hero/boss'].sheet.setting).toEqual({ era: 'future', tradition: 'anime' });
    expect(C.members['hero/boss/hand'].faction).toBe('invader');
    expect(C.members.hero.sheet.setting).toEqual({ era: 'myth' });
  });

  it('reads a request and teaches', () => {
    expect(() => readCastRequest({ cast: { x: { relation: 'nemesis' } } })).toThrow(/relation is one of/);
    expect(() => readCastRequest({ cast: { 'boss/hand': { relation: 'lieutenant' } } })).toThrow(/parent 'boss' is written before it/);
    expect(() => readCastRequest({ cast: { t: { relation: 'rank' } } })).toThrow(/rank is one of/);
    expect(() => readCastRequest({ cast: { f: { relation: 'familiar', body: 'person', species: 'wolf' } } })).toThrow(/species is a beast's/);
    expect(() => readCastRequest({ cast: { f: { relation: 'familiar', body: 'person', ooze: 'dire' } } })).toThrow(/ooze makes a beast a game creature/);
    expect(() => readCastRequest({ cast: { f: { relation: 'familiar', body: 'beast', ooze: 'slimy' } } })).toThrow(/unknown ooze "slimy"/);
    expect(Object.keys(RELATIONS)).toEqual(expect.arrayContaining(['shadow', 'rival', 'foil', 'mentor', 'party', 'familiar', 'lieutenant', 'mastermind', 'rank']));
  });
});
