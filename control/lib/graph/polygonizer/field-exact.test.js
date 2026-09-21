import { describe, it, expect, beforeAll } from 'vitest';
import { ensureExactKernel, exactKernelReady, exactSupport, exactFieldFaces, DEFAULT_SEGMENTS } from './field-exact.js';
import { fieldToFaces, validateFields } from './field-faces.js';
import { manifestWantsExact } from './field-exact-reach.js';
import { lowerCuts, validateCuts } from './workbench-cuts.js';
import { auditClosure } from './face-closure.js';

const box = (faces) => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k += 1) { if (c[k] < min[k]) min[k] = c[k]; if (c[k] > max[k]) max[k] = c[k]; }
  return { min, max, size: [0, 1, 2].map((k) => Math.round((max[k] - min[k]) * 1000) / 1000) };
};

// the flange from the workbench card: a disc, a hub, a bore, a bolt circle as one repeated bore
const FLANGE = [
  { id: 'disc', op: 'add', shape: { kind: 'lathe', axisFrom: [0, 0, 0], axisTo: [0, 0, 1.2], profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }] } },
  { id: 'hub', op: 'add', shape: { kind: 'lathe', axisFrom: [0, 0, 0], axisTo: [0, 0, 3], profile: [{ t: 0, radius: 2.4 }, { t: 1, radius: 2.4 }] } },
  { id: 'bore', op: 'subtract', shape: { kind: 'sweep', path: [[0, 0, -1], [0, 0, 4]], radius: 1.2 } },
  { op: 'repeat', polar: { count: 6, radius: 4.5 }, combine: 'subtract', terms: [{ id: 'bolt', op: 'add', shape: { kind: 'capsule', a: [0, 0, -1], b: [0, 0, 3], radius: 0.45 } }] },
];

let hasKernel = false;
beforeAll(async () => { hasKernel = await ensureExactKernel(); });
const kernel = (name, fn) => it(name, async () => { if (!hasKernel) return; await fn(); });

describe('field-exact — reach', () => {
  it('names the first term with no exact twin, the way the transpiler ledger does', () => {
    expect(exactSupport(FLANGE)).toEqual({ ok: true });
    expect(exactSupport([{ op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 1 }, blend: 0.3 }]).why).toMatch(/blend/);
    expect(exactSupport([{ op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 1 } }, { op: 'stroke', at: [0, 0, 1], radius: 0.5, strength: 1 }]).at).toBe('terms[1]');
    expect(exactSupport([{ op: 'add', shape: { kind: 'expr', d: 'x', bounds: { min: [0, 0, 0], max: [1, 1, 1] } } }]).why).toMatch(/expr/);
    expect(exactSupport([{ op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 1 } }, { op: 'twist', turns: 1 }]).why).toMatch(/twist/);
    expect(exactSupport([{ op: 'transform', translate: [1, 0, 0], terms: [{ op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 1 } }, { op: 'displace', noise: { amplitude: 0.1 } }] }]).at).toBe('terms[0].terms[1]');
  });

  it('validateFields refuses exact on a term list outside the reach, and a bad segments dial', () => {
    expect(validateFields([{ exact: true, terms: FLANGE }])).toEqual([]);
    expect(validateFields([{ exact: true, terms: [{ op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 1 }, blend: 0.2 }] }]).join('\n')).toMatch(/exact: .*blend/);
    expect(validateFields([{ exact: 'yes', terms: FLANGE }]).join('\n')).toMatch(/exact: must be true or false/);
    expect(validateFields([{ exact: true, segments: 3, terms: FLANGE }]).join('\n')).toMatch(/segments/);
  });

  it('manifestWantsExact names the recipes whose render needs the kernel readied first', () => {
    expect(manifestWantsExact({ kind: 'workbench', fields: [{ terms: FLANGE }] })).toBe(false);
    expect(manifestWantsExact({ kind: 'workbench', fields: [{ exact: true, terms: FLANGE }] })).toBe(true);
    expect(manifestWantsExact({ kind: 'workbench', lathes: [], cuts: [{ from: 'a', subtract: ['b'], exact: true }] })).toBe(true);
    expect(manifestWantsExact({ kind: 'workbench', program: { source: 'return {}' } })).toBe(true);   // a program may emit one
    expect(manifestWantsExact({ kind: 'assembler', items: [{ source: { fields: [{ exact: true, terms: FLANGE }] } }] })).toBe(true);
    expect(manifestWantsExact({ kind: 'assembler', items: [{ source: { lathes: [] } }] })).toBe(false);
    expect(manifestWantsExact({ kind: 'scad', source: 'cube(1);', fields: [{ id: 'f', exact: true, terms: FLANGE }] })).toBe(true);
    expect(manifestWantsExact({ kind: 'scad', source: 'cube(1);' })).toBe(false);
    expect(manifestWantsExact({ kind: 'figure' })).toBe(false);
    expect(manifestWantsExact(null)).toBe(false);
  });

  it('a cut takes exact and hands it to the field it lowers to; an exact cut refuses blend', () => {
    const m = {
      lathes: [{ id: 'flange', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1.2 }, profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }] }],
      sweeps: [{ id: 'bore', path: [[0, 0, -1], [0, 0, 3]], radius: 1.2 }],
      cuts: [{ id: 'bored', from: 'flange', subtract: ['bore'], exact: true, segments: 64 }],
    };
    expect(validateCuts(m)).toEqual([]);
    const lowered = lowerCuts(m);
    expect(lowered.fields[0].exact).toBe(true);
    expect(lowered.fields[0].segments).toBe(64);
    expect(validateCuts({ ...m, cuts: [{ ...m.cuts[0], blend: 0.2 }] }).join('\n')).toMatch(/exact cut has no blended rim/);
  });
});

describe('field-exact — the kernel (skipped when manifold-3d is not installed)', () => {
  kernel('the flange is exact: a 12-unit disc measures 12.000, closed, with a bore lip that is a true circle', async () => {
    const faces = exactFieldFaces({ id: 'f', exact: true, terms: FLANGE });
    const b = box(faces);
    expect(b.size[0]).toBe(12);          // the surface net declares 11.9 at cells 64
    expect(b.size[1]).toBe(12);
    expect(b.size[2]).toBe(3);
    expect(auditClosure(faces, { intendClosed: true }).closed).toBe(true);
    expect(faces.every((f) => f.exact === true)).toBe(true);
    // the lip: corners of faces grouped 'bore' sit at radius 1.2, within the facet chord error
    const lip = faces.filter((f) => f.group === 'bore').flatMap((f) => f.corners.slice(0, 3));
    expect(lip.length).toBeGreaterThan(0);
    const r = lip.map((c) => Math.hypot(c[0], c[1]));
    expect(Math.max(...r)).toBeLessThanOrEqual(1.2 + 1e-6);
    expect(Math.min(...r)).toBeGreaterThan(1.2 * Math.cos(Math.PI / DEFAULT_SEGMENTS) - 1e-6);
    // groups follow the nearest term, as on the surface net
    expect(new Set(faces.map((f) => f.group))).toEqual(new Set(['disc', 'hub', 'bore', 'bolt']));
  });

  kernel('fieldToFaces routes exact: true to the kernel and everything else to the surface net, byte for byte', async () => {
    const spec = { terms: [{ id: 'b', op: 'add', shape: { kind: 'box', center: [0, 0, 1], size: [4, 2, 2] } }] };
    const net = fieldToFaces(spec, {});
    const exact = fieldToFaces({ ...spec, exact: true }, {});
    expect(box(exact).size).toEqual([4, 2, 2]);
    expect(exact).toHaveLength(12);
    expect(net.length).toBeGreaterThan(12);
    expect(JSON.stringify(fieldToFaces(spec, {}))).toBe(JSON.stringify(net));
  });

  kernel('a rounded box, an extrude with a rect profile, a counted repeat and a transform all compose', async () => {
    const faces = exactFieldFaces({ exact: true, segments: 24, terms: [
      { id: 'body', op: 'add', shape: { kind: 'box', center: [0, 0, 2], size: [10, 6, 4], round: 1 } },
      { id: 'slot', op: 'subtract', shape: { kind: 'extrude', profile: { rect: { w: 6, h: 1, r: 0.5 } }, axisFrom: [0, 0, 3], axisTo: [0, 0, 5] } },
      { op: 'repeat', spacing: [3, 0, 0], count: [3, 1, 1], combine: 'subtract', terms: [{ id: 'pin', op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 0.6 } }] },
      { op: 'transform', translate: [0, 0, 4], combine: 'add', terms: [{ id: 'knob', op: 'add', shape: { kind: 'roundCone', a: [0, 0, 0], b: [0, 0, 1.5], ra: 1, rb: 0.5 } }] },
    ] });
    const b = box(faces);
    expect(b.size[0]).toBe(10);
    expect(b.size[1]).toBe(6);
    expect(b.size[2]).toBeGreaterThan(5.4);
    expect(auditClosure(faces, { intendClosed: true }).closed).toBe(true);
  });

  kernel('renders deterministically', async () => {
    const a = exactFieldFaces({ exact: true, terms: FLANGE });
    const b = exactFieldFaces({ exact: true, terms: FLANGE });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('reports the kernel state honestly', () => {
    expect(exactKernelReady()).toBe(hasKernel);
  });
});
