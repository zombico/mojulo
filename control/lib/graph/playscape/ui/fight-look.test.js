import { describe, it, expect } from 'vitest';
import { THEME_CARDS, cardTheme } from './theme-cards/loader.js';
import { readTheme, themeAdvice } from '@/lib/mana-ui/theme.js';

// THE FIGHT'S LOOKS (theme cards, family `fight`): a fighting game's own, never a party game's. Quiet so the fight reads
// (nothing leans, stacks, breaks out or stands behind it; its words keep a halo over the round), its two sides keyed
// apart (told from each other and from a window), health read on its own colour.
const fight = Object.values(THEME_CARDS).filter((c) => c.family === 'fight');

describe('the fight\'s looks', () => {
  it('there is a family of them, each drawing, each keying its two sides apart', () => {
    expect(fight.length).toBeGreaterThan(1);
    for (const c of fight) {
      const T = readTheme(cardTheme(c.id));
      expect(T.sides[0], c.id).not.toBe(T.sides[1]);
      const advice = themeAdvice(T).filter((a) => a.law === 'side-shows' || a.law === 'ink-reads' || a.law === 'harm-shows');
      expect(advice, `${c.id}: each side shows, the words read, a low bar warns`).toEqual([]);
    }
  });
  it('a fight look is quiet: nothing leans, stacks, breaks out or stands behind the fight; it never slams', () => {
    for (const c of fight) {
      const T = readTheme(cardTheme(c.id));
      for (const k of ['slant', 'backing', 'breakout', 'stage', 'crest', 'overlay', 'material']) expect(T[k], `${c.id}: ${k}`).toBe('none');
      expect(T.transition, c.id).not.toBe('slam');
      expect(T.halo, `${c.id}: words over the round keep a halo`).not.toBe('none');
      // (health its own colour, apart from the chip that falls behind it)
      expect(T.tokens.hp, c.id).not.toBe(T.tokens.harm);
    }
  });
});
