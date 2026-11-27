// A SCAN'S RING on the guide (guide.js `ring`, GUIDE_RING): its ring on the ground at the place's radius, and while it is
// stood in, rings pulsing in from it toward its middle, one after another, until its clock is run (the step passed, the
// ring gone). A guide with no ring carries none of it. Run on three.js against a stub page.
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { guideScript, GUIDE_RING } from './guide.js';

async function page(guide) {
  const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
  const scene = new THREE.Scene(), el = () => ({ className: '', innerHTML: '', textContent: '', style: {}, appendChild() {} });
  let now = 0, frame = null;
  const P = { id: 'p', pilotable: true, transform: { pos: [0, 0, 0], heading: 0 }, rule: { type: 'frame' }, v: [0, 0, 0] };
  const vars = { __obj: 0 }, W = { pilotId: 'p', byId: { p: P }, entities: [P] };
  new Function('window', 'document', 'performance', 'requestAnimationFrame', 'THREE', 'scene', guideScript(guide))({ __mojCtrl: { world: W }, __mojBus: { state: { vars } } }, { createElement: el, head: { appendChild() {} }, body: el() }, { now: () => now }, (f) => { frame = f; }, THREE, scene);
  const step = (dt, n) => { for (let i = 0; i < n; i++) { now += dt * 1000; const f = frame; frame = null; f(); } };
  const ring = () => scene.children.find((c) => c.type === 'Group');
  return { P, vars, step, ring };
}
const STEP = { id: 't1', say: '', kind: 'reach', at: [100, 0, 0], radius: 40, ring: true, when: { var: '__obj', gte: 1 }, from: { var: '__obj', gte: 0 } };

describe('a scan\'s ring', () => {
  it('lies at its radius; stood in, rings pulse in from it toward the middle until the step is passed', async () => {
    const G = await page({ steps: [STEP], done: '' });
    G.step(0.05, 2);
    const R = G.ring(), [edge, ...pulses] = R.children;
    expect(R.scale.x).toBe(40);
    expect(pulses).toHaveLength(GUIDE_RING.pulses);
    expect(pulses.every((m) => m.material.opacity === 0)).toBe(true);           // (outside it: no pulse, the edge at rest)
    expect(edge.material.opacity).toBe(GUIDE_RING.rest);
    G.P.transform.pos = [95, 5, 0];
    const sizes = [];
    for (let i = 0; i < 6; i++) { G.step(0.1, 1); sizes.push(pulses[0].scale.x); }
    expect(edge.material.opacity).toBe(GUIDE_RING.held);
    expect(pulses.some((m) => m.material.opacity > 0)).toBe(true);
    expect(sizes[5]).toBeLessThan(sizes[0]);                                      // (closing in, large to small)
    expect(Math.min(...pulses.map((m) => m.scale.x))).toBeGreaterThanOrEqual(GUIDE_RING.least - 1e-9);
    // (its clock run, the step passed: the ring gone)
    G.vars.__obj = 1; G.step(0.05, 2);
    expect(G.ring()).toBeUndefined();
  });

  it('a guide with no ring carries none of it', () => {
    expect(guideScript({ steps: [{ ...STEP, ring: undefined }], done: '' })).not.toContain('GUIDE_RING');
    expect(guideScript({ steps: [{ ...STEP, ring: undefined }], done: '' })).not.toContain('const GR =');
  });
});
