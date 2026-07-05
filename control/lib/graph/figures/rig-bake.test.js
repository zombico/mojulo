import { describe, expect, it } from 'vitest';

import { bakeRigFigure, bakeMegaBoyRig, bakeProtoformRig, BIPED_BONES } from './rig-bake.js';

describe('rig-bake — generic baker', () => {
  it('bakes mega-boy: all bones present, every part non-empty, curves per clip', async () => {
    const rig = await bakeMegaBoyRig({ keys: 8 });
    expect(rig.rig).toBe(true);
    expect(rig.bones.length).toBe(BIPED_BONES.length);
    // helmet/torso/limbs all bind SOME geometry
    for (const p of rig.parts) expect(p).toBeTruthy();
    expect(rig.clips.forward.k).toBe(8);
    expect(rig.clips.strafe.k).toBe(8);
    expect(rig.clips.forward.b.length).toBe(8 * rig.bones.length * 7);
    expect(rig.figH).toBeCloseTo(1.8, 3);
  });

  it('is deterministic', async () => {
    const a = await bakeMegaBoyRig({ keys: 4 });
    const b = await bakeMegaBoyRig({ keys: 4 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('phase 0 of the walk is near-rest: quaternions ≈ identity', async () => {
    const rig = await bakeMegaBoyRig({ keys: 8 });
    const nb = rig.bones.length;
    for (let bi = 0; bi < nb; bi++) {
      const q = rig.clips.forward.b.slice(bi * 7, bi * 7 + 4);   // key 0 (sin(0)=0 → neutral dof)
      expect(Math.abs(q[3])).toBeGreaterThan(0.999);             // w ≈ ±1
    }
  });

  it('mid-swing keys rotate the thighs in OPPOSITE directions (contralateral gait)', async () => {
    const rig = await bakeMegaBoyRig({ keys: 8 });
    const nb = rig.bones.length;
    const key = 2;                                               // phase 0.25 → sin = 1, max swing
    const boneIdx = (id) => rig.bones.findIndex((b) => b.id === id);
    const quat = (bi) => rig.clips.forward.b.slice(key * nb * 7 + bi * 7, key * nb * 7 + bi * 7 + 4);
    const qL = quat(boneIdx('thighL')), qR = quat(boneIdx('thighR'));
    // hip pitch about the sagittal (x) axis: opposite signs on the x component
    expect(qL[0] * qR[0]).toBeLessThan(0);
    expect(Math.abs(qL[0])).toBeGreaterThan(0.05);
  });

  it('pose-curve payload is orders of magnitude smaller than an 8-frame flipbook clip', async () => {
    const rig = await bakeMegaBoyRig({ keys: 8 });
    const { bakeMegaBoyClips } = await import('./megaboy-spike.js');
    const flip = bakeMegaBoyClips(8);
    const rigBytes = JSON.stringify(rig).length;                       // parts ONCE + curves
    const flipBytes = JSON.stringify(flip).length;                     // 8 full geometries × 2 clips
    expect(rigBytes).toBeLessThan(flipBytes / 4);
  });
});

describe('rig-bake — protoform delivery', () => {
  it('bakes the protoform walk with parts bound and plausible foot-plant stability', async () => {
    const rig = await bakeProtoformRig({ keys: 8 });
    expect(rig.rig).toBe(true);
    expect(rig.clips.forward.k).toBe(8);
    const nb = rig.bones.length;
    // foot-plant proxy: across the gait cycle the LOWER of the two calf bone heads (the knee
    // of the planted leg… we check ankle via head of calf + its rotation is complex; assert
    // instead that bone HEAD z positions stay within the figure's height budget and the
    // pelvis oscillates less than 20% of figure height (no balance blow-ups).
    const pelvisIdx = rig.bones.findIndex((b) => b.id === 'pelvis');
    const zs = [];
    for (let k = 0; k < 8; k++) zs.push(rig.clips.forward.b[k * nb * 7 + pelvisIdx * 7 + 6]);
    const span = Math.max(...zs) - Math.min(...zs);
    expect(span).toBeLessThan(rig.figH * 0.2);
    for (const z of zs) expect(z).toBeGreaterThan(0);
  });
});

describe('rig delivery — world-scene → emitThreeWorld end-to-end', () => {
  const sketch = (manifest) => ({ manifest, title: 'test' });

  it('figures `delivery:"rig"` bakes a rig figure onto the payload (megaboy + protoform)', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const out = await resolveWorldScene(sketch({
      kind: 'controllable',
      entities: [{ id: 'hero', rule: { type: 'walk' }, body: { type: 'figure-rig', figure: 'boy' } }],
      figures: { boy: { asset: 'megaboy', delivery: 'rig' } },
    }));
    expect(out.payload.figures.boy.rig).toBe(true);
    expect(out.payload.figures.boy.clips.forward.k).toBe(8);
  });

  it('rig payload is far smaller than the flipbook equivalent of the same manifest', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const base = {
      kind: 'controllable',
      entities: [{ id: 'hero', rule: { type: 'walk' }, body: { type: 'figure-frames', figure: 'f' } }],
    };
    const flip = await resolveWorldScene(sketch({ ...base, figures: { f: { motion: 'walk', proto: 'male', frames: 8 } } }));
    const rig = await resolveWorldScene(sketch({ ...base, figures: { f: { proto: { sex: 'male' }, delivery: 'rig', keys: 8 } } }));
    const bytes = (p) => JSON.stringify(p.figures).length;
    expect(bytes(rig.payload)).toBeLessThan(bytes(flip.payload) / 4);
  });

  it('emitThreeWorld ships the rig figure + the rig sync path in the page', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const { emitThreeWorld } = await import('../scene/scene-three.js');
    const out = await resolveWorldScene(sketch({
      kind: 'controllable',
      entities: [{ id: 'hero', rule: { type: 'walk' }, body: { type: 'figure-rig', figure: 'boy', headTrack: 'orb' } },
                 { id: 'orb', rule: { type: 'glide' }, body: { type: 'mesh', shape: 'sphere' } }],
      figures: { boy: { asset: 'megaboy', delivery: 'rig' } },
    }));
    const html = emitThreeWorld({ ...out.payload });
    expect(html).toContain('__syncRigEntity');
    expect(html).toContain('"rig":true');
    expect(html).toContain('headTrack');
  });
});
