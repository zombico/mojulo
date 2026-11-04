// fighter wiring: the seams between the fighter's pieces, stitched. A body codename (anime-bodies.js) is worn under the
// landmark or the realistic head on the lofted body, on the frame it was drawn on, its stamp fitted to no style and its
// head the hero cast's size; the realistic (relational) head is worn by the lofted body, swapped in after the muscle
// shirt on a densified neck, its skin and its laws with it; the realistic body still refuses a codename; the body rail
// keeps the codename under the realistic head. A hero naming none of it is as it was.
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest, normalizeHero, validateHeroSpec, REALISTIC_LAWS_VERSION } from '../../mcp/tools/layered.js';
import { gameBody, lowerBody } from '../gameworld/game-bodies.js';
import { withDefaultForm } from './motion-stamp.js';

const record = (spec) => heroRecord(withDefaultForm({ cast: 'male', ...spec }));
const joints = (spec) => expandLayeredManifest({ kind: 'layered', hero: record(spec) }).recipe.rig.joints;
const at = (j) => (Array.isArray(j) ? j : j.at);
const span = (J) => { const a = at(J.shoulderR), b = at(J.shoulderL); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };

describe('a body codename under another head', () => {
  it('stamps the codename fitted to no style, on its own anime frame, the proportions a spec names kept', () => {
    for (const head of ['landmark', 'relational']) {
      const h = record({ head, animeBody: 'toji', ...(head === 'relational' ? { face: { seed: 7 } } : {}) });
      expect(h.animeBodyResolved).toMatchObject({ word: 'toji', pole: 'male', card: 'toji', fit: null });
      expect(h.proportions).toBe('anime');
      expect(normalizeHero(h)).toEqual(h);
    }
    expect(record({ animeBody: 'toji', proportions: 'hero' }).proportions).toBe('hero');
    // (a style's stamp moved under another head is fitted again, to none)
    const anime = heroRecord(withDefaultForm({ cast: 'male', head: 'anime', animeBody: 'toji' }));
    expect(normalizeHero({ ...anime, head: 'landmark' }).animeBodyResolved.fit).toBeNull();
  });
  it('lays the codename\'s tune under the hero\'s own: Toji broader in the shoulder than the frame without it', () => {
    expect(span(joints({ animeBody: 'toji' }))).toBeGreaterThan(span(joints({ proportions: 'anime' })) * 1.08);
  }, 120000);
  it('refuses the codename on the realistic body, its build its physique', () => {
    expect(validateHeroSpec({ cast: 'male', form: 'realistic', animeBody: 'toji' }).join()).toMatch(/its physique/);
  });
});

describe('the realistic head on the lofted body', () => {
  it('is taken without the realistic form, its skin words with it, its laws stamped', () => {
    expect(validateHeroSpec({ cast: 'male', head: 'relational', animeBody: 'toji', muscleShirt: { definition: 1 }, face: { seed: 7 }, skin: { freckles: 0.2 } })).toEqual([]);
    expect(record({ head: 'relational', face: { seed: 7 } }).headLaws).toBe(REALISTIC_LAWS_VERSION);
    expect(record({ head: 'landmark' }).headLaws).toBeUndefined();
    expect(validateHeroSpec({ cast: 'male', headLaws: 3 }).join()).toMatch(/headLaws/);
    expect(validateHeroSpec({ cast: 'male', skin: { freckles: 0.2 } }).join()).toMatch(/skin/);
  });
  it('swaps the head in on a dense neck, its skin and its fit on the recipe; the landmark codename wears none of it', () => {
    const R = expandLayeredManifest({ kind: 'layered', hero: record({ head: 'relational', animeBody: 'toji', face: { seed: 7 } }) }).recipe;
    expect(R.headFit).toBeTruthy();
    expect(R.dermis).toBeTruthy();
    expect(R.parts.neck.slots.length).toBeGreaterThan(24);
    expect(R.parts.cranium ?? null).toBeNull();
    const L = expandLayeredManifest({ kind: 'layered', hero: record({ animeBody: 'toji' }) }).recipe;
    expect(L.headFit).toBeUndefined();
    expect(L.dermis).toBeUndefined();
    expect(L.parts.neck.slots.length).toBe(12);
  }, 300000);
});

describe('the fighter\'s body rail', () => {
  it('keeps the anime frame\'s codename under the realistic head, and leaves it off the landmark head as before', () => {
    const B = gameBody('muscular', 'hero', { tradition: 'anime', muscle: true });
    expect(lowerBody({ head: 'relational' }, B)).toMatchObject({ animeBody: 'toji', muscleShirt: { definition: 1 } });
    expect(lowerBody({ head: 'landmark' }, B).animeBody).toBeUndefined();
  });
});
