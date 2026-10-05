import { describe, it, expect } from 'vitest';
import { describeHistoric, fmtSpan, fmtYear, periodText } from './depiction.js';
import { HISTORIC_CULTURES } from './historic/historic-city.js';

describe('depiction: the caption a historic scene carries', () => {
  it('says period and depiction in one line, from the cards', () => {
    expect(describeHistoric({ culture: 'thebes' }).caption).toBe(
      'New Kingdom Thebes · New Kingdom, c. 1550–1070 BCE (read at c. 1250 BCE) · Thebes, Upper Egypt — drawn sixth-gen, to the thebes style card');
  });

  it('fills every field for every culture, and quotes each card its own years', () => {
    for (const [id, card] of Object.entries(HISTORIC_CULTURES)) {
      const d = describeHistoric({ culture: id });
      expect(d.subject, id).toBeTruthy();
      expect(d.place, id).toBeTruthy();
      expect(d.depiction.era, id).toBe('sixth-gen');
      expect(d.caption, id).toContain(fmtSpan(card.years));
      if (Number.isFinite(card.readAt)) expect(d.caption, id).toContain(`read at c. ${fmtYear(card.readAt)}`);
    }
  });

  it('never guesses: no read-at where the card has none, an invented place where there is no town', () => {
    const sumer = describeHistoric({ culture: 'sumer' });
    expect(sumer.period.readAt).toBeNull();
    expect(sumer.caption).not.toMatch(/read at/);
    const polis = describeHistoric({ culture: 'polis' });
    expect(polis.place).toBe('invented');
    expect(polis.caption).toContain('invented place');
  });

  it("names a scene's own subject: the land, the farm and the works are not the town", () => {
    expect(describeHistoric({ culture: 'thebes', scene: 'region' }).subject).toBe('Thebes and its land');
    expect(describeHistoric({ culture: 'thebes', scene: 'farm' }).subject).toMatch(/estate of Amun/);
    expect(describeHistoric({ culture: 'sumer', scene: 'works' }).subject).toMatch(/works of a Sumerian town/);
  });

  it('is pure, and returns nothing for a culture it does not know', () => {
    expect(describeHistoric({ culture: 'qin' })).toEqual(describeHistoric({ culture: 'qin' }));
    expect(describeHistoric({ culture: 'rome' })).toBeNull();
  });

  it('writes spans and periods plainly', () => {
    expect(fmtSpan([-350, -206])).toBe('c. 350–206 BCE');
    expect(fmtSpan([-30, 14])).toBe('c. 30 BCE–14 CE');
    expect(periodText(null)).toBe('no period');
  });
});
