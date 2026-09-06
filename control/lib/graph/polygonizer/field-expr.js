/**
 * field-expr — a distance EXPRESSION as a field term (expressiveness.plan.md E1).
 *
 * The polygonizer never needed to learn a shape: `surfaceNetFaces` takes any
 * `(p) => number`. The ceiling was the shape list in front of it. An `expr` term
 * lifts that ceiling: any shape an agent can write as a signed distance over
 * `x y z` is in the vocabulary already — a gyroid, a twisted box, a bolt circle by
 * polar `mod`, a wavy plate, a fillet by `smin`.
 *
 * Grammar (small on purpose — infix, GLSL-like, because that is what a model writes
 * fluently):
 *
 *   program := ( 'let' IDENT '=' expr ';' )* expr
 *   expr    := cond '?' expr ':' expr | arith
 *   cond    := comparison ( && || ) comparison | !cond | ( cond )
 *   arith   := + - * / % | unary - | ( ) | number | x y z | IDENT | call | PI TAU E
 *   call    := abs min max sqrt hypot sin cos tan asin acos atan atan2 pow exp log
 *              floor ceil fract mod clamp mix sign step smoothstep smin smax len2 len3
 *              noise3(x, y, z, seed, scale?, octaves?, persistence?)
 *
 * Everything is a number; comparisons are legal only inside a ternary condition; no
 * strings, no loops, no user functions. `mod` is FLOORED (GLSL's), `%` is truncated
 * (JS's) — they differ for negatives, and domain repetition wants `mod`.
 *
 * Three surfaces off ONE AST:
 *   parseFieldExpr(src)          → ast (teaching errors carry a caret position)
 *   compileFieldExpr(ast, vars)  → (p:{x,y,z}) => number — a closure tree, NOT
 *                                  `new Function`: no source text is ever executed
 *   emitFieldExprGlsl(ast, opts) → a GLSL `float name(vec3 p)` (E1b, the
 *                                  one-table-two-emissions consolidation)
 *
 * COMPATIBILITY PROMISE: `EXPR_FUNCS` is append-only. A shipped recipe's faces are a
 * promise, so a numerics change to a shipped function is a NEW name, never an edit.
 * `EXPR_GRAMMAR_VERSION` is stamped into the export ledger.
 *
 * Pure: no dice (noise3 is a seeded hash lattice with a literal seed), no clock.
 */

import { smin, smax } from './vajra.js';
import { noise3 } from './fields.js';

export const EXPR_GRAMMAR_VERSION = 1;

// ─── the function table (append-only) ────────────────────────────────────────────
// { arity: n | [min, max], fn, glsl: (args:string[]) => string | null (no GLSL twin) }

const g1 = (name) => (a) => `${name}(${a[0]})`;
const g2 = (name) => (a) => `${name}(${a[0]}, ${a[1]})`;
const g3 = (name) => (a) => `${name}(${a[0]}, ${a[1]}, ${a[2]})`;
const floorMod = (a, b) => a - b * Math.floor(a / b);
const clampf = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const smoothstepf = (e0, e1, x) => { const t = clampf((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

export const EXPR_FUNCS = Object.freeze({
  abs: { arity: 1, fn: Math.abs, glsl: g1('abs') },
  min: { arity: 2, fn: Math.min, glsl: g2('min') },
  max: { arity: 2, fn: Math.max, glsl: g2('max') },
  sqrt: { arity: 1, fn: Math.sqrt, glsl: g1('sqrt') },
  hypot: { arity: [2, 3], fn: Math.hypot, glsl: (a) => (a.length === 2 ? `length(vec2(${a[0]}, ${a[1]}))` : `length(vec3(${a[0]}, ${a[1]}, ${a[2]}))`) },
  sin: { arity: 1, fn: Math.sin, glsl: g1('sin') },
  cos: { arity: 1, fn: Math.cos, glsl: g1('cos') },
  tan: { arity: 1, fn: Math.tan, glsl: g1('tan') },
  asin: { arity: 1, fn: Math.asin, glsl: g1('asin') },
  acos: { arity: 1, fn: Math.acos, glsl: g1('acos') },
  atan: { arity: 1, fn: Math.atan, glsl: g1('atan') },
  atan2: { arity: 2, fn: Math.atan2, glsl: g2('atan') },
  pow: { arity: 2, fn: Math.pow, glsl: g2('pow') },
  exp: { arity: 1, fn: Math.exp, glsl: g1('exp') },
  log: { arity: 1, fn: Math.log, glsl: g1('log') },
  floor: { arity: 1, fn: Math.floor, glsl: g1('floor') },
  ceil: { arity: 1, fn: Math.ceil, glsl: g1('ceil') },
  fract: { arity: 1, fn: (a) => a - Math.floor(a), glsl: g1('fract') },
  mod: { arity: 2, fn: floorMod, glsl: g2('mod') },
  clamp: { arity: 3, fn: clampf, glsl: g3('clamp') },
  mix: { arity: 3, fn: (a, b, t) => a + (b - a) * t, glsl: g3('mix') },
  sign: { arity: 1, fn: Math.sign, glsl: g1('sign') },
  step: { arity: 2, fn: (edge, x) => (x < edge ? 0 : 1), glsl: g2('step') },
  smoothstep: { arity: 3, fn: smoothstepf, glsl: g3('smoothstep') },
  smin: { arity: 3, fn: smin, glsl: g3('sdfSmin') },
  smax: { arity: 3, fn: smax, glsl: g3('sdfSmax') },
  len2: { arity: 2, fn: Math.hypot, glsl: (a) => `length(vec2(${a[0]}, ${a[1]}))` },
  len3: { arity: 3, fn: Math.hypot, glsl: (a) => `length(vec3(${a[0]}, ${a[1]}, ${a[2]}))` },
  // noise3(x, y, z, seed, scale?, octaves?, persistence?) — the seed is a literal in the
  // expression, so the same expression is the same field forever. No GLSL twin yet.
  noise3: {
    arity: [4, 7],
    fn: (x, y, z, seed, scale, octaves, persistence) => noise3({ x, y, z }, {
      seed, ...(scale !== undefined ? { scale } : {}),
      ...(octaves !== undefined ? { octaves: Math.round(octaves) } : {}),
      ...(persistence !== undefined ? { persistence } : {}),
    }),
    glsl: null,
  },
});

export const EXPR_CONSTS = Object.freeze({ PI: Math.PI, TAU: Math.PI * 2, E: Math.E });
const COORDS = Object.freeze(['x', 'y', 'z']);
export const EXPR_RESERVED = Object.freeze([...COORDS, 'let', ...Object.keys(EXPR_CONSTS), ...Object.keys(EXPR_FUNCS)]);
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// ─── errors ───────────────────────────────────────────────────────────────────────

export class FieldExprError extends Error {
  constructor(message, pos, src) {
    super(pos === undefined ? message : `${message} at ${pos}${src ? `\n  ${src}\n  ${' '.repeat(Math.max(0, pos))}^` : ''}`);
    this.name = 'FieldExprError';
    this.pos = pos;
  }
}

// ─── tokenizer ────────────────────────────────────────────────────────────────────

const NUM_RE = /^(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/;
const PUNCT = ['<=', '>=', '==', '!=', '&&', '||', '+', '-', '*', '/', '%', '(', ')', ',', '?', ':', '<', '>', '!', ';', '='];

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i += 1; continue; }
    const m = src.slice(i).match(NUM_RE);
    if (m && (ch >= '0' && ch <= '9' || ch === '.')) {
      toks.push({ t: 'num', v: Number(m[0]), pos: i });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j += 1;
      toks.push({ t: 'id', v: src.slice(i, j), pos: i });
      i = j;
      continue;
    }
    const p = PUNCT.find((op) => src.startsWith(op, i));
    if (!p) throw new FieldExprError(`unexpected character '${ch}'`, i, src);
    toks.push({ t: 'op', v: p, pos: i });
    i += p.length;
  }
  toks.push({ t: 'eof', v: '', pos: src.length });
  return toks;
}

// ─── Pratt parser ─────────────────────────────────────────────────────────────────
// AST: { t:'num', v } | { t:'var', name } | { t:'neg', a } | { t:'bin', op, a, b }
//    | { t:'cmp', op, a, b } | { t:'log', op, a, b } | { t:'not', a }
//    | { t:'ter', c, a, b } | { t:'call', name, args }
// program: { lets: [{ name, expr }], body }

const BIN_PREC = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
const CMP_OPS = new Set(['==', '!=', '<', '<=', '>', '>=']);
const LOG_OPS = new Set(['&&', '||']);

export function parseFieldExpr(src) {
  if (typeof src !== 'string' || !src.trim()) throw new FieldExprError('expression must be a non-empty string');
  const toks = tokenize(src);
  let k = 0;
  const peek = () => toks[k];
  const next = () => toks[k++];
  const isOp = (v) => peek().t === 'op' && peek().v === v;
  const expect = (v) => { if (!isOp(v)) throw new FieldExprError(`expected '${v}'`, peek().pos, src); return next(); };
  const fail = (msg, tok) => { throw new FieldExprError(msg, tok.pos, src); };

  function primary() {
    const tok = next();
    if (tok.t === 'num') return { t: 'num', v: tok.v, pos: tok.pos };
    if (tok.t === 'op' && tok.v === '(') { const e = expr(0); expect(')'); return e; }
    if (tok.t === 'op' && tok.v === '-') return { t: 'neg', a: unary(), pos: tok.pos };
    if (tok.t === 'op' && tok.v === '!') return { t: 'not', a: unary(), pos: tok.pos };
    if (tok.t === 'id') {
      if (tok.v === 'let') fail("'let' is only legal at the start of a statement (`let name = expr;`)", tok);
      if (isOp('(')) {
        next();
        const args = [];
        if (!isOp(')')) { do { args.push(expr(0)); } while (isOp(',') && next()); }
        expect(')');
        const fdef = EXPR_FUNCS[tok.v];
        if (!fdef) fail(`unknown function '${tok.v}'; the whitelist is ${Object.keys(EXPR_FUNCS).join(' ')}`, tok);
        const [lo, hi] = Array.isArray(fdef.arity) ? fdef.arity : [fdef.arity, fdef.arity];
        if (args.length < lo || args.length > hi) fail(`${tok.v} takes ${lo === hi ? lo : `${lo}–${hi}`} argument${hi === 1 ? '' : 's'}, got ${args.length}`, tok);
        return { t: 'call', name: tok.v, args, pos: tok.pos };
      }
      return { t: 'var', name: tok.v, pos: tok.pos };
    }
    if (tok.t === 'eof') fail('unexpected end of expression', tok);
    return fail(`unexpected '${tok.v}'`, tok);
  }
  function unary() { return primary(); }
  function expr(minPrec) {
    let left = unary();
    for (;;) {
      const tok = peek();
      if (tok.t === 'op' && tok.v === '?' && minPrec === 0) {
        next();
        const a = expr(0); expect(':'); const b = expr(0);
        left = { t: 'ter', c: left, a, b, pos: tok.pos };
        continue;
      }
      const prec = tok.t === 'op' ? BIN_PREC[tok.v] : undefined;
      if (prec === undefined || prec <= minPrec) break;
      next();
      const right = expr(prec);
      left = { t: CMP_OPS.has(tok.v) ? 'cmp' : LOG_OPS.has(tok.v) ? 'log' : 'bin', op: tok.v, a: left, b: right, pos: tok.pos };
    }
    return left;
  }

  const lets = [];
  while (peek().t === 'id' && peek().v === 'let') {
    next();
    const nameTok = next();
    if (nameTok.t !== 'id') fail('expected a name after let', nameTok);
    if (EXPR_RESERVED.includes(nameTok.v)) fail(`'${nameTok.v}' is reserved and cannot be a let name`, nameTok);
    if (lets.some((l) => l.name === nameTok.v)) fail(`'${nameTok.v}' is already defined`, nameTok);
    expect('=');
    const e = expr(0);
    expect(';');
    lets.push({ name: nameTok.v, expr: e, pos: nameTok.pos });
  }
  const body = expr(0);
  if (peek().t !== 'eof') fail(`unexpected '${peek().v}' after the expression`, peek());
  const ast = { lets, body };
  typeCheck(ast, src);
  return ast;
}

// Everything is a number except ternary conditions, which are booleans built from
// comparisons / && / || / !. Enforced once at parse time so the compiler and the GLSL
// emitter never see a bool where a float belongs.
function typeCheck(ast, src) {
  const numOf = (n) => {
    switch (n.t) {
      case 'num': case 'var': return;
      case 'neg': numOf(n.a); return;
      case 'bin': numOf(n.a); numOf(n.b); return;
      case 'call': n.args.forEach(numOf); return;
      case 'ter': boolOf(n.c); numOf(n.a); numOf(n.b); return;
      case 'cmp': throw new FieldExprError(`a comparison ('${n.op}') is only legal inside a ternary condition (cond ? a : b)`, n.pos, src);
      case 'log': throw new FieldExprError(`'${n.op}' is only legal inside a ternary condition`, n.pos, src);
      case 'not': throw new FieldExprError("'!' is only legal inside a ternary condition", n.pos, src);
      default: throw new FieldExprError(`bad node ${n.t}`, n.pos, src);
    }
  };
  const boolOf = (n) => {
    switch (n.t) {
      case 'cmp': numOf(n.a); numOf(n.b); return;
      case 'log': boolOf(n.a); boolOf(n.b); return;
      case 'not': boolOf(n.a); return;
      default: throw new FieldExprError('a ternary condition must be a comparison (e.g. x > 0), optionally joined by && / || / !', n.pos, src);
    }
  };
  ast.lets.forEach((l) => numOf(l.expr));
  numOf(ast.body);
}

// ─── vars ─────────────────────────────────────────────────────────────────────────

/** Validate a `vars` map → error strings. Names are identifiers, never reserved; values finite. */
export function validateExprVars(vars, at = 'vars') {
  const e = [];
  if (vars === undefined) return e;
  if (!vars || typeof vars !== 'object' || Array.isArray(vars)) { e.push(`${at}: must be an object of named numbers`); return e; }
  for (const [k, v] of Object.entries(vars)) {
    if (!IDENT_RE.test(k)) e.push(`${at}.${k}: not an identifier`);
    else if (EXPR_RESERVED.includes(k)) e.push(`${at}.${k}: '${k}' is reserved (a coordinate, constant, or function name) — pick another name`);
    if (!Number.isFinite(v)) e.push(`${at}.${k}: must be a finite number`);
  }
  return e;
}

// Every identifier the program reads must resolve: a coordinate, a constant, a var, or an
// earlier let. Returns the list of unresolved names with positions.
function unresolved(ast, vars) {
  const known = new Set([...COORDS, ...Object.keys(EXPR_CONSTS), ...Object.keys(vars || {})]);
  const bad = [];
  const walk = (n) => {
    switch (n.t) {
      case 'var': if (!known.has(n.name)) bad.push(n); return;
      case 'num': return;
      case 'neg': case 'not': walk(n.a); return;
      case 'bin': case 'cmp': case 'log': walk(n.a); walk(n.b); return;
      case 'ter': walk(n.c); walk(n.a); walk(n.b); return;
      case 'call': n.args.forEach(walk); return;
      default: return;
    }
  };
  for (const l of ast.lets) { walk(l.expr); known.add(l.name); }
  walk(ast.body);
  return bad;
}

/** Does the program call a function without a GLSL twin (noise3)? → list of names. */
export function exprCpuOnlyCalls(ast) {
  const out = new Set();
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (n.t === 'call') { if (!EXPR_FUNCS[n.name].glsl) out.add(n.name); n.args.forEach(walk); return; }
    for (const k of ['a', 'b', 'c']) if (n[k]) walk(n[k]);
  };
  ast.lets.forEach((l) => walk(l.expr));
  walk(ast.body);
  return [...out];
}

// ─── compiler: AST → closure tree over a slot array ───────────────────────────────

/**
 * compileFieldExpr(ast, vars?) → (p:{x,y,z}) => number
 * vars are inlined as constants; lets get slots evaluated once per point in order.
 * Unresolved identifiers throw a teaching error here (with the caret) rather than NaN.
 */
export function compileFieldExpr(ast, vars = {}, src) {
  const missing = unresolved(ast, vars);
  if (missing.length) {
    const n = missing[0];
    throw new FieldExprError(`unknown identifier '${n.name}' — coordinates are x y z; constants PI TAU E; name a dial in \`vars\``, n.pos, src);
  }
  const slots = { x: 0, y: 1, z: 2 };
  ast.lets.forEach((l, i) => { slots[l.name] = 3 + i; });
  const env = new Float64Array(3 + ast.lets.length);
  const consts = { ...EXPR_CONSTS, ...vars };

  const c = (n) => {
    switch (n.t) {
      case 'num': { const v = n.v; return () => v; }
      case 'var': {
        if (slots[n.name] !== undefined) { const s = slots[n.name]; return () => env[s]; }
        const v = +consts[n.name]; return () => v;
      }
      case 'neg': { const a = c(n.a); return () => -a(); }
      case 'bin': {
        const a = c(n.a), b = c(n.b);
        switch (n.op) {
          case '+': return () => a() + b();
          case '-': return () => a() - b();
          case '*': return () => a() * b();
          case '/': return () => a() / b();
          case '%': return () => a() % b();
          default: throw new FieldExprError(`bad operator ${n.op}`, n.pos, src);
        }
      }
      case 'cmp': {
        const a = c(n.a), b = c(n.b);
        switch (n.op) {
          case '<': return () => a() < b();
          case '<=': return () => a() <= b();
          case '>': return () => a() > b();
          case '>=': return () => a() >= b();
          case '==': return () => a() === b();
          case '!=': return () => a() !== b();
          default: throw new FieldExprError(`bad comparison ${n.op}`, n.pos, src);
        }
      }
      case 'log': {
        const a = c(n.a), b = c(n.b);
        return n.op === '&&' ? () => a() && b() : () => a() || b();
      }
      case 'not': { const a = c(n.a); return () => !a(); }
      case 'ter': { const cc = c(n.c), a = c(n.a), b = c(n.b); return () => (cc() ? a() : b()); }
      case 'call': {
        const f = EXPR_FUNCS[n.name].fn;
        const args = n.args.map(c);
        switch (args.length) {
          case 1: { const [a] = args; return () => f(a()); }
          case 2: { const [a, b] = args; return () => f(a(), b()); }
          case 3: { const [a, b, d] = args; return () => f(a(), b(), d()); }
          default: return () => f(...args.map((g) => g()));
        }
      }
      default: throw new FieldExprError(`bad node ${n.t}`, n.pos, src);
    }
  };
  const letFns = ast.lets.map((l) => c(l.expr));
  const body = c(ast.body);
  const nLets = letFns.length;
  return (p) => {
    env[0] = p.x; env[1] = p.y; env[2] = p.z;
    for (let i = 0; i < nLets; i += 1) env[3 + i] = letFns[i]();
    return body();
  };
}

// ─── GLSL emitter (E1b): the same AST as a `float name(vec3 p)` ───────────────────

const glslNum = (v) => {
  if (!Number.isFinite(v)) throw new FieldExprError(`cannot emit ${v} to GLSL`);
  const s = Number.isInteger(v) ? `${v}.0` : String(v);
  return v < 0 ? `(${s})` : s;
};
const GLSL_RESERVED_PREFIX = 'v_';   // let names get a prefix so `float`/`vec3`-style clashes cannot happen

/**
 * emitFieldExprGlsl(ast, { name = 'fieldExpr', vars = {} }) → string
 * Vars inline as float literals (a dial is a recompile, same as the CPU path).
 * Throws when the program uses a CPU-only function (noise3) — the caller says so on the
 * card and falls back to CPU. `smin` / `smax` reference sdf-glsl.js's sdfSmin / sdfSmax;
 * include SDF_GLSL before this function in the shader.
 */
export function emitFieldExprGlsl(ast, { name = 'fieldExpr', vars = {}, src } = {}) {
  const missing = unresolved(ast, vars);
  if (missing.length) throw new FieldExprError(`unknown identifier '${missing[0].name}'`, missing[0].pos, src);
  const cpuOnly = exprCpuOnlyCalls(ast);
  if (cpuOnly.length) throw new FieldExprError(`${cpuOnly.join(', ')} has no GLSL twin yet — this expression is CPU-only (the polygonizer still takes it)`);
  const consts = { ...EXPR_CONSTS, ...vars };
  const letNames = new Set(ast.lets.map((l) => l.name));
  const e = (n) => {
    switch (n.t) {
      case 'num': return glslNum(n.v);
      case 'var':
        if (COORDS.includes(n.name)) return n.name;
        if (letNames.has(n.name)) return GLSL_RESERVED_PREFIX + n.name;
        return glslNum(+consts[n.name]);
      case 'neg': return `(-${e(n.a)})`;
      case 'bin':
        if (n.op === '%') return `(${e(n.a)} - ${e(n.b)} * trunc(${e(n.a)} / ${e(n.b)}))`;
        return `(${e(n.a)} ${n.op} ${e(n.b)})`;
      case 'cmp': return `(${e(n.a)} ${n.op} ${e(n.b)})`;
      case 'log': return `(${e(n.a)} ${n.op} ${e(n.b)})`;
      case 'not': return `(!${e(n.a)})`;
      case 'ter': return `(${e(n.c)} ? ${e(n.a)} : ${e(n.b)})`;
      case 'call': return EXPR_FUNCS[n.name].glsl(n.args.map(e));
      default: throw new FieldExprError(`bad node ${n.t}`);
    }
  };
  const lines = [`float ${name}(vec3 p) {`, '  float x = p.x, y = p.y, z = p.z;'];
  for (const l of ast.lets) lines.push(`  float ${GLSL_RESERVED_PREFIX}${l.name} = ${e(l.expr)};`);
  lines.push(`  return ${e(ast.body)};`, '}');
  return lines.join('\n');
}

// ─── the sampling gate ────────────────────────────────────────────────────────────

/**
 * sampleExprGate(d, bounds, { n = 9 }) → { finite, negatives, positives, samples }
 * Evaluate on an n³ lattice over bounds plus the 8 corners. Every value must be finite;
 * both signs must occur, else there is no surface inside bounds (all inside or all
 * outside — widen bounds or check the sign convention). The one place a wrong
 * expression fails at mint instead of as an empty or exploded mesh.
 */
export function sampleExprGate(d, bounds, { n = 9 } = {}) {
  let negatives = 0, positives = 0, finite = true, samples = 0;
  const { min, max } = bounds;
  const take = (x, y, z) => {
    const v = d({ x, y, z });
    samples += 1;
    if (!Number.isFinite(v)) { finite = false; return; }
    if (v < 0) negatives += 1; else if (v > 0) positives += 1;
  };
  for (let i = 0; i < n; i += 1) {
    const x = min.x + (max.x - min.x) * (i + 0.5) / n;
    for (let j = 0; j < n; j += 1) {
      const y = min.y + (max.y - min.y) * (j + 0.5) / n;
      for (let k = 0; k < n; k += 1) take(x, y, min.z + (max.z - min.z) * (k + 0.5) / n);
    }
  }
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) take(x, y, z);
  return { finite, negatives, positives, samples };
}
