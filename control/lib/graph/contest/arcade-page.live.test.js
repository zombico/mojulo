// The arcade cards on the World page (an e2e suite: a real browser, skipped when none is installed): each distinct court
// the arcade rules add plays an exhibition in the page to the state the same match reaches in Node, without a page
// error: the table (a raised bed, the serve's own bounce), the kitchen (a no-volley region, the two-bounce rule), the
// shuttle (its own air, no bounce). MOJULO_SHOTS=<dir> keeps a frame of each.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { matchArenaData } from './match-arena.js';
import { newMatch, stepMatch, matchContext } from './match-sim.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const FLOOR = { corners: [[-12, -2, 0], [12, -2, 0], [12, 40, 0], [-12, 40, 0]], fill: '#4f8a5a' };
const SHOTS = process.env.MOJULO_SHOTS || null;
let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the arcade cards on the World page', () => {
  for (const [sport, seconds] of [['pingpong', 12], ['pickleball', 12], ['badminton', 12]]) {
    it(`${sport}: an exhibition in the page reaches the state the same match reaches in Node`, async () => {
      if (!browser) return;
      const data = matchArenaData({ sport, players: 0, register: 'action', seed: 2 });
      const page = await browser.newPage();
      await page.setViewport({ width: 960, height: 540 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setContent(emitThreeWorld({ faces: [FLOOR], court: data, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__mojCourt && window.__mojCourt.phase !== undefined, { timeout: 20000 });
      const out = await page.evaluate((s) => { const S = window.__mojCourt.run(s); return { f: S.f, score: S.K.score, calls: S.calls.length }; }, seconds);
      await new Promise((r) => setTimeout(r, 300));
      if (SHOTS) await page.screenshot({ path: join(SHOTS, `arcade-${sport}.png`) });
      await page.close();
      expect(errors).toEqual([]);
      const ctx = matchContext(data), S = newMatch(ctx);
      for (let i = 0; i < out.f; i++) stepMatch(S, [], ctx);
      expect(out.score).toEqual(S.K.score);
      expect(out.calls).toBe(S.calls.length);
      expect(S.calls.some((c) => c.kind === 'point')).toBe(true);
    }, 120000);
  }
});
