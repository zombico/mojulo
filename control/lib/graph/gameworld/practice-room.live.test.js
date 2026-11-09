// The practice room's page played in a real browser (an e2e suite: skipped when no browser is installed). A template's
// room, built from the recipe before any level (practice-room-page.js): it comes up with no error, its HUD reads the live
// world, and three clicks play the kit's three-beat string, each press taken, every blow landing on the foe. The door's
// other rooms the same way: the platform room's hero jumps, the mount lane's hero gets on its horse and rides it.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { practiceRoomHtml, practiceHtml } from './practice-room-page.js';
import { POLES } from './feel/cards.js';
import { TEMPLATE_ARSENALS } from './combos.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

// (a template with a kit whose sword opens on a three-beat light string, chosen from the table)
const KIT = Object.keys(TEMPLATE_ARSENALS).find((id) => TEMPLATE_ARSENALS[id].weapons[0].combos.some((c) => c.beats.join(' ') === 'L L L'));
let browser = null, page = null;
beforeAll(async () => {
  page = await practiceRoomHtml({ id: 'room-live', name: 'Room', feel: KIT }, { sound: 'none' });
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 600000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the practice room in a browser', () => {
  it('comes up with no error, and L L L plays the kit\'s string on the foe', async () => {
    expect(page.string).toMatchObject({ beats: 'L L L', hits: 3 });
    if (!browser) return;
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 720 });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.setContent(page.html, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world, { timeout: 120000 });
    await wait(1000);
    expect(await p.evaluate(() => document.getElementById('pr')?.innerText ?? '')).toMatch(/foe AI off/);
    // (the first click takes the mouse; then three presses on the page's own clock: each held until the runtime has
    // judged it, so a page drawing a few frames a second in software never misses a press between two frames, and each
    // made while the move before it plays, so it is held to that move's cancel)
    await p.mouse.click(640, 360); await wait(300);
    const hero = () => p.evaluate(() => { const W = window.__mojCtrl.world, H = W.entities.find((e) => e.pilotable); return { seq: H.mvPress ? H.mvPress.seq : 0, n: H.swingCount || 0 }; });
    for (let i = 0; i < 3; i++) {
      const { seq } = await hero();
      await p.mouse.down();
      await p.waitForFunction((s) => { const H = window.__mojCtrl.world.entities.find((e) => e.pilotable); return !!H.mvPress && H.mvPress.seq > s; }, { timeout: 30000 }, seq);
      await p.mouse.up();
      // (the move it started under way, and the button seen up for a frame of the page's own before the next press: a
      // release and a press between the same two frames read as the button held, and no new press)
      await p.waitForFunction((k) => (window.__mojCtrl.world.entities.find((e) => e.pilotable).swingCount || 0) > k, { timeout: 30000 }, i);
      const t0 = await p.evaluate(() => window.__mojCtrl.world.time);
      await p.waitForFunction((t) => window.__mojCtrl.world.time > t + 0.02, { timeout: 30000 }, t0);
    }
    // (the string played out: the finisher ended)
    await p.waitForFunction(() => window.__mojCtrl.world.entities.find((e) => e.pilotable).swingT == null, { timeout: 30000 });
    await wait(500);
    const st = await p.evaluate(() => { const W = window.__mojCtrl.world, F = W.entities.find((e) => e.team === 'foes'); return { log: document.getElementById('pr-log').innerText, hits: F.hits || 0, hp: F.body.hp }; });
    expect(st.log.match(/L taken/g) ?? [], st.log).toHaveLength(3);
    expect(st.hits).toBe(3);
    expect(st.hp).toBeLessThan(page.foeHp);
    expect(errors).toEqual([]);
    await p.close();
  }, 300000);

  const boot = async (html) => {
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 720 });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.setContent(html, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world, { timeout: 120000 });
    return { p, errors, wait: (ms) => new Promise((r) => setTimeout(r, ms)) };
  };
  const PLATFORMER = Object.keys(POLES).find((id) => POLES[id].base === 'platformer' && !POLES[id].demo.includes('attack'));

  it('the platform room: up with no error, its hero leaving the ground on a jump, its foes standing', async () => {
    const page2 = await practiceHtml({ id: 'room-live-p', feel: PLATFORMER }, 'platform', { sound: 'none' });
    if (!browser) return;
    const { p, errors, wait } = await boot(page2.html);
    await wait(800);
    await p.mouse.click(640, 360); await wait(300);
    const z = () => p.evaluate(() => window.__mojCtrl.world.entities.find((e) => e.pilotable).transform.pos[2]);
    const z0 = await z();
    let top = z0;
    await p.keyboard.down('Space');
    for (let i = 0; i < 12; i++) { await wait(60); top = Math.max(top, await z()); }
    await p.keyboard.up('Space');
    expect(top - z0).toBeGreaterThan(0.5);
    expect(await p.evaluate(() => window.__mojCtrl.world.entities.filter((e) => e.team === 'foes').length)).toBe(4);
    expect(errors).toEqual([]);
    await p.close();
  }, 300000);

  it('the mount lane: up with no error, E puts the hero on its horse, W rides it on', async () => {
    const page3 = await practiceHtml({ id: 'room-live-m', mounts: [{ coat: 'chestnut' }] }, 'mount', { sound: 'none' });
    if (!browser) return;
    const { p, errors, wait } = await boot(page3.html);
    await wait(800);
    await p.mouse.click(640, 360); await wait(300);
    // (held a few frames, so a page drawing slowly in software reads it; getting on takes the hero a moment)
    await p.keyboard.down('KeyE'); await wait(250); await p.keyboard.up('KeyE');
    await p.waitForFunction(() => !!window.__mojCtrl.world.entities.find((e) => e.pilotable).mountedOn, { timeout: 20000 });
    // (urged on, the horse covers ground down the lane: read while W is still held, as letting go reins it back)
    const y = () => p.evaluate(() => window.__mojCtrl.world.entities.find((e) => e.rule && e.rule.type === 'ride').transform.pos[1]);
    const y0 = await y();
    // (getting on plays out first, then the horse comes up through its gaits: waited for on the page's clock)
    await p.keyboard.down('KeyW');
    await p.waitForFunction((y0) => window.__mojCtrl.world.entities.find((e) => e.rule && e.rule.type === 'ride').transform.pos[1] > y0 + 1, { timeout: 60000 }, y0);
    expect((await y()) - y0).toBeGreaterThan(1);
    await p.keyboard.up('KeyW');
    expect(errors).toEqual([]);
    await p.close();
  }, 600000);
});
