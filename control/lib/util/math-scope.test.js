import { describe, expect, it } from 'vitest';

import * as dmath from './dmath.js';
import { SM, mathKey, withMath } from './math-scope.js';

describe('math-scope', () => {
  it('is Math outside a scope and the given math inside one, restored after', () => {
    expect(SM).toBe(Math);
    expect(mathKey()).toBe('');
    expect(withMath(dmath, () => [SM, mathKey()])).toEqual([dmath, '|dm']);
    expect(SM).toBe(Math);
  });
  it('nests, and restores after a throw', () => {
    withMath(dmath, () => { withMath(Math, () => expect(SM).toBe(Math)); expect(SM).toBe(dmath); });
    expect(() => withMath(dmath, () => { throw new Error('boom'); })).toThrow('boom');
    expect(SM).toBe(Math);
  });
  it('refuses a build that returns a promise, whose awaited part would run outside the scope', () => {
    expect(() => withMath(dmath, async () => 1)).toThrow(/synchronous/);
    expect(SM).toBe(Math);
  });
});
