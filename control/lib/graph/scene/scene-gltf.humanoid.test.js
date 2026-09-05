import { describe, expect, it } from 'vitest';

import { facesToGlb } from './scene-gltf.js';
import { parseGlb } from './scene-gltf-read.js';
import { figureRigSamples } from '../polygonizer/figure-render.js';
import { bakeRigFigure } from '../figures/rig-bake.js';
import { BONE_TO_VRM, JOINT_TO_VRM, VRM_REQUIRED, humanoidBonesFor, isHumanoidRig } from '../polygonizer/figure-humanoid-map.js';

// interchange-seams.plan.md seam 3a — the humanoid map: VRM names on the skinned joints, leaf
// joints for hands / feet, the VRMC_vrm extension; absent `humanoid`, the skinned export is
// byte-identical.

const { restFaces, restNodes, nodeFrames } = figureRigSamples({}, 4);
const fig = bakeRigFigure({ nodesAt: () => restNodes, facesAt: () => restFaces, clips: { forward: { nodeFrames } } });
const payload = { faces: [], figures: { hero: fig } };

describe('figure-humanoid-map', () => {
  it('maps every packed biped bone and completes the VRM required set with wrist / ankle leaves', () => {
    const { names, leaves, missing } = humanoidBonesFor(fig.bones);
    expect(missing).toEqual([]);
    expect(isHumanoidRig(fig.bones)).toBe(true);
    expect([...names.values()].sort()).toEqual(Object.values(BONE_TO_VRM).sort());
    expect(leaves.map((l) => l.vrm).sort()).toEqual(['leftFoot', 'leftHand', 'rightFoot', 'rightHand']);
    const lh = leaves.find((l) => l.vrm === 'leftHand');
    expect(lh.at).toEqual(fig.bones[lh.parent].tail);
    expect(fig.bones[lh.parent].id).toBe('fArmL');
  });

  it('a non-biped rig reports what is missing rather than pretending', () => {
    const quad = [{ id: 'spine', head: [0, 0, 1], tail: [1, 0, 1] }, { id: 'legFL', head: [1, 0, 1], tail: [1, 0, 0] }];
    const { missing } = humanoidBonesFor(quad);
    expect(missing).toEqual([...VRM_REQUIRED]);
    expect(isHumanoidRig(quad)).toBe(false);
  });

  it('the joint map covers the 15 required VRM bones and nothing else', () => {
    expect(Object.values(JOINT_TO_VRM).sort()).toEqual([...VRM_REQUIRED].sort());
  });
});

describe('facesToGlb humanoid', () => {
  it('off: the skinned export is byte-identical with humanoid:false', () => {
    const a = facesToGlb(payload, { clips: '_all', skinned: true });
    const b = facesToGlb(payload, { clips: '_all', skinned: true, humanoid: false });
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(parseGlb(a.bytes).json.extensionsUsed).not.toContain('VRMC_vrm');
  });

  it('on: VRM joint names, leaf joints, and the VRMC_vrm humanBones block', () => {
    const out = facesToGlb(payload, { clips: '_all', skinned: true, humanoid: true });
    expect(out.humanoidFigures).toEqual(['hero']);
    const { json } = parseGlb(out.bytes);
    expect(json.extensionsUsed).toContain('VRMC_vrm');
    const vrm = json.extensions.VRMC_vrm;
    expect(vrm.specVersion).toBe('1.0');
    expect(vrm.meta.licenseUrl).toBe('https://vrm.dev/licenses/1.0/');
    const bones = vrm.humanoid.humanBones;
    for (const req of VRM_REQUIRED) {
      expect(bones[req], req).toBeDefined();
      expect(json.nodes[bones[req].node].name).toBe(`hero:${req}`);
    }
    // the skin still animates: joints are the renamed nodes, clips still bind to them
    const skin = json.skins[0];
    expect(json.nodes[bones.hips.node].name).toBe('hero:hips');
    expect(skin.joints).toContain(bones.hips.node);
    expect(skin.joints).not.toContain(bones.leftHand.node); // leaf joints are weightless, outside the skin
    expect(json.animations.length).toBeGreaterThan(0);
    // the old ids are gone from the joint names
    expect(json.nodes.some((n) => n.name === 'hero:pelvis')).toBe(false);
    // the leaf sits at the forearm's tail
    const wrist = fig.bones.find((b) => b.id === 'fArmL').tail;
    expect(json.nodes[bones.leftHand.node].translation).toEqual(wrist);
  });

  it('refuses a rig that cannot supply the required bones', () => {
    const bad = { ...fig, bones: fig.bones.filter((b) => !/thigh|calf/.test(b.id)), parts: fig.parts.filter((_, i) => !/thigh|calf/.test(fig.bones[i].id)) };
    expect(() => facesToGlb({ faces: [], figures: { x: bad } }, { clips: '_all', skinned: true, humanoid: true })).toThrow(/cannot supply VRM bones/);
  });
});
