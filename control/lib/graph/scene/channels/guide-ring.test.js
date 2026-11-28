// A SCAN'S PLACE ON THE GROUND (guide.js a step's `ring`, GUIDE_RING): a disc laid on the ground and following it, under
// the frames' feet (drawn behind what stands on it, never over it); its rim and a faint light at rest, and while it is
// stood in the whole surface glows, breathing; the step passed, it goes. A guide with none carries none of it. Run on
// three.js against a stub page whose ground rises to the east.
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { guideScript, GUIDE_RING } from './guide.js';

const groundAt = ([x]) => 2 + x * 0.05;
async function page(guide, win = {}) {
  const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
  const scene = new THREE.Scene(), el = () => ({ className: '', innerHTML: '', textContent: '', style: {}, appendChild() {} });
  let now = 0, frame = null;
  const P = { id: 'p', pilotable: true, transform: { pos: [0, 0, 0], heading: 0 }, rule: { type: 'frame' }, v: [0, 0, 0] };
  const vars = { __obj: 0 }, W = { pilotId: 'p', byId: { p: P }, entities: [P] };
  new Function('window', 'document', 'performance', 'requestAnimationFrame', 'THREE', 'scene', guideScript(guide))(Object.assign(win, { __mojCtrl: { world: W, groundAt: (x, y, z) => groundAt([x, y, z]) }, __mojBus: { state: { vars } } }), { createElement: el, head: { appendChild() {} }, body: el() }, { now: () => now }, (f) => { frame = f; }, THREE, scene);
  const step = (dt, n) => { for (let i = 0; i < n; i++) { now += dt * 1000; const f = frame; frame = null; f(); } };
  const disc = () => scene.children.find((c) => c.isMesh && c.material.isShaderMaterial);
  return { P, vars, step, disc, win };
}
const STEP = { id: 't1', say: '', kind: 'reach', at: [100, 0, 7], radius: 40, ring: true, when: { var: '__obj', gte: 1 }, from: { var: '__obj', gte: 0 } };

describe('a scan\'s place on the ground', () => {
  it('lies on the ground under the frames\' feet, following it, drawn behind what stands on it', async () => {
    const G = await page({ steps: [STEP], done: '' });
    G.step(0.05, 2);
    const D = G.disc(), p = D.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i += 37) expect(p.getZ(i)).toBeCloseTo(groundAt([p.getX(i)]) + GUIDE_RING.lift, 5);
    expect(Math.max(...Array.from({ length: p.count }, (_, i) => Math.hypot(p.getX(i) - 100, p.getY(i))))).toBeCloseTo(40, 3);
    expect(D.material.depthTest).toBe(true);
  });

  it('is laid once the ground answers under it, its heights the land\'s, never before', async () => {
    let up = false;
    const G = await page({ steps: [STEP], done: '' }, {});
    const ask = G.win.__mojCtrl.groundAt;
    G.win.__mojCtrl.groundAt = (x, y, z) => (up ? ask(x, y, z) : null);
    G.step(0.05, 4);
    expect(G.disc()).toBeUndefined();
    up = true; G.step(0.05, 2);
    const p = G.disc().geometry.getAttribute('position');
    expect(p.getZ(5)).toBeCloseTo(groundAt([p.getX(5)]) + GUIDE_RING.lift, 5);
  });

  it('lies under a lone boulder, not over it, and is depth-tested as the page\'s logarithmic depth is', async () => {
    // (a boulder 10 m tall under one of its points: that point drops back to the ground round it)
    const G = await page({ steps: [STEP], done: '' }, {});
    const ask = G.win.__mojCtrl.groundAt;
    G.win.__mojCtrl.groundAt = (x, y, z) => ask(x, y, z) + (Math.hypot(x - 120, y) < 1 ? 10 : 0);
    G.step(0.05, 2);
    const D = G.disc(), p = D.geometry.getAttribute('position');
    let k = -1; for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i) - 120, p.getY(i)) < 1) k = i;
    expect(k).toBeGreaterThan(0);
    expect(p.getZ(k)).toBeLessThan(groundAt([120]) + GUIDE_RING.lift + 1);
    expect(D.material.vertexShader).toContain('logdepthbuf_vertex');
    expect(D.material.fragmentShader).toContain('logdepthbuf_fragment');
  });

  it('glows over its whole surface while it is stood in, breathing; at rest a faint light; the step passed, it goes', async () => {
    const G = await page({ steps: [STEP], done: '' });
    G.step(0.05, 2);
    const U = G.disc().material.uniforms;
    expect(U.uLit.value).toBe(GUIDE_RING.rest);
    G.P.transform.pos = [95, 5, 0];
    const lit = [];
    for (let i = 0; i < 16; i++) { G.step(0.1, 1); lit.push(U.uLit.value); }
    expect(Math.min(...lit)).toBeGreaterThan(GUIDE_RING.rest);
    expect(Math.max(...lit)).toBeLessThanOrEqual(GUIDE_RING.glow + 1e-9);
    expect(Math.max(...lit) - Math.min(...lit)).toBeGreaterThan(0.1);                  // (breathing)
    G.vars.__obj = 1; G.step(0.05, 2);
    expect(G.disc()).toBeUndefined();
  });

  it('a guide with no place to ring carries none of it', () => {
    expect(guideScript({ steps: [{ ...STEP, ring: undefined }], done: '' })).not.toContain('const GR =');
  });
});
