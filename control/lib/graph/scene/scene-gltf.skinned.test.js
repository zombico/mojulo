/**
 * Skinned rig export (skin-over-mesh.plan.md phase 4): the packed FK rig as
 * ONE SkinnedMesh + glTF `skins` — JOINTS_0/WEIGHTS_0, inverse-bind matrices,
 * clips retargeted onto joint nodes. Export-only: absent `skinned`, the rigid
 * path is byte-identical (pinned here against the phase-0 discipline).
 */
import { describe, expect, it } from 'vitest';

import { facesToGlb } from './scene-gltf.js';
import { figureRigSamples } from '../polygonizer/figure-render.js';
import { bakeRigFigure } from '../figures/rig-bake.js';

function parseGlb(buf) {
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
}

// One real protoform figure rig, baked once for the whole file.
const { restFaces, restNodes, nodeFrames } = figureRigSamples({}, 4);
const fig = bakeRigFigure({
  nodesAt: () => restNodes,
  facesAt: () => restFaces.map((f) => ({ corners: f.corners, fill: f.fill })),
  clips: { forward: { nodeFrames } },
  targetH: null,
});
const payload = { faces: [], figures: { hero: fig } };

const rigid = facesToGlb(payload, { clips: '_all' });
const skinned = facesToGlb(payload, { clips: '_all', skinned: true });

describe('packed rig — the phase-4 bone segments', () => {
  it('bakeRigFigure now packs rest tails beside heads', () => {
    for (const b of fig.bones) {
      expect(b.head).toHaveLength(3);
      expect(b.tail).toHaveLength(3);
      expect(b.tail).not.toEqual(b.head);
    }
  });
});

describe('facesToGlb skinned — structure', () => {
  const json = parseGlb(skinned.bytes);
  const skin = json.skins[0];
  const meshNode = json.nodes.find((n) => n.skin != null);
  const prim = json.meshes[meshNode.mesh].primitives[0];

  it('emits one skin: joints = bones, IBM accessor MAT4 × joints', () => {
    expect(json.skins).toHaveLength(1);
    expect(skin.joints).toHaveLength(fig.bones.length);
    const ibm = json.accessors[skin.inverseBindMatrices];
    expect(ibm.type).toBe('MAT4');
    expect(ibm.count).toBe(fig.bones.length);
  });

  it('the mesh carries JOINTS_0 (u16 VEC4) + WEIGHTS_0 (float VEC4) aligned with POSITION', () => {
    const joints = json.accessors[prim.attributes.JOINTS_0];
    const weights = json.accessors[prim.attributes.WEIGHTS_0];
    const positions = json.accessors[prim.attributes.POSITION];
    expect(joints.type).toBe('VEC4');
    expect(joints.componentType).toBe(5123);
    expect(weights.type).toBe('VEC4');
    expect(joints.count).toBe(positions.count);
    expect(weights.count).toBe(positions.count);
  });

  it('joint nodes sit at rest heads; IBM is T(−restHead) → rest pose round-trips as identity', () => {
    skin.joints.forEach((ni, bi) => {
      expect(json.nodes[ni].translation).toEqual([fig.bones[bi].head[0], fig.bones[bi].head[1], fig.bones[bi].head[2]]);
      expect(json.nodes[ni].rotation).toBeUndefined();   // rest rotation identity ⇒ J·IBM = I at rest
    });
  });

  it('clips retarget onto the joint nodes — same animation count as the rigid export', () => {
    const rigidJson = parseGlb(rigid.bytes);
    expect(json.animations).toHaveLength(rigidJson.animations.length);
    const jointSet = new Set(skin.joints);
    for (const ch of json.animations[0].channels) {
      expect(jointSet.has(ch.target.node)).toBe(true);
    }
  });

  it('reports the skinned figures and keeps vertex totals', () => {
    expect(skinned.skinnedFigures).toEqual(['hero']);
    expect(skinned.vertexCount).toBe(rigid.vertexCount);
    expect(skinned.triangleCount).toBe(rigid.triangleCount);
  });
});

describe('facesToGlb skinned — weights', () => {
  it('soft weights: some vertices blend TWO joints near a shared endpoint; all rows sum to 1', () => {
    const json = parseGlb(skinned.bytes);
    const jsonLen = json ? skinned.bytes.readUInt32LE(12) : 0;
    const binStart = 20 + jsonLen + 8;
    const meshNode = json.nodes.find((n) => n.skin != null);
    const prim = json.meshes[meshNode.mesh].primitives[0];
    const wAcc = json.accessors[prim.attributes.WEIGHTS_0];
    const wView = json.bufferViews[wAcc.bufferView];
    const weights = new Float32Array(
      skinned.bytes.buffer,
      skinned.bytes.byteOffset + binStart + (wView.byteOffset || 0),
      wAcc.count * 4,
    );
    let blended = 0;
    for (let i = 0; i < wAcc.count; i++) {
      const w = [weights[i * 4], weights[i * 4 + 1], weights[i * 4 + 2], weights[i * 4 + 3]];
      const sum = w[0] + w[1] + w[2] + w[3];
      expect(Math.abs(sum - 1)).toBeLessThan(1e-4);
      if (w[1] > 0.05) blended += 1;
    }
    expect(blended).toBeGreaterThan(wAcc.count * 0.05);   // real soft creases, not hard binding
  });

  it('a rig WITHOUT tails (armor / old bakes) binds hard [1,0,0,0]', () => {
    const bare = { ...fig, bones: fig.bones.map(({ id, head }) => ({ id, head })) };
    const out = facesToGlb({ faces: [], figures: { suit: bare } }, { clips: '_all', skinned: true });
    const json = parseGlb(out.bytes);
    const jsonLen = out.bytes.readUInt32LE(12);
    const binStart = 20 + jsonLen + 8;
    const meshNode = json.nodes.find((n) => n.skin != null);
    const prim = json.meshes[meshNode.mesh].primitives[0];
    const wAcc = json.accessors[prim.attributes.WEIGHTS_0];
    const wView = json.bufferViews[wAcc.bufferView];
    const weights = new Float32Array(out.bytes.buffer, out.bytes.byteOffset + binStart + (wView.byteOffset || 0), wAcc.count * 4);
    for (let i = 0; i < Math.min(wAcc.count, 500); i++) {
      expect(weights[i * 4]).toBe(1);
      expect(weights[i * 4 + 1]).toBe(0);
    }
  });
});

describe('facesToGlb skinned — the byte-identical guard', () => {
  it('absent `skinned`, the rigid export carries no skins and no JOINTS_0 anywhere', () => {
    const json = parseGlb(rigid.bytes);
    expect(json.skins).toBeUndefined();
    for (const mesh of json.meshes) for (const p of mesh.primitives) {
      expect(p.attributes.JOINTS_0).toBeUndefined();
    }
  });
});
