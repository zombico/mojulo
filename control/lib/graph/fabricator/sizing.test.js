import { describe, it, expect } from 'vitest';
import { sizeBolt, sizeBearing, sizeStepper, sizeGear, requiredSf, DEFAULT_LOAD_N } from './sizing.js';
import { resolve } from './index.js';
import { fabricationPlan } from './plan.js';

// A size is the smallest stock size the strength checks pass at the safety factor the load's certainty asks: the
// pick holds, and the stock size below it does not.
const SIZES = ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M16'];
const below = (size) => SIZES[SIZES.indexOf(size) - 1];

describe('fabricator sizing', () => {
  it('a bolt is the smallest that holds: the pick passes, the size below fails', () => {
    for (const into of ['insert', 'thread', 'nut']) for (const loadN of [20, 300, 1500, 3000]) {
      const need = { host: 'printed', loadN };
      const r = sizeBolt(need, new Set(), { into });
      if (r.fail) continue;
      expect(r.sf, `${into} ${loadN}`).toBeGreaterThanOrEqual(r.required);
      if (below(r.size)) expect(sizeBolt({ ...need, size: below(r.size) }, new Set(), { into }).sf, `${into} ${loadN} below`).toBeLessThan(r.required);
    }
  });

  it('the load is shared by the fasteners, and a heat-set insert pulls out of a print long before its bolt yields', () => {
    const one = sizeBolt({ loadN: 3000 }, new Set(), { into: 'insert' });
    expect(one).toMatchObject({ size: 'M8', mode: 'insert pull-out', perPart: 3000 });
    expect(sizeBolt({ loadN: 3000, count: 4 }, new Set(), { into: 'insert' })).toMatchObject({ size: 'M4', perPart: 750 });
    expect(sizeBolt({ loadN: 30000 }, new Set(), { into: 'insert' }).fail).toMatch(/no stock insert holds 30000 N/);
  });

  it('the less certain the load, the larger the part; an impact doubles it', () => {
    expect(requiredSf({})).toBe(2);
    expect(requiredSf({ certainty: 'measured' })).toBe(1.5);
    expect(requiredSf({ certainty: 'guess' })).toBe(3);
    const at = (extra) => SIZES.indexOf(sizeBolt({ loadN: 1000, ...extra }, new Set(), { into: 'insert' }).size);
    expect(at({ certainty: 'guess' })).toBeGreaterThanOrEqual(at({}));
    expect(at({ loadKind: 'impact' })).toBeGreaterThan(at({}));
  });

  it('an unsaid load is assumed and says so; a given size is read, never replaced', () => {
    expect(sizeBolt({}, new Set(), { into: 'insert' })).toMatchObject({ size: 'M3', loadN: DEFAULT_LOAD_N, loadAssumed: true });
    expect(sizeBolt({ size: 'M3', loadN: 3000 }, new Set(), { into: 'insert' })).toMatchObject({ size: 'M3', by: 'given' });
    expect(sizeBolt({ size: 'M3', loadN: 3000 }, new Set(), { into: 'insert' }).sf).toBeLessThan(2);
  });

  it('a bearing is the slimmest whose rating carries its share, and its life at speed when rpm is said', () => {
    expect(sizeBearing({ shaftD: 8, loadN: 300 })).toMatchObject({ code: '688', mode: 'static load rating', perPart: 150 });
    expect(sizeBearing({ shaftD: 8, loadN: 300, rpm: 3000 })).toMatchObject({ code: '608', mode: 'basic life at 3000 rpm' });
    expect(sizeBearing({ shaftD: 8, loadN: 3000 }).fail).toMatch(/no 8 mm bearing carries 1500 N/);
    const over = resolve({ function: 'spin', shaftD: 8, loadN: 3000 });
    expect(over.route).toBe('mint');
    expect(over.refused.map((r) => r.strategy)).toContain('ball-bearing');
  });

  it('a stepper frame by its usable torque, a printed gear by Lewis bending', () => {
    expect(sizeStepper({})).toBeNull();
    expect(sizeStepper({ torqueNm: 0.05 })).toMatchObject({ frame: 14 });
    expect(sizeStepper({ torqueNm: 0.3 })).toMatchObject({ frame: 23 });
    expect(sizeStepper({ torqueNm: 5 }).fail).toBeTruthy();
    const g = sizeGear({ torqueNm: 2 }, { teeth: 15, face: 6 });
    expect(g).toMatchObject({ module: 2.5, face: 15, material: 'petg' });
    expect(g.sf).toBeGreaterThanOrEqual(2);
    expect(resolve({ function: 'transmit', torqueNm: 2, tags: ['print-only'] }).parts.map((p) => p.call)).toEqual(['mj_spur_gear(2.5, 15, 15)', 'mj_spur_gear(2.5, 30, 15)']);
  });

  it('the plan carries each need\'s sizing, and a sized bolt is bought in the grade the check assumed', () => {
    const p = fabricationPlan({ host: 'metal', tags: ['waterproof'], needs: [{ id: 'cover', function: 'fasten', loadN: 2000, count: 4 }, { id: 'pivot', function: 'spin', shaftD: 8 }] });
    expect(p.needs[0].sizing).toMatchObject({ by: 'strength', into: 'thread', grade: 'A2-70', material: 'al-6061', perPart: 500 });
    expect(p.needs[1].sizing).toMatchObject({ loadAssumed: true });
    expect(p.bom.find((l) => l.part === 'socket-bolt')).toMatchObject({ grade: 'A2-70', count: 4 });
  });
});
