// The bat-and-ball games on the World page (an e2e suite: a real browser, skipped when none is installed): a baseball
// and a cricket exhibition the two computer sides play in the page reach the state the same game reaches in Node, frame
// for frame, without a page error: the diamond (the pitch, the strike zone, the bases) and the oval (the bowl, the
// over, runs between the wickets). MOJULO_SHOTS=<dir> keeps a frame of each.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { inningsArenaData } from './innings-arena.js';
import { newBat, stepBat, batContext } from './bat-sim.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const FLOOR = { corners: [[-110, -2, 0], [110, -2, 0], [110, 130, 0], [-110, 130, 0]], fill: '#4f8a5a' };
const SHOTS = process.env.MOJULO_SHOTS || null;
let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the bat-and-ball games on the World page', () => {
  for (const [sport, words] of [['baseball', { innings: 1 }], ['cricket', { overs: 1 }]]) {
    it(`${sport}: an exhibition in the page reaches the state the same game reaches in Node`, async () => {
      if (!browser) return;
      const data = inningsArenaData({ sport, players: 0, register: 'action', seed: 2, ...words });
      const page = await browser.newPage();
      await page.setViewport({ width: 960, height: 540 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setContent(emitThreeWorld({ faces: [FLOOR], innings: data, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__mojInnings && window.__mojInnings.phase !== undefined, { timeout: 20000 });
      const out = await page.evaluate(() => { const S = window.__mojInnings.run(30); return { f: S.f, total: S.K.total, runs: S.K.runs, calls: S.calls.length, kinds: [...new Set(S.calls.map((c) => c.kind))] }; });
      await new Promise((r) => setTimeout(r, 300));
      if (SHOTS) await page.screenshot({ path: join(SHOTS, `innings-${sport}.png`) });
      await page.close();
      expect(errors).toEqual([]);
      const ctx = batContext(data), S = newBat(ctx);
      for (let i = 0; i < out.f; i++) stepBat(S, [], ctx);
      expect(out.total).toEqual(S.K.total);
      expect(out.runs).toEqual(S.K.runs);
      expect(out.calls).toBe(S.calls.length);
      expect(out.kinds.length).toBeGreaterThan(1);
    }, 120000);
  }
});
