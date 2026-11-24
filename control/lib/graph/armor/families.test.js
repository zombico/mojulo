// LEATHER AND MAIL (armor/leather.js, armor/mail.js): each its own construction, never plates. Leather is seams and
// fastenings (welts, laces, buckles) over one hide; mail a fabric of rings that follows the body, its field in courses.
import { describe, it, expect } from 'vitest';
import { expandArmor, validateArmor, armorFamily } from './expand.js';
import { SEEDED_ARMOR } from './styles.js';

const kit = (style, c, language) => expandArmor({ type: 'armor', style, dials: { coverage: c }, ...(language ? { language } : {}) }, { Ht: 4, Hl: 3, scale: 1 });
const ofFamily = (f) => Object.keys(SEEDED_ARMOR).find((k) => SEEDED_ARMOR[k].family === f);

describe('the leather family', () => {
  const style = ofFamily('leather');
  it('is hide closed by laces or buckles, welted at its edges; coverage grows it out from the cuirass', () => {
    const low = kit(style, 0, { cut: 'jerkin' }), full = kit(style, 1, { cut: 'jerkin' });
    expect(armorFamily({ type: 'armor', style })).toBe('leather');
    expect(low.trace.worn).toEqual(['cuirass']);
    expect(full.trace.worn.length).toBeGreaterThan(low.trace.worn.length);
    expect(low.kit.some((a) => a.group === 'Lace')).toBe(true);
    expect(low.kit.some((a) => a.group === 'Welt')).toBe(true);
    expect(kit(style, 0, { cut: 'cuirass' }).kit.some((a) => a.signature?.kind === 'buckle')).toBe(true);
  });
  it('studs: rows of rivets across the field, none when asked for none', () => {
    const studs = (n) => kit(style, 0, { cut: 'cuirass', studs: n }).kit.filter((a) => a.ghost).length;
    expect(studs(0)).toBe(0);
    expect(studs(2)).toBeGreaterThan(0);
  });
});

describe('the mail family', () => {
  const style = ofFamily('mail');
  it('is rings that follow the body: every mail piece is worked in courses and none is rigid but the coif', () => {
    const { kit: K } = kit(style, 1);
    const mail = K.filter((a) => a.group === 'Mail');
    expect(mail.length).toBeGreaterThan(4);
    expect(mail.every((a) => a.signature.kind === 'courses')).toBe(true);
    expect(mail.filter((a) => a.rigid).every((a) => a.part === 'cranium')).toBe(true);
  });
  it('the coif and the surcoat are words', () => {
    expect(kit(style, 1, { coif: false }).kit.some((a) => a.part === 'cranium')).toBe(false);
    expect(kit(style, 0, { surcoat: 'tabard' }).kit.some((a) => a.signature?.kind === 'tabard')).toBe(true);
    expect(validateArmor({ type: 'armor', style, language: { surcoat: 'cape' } }).join()).toMatch(/surcoat/);
  });
});
