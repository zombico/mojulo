import { describe, expect, it } from 'vitest';

import { specToScad, facesToPolyhedron, num } from './scene-scad.js';

// openscad-leg.plan.md phase 1 — the transpiler.
//
// What these tests CANNOT do on a host without OpenSCAD: render the emitted file and
// compare it to what `measure_solid` declared. That is phase 3's gate and it is unrun
// here. What they DO close: the mapping table row by row, the coverage ledger, the dial
// rule (decision 1 — a baked subtree emits no variables), determinism, and the geometry
// that is checkable numerically from the emitted text itself (the axis matrix is a proper
// rotation that carries +Z onto the recipe's axis).

const P = (x, y, z) => [x, y, z];

const sphereTerm = (id, c, r) => ({ id, op: 'add', shape: { kind: 'sphere', center: c, radius: r } });

/** Pull `multmatrix([[…],[…],[…],[…]])` out of the emitted text as a 4×4 of numbers. */
function readMultmatrix(text) {
  const m = text.match(/multmatrix\(\[(.*?)\]\)\s/);
  if (!m) return null;
  const rows = m[1].match(/\[[^\]]*\]/g) || [];
  return rows.map((r) => r.replace(/[[\]]/g, '').split(',').map((s) => Number(s.trim())));
}

const col = (M, j) => ({ x: M[0][j], y: M[1][j], z: M[2][j] });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const det3 = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
  - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
  + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);

/** Every brace / bracket / paren closes, and no statement line is left dangling. */
function delimitersBalance(text) {
  const pairs = { '{': '}', '[': ']', '(': ')' };
  const stack = [];
  for (const line of text.split('\n')) {
    const code = line.replace(/\/\/.*$/, '');
    for (const ch of code) {
      if (pairs[ch]) stack.push(pairs[ch]);
      else if (ch === '}' || ch === ']' || ch === ')') { if (stack.pop() !== ch) return false; }
    }
  }
  return stack.length === 0;
}

describe('scene-scad — deterministic formatting', () => {
  it('never emits exponent notation or negative zero', () => {
    expect(num(0.0000001)).toBe('0');
    expect(num(-0.0000001)).toBe('0');
    expect(num(1e-7)).toBe('0');
    expect(num(-0)).toBe('0');
    expect(num(40)).toBe('40');
    expect(num(1.5)).toBe('1.5');
    expect(num(1 / 3)).toBe('0.333333');
    expect(num(Number.NaN)).toBe('0');
    expect(num(Infinity)).toBe('0');
  });

  it('is byte-identical across calls', () => {
    const spec = { units: 'mm', fields: [{ id: 'f', terms: [sphereTerm('ball', P(0, 0, 0), 2)] }] };
    expect(specToScad(spec, { title: 't' }).text).toBe(specToScad(spec, { title: 't' }).text);
  });
});

describe('scene-scad — the mapping table, row by row', () => {
  const one = (term, extra = {}) => specToScad(
    { units: 'mm', fields: [{ id: 'p', cells: 16, ...extra, terms: [term] }] },
    { title: 'm' },
  );

  it('sphere → translate() sphere()', () => {
    const r = one(sphereTerm('ball', P(1, 2, 3), 4));
    expect(r.coverage.exact).toBe(1);
    expect(r.text).toContain('p_ball_radius = 4;');
    expect(r.text).toContain('p_ball_center = [1, 2, 3];');
    expect(r.text).toContain('translate(p_ball_center) sphere(r = p_ball_radius);');
  });

  it('ellipsoid → scale() sphere(r = 1)', () => {
    const r = one({ id: 'egg', op: 'add', shape: { kind: 'ellipsoid', center: P(0, 0, 0), radii: P(3, 2, 1) } });
    expect(r.coverage.exact).toBe(1);
    expect(r.text).toContain('p_egg_radii = [3, 2, 1];');
    expect(r.text).toContain('sphere(r = 1);');
  });

  it('capsule → hull() of two spheres (the swept ball, exactly)', () => {
    const r = one({ id: 'rod', op: 'add', shape: { kind: 'capsule', a: P(0, 0, 0), b: P(0, 0, 5), radius: 1 } });
    expect(r.coverage.exact).toBe(1);
    expect(r.text).toContain('hull()');
    expect(r.text).toContain('translate(p_rod_a) sphere(r = p_rod_radius);');
    expect(r.text).toContain('translate(p_rod_b) sphere(r = p_rod_radius);');
  });

  it('roundCone → hull() of two spheres of different radii', () => {
    const r = one({ id: 'horn', op: 'add', shape: { kind: 'roundCone', a: P(0, 0, 0), b: P(0, 0, 4), ra: 2, rb: 1 } });
    expect(r.coverage.exact).toBe(1);
    expect(r.text).toContain('p_horn_ra = 2;');
    expect(r.text).toContain('p_horn_rb = 1;');
    expect(r.text).toContain('hull()');
  });

  it('box → cube(center = true)', () => {
    const r = one({ id: 'blk', op: 'add', shape: { kind: 'box', center: P(0, 0, 1), size: P(4, 3, 2) } });
    expect(r.coverage.exact).toBe(1);
    expect(r.text).toContain('p_blk_size = [4, 3, 2];');
    expect(r.text).toContain('cube(p_blk_size, center = true);');
  });

  it('a ROUNDED box is the hull of eight corner balls, inset by the round — minkowski without the price', () => {
    const r = one({ id: 'blk', op: 'add', shape: { kind: 'box', center: P(0, 0, 0), size: P(4, 4, 4), round: 0.5 } });
    expect(r.coverage.exact).toBe(1);
    // size is the FULL outer extent, so the inset half-extent is 4/2 − 0.5
    expect(r.text).toContain('p_blk_inner = [1.5, 1.5, 1.5];');
    expect(r.text).toContain('p_blk_round = 0.5;');
    expect((r.text.match(/sphere\(r = p_blk_round\);/g) || []).length).toBe(8);
    expect(r.text).not.toContain('minkowski');
  });

  it('sweep → one hull() per segment (a capsule chain)', () => {
    const r = one({ id: 'pipe', op: 'add', shape: { kind: 'sweep', path: [P(0, 0, 0), P(0, 0, 3), P(2, 0, 3)], radius: 0.5 } });
    expect(r.coverage.exact).toBe(1);
    expect((r.text.match(/hull\(\)/g) || []).length).toBe(2);
    expect(r.text).toContain('p_pipe_path = [[0, 0, 0], [0, 0, 3], [2, 0, 3]];');
  });

  it('lathe → rotate_extrude of the meridional polygon, closed down the axis', () => {
    const r = one({
      id: 'disc',
      op: 'add',
      shape: { kind: 'lathe', profile: [{ t: 0, radius: 10 }, { t: 1, radius: 10 }], axisFrom: P(0, 0, 0), axisTo: P(0, 0, 4) },
    });
    expect(r.coverage.exact).toBe(1);
    expect(r.text).toContain('rotate_extrude(angle = 360)');
    // (radius, along-axis) up one side, then back down x = 0
    expect(r.text).toContain('p_disc_profile = [[10, 0], [10, 4], [0, 4], [0, 0]];');
  });

  it('extrude {rect} → linear_extrude of a centred square; a corner radius becomes offset() on the INSET square', () => {
    const plain = one({
      id: 'bar', op: 'add',
      shape: { kind: 'extrude', profile: { rect: { w: 6, h: 4 } }, axisFrom: P(0, 0, 0), axisTo: P(0, 0, 10) },
    });
    expect(plain.text).toContain('linear_extrude(height = p_bar_height)');
    expect(plain.text).toContain('p_bar_section = [6, 4];');
    expect(plain.text).toContain('square(p_bar_section, center = true);');

    const round = one({
      id: 'bar', op: 'add',
      shape: { kind: 'extrude', profile: { rect: { w: 6, h: 4, r: 1 } }, axisFrom: P(0, 0, 0), axisTo: P(0, 0, 10) },
    });
    // outer extent stays 6 × 4: offset(1) over a 4 × 2 square
    expect(round.text).toContain('p_bar_section = [4, 2];');
    expect(round.text).toContain('offset(r = p_bar_corner)');
  });

  it('extrude {points} → linear_extrude of the polygon', () => {
    const r = one({
      id: 'tri', op: 'add',
      shape: { kind: 'extrude', profile: { points: [[0, 0], [2, 0], [1, 2]] }, axisFrom: P(0, 0, 0), axisTo: P(0, 0, 1) },
    });
    expect(r.coverage.exact).toBe(1);
    expect(r.text).toContain('p_tri_points = [[0, 0], [2, 0], [1, 2]];');
    expect(r.text).toContain('polygon(points = p_tri_points);');
  });

  it('the three booleans become union / difference / intersection, and runs of one flatten', () => {
    const r = specToScad({
      units: 'mm',
      fields: [{ id: 'p', cells: 16, terms: [
        sphereTerm('a', P(0, 0, 0), 3),
        { id: 'b', op: 'subtract', shape: { kind: 'sphere', center: P(1, 0, 0), radius: 1 } },
        { id: 'c', op: 'subtract', shape: { kind: 'sphere', center: P(-1, 0, 0), radius: 1 } },
      ] }],
    }, { title: 'm' });
    // two subtracts in a row are ONE difference block, not a nest
    expect((r.text.match(/difference\(\)/g) || []).length).toBe(1);
    expect(r.coverage.baked).toBe(0);
  });

  it('transform → translate / rotate / scale in mojulo order, with mirror folded into a negative scale', () => {
    const r = specToScad({
      units: 'mm',
      fields: [{ id: 'p', cells: 16, terms: [
        { op: 'transform', translate: P(1, 0, 0), rotate: P(0, 0, 90), scale: 2, mirror: 'x', combine: 'add', terms: [sphereTerm('b', P(0, 0, 0), 1)] },
      ] }],
    }, { title: 'm' });
    expect(r.coverage.baked).toBe(0);
    // mojulo applies scale → mirror → rotate → translate; OpenSCAD nests outermost-first
    expect(r.text).toMatch(/translate\([a-z0-9_]+\) rotate\([a-z0-9_]+\) scale\([a-z0-9_]+\)/);
    expect(r.text).toContain('= [-2, 2, 2];');
  });

  it('a polar repeat is a for loop pushed out along the first perpendicular axis', () => {
    const r = specToScad({
      units: 'mm',
      fields: [{ id: 'p', cells: 16, terms: [
        sphereTerm('hub', P(0, 0, 0), 4),
        { op: 'repeat', polar: { count: 5, radius: 3 }, combine: 'subtract', terms: [sphereTerm('tooth', P(0, 0, 0), 1)] },
      ] }],
    }, { title: 'm' });
    expect(r.coverage.baked).toBe(0);
    expect(r.text).toContain('for (i = [0 : p_term1_count - 1])');
    // default axis is z, whose first perpendicular is x
    expect(r.text).toMatch(/translate\(\[p_term1_radius, 0, 0\]\)/);
  });

  it('a counted repeat centres its instances, and the loop bound reads its own dial', () => {
    const r = specToScad({
      units: 'mm',
      fields: [{ id: 'p', cells: 16, terms: [
        { op: 'repeat', count: P(3, 1, 1), spacing: P(2, 0, 0), terms: [sphereTerm('stud', P(0, 0, 0), 0.5)] },
      ] }],
    }, { title: 'm' });
    expect(r.text).toContain('for (ix = [0 : p_term0_count[0] - 1]');
    expect(r.text).toContain('(ix - (p_term0_count[0] - 1) / 2) * p_term0_spacing[0]');
  });
});

describe('scene-scad — the axis matrix is a real rotation', () => {
  it('carries +Z onto the recipe axis, orthonormal and right-handed', () => {
    const axisTo = P(1, 2, 2); // length 3, nothing axis-aligned about it
    const r = specToScad({
      units: 'mm',
      fields: [{ id: 'p', cells: 16, terms: [{
        id: 'l', op: 'add',
        shape: { kind: 'lathe', profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }], axisFrom: P(0, 0, 0), axisTo },
      }] }],
    }, { title: 'm' });
    const M = readMultmatrix(r.text);
    expect(M).toBeTruthy();
    const [u, v, d] = [col(M, 0), col(M, 1), col(M, 2)];
    // Tolerance is set by the FILE, not the emitter: num() rounds each component to 6
    // decimals, and squaring and summing three of those accumulates to about 1e-6 (an
    // axis of (1/3, 2/3, 2/3) lands on 1.000000666667 exactly). Asserting tighter would
    // test the emitter's internal floats rather than the artifact it wrote.
    for (const c of [u, v, d]) expect(dot(c, c)).toBeCloseTo(1, 5);
    expect(dot(u, v)).toBeCloseTo(0, 5);
    expect(dot(u, d)).toBeCloseTo(0, 5);
    expect(dot(v, d)).toBeCloseTo(0, 5);
    expect(det3(M)).toBeCloseTo(1, 5);           // right-handed, never a reflection
    // the third column IS the unit recipe axis, so local +Z lands on it
    expect(d.x).toBeCloseTo(1 / 3, 6);
    expect(d.y).toBeCloseTo(2 / 3, 6);
    expect(d.z).toBeCloseTo(2 / 3, 6);
    // and the polygon's height equals the axis length
    expect(r.text).toContain('[1, 3]');
  });
});

describe('scene-scad — coverage is measured, and the dial rule holds', () => {
  const mixed = {
    units: 'mm',
    fields: [{ id: 'p', cells: 16, terms: [
      sphereTerm('body', P(0, 0, 0), 2),
      { id: 'bump', op: 'add', blend: 0.5, shape: { kind: 'sphere', center: P(1, 0, 0), radius: 1 } },
      { id: 'bore', op: 'subtract', shape: { kind: 'capsule', a: P(0, 0, -3), b: P(0, 0, 3), radius: 0.4 } },
    ] }],
  };

  it('bakes through the LAST contaminating term and folds the rest exactly on top', () => {
    const r = specToScad(mixed, { title: 'm' });
    const byAt = Object.fromEntries(r.coverage.terms.map((t) => [t.at, t]));
    expect(byAt['fields[0].terms[0]'].status).toBe('absorbed');
    expect(byAt['fields[0].terms[0]'].why).toContain('fields[0].terms[1]');
    expect(byAt['fields[0].terms[1]'].status).toBe('baked');
    expect(byAt['fields[0].terms[1]'].why).toContain('blend');
    expect(byAt['fields[0].terms[2]'].status).toBe('exact');
    expect(r.coverage.exact).toBe(1);
    expect(r.coverage.baked).toBe(2);
    // the exact bore still cuts the baked body
    expect(r.text).toContain('difference()');
    expect(r.text).toContain('polyhedron(');
  });

  it('THE DIAL RULE: a baked subtree emits no variables, only the exact term does', () => {
    const r = specToScad(mixed, { title: 'm' });
    const names = [...r.text.matchAll(/^([a-z][A-Za-z0-9_]*) = /gm)].map((m) => m[1]);
    // the bore is exact and dials; body and bump are inside the bake and must not
    expect(names).toContain('p_bore_radius');
    expect(names.some((n) => n.includes('body'))).toBe(false);
    expect(names.some((n) => n.includes('bump'))).toBe(false);
    expect(r.text).toContain('does NOT respond to the variables above');
  });

  it('names every non-exact term in the header so the file says what it is', () => {
    const r = specToScad(mixed, { title: 'm' });
    expect(r.text).toContain('COVERAGE: 1 exact, 2 baked, of 3 terms');
    expect(r.text).toContain('fields[0].terms[1] (add) — baked:');
  });

  it('says so plainly when nothing was baked', () => {
    const r = specToScad({ units: 'mm', fields: [{ id: 'p', terms: [sphereTerm('a', P(0, 0, 0), 1)] }] }, { title: 'm' });
    expect(r.text).toContain('Every term transpiled exactly; nothing here is a frozen mesh.');
  });

  it.each([
    ['stroke', { op: 'stroke', at: P(1, 0, 0), radius: 0.5, strength: 1 }],
    ['displace', { op: 'displace', noise: { amplitude: 0.1, scale: 0.5, seed: 1 } }],
    ['shell', { op: 'shell', thickness: 0.2 }],
    ['round', { op: 'round', radius: 0.3 }],
    ['twist', { op: 'twist', axis: 'z', turns: 1 }],
    ['bend', { op: 'bend', axis: 'z', radius: 5 }],
    ['taper', { op: 'taper', axis: 'z', from: 1, to: 0.5 }],
    ['elongate', { op: 'elongate', by: P(1, 0, 0) }],
  ])('bakes %s, and says which term forced it', (op, term) => {
    const r = specToScad({
      units: 'mm',
      fields: [{ id: 'p', cells: 16, terms: [sphereTerm('body', P(0, 0, 0), 2), term] }],
    }, { title: 'm' });
    const t = r.coverage.terms.find((x) => x.at === 'fields[0].terms[1]');
    expect(t.status).toBe('baked');
    expect(t.why).toBeTruthy();
    expect(r.text).toContain('polyhedron(');
    expect(r.variables).toBe(0);
  });

  it('bakes an expr shape and a harmonic lathe — neither is a closed-form solid', () => {
    const ex = specToScad({
      units: 'mm',
      fields: [{ id: 'p', cells: 16, terms: [{ id: 'e', op: 'add', shape: { kind: 'expr', d: 'len3(x, y, z) - 2', reach: 3 } }] }],
    }, { title: 'm' });
    expect(ex.coverage.baked).toBe(1);
    expect(ex.coverage.terms[0].why).toContain('expr');

    const h = specToScad({
      units: 'mm',
      fields: [{ id: 'p', cells: 16, terms: [{
        id: 'fluted', op: 'add',
        shape: {
          kind: 'lathe', profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }],
          axisFrom: P(0, 0, 0), axisTo: P(0, 0, 4), harmonics: [{ n: 8, amplitude: 0.2 }],
        },
      }] }],
    }, { title: 'm' });
    expect(h.coverage.baked).toBe(1);
    expect(h.coverage.terms[0].why).toContain('harmonics');
  });
});

describe('scene-scad — monomers', () => {
  it('a plain lathe monomer transpiles; a harmonic one bakes', () => {
    const plain = specToScad({
      units: 'mm',
      lathes: [{ id: 'cup', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 8 }, profile: [{ t: 0, radius: 3 }, { t: 1, radius: 4 }] }],
    }, { title: 'm' });
    expect(plain.coverage.exact).toBe(1);
    expect(plain.text).toContain('rotate_extrude(angle = 360)');
    expect(plain.text).toContain('module cup()');

    const fluted = specToScad({
      units: 'mm',
      lathes: [{ id: 'cup', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 8 }, profile: [{ t: 0, radius: 3 }, { t: 1, radius: 4 }], harmonics: [{ n: 6, amplitude: 0.3 }] }],
    }, { title: 'm' });
    expect(fluted.coverage.baked).toBe(1);
    expect(fluted.text).toContain('polyhedron(');
  });

  it('a plain prism transpiles; a shelled or tapered one bakes', () => {
    const base = { id: 'box', profile: { rect: { w: 4, h: 4 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 } };
    expect(specToScad({ units: 'mm', extrudes: [base] }, {}).coverage.exact).toBe(1);
    const shelled = specToScad({ units: 'mm', extrudes: [{ ...base, wallThickness: 0.6 }] }, {});
    expect(shelled.coverage.baked).toBe(1);
    expect(shelled.coverage.terms[0].why).toContain('wallThickness');
  });

  it('a standalone sweeps monomer BAKES — it caps flat where the capsule chain rounds', () => {
    const r = specToScad({
      units: 'mm',
      sweeps: [{ id: 'tube', path: [P(0, 0, 0), P(0, 0, 5)], radius: 1, caps: true }],
    }, { title: 'm' });
    expect(r.coverage.baked).toBe(1);
    expect(r.coverage.terms[0].why).toContain('caps flat');
    expect(r.text).toContain('polyhedron(');
    // ...while the same sweep as a FIELD shape is exact (every cuts-produced bore)
    const asField = specToScad({
      units: 'mm',
      fields: [{ id: 'p', terms: [{ id: 'tube', op: 'add', shape: { kind: 'sweep', path: [P(0, 0, 0), P(0, 0, 5)], radius: 1 } }] }],
    }, { title: 'm' });
    expect(asField.coverage.exact).toBe(1);
    expect(asField.text).toContain('hull()');
  });

  it('lowers `cuts` before transpiling, so a named boolean arrives as a difference()', () => {
    const r = specToScad({
      units: 'mm',
      lathes: [{ id: 'disc', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }] }],
      sweeps: [{ id: 'bore', path: [P(0, 0, -1), P(0, 0, 3)], radius: 1.2 }],
      cuts: [{ from: 'disc', subtract: ['bore'], cells: 16 }],
    }, { title: 'm' });
    expect(r.text).toContain('difference()');
    expect(r.coverage.baked).toBe(0);            // both operands have exact field twins
    expect(r.text).toContain('rotate_extrude(angle = 360)');
    expect(r.text).toContain('hull()');
  });

  it('gives each monomer its own module and calls them from one assembly', () => {
    const r = specToScad({
      units: 'mm',
      lathes: [
        { id: 'foot', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 }, profile: [{ t: 0, radius: 4 }, { t: 1, radius: 4 }], tint: '#b0873f' },
        { id: 'stem', axisFrom: { x: 0, y: 0, z: 1 }, axisTo: { x: 0, y: 0, z: 6 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] },
      ],
    }, { title: 'm' });
    expect(r.parts.map((p) => p.name)).toEqual(['foot', 'stem']);
    expect(r.text).toContain('module foot()');
    expect(r.text).toContain('module stem()');
    expect(r.text).toContain('color("#b0873f") foot();');
    expect(r.text).toContain('PREVIEW ONLY');
  });

  it('carries units into mm_per_unit and wraps the assembly in it', () => {
    const cm = specToScad({ units: 'cm', lathes: [{ id: 'a', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] }] }, {});
    expect(cm.mmPerUnit).toBe(10);
    expect(cm.text).toContain('mm_per_unit = 10;');
    expect(cm.text).toContain('scale(mm_per_unit)');
    const none = specToScad({ lathes: [{ id: 'a', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] }] }, {});
    expect(none.mmPerUnit).toBe(1);
    expect(none.text).toContain('declares no units');
  });

  it('says so rather than throwing when a manifest carries nothing emittable', () => {
    const r = specToScad({ units: 'mm' }, { title: 'empty' });
    expect(r.coverage.terms).toEqual([]);
    expect(r.text).toContain('No geometry');
    expect(() => specToScad(null)).toThrow(/manifest is required/);
  });
});

describe('scene-scad — polyhedron emission', () => {
  // a unit cube as six outward quads, corners CCW seen from outside
  const cube = () => {
    const p = (x, y, z) => [x, y, z];
    const q = (corners, outNormal) => ({ corners, outNormal });
    return [
      q([p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0)], { x: 0, y: 0, z: -1 }),
      q([p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)], { x: 0, y: 0, z: 1 }),
      q([p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)], { x: 0, y: -1, z: 0 }),
      q([p(0, 1, 0), p(0, 1, 1), p(1, 1, 1), p(1, 1, 0)], { x: 0, y: 1, z: 0 }),
      q([p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0)], { x: -1, y: 0, z: 0 }),
      q([p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)], { x: 1, y: 0, z: 0 }),
    ];
  };

  it('welds duplicated corners by their PRINTED form — eight points for a cube, not twenty-four', () => {
    const node = facesToPolyhedron(cube(), 'c');
    const text = node.emit(0).join('\n');
    const pts = text.match(/\n\s+\[[-\d., ]+\],?/g) || [];
    expect(text).toContain('points = [');
    expect(text).toContain('convexity = 10');
    // 8 unique corners + 6 faces = 14 bracketed rows
    expect(pts.length).toBe(14);
  });

  it('reverses winding against the outward normal — OpenSCAD wants clockwise from outside', () => {
    const faces = cube();
    const node = facesToPolyhedron(faces, null);
    const text = node.emit(0).join('\n');
    const facesBlock = text.slice(text.indexOf('faces = ['));
    const first = facesBlock.match(/\[(\d+(?:, \d+)+)\]/)[1].split(', ').map(Number);
    // the first face is CCW-outward in the fixture, so the emitted ring must be reversed
    expect(first).toEqual([3, 2, 1, 0]);
  });

  it('returns null rather than an empty polyhedron when there is nothing to emit', () => {
    expect(facesToPolyhedron([], 'x')).toBe(null);
    expect(facesToPolyhedron([{ corners: [[0, 0, 0], [1, 0, 0]] }], 'x')).toBe(null);
  });
});

describe('scene-scad — the emitted file is well formed', () => {
  const specs = {
    flange: {
      units: 'mm',
      fields: [{ id: 'flange', cells: 32, terms: [
        { id: 'disc', op: 'add', shape: { kind: 'lathe', profile: [{ t: 0, radius: 40 }, { t: 1, radius: 40 }], axisFrom: P(0, 0, 0), axisTo: P(0, 0, 6) } },
        { op: 'repeat', polar: { count: 6, radius: 30 }, combine: 'subtract', terms: [{ id: 'bolt', op: 'add', shape: { kind: 'capsule', a: P(0, 0, -1), b: P(0, 0, 7), radius: 3 } }] },
      ] }],
    },
    baked: {
      units: 'mm',
      fields: [{ id: 'blob', cells: 16, terms: [
        sphereTerm('body', P(0, 0, 0), 2),
        { id: 'bump', op: 'add', blend: 0.6, shape: { kind: 'sphere', center: P(1.5, 0, 0), radius: 1 } },
      ] }],
    },
    mixed: {
      units: 'cm',
      lathes: [{ id: 'disc', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1.2 }, profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }] }],
      sweeps: [{ id: 'bore', path: [P(0, 0, -1), P(0, 0, 3)], radius: 1.2 }],
      cuts: [{ from: 'disc', subtract: ['bore'], cells: 16 }],
    },
  };

  it.each(Object.keys(specs))('%s: every delimiter closes', (key) => {
    expect(delimitersBalance(specToScad(specs[key], { title: key }).text)).toBe(true);
  });

  // A statement ends in `;`, `{` or `}`; anything else must be a continuation inside a
  // multi-line call or literal (`polyhedron(`, a points row, `],`). What this catches is a
  // line left dangling on an operator or a bare `=` — a truncated emission.
  it.each(Object.keys(specs))('%s: no line is left dangling mid-statement', (key) => {
    const text = specToScad(specs[key], { title: key }).text;
    for (const line of text.split('\n')) {
      const code = line.replace(/\/\/.*$/, '').trim();
      if (!code) continue;
      expect(code).toMatch(/[;{}(,[\]]$/);
    }
  });

  it.each(Object.keys(specs))('%s: any polyhedron block opens and closes as one call', (key) => {
    const text = specToScad(specs[key], { title: key }).text;
    const opens = (text.match(/^\s*polyhedron\($/gm) || []).length;
    const closes = (text.match(/^\s*convexity = 10\);$/gm) || []).length;
    expect(opens).toBe(closes);
  });

  it.each(Object.keys(specs))('%s: no literal is left as NaN, undefined or an exponent', (key) => {
    const text = specToScad(specs[key], { title: key }).text;
    const code = text.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    expect(code).not.toMatch(/NaN|undefined|null|\de[+-]\d/);
  });
});
