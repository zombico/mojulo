// The arcade rules on the pitch, on the World page (an e2e suite: a real browser, skipped when none is installed): each
// distinct procedure plays an exhibition in the page to the state the same game reaches in Node, without a page error:
// the hoop (the rings, the hands), a carry game of tackles and one of downs (the plays, the posts, the line markers).
// MOJULO_SHOTS=<dir> keeps a frame of each.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { teamArenaData } from './team-arena.js';
import { newTeam, stepTeam, teamContext } from './team-sim.js';
import { ARCADE_SPORT_IDS } from './arcade-rules.js';
import { resolveSport } from './sports.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const FLOOR = { corners: [[-30, -4, 0], [30, -4, 0], [30, 60, 0], [-30, 60, 0]], fill: '#4f8a5a' };
const SHOTS = process.env.MOJULO_SHOTS || null;
let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the arcade rules on the pitch, on the World page', () => {
  const team = ARCADE_SPORT_IDS.filter((id) => resolveSport(id).shape === 'team');
  const cases = [team.find((id) => resolveSport(id).goal.hoop), team.find((id) => resolveSport(id).carry?.style === 'tackles'), team.find((id) => resolveSport(id).carry?.style === 'downs')];
  for (const sport of cases) {
    it(`${sport}: an exhibition in the page reaches the state the same game reaches in Node`, async () => {
      if (!browser) return;
      const data = teamArenaData({ sport, players: 0, register: 'action', seed: 2, periods: 1, seconds: 60 });
      const page = await browser.newPage();
      await page.setViewport({ width: 960, height: 540 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setContent(emitThreeWorld({ faces: [FLOOR], pitch: data, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__mojPitch && window.__mojPitch.phase !== undefined, { timeout: 20000 });
      const out = await page.evaluate(() => { const S = window.__mojPitch.run(20); return { f: S.f, score: S.K.score, calls: S.calls.length }; });
      await new Promise((r) => setTimeout(r, 300));
      if (SHOTS) await page.screenshot({ path: join(SHOTS, `arcade-${sport}.png`) });
      await page.close();
      expect(errors).toEqual([]);
      const ctx = teamContext(data), S = newTeam(ctx);
      for (let i = 0; i < out.f; i++) stepTeam(S, [], ctx);
      expect(out.score).toEqual(S.K.score);
      expect(out.calls).toBe(S.calls.length);
    }, 120000);
  }
});
