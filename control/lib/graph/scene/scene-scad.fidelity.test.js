import { describe, expect, it } from 'vitest';

import { specToScad } from './scene-scad.js';
import { composeFieldTerms } from '../polygonizer/field-terms.js';

/**
 * openscad-leg.plan.md — is the transpile actually FAITHFUL?
 *
 * The gate that answers this properly renders the file in OpenSCAD and compares the solid
 * against what mojulo declared (phase 3, `scripts/scad-gate.mjs`). OpenSCAD is not installed
 * on this host, so that is unrun — and these tests exist because "unrun" should not mean
 * "unchecked".
 *
 * The method: read the numbers the emitter actually WROTE, reconstruct from them the points
 * OpenSCAD would put on the solid's surface, and assert those points lie on the recipe
 * field's zero set. The field is the independent authority (`composeFieldTerms`, which the
 * polygonizer and every existing pin already trust), and the emitted text is the thing under
 * test — so a frame that drifted, an axis placed wrong, or an inset computed the wrong way
 * shows up as a point floating off the surface.
 *
 * What this cannot catch, and phase 3 must: whether OpenSCAD PARSES the file, and whether its
 * own evaluation of these primitives matches its documentation.
 */

// ─── readers over the emitted text ───────────────────────────────────────────────

/** `name = <literal>;` → the literal, parsed as JSON (the emitter writes JSON-shaped arrays). */
function readVar(text, name) {
  const m = new RegExp(`^${name} = (.+);$`, 'm').exec(text);
  return m ? JSON.parse(m[1]) : null;
}

/** The first `multmatrix([[…]…])` as a 4×4 of numbers. */
function readMultmatrix(text) {
  const m = /multmatrix\((\[\[.*?\]\])\)/.exec(text);
  return m ? JSON.parse(m[1]) : null;
}

/** Columns of the emitted matrix: the basis OpenSCAD will use, and the origin it places. */
function frameOf(M) {
  const c = (j) => ({ x: M[0][j], y: M[1][j], z: M[2][j] });
  return { u: c(0), v: c(1), d: c(2), o: c(3) };
}

const add = (...ps) => ps.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y, z: a.z + p.z }), { x: 0, y: 0, z: 0 });
const mul = (p, s) => ({ x: p.x * s, y: p.y * s, z: p.z * s });

/** The recipe's own field, as the independent authority on where the surface is. */
const fieldOf = (terms) => composeFieldTerms(terms);

describe('scad fidelity — a lathe lands on the recipe surface', () => {
  // a non-axis-aligned axis, so a wrong rotation cannot hide
  const axisFrom = [1, 2, 3];
  const axisTo = [3, 4, 7];        // direction (2,2,4), length √24 — nothing convenient
  const LEN = Math.sqrt(24);
  const terms = [{
    id: 'cup', op: 'add',
    shape: { kind: 'lathe', profile: [{ t: 0, radius: 5 }, { t: 0.5, radius: 8 }, { t: 1, radius: 3 }], axisFrom, axisTo },
  }];

  it('every emitted profile vertex maps onto the field zero set, at every angle', () => {
    const { text } = specToScad({ units: 'mm', fields: [{ id: 'p', cells: 16, terms }] }, {});
    const poly = readVar(text, 'p_cup_profile');
    const { u, v, d, o } = frameOf(readMultmatrix(text));
    const f = fieldOf(terms);

    // OpenSCAD revolves the polygon about its local +Z, then the matrix stands it on the axis
    let checked = 0;
    for (const [r, z] of poly) {
      if (!(r > 0)) continue;                       // the closing run down the axis is interior
      for (const theta of [0, 0.7, 1.9, 3.3, 4.8, 6.0]) {
        const p = add(o, mul(u, r * Math.cos(theta)), mul(v, r * Math.sin(theta)), mul(d, z));
        // 1e-5, not tighter: the emitted profile and matrix are rounded to 6 decimals, so a
        // point reconstructed FROM THE FILE sits about that far off an exact surface. This is
        // the precision the artifact carries, which is the thing under test.
        expect(Math.abs(f.d(p))).toBeLessThan(1e-5);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('the emitted polygon spans the axis LENGTH, not the recipe t', () => {
    const { text } = specToScad({ units: 'mm', fields: [{ id: 'p', cells: 16, terms }] }, {});
    const poly = readVar(text, 'p_cup_profile');
    // the recipe's t runs 0..1; the emitted polygon must run 0..|axis|
    expect(Math.max(...poly.map(([, z]) => z))).toBeCloseTo(LEN, 5);
    expect(LEN).toBeGreaterThan(1);                 // guards the test: t would read 1
    expect(Math.max(...poly.map(([r]) => r))).toBe(8);
  });
});

describe('scad fidelity — a prism lands on the recipe surface', () => {
  // w ≠ h, so a swapped or rotated profile frame moves the corners off the solid
  const axisFrom = [0, 1, 0];
  const axisTo = [4, 1, 3];        // length 5, off every axis
  const W = 6;
  const H = 2;
  const terms = [{
    id: 'bar', op: 'add',
    shape: { kind: 'extrude', profile: { rect: { w: W, h: H } }, axisFrom, axisTo },
  }];

  it('every corner of the emitted section lies on the field zero set', () => {
    const { text } = specToScad({ units: 'mm', fields: [{ id: 'p', cells: 16, terms }] }, {});
    const [w, h] = readVar(text, 'p_bar_section');
    const height = readVar(text, 'p_bar_height');
    const { u, v, d, o } = frameOf(readMultmatrix(text));
    const f = fieldOf(terms);

    expect([w, h]).toEqual([W, H]);
    expect(height).toBeCloseTo(5, 9);

    for (const su of [-0.5, 0.5]) {
      for (const sv of [-0.5, 0.5]) {
        for (const s of [0, height]) {
          const p = add(o, mul(u, w * su), mul(v, h * sv), mul(d, s));
          expect(Math.abs(f.d(p))).toBeLessThan(1e-6);
        }
      }
    }
  });

  it('the section is NOT square — so this test would fail on a swapped profile frame', () => {
    // guards the test itself: with w === h the check above passes under a 90° frame error
    expect(W).not.toBe(H);
  });
});

describe('scad fidelity — the rounded box keeps its OUTER extent', () => {
  it('inset half-extents plus the round recover the declared size exactly', () => {
    const size = [10, 6, 4];
    const round = 1.5;
    const { text } = specToScad({
      units: 'mm',
      fields: [{ id: 'p', cells: 16, terms: [{ id: 'blk', op: 'add', shape: { kind: 'box', center: [0, 0, 0], size, round } }] }],
    }, {});
    const inner = readVar(text, 'p_blk_inner');
    const rr = readVar(text, 'p_blk_round');
    expect(rr).toBe(round);
    // the hull of balls at ±inner with radius rr spans 2*inner + 2*rr on each axis
    expect(inner.map((v) => v * 2 + 2 * rr)).toEqual(size);
  });

  it('the eight ball centres sit exactly `round` inside the surface', () => {
    const size = [10, 6, 4];
    const round = 1.5;
    const terms = [{ id: 'blk', op: 'add', shape: { kind: 'box', center: [2, -1, 0.5], size, round } }];
    const { text } = specToScad({ units: 'mm', fields: [{ id: 'p', cells: 16, terms }] }, {});
    const inner = readVar(text, 'p_blk_inner');
    const centre = readVar(text, 'p_blk_center');
    const f = fieldOf(terms);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const p = { x: centre[0] + sx * inner[0], y: centre[1] + sy * inner[1], z: centre[2] + sz * inner[2] };
      // a corner ball's centre is one radius in from the rounded surface
      expect(f.d(p)).toBeCloseTo(-round, 6);
    }
  });
});

describe('scad fidelity — a rounded section keeps its outer extent too', () => {
  it('offset(r) over the inset square recovers the declared w × h', () => {
    const { text } = specToScad({
      units: 'mm',
      fields: [{ id: 'p', cells: 16, terms: [{
        id: 'bar', op: 'add',
        shape: { kind: 'extrude', profile: { rect: { w: 9, h: 5, r: 1.25 } }, axisFrom: [0, 0, 0], axisTo: [0, 0, 4] },
      }] }],
    }, {});
    const [w, h] = readVar(text, 'p_bar_section');
    const rr = readVar(text, 'p_bar_corner');
    expect(rr).toBe(1.25);
    expect([w + 2 * rr, h + 2 * rr]).toEqual([9, 5]);
  });
});

describe('scad fidelity — a capsule chain is the swept ball', () => {
  it('the emitted path and radius reproduce the field surface at every joint', () => {
    const path = [[0, 0, 0], [0, 0, 6], [4, 0, 6]];
    const radius = 1.5;
    const terms = [{ id: 'pipe', op: 'add', shape: { kind: 'sweep', path, radius } }];
    const { text } = specToScad({ units: 'mm', fields: [{ id: 'p', cells: 16, terms }] }, {});
    expect(readVar(text, 'p_pipe_path')).toEqual(path);
    expect(readVar(text, 'p_pipe_radius')).toBe(radius);

    const f = fieldOf(terms);
    // every ball centre is exactly one radius inside; a point one radius out along a
    // perpendicular sits ON the surface — which is what hull() of consecutive balls builds
    for (const c of path) {
      expect(f.d({ x: c[0], y: c[1], z: c[2] })).toBeCloseTo(-radius, 6);
      expect(f.d({ x: c[0], y: c[1] + radius, z: c[2] })).toBeCloseTo(0, 6);
    }
  });
});

describe('scad fidelity — the polar array lands where the field has holes', () => {
  it('each emitted instance position is a place the solid was cut away', () => {
    const count = 6;
    const radius = 30;
    const terms = [
      { id: 'disc', op: 'add', shape: { kind: 'lathe', profile: [{ t: 0, radius: 40 }, { t: 1, radius: 40 }], axisFrom: [0, 0, 0], axisTo: [0, 0, 6] } },
      { op: 'repeat', polar: { count, radius }, combine: 'subtract', terms: [{ id: 'bolt', op: 'add', shape: { kind: 'capsule', a: [0, 0, -1], b: [0, 0, 7], radius: 3 } }] },
    ];
    const { text } = specToScad({ units: 'mm', fields: [{ id: 'p', cells: 16, terms }] }, {});
    expect(readVar(text, 'p_term1_count')).toBe(count);
    expect(readVar(text, 'p_term1_radius')).toBe(radius);
    const f = fieldOf(terms);

    // the emitted loop is: rotate([0,0,i*360/count]) translate([radius,0,0]) <bolt>
    for (let i = 0; i < count; i += 1) {
      const a = (i * 2 * Math.PI) / count;
      const p = { x: radius * Math.cos(a), y: radius * Math.sin(a), z: 3 };
      expect(f.d(p)).toBeGreaterThan(0);            // cut away: outside the solid
    }
    // and between two holes the disc is still solid, so the array is not over-cutting
    const between = (Math.PI / count);
    expect(f.d({ x: radius * Math.cos(between), y: radius * Math.sin(between), z: 3 })).toBeLessThan(0);
  });
});

describe('scad fidelity — a counted array centres on the original', () => {
  it('the emitted offsets reproduce the field instances', () => {
    const terms = [{
      op: 'repeat', count: [3, 1, 1], spacing: [10, 0, 0],
      terms: [{ id: 'stud', op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 2 } }],
    }];
    const { text } = specToScad({ units: 'mm', fields: [{ id: 'p', cells: 16, terms }] }, {});
    expect(readVar(text, 'p_term0_count')).toEqual([3, 1, 1]);
    expect(readVar(text, 'p_term0_spacing')).toEqual([10, 0, 0]);
    const f = fieldOf(terms);
    // (i − (n−1)/2)·spacing ⇒ −10, 0, +10 — every one a ball centre
    for (const ix of [0, 1, 2]) {
      const x = (ix - 1) * 10;
      expect(f.d({ x, y: 0, z: 0 })).toBeCloseTo(-2, 6);
    }
    // and the gap between instances is empty
    expect(f.d({ x: 5, y: 0, z: 0 })).toBeGreaterThan(0);
  });
});

describe('scad fidelity — transform order and mirror-as-negative-scale', () => {
  it('the emitted chain reproduces mojulo scale → mirror → rotate → translate', () => {
    const terms = [{
      op: 'transform', translate: [10, 0, 0], rotate: [0, 0, 90], scale: 2, mirror: 'x',
      terms: [{ id: 'b', op: 'add', shape: { kind: 'sphere', center: [3, 0, 0], radius: 1 } }],
    }];
    const { text } = specToScad({ units: 'mm', fields: [{ id: 'p', cells: 16, terms }] }, {});
    const t = readVar(text, 'p_term0_translate');
    const r = readVar(text, 'p_term0_rotate');
    const s = readVar(text, 'p_term0_scale');
    expect(t).toEqual([10, 0, 0]);
    expect(r).toEqual([0, 0, 90]);
    expect(s).toEqual([-2, 2, 2]);                  // the mirror rides in as a negative factor

    // apply the emitted chain by hand, innermost first, to the sphere's centre
    const local = { x: 3, y: 0, z: 0 };
    const scaled = { x: local.x * s[0], y: local.y * s[1], z: local.z * s[2] };
    const rad = (r[2] * Math.PI) / 180;
    const rotated = {
      x: scaled.x * Math.cos(rad) - scaled.y * Math.sin(rad),
      y: scaled.x * Math.sin(rad) + scaled.y * Math.cos(rad),
      z: scaled.z,
    };
    const world = { x: rotated.x + t[0], y: rotated.y + t[1], z: rotated.z + t[2] };

    // that point must be the centre of the warped ball: one (scaled) radius inside
    const f = fieldOf(terms);
    expect(f.d(world)).toBeLessThan(0);
    expect(f.d(world)).toBeCloseTo(-2, 5);          // radius 1 under a uniform ×2
  });
});
