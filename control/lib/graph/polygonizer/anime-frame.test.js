// the anime frame (hero laws 21, hero-form.js ANIME_FRAME): the anime proportions' structured body, refined where it read
// thin or as boxes. The concepts: a hero minted now is stamped laws 21; on the anime head the wrist is deeper through the
// hand, the shoe's section round with a heel ring, and the shoulder's cone held under the torso's skin; laws 20 builds
// it as it was; a hero on the landmark head (the hero proportions) is untouched by it.
import { describe, it, expect } from 'vitest';
import { HERO_LAWS_VERSION, ANIME_FRAME, isAnimeFrame } from './hero-form.js';
import { heroHand } from './hero-hand.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm } from './motion-stamp.js';

const recipeOf = (spec) => expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultForm(spec)) }).recipe;
const A21 = recipeOf({ head: 'anime' }), A20 = recipeOf({ head: 'anime', laws: 20 });

describe('the anime frame', () => {
  it('is minted now, on the anime proportions\' structured core only', () => {
    expect(HERO_LAWS_VERSION).toBe(21);
    expect(heroRecord(withDefaultForm({ head: 'anime' })).laws).toBe(21);
    expect(isAnimeFrame({ laws: 21, proportions: 'anime', core: 'structured' })).toBe(true);
    expect(isAnimeFrame({ laws: 20, proportions: 'anime', core: 'structured' })).toBe(false);
    expect(isAnimeFrame({ laws: 21, proportions: 'hero', core: 'structured' })).toBe(false);
  });
  it('deepens the wrist through the hand, across it as it was', () => {
    const base = { wrist: [0.3, 0, 0.8], elbow: [0.29, 0, 1.06], len: 0.09 };
    const [through0, across0] = heroHand(base).wrist, [through1, across1] = heroHand({ ...base, wristDepth: ANIME_FRAME.wrist }).wrist;
    expect(through1 / through0).toBeGreaterThan(1.2);
    expect(across1).toBe(across0);
  });
  it('rounds the shoe and gives it a heel ring; laws 20 keeps the box', () => {
    expect(A21.parts.footR.slots.length).toBe(10);
    expect(A20.parts.footR.slots.length).toBe(6);
    expect(A21.parts.footR.stations.length).toBe(A20.parts.footR.stations.length + 1);
  });
  it('holds the shoulder\'s cone under the torso\'s skin at the clavicle: only its rings between, which rode over it, move', () => {
    const a = A21.parts.shoulderConeR, b = A20.parts.shoulderConeR;
    const moved = (i) => a.slots.some((sl) => Math.hypot(...a.stations[i].points[sl].map((x, k) => x - b.stations[i].points[sl][k])) > 0.005);
    expect([0, 1, 2, 3].map(moved)).toEqual([false, true, true, false]);
  });
  it('leaves the landmark head\'s body as laws 20 built it', () => {
    const L21 = recipeOf({}), L20 = recipeOf({ laws: 20 });
    for (const n of ['footR', 'handR', 'foreArmR', 'shoulderConeR']) expect(JSON.stringify(L21.parts[n])).toBe(JSON.stringify(L20.parts[n]));
  });
});
