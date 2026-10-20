import { describe, it, expect } from 'vitest';
import { runConformance, conformanceGate } from './conformance.js';
import { selftestCase } from './conformance-selftest.js';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';
import { renderWorldFrames } from '@/lib/motion/world-frames';

// The conformance gate in the real browser (the e2e tier: it launches Chrome). A faithful shader agrees with JS at
// every probe; one with a hand-typed factor in its GLSL disagrees; and the capture path renders the shader page. Without a
// browser the gate says "not run", which is what these assert then.
describe('science worlds: the shader conformance gate, in Chrome', () => {
  it('agrees with a faithful shader and disagrees with a fudged one', async () => {
    const faithful = selftestCase(), fudged = selftestCase({ fudge: 1.1 });
    const a = conformanceGate(await runConformance(faithful.payload, faithful.probes, faithful.size));
    const b = conformanceGate(await runConformance(fudged.payload, fudged.probes, fudged.size));
    if (!a.ran) { expect(a.ok).toBeNull(); expect(b.ran).toBe(false); return; }
    expect(a.ok, a.detail).toBe(true);
    expect(b.ok).toBe(false);
    expect(b.detail).toMatch(/field:0.*disk/);
  }, 180000);

  it('films a shader page through the capture path forge_motion uses', async () => {
    const c = selftestCase();
    const html = emitThreeWorld({ ...c.payload, inline: true, capture: true });
    let r;
    try { r = await renderWorldFrames(html, [{ pos: [8, 0, 0], target: [0, 0, 0], vfov: 40, t: 0 }], { width: 320, height: 240 }); } catch (err) {
      expect(String(err.message)).toMatch(/Chromium|browser/i);
      return;
    }
    expect(r.pngs).toHaveLength(1);
    expect(r.pngs[0].subarray(1, 4).toString()).toBe('PNG');
  }, 180000);
});
