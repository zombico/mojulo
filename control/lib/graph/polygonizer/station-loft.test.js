import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileLayered, auditLayered, resolveLayeredDials, mirrorPid, mirrorFaceId, surfaceLocalOffset } from './station-loft.js';
import { lowerLayeredToWorkbench, lowerLayeredManifest } from './station-loft-workbench.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered, packLayeredRig, auditRig, layeredClip, solveTwoBone } from './station-loft-rig.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { layeredFaces, layeredStats, persistedLayeredLedger } from './station-loft-faces.js';
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
const DRAGON = path.resolve(process.cwd(), '../docs/examples/dragon-layered/recipe.json');

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
  it('a hinge with `parts` turns the chain rigidly about one pivot (the pivot read once, the spike rides along)', () => {
    const two = structuredClone(recipe); two.parts.arm = { ...structuredClone(body), stations: body.stations.map((s) => ({ id: s.id, points: Object.fromEntries(Object.entries(s.points).map(([k, p]) => [k, [p[0], p[1] + 2, p[2]]])) })), caps: { back: [0, 1.5, 0.5], tip: [0, 3.5, 0.5] } };
    two.dials.tilt = { ...two.dials.tilt, parts: ['body', 'arm'] }; delete two.dials.tilt.part;
    const P0 = at(compileLayered(two)); const T = at(compileLayered(two, { tilt: 30 })); const d = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
    expect(T['body/st0.bottom']).toEqual(P0['body/st0.bottom']);
    for (const id of ['arm/st1.top', 'arm/tip', 'body/tip', 'spike/apex']) expect(d(T[id], T['body/st0.bottom'])).toBeCloseTo(d(P0[id], P0['body/st0.bottom']), 12);
    expect(d(T['arm/tip'], T['body/tip'])).toBeCloseTo(d(P0['arm/tip'], P0['body/tip']), 12);
    expect(T['arm/tip'][2]).toBeLessThan(P0['arm/tip'][2]);
  });
  it('a chain dial runs its links in order, each pivot riding the links before it (a two-link tail curls twice as far at the tip)', () => {
    const two = structuredClone(recipe); const shifted = (dy) => ({ ...structuredClone(body), stations: body.stations.map((s) => ({ id: s.id, points: Object.fromEntries(Object.entries(s.points).map(([k, p]) => [k, [p[0], p[1] + dy, p[2]]])) })), caps: { back: [0, -0.5 + dy, 0.5], tip: [0, 1.5 + dy, 0.5] } });
    two.parts.seg1 = shifted(2); two.parts.seg2 = shifted(4);
    two.dials.curl = { min: -45, max: 45, rest: 0, op: 'chain', axis: 'x', sign: 1, links: [{ pivot: 'seg1/back', parts: ['seg1', 'seg2'] }, { pivot: 'seg2/back', parts: ['seg2'] }] };
    const P0 = at(compileLayered(two)); const P = at(compileLayered(two, { curl: 20 })); const d = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
    expect(P['seg1/back']).toEqual(P0['seg1/back']); expect(P['body/tip']).toEqual(P0['body/tip']);
    expect(d(P['seg1/tip'], P['seg1/back'])).toBeCloseTo(d(P0['seg1/tip'], P0['seg1/back']), 12); expect(d(P['seg2/tip'], P['seg2/back'])).toBeCloseTo(d(P0['seg2/tip'], P0['seg2/back']), 12);
    const ang = (a, b) => Math.atan2(a[2] - b[2], a[1] - b[1]) * 180 / Math.PI;
    expect(ang(P['seg1/tip'], P['seg1/back']) - ang(P0['seg1/tip'], P0['seg1/back'])).toBeCloseTo(20, 9);
    expect(ang(P['seg2/tip'], P['seg2/back']) - ang(P0['seg2/tip'], P0['seg2/back'])).toBeCloseTo(40, 9);
    expect(d(P['seg2/back'], P['seg1/tip'])).toBeCloseTo(d(P0['seg2/back'], P0['seg1/tip']), 12);   // the joint stays joined
    const bad = structuredClone(two); bad.dials.curl.links[1].pivot = 'seg2/nowhere'; expect(() => compileLayered(bad, { curl: 5 })).toThrow(/pivot/);
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
  it('every lowered loft bakes with positive signed volume whichever way its ring runs (profiles oriented CCW for loft-faces)', () => {
    const tet = (a, b, c) => (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    const signedVolume = (faces) => faces.reduce((s, f) => { const c = f.corners; let v = 0; for (let i = 1; i + 1 < c.length; i++) v += tet(c[0], c[i], c[i + 1]); return s + v; }, 0);   // fan every polygon (quads, closed fans)
    const flipped = structuredClone(recipe); flipped.parts.body.slots = ['top', 'sideL', 'bottom', 'sideR']; delete flipped.parts.spike; flipped.dials.spikeLen.parts = [];   // the same ring, walked the other way round
    for (const r of [recipe, flipped]) { const { spec } = lowerLayeredToWorkbench(compileLayered(r)); for (const loft of spec.lofts) expect(signedVolume(loftToFaces(loft, {})), loft.id).toBeGreaterThan(0); }
    if (existsSync(DRAGON)) { const { spec } = lowerLayeredToWorkbench(compileLayered(JSON.parse(readFileSync(DRAGON, 'utf8')))); for (const loft of spec.lofts) expect(signedVolume(loftToFaces(loft, {})), loft.id).toBeGreaterThan(0); }
  });
  it('a stored manifest lowers to a workbench manifest, dials and all', () => {
    const wb = lowerLayeredManifest({ kind: 'layered', title: 'x', recipe, dials: { width: 1.5 }, units: 'cm' }, compileLayered);
    expect(wb.kind).toBe('workbench'); expect(wb.units).toBe('cm'); expect(wb.lofts).toHaveLength(2); expect(wb.meta.dials.width).toBe(1.5);
  });
});

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

// ── the rig: a stick figure over the vajra core with digitigrade legs, a tail chain and a pinned spike ──
const box = (id, c, r) => ({ id, points: { top: [c[0], c[1], c[2] + r], sideR: [c[0] + r, c[1], c[2]], bottom: [c[0], c[1], c[2] - r], sideL: [c[0] - r, c[1], c[2]] } });
const seg = (A, B, r, bind) => ({ layer: 1, closure: 'closed', slots: ['top', 'sideR', 'bottom', 'sideL'], stations: [box('st0', A, r), box('st1', [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2], r), box('st2', B, r)], caps: { back: [A[0], A[1] - 0.01, A[2]], tip: [B[0], B[1] + 0.01, B[2]] }, bind });
const J = { pelvisHub: [0, 0, 1], navel: [0, 0, 1.3], neckHub: [0, 0, 1.6], headBase: [0, 0, 1.7], headTop: [0, 0.2, 1.9], shoulderL: [-0.3, 0, 1.55], shoulderR: [0.3, 0, 1.55], elbowL: [-0.35, 0, 1.2], elbowR: [0.35, 0, 1.2], wristL: [-0.35, 0.05, 0.9], wristR: [0.35, 0.05, 0.9], hipL: [-0.2, 0, 1], hipR: [0.2, 0, 1], kneeL: [-0.2, 0.2, 0.6], kneeR: [0.2, 0.2, 0.6], ankleL: [-0.2, -0.1, 0.3], ankleR: [0.2, -0.1, 0.3], toeBaseL: [-0.2, 0.15, 0.05], toeBaseR: [0.2, 0.15, 0.05], toeTipL: [-0.2, 0.45, 0.03], toeTipR: [0.2, 0.45, 0.03], tail1: [0, -0.5, 0.9], tail2: [0, -0.9, 0.8] };
const stickRig = {
  joints: Object.fromEntries(Object.entries(J).map(([k, v]) => [k, { at: v, ...(k.startsWith('tail') ? { rides: 'pelvis' } : {}) }])),
  bones: [{ id: 'pelvis', head: 'pelvisHub', tail: 'navel', aux: ['hipL', 'hipR'] }, { id: 'torso', head: 'navel', tail: 'neckHub' }, { id: 'head', head: 'headBase', tail: 'headTop' },
    ...['R', 'L'].flatMap((S) => [{ id: `thigh${S}`, head: `hip${S}`, tail: `knee${S}` }, { id: `shin${S}`, head: `knee${S}`, tail: `ankle${S}` }, { id: `meta${S}`, head: `ankle${S}`, tail: `toeBase${S}` }, { id: `toes${S}`, head: `toeBase${S}`, tail: `toeTip${S}` }]),
    { id: 'tail0', head: 'pelvisHub', tail: 'tail1' }, { id: 'tail1', head: 'tail1', tail: 'tail2' }],
  chains: { tail: { axis: 'x', sign: -1, links: [{ pivot: 'tail1', joints: ['tail2'] }] } },
  legs: Object.fromEntries(['L', 'R'].map((S) => [S, { hip: `hip${S}`, knee: `knee${S}`, hock: `ankle${S}`, toeBase: `toeBase${S}`, toeTip: `toeTip${S}`, pole: [0, 1, 0] }])),
};
const stick = { frame: {}, rig: stickRig, dials: {}, parts: {
  torso: seg([0, 0, 1], [0, 0, 1.6], 0.15, { bone: 'torso', blend: { st0: { pelvis: 1 }, back: { pelvis: 1 } } }),
  thighR: seg(J.hipR, J.kneeR, 0.08, { bone: 'thighR', blend: { st2: { thighR: 0.5, shinR: 0.5 }, tip: { shinR: 1 } } }), shinR: seg(J.kneeR, J.ankleR, 0.06, 'shinR'), metaR: seg(J.ankleR, J.toeBaseR, 0.05, 'metaR'), toesR: seg(J.toeBaseR, J.toeTipR, 0.05, 'toesR'),
  thighL: seg(J.hipL, J.kneeL, 0.08, 'thighL'), shinL: seg(J.kneeL, J.ankleL, 0.06, 'shinL'), metaL: seg(J.ankleL, J.toeBaseL, 0.05, 'metaL'), toesL: seg(J.toeBaseL, J.toeTipL, 0.05, 'toesL'),
  tail0: seg(J.pelvisHub, J.tail1, 0.06, 'tail0'), tail1: seg(J.tail1, J.tail2, 0.04, 'tail1'),
  spike: { layer: 2, closure: 'closed', pin: { parent: 'toesR', face: 'toesR/st1-st2.k0.a', weights: [1 / 3, 1 / 3, 1 / 3], tangentEdge: ['toesR/st1.top', 'toesR/st1.sideR'], handedness: 1 }, offsets: { b0: [0.02, 0, 0], b1: [0, 0.02, 0], b2: [-0.02, 0, 0], apex: [0, 0, 0.1] }, faces: { base: ['b0', 'b2', 'b1'], s0: ['b0', 'b1', 'apex'], s1: ['b1', 'b2', 'apex'], s2: ['b2', 'b0', 'apex'] } },
} };
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('station-loft-rig — bindings, posing, skinning, packing', () => {
  const mesh = compileLayered(stick); const R = validateRig(stickRig); const skin = bindLayered(stick && mesh, stick, R);
  it('binds by declaration: rigid parts, blended overshoot rings, a pinned detail inherits its face; rest skinning is identity', () => {
    const at = (part, st) => { const i = mesh.provenance.findIndex((p) => p.part === part && (st ? p.station === st : true)); return [skin.joints[i], skin.weights[i]]; };
    expect(at('shinR')[0][0]).toBe(R.boneIndex.shinR); expect(at('shinR')[1]).toEqual([1, 0, 0, 0]);
    const [j, w] = at('thighR', 'st2'); expect(new Set([j[0], j[1]])).toEqual(new Set([R.boneIndex.thighR, R.boneIndex.shinR])); expect(w[0]).toBeCloseTo(0.5, 12); expect(w[1]).toBeCloseTo(0.5, 12);
    expect(at('spike')[0][0]).toBe(R.boneIndex.toesR); expect(at('spike')[1][0]).toBeCloseTo(1, 12);
    const a = auditRig(mesh, skin, R); expect(a.badWeights).toBe(0); expect(a.restIdentity).toBeLessThan(1e-12); expect(a.blended).toBeGreaterThan(0);
  });
  it('refuses: a missing bind, an unknown bone, weights that do not sum to one, a bind on a pinned part, a core joint that rides, cyclic rides', () => {
    const noBind = structuredClone(stick); delete noBind.parts.shinL.bind; expect(() => bindLayered(compileLayered(noBind), noBind, R)).toThrow(/no bind/);
    const unknown = structuredClone(stick); unknown.parts.shinL.bind = 'femurL'; expect(() => bindLayered(compileLayered(unknown), unknown, R)).toThrow(/unknown bone/);
    const bad = structuredClone(stick); bad.parts.thighR.bind.blend.st2 = { thighR: 0.7, shinR: 0.7 }; expect(() => bindLayered(compileLayered(bad), bad, R)).toThrow(/summing to 1/);
    const pinned = structuredClone(stick); pinned.parts.spike.bind = 'toesR'; expect(() => bindLayered(compileLayered(pinned), pinned, R)).toThrow(/inherits its pin face/);
    const coreRides = structuredClone(stickRig); coreRides.joints.hipL.rides = 'pelvis'; expect(() => validateRig(coreRides)).toThrow(/cannot ride/);
    const cyc = structuredClone(stickRig); cyc.joints.tail1.rides = 'tail1'; expect(() => validateRig(cyc)).toThrow(/cyclic|dangling/);
  });
  it('poses: planted toes stay put through a crouch and a heel change, bone lengths hold, frames are orthonormal, the tail chain rides the pelvis and curls', () => {
    const rest = R.joints; const poses = [{}, { crouch: 0.5 }, { crouch: 0.3, heelR: 20, heelL: -10 }, { armL: 'forward', spine: { curl: 0.5 }, tail: 30 }];
    const a = auditRig(mesh, skin, R, poses); expect(a.maxPlantedDrift).toBe(0); expect(a.maxLengthError).toBeLessThan(1e-9); expect(a.maxOrthoError).toBeLessThan(1e-9);
    const c = rigNodesAt(R, { crouch: 0.5 }).nodes; expect(c.pelvisHub[2]).toBeLessThan(rest.pelvisHub[2] - 0.1); expect(c.toeBaseR).toEqual(rest.toeBaseR); expect(dist3(c.kneeR, c.hipR)).toBeCloseTo(dist3(rest.kneeR, rest.hipR), 12); expect(dist3(c.ankleR, c.kneeR)).toBeCloseTo(dist3(rest.ankleR, rest.kneeR), 12); expect(dist3(c.toeBaseR, c.ankleR)).toBeCloseTo(dist3(rest.toeBaseR, rest.ankleR), 12);
    expect(c.kneeR[1]).toBeGreaterThan(rest.kneeR[1]);   // the knee bends forward (the pole)
    const t = rigNodesAt(R, { tail: 30 }).nodes; expect(t.tail1).toEqual(rest.tail1); expect(t.tail2[2]).toBeGreaterThan(rest.tail2[2]); expect(dist3(t.tail2, t.tail1)).toBeCloseTo(dist3(rest.tail2, rest.tail1), 12);
    const s = rigNodesAt(R, { spine: { curl: 0.6 } }).nodes; expect(dist3(s.tail1, s.pelvisHub)).toBeCloseTo(dist3(rest.tail1, rest.pelvisHub), 9);   // the tail rides the pelvis bone, whatever the spine does
  });
  it('an unreachable planted toe is rejected with the numbers; reach: clamp reports the metatarsal error; airborne releases the contact', () => {
    expect(() => rigNodesAt(R, { heelR: 180 })).toThrow(/cannot reach.*excess/);
    const clamp = validateRig({ ...stickRig, reach: 'clamp' }); const { nodes, report } = rigNodesAt(clamp, { heelR: 180 }); expect(report.legs.R.reach).toBe('clamped'); expect(report.legs.R.metaError).toBeGreaterThan(0.1); expect(nodes.toeBaseR).toEqual(R.joints.toeBaseR);
    const air = rigNodesAt(R, { support: 'none', lift: 0.3, legR: 'forward' }); expect(air.report.legs.R.planted).toBe(false); expect(air.nodes.toeBaseR[2]).toBeGreaterThan(R.joints.toeBaseR[2] + 0.1);
    expect(solveTwoBone([0, 0, 0], [0, 0, 3], 1, 1, [0, 1, 0]).ok).toBe(false);
  });
  it('a clip blends keyposes (words resolved, channels blended, strings held) and packs to a rig figure with authored weights that the skinned GLB carries', () => {
    const clip = layeredClip([{ tail: 0 }, { crouch: 0.6, tail: 20, support: 'both' }], R); expect(clip(0).tail).toBe(0); expect(clip(0.25).tail).toBeCloseTo(10, 9); expect(clip(0.25).crouch).toBeCloseTo(0.3, 9); expect(clip(0.5).tail).toBeCloseTo(20, 9);
    const fig = packLayeredRig(mesh, skin, R, { clips: { bob: [{}, { crouch: 0.5, tail: 15 }] }, keys: 6 }); expect(fig.rig).toBe(true); expect(fig.bones).toHaveLength(R.bones.length); expect(fig.clips.bob.k).toBe(6); expect(fig.clips.bob.b).toHaveLength(6 * R.bones.length * 7);
    expect(fig.parts.filter(Boolean).every((p) => typeof p.jnt === 'string' && typeof p.wgt === 'string')).toBe(true);
    expect(packLayeredRig(mesh, skin, R, { clips: { bob: [{}, { crouch: 0.5, tail: 15 }] }, keys: 6 })).toEqual(fig);   // deterministic
    const glb = facesToGlb({ faces: [], figures: { stick: fig } }, { generator: 't', clips: '_all', skinned: true }).bytes;
    const jsonLen = glb.readUInt32LE(12); const j = JSON.parse(glb.subarray(20, 20 + jsonLen).toString()); const bin = glb.subarray(20 + jsonLen + 8);
    const acc = (i) => { const a = j.accessors[i]; const bv = j.bufferViews[a.bufferView]; const off = (bv.byteOffset || 0) + (a.byteOffset || 0); const n = { 5126: 4, 5123: 2, 5121: 1 }[a.componentType]; const comps = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type]; const rows = []; for (let k = 0; k < a.count; k++) { const r = []; for (let c = 0; c < comps; c++) { const p = off + (k * comps + c) * n; r.push(a.componentType === 5126 ? bin.readFloatLE(p) : a.componentType === 5123 ? bin.readUInt16LE(p) : bin.readUInt8(p)); } rows.push(r); } return rows; };
    const skinJ = j.skins[0]; const prim = j.meshes.find((m) => m.name === 'stick:skinned').primitives[0];
    const POS = acc(prim.attributes.POSITION), JNT = acc(prim.attributes.JOINTS_0), WGT = acc(prim.attributes.WEIGHTS_0), IBM = acc(skinJ.inverseBindMatrices);
    expect(WGT.every((w) => Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-5 && w.every((x) => x >= 0))).toBe(true); expect(JNT.every((r) => r.every((x) => x < skinJ.joints.length))).toBe(true);
    // authored, not derived: a blended overshoot vertex carries exactly the declared half-and-half
    expect(WGT.some((w) => Math.abs(w[0] - 0.5) < 1e-6 && Math.abs(w[1] - 0.5) < 1e-6)).toBe(true);
    skinJ.joints.forEach((ni, bi) => { const t = j.nodes[ni].translation; for (let c = 0; c < 3; c++) expect(Math.abs(t[c] + IBM[bi][12 + c])).toBeLessThan(1e-6); });   // rest skinning identity
    // the engine's skin at key 3 equals the JS skin at that phase
    const anim = j.animations[0]; const rot = new Map(), tr = new Map(); for (const ch of anim.channels) { const s = anim.samplers[ch.sampler]; (ch.target.path === 'rotation' ? rot : tr).set(ch.target.node, acc(s.output)); }
    const qrot = (q, v) => { const [qx, qy, qz, qw] = q; const [vx, vy, vz] = v; const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx); return [vx + qw * tx + (qy * tz - qz * ty), vy + qw * ty + (qz * tx - qx * tz), vz + qw * tz + (qx * ty - qy * tx)]; };
    const k = 3; const engine = POS.map((v, i) => { const out = [0, 0, 0]; for (let c = 0; c < 4; c++) { const w = WGT[i][c]; if (w <= 0) continue; const bi = JNT[i][c]; const ni = skinJ.joints[bi]; const q = rot.get(ni)[k], t = tr.get(ni)[k]; const local = [v[0] + IBM[bi][12], v[1] + IBM[bi][13], v[2] + IBM[bi][14]]; const p = qrot(q, local); for (let c2 = 0; c2 < 3; c2++) out[c2] += w * (p[c2] + t[c2]); } return out; });
    const phase = k / 6; const pose = layeredClip([{}, { crouch: 0.5, tail: 15 }], R)(phase); const js = skinLayered(mesh, skin, boneFrames(R, R.joints, rigNodesAt(R, pose).nodes));
    // the GLB's vertices are a per-corner soup grouped per bone; match each engine vertex to the nearest JS rest vertex, then compare the posed positions
    const restIdx = POS.map((p) => { let best = 0, bd = Infinity; mesh.vertices.forEach((v, i) => { const d = dist3(p, v); if (d < bd) { bd = d; best = i; } }); return best; });
    let maxErr = 0; engine.forEach((p, i) => { maxErr = Math.max(maxErr, dist3(p, js[restIdx[i]])); }); expect(maxErr).toBeLessThan(2e-3);   // the packed clip rounds q/head to 1e-4
  });
});

describe('station-loft-faces — the compiled mesh as studio faces', () => {
  it('every non-degenerate face becomes a shaded studio face, seated on the grid, coloured by palette group then part tint, grouped by part or by one name', () => {
    const m = compileLayered(recipe); const faces = layeredFaces(m, { ...recipe, palette: { Back: '#ff0000' } });
    expect(faces).toHaveLength(m.faces.length); let minZ = Infinity; for (const f of faces) for (const c of f.corners) minZ = Math.min(minZ, c[2]); expect(Math.abs(minZ)).toBeLessThan(1e-9);
    expect(new Set(faces.map((f) => f.group))).toEqual(new Set(['body', 'spike']));
    const back = faces.filter((f, i) => m.groups[i] === 'Back'); expect(back.length).toBeGreaterThan(0); for (const f of back) expect(f.fill.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    expect(layeredFaces(m, recipe, { group: 'all' }).every((f) => f.group === 'all')).toBe(true);
    expect(layeredFaces(m, recipe, { seat: false })[0].corners[0][2]).toBeCloseTo(m.vertices[m.faces[0][0]][2], 12);
    expect(layeredFaces(m, recipe)).toEqual(layeredFaces(m, recipe));
  });
  it('stats: per-part sizes, closure, bounds and a persistable ledger', () => {
    const m = compileLayered(recipe); const s = layeredStats(m, recipe, { units: 'cm' });
    expect(s.units).toBe('cm'); expect(s.parts.map((p) => p.id).sort()).toEqual(['body', 'spike']); expect(s.closed).toBe(true); expect(s.faces).toBe(m.faces.length); expect(s.size.h).toBeGreaterThan(0);
    expect(persistedLayeredLedger(s.ledger)).toEqual({ recipe_bytes: expect.any(Number), faces: m.faces.length, closed: true });
  });
});
