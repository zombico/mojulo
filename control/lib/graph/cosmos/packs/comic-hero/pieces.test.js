// The piece cards and the headgear: superheroic variations of what a hero wears over a role suit, each the hero door's
// own words. A card names piece kinds the catalogue has; worn over a suit it rides the outfit build (a waist belt
// replacing the suit's, never stacking); a word-list outfit takes none and says so. Headgear fits per body, and a card
// with no realistic side says so. Every card validates on the body it fits through the hero door's own validator.
import { describe, it, expect } from 'vitest';
import { PIECES, PIECE_IDS, withPieces } from './pieces.js';
import { HEADGEAR, HEADGEAR_IDS, fitted, withHeadgear } from './headgear.js';
import { costumeOf } from './costumes.js';
import { memberOrders } from './characters.js';
import { OUTFIT_KIND_NAMES } from '../../../polygonizer/outfit-plan.js';
import { validateHeroSpec } from '../../../../mcp/tools/layered.js';

describe('comic hero pack: piece cards', () => {
  it('each card reads, names a family and eras, and only piece kinds the catalogue has', () => {
    for (const id of PIECE_IDS) { const C = PIECES[id]; expect(C.reads && ['belt', 'pouch', 'jacket'].includes(C.family) && C.eras.length > 0, id).toBe(true);
      for (const p of C.pieces || []) expect(OUTFIT_KIND_NAMES, `${id}: ${p.kind}`).toContain(p.kind); }
  });
  it('a card rides the suit\'s outfit build: its pieces added, a waist belt replacing the suit\'s, a jacket as the language\'s outer', () => {
    const silver = costumeOf('classic', 'silver', 'tiered');
    const belted = withPieces(silver, ['emblemBelt']);
    expect(belted.outfit.pieces.filter((p) => p.kind === 'belt')).toHaveLength(1);
    expect(belted.outfit.pieces.find((p) => p.kind === 'belt').buckleScale).toBe(1.7);
    expect(silver.outfit.pieces.find((p) => p.kind === 'belt').buckleScale).toBeUndefined();   // the suit untouched
    const jacket = withPieces(costumeOf('classic', 'modern', 'realistic'), ['motoJacket']);
    expect(jacket.outfit.language.outer.hem).toBe('hip');
    expect(jacket.outfit.pieces.some((p) => p.kind === 'belt' && p.at === 'waist')).toBe(true);
    expect(() => withPieces(silver, ['capeOfWind'])).toThrow(/no piece card 'capeOfWind'/);
    expect(() => withPieces(costumeOf('classic', 'movie', 'realistic'), ['utilityBelt'])).toThrow(/word list/);
  });
  it('every card validates on the hero through the door on both bodies (the Movie realistic suit aside, a word list)', () => {
    for (const id of PIECE_IDS) for (const look of ['comic-day', 'realistic-city']) {
      const { mint } = memberOrders('hero', look, { era: 'modern', pieces: [id] });
      expect(validateHeroSpec(mint.args.spec), `${id} on ${look}`).toEqual([]);
    }
  });
});

describe('comic hero pack: headgear (the spike)', () => {
  it('each card reads and names a family; a mask fits both bodies, a visor and a helmet the tiered body only', () => {
    for (const id of HEADGEAR_IDS) { const H = HEADGEAR[id]; expect(H.reads && ['mask', 'visor', 'helmet', 'cowl', 'respirator', 'mouthpiece', 'face'].includes(H.family), id).toBe(true); expect(fitted(id, 'tiered'), id).toBe(true); }
    expect(fitted('domino', 'realistic') && fitted('cowl', 'realistic')).toBe(true);
    expect(fitted('trooperHelm', 'realistic') || fitted('visorBand', 'realistic')).toBe(false);
    expect(() => withHeadgear({}, 'realistic', 'trooperHelm')).toThrow(/not fitted to the realistic body/);
    expect(() => withHeadgear({}, 'tiered', 'crown')).toThrow(/no headgear 'crown'/);
  });
  it('a helmet drops the hair; a domino is cast from the face on the tiered head and the dermis\'s war paint on the realistic one; each validates', () => {
    for (const id of HEADGEAR_IDS) for (const look of ['comic-day', 'realistic-city']) {
      if (!fitted(id, look === 'comic-day' ? 'tiered' : 'realistic')) continue;
      const { mint } = memberOrders('hero', look, { era: 'modern', headgear: id });
      expect(validateHeroSpec(mint.args.spec), `${id} on ${look}`).toEqual([]);
      if (['helmet', 'cowl'].includes(HEADGEAR[id].family) || (HEADGEAR[id].family === 'face')) expect(mint.args.spec.hair).toBe('none');
    }
    // (no headgear: the spec as the costume made it, its outfit and hair kept)
    const bare = memberOrders('hero', 'comic-day', { era: 'modern' }).mint.args.spec;
    expect(bare.outfit?.type).toBe('outfit'); expect(bare.hair).not.toBe('none'); expect(bare.palette).toBeTruthy();
    const T = memberOrders('hero', 'comic-day', { headgear: 'domino' }).mint.args.spec, R = memberOrders('hero', 'realistic-city', { headgear: 'domino' }).mint.args.spec;
    expect(T.adorn.some((A) => A.signature?.kind === 'cast' && A.part === 'cranium')).toBe(true);
    expect(R.skin.paint.pattern).toBe('mask');
  });
});
