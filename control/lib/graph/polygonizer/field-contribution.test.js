/**
 * field-contribution — the term-list contribution check.
 *
 * The cases are the two failures a blended-term sculpt actually hits: a mass that never breaks
 * its host's silhouette (draws nothing), and a mass that clears its host by less than its own
 * blend bulge (correct geometry, invisible result).
 */
import { describe, it, expect } from 'vitest';
import { auditFieldContribution, BULGE_OF_K } from './field-contribution.js';

const add = (id, center, radius, blend) => ({ id, op: 'add', ...(blend ? { blend } : {}), shape: { kind: 'sphere', center, radius } });
const sub = (id, center, radius) => ({ id, op: 'subtract', shape: { kind: 'sphere', center, radius } });
const row = (out, id) => out.terms.find((t) => t.id === id);

describe('auditFieldContribution', () => {
  it('flags a term swallowed whole by a sibling', () => {
    const out = auditFieldContribution({ terms: [add('host', [0, 0, 0], 6), add('swallowed', [0, 0, 0], 2)] });
    expect(out.audited).toBe(true);
    expect(row(out, 'swallowed').buried).toBe(true);
    expect(row(out, 'swallowed').exposure).toBe(0);
    expect(row(out, 'host').buried).toBe(false);
    expect(out.warnings.join(' ')).toMatch(/BURIED/);
    expect(out.warnings.join(' ')).toMatch(/swallowed/);
  });

  it('passes two masses that each break the other\'s silhouette', () => {
    const out = auditFieldContribution({ terms: [add('a', [0, 0, 0], 4), add('b', [5, 0, 0], 4)] });
    expect(out.terms.every((t) => !t.buried)).toBe(true);
    expect(out.warnings).toEqual([]);
  });

  it('reports protrusion as the distance the term stands proud of its neighbours', () => {
    // b's centre is 5 from a's, radius 4, so its far pole clears a's surface by 5 + 4 - 4 = 5.
    const out = auditFieldContribution({ terms: [add('a', [0, 0, 0], 4), add('b', [5, 0, 0], 4)] });
    expect(row(out, 'b').protrusion).toBeGreaterThan(4.5);
    expect(row(out, 'b').protrusion).toBeLessThan(5.5);
  });

  it('flags a term that clears its host by less than its own blend bulge', () => {
    // proud by ~0.6; a blend of 6 bulges by 6 * BULGE_OF_K = 1.5, which eats it.
    const terms = [add('host', [0, 0, 0], 6), add('nub', [0, 0, 5.6], 1.0, 6)];
    const out = auditFieldContribution({ terms });
    const nub = row(out, 'nub');
    expect(nub.buried).toBe(false);
    expect(nub.protrusion).toBeLessThan(6 * BULGE_OF_K);
    expect(nub.absorbed).toBe(true);
    expect(out.warnings.join(' ')).toMatch(/swallows them/);
  });

  it('does not call a well-proud term absorbed, whatever its blend', () => {
    const out = auditFieldContribution({ terms: [add('host', [0, 0, 0], 6), add('horn', [0, 0, 9], 2.0, 1.0)] });
    expect(row(out, 'horn').absorbed).toBe(false);
    expect(row(out, 'horn').buried).toBe(false);
  });

  it('counts a point removed by a cut as not exposed', () => {
    // The nub is proud of the host, but a subtract takes the whole protruding cap away.
    const proud = auditFieldContribution({ terms: [add('host', [0, 0, 0], 6), add('nub', [0, 0, 7], 2)] });
    expect(row(proud, 'nub').buried).toBe(false);
    const cut = auditFieldContribution({ terms: [add('host', [0, 0, 0], 6), add('nub', [0, 0, 7], 2), sub('cut', [0, 0, 9], 4.5)] });
    expect(row(cut, 'nub').buried).toBe(true);
  });

  it('reports a domain-op list as unaudited rather than auditing it wrongly', () => {
    const out = auditFieldContribution({
      terms: [add('a', [0, 0, 0], 4), add('b', [5, 0, 0], 4), { op: 'twist', axis: 'z', turns: 1 }],
    });
    expect(out.audited).toBe(false);
    expect(out.reason).toMatch(/domain op/);
    expect(out.terms).toEqual([]);
  });

  it('is a no-op below two add terms', () => {
    expect(auditFieldContribution({ terms: [add('only', [0, 0, 0], 3)] })).toEqual({ audited: true, terms: [], warnings: [] });
    expect(auditFieldContribution({})).toEqual({ audited: true, terms: [], warnings: [] });
  });

  it('is deterministic', () => {
    const terms = [add('a', [0, 0, 0], 5), add('b', [3, 1, 0], 3, 1.2), add('c', [0, 0, 0], 1)];
    expect(auditFieldContribution({ terms })).toEqual(auditFieldContribution({ terms }));
  });
});
