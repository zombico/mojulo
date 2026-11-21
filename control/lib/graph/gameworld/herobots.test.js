// The herobots (gameworld/herobots.js): the side scroller's playable heroes. The concepts: each is the herobot body in
// the toy suit under the hero robot's helm, its face window open, the hero door taking it; Galaxy Boy wears the cannon,
// Zero Boy none but a saber in his right hand and a ponytail out of his helm, in his own colours; the same hero, the same
// spec.
import { describe, it, expect } from 'vitest';
import { HEROBOTS, herobotSpec } from './herobots.js';
import { ANIME_STYLES } from '../polygonizer/anime-styles.js';
import { heroRecord } from '@/lib/mcp/tools/layered.js';

describe('the herobots', () => {
  it('each the herobot body in the toy suit under the helm, its face open; the hero door takes it', () => {
    for (const id of Object.keys(HEROBOTS)) {
      const S = herobotSpec(id);
      expect(S).toMatchObject({ proportions: 'herobot', adorn: { type: 'armor', style: 'herobot' } });
      expect(S.adorn.with[0].signature.window).toBeDefined();
      expect(() => heroRecord(S)).not.toThrow();
      expect(herobotSpec(id)).toEqual(S);
    }
  });
  it('Galaxy Boy the cannon; Zero Boy a saber in his right hand, a ponytail, his own colours', () => {
    const G = herobotSpec('galaxy-boy'), Z = herobotSpec('zero-boy');
    expect(G.adorn.language.cannon).toBe('R');
    expect(G.gear).toBeUndefined();
    expect(Z.adorn.language).toBeUndefined();
    expect(Z.gear.right).toMatchObject({ item: 'sword', style: 'saber' });
    expect(Z.adorn.with[0].signature.ponytail).toMatchObject({ group: 'Hair' });
    expect(Z.palette.Armor).not.toBe(G.palette.Armor);
    expect(Z.palette.Hair).toBe(HEROBOTS['zero-boy'].palette.Hair);
  });
  it('Astro Girl her brother\'s colours and saber on her own figure: the female cast, her own line over the kept body, twin tails, fins, a bodice and bare hips', () => {
    const A = herobotSpec('astro-girl'), Z = herobotSpec('zero-boy'), H = HEROBOTS['astro-girl'];
    expect(A.palette).toEqual(Z.palette);
    expect(A.gear).toEqual(Z.gear);
    expect(H.variant).toBe(HEROBOTS['zero-boy'].variant);
    expect(A.cast).toBe('female');
    expect(Z.cast).toBeUndefined();
    // (her own ratios over the cast's undone: the cast's, hers and the spec's multiply to hers)
    for (const [k, v] of Object.entries(ANIME_STYLES[H.animeStyle].female.tune)) expect(A.tune[k] * v).toBeCloseTo(H.tune[k] ?? 1, 3);
    expect(A.sculpt).toEqual(H.sculpt);
    const sig = A.adorn.with[0].signature;
    expect(sig.ponytail.twin).toBeGreaterThan(0);
    expect(sig.horns).toBeDefined();
    expect(A.adorn.language).toEqual({ brief: 'none', chest: 'bodice' });
    expect(Z.adorn.with[0].signature.horns).toBeUndefined();
  });
  it('a cast\'s face on the hero\'s own body: its face words over the cast\'s, its body tune undone (its height kept)', () => {
    const id = Object.keys(HEROBOTS).find((k) => HEROBOTS[k].keepBody), S = herobotSpec(id), H = HEROBOTS[id];
    expect(S.animeStyle).toBe(H.animeStyle);
    expect(S.face).toEqual(H.face);
    // (each of the cast's body ratios undone: the two multiply to 1)
    for (const [k, v] of Object.entries(ANIME_STYLES[H.animeStyle].male.tune)) expect(S.tune[k] * v).toBeCloseTo(1, 3);
    const plain = Object.keys(HEROBOTS).find((k) => !HEROBOTS[k].animeStyle);
    if (plain) expect(herobotSpec(plain).tune).toBeUndefined();
  });
  it('a hero\'s own suit dials reach its armour (Galaxy Boy\'s plain suit, read at a close-up); one with none takes the style\'s', () => {
    const withDials = Object.keys(HEROBOTS).find((k) => HEROBOTS[k].dials), without = Object.keys(HEROBOTS).find((k) => !HEROBOTS[k].dials);
    expect(herobotSpec(withDials).adorn.dials).toEqual(HEROBOTS[withDials].dials);
    if (without) expect(herobotSpec(without).adorn.dials).toBeUndefined();
    // (the rims lighter than the suit, the suit lighter than the armour: three tones, light at the edges)
    const lum = (h) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) * 0.2126 + ((n >> 8) & 255) * 0.7152 + (n & 255) * 0.0722) / 255; };
    for (const k of Object.keys(HEROBOTS)) { const P = HEROBOTS[k].palette; expect(lum(P.Cuff)).toBeGreaterThan(lum(P.Top)); expect(lum(P.Top)).toBeGreaterThan(lum(P.Armor)); }
  });
});
