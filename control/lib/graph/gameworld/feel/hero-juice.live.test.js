// A hero's movement juice in the page (an e2e suite: a real browser, skipped when none is installed): a body on the
// platform rule runs, jumps, air-jumps and lands through the page's own step, and its juice answers. The platformer
// marks the take-off, the air jump and the landing; pinball's trail runs at speed and its motion lines near the top
// speed; each at a fidelity draws without a page error.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rollEgocube } from '../../egocube/egocube.js';
import { racerFromSheet, solveRacer } from '../../car-designer/racer.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../scene/chromium.js';
import { heroJuice } from './hero-juice.js';

// (the body: any rig figure will do; the facts are the platform rule's)
const S = solveRacer(racerFromSheet(rollEgocube({ facets: { archetype: 'explorer' }, seed: 4 }), { seed: 4 }), { seed: 4 });
let browser = null;
const results = {};
const page = (flavor, fidelity) => emitThreeWorld({
  faces: [{ corners: [[-200, -200, 0], [200, -200, 0], [200, 200, 0], [-200, 200, 0]], fill: '#8fb36a' }],
  cameras: [{ name: 'c', worldFraming: { cameraPosition: [-6, -6, 4], lookAt: [0, 0, 0.5], horizontalFov: 60, pictureCenter: [560, 390] } }],
  viewBox: { width: 640, height: 448 }, title: 'live', metersPerUnit: 1,
  entities: [{ id: 'hero', pilotable: true, rule: { type: 'platform', speed: 12, jumpSpeed: 8.5, airJumps: 1 }, body: { type: 'figure-rig', figure: 'h' }, transform: { pos: [0, 0, 0], heading: 0 } }],
  figures: { h: { ...S.figure, juice: heroJuice(flavor, S.figure, fidelity ? { fidelity } : {}) } }, pilot: 'hero', fx: { states: { none: 'pulse' } }, inline: true, hud: false,
});
beforeAll(async () => {
  let exe; try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
  for (const [flavor, fidelity] of [['platformer', null], ['pinball', 'form'], ['platformer', 'voxel']]) {
    const p = await browser.newPage(), errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.setContent(page(flavor, fidelity), { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.bodies && window.__mojCtrl.bodies.hero, { timeout: 20000 });
    const r = await p.evaluate(() => {
      const C = window.__mojCtrl, rj = C.bodies.hero.userData.rigFig.rj, peak = {}, rings = [];
      const run = (n, input) => { for (let i = 0; i < n; i++) { C.step(1 / 60, input); for (const k in rj.alive) peak[k] = Math.max(peak[k] || 0, rj.alive[k]); for (const id in rj.on) if (rj.on[id] && !rings.includes(id)) rings.push(id); } };
      run(40, { forward: 1 }); run(1, { forward: 1, jump: true, jumpHeld: true }); run(18, { forward: 1, jumpHeld: true });
      run(1, { forward: 1, jump: true, jumpHeld: true }); run(90, { forward: 1 });
      return { peak, fired: { ...rj.fired }, on: rings };
    });
    results[`${flavor}:${fidelity}`] = { ...r, errors };
    await p.close();
  }
}, 180000);
afterAll(async () => { if (browser) await browser.close(); });

describe('a hero\'s movement juice in the page', () => {
  it('marks a platformer\'s take-off and landing, and runs pinball\'s trail at speed, at every fidelity without an error', () => {
    if (!browser) return;
    const P = results['platformer:null'], B = results['pinball:form'], V = results['platformer:voxel'];
    for (const R of [P, B, V]) expect(R.errors).toEqual([]);
    expect(P.peak.takeoffPuff).toBeGreaterThan(0);
    expect(P.peak.landDust).toBeGreaterThan(0);
    expect(V.peak.takeoffPuff).toBeGreaterThan(0);
    expect(B.peak.speedTrail).toBeGreaterThan(0);
  });
});
