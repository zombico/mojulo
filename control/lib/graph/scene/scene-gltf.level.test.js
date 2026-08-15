// interchange.plan.md I4 — level-as-layout (semantic GLB): the default-on enrichment of
// facesToGlb. Cameras from the payload's camera list become glTF perspective cameras on
// posed nodes; entities become named placement nodes (reusing I1's rig wrapper where the
// body is a rig this export baked); spawn / colliders / game-contract summary land as
// scene-level `moj:` extras. Geometry-only payloads gain zero semantic bytes, and the I1
// invariant (clips absent ⇒ no rig/animation content) holds under the enriched output.

import { describe, expect, it } from 'vitest';

import { facesToGlb } from './scene-gltf.js';
import { glbToFaces } from './scene-gltf-read.js';
import { levelCameras, levelSceneExtras, lookAtRotation } from './scene-gltf-level.js';
import { bakeRigFigure } from '../figures/rig-bake.js';

function quad(fill = '#808080', extra = {}) {
  return {
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
    fill,
    ...extra,
  };
}

function parseGlb(buf) {
  expect(buf.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  expect(buf.readUInt32LE(4)).toBe(2);
  expect(buf.readUInt32LE(8)).toBe(buf.length);
  const jsonLen = buf.readUInt32LE(12);
  expect(buf.readUInt32LE(16)).toBe(0x4e4f534a); // 'JSON'
  return { json: JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8')) };
}

// Rotate v by quaternion q = [x,y,z,w]: v' = v + 2·q×(q×v + w·v).
function rotate(q, v) {
  const [x, y, z, w] = q;
  const cx = y * v[2] - z * v[1] + w * v[0];
  const cy = z * v[0] - x * v[2] + w * v[1];
  const cz = x * v[1] - y * v[0] + w * v[2];
  return [
    v[0] + 2 * (y * cz - z * cy),
    v[1] + 2 * (z * cx - x * cz),
    v[2] + 2 * (x * cy - y * cx),
  ];
}

// The same tiny 2-bone synthetic rig scene-gltf.rig.test.js bakes.
const TEST_BONES = [
  { id: 'root', head: 'a', tail: 'b' },
  { id: 'limb', head: 'b', tail: 'c' },
];
function makeTestRig(keys = 4) {
  const nodesAt = (dof = {}) => {
    const sw = dof.swing || 0;
    return {
      a: { x: 0, y: 0, z: 0 },
      b: { x: 0, y: 0, z: 1 },
      c: { x: 0, y: Math.sin(sw), z: 1 + Math.cos(sw) },
    };
  };
  const facesAt = () => [
    { corners: [[-0.1, 0, 0], [0.1, 0, 0], [0.1, 0, 1], [-0.1, 0, 1]], fill: '#808080' },
    { corners: [[-0.1, 0, 1], [0.1, 0, 1], [0.1, 0, 2], [-0.1, 0, 2]], fill: '#4080c0' },
  ];
  const wave = (p) => ({ swing: Math.sin(p * Math.PI * 2) * 0.6 });
  return bakeRigFigure({ nodesAt, facesAt, clips: { wave }, keys, bones: TEST_BONES });
}

const CAMERA = {
  name: 'hero shot',
  worldFraming: { cameraPosition: [10, -10, 8], lookAt: [0, 0, 1], horizontalFov: 55 },
};

describe('I4 cameras — payload camera list → glTF perspective cameras', () => {
  const payload = { faces: [quad()], cameras: [CAMERA, { name: 'broken' }], viewBox: { width: 1120, height: 780 } };
  const out = facesToGlb(payload, { generator: 'test' });
  const { json } = parseGlb(out.bytes);

  it('emits one camera per valid worldFraming entry, skipping malformed ones', () => {
    expect(out.cameraCount).toBe(1);
    expect(json.cameras).toHaveLength(1);
    const cam = json.cameras[0];
    expect(cam.type).toBe('perspective');
    expect(cam.name).toBe('hero shot');
  });

  it('yfov is the /world horizontal→vertical solve, in radians, with sane near/far', () => {
    const p = json.cameras[0].perspective;
    // verticalFov(55, 1120/780) ≈ 39.86° → radians
    const expected = 2 * Math.atan(Math.tan((55 * Math.PI) / 360) / (1120 / 780));
    expect(p.yfov).toBeCloseTo(expected, 6);
    expect(p.yfov).toBeGreaterThan(0);
    expect(p.yfov).toBeLessThan(Math.PI);
    expect(p.aspectRatio).toBeCloseTo(1120 / 780, 6);
    expect(p.znear).toBe(0.1);
    expect(p.zfar).toBe(8000);
  });

  it('the camera node sits at the eye, under the y-up root, looking at the target', () => {
    const root = json.nodes[json.scenes[0].nodes[0]];
    const camNode = json.nodes.find((n) => n.camera === 0);
    expect(camNode.name).toBe('cam:hero shot');
    expect(root.children).toContain(json.nodes.indexOf(camNode));
    expect(camNode.translation).toEqual([10, -10, 8]);
    // glTF cameras look down local -Z: the rotated -Z must point eye → target.
    const fwd = rotate(camNode.rotation, [0, 0, -1]);
    const d = [0 - 10, 0 - (-10), 1 - 8];
    const len = Math.hypot(...d);
    for (let k = 0; k < 3; k++) expect(fwd[k]).toBeCloseTo(d[k] / len, 6);
    // and the camera's local +Y stays sky-ward (no roll) in the z-up frame
    const up = rotate(camNode.rotation, [0, 1, 0]);
    expect(up[2]).toBeGreaterThan(0.5);
  });

  it('a straight-down camera still poses (up-vector fallback)', () => {
    const q = lookAtRotation([0, 0, 10], [0, 0, 0]);
    const fwd = rotate(q, [0, 0, -1]);
    expect(fwd[0]).toBeCloseTo(0, 6);
    expect(fwd[1]).toBeCloseTo(0, 6);
    expect(fwd[2]).toBeCloseTo(-1, 6);
  });

  it('levelCameras is deterministic', () => {
    expect(JSON.stringify(levelCameras(payload))).toBe(JSON.stringify(levelCameras(payload)));
  });
});

describe('I4 entity nodes — named placements with moj: extras', () => {
  it('a non-rig entity becomes an empty TRS node carrying id/rule/body extras', () => {
    const payload = {
      faces: [quad()],
      entities: [{ id: 'hero', transform: { pos: [3, 4, 0], heading: 1.2 }, rule: { type: 'platform' }, body: { figure: 'hero' } }],
      figureSources: { hero: 'unitRef:sk_suit_1' },
    };
    const out = facesToGlb(payload, { generator: 'test' });
    expect(out.entityCount).toBe(1);
    const { json } = parseGlb(out.bytes);
    const node = json.nodes.find((n) => n.name === 'entity:hero');
    expect(node).toBeDefined();
    expect(node.mesh).toBeUndefined(); // an empty TRS node, not geometry
    expect(node.translation).toEqual([3, 4, 0]);
    expect(node.rotation[2]).toBeCloseTo(Math.sin(0.6), 6); // z-rotation by heading
    expect(node.rotation[3]).toBeCloseTo(Math.cos(0.6), 6);
    expect(node.extras).toEqual({ 'moj:entity': 'hero', 'moj:rule': 'platform', 'moj:body': 'unitRef:sk_suit_1' });
    const root = json.nodes[json.scenes[0].nodes[0]];
    expect(root.children).toContain(json.nodes.indexOf(node));
  });

  it('on the clips path an entity whose body is the exported rig REUSES the I1 wrapper node', () => {
    const rig = makeTestRig();
    const payload = {
      faces: [quad()],
      figures: { guy: rig },
      entities: [
        { id: 'p1', transform: { pos: [5, 6, 0], heading: 0.4 }, rule: { type: 'platform' }, body: { figure: 'guy' } },
        { id: 'p2', transform: { pos: [8, 0, 0] }, rule: { type: 'platform' }, body: { figure: 'guy' } },
      ],
    };
    const out = facesToGlb(payload, { generator: 'test', clips: ['wave'] });
    const { json } = parseGlb(out.bytes);
    const wrap = json.nodes.find((n) => n.name === 'guy');
    // p1 claimed the wrapper: placement TRS + extras live ON it, no separate entity:p1 node
    expect(json.nodes.find((n) => n.name === 'entity:p1')).toBeUndefined();
    expect(wrap.translation).toEqual([5, 6, 0]);
    const yaw = 0.4 - Math.PI / 2; // heading + the runtime's default yawOffset (figure faces +y)
    expect(wrap.rotation[2]).toBeCloseTo(Math.sin(yaw / 2), 6);
    expect(wrap.rotation[3]).toBeCloseTo(Math.cos(yaw / 2), 6);
    expect(wrap.extras['moj:entity']).toBe('p1');
    expect(wrap.extras['moj:body']).toBe('figure:guy');
    // p2 shares the figure — the wrapper is claimed, so it gets its own empty node
    const p2 = json.nodes.find((n) => n.name === 'entity:p2');
    expect(p2).toBeDefined();
    expect(p2.translation).toEqual([8, 0, 0]);
    expect(p2.extras['moj:entity']).toBe('p2');
  });

  it('on the static path (clips absent) the same entity gets an empty node — no rig content (I1 invariant)', () => {
    const rig = makeTestRig();
    const payload = {
      faces: [quad()],
      figures: { guy: rig },
      entities: [{ id: 'p1', transform: { pos: [5, 6, 0], heading: 0.4 }, rule: { type: 'platform' }, body: { figure: 'guy' } }],
    };
    const out = facesToGlb(payload, { generator: 'test' });
    const { json } = parseGlb(out.bytes);
    // clips absent ⇒ zero rig/animation content, even under enrichment
    expect(json.animations).toBeUndefined();
    expect(json.nodes.find((n) => n.name === 'guy')).toBeUndefined();
    expect(out.animationCount).toBeUndefined();
    // and the enriched export stays byte-identical with the rig present vs stripped
    const { figures, ...bare } = payload;
    expect(out.bytes.equals(facesToGlb(bare, { generator: 'test' }).bytes)).toBe(true);
    // the placement itself still rides as the empty node
    expect(json.nodes.find((n) => n.name === 'entity:p1')).toBeDefined();
  });
});

describe('I4 scene extras — spawn, colliders, game contract', () => {
  const GAME = {
    levelRef: 'lv-arena',
    consumes: [{ slice: 'roster', pick: { max: 3 } }],
    produces: { results: ['success', 'fail'], events: [{ type: 'grant', slice: 'kills' }] },
    presets: { default: {} },
  };

  it('walk.spawn wins; colliders and the game summary land beside it', () => {
    const payload = {
      faces: [quad()],
      walk: { spawn: [1, 2, 3] },
      entities: [{ id: 'e', transform: { pos: [9, 9, 0] }, rule: { type: 'platform' }, body: {} }],
      colliders: [{ min: [0, 0, 0], max: [4, 4, 10] }, { bad: true }],
      game: GAME,
    };
    const { json } = parseGlb(facesToGlb(payload, { generator: 'test' }).bytes);
    const ex = json.scenes[0].extras;
    expect(ex['moj:spawn']).toEqual([1, 2, 3]);
    expect(ex['moj:colliders']).toEqual([{ min: [0, 0, 0], max: [4, 4, 10] }]);
    expect(ex['moj:game']).toEqual({
      levelRef: 'lv-arena',
      results: ['success', 'fail'],
      events: ['grant→kills'],
      consumes: ['roster(pick 3)'],
    });
  });

  it('with no walk spawn, the piloted entity seats the spawn (pilot > pilotable > first)', () => {
    const ents = [
      { id: 'a', transform: { pos: [1, 0, 0] }, rule: { type: 'platform' }, body: {} },
      { id: 'b', pilotable: true, transform: { pos: [2, 0, 0] }, rule: { type: 'platform' }, body: {} },
      { id: 'c', pilotable: true, transform: { pos: [3, 0, 0] }, rule: { type: 'platform' }, body: {} },
    ];
    expect(levelSceneExtras({ entities: ents })['moj:spawn']).toEqual([2, 0, 0]);
    expect(levelSceneExtras({ entities: ents, pilot: 'c' })['moj:spawn']).toEqual([3, 0, 0]);
    expect(levelSceneExtras({ entities: [ents[0]] })['moj:spawn']).toEqual([1, 0, 0]);
  });

  it('a geometry-only payload gains no cameras, no extras, no semantic nodes', () => {
    const { json } = parseGlb(facesToGlb({ faces: [quad()] }, { generator: 'test' }).bytes);
    expect(json.cameras).toBeUndefined();
    expect(json.scenes[0].extras).toBeUndefined();
    expect(json.nodes.filter((n) => n.name && n.name.startsWith('entity:'))).toHaveLength(0);
  });
});

describe('I4 reader compatibility — the I3 round trip survives enrichment', () => {
  it('glbToFaces skips camera + empty entity nodes and extras, decoding only geometry', () => {
    const payload = {
      faces: [quad('#804020')],
      cameras: [CAMERA],
      entities: [{ id: 'hero', transform: { pos: [3, 4, 0], heading: 1.2 }, rule: { type: 'platform' }, body: {} }],
      colliders: [{ min: [0, 0, 0], max: [1, 1, 1] }],
      game: { levelRef: 'lv', produces: { events: [] } },
    };
    const out = facesToGlb(payload, { generator: 'test' });
    const faces = glbToFaces(out.bytes, { group: 'reimport' });
    expect(faces).toHaveLength(2); // the quad's two triangles — nothing from the semantic nodes
    expect(faces.every((f) => f.fill === '#804020' && f.group === 'reimport')).toBe(true);
    // corners round-trip to the z-up frame exactly (float32)
    const has = (p) => faces.some((f) => f.corners.some((c) => c.every((v, k) => Math.abs(v - p[k]) < 1e-6)));
    expect(has([0, 0, 0])).toBe(true);
    expect(has([1, 1, 0])).toBe(true);
  });
});
