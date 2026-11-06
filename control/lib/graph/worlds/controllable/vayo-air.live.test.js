// A blast's air on a World page's fires (an e2e suite: a real browser, skipped when none is installed). Crates of pine
// burn on the floor beside a torch on the flow (`fire.gusts`); a blast to the west blows out the near crate (its bed left
// glowing) and the torch (it stays out), fans the far crate, and a page with no gusts carries none of this code.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../scene/chromium.js';
import { blockFires, firePageChannel, resolveFire } from '../../fire/fire.js';
import { blockMatter } from '../../rupa/matter.js';

const hero = { id: 'p1', pilotable: true, transform: { pos: [-6, 0, 0], heading: 0 }, rule: { type: 'platform', eye: 0, speed: 6 }, ambient: { type: 'static' }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.6] } };
const floor = { corners: [[-20, -10, 0], [30, -10, 0], [30, 10, 0], [-20, 10, 0]], fill: '#445566' };
const crate = (id, x, y = 0) => ({ id, min: [x, y, 0], max: [x + 0.4, y + 0.4, 0.4], hp: 1, ...blockMatter({ min: [x, y, 0], max: [x + 0.4, y + 0.4, 0.4] }, 'pine') });
const page = (gusts) => {
  const breakables = [crate('near', 5), crate('far', 14)];
  const torch = resolveFire({ sources: [{ kind: 'torch', at: [6, 3, 1.2] }] });
  const fire = firePageChannel({ ...torch, sources: [...torch.sources, ...blockFires(breakables, { from: torch.sources.length })] });
  return emitThreeWorld({ faces: [floor], entities: [hero], camera: { rule: 'side', target: 'p1' }, breakables, rupa: {}, fire: gusts ? { ...fire, gusts: true } : fire, inline: true });
};

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('a blast\'s air on the World page\'s fires', () => {
  it('a page with no gusts carries none of it', () => {
    const plain = page(false), on = page(true);
    for (const k of ['vayo-air', '__fireGust', '__fireGutter', 'vayoAir: true']) { expect(plain).not.toContain(k); expect(on).toContain(k); }
  });

  it('a blast blows out the near crate and the torch, fans the far crate, and the near bed glows', async () => {
    if (!browser) return;
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.setContent(page(true), { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojCtrl.air && window.__mojFire, { timeout: 20000 });
    const frames = (n) => p.evaluate((n) => new Promise((r) => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);
    await p.evaluate(() => { const C = window.__mojCtrl, W = C.world; for (const id of ['near', 'far']) { const b = W.breakables.find((q) => q.id === id); C.heat(id, b.rupa.heatCap * 400); } });
    await frames(30);
    const before = await p.evaluate(() => window.__mojCtrl.world.breakables.find((q) => q.id === 'far').rupa.burnRate);
    await p.evaluate(() => { const W = window.__mojCtrl.world; if (!W.bursts) { W.bursts = []; W.burstSeq = 0; } W.bursts.push({ seq: W.burstSeq++, pos: [0, 0.2, 0.2], t: W.time, radius: 4 }); });
    await frames(6);
    const s = await p.evaluate(() => {
      const W = window.__mojCtrl.world, F = window.__mojFire, b = (id) => W.breakables.find((q) => q.id === id);
      const torch = F.kernel.src(0), nearSrc = F.kernel.src(1);
      return { near: b('near').rupa.burning, blown: b('near').rupa.air.blown != null, far: b('far').rupa.burning, farRate: b('far').rupa.burnRate,
        torchOut: Number.isFinite(torch.life && torch.life.out), nearDie: nearSrc.life && nearSrc.life.die, hits: W.rupa.hits.map((h) => h.how) };
    });
    expect(s.near).toBe(false);
    expect(s.blown).toBe(true);
    expect(s.hits).toContain('blowout');
    expect(s.nearDie).toBe(0.2);
    expect(s.torchOut).toBe(true);
    expect(s.far).toBe(true);
    expect(s.farRate).toBeGreaterThan(before);
    expect(errors).toEqual([]);
    await p.close();
  }, 60000);
});
