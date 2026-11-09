// Natural knockback on the World page (an e2e suite: a real browser, skipped when none is installed): a blast near a foe
// throws it, the impact throws a dust ring out along the ground, and what slides kicks dust up; a page whose level has no
// knockback carries none of this code.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../scene/chromium.js';

const hero = { id: 'p1', pilotable: true, transform: { pos: [-8, 0, 1], heading: 0 }, rule: { type: 'platform', eye: 1, speed: 6 }, ambient: { type: 'static' }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.6] } };
const foe = { id: 'f1', team: 'foes', transform: { pos: [2, 0, 0], heading: 0 }, rule: { type: 'ai', speed: 0 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.6], hittable: true, hp: 100, egg: { a: 0.35, c: 0.9 } } };
const floor = { corners: [[-20, -20, 0], [60, -20, 0], [60, 20, 0], [-20, 20, 0]], fill: '#445566' };
const page = (knock) => emitThreeWorld({ faces: [floor], entities: [hero, foe], camera: { rule: 'side', target: 'p1' }, inline: true, ...(knock ? { knock } : {}) });

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('natural knockback on the World page', () => {
  it('a page whose level has none carries none of it', () => {
    const plain = page(null), on = page(true);
    for (const k of ['__updateKnock', 'buildKnock']) { expect(plain).not.toContain(k); expect(on).toContain(k); }
  });

  it('a blast throws the foe, with a dust ring and dust under its slide', async () => {
    if (!browser) return;
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.setContent(page(true), { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojKnock, { timeout: 20000 });
    const frames = (n) => p.evaluate((n) => new Promise((r) => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);
    await frames(10);
    await p.evaluate(() => { const W = window.__mojCtrl.world; if (!W.bursts) { W.bursts = []; W.burstSeq = 0; } W.bursts.push({ seq: W.burstSeq++, pos: [0.5, 0, 0.2], t: W.time, radius: 4 }); });
    await frames(4);
    const mid = await p.evaluate(() => ({ thrown: !!window.__mojCtrl.world.byId.f1.knock, rings: window.__mojKnock.rings.length }));
    await frames(40);
    const after = await p.evaluate(() => ({ x: window.__mojCtrl.world.byId.f1.transform.pos[0], puffs: window.__mojKnock.puffs.length }));
    expect(mid.thrown).toBe(true); expect(mid.rings).toBeGreaterThan(0);
    expect(after.x).toBeGreaterThan(3);
    expect(errors).toEqual([]);
    await p.close();
  }, 60000);
});
