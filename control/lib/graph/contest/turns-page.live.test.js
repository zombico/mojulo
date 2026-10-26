// The turn sport on the World page (an e2e suite: a real browser, skipped when none is installed): a bowling exhibition
// the two minds play in the page reaches the state the same game reaches in Node, frame for frame, and the page's
// probe says so.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { turnsArenaData } from './turn-arena.js';
import { newTurns, stepTurns, turnContext, turnsDisplay } from './turn-sim.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const FLOOR = { corners: [[-12, -2, 0], [12, -2, 0], [12, 60, 0], [-12, 60, 0]], fill: '#4f8a5a' };
let browser = null;
async function open(data) {
  const page = await browser.newPage();
  await page.setContent(emitThreeWorld({ faces: [FLOOR], turns: data, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojTurns && window.__mojTurns.phase !== undefined, { timeout: 20000 });
  return page;
}
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the turn sport on the World page', () => {
  it('plays a bowling exhibition to the state the same game reaches in Node', async () => {
    if (!browser) return;
    const data = turnsArenaData({ sport: 'bowling', seats: 2, players: 0, level: 'veteran', rounds: 2, seed: 3 });
    const page = await open(data);
    // the page's own frame loop may have stepped a few frames before the probe runs: Node steps to the page's count
    const out = await page.evaluate(() => { const m = window.__mojTurns; const S = m.run(40); return { phase: m.phase, f: S.f, over: S.over, totals: S.K.totals, rolls: S.calls.filter((c) => c.kind === 'roll').length, display: m.display() }; });
    expect(out.f).toBeGreaterThanOrEqual(40 * 60 - 1);
    const ctx = turnContext(data);
    const S = newTurns(ctx);
    for (let i = 0; i < out.f; i++) stepTurns(S, null, ctx);
    expect(S.f).toBe(out.f);
    expect(out.rolls).toBeGreaterThan(0);
    expect(out.rolls).toBe(S.calls.filter((c) => c.kind === 'roll').length);
    expect(out.display.seats).toEqual(turnsDisplay(S, ctx).seats);
    await page.close();
  }, 120000);
});
