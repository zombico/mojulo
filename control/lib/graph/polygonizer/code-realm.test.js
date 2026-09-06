/**
 * code-realm — the code door's realm (expressiveness.plan.md E3). Mojulo's tests, not the
 * sketch's: the realm exposes none of process / require / fetch / setTimeout / import();
 * Math.random is seeded (same seed same stream, different seed different); Date throws the
 * teaching error; an unbounded loop hits the budget and the error names budgetMs; the
 * console capture round-trips (and rides on an error); a Promise return is refused; the
 * returned value is a JSON clone (no realm getters survive); source over 64 KB is refused
 * with the number; the compiled script is cached by source hash.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { runCodeRealm, validateProgram, sourceHash, MAX_SOURCE_BYTES, REALM_VERSION, _resetCodeRealmCache } from './code-realm.js';

const run = (source, extra = {}) => runCodeRealm({ source, ...extra });

describe('the fence — by absence', () => {
  beforeEach(() => _resetCodeRealmCache());
  it('none of the host reaches the program', () => {
    const { value } = run(`return {
      process: typeof process, require: typeof require, fetch: typeof fetch, fs: typeof fs,
      setTimeout: typeof setTimeout, setInterval: typeof setInterval, queueMicrotask: typeof queueMicrotask,
      WebSocket: typeof WebSocket, XMLHttpRequest: typeof XMLHttpRequest, Intl: typeof Intl, performance: typeof performance,
      crypto: typeof crypto, Buffer: typeof Buffer, global: typeof global, module: typeof module, __dirname: typeof __dirname,
      hostKeys: ['process', 'require', 'fetch', 'setTimeout', 'crypto', 'Buffer', 'global', 'module', 'Intl', 'performance'].filter((k) => k in globalThis),
    };`);
    for (const k of ['process', 'require', 'fetch', 'fs', 'setTimeout', 'setInterval', 'queueMicrotask', 'WebSocket', 'XMLHttpRequest', 'Intl', 'performance', 'crypto', 'Buffer', 'global', 'module', '__dirname']) {
      expect(value[k], k).toBe('undefined');
    }
    expect(value.hostKeys).toEqual([]);
  });
  it('dynamic import() is refused by the runtime', () => {
    expect(() => run("return import('node:fs');")).toThrow(/program threw|Promise/);
  });
  it('Date throws the teaching error, so does Date.now()', () => {
    expect(() => run('return Date.now();')).toThrow(/the realm has no clock — a recipe is the same object tomorrow/);
    expect(() => run('return new Date().getTime();')).toThrow(/no clock/);
  });
  it('Math.random IS mulberry32(seed): same seed same stream, different seed different, independent of the host', () => {
    const src = 'return [Math.random(), Math.random(), Math.random()];';
    const a = run(src, { seed: 7 }).value;
    const b = run(src, { seed: 7 }).value;
    const c = run(src, { seed: 8 }).value;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toEqual([0.011704753153026104, 0.06195825757458806, 0.97690763277933]);   // pinned: the stream is a promise
    expect(Math.random).not.toBe(undefined);   // the host's own dice untouched
    expect(() => run('Math.random = () => 1; return 1;')).toThrow(/program threw/);   // frozen in strict mode
  });
});

describe('the budget', () => {
  it('a while(true) hits the timeout and the error names budgetMs', () => {
    let err;
    try { run('while (true) {}', { budgetMs: 100 }); } catch (e) { err = e; }
    expect(err.message).toMatch(/ran past its budget \(budgetMs 100\)/);
    expect(err.timedOut).toBe(true);
  });
  it('the budget covers the returned value\'s serialisation too (a getter cannot run later)', () => {
    let err;
    try { run('return { get a() { while (true) {} } };', { budgetMs: 100 }); } catch (e) { err = e; }
    expect(err && err.timedOut).toBe(true);
  });
  it('a Promise return is refused with a teaching error', () => {
    expect(() => run('return Promise.resolve({ lathes: [] });')).toThrow(/returned a Promise.*synchronously/);
  });
  it('validateProgram: source cap with the number, params JSON-only, seed / budget ranges', () => {
    const big = 'x'.repeat(MAX_SOURCE_BYTES + 1);
    expect(validateProgram({ source: big })).toEqual([expect.stringMatching(/65537 bytes exceeds the 65536-byte cap/)]);
    expect(validateProgram({ source: 'return 1', params: [1] })).toEqual([expect.stringMatching(/params: must be an object/)]);
    expect(validateProgram({ source: 'return 1', seed: NaN, budgetMs: 70000 })).toEqual([
      expect.stringMatching(/seed: must be a finite number/), expect.stringMatching(/budgetMs: must be a number in \(0, 60000\]/),
    ]);
    expect(validateProgram({ source: '  ' })).toEqual([expect.stringMatching(/source: must be a non-empty string/)]);
    expect(validateProgram({ source: 'return 1', params: { a: 1 }, seed: 3, budgetMs: 50 })).toEqual([]);
  });
});

describe('the loop — log, params, ctx, the clone', () => {
  it('console lines are captured, not printed, and ride on an error too', () => {
    const { value, log } = run("console.log('a', 1, { b: 2 }); console.warn('w'); return typeof log === 'undefined' ? 1 : 2;");
    expect(value).toBe(1);
    expect(log).toEqual(['a 1 {"b":2}', '[warn] w']);
    let err;
    try { run("console.log('before'); throw new Error('boom');"); } catch (e) { err = e; }
    expect(err.message).toMatch(/program threw: boom/);
    expect(err.log).toEqual(['before']);
  });
  it('params cross as a JSON clone; ctx is the injected toolkit; the return is a JSON clone', () => {
    const params = { n: 3, names: ['a', 'b'] };
    const ctx = { version: 2, add: (a, b) => a + b };
    const { value } = run('params.n += 1; return { n: params.n, sum: ctx.add(1, 2), v: ctx.version, f: () => 1, u: undefined };', { params, ctx });
    expect(params.n).toBe(3);                    // the host's object untouched
    expect(value).toEqual({ n: 4, sum: 3, v: 2 });   // functions / undefined dropped by the clone
  });
  it('a syntax error is a program error with the message', () => {
    expect(() => run('return {')).toThrow(/program threw: Unexpected/);
  });
  it('returns null for a program that returns nothing', () => {
    expect(run('const x = 1;').value).toBe(null);
  });
  it('sourceHash is stable and 16 hex chars; the realm version is 1', () => {
    expect(sourceHash('return 1')).toMatch(/^[0-9a-f]{16}$/);
    expect(sourceHash('return 1')).toBe(sourceHash('return 1'));
    expect(REALM_VERSION).toBe(1);
  });
});
