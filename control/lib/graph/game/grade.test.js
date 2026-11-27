// THE GRADE (game/grade.js): a level's medal read off what it kept at its win, each criterion capping it; the worst a
// criterion gives is the medal, said by its name and kept with its names. Driven on the bus by hand. And what it
// refuses, teaching.
import { describe, expect, it } from 'vitest';

import { composeMechanics, MECHANIC_KINDS } from './mechanics.js';
import { GRADE_NAMES, GRADE_VAR } from './grade.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const CRIT = [{ var: 't', best: 'low', gold: 60, silver: 90, bronze: 120 }, { var: 's', best: 'high', gold: 10, silver: 6, bronze: 3 }];
function graded(t, s, criteria = CRIT) {
  const c = composeMechanics([{ kind: 'grade', criteria }, { kind: 'reach-exit', at: [9, 0, 0] }], { player: 'p', spawn: [0, 0, 0], fall: 'none' });
  const st = B.createBusState(c.events, c.events.entities);
  st.vars.t = t; st.vars.s = s;
  const pump = (evs) => { B.processEvents(st, evs); let w = B.watchEvents(st); while (w.length) { B.processEvents(st, w); w = B.watchEvents(st); } };
  pump([{ type: 'objectives:done' }]);
  return { medal: st.vars[GRADE_VAR], log: st.log.map((r) => r.type), keep: c.keep };
}

describe('the grade', () => {
  it('is a mechanic', () => { expect(MECHANIC_KINDS).toContain('grade'); });
  it('gives the worst a criterion earns: a low best at or under its bound, a high one at or over', () => {
    expect(graded(55, 12).medal).toBe(3);
    expect(graded(60, 10).medal).toBe(3);            // at the bound earns it
    expect(graded(61, 12).medal).toBe(2);            // a time a second past gold
    expect(graded(55, 5).medal).toBe(1);             // a score under silver
    expect(graded(100, 12).medal).toBe(1);
    expect(graded(130, 12).medal).toBe(0);           // past bronze: none
    expect(graded(55, 2).medal).toBe(0);
  });
  it('says the medal by its name, and keeps it with its names', () => {
    expect(graded(55, 12).log).toContain('grade:gold');
    expect(graded(100, 12).log).toContain('grade:bronze');
    expect(graded(130, 12).log).toContain('grade:none');
    expect(graded(55, 12).keep).toEqual(expect.arrayContaining([{ var: GRADE_VAR, label: 'Medal', best: 'high', names: [...GRADE_NAMES] }]));
  });
  it('refuses what it cannot read, teaching', () => {
    const bad = (criteria) => () => composeMechanics([{ kind: 'grade', criteria }, { kind: 'reach-exit', at: [9, 0, 0] }], { player: 'p', spawn: [0, 0, 0], fall: 'none' });
    expect(bad([])).toThrow(/needs criteria/);
    expect(bad([{ var: 't', best: 'low', gold: 90, silver: 60, bronze: 120 }])).toThrow(/gold ≤ silver ≤ bronze/);
    expect(bad([{ var: 't', best: 'high', gold: 1, silver: 2, bronze: 3 }])).toThrow(/gold ≥ silver ≥ bronze/);
    expect(bad([{ var: 't', best: 'most', gold: 1, silver: 2, bronze: 3 }])).toThrow(/best is low/);
  });
});
