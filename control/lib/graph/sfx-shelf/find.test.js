import { describe, it, expect } from 'vitest';
import { SOUNDS, SOUND_IDS } from './roster.js';
import { MATTER, WEIGHTS, facetsOf, soundsWith, facetGaps } from './facets.js';
import { findSounds, solveSound, suggestSounds } from './find.js';
import { FAMILIES } from './families.js';
import { GENRES } from '../gameworld/intent.js';

// The shelf searched by intent (find.js) over its facets (facets.js): one case per procedure, picked in code.

describe('the facets', () => {
  it('every row has a matter, a weight from the scale or none, and genres the cosmos knows', () => {
    const bad = SOUND_IDS.flatMap((id) => {
      const f = facetsOf(id);
      return [
        ...(f.matter.length ? [] : [`${id}: no matter`]),
        ...f.matter.filter((m) => !(m in MATTER)).map((m) => `${id}: matter ${m}`),
        ...(f.weight === null || f.weight in WEIGHTS ? [] : [`${id}: weight ${f.weight}`]),
        ...f.genres.filter((g) => !(g in GENRES)).map((g) => `${id}: genre ${g}`),
      ];
    });
    expect(bad).toEqual([]);
  });

  it('a dial that names a matter or a weight says it; a boolean dial adds its matter to the family\'s', () => {
    const metal = SOUND_IDS.find((id) => SOUNDS[id].make?.dials.material === 'metal');
    expect(facetsOf(metal).matter).toEqual(['metal']);
    const sized = SOUND_IDS.find((id) => SOUNDS[id].make?.dials.size === 'huge');
    expect(facetsOf(sized).weight).toBe('heavy');
    const plus = SOUND_IDS.find((id) => SOUNDS[id].make?.dials.metal === true);
    expect(facetsOf(plus).matter).toContain('metal');
    expect(facetsOf(plus).matter.length).toBeGreaterThan(1);
  });

  it('a mouth-voiced row is fresh; soundsWith filters by every facet asked', () => {
    const fresh = SOUND_IDS.find((id) => SOUNDS[id].voices?.mouth);
    expect(facetsOf(fresh).fresh).toBe(true);
    const ids = soundsWith({ matter: 'creature' });
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(facetsOf(id).matter).toContain('creature');
    expect(Array.isArray(facetGaps())).toBe(true);
  });
});

describe('the finder', () => {
  it('an id or an alias exactly scores 100; a sound word in kana or in romaji names its row', () => {
    const id = SOUND_IDS.find((i) => SOUNDS[i].say?.length >= 2 && /[぀-ヿ]/.test(SOUNDS[i].say[0]));
    const [kana, romaji] = SOUNDS[id].say;
    expect(findSounds({ words: id })[0]).toMatchObject({ id, score: 100 });
    expect(findSounds({ words: kana })[0].id).toBe(id);
    expect(findSounds({ words: romaji })[0].id).toBe(id);
  });

  it('a word that names two things is read by the rest of the words', () => {
    expect(findSounds({ words: 'fire' })[0].id).toBe('shoot');
    const crackling = findSounds({ words: 'a crackling fire' })[0];
    expect(facetsOf(crackling.id).matter).toContain('fire');
    expect(crackling.id).not.toBe('shoot');
  });

  it('facets alone filter; ties go to the newest voices', () => {
    const rows = findSounds({ matter: 'metal', category: 'world', limit: 50 });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.row.category === 'world' && r.facets.matter.includes('metal')).toBe(true);
    const swings = findSounds({ slot: 'strike.swing', limit: 50 });
    const firstOld = swings.findIndex((r) => !r.facets.fresh);
    expect(firstOld).toBeGreaterThan(0);
    expect(swings.slice(firstOld).every((r) => !r.facets.fresh)).toBe(true);
  });

  it('solves a family\'s dials from the words: a value said, a boolean by its name', () => {
    const fam = Object.keys(FAMILIES).find((f) => FAMILIES[f].dials?.surface && FAMILIES[f].dials?.body);
    const surface = FAMILIES[fam].dials.surface.find((v) => v !== 'concrete'), body = FAMILIES[fam].dials.body.at(-1);
    const s = solveSound(`${body} footsteps on ${surface}`);
    expect(SOUNDS[s.id].make.family).toBe(fam);
    expect(s.dials).toMatchObject({ surface, body });
    const b = Object.keys(FAMILIES).find((f) => Object.entries(FAMILIES[f].dials ?? {}).some(([, v]) => v.includes(true)));
    const dial = Object.entries(FAMILIES[b].dials).find(([, v]) => v.includes(true))[0];
    const row = SOUND_IDS.find((id) => SOUNDS[id].make?.family === b);
    expect(solveSound(`${SOUNDS[row].aliases[0] ?? row} ${dial}`).dials[dial]).toBe(true);
  });

  it('a refusal points at what the shelf has', () => {
    expect(suggestSounds('scissor snip')).toMatch(/'scissors'/);
    expect(suggestSounds('qqqq')).toMatch(/see the SFX shelf/);
  });
});

describe('the beds', async () => {
  const { BEDS, bedManifest, resolveBed } = await import('./beds.js');
  const { validateBeatsManifest } = await import('../beats/beats-manifest.js');
  it('a bed is a valid pattern of the shelf\'s one-shots, every track a variant each hit, the same bed the same manifest', () => {
    const id = Object.keys(BEDS)[0], m = bedManifest(id);
    expect(validateBeatsManifest(m)).toEqual({ ok: true, errors: [] });
    expect(m.tracks.every((t) => t.vary && t.mask.filter(Boolean).length > 0)).toBe(true);
    expect(bedManifest(id)).toEqual(m);
    expect(resolveBed(BEDS[id].aliases[0])).toBe(id);
    expect(() => bedManifest('no-such-bed')).toThrow(/no bed/);
  });
});
