// The practice room's page played in a real browser (an e2e suite: skipped when no browser is installed). A template's
// room, built from the recipe before any level (practice-room-page.js): it comes up with no error, its HUD reads the live
// world, and three clicks play the kit's three-beat string, each press taken, every blow landing on the foe.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { practiceRoomHtml } from './practice-room-page.js';
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
    // (the first click takes the mouse; then three presses, each early enough to chain)
    await p.mouse.click(640, 360); await wait(300);
    for (let i = 0; i < 3; i++) { await p.mouse.down(); await wait(60); await p.mouse.up(); await wait(250); }
    await wait(1500);
    const st = await p.evaluate(() => { const W = window.__mojCtrl.world, F = W.entities.find((e) => e.team === 'foes'); return { log: document.getElementById('pr-log').innerText, hits: F.hits || 0, hp: F.body.hp }; });
    expect(st.log.match(/L taken/g) ?? []).toHaveLength(3);
    expect(st.hits).toBe(3);
    expect(st.hp).toBeLessThan(page.foeHp);
    expect(errors).toEqual([]);
    await p.close();
  }, 300000);
});
