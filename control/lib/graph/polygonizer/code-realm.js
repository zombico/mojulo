/**
 * code-realm — the code door (expressiveness.plan.md E3, "expressive code injection",
 * D2 decided 2026-09-06). A recipe may carry a PROGRAM: a `source` string that runs
 * once per render as the body of `(params, ctx) => spec | faces`, in a realm that has
 * the language and nothing of the host. Determinism comes from what the code CANNOT
 * reach, not from a test of what it did:
 *
 *   • a fresh `node:vm` context per run — no `process`, `require`, `fetch`, `fs`, timers,
 *     no `import()` (vm refuses dynamic import unless a callback is supplied; none is);
 *   • `Math.random` IS `mulberry32(seed)` — dice are not forbidden, they are seeded;
 *   • `Date` throws a one-line teaching error ("the realm has no clock"); `Intl` is
 *     removed (locale-dependent);
 *   • `console.log` is CAPTURED, not printed — the lines ride back on the mint result
 *     (and on a mint error), so the agent's loop is mint → read the log → update_sketch;
 *   • the whole run, the returned value's serialisation included, sits under vm's own
 *     wall-clock `timeout` (`budgetMs`, default 5,000, cap 60,000). The value comes back
 *     through JSON inside the budget, so no getter or prototype can run realm code later.
 *
 * The fence is a DETERMINISM fence, not a security boundary (CLAUDE.md: single-operator,
 * loopback-only; `node:vm` says the same of itself). The operator's own agent wrote the
 * code on the operator's own machine.
 *
 * COMPATIBILITY PROMISE: the realm's globals and `REALM_VERSION` are part of what a
 * shipped recipe's faces depend on — append-only, never reshaped, same as the toolkit.
 */

import vm from 'node:vm';
import { createHash } from 'node:crypto';

export const REALM_VERSION = 1;
export const MAX_SOURCE_BYTES = 64 * 1024;
export const DEFAULT_BUDGET_MS = 5000;
export const MAX_BUDGET_MS = 60000;
const MAX_LOG_LINES = 200;
const MAX_LOG_BYTES = 64 * 1024;

export const sourceHash = (source) => createHash('sha256').update(String(source)).digest('hex').slice(0, 16);

// mulberry32 — the builders' seeded dice (floorplan-glyphs.js:24), as source text so the
// stream is generated INSIDE the realm (a realm function, realm numbers, no host closure).
const MULBERRY_SRC = `(function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})`;

// The prelude: shadow what the fresh context still has of a clock or a locale, seed the dice.
const PRELUDE = `
(function () {
  'use strict';
  const noClock = function () { throw new Error('the realm has no clock — a recipe is the same object tomorrow (Date is not available; seed dice with \`seed\`)'); };
  noClock.now = noClock; noClock.parse = noClock; noClock.UTC = noClock;
  Object.defineProperty(globalThis, 'Date', { value: noClock, writable: false, configurable: false, enumerable: false });
  try { delete globalThis.Intl; } catch (_) { /* absent on some builds */ }
  Object.defineProperty(Math, 'random', { value: ${MULBERRY_SRC}(__seed), writable: false, configurable: false });
})();
`;

// One compiled Script per program (by source hash); the script reads params / ctx from
// the context's globals so the same compile serves every params change.
const scriptCache = new Map();
const MAX_CACHED_SCRIPTS = 64;

function programScript(source) {
  const key = sourceHash(source);
  let script = scriptCache.get(key);
  if (script) return script;
  // The source is the BODY of a function (params, ctx). Wrapped so a stray top-level
  // `return` is legal and the whole thing evaluates to a JSON string inside the budget.
  const wrapped = `(function () {
  'use strict';
  const __fn = function (params, ctx) {
${source}
  };
  const __out = __fn(__params, __ctx);
  if (__out && typeof __out.then === 'function') { try { __out.then(null, function () {}); } catch (_) {} throw new Error('the program returned a Promise — a recipe must return its spec synchronously (the budget cannot see async work)'); }
  return JSON.stringify(__out === undefined ? null : __out);
})()`;
  script = new vm.Script(wrapped, { filename: `code-solid-${key}.js` });
  if (scriptCache.size >= MAX_CACHED_SCRIPTS) scriptCache.delete(scriptCache.keys().next().value);
  scriptCache.set(key, script);
  return script;
}

const fmt = (v) => {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try { return JSON.stringify(v); } catch { return String(v); }
};

/** Validate a program block → error strings. */
export function validateProgram(program, at = 'program') {
  const e = [];
  if (!program || typeof program !== 'object') { e.push(`${at}: must be { source, params?, seed?, budgetMs? }`); return e; }
  if (typeof program.source !== 'string' || !program.source.trim()) e.push(`${at}.source: must be a non-empty string — the body of a function (params, ctx) that RETURNS a workbench spec or a face list`);
  else {
    const bytes = Buffer.byteLength(program.source, 'utf8');
    if (bytes > MAX_SOURCE_BYTES) e.push(`${at}.source: ${bytes} bytes exceeds the ${MAX_SOURCE_BYTES}-byte cap — a recipe is small; move tables into \`params\` or split the part`);
  }
  if (program.params !== undefined) {
    if (!program.params || typeof program.params !== 'object' || Array.isArray(program.params)) e.push(`${at}.params: must be an object of dials (numbers, strings, arrays, nested objects — JSON only)`);
    else { try { JSON.stringify(program.params); } catch { e.push(`${at}.params: must be JSON-serialisable`); } }
  }
  if (program.seed !== undefined && !Number.isFinite(program.seed)) e.push(`${at}.seed: must be a finite number`);
  if (program.budgetMs !== undefined && !(Number.isFinite(program.budgetMs) && program.budgetMs > 0 && program.budgetMs <= MAX_BUDGET_MS)) e.push(`${at}.budgetMs: must be a number in (0, ${MAX_BUDGET_MS}]`);
  return e;
}

/**
 * runCodeRealm({ source, params, seed, budgetMs, ctx }) → { value, log, ms }
 * `value` is a JSON-clean clone of whatever the program returned. Throws on a program
 * error or a timeout; the thrown Error carries `.log` (the captured lines so far) and
 * `.timedOut` when the budget ran out.
 */
export function runCodeRealm({ source, params = {}, seed = 0, budgetMs, ctx = {} } = {}) {
  const errs = validateProgram({ source, params, seed, budgetMs });
  if (errs.length) throw new Error(errs.join('; '));
  const budget = Number.isFinite(budgetMs) ? Math.min(budgetMs, MAX_BUDGET_MS) : DEFAULT_BUDGET_MS;
  const log = [];
  let logBytes = 0;
  const capture = (level) => (...args) => {
    if (log.length >= MAX_LOG_LINES) return;
    const line = (level === 'log' ? '' : `[${level}] `) + args.map(fmt).join(' ');
    logBytes += line.length;
    if (logBytes > MAX_LOG_BYTES) { if (log[log.length - 1] !== '… (log truncated)') log.push('… (log truncated)'); return; }
    log.push(line);
  };
  const sandbox = {
    console: Object.freeze({ log: capture('log'), info: capture('info'), warn: capture('warn'), error: capture('error'), debug: capture('log') }),
    __seed: Math.trunc(seed) | 0,
    __ctx: ctx,
  };
  const context = vm.createContext(sandbox, { codeGeneration: { strings: true, wasm: false } });
  vm.runInContext(PRELUDE, context);
  // params cross into the realm as a fresh JSON clone (realm prototypes, no host links)
  vm.runInContext(`globalThis.__params = ${JSON.stringify(JSON.stringify(params))};`, context);
  vm.runInContext('globalThis.__params = JSON.parse(globalThis.__params);', context);
  const t0 = performance.now();
  let json;
  try {
    json = programScript(source).runInContext(context, { timeout: budget, breakOnSigint: true });
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    const timedOut = err && err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT';
    const out = new Error(timedOut
      ? `the program ran past its budget (budgetMs ${budget}) — an unbounded loop, or a part too fine for the budget; raise \`budgetMs\` (≤ ${MAX_BUDGET_MS}) or coarsen the part`
      : `the program threw: ${err && err.message ? err.message : String(err)}`);
    out.log = log;
    out.timedOut = !!timedOut;
    out.ms = ms;
    throw out;
  }
  const ms = Math.round(performance.now() - t0);
  const value = json === undefined ? null : JSON.parse(json);
  return { value, log, ms };
}

/** Test seam: drop the compiled-script cache. */
export function _resetCodeRealmCache() { scriptCache.clear(); }
