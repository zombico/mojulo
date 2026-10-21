// The proportion stage and the balance (proportion.js): with a canon named, the lengths the stylism chose move off bad
// landings (halves, the thigh's top, the calf's belly, a short leg line) to the nearest good word of their slot, the
// hero's own standing; 'balance' picks the outline for the figure by the canon's rules. Absent, nothing moves.
import { describe, it, expect } from 'vitest';
import { proportionMoves, balanceOf, LANDINGS, LEVELS } from './proportion.js';
import { styledHero, stylismLedger } from './index.js';

describe('the proportion stage', () => {
  it('a coat ending at halves moves up to the hip; a midi skirt off the calf to the knee; shorts off the thigh\'s top', () => {
    expect(LANDINGS.coat.tunic).toBeGreaterThan(0.46);
    const { language, notes } = proportionMoves({ outer: { hem: 'tunic' }, bottom: { kind: 'skirt', leg: 'midi' } }, {}, 'western');
    expect(language.outer.hem).toBe('hip');
    expect(language.bottom.leg).toBe('knee');
    expect(notes.map((n) => n.stage)).toEqual(['proportion', 'proportion']);
    expect(proportionMoves({ bottom: { leg: 'short' } }, {}, 'western').language.bottom.leg).toBe('knee');
  });
  it('what lands well stays; the hero\'s own length stands even where it lands badly', () => {
    expect(proportionMoves({ outer: { hem: 'knee' }, bottom: { leg: 'long' } }, {}, 'western').notes).toEqual([]);
    const { language, notes } = proportionMoves({ outer: { hem: 'tunic' } }, { outer: { hem: 'tunic' } }, 'western');
    expect(language.outer.hem).toBe('tunic');
    expect(notes).toEqual([]);
  });
  it('the anime canon asks a longer leg: a top worn out at the hip still passes it; the calf\'s belly is the same body\'s', () => {
    expect(1 - LANDINGS.hem.hip).toBeGreaterThanOrEqual(0.6);
    expect(proportionMoves({ top: { hem: 'hip' } }, {}, 'anime').notes).toEqual([]);
    expect(LANDINGS.skirt.midi).toBeGreaterThanOrEqual(LEVELS.calf[0]);
  });
});

describe('the balance', () => {
  it('a figure dressed toward its canon\'s outline, by its cast and physique', () => {
    expect(balanceOf({ cast: 'male', physique: 'jacked' }, 'western').target).toBe('column');
    expect(balanceOf({ cast: 'male', physique: 'jacked' }, 'anime').target).toBe('wedge');
    expect(balanceOf({ cast: 'female', physique: 'heavyset' }, 'western').target).toBe('column');
    expect(balanceOf({ cast: 'female' }, 'western').target).toBe('hourglass');
    expect(balanceOf({ cast: 'male', physique: { weight: 0.8 } }, 'western').target).toBe('column');
  });
  it('through the stylism: the target and the moves noted, the outfit made for it; without a canon, nothing of this', () => {
    const hero = { cast: 'male', physique: 'jacked', stylism: { genre: 'modern', silhouette: 'balance', canon: 'western' } };
    const L = stylismLedger(hero);
    expect(L.silhouette.target).toBe('column');
    expect(L.notes.some((n) => n.technique === 'balance → column')).toBe(true);
    expect(styledHero(hero).outfit.type).toBe('outfit');
    const plain = { cast: 'male', stylism: { genre: 'modern', silhouette: 'wedge' } };
    expect(stylismLedger(plain).notes.some((n) => n.stage === 'proportion')).toBe(false);
  });
});
