// WHAT THEY WEAR, SEEN, on the World page (a real browser, skipped when none is installed): a party RPG composed with
// its wardrobe lays each member's looks on its figure (wardrobe.js wearLooks); on the page every look is built up front
// and the RPG channel shows the one the member's armour slot names (rpg-channel.js dress): put on, the figure swaps;
// taken off, it is the member's own again. The fight is played by the map's figures, so this is the battle's look too.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { composeGameworld, runSteps } from './index.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

let browser = null, W = null, S = null;
const LIB = { forward: 'Walk_Loop', idle: 'Idle_Loop', walk: 'Walk_Loop', turn: 'Walk_Loop', strafe: 'Walk_Loop', leap: 'Jump_Loop' };
// (the town's page, its bodies inline as the story's live test stands them; a look a body in its armour)
async function pageOf(key) {
  const M = structuredClone(S.find((s) => s.key === key).order.manifest);
  for (const [k, f] of Object.entries(M.figures ?? {})) if (f && f.heroRef) M.figures[k] = { hero: { cast: 'male', ...(/-look-/.test(k) ? { adorn: { type: 'armor', style: 'jerkin' } } : {}) }, library: 'quaternius-ual', clips: LIB, ...(f.walker ? { walker: true } : {}) };
  const { payload } = await resolveWorldScene({ ref: `sk_${key}`, title: key, manifest: M });
  return { M, html: emitThreeWorld({ ...payload, inline: true }) };
}
beforeAll(async () => {
  W = composeGameworld({ prompt: 'a jrpg where we storm the citadel to save the princess', seed: 3 });
  W.battles = { ...W.battles, wardrobe: true };
  S = runSteps(W, { ref: 'wd' });
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 900000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('what the party wears, seen', () => {
  it('composed: every level lays the members\' looks on their figures', () => {
    const M = S.find((s) => s.key === `level-${W.hub}-0`).order.manifest, hero = M.entities.find((e) => e.id === 'hero');
    expect(hero.looks.base).toBe('hero');
    expect(Object.keys(hero.looks.by).length).toBeGreaterThan(0);
    for (const f of Object.values(hero.looks.by)) expect(M.figures[f].heroRef).toMatch(/-look-/);
  });

  it('in Chrome: armour put on swaps the figure, taken off it is the member\'s own again', async () => {
    if (!browser) return;
    const { M, html } = await pageOf(`level-${W.hub}-0`), page = await browser.newPage();
    try {
      await page.setViewport({ width: 960, height: 540 });
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojRpg, { timeout: 180000 });
      const item = Object.keys(M.entities.find((e) => e.id === 'hero').looks.by)[0];
      const fig = () => page.evaluate(() => window.__mojCtrl.world.byId.hero.body.figure);
      // (the starter's armour may already be on: off first, then on)
      await page.evaluate(() => { delete window.__mojRpg.R.m.hero.gear.armor; });
      await page.waitForFunction(() => window.__mojCtrl.world.byId.hero.body.figure === 'hero', { timeout: 20000 });
      await page.evaluate((it) => { window.__mojRpg.R.m.hero.gear.armor = it; }, item);
      await page.waitForFunction((it) => window.__mojCtrl.world.byId.hero.body.figure === `hero-look-${it}`, { timeout: 20000 }, item);
      expect(await fig()).toBe(`hero-look-${item}`);
      await page.evaluate(() => { delete window.__mojRpg.R.m.hero.gear.armor; });
      await page.waitForFunction(() => window.__mojCtrl.world.byId.hero.body.figure === 'hero', { timeout: 20000 });
    } finally { await page.close(); }
  }, 900000);
});
