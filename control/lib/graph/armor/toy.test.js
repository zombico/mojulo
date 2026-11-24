// The toy suit (armor/toy.js): moulded volumes at the joints and the ends. The concepts here, a heroine's words: `bodice`
// in the chest's place a fuller barrel cut higher (so it stands over a chest the barrel would sink into), `skirt` in the
// brief's place a cone off the hips flaring as it falls; absent, the barrel and the brief as the card has them.
import { describe, it, expect } from 'vitest';
import { toySuit, TOY_WORDS } from './toy.js';

const piece = (lang, id) => toySuit({ coverage: 1, ornament: 1 }, {}, lang).kit.find((p) => p.id === id);

describe('a heroine\'s toy suit', () => {
  it('the words are the suit\'s own', () => {
    expect(TOY_WORDS.chest).toContain('bodice');
    expect(TOY_WORDS.brief).toContain('skirt');
  });
  it('a bodice is a fuller chest than the barrel, cut higher; absent, the barrel', () => {
    const barrel = piece({}, 'chest'), bodice = piece({ chest: 'bodice' }, 'chest');
    expect(bodice.signature.girth).toBeGreaterThan(barrel.signature.girth);
    expect(bodice.signature.peak).toBeGreaterThan(barrel.signature.peak);
    expect(piece({ chest: 'none' }, 'chest')).toBeUndefined();
  });
  it('a skirt flares off the hips where the brief rounds them; absent, the brief', () => {
    const brief = piece({}, 'brief'), skirt = piece({ brief: 'skirt' }, 'brief');
    expect(brief.signature.shape).toBe('football');
    expect(skirt.signature.shape).toBe('cone');
    expect(skirt.signature.lip.at).toBe('low');
  });
});
