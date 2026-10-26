// The meet on the World page (an e2e suite: a real browser, skipped when none is installed): an exhibition the
// computer lanes run in the page ends where the same meet ends in Node, frame for frame, and the page says so through
// its probe.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { meetArenaData } from './meet-arena.js';
import { newMeet, stepMeet, meetContext } from './meet-sim.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const FLOOR = { corners: [[-70, -2, 0], [70, -2, 0], [70, 12, 0], [-70, 12, 0]], fill: '#8a8f7a' };
let browser = null;
async function open(data) {
  const page = await browser.newPage();
  await page.setContent(emitThreeWorld({ faces: [FLOOR], meet: data, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojMeet && window.__mojMeet.phase !== undefined, { timeout: 20000 });
  return page;
}
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the meet on the World page', () => {
  it('runs an exhibition to the placings the same meet reaches in Node', async () => {
    if (!browser) return;
    const data = meetArenaData({ event: 'hurdles', lanes: 3, players: 0, register: 'action', seed: 3 });
    const page = await open(data);
    const out = await page.evaluate(() => { const m = window.__mojMeet; const S = m.run(60); return { phase: m.phase, f: S.f, placings: S.placings, lanes: m.lanes() }; });
    const ctx = meetContext(data);
    let S = newMeet(ctx), n = 0;
    while (!S.over && n++ < 20000) stepMeet(S, [], ctx);
    expect(out.phase).toBe('over');
    expect(out.f).toBe(S.f);
    expect(out.placings).toEqual(S.placings);
    expect(out.lanes.map((l) => l.clips)).toEqual(S.r.map((r) => r.clips));
    await page.close();
  }, 120000);
});
