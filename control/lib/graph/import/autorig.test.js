import { describe, it, expect } from 'vitest';
import { autoRig, stripSkin, bakeRest, FIT_BONES } from './autorig.js';
import { poseStretch, GATE } from './rig-gate.js';
import { inspectModel } from './inspect.js';
import { boxGlb, person } from './test-figures.js';
import { importRig } from '../scene/rig-import.js';

describe('auto-rig: an unrigged biped stood on the vajra', () => {
  const glb = person();
  const rigged = autoRig(glb);
  const { pack, ledger } = importRig(rigged.bytes);

  it('writes a skinned GLB whose humanoid rig-import reads by name, every bone the vajra has', () => {
    expect(rigged.class).toBe('body');
    expect(ledger.how).toBe('name');
    expect(inspectModel(rigged.bytes).skins[0].names).toEqual(FIT_BONES.map(([n]) => n));
    expect(pack.bones.map((b) => b.id)).toEqual(expect.arrayContaining(['pelvis', 'head', 'upperArmL', 'handR', 'thighL', 'footR', 'toesL']));
  });

  it('stands its joints where a person\'s are: hips near half its height, hands at its arms\' ends, its right on +x', () => {
    const at = (id) => pack.bones.find((b) => b.id === id).head;
    const H = pack.figH;
    expect(at('pelvis')[2] / H).toBeGreaterThan(0.45);
    expect(at('pelvis')[2] / H).toBeLessThan(0.6);
    expect(at('handR')[0]).toBeGreaterThan(0.5);
    expect(at('handL')[0]).toBeLessThan(-0.5);
    expect(at('thighR')[0]).toBeGreaterThan(0);
    expect(at('head')[2]).toBeGreaterThan(at('neck')[2]);
    expect(rigged.ledger.facing).toMatch(/by its feet/);
  });

  it('bends without tearing: the machine gate passes on it', () => {
    const g = poseStretch(pack);
    expect(g.verdict).toBe('pass');
    expect(g.poses.find((p) => p.name === 'knees bent').torn).toBeLessThanOrEqual(GATE.POSE);
  });

  it('is the same bytes from the same model', () => {
    expect(Buffer.compare(autoRig(person()).bytes, rigged.bytes)).toBe(0);
  });

  it('reads as a mascot when its head is a third of it, and rigs it stiffer', () => {
    const m = autoRig(person({ H: 0.6, heads: 2.6 }));
    expect(m.class).toBe('mascot');
    expect(importRig(m.bytes).ledger.how).toBe('name');
  });

  it('refuses a prop and a figure with its arms at its sides, naming what a fit needs', () => {
    expect(() => autoRig(boxGlb([[0, 0, 0, 1, 1, 1]]))).toThrow(/reads as a prop.*say `as: 'body'`/);
    expect(() => autoRig(person({ arms: 'down' }))).toThrow(/arm is not held away from its body.*T or an A pose/);
  });
});

describe('the machine gate', () => {
  it('says a rig tears where a joint\'s triangles hang on bones that do not move together', () => {
    const { pack } = importRig(autoRig(person()).bytes);
    // every triangle's first corner on the left shank, the rest on the pelvis: bending a knee tears them
    const shank = pack.bones.findIndex((b) => b.id === 'shankL');
    const bad = { ...pack, parts: pack.parts.map((p) => {
      if (!p) return p;
      const n = Buffer.from(p.wgt, 'base64').length / 16;
      const J = new Uint8Array(n * 4), W = Buffer.alloc(n * 16);
      for (let v = 0; v < n; v++) { J[v * 4] = v % 3 === 0 ? shank : 0; W.writeFloatLE(1, v * 16); }
      return { ...p, jnt: Buffer.from(J).toString('base64'), wgt: W.toString('base64') };
    }) };
    const g = poseStretch(bad);
    expect(g.verdict).toBe('advise');
    expect(g.poses.find((p) => p.name === 'knees bent').worst[0].bone).toBe('shankL');
  });
});

describe('the model at rest, stripped', () => {
  it('bakes a skinned model to one plain mesh standing where its skin stood it', () => {
    const skinned = autoRig(person()).bytes;
    const bare = stripSkin(skinned);
    const a = inspectModel(skinned), b = inspectModel(bare);
    expect(b.skins).toEqual([]);
    expect(b.rest.height).toBeCloseTo(a.rest.height, 4);
    expect(bakeRest(skinned).prims.length).toBe(1);
  });
});
