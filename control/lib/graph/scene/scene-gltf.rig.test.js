// scene-gltf rig export (interchange.plan.md I1) — packed rig figures baked into glTF
// animation channels. The rigs are rigid parts under FK (rig-bake.js), so each bone part
// becomes a node whose TRS carries the pose: translation = head_k, rotation = q_k, mesh
// re-expressed bone-local (vertices − restHead). No skins. Clips map to one animation each,
// LINEAR samplers over a shared input-times accessor at 1 second per cycle.

import { describe, expect, it } from 'vitest';

import { facesToGlb } from './scene-gltf.js';
import { bakeRigFigure, bakeProtoformRig, packRigMesh } from '../figures/rig-bake.js';
import { faceListToMesh } from '../figures/face-mesh.js';

// A minimal unit quad on the ground plane (z=0) — same fixture as scene-gltf.test.js.
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

// Parse a GLB Buffer back into { json, bin } for assertions.
function parseGlb(buf) {
  expect(buf.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  expect(buf.readUInt32LE(4)).toBe(2);
  expect(buf.readUInt32LE(8)).toBe(buf.length);
  const jsonLen = buf.readUInt32LE(12);
  expect(buf.readUInt32LE(16)).toBe(0x4e4f534a); // 'JSON'
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  const binChunkOffset = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binChunkOffset);
  expect(buf.readUInt32LE(binChunkOffset + 4)).toBe(0x004e4942); // 'BIN\0'
  const bin = buf.slice(binChunkOffset + 8, binChunkOffset + 8 + binLen);
  return { json, bin };
}

// Read an accessor's data out of the BIN chunk as its typed array.
function accessorData(json, bin, idx) {
  const acc = json.accessors[idx];
  const view = json.bufferViews[acc.bufferView];
  const Ctor = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[acc.componentType];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
  const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const byteLen = acc.count * comps * Ctor.BYTES_PER_ELEMENT;
  const copy = new Uint8Array(byteLen);
  copy.set(bin.slice(start, start + byteLen));
  return new Ctor(copy.buffer);
}

// ── a tiny 2-bone synthetic rig (fast, deterministic, no content pack) ───────
const TEST_BONES = [
  { id: 'root', head: 'a', tail: 'b' },
  { id: 'limb', head: 'b', tail: 'c' },
];

function makeTestRig(keys = 4) {
  // rest: a spine a(0,0,0) → b(0,0,1) with a limb b → c(0,0,2); the wave clip tips c over.
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

describe('facesToGlb rig export — char safety (clips absent)', () => {
  it('a payload carrying rig figures exports byte-identically to one without when clips is absent', () => {
    const rig = makeTestRig();
    const plain = facesToGlb({ faces: [quad()] });
    const withFig = facesToGlb({ faces: [quad()], figures: { guy: rig } });
    expect(withFig.bytes.equals(plain.bytes)).toBe(true);
    // and the result object gains no new fields
    expect(withFig.animationCount).toBeUndefined();
    expect(withFig.animatedFigures).toBeUndefined();
  });

  it('an empty clips array is treated as absent (no rig bytes)', () => {
    const rig = makeTestRig();
    const plain = facesToGlb({ faces: [quad()] });
    const out = facesToGlb({ faces: [quad()], figures: { guy: rig } }, { clips: [] });
    expect(out.bytes.equals(plain.bytes)).toBe(true);
  });
});

describe('facesToGlb rig export — nodes and geometry', () => {
  const rig = makeTestRig();
  const out = facesToGlb({ faces: [quad()], figures: { guy: rig } }, { clips: ['wave'] });
  const { json, bin } = parseGlb(out.bytes);

  it('adds one wrapper node per rig figure beside the existing group nodes', () => {
    expect(out.nodeCount).toBe(2); // 'static' group + 'guy' wrapper
    expect(out.animationCount).toBe(1);
    expect(out.animatedFigures).toEqual(['guy']);
    const root = json.nodes[json.scenes[0].nodes[0]];
    expect(root.children).toHaveLength(2);
  });

  it('emits one bone-local mesh node per boned part, at translation = restHead', () => {
    const wrap = json.nodes.find((n) => n.name === 'guy');
    expect(wrap.children).toHaveLength(2);
    const names = wrap.children.map((i) => json.nodes[i].name);
    expect(names).toEqual(['guy:root', 'guy:limb']);
    const limb = json.nodes[wrap.children[1]];
    expect(limb.translation).toEqual([0, 0, 1]); // restHead of the limb bone
    // vertices are re-expressed relative to the rest head: the limb quad spans z 1..2 in the
    // world, so bone-local it spans z 0..1.
    const pos = json.accessors[json.meshes[limb.mesh].primitives[0].attributes.POSITION];
    expect(pos.min[2]).toBeCloseTo(0, 5);
    expect(pos.max[2]).toBeCloseTo(1, 5);
  });

  it('bone meshes carry COLOR_0 and the shared unlit figure material', () => {
    const wrap = json.nodes.find((n) => n.name === 'guy');
    const mats = new Set();
    for (const i of wrap.children) {
      const prim = json.meshes[json.nodes[i].mesh].primitives[0];
      expect(prim.attributes.COLOR_0).toBeDefined();
      mats.add(prim.material);
    }
    expect(mats.size).toBe(1);
    const mat = json.materials[[...mats][0]];
    expect(mat.name).toBe('fig:guy');
    expect(mat.extensions.KHR_materials_unlit).toBeDefined();
  });

  it('every bufferView and accessor is 4-byte aligned', () => {
    for (const v of json.bufferViews) expect((v.byteOffset || 0) % 4).toBe(0);
    for (const a of json.accessors) expect((a.byteOffset || 0) % 4).toBe(0);
  });
});

describe('facesToGlb rig export — animation channels', () => {
  const K = 4;
  const rig = makeTestRig(K);
  const out = facesToGlb({ faces: [quad()], figures: { guy: rig } }, { clips: ['wave'] });
  const { json, bin } = parseGlb(out.bytes);
  const anim = json.animations[0];

  it('one animation per clip, one rotation + one translation channel per boned bone', () => {
    expect(json.animations).toHaveLength(1);
    expect(anim.name).toBe('guy:wave');
    expect(anim.channels).toHaveLength(4); // 2 bones × (rotation + translation)
    expect(anim.samplers).toHaveLength(4);
    const byNode = new Map();
    for (const ch of anim.channels) {
      if (!byNode.has(ch.target.node)) byNode.set(ch.target.node, []);
      byNode.get(ch.target.node).push(ch.target.path);
    }
    for (const paths of byNode.values()) expect(paths.sort()).toEqual(['rotation', 'translation']);
  });

  it('all samplers are LINEAR and share ONE input (times) accessor', () => {
    const inputs = new Set(anim.samplers.map((s) => s.input));
    expect(inputs.size).toBe(1);
    for (const s of anim.samplers) expect(s.interpolation).toBe('LINEAR');
  });

  it('a looping clip emits K+1 keys (wrap key closes the cycle) with monotonic times and min/max', () => {
    const inAcc = json.accessors[anim.samplers[0].input];
    expect(inAcc.type).toBe('SCALAR');
    expect(inAcc.count).toBe(K + 1);
    expect(inAcc.min).toEqual([0]);
    expect(inAcc.max).toEqual([1]); // RIG_CLIP_SECONDS
    const times = accessorData(json, bin, anim.samplers[0].input);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    expect(times[times.length - 1]).toBe(1);
  });

  it('rotation outputs are VEC4 float and hemisphere-continuous; the wrap key repeats key 0', () => {
    for (const ch of anim.channels.filter((c) => c.target.path === 'rotation')) {
      const acc = json.accessors[anim.samplers[ch.sampler].output];
      expect(acc.type).toBe('VEC4');
      expect(acc.componentType).toBe(5126);
      expect(acc.count).toBe(K + 1);
      const q = accessorData(json, bin, anim.samplers[ch.sampler].output);
      for (let k = 1; k <= K; k++) {
        const dot = q[k * 4] * q[(k - 1) * 4] + q[k * 4 + 1] * q[(k - 1) * 4 + 1]
          + q[k * 4 + 2] * q[(k - 1) * 4 + 2] + q[k * 4 + 3] * q[(k - 1) * 4 + 3];
        expect(dot).toBeGreaterThanOrEqual(0);
      }
      // wrap key = ±key 0 (same rotation, hemisphere-adjusted)
      const s = q[K * 4 + 3] * q[3] < 0 ? -1 : 1;
      for (let c = 0; c < 4; c++) expect(q[K * 4 + c]).toBeCloseTo(s * q[c], 6);
    }
  });

  it('translation outputs are VEC3 float tracking the posed bone heads', () => {
    for (const ch of anim.channels.filter((c) => c.target.path === 'translation')) {
      const acc = json.accessors[anim.samplers[ch.sampler].output];
      expect(acc.type).toBe('VEC3');
      expect(acc.componentType).toBe(5126);
      expect(acc.count).toBe(K + 1);
      const t = accessorData(json, bin, anim.samplers[ch.sampler].output);
      // wrap key repeats key 0 exactly
      for (let c = 0; c < 3; c++) expect(t[K * 3 + c]).toBe(t[c]);
    }
  });

  it("clips: ['unknown'] still exports the figure geometry with zero animations", () => {
    const o = facesToGlb({ faces: [quad()], figures: { guy: rig } }, { clips: ['nope'] });
    expect(o.animationCount).toBe(0);
    expect(o.animatedFigures).toEqual(['guy']);
    const parsed = parseGlb(o.bytes);
    expect(parsed.json.animations).toBeUndefined();
    expect(parsed.json.nodes.find((n) => n.name === 'guy')).toBeDefined();
  });
});

describe('facesToGlb rig export — quantized parts, sign flips, once clips', () => {
  // hand-packed single-bone fig on the indexed+quantized encoding (unit-rig style), with a
  // deliberately sign-flipped key 1 (q and −q depict the same rotation but lerp badly).
  const s2 = Math.SQRT1_2;
  const gm = faceListToMesh([quad('#888888')]);
  const part = packRigMesh(gm, 1);
  const head = [0.5, 0, 0];
  const spinB = [
    0, 0, 0, 1, ...head,
    0, 0, -s2, -s2, ...head, // = −[0,0,s2,s2] — must be re-hemisphered on export
    0, 0, 1, 0, ...head,
    0, 0, s2, -s2, ...head,
  ];
  const fig = {
    rig: true,
    bones: [{ id: 'x', head }],
    parts: [part],
    clips: {
      spin: { k: 4, b: spinB },
      fall: { k: 4, b: spinB, once: 1 },
    },
  };

  it('quantized parts export indexed, restHead-shifted geometry', () => {
    const out = facesToGlb({ faces: [quad()], figures: { unit: fig } }, { clips: ['spin'] });
    const { json } = parseGlb(out.bytes);
    const node = json.nodes.find((n) => n.name === 'unit:x');
    const prim = json.meshes[node.mesh].primitives[0];
    expect(prim.indices).toBeDefined();
    const idxAcc = json.accessors[prim.indices];
    expect(idxAcc.componentType).toBe(5123); // uint16
    expect(idxAcc.count).toBe(6); // one quad = 2 tris
    const pos = json.accessors[prim.attributes.POSITION];
    expect(pos.min[0]).toBeCloseTo(-0.5, 3); // quad x 0..1 shifted by −head.x
    expect(pos.max[0]).toBeCloseTo(0.5, 3);
    // indexed part tallies unique verts, depicted tris; the static quad now welds its
    // shared diagonal (6 soup verts → 4 unique) on top of the rig part's part.n verts.
    expect(out.vertexCount).toBe(4 + part.n);
    expect(out.triangleCount).toBe(2 + 2);
  });

  it('sign-flipped packed keys export hemisphere-continuous', () => {
    const out = facesToGlb({ faces: [quad()], figures: { unit: fig } }, { clips: ['spin'] });
    const { json, bin } = parseGlb(out.bytes);
    const anim = json.animations.find((a) => a.name === 'unit:spin');
    const rotCh = anim.channels.find((c) => c.target.path === 'rotation');
    const q = accessorData(json, bin, anim.samplers[rotCh.sampler].output);
    // key 1 was packed negated; exported it must equal +[0,0,s2,s2]
    expect(q[4 + 2]).toBeCloseTo(s2, 6);
    expect(q[4 + 3]).toBeCloseTo(s2, 6);
    for (let k = 1; k < q.length / 4; k++) {
      const dot = q[k * 4] * q[(k - 1) * 4] + q[k * 4 + 1] * q[(k - 1) * 4 + 1]
        + q[k * 4 + 2] * q[(k - 1) * 4 + 2] + q[k * 4 + 3] * q[(k - 1) * 4 + 3];
      expect(dot).toBeGreaterThanOrEqual(0);
    }
  });

  it('a `once` clip exports its K keys spanning [0, 1s] with no wrap key', () => {
    const out = facesToGlb({ faces: [quad()], figures: { unit: fig } }, { clips: ['fall'] });
    const { json, bin } = parseGlb(out.bytes);
    const anim = json.animations.find((a) => a.name === 'unit:fall');
    const inAcc = json.accessors[anim.samplers[0].input];
    expect(inAcc.count).toBe(4); // once clips are baked 0..1 inclusive — no wrap key
    const times = accessorData(json, bin, anim.samplers[0].input);
    expect(times[0]).toBe(0);
    expect(times[3]).toBeCloseTo(1, 6);
    expect(inAcc.max[0]).toBe(times[3]);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
  });

  it("'_all' exports every clip on the figure", () => {
    const out = facesToGlb({ faces: [quad()], figures: { unit: fig } }, { clips: '_all' });
    expect(out.animationCount).toBe(2);
    const { json } = parseGlb(out.bytes);
    expect(json.animations.map((a) => a.name).sort()).toEqual(['unit:fall', 'unit:spin']);
  });
});

describe('facesToGlb rig export — protoform end-to-end', () => {
  it('a bakeProtoformRig figure exports with a forward animation across every boned part', async () => {
    const rig = await bakeProtoformRig({ keys: 4 });
    const out = facesToGlb({ faces: [quad()], figures: { walker: rig } }, { clips: '_all' });
    expect(out.animationCount).toBe(1);
    const { json, bin } = parseGlb(out.bytes);
    const wrap = json.nodes.find((n) => n.name === 'walker');
    const bonedParts = rig.parts.filter(Boolean).length;
    expect(wrap.children).toHaveLength(bonedParts);
    const anim = json.animations.find((a) => a.name === 'walker:forward');
    expect(anim.channels).toHaveLength(bonedParts * 2);
    // every rotation curve hemisphere-continuous, every input monotonic
    for (const ch of anim.channels.filter((c) => c.target.path === 'rotation')) {
      const q = accessorData(json, bin, anim.samplers[ch.sampler].output);
      for (let k = 1; k < q.length / 4; k++) {
        const dot = q[k * 4] * q[(k - 1) * 4] + q[k * 4 + 1] * q[(k - 1) * 4 + 1]
          + q[k * 4 + 2] * q[(k - 1) * 4 + 2] + q[k * 4 + 3] * q[(k - 1) * 4 + 3];
        expect(dot).toBeGreaterThanOrEqual(0);
      }
    }
    const times = accessorData(json, bin, anim.samplers[0].input);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    // alignment holds across the larger buffer too
    for (const v of json.bufferViews) expect((v.byteOffset || 0) % 4).toBe(0);
  });
});
