// A hero's vayo moves on the World page (an e2e suite: a real browser, skipped when none is installed): V dashes on the
// ground and leaves its element's trail, V in the air takes flight and the jump key climbs; a page whose hero has none
// carries none of this code.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../scene/chromium.js';

const hero = (vayo) => ({ id: 'p1', pilotable: true, transform: { pos: [0, 0, 1], heading: 0 }, rule: { type: 'platform', eye: 1, speed: 6, ...(vayo ? { vayo } : {}) }, ambient: { type: 'static' }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.6] } });
const floor = { corners: [[-20, -20, 0], [60, -20, 0], [60, 20, 0], [-20, 20, 0]], fill: '#445566' };
const page = (vayo) => emitThreeWorld({ faces: [floor], entities: [hero(vayo)], camera: { rule: 'side', target: 'p1' }, inline: true });

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('vayo moves on the World page', () => {
  it('a page whose hero has none carries none of it', () => {
    const plain = page(null), on = page({ element: 'wind', dash: true, flight: true });
    for (const k of ['__updateVayo', 'vayo-wake', "__kbRead('KeyV')"]) { expect(plain).not.toContain(k); expect(on).toContain(k); }
  });

  it('V dashes with a trail, and in the air takes flight', async () => {
    if (!browser) return;
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.setContent(page({ element: 'wind', dash: true, flight: true }), { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojVayo, { timeout: 20000 });
    const frames = (n) => p.evaluate((n) => new Promise((r) => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);
    const pos = () => p.evaluate(() => [...window.__mojCtrl.world.byId.p1.transform.pos]);
    await frames(20);
    const a = await pos();
    await p.keyboard.down('KeyV'); await frames(3);
    const mid = await p.evaluate(() => { const h = window.__mojCtrl.world.byId.p1; return { kind: h.vayo && h.vayo.kind, trail: window.__mojVayo.trails.has('p1') }; });
    await p.keyboard.up('KeyV'); await frames(80);
    const b = await pos();
    expect(mid.kind).toBe('dash'); expect(mid.trail).toBe(true);
    expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeGreaterThan(3);
    // jump, then V in the air: flight; the jump key held climbs
    await p.keyboard.down('Space'); await frames(4);
    await p.keyboard.down('KeyV'); await frames(2); await p.keyboard.up('KeyV');
    await frames(40);
    const fly = await p.evaluate(() => { const h = window.__mojCtrl.world.byId.p1; return { kind: h.vayo && h.vayo.kind, z: h.transform.pos[2] }; });
    await p.keyboard.up('Space');
    expect(fly.kind).toBe('flight'); expect(fly.z).toBeGreaterThan(2);
    expect(errors).toEqual([]);
    await p.close();
  }, 60000);
});
