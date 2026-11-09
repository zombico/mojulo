import { describe, it, expect } from 'vitest';
import { wieldsFigure, armHeld } from './held-strike.js';

// THE HELD STRIKE's wielder: the body that plays a hero strikes with what it holds, and so does an action hero sheathed
// out of combat, whose combat draws that hero (the sheathed hero is the body's figure until a fight).
const body = (figure, rule = {}) => ({ id: 'hero', body: { figure }, rule: { type: 'platform', strikeContact: [0.3, 0.4], ...rule } });
const HELD = { item: 'sword', class: 'normal', reach: 1.55, seconds: 0.5, damage: 2 };
describe('who wields the hero\'s blade', () => {
  it('the body playing the hero, and the sheathed body whose combat draws it', () => {
    expect(wieldsFigure(body('hero'), 'hero')).toBe(true);
    const sheathed = body('hero-sheathed', { combat: { drawn: 'hero', sheathed: 'hero-sheathed' } });
    expect(wieldsFigure(sheathed, 'hero')).toBe(true);
    // (the sheathed figure itself holds nothing in its hand: its bake finds no blade, so it arms nothing)
    expect(wieldsFigure(sheathed, 'other')).toBe(false);
  });
  it('never a body with a strike of its own, without a feel\'s string, or not a platform body', () => {
    expect(wieldsFigure(body('hero', { strike: 'melee' }), 'hero')).toBe(false);
    expect(wieldsFigure({ body: { figure: 'hero' }, rule: { type: 'platform' } }, 'hero')).toBe(false);
    expect(wieldsFigure({ body: { figure: 'hero' }, rule: { type: 'walk', strikeContact: [0.3, 0.4] } }, 'hero')).toBe(false);
  });
  it('arms the rule with the held blade, the rule\'s own numbers standing', () => {
    expect(armHeld(body('hero'), HELD).rule).toMatchObject({ strike: 'melee', strikeReach: 1.55, strikeDur: 0.5, strikeDamage: 2 });
    expect(armHeld(body('hero', { strikeDur: 0.4 }), HELD).rule.strikeDur).toBe(0.4);
  });
});
