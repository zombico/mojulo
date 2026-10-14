// The racer's juice as data: every row's trigger reads into a tree over the facts (never code), a trigger that names no
// fact or cannot be read is said; a solved racer's figure carries the rows its anchors can show (a booster's flame only
// on a machine with a booster), each anchor on the body or the machine's frame (a contact never on a rolling wheel).
import { describe, it, expect } from 'vitest';
import { JUICE, FACTS, compileWhen } from './juice.js';
import { rollEgocube } from '../egocube/egocube.js';
import { racerFromSheet, solveRacer } from './racer.js';

const leaves = (n) => (n[0] === 'fact' ? [n[1]] : n[0] === 'num' ? [] : n.slice(n[0] === 'cmp' ? 2 : 1).flatMap(leaves));
describe('the juice', () => {
  it('reads every trigger into a tree over the facts', () => {
    for (const [id, j] of Object.entries(JUICE)) { const t = compileWhen(j.when); for (const f of leaves(t)) expect(FACTS, id).toContain(f); }
    expect(compileWhen('speed > 4 && !boosting')).toEqual(['and', ['cmp', '>', ['fact', 'speed'], ['num', 4]], ['not', ['fact', 'boosting']]]);
    expect(compileWhen('abs(steer) * speed >= 2 || landed')[0]).toBe('or');
    expect(() => compileWhen('speed > 4 && warp')).toThrow(/'warp' is not a fact/);
    expect(() => compileWhen('speed > ; alert(1)')).toThrow(/cannot read/);
  });
  it('rides a solved racer at the anchors it has', () => {
    const fig = (a) => solveRacer(racerFromSheet(rollEgocube({ facets: { archetype: a }, seed: 4 }), { seed: 4 }), { seed: 4 }).figure;
    const jester = fig('jester'), sage = fig('sage');
    const ids = (f) => f.juice.rows.map((r) => r.id);
    expect(ids(jester)).toContain('boostNozzle');                 // a jester's rocket
    expect(ids(sage)).not.toContain('boostNozzle');
    for (const f of [jester, sage]) {
      expect(f.juice.D).toBeGreaterThan(0.2);
      for (const a of f.juice.anchors) expect(a.bone, a.kind).toBe(a.kind.startsWith('contact') ? null : 'root');
      for (const r of f.juice.rows) expect(f.juice.anchors.some((a) => a.kind === r.at || a.kind.split('.')[0] === r.at), r.id).toBe(true);
    }
  });
});
