// Talking faces on the World page (a real browser, skipped when none is installed): a scene's plain lines said by a
// realistic mayor, an anime hero and a landmark guard (its mouth its jaw bone). Built, each line a figure says is a face take on the page's program, its track on
// the speaker's face; in Chrome, while the line plays, the speaker's face moves (its morph weights change from frame to
// frame), and the talk box's portrait shows it.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { playerWorld } from '../player.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { levelHud } from '../../game/hud-mana.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../scene/chromium.js';

let browser = null, html = '', payload = null;
beforeAll(async () => {
  const W = playerWorld({ hero: { cast: 'female' }, id: 'hero', library: false });
  W.figures.hero = { hero: { cast: 'female', head: 'anime' } };
  W.figures.mayor = { hero: { cast: 'male', form: 'realistic', head: 'relational' } };
  W.entities.push({ id: 'mayor', rule: { type: 'static' }, transform: { pos: [2.5, 2, 0], heading: Math.PI }, body: { type: 'figure-rig', figure: 'mayor' } });
  W.figures.guard = { hero: { cast: 'male' } };
  W.entities.push({ id: 'guard', rule: { type: 'static' }, transform: { pos: [2.5, -1, 0], heading: Math.PI }, body: { type: 'figure-rig', figure: 'guard' } });
  W.play = { scenes: [{ id: 'gate', when: { start: true }, names: { mayor: 'Mayor Orlo' }, beats: [
    { line: { who: 'mayor', say: 'The road is shut, and it has been shut since the spring.', expression: 'worried' } },
    { line: { who: 'hero', say: 'Then I will open it myself.', expression: 'determined' } },
    { line: { who: 'guard', say: 'Nobody opens that gate without the mayor saying so.', expression: 'irritated' } },
  ] }] };
  W.manaHud = levelHud('storybook');
  ({ payload } = await resolveWorldScene({ ref: 'sk_talk_mouth', title: 'mouth', manifest: W }));
  html = emitThreeWorld({ ...payload, inline: true });
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 900000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

// the speaker's face, sampled over a while: how far its weights travel from frame to frame
const travel = (page, who, ms) => page.evaluate(async (w, ms) => {
  const meshOf = () => { let f = null; window.__mojCtrl.bodies[w].traverse((x) => { if (!f && x.morphTargetInfluences && x.morphTargetInfluences.length) f = x; }); return f; };
  const m = meshOf(), seen = [];
  const t0 = performance.now();
  while (performance.now() - t0 < ms) { seen.push(Array.from(m.morphTargetInfluences)); await new Promise((r) => requestAnimationFrame(r)); }
  let most = 0;
  for (let i = 1; i < seen.length; i++) for (let j = 0; j < seen[i].length; j++) most = Math.max(most, Math.abs(seen[i][j] - seen[0][j]));
  return { frames: seen.length, most };
}, who, ms);

describe('talking faces on the page', () => {
  it('built: each line a talking head says is a face take, its track on the speaker\'s face', () => {
    const beats = payload.events.scenes[0].beats.filter((b) => b.kind === 'line');
    expect(beats.map((b) => b.take && b.take.clip)).toEqual(['talk:gate:0', 'talk:gate:1', 'talk:gate:2']);
    expect(Object.keys(payload.figures.mayor.face.tracks)).toContain('talk:gate:0');
    expect(Object.keys(payload.figures.hero.face.tracks)).toContain('talk:gate:1');
    // the landmark guard: its face's drawings and its jaw's degrees, beside each other
    expect(Object.keys(payload.figures.guard.face.tracks)).toContain('talk:gate:2');
    expect(Math.max(...payload.figures.guard.face.jaws['talk:gate:2'].d)).toBeGreaterThan(3);
  });

  it('in Chrome: the mayor\'s face moves while he speaks, then the hero\'s while she does', async () => {
    if (!browser) return;
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    try {
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__mojScenes && window.__mojScenes.view().line && window.__mojScenes.view().line.who === 'mayor', { timeout: 60000 });
      const mayor = await travel(page, 'mayor', 2500);
      expect(mayor.frames).toBeGreaterThan(2);   // (a realistic face in software GL draws a few frames a second)
      expect(mayor.most).toBeGreaterThan(0.1);
      // (TALK_SHOT=<png>: the mayor mid-line, his face in the box)
      if (process.env.TALK_SHOT) await page.screenshot({ path: process.env.TALK_SHOT });   // (the mayor)
      await page.keyboard.press('Space');
      await page.waitForFunction(() => window.__mojScenes.view().line && window.__mojScenes.view().line.full, { timeout: 10000 });
      await page.keyboard.press('Space');
      await page.waitForFunction(() => window.__mojScenes.view().line && window.__mojScenes.view().line.who === 'hero', { timeout: 10000 });
      const hero = await travel(page, 'hero', 2500);
      expect(hero.most).toBeGreaterThan(0.1);
      // the guard's jaw: open and shut on the words (the entity's own talkJaw, degrees)
      await page.keyboard.press('Space');
      await page.waitForFunction(() => window.__mojScenes.view().line && window.__mojScenes.view().line.full, { timeout: 10000 });
      await page.keyboard.press('Space');
      await page.waitForFunction(() => window.__mojScenes.view().line && window.__mojScenes.view().line.who === 'guard', { timeout: 10000 });
      const jaw = await page.evaluate(async () => {
        const seen = [], t0 = performance.now();
        while (performance.now() - t0 < 2500) { seen.push(window.__mojCtrl.world.byId.guard.talkJaw || 0); await new Promise((r) => requestAnimationFrame(r)); }
        return seen;
      });
      expect(Math.max(...jaw)).toBeGreaterThan(2);
      expect(new Set(jaw.map((d) => Math.round(d))).size).toBeGreaterThan(1);
    } finally { await page.close(); }
  }, 180000);
});
