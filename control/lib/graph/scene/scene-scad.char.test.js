import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { specToScad } from './scene-scad.js';

/**
 * scene-scad characterization net (openscad-leg.plan.md phase 1 gate).
 *
 * Hash-pins the transpiled text of three fixtures, one per branch the leg has:
 *
 *   A. flange — every term EXACT (a lathe body, a polar repeat, a capsule cutter). The
 *      file this leg exists to produce: no polyhedron anywhere, six live dials.
 *   B. cut    — `cuts` lowered to a field boolean between two SURFACE monomers, in cm, so
 *      the unit wrapper and the lowerCuts seam are both pinned.
 *   C. blob   — a blended add that FORCES a bake, with an exact bore folded on top. Pins
 *      the mixed case: a frozen polyhedron and a live boolean in one file.
 *
 * A pin change is legitimate ONLY alongside a plan phase that says the emission changes.
 * The text is an ARTIFACT the operator opens in OpenSCAD, so a drifting byte here is a
 * drifting file there.
 *
 * NOT pinned, deliberately: any fixture whose bake runs at the default 64 cells. The
 * polyhedron would be megabytes and the pin would be measuring the polygonizer rather
 * than this emitter. C runs at 16 cells for the same reason.
 *
 * Re-pin log:
 *   - phase 1 (2026-09-11): first pin.
 *   - phase 1, same day, before anything shipped: a dial inside a `cuts`-emitted field no
 *     longer doubles the body's name — `lowerCuts` names its field `cut:<body>`, so the
 *     body term dialled `cut_disc_disc_profile`. B re-based; A and C unchanged (neither
 *     goes through lowerCuts).
 */

const sha = (s) => createHash('sha256').update(s).digest('hex');
const P = (x, y, z) => [x, y, z];

const FIXTURES = {
  flange: {
    spec: {
      units: 'mm',
      fields: [{ id: 'flange', cells: 32, terms: [
        { id: 'disc', op: 'add', shape: { kind: 'lathe', profile: [{ t: 0, radius: 40 }, { t: 1, radius: 40 }], axisFrom: P(0, 0, 0), axisTo: P(0, 0, 6) } },
        { op: 'repeat', polar: { count: 6, radius: 30 }, combine: 'subtract', terms: [
          { id: 'bolt', op: 'add', shape: { kind: 'capsule', a: P(0, 0, -1), b: P(0, 0, 7), radius: 3 } },
        ] },
      ] }],
    },
    opts: { title: 'bolt-circle flange', ref: 'sk_flange', kind: 'workbench' },
    hash: '3bfb1a0c7507da7d94234205df35798367983e9eb20d50f9daa2c3253bfd03c5',
    coverage: { exact: 3, baked: 0 },
    variables: 6,
  },
  cut: {
    spec: {
      units: 'cm',
      lathes: [{ id: 'disc', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1.2 }, profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }], material: 'steel' }],
      sweeps: [{ id: 'bore', path: [P(0, 0, -1), P(0, 0, 3)], radius: 1.2 }],
      cuts: [{ from: 'disc', subtract: ['bore'], cells: 32 }],
    },
    opts: { title: 'bored disc', ref: 'sk_cut', kind: 'workbench' },
    hash: '26fe758be0b9befbb947ff8c59242dc316485a3cff6ea11b75f93a043341f79b',
    coverage: { exact: 2, baked: 0 },
    variables: 3,
  },
  blob: {
    spec: {
      units: 'mm',
      fields: [{ id: 'blob', cells: 16, terms: [
        { id: 'body', op: 'add', shape: { kind: 'sphere', center: P(0, 0, 0), radius: 2 } },
        { id: 'bump', op: 'add', blend: 0.6, shape: { kind: 'sphere', center: P(1.5, 0, 0), radius: 1 } },
        { id: 'bore', op: 'subtract', shape: { kind: 'capsule', a: P(0, 0, -3), b: P(0, 0, 3), radius: 0.4 } },
      ] }],
    },
    opts: { title: 'blended blob', ref: 'sk_blob', kind: 'workbench' },
    hash: 'cc1a91f973664ff78ae19b9fc3cf6546197939afae03ac1dc5ec08b9aab8972c',
    coverage: { exact: 1, baked: 2 },
    variables: 3,
  },
};

describe('scene-scad characterization', () => {
  it.each(Object.entries(FIXTURES))('%s emits byte-identical text', (name, f) => {
    const r = specToScad(f.spec, f.opts);
    expect(sha(r.text)).toBe(f.hash);
  });

  it.each(Object.entries(FIXTURES))('%s pins its coverage ledger alongside its bytes', (name, f) => {
    const r = specToScad(f.spec, f.opts);
    expect(r.coverage.exact).toBe(f.coverage.exact);
    expect(r.coverage.baked).toBe(f.coverage.baked);
    expect(r.variables).toBe(f.variables);
  });

  it('A and B carry no frozen mesh at all — that is the whole point of the leg', () => {
    for (const name of ['flange', 'cut']) {
      const { text } = specToScad(FIXTURES[name].spec, FIXTURES[name].opts);
      expect(text).not.toContain('polyhedron(');
      expect(text).toContain('Every term transpiled exactly');
    }
  });

  it('C carries both a frozen mesh and a live boolean over it', () => {
    const { text } = specToScad(FIXTURES.blob.spec, FIXTURES.blob.opts);
    expect(text).toContain('polyhedron(');
    expect(text).toContain('difference()');
    expect(text).toContain('does NOT respond to the variables above');
  });
});
