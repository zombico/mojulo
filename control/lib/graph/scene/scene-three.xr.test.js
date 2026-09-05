import { describe, expect, it } from 'vitest';

import { emitThreeWorld } from './scene-three.js';

// interchange-seams.plan.md seam 7 — WebXR is an opt-in bespoke block: absent `xr`, no trace of it
// in the page (the char pins in emit-channels.char.test.js hold the byte-identity); present, the
// session handshake + rig + locomotion + the HUD button are emitted and the loop steps it.

const floor = () => ({ corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill: '#445566' });
const moduleScript = (page) => page.match(/<script type="module">([\s\S]*)<\/script>/)[1];

describe('emitThreeWorld xr', () => {
  it('emits nothing XR-related unless asked', () => {
    for (const opts of [{ faces: [floor()] }, { faces: [floor()], walk: true }]) {
      const page = emitThreeWorld(opts);
      expect(page).not.toContain('immersive-vr');
      expect(page).not.toContain('__xrStep');
      expect(page).not.toContain('renderer.xr.enabled');
    }
  });

  it('xr: true emits the session handshake, the z-up rig, locomotion, and the loop guard', () => {
    const page = emitThreeWorld({ faces: [floor()], xr: true });
    const js = moduleScript(page);
    expect(js).toContain("requestSession('immersive-vr'");
    expect(js).toContain("setReferenceSpaceType('local-floor')");
    expect(js).toContain('renderer.xr.enabled = true');
    expect(js).toContain('if (__xrOn) __xrStep(dt);');
    // defaults: fallback eye 1.6, orbit-only speed 3, 30° snap in radians
    expect(js).toContain('const XR = {"eye":1.6,"speed":3,"snap":0.5235987755982988};');
    // no three/examples import — the page stays self-contained
    expect(js).not.toContain('three/addons/webxr');
    expect(page).toContain('<b>vr</b> = headset');
  });

  it('rides the walk channel: speed follows walk speed, ground probe is typeof-guarded', () => {
    const page = emitThreeWorld({ faces: [floor()], walk: { speed: 8, spawn: [1, 1, 1.6], radius: 0.4 }, xr: { eye: 1.7, snap: 45 } });
    const js = moduleScript(page);
    expect(js).toContain('const XR = {"eye":1.7,"speed":4,"snap":0.7853981633974483};');
    expect(js).toContain("typeof groundBelow === 'function'");
    expect(js).toContain('function groundBelow(');
  });

  it('is deterministic', () => {
    const opts = { faces: [floor()], xr: { speed: 2 } };
    expect(emitThreeWorld(opts)).toBe(emitThreeWorld(opts));
  });
});
