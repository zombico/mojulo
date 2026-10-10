import { describe, it, expect } from 'vitest';
import { isStepRef, stepRefsOf, stepRefErrors, resolveStepRefs } from './plan-refs.js';

describe('step references', () => {
  it('an object is a reference only when its keys are $step and path', () => {
    expect(isStepRef({ $step: 0 })).toBe(true);
    expect(isStepRef({ $step: 0, path: '/ref' })).toBe(true);
    expect(isStepRef({ $step: 0, title: 'x' })).toBe(false);
    expect(isStepRef([{ $step: 0 }])).toBe(false);
  });
  it('finds references at any depth, with their place in args', () => {
    const args = { ref: { $step: 0, path: '/ref' }, slices: [{ stash_ref: { $step: 1, path: '/stash_ref' } }], 'a/b': { $step: 0 } };
    expect(stepRefsOf(args).map((r) => r.at)).toEqual(['/ref', '/slices/0/stash_ref', '/a~1b']);
  });
  it('compile refuses a self, forward or malformed reference', () => {
    expect(stepRefErrors({ ref: { $step: 0 } }, 0)[0]).toMatch(/first step has none/);
    expect(stepRefErrors({ ref: { $step: 2 } }, 1)[0]).toMatch(/earlier step \(0 to 0\)/);
    expect(stepRefErrors({ ref: { $step: '0' } }, 1)[0]).toMatch(/must name an earlier step/);
    expect(stepRefErrors({ ref: { $step: 0, path: 'ref' } }, 1)[0]).toMatch(/JSON Pointer/);
    expect(stepRefErrors({ ref: { $step: 0, path: '/ref' } }, 1)).toEqual([]);
  });
  it('resolves values from earlier results, objects or JSON strings', () => {
    const results = [{ ok: true, ref: 'sk_a', stats: { parts: [{ name: 'body' }] } }, '{"stash_ref":"st_b"}'];
    const { args, resolved } = resolveStepRefs({ ref: { $step: 0, path: '/ref' }, part: { $step: 0, path: '/stats/parts/0/name' }, s: { $step: 1, path: '/stash_ref' }, keep: 3 }, results, 2);
    expect(args).toEqual({ ref: 'sk_a', part: 'body', s: 'st_b', keep: 3 });
    expect(resolved).toEqual({ '/ref': 'sk_a', '/part': 'body', '/s': 'st_b' });
  });
  it('a pointer that finds nothing names the step, the path and what was there', () => {
    expect(() => resolveStepRefs({ ref: { $step: 0, path: '/sketch_ref' } }, [{ ok: true, ref: 'sk_a' }], 1))
      .toThrow(/step 0's result has nothing at '\/sketch_ref' \(stopped at 'sketch_ref'; there: ok, ref\)/);
  });
  it('leaves args without references untouched', () => {
    const args = { a: [1, { b: 2 }], c: null };
    expect(resolveStepRefs(args, [], 0).args).toEqual(args);
  });
});
