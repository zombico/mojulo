import { describe, it, expect } from 'vitest';
import { CAR_CARD_IDS, BODY_STYLE_IDS, CAR_LANGUAGE_IDS, composeCar, compileCar } from './index.js';

// the sweep: every card of the library and every body in every language, each solved within its laws and drawn at its
// class's numbers (the law tests pick one case a procedure: car-shelf.test.js)
describe('every card stands within its laws at its class\'s numbers', () => {
  for (const id of CAR_CARD_IDS) {
    it(id, () => {
      const c = compileCar(id, { form: true }), a = c.census.against;
      expect(c.design.laws.filter((l) => !l.pass).map((l) => l.id)).toEqual([]);
      for (const k of ['L', 'W', 'H']) { expect(a[k], k).toBeGreaterThan(0.97); expect(a[k], k).toBeLessThan(1.025); }
      expect(a.wheelbase).toBeCloseTo(1, 3);
    });
  }
});

describe('every body in every language draws', () => {
  for (const body of BODY_STYLE_IDS) {
    it(body, () => {
      for (const language of CAR_LANGUAGE_IDS) {
        const d = composeCar({ class: 'compact', body, language });
        const c = compileCar({ class: 'compact', body, language }, { form: true });
        expect(Object.values(c.form).flat().length, `${body} ${language}`).toBeGreaterThan(500);
        expect(c.census.against.wheelbase, `${body} ${language}`).toBeCloseTo(1, 3);
        expect(d.valid || d.laws.filter((l) => !l.pass).every((l) => l.id === 'bonnet-over-wheels'), `${body} ${language}`).toBe(true);
      }
    });
  }
});
