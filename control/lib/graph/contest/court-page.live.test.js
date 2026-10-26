// The court on the World page (an e2e suite: a real browser, skipped when none is installed): an exhibition the two
// minds play in the page reaches the state the same match reaches in Node, frame for frame, and the page's probe says so.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { matchArenaData } from './match-arena.js';
import { newMatch, stepMatch, matchContext, matchDisplay } from './match-sim.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const FLOOR = { corners: [[-12, -2, 0], [12, -2, 0], [12, 40, 0], [-12, 40, 0]], fill: '#4f8a5a' };
let browser = null;
async function open(data) {
  const page = await browser.newPage();
  await page.setContent(emitThreeWorld({ faces: [FLOOR], court: data, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCourt && window.__mojCourt.phase !== undefined, { timeout: 20000 });
  return page;
}
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the court on the World page', () => {
  it('plays an exhibition to the state the same match reaches in Node', async () => {
    if (!browser) return;
    const data = matchArenaData({ sport: 'tennis', players: 0, register: 'action', level: 'ace', seed: 3 });
    const page = await open(data);
    // the page's own frame loop may have stepped a few frames before the probe runs: Node steps to the page's count
    const out = await page.evaluate(() => { const m = window.__mojCourt; const S = m.run(40); return { phase: m.phase, f: S.f, score: S.K.score, points: S.calls.filter((c) => c.kind === 'point').length, display: m.display() }; });
    expect(out.f).toBeGreaterThanOrEqual(40 * 60);
    const ctx = matchContext(data);
    const S = newMatch(ctx);
    for (let i = 0; i < out.f; i++) stepMatch(S, [], ctx);
    expect(S.f).toBe(out.f);
    expect(out.points).toBeGreaterThan(0);
    expect(out.points).toBe(S.calls.filter((c) => c.kind === 'point').length);
    expect(out.score).toEqual(S.K.score);
    expect(out.display.score).toEqual(matchDisplay(S, ctx).score);
    await page.close();
  }, 120000);
});
