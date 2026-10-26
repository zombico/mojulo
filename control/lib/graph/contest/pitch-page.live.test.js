// The team game on the World page (an e2e suite: a real browser, skipped when none is installed): a soccer exhibition
// the two computer sides play in the page reaches the state the same match reaches in Node, frame for frame.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { teamArenaData } from './team-arena.js';
import { newTeam, stepTeam, teamContext, teamDisplay } from './team-sim.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const FLOOR = { corners: [[-25, -2, 0], [25, -2, 0], [25, 70, 0], [-25, 70, 0]], fill: '#4f8a5a' };
let browser = null;
async function open(data) {
  const page = await browser.newPage();
  await page.setContent(emitThreeWorld({ faces: [FLOOR], pitch: data, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojPitch && window.__mojPitch.phase !== undefined, { timeout: 20000 });
  return page;
}
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the team game on the World page', () => {
  it('plays a soccer exhibition to the state the same match reaches in Node', async () => {
    if (!browser) return;
    const data = teamArenaData({ sport: 'soccer', players: 0, level: 'ace', seconds: 30, seed: 3 });
    const page = await open(data);
    const out = await page.evaluate(() => { const m = window.__mojPitch; const S = m.run(40); return { phase: m.phase, f: S.f, score: S.K.score, kicks: S.calls.filter((c) => c.kind === 'kick').length, display: m.display() }; });
    expect(out.f).toBeGreaterThanOrEqual(40 * 60 - 1);
    const ctx = teamContext(data);
    const S = newTeam(ctx);
    for (let i = 0; i < out.f; i++) stepTeam(S, [], ctx);
    expect(S.f).toBe(out.f);
    expect(out.kicks).toBeGreaterThan(0);
    expect(out.kicks).toBe(S.calls.filter((c) => c.kind === 'kick').length);
    expect(out.score).toEqual(S.K.score);
    expect(out.display.clock).toEqual(teamDisplay(S, ctx).clock);
    await page.close();
  }, 120000);
});
