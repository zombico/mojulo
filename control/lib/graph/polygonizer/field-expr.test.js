/**
 * field-expr — the distance-expression term (expressiveness.plan.md E1 / E1b). Claims under
 * test: the parser teaches (caret + whitelist) on every listed failure; `vars` cannot shadow
 * a coordinate / constant / function; the sampling gate refuses an all-positive expression;
 * an `expr` sphere agrees with the native sphere to 1e-9 at 1,000 seeded points; a gyroid
 * slab closes with a pinned genus; bounds CLIP (an unbounded plane closes); byte-identical
 * re-render; the GLSL emission is snapshotted and refuses noise3; the closure-tree compile
 * stays within a generous multiple of the native term.
 */
import { describe, expect, it } from 'vitest';

import {
  parseFieldExpr, compileFieldExpr, emitFieldExprGlsl, sampleExprGate, validateExprVars,
  exprCpuOnlyCalls, EXPR_FUNCS, EXPR_GRAMMAR_VERSION, FieldExprError,
} from './field-expr.js';
import { exprField, sphere, composeFieldTerms, validateFieldTerms, FIELD_SHAPE_KINDS } from './field-terms.js';
import { fieldToFaces } from './field-faces.js';
import { auditClosure } from './face-closure.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const topology = (faces) => {
  const V = new Set(), E = new Map();
  for (const f of faces) {
    const c = f.corners;
    for (let i = 0; i < c.length; i += 1) {
      V.add(c[i].join(','));
      const a = c[i].join(','), b = c[(i + 1) % c.length].join(',');
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      E.set(k, (E.get(k) || 0) + 1);
    }
  }
  return { genus: 1 - (V.size - E.size + faces.length) / 2, nonManifoldEdges: [...E.values()].filter((n) => n !== 2).length };
};
const genus = (faces) => topology(faces).genus;
const P = (x, y, z) => ({ x, y, z });
// |∇g| ≈ k, so dividing by k makes `t` the half wall thickness in world units
const GYROID = 'let g = sin(x*k)*cos(y*k) + sin(y*k)*cos(z*k) + sin(z*k)*cos(x*k); abs(g) / k - t';

describe('parser — grammar and teaching errors', () => {
  it('parses lets, ternaries, calls, unary minus, and precedence', () => {
    const ast = parseFieldExpr(GYROID);
    expect(ast.lets).toHaveLength(1);
    expect(ast.body.t).toBe('bin');
    const d = compileFieldExpr(parseFieldExpr('2 * -x + 3 % 2'));
    expect(d(P(1, 0, 0))).toBe(-1);
    expect(compileFieldExpr(parseFieldExpr('x > 0 && y > 0 ? 1 : -1'))(P(1, 1, 0))).toBe(1);
    expect(compileFieldExpr(parseFieldExpr('!(x > 0) ? 1 : -1'))(P(1, 1, 0))).toBe(-1);
    expect(compileFieldExpr(parseFieldExpr('x > 0 ? y > 0 ? 1 : 2 : 3'))(P(1, -1, 0))).toBe(2);
    expect(compileFieldExpr(parseFieldExpr('PI + TAU + E'))(P(0, 0, 0))).toBeCloseTo(Math.PI * 3 + Math.E);
  });
  it('teaches: unknown function (with the whitelist), unknown identifier, unbalanced parens, comparison outside a ternary, bad arity, reserved let', () => {
    expect(() => parseFieldExpr('sinh(x)')).toThrow(/unknown function 'sinh'.*whitelist is abs min max[\s\S]*at 0/);
    expect(() => compileFieldExpr(parseFieldExpr('x + r'))).toThrow(/unknown identifier 'r'.*name a dial in `vars`/);
    expect(() => parseFieldExpr('(x + 1')).toThrow(/expected '\)' at 6/);
    expect(() => parseFieldExpr('x > 0')).toThrow(/comparison.*only legal inside a ternary/);
    expect(() => parseFieldExpr('x ? 1 : 2')).toThrow(/ternary condition must be a comparison/);
    expect(() => parseFieldExpr('mod(x)')).toThrow(/mod takes 2 arguments, got 1/);
    expect(() => parseFieldExpr('let sin = 1; x')).toThrow(/'sin' is reserved/);
    expect(() => parseFieldExpr('x $ 1')).toThrow(/unexpected character '\$' at 2/);
    expect(() => parseFieldExpr('x +')).toThrow(FieldExprError);
    expect(() => parseFieldExpr('')).toThrow(/non-empty/);
  });
  it('the caret line points at the offending token', () => {
    let msg = '';
    try { parseFieldExpr('abs(x) + foo(y)'); } catch (e) { msg = e.message; }
    expect(msg).toContain('\n  abs(x) + foo(y)\n           ^');
  });
  it('mod is floored (GLSL), % is truncated (JS) — they differ for negatives', () => {
    const d = compileFieldExpr(parseFieldExpr('mod(x, 3) - (x % 3)'));
    expect(d(P(-4, 0, 0))).toBe(3);
    expect(d(P(4, 0, 0))).toBe(0);
  });
  it('vars: reserved names refused, non-finite refused, plain dials accepted', () => {
    expect(validateExprVars({ x: 1 })).toEqual([expect.stringMatching(/'x' is reserved/)]);
    expect(validateExprVars({ smin: 1 })).toEqual([expect.stringMatching(/'smin' is reserved/)]);
    expect(validateExprVars({ r: NaN })).toEqual([expect.stringMatching(/finite/)]);
    expect(validateExprVars({ r: 1, k: 2 })).toEqual([]);
    expect(validateExprVars([1])).toEqual([expect.stringMatching(/object of named numbers/)]);
  });
  it('the function table is frozen and every entry carries fn + arity; the grammar version is 1', () => {
    expect(Object.isFrozen(EXPR_FUNCS)).toBe(true);
    for (const [name, f] of Object.entries(EXPR_FUNCS)) {
      expect(typeof f.fn, name).toBe('function');
      expect(Number.isInteger(f.arity) || Array.isArray(f.arity), name).toBe(true);
    }
    expect(EXPR_GRAMMAR_VERSION).toBe(1);
    expect(FIELD_SHAPE_KINDS).toContain('expr');
  });
});

describe('the sampling gate', () => {
  it('refuses an all-positive expression and a NaN-producing one; passes a sphere', () => {
    const errs = validateFieldTerms([{ op: 'add', shape: { kind: 'expr', d: 'x*x + 1', reach: 2 } }]);
    expect(errs).toEqual([expect.stringMatching(/no surface inside bounds.*all outside/)]);
    const nan = validateFieldTerms([{ op: 'add', shape: { kind: 'expr', d: 'sqrt(x) - 1', reach: 2 } }]);
    expect(nan).toEqual([expect.stringMatching(/NaN/)]);
    expect(validateFieldTerms([{ op: 'add', shape: { kind: 'expr', d: 'len3(x,y,z) - 1', reach: 2 } }])).toEqual([]);
  });
  it('bounds are required and must be ordered', () => {
    expect(validateFieldTerms([{ op: 'add', shape: { kind: 'expr', d: 'x' } }])).toEqual([expect.stringMatching(/bounds: required/)]);
    expect(validateFieldTerms([{ op: 'add', shape: { kind: 'expr', d: 'x', bounds: { min: [1, 0, 0], max: [0, 1, 1] } } }])).toEqual([expect.stringMatching(/max\.x must exceed min\.x/)]);
  });
  it('a parse error surfaces through validateFieldTerms with the path and the caret', () => {
    const errs = validateFieldTerms([{ op: 'add', shape: { kind: 'expr', d: 'x +', reach: 1 } }]);
    expect(errs[0]).toMatch(/^terms\[0\]\.shape\.d: unexpected end of expression at 3/);
  });
  it('sampleExprGate counts both signs on a 9³ lattice plus corners', () => {
    const g = sampleExprGate(compileFieldExpr(parseFieldExpr('len3(x,y,z) - 1')), { min: P(-2, -2, -2), max: P(2, 2, 2) });
    expect(g.samples).toBe(9 * 9 * 9 + 8);
    expect(g.finite).toBe(true);
    expect(g.negatives).toBeGreaterThan(0);
    expect(g.positives).toBeGreaterThan(0);
  });
});

describe('expr terms — parity, closure, clipping, byte-identity', () => {
  it('an expr sphere agrees with the native sphere within 1e-9 at 1,000 seeded points', () => {
    const rnd = mulberry32(11);
    const native = sphere({ center: [0.5, -0.25, 1], radius: 1.5 });
    const ex = exprField({ d: 'len3(x - cx, y - cy, z - cz) - r', vars: { cx: 0.5, cy: -0.25, cz: 1, r: 1.5 }, bounds: { min: [-1, -1.75, -0.5], max: [2, 1.25, 2.5] } });
    // inside the clip box both agree exactly; the clip only bites at the box wall
    for (let i = 0; i < 1000; i += 1) {
      const p = P(-0.9 + rnd() * 2.8, -1.65 + rnd() * 2.8, -0.4 + rnd() * 2.8);
      expect(Math.abs(ex.d(p) - native.d(p))).toBeLessThan(1e-9);
    }
    expect(ex.bounds).toEqual(native.bounds);
  });
  it('a gyroid slab closes with zero boundary edges, is manifold, and has a pinned genus (52, stable from 32 to 64 cells)', () => {
    const faces = fieldToFaces({ cells: 48, terms: [{ id: 'gyroid', op: 'add', shape: { kind: 'expr', d: GYROID, vars: { k: 6.2832, t: 0.1 }, bounds: { min: [-1, -1, 0], max: [1, 1, 2] } } }] });
    const audit = auditClosure(faces);
    expect(audit.closed).toBe(true);
    expect(audit.boundaryEdgeCount).toBe(0);
    expect(topology(faces)).toEqual({ genus: 52, nonManifoldEdges: 0 });
    expect(faces.every((f) => f.group === 'gyroid')).toBe(true);
  });
  it('a wall thinner than ~2 cells goes non-manifold (closure holds, edges pinch) — the card says to size t to the grid', () => {
    // t = 0.1 → wall 0.2; at 32 cells over 2 units a cell is 0.0625, so the wall is ~3 cells: clean.
    // t = 0.03 → wall 0.06 ≈ one cell: pinched. Pinned so the failure mode stays documented, not silent.
    const thin = fieldToFaces({ cells: 32, terms: [{ op: 'add', shape: { kind: 'expr', d: GYROID, vars: { k: 6.2832, t: 0.03 }, bounds: { min: [-1, -1, 0], max: [1, 1, 2] } } }] });
    expect(auditClosure(thin).closed).toBe(true);
    expect(topology(thin).nonManifoldEdges).toBeGreaterThan(0);
  });
  it('bounds CLIP: an unbounded half-space closes into a slab instead of losing its quads at the grid', () => {
    const faces = fieldToFaces({ cells: 24, terms: [{ op: 'add', shape: { kind: 'expr', d: 'z - 1', bounds: { min: [-1, -1, 0], max: [1, 1, 2] } } }] });
    expect(auditClosure(faces).closed).toBe(true);
    expect(genus(faces)).toBe(0);
  });
  it('an expr term composes under subtract / intersect with blend like any shape', () => {
    const terms = [
      { id: 'box', op: 'add', shape: { kind: 'box', center: [0, 0, 1], size: [2, 2, 2] } },
      { id: 'gyroid', op: 'intersect', shape: { kind: 'expr', d: GYROID, vars: { k: 6.2832, t: 0.12 }, reach: 2 } },
    ];
    expect(validateFieldTerms(terms)).toEqual([]);
    const faces = fieldToFaces({ cells: 32, terms });
    expect(auditClosure(faces).closed).toBe(true);
    expect(topology(faces)).toEqual({ genus: 52, nonManifoldEdges: 0 });
    expect(new Set(faces.map((f) => f.group))).toEqual(new Set(['box', 'gyroid']));
  });
  it('byte-identical re-render', () => {
    const spec = { cells: 24, terms: [{ op: 'add', shape: { kind: 'expr', d: 'len3(x,y,z) - 1 + 0.1 * noise3(x, y, z, 7, 0.5, 3)', reach: 1.5 } }] };
    expect(JSON.stringify(fieldToFaces(spec))).toBe(JSON.stringify(fieldToFaces(spec)));
  });
  it('the closure-tree compile stays within 8× of the native sphere term (generous: CI noise)', () => {
    const native = sphere({ center: [0, 0, 0], radius: 1 });
    const ex = compileFieldExpr(parseFieldExpr('sqrt(x*x + y*y + z*z) - 1'));
    const pts = []; const rnd = mulberry32(3);
    for (let i = 0; i < 200000; i += 1) pts.push(P(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1));
    const time = (f) => { const t0 = performance.now(); let s = 0; for (const p of pts) s += f(p); return [performance.now() - t0, s]; };
    time(native.d); time(ex);   // warm
    const [tn] = time(native.d); const [te] = time(ex);
    expect(te).toBeLessThan(Math.max(tn * 8, 50));
  });
});

describe('E1b — GLSL emission off the same AST', () => {
  it('emits a float function with vars inlined; snapshot', () => {
    const glsl = emitFieldExprGlsl(parseFieldExpr(GYROID), { name: 'sdfGyroid', vars: { k: 6.2832, t: 0.25 } });
    expect(glsl).toMatchInlineSnapshot(`
      "float sdfGyroid(vec3 p) {
        float x = p.x, y = p.y, z = p.z;
        float v_g = (((sin((x * 6.2832)) * cos((y * 6.2832))) + (sin((y * 6.2832)) * cos((z * 6.2832)))) + (sin((z * 6.2832)) * cos((x * 6.2832))));
        return ((abs(v_g) / 6.2832) - 0.25);
      }"
    `);
  });
  it('maps every whitelisted function to a GLSL form (integers become floats, % becomes trunc-mod, smin → sdfSmin)', () => {
    const glsl = emitFieldExprGlsl(parseFieldExpr('smin(hypot(x, y), len3(x, y, z), 2) + mod(x, 2) - (x % 3) + atan2(y, x) + (x > 0 ? 1 : -1)'));
    expect(glsl).toContain('sdfSmin(length(vec2(x, y)), length(vec3(x, y, z)), 2.0)');
    expect(glsl).toContain('mod(x, 2.0)');
    expect(glsl).toContain('(x - 3.0 * trunc(x / 3.0))');
    expect(glsl).toContain('atan(y, x)');
    expect(glsl).toContain('((x > 0.0) ? 1.0 : (-1.0))');
    for (const [name, f] of Object.entries(EXPR_FUNCS)) if (f.glsl) expect(typeof f.glsl(['a', 'b', 'c', 'd']), name).toBe('string');
  });
  it('refuses noise3 (no GLSL twin) with a teaching note, and reports it as CPU-only', () => {
    const ast = parseFieldExpr('len3(x,y,z) - 1 + noise3(x, y, z, 1)');
    expect(exprCpuOnlyCalls(ast)).toEqual(['noise3']);
    expect(() => emitFieldExprGlsl(ast)).toThrow(/noise3 has no GLSL twin yet.*CPU-only/);
  });
});
