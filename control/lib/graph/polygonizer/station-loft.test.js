import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileLayered, auditLayered, resolveLayeredDials, mirrorPid, mirrorFaceId, surfaceLocalOffset } from './station-loft.js';
import { lowerLayeredToWorkbench, lowerLayeredManifest } from './station-loft-workbench.js';
import { loftToFaces } from './loft-faces.js';
import { auditClosure } from './face-closure.js';

// A synthetic two-part recipe: a 4-slot body (top, sideR, bottom, sideL) over two stations with caps,
// and one closed spike pinned to a body face. Exercises every dial op and the mirror-by-name rule.
const body = {
  layer: 1, closure: 'closed', slots: ['top', 'sideR', 'bottom', 'sideL'], group: 'Body', capGroups: { back: 'Back', tip: 'Tip' },
  stations: [
    { id: 'st0', points: { top: [0, 0, 1], sideR: [1, 0, 0.5], bottom: [0, 0, 0], sideL: [-1, 0, 0.5] } },
    { id: 'st1', points: { top: [0, 1, 1], sideR: [1, 1, 0.5], bottom: [0, 1, 0], sideL: [-1, 1, 0.5] } },
  ],
  caps: { back: [0, -0.5, 0.5], tip: [0, 1.5, 0.5] },
};
const spike = {
  layer: 2, closure: 'closed', group: 'Spike',
  pin: { parent: 'body', face: 'body/st0-st1.k0.a', weights: [1 / 3, 1 / 3, 1 / 3], tangentEdge: ['body/st0.top', 'body/st0.sideR'], handedness: 1 },
  offsets: { b0: [0.1, 0, 0], b1: [0, 0.1, 0], b2: [-0.1, 0, 0], apex: [0, 0, 0.5] },
  faces: { base: ['b0', 'b2', 'b1'], s0: ['b0', 'b1', 'apex'], s1: ['b1', 'b2', 'apex'], s2: ['b2', 'b0', 'apex'] },
  stretch: { dial: 'spikeLen', origin: [0, 0, 0], axis: [0, 0, 1] },
  loft: { rings: [['b0', 'b1', 'b2']], from: 'b0', to: 'apex', axis: 'ring-normal', pinch: { tip: 'apex' } },
};
const recipe = {
  frame: { up: '+z', front: '+y' },
  dials: {
    width: { min: 0.5, max: 2, rest: 1, op: 'scale', axis: 'x', pivot: 0, parts: ['body'], blend: { st0: 1, st1: 1 } },
    lift: { min: 0, max: 1, rest: 0, op: 'offset', axis: 'z', slots: ['top'], parts: ['body'], blend: { st1: 1 } },
    tilt: { min: 0, max: 45, rest: 0, op: 'hinge', part: 'body', pivot: 'body/st0.bottom', axis: 'x', sign: -1 },
    spikeLen: { min: 0.2, max: 3, rest: 1, op: 'stretch', parts: ['spike'] },
  },
  parts: { body, spike },
  creases: { ridge: { parent: 'body', edge: ['body/st0.top', 'body/st1.top'] } },
};
const at = (m) => Object.fromEntries(m.pointIds.map((id, i) => [id, m.vertices[i]]));

describe('station-loft — the grammar', () => {
  it('compiles a closed body and a pinned detail; every part passes the audit', () => {
    const m = compileLayered(recipe); const a = auditLayered(m);
    expect(Object.values(a).every((r) => r.pass)).toBe(true);
    expect(m.pointIds).toContain('body/st0.sideL'); expect(m.pointIds).toContain('spike/apex'); expect(m.faceIds).toContain('body/st0-st1.k3.a'); expect(m.featureEdges).toHaveLength(1);
    expect(m.groups).toContain('Back'); expect(m.groups).toContain('Spike');
  });
  it('mirrors by name: the left half is the exact mirror of the right, faces included', () => {
    const m = compileLayered(recipe); const P = at(m);
    for (const [id, v] of Object.entries(P)) if (/[RL]$/.test(id)) expect(P[mirrorPid(id)]).toEqual([-v[0], v[1], v[2]]);
    expect(mirrorFaceId('body/st0-st1.k0.a', 4)).toBe('body/st0-st1.k3.a'); expect(mirrorFaceId('body/back.k1', 4)).toBe('body/back.k2');
    const f = m.parts.body.faces; expect(f['body/st0-st1.k3.a']).toEqual([...f['body/st0-st1.k0.a']].reverse().map(mirrorPid));
  });
  it('point and face ids are dial-invariant; scale, offset, hinge and stretch do what they say', () => {
    const rest = compileLayered(recipe); const P0 = at(rest);
    const wide = at(compileLayered(recipe, { width: 2 })); expect(wide['body/st0.sideR'][0]).toBeCloseTo(2, 12); expect(wide['body/st0.top']).toEqual(P0['body/st0.top']);
    const lifted = at(compileLayered(recipe, { lift: 0.5 })); expect(lifted['body/st1.top'][2]).toBeCloseTo(1.5, 12); expect(lifted['body/st0.top'][2]).toBeCloseTo(1, 12); expect(lifted['body/st1.sideR']).toEqual(P0['body/st1.sideR']);
    const tilted = compileLayered(recipe, { tilt: 30 }); const T = at(tilted); expect(T['body/st0.bottom']).toEqual(P0['body/st0.bottom']); expect(T['body/tip'][2]).toBeLessThan(P0['body/tip'][2]);
    const d = (a, b) => Math.hypot(...a.map((x, i) => x - b[i])); expect(d(T['body/st1.top'], T['body/st0.bottom'])).toBeCloseTo(d(P0['body/st1.top'], P0['body/st0.bottom']), 12);
    const long = compileLayered(recipe, { spikeLen: 2 }); expect(surfaceLocalOffset(long.pins.spike, long.parts.spike.points.apex)[2]).toBeCloseTo(1, 12); expect(surfaceLocalOffset(long.pins.spike, long.parts.spike.points.b0)).toEqual(expect.arrayContaining([expect.closeTo(0.1, 12)]));
    for (const m of [tilted, long]) { expect(m.pointIds).toEqual(rest.pointIds); expect(m.faceIds).toEqual(rest.faceIds); expect(m.faces).toEqual(rest.faces); }
  });
  it('a pinned detail rides its face through every dial (local offsets unchanged)', () => {
    for (const dials of [{ width: 1.7 }, { lift: 0.8 }, { tilt: 40 }, { width: 0.6, tilt: 20, lift: 0.3 }]) { const m = compileLayered(recipe, dials); for (const [id, o] of Object.entries(spike.offsets)) surfaceLocalOffset(m.pins.spike, m.parts.spike.points[id]).forEach((x, i) => expect(x).toBeCloseTo(o[i], 10)); }
  });
  it('channels off emit nothing from that channel; L1 unchanged', () => {
    const primary = compileLayered(recipe, {}, { details: false, creases: false }); expect(Object.keys(primary.parts)).toEqual(['body']); expect(primary.featureEdges).toEqual([]); expect(primary.pins).toEqual({});
    expect(compileLayered(recipe, {}, { creases: false }).vertices).toEqual(compileLayered(recipe).vertices);
  });
  it('refuses: unknown or out-of-range dials, unknown pin face, a higher-layer parent, a bad hinge pivot, a bad slot count', () => {
    expect(() => compileLayered(recipe, { wings: 1 })).toThrow(/unknown dial/); expect(() => compileLayered(recipe, { tilt: 90 })).toThrow(/outside/);
    expect(() => resolveLayeredDials(recipe.dials, { width: 0.1 })).toThrow(/outside/);
    const bad = structuredClone(recipe); bad.parts.spike.pin.face = 'body/st9-st9.k0.a'; expect(() => compileLayered(bad)).toThrow(/face/);
    const up = structuredClone(recipe); up.parts.spike.pin.parent = 'spike'; expect(() => compileLayered(up)).toThrow(/lower layer|missing parent/);
    const hinge = structuredClone(recipe); hinge.dials.tilt.pivot = 'body/nowhere'; expect(() => compileLayered(hinge, { tilt: 5 })).toThrow(/pivot/);
    const odd = structuredClone(recipe); odd.parts.body.slots = ['top', 'sideR', 'bottom']; expect(() => compileLayered(odd)).toThrow(/even/);
  });
  it('is deterministic', () => { expect(compileLayered(recipe, { width: 1.3, tilt: 12 })).toEqual(compileLayered(recipe, { width: 1.3, tilt: 12 })); });
});

describe('station-loft-workbench — the lowering', () => {
  it('every part becomes one closed loft; L1 exact, a ring-normal detail exact; seated on the grid', () => {
    for (const dials of [{}, { width: 2, lift: 1, tilt: 45, spikeLen: 3 }, { width: 0.5, spikeLen: 0.2 }]) {
      const m = compileLayered(recipe, dials); const { spec, loweringError, seatedFrom } = lowerLayeredToWorkbench(m, { title: 't' });
      expect(spec.lofts.map((l) => l.id).sort()).toEqual(['body', 'spike']); expect(loweringError.body).toBeLessThan(1e-9); expect(loweringError.spike).toBeLessThan(1e-9);
      let minZ = Infinity;
      for (const loft of spec.lofts) { const faces = loftToFaces(loft, {}); expect(faces.length).toBeGreaterThan(0); const a = auditClosure(faces); expect(a.closed && a.boundaryEdgeCount === 0, `${loft.id} ${JSON.stringify(dials)}`).toBe(true); for (const f of faces) for (const c of f.corners) minZ = Math.min(minZ, c[2]); }
      expect(Math.abs(minZ)).toBeLessThan(1e-6); const lowest = Math.min(...m.vertices.map((v) => v[2])); expect(seatedFrom ?? 0).toBeCloseTo(lowest, 12);   // null when it already sat on the grid
    }
  });
  it('a stored manifest lowers to a workbench manifest, dials and all', () => {
    const wb = lowerLayeredManifest({ kind: 'layered', title: 'x', recipe, dials: { width: 1.5 }, units: 'cm' }, compileLayered);
    expect(wb.kind).toBe('workbench'); expect(wb.units).toBe('cm'); expect(wb.lofts).toHaveLength(2); expect(wb.meta.dials.width).toBe(1.5);
  });
});

const DRAGON = path.resolve(process.cwd(), '../docs/examples/dragon-layered/recipe.json');
describe.skipIf(!existsSync(DRAGON))('station-loft — the dragon recipe (docs/examples/dragon-layered)', () => {
  const dragon = JSON.parse(readFileSync(DRAGON, 'utf8'));
  const extremes = [{}, Object.fromEntries(Object.entries(dragon.dials).map(([k, s]) => [k, s.min])), Object.fromEntries(Object.entries(dragon.dials).map(([k, s]) => [k, s.max]))];
  it('compiles with every part passing the audit at rest and at both dial extremes', () => {
    for (const dials of extremes) { const a = auditLayered(compileLayered(dragon, dials)); expect(Object.values(a).every((r) => r.pass), JSON.stringify(dials)).toBe(true); }
  });
  it('lowers to closed lofts at rest and at both extremes (zero-height details omitted, open patches omitted)', () => {
    for (const dials of extremes) { const { spec, omitted } = lowerLayeredToWorkbench(compileLayered(dragon, dials)); expect(omitted).toEqual(expect.arrayContaining(['nostrilL', 'nostrilR'])); for (const loft of spec.lofts) { const a = auditClosure(loftToFaces(loft, {})); expect(a.closed && a.boundaryEdgeCount === 0, loft.id).toBe(true); } }
  });
});
