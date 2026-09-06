// blender-gate.test.js — the pure half of the Blender pack's machine gate: the node
// inventory read off a real facesToGlb export (z-up bounds through the writer's root
// rotation), the landmark pick, and the comparator's verdicts (green, mirrored, missing).
import { describe, it, expect } from 'vitest';
import { facesToGlb } from './scene-gltf.js';
import { glbNodeInventory, pickLandmark, compareBlenderPack, compareReturnContract } from './blender-gate.js';

const q = (x, y, z, w, d, extra = {}) => ({ corners: [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], fill: '#8899aa', outNormal: [0, 0, 1], ...extra });
// body: x 0..4, spout: x 5..7 (off-centre → the landmark)
const FACES = [
  q(0, 0, 0, 4, 2, { group: 'body' }), q(0, 0, 1, 4, 2, { group: 'body', fill: '#c0ffee' }),
  q(5, 0, 0.5, 2, 2, { group: 'spout' }),
];
const glb = () => facesToGlb({ faces: FACES }, { generator: 't', lit: true }).bytes;

const reportFor = (inv, mutate = (o) => o) => ({
  blender: '5.2.0 LTS',
  objects: [
    { name: 'mojulo', type: 'EMPTY', collections: ['Scene Collection'] },
    ...inv.nodes.map((n) => mutate({ name: n.name, type: 'MESH', bbox_min: [...n.min], bbox_max: [...n.max], triangles: n.triangles, collections: [n.name], vertex_colour: true, materials: [`${n.name}-mat`] })),
    { name: 'MojuloFraming', type: 'CAMERA', collections: ['Scene Collection'] },
  ],
  meshes: inv.nodes.length, triangles: inv.triangles, vertex_colour_meshes: inv.nodes.length, textured_materials: [],
  cameras: 1, collections: inv.nodes.map((n) => n.name), shading: { layout: 'MATERIAL', color_type: 'VERTEX' },
  unit: { system: 'METRIC', scale_length: 1, length_unit: 'ADAPTIVE' }, scene_camera: 'MojuloFraming',
});
const packFor = (inv) => ({ meters_per_unit: 1, bounds: inv.bounds, nodes: inv.nodes, landmark: pickLandmark(inv), collections: Object.fromEntries(inv.nodes.map((n) => [n.name, [n.name]])), glb: { triangles: inv.triangles } });

describe('glbNodeInventory', () => {
  it('reads every mesh node with z-up world bounds + triangles, sorted by name', () => {
    const inv = glbNodeInventory(glb());
    expect(inv.nodes.map((n) => n.name)).toEqual(['body', 'spout']);
    const body = inv.nodes[0]; const spout = inv.nodes[1];
    expect(body.min).toEqual([0, 0, 0]); expect(body.max).toEqual([4, 2, 1]); expect(body.triangles).toBe(4);
    expect(spout.min).toEqual([5, 0, 0.5]); expect(spout.max).toEqual([7, 2, 0.5]); expect(spout.triangles).toBe(2);
    expect(inv.bounds).toEqual({ min: [0, 0, 0], max: [7, 2, 1], size: [7, 2, 1] });
    expect(inv.triangles).toBe(6);
    expect(inv.nodes.every((n) => n.vertexColour)).toBe(true);
  });
  it('is deterministic', () => {
    expect(glbNodeInventory(glb())).toEqual(glbNodeInventory(glb()));
  });
});

describe('pickLandmark', () => {
  it('picks the node farthest off the model centre, with its asymmetry', () => {
    const lm = pickLandmark(glbNodeInventory(glb()));
    expect(lm.name).toBe('spout');
    expect(lm.asymmetry).toBeGreaterThan(0.3);
  });
  it('a lone centred node is a size-only landmark (asymmetry 0)', () => {
    const lm = pickLandmark(glbNodeInventory(facesToGlb({ faces: [q(-1, -1, 0, 2, 2, { group: 'cube' })] }, { generator: 't' }).bytes));
    expect(lm.name).toBe('cube');
    expect(lm.asymmetry).toBe(0);
  });
});

describe('compareBlenderPack', () => {
  it('green when Blender built what the pack declared', () => {
    const inv = glbNodeInventory(glb());
    const r = compareBlenderPack({ pack: packFor(inv), report: reportFor(inv) });
    expect(r.ok).toBe(true);
    for (const [k, c] of Object.entries(r.checks)) expect(c.ok, k).not.toBe(false);
    expect(r.checks.landmark_frame.note).toMatch(/sign-sensitive/);
    expect(r.drift).toEqual([]);
  });
  it('a MIRRORED import fails the landmark and drifts the node — sign-sensitively', () => {
    const inv = glbNodeInventory(glb());
    const mirrored = reportFor(inv, (o) => (o.name === 'spout' ? { ...o, bbox_min: [-7, 0, 0.5], bbox_max: [-5, 2, 0.5] } : o));
    const r = compareBlenderPack({ pack: packFor(inv), report: mirrored });
    expect(r.ok).toBe(false);
    expect(r.checks.landmark_frame.ok).toBe(false);
    expect(r.checks.node_bounds.ok).toBe(false);
    expect(r.drift.map((d) => d.name)).toEqual(['spout']);
    expect(r.checks.objects_present.ok).toBe(true); // it is there, just in the wrong place
  });
  it('a missing collection / a renamed object are named, not swallowed; Blender\'s .001 spelling still matches', () => {
    const inv = glbNodeInventory(glb());
    const rep = reportFor(inv, (o) => (o.name === 'body' ? { ...o, name: 'body.001' } : o));
    rep.collections = ['spout'];
    const r = compareBlenderPack({ pack: packFor(inv), report: rep });
    expect(r.checks.objects_present.ok).toBe(true);
    expect(r.checks.collections.ok).toBe(false);
    expect(r.checks.collections.missing).toEqual(['body']);
    const gone = reportFor(inv); gone.objects = gone.objects.filter((o) => o.name !== 'spout');
    const r2 = compareBlenderPack({ pack: packFor(inv), report: gone });
    expect(r2.checks.objects_present.missing).toEqual(['spout']);
    expect(r2.checks.landmark_frame.ok).toBe(false);
  });
  it('no report ⇒ every check null, ok false (rung 0 never fakes a pass)', () => {
    const inv = glbNodeInventory(glb());
    const r = compareBlenderPack({ pack: packFor(inv), report: null });
    expect(r.ok).toBe(false);
    expect(Object.values(r.checks).every((c) => c.ok === null)).toBe(true);
  });
});

describe('compareReturnContract (B1 — the return half of the greybox contract)', () => {
  const inv = () => glbNodeInventory(glb());
  const packOf = (i) => ({ ...packFor(i), epsilon: 0.05 });
  const shifted = (dx, rename = null) => {
    const faces = FACES.map((f) => (f.group === 'spout' ? { ...f, corners: f.corners.map((c) => [c[0] + dx, c[1], c[2]]), ...(rename ? { group: rename } : {}) } : f));
    return glbNodeInventory(facesToGlb({ faces }, { generator: 't', lit: true }).bytes);
  };
  it('the pack\'s own GLB back: no drift, every check green', () => {
    const r = compareReturnContract({ pack: packOf(inv()), inventory: inv() });
    expect(r.ok).toBe(true);
    expect(r.contract_drift).toEqual([]);
    expect(r.checks.node_inventory).toMatchObject({ expected: 2, got: 2, matched: 2, in_bounds: 2, ok: true });
    expect(r.checks.landmark_frame.ok).toBe(true);
    expect(r.checks.scale.ok).toBe(true);
    expect(r.checks.triangles.ok).toBeNull(); // informational
  });
  it('a moved part is a `moved` row and fails the landmark; the bind still proceeds (advisory)', () => {
    const r = compareReturnContract({ pack: packOf(inv()), inventory: shifted(3) });
    expect(r.ok).toBe(false);
    expect(r.contract_drift).toEqual([expect.objectContaining({ node: 'spout', kind: 'moved' })]);
    expect(r.checks.landmark_frame.ok).toBe(false);
  });
  it('a renamed part shows as missing + unexpected — named, not swallowed', () => {
    const r = compareReturnContract({ pack: packOf(inv()), inventory: shifted(0, 'nozzle') });
    expect(r.contract_drift.map((d) => `${d.kind}:${d.node}`).sort()).toEqual(['missing:spout', 'unexpected:nozzle']);
  });
  it('a unit slip shows in scale, sign-sensitively separate from a move', () => {
    const big = glbNodeInventory(facesToGlb({ faces: FACES.map((f) => ({ ...f, corners: f.corners.map((c) => c.map((v) => v * 100)) })) }, { generator: 't' }).bytes);
    const r = compareReturnContract({ pack: packOf(inv()), inventory: big });
    expect(r.checks.scale.ok).toBe(false);
    expect(r.checks.scale.got.every((v) => v === null || Math.abs(v - 100) < 1e-6)).toBe(true);
  });
});
