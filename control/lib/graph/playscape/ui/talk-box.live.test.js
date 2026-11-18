// The talk box on the World page (a real browser, skipped when none is installed): a level whose HUD is mana-ui's plays
// a scene, and its lines and choices are drawn by mana-ui's talk presenter in the HUD's look, the page's own box put
// away and the HUD stepped aside while it plays. The input stays the scene channel's: a press goes on, a choice's row
// clicked is that answer.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { playerWorld } from '../player.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { levelHud } from '../../game/hud-mana.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../scene/chromium.js';

let browser = null, html = '';
beforeAll(async () => {
  const W = playerWorld({ hero: { cast: 'female' }, id: 'hero', library: false });
  W.figures.hero = { hero: { cast: 'female' } };
  W.entities.push({ id: 'mayor', rule: { type: 'static' }, transform: { pos: [3, 2, 0], heading: Math.PI }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } });
  W.play = { scenes: [{ id: 'gate', when: { start: true }, names: { mayor: 'Mayor Orlo' }, beats: [
    { line: { who: 'mayor', say: 'The road is shut.' } },
    { choose: { who: 'mayor', say: 'Will you wait?', options: [{ say: 'I will wait.', sets: ['waited'] }, { say: 'I climb tonight.', sets: ['climbed'] }] } },
  ] }] };
  W.manaHud = levelHud('storybook');
  const { payload } = await resolveWorldScene({ ref: 'sk_talk_box', title: 'talk', manifest: W });
  html = emitThreeWorld({ ...payload, inline: true });
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 600000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the talk box on the page', () => {
  it('built: the HUD host carries it, the scene channel is as it was', () => {
    expect(html).toContain('moj-mana-talk');
    expect(html).toContain('moj-scene-box');
  });

  it('in Chrome: a line in the nameplate and the words, the page\'s box away; a choice row clicked is the answer', async () => {
    if (!browser) return;
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    try {
      await page.setContent(html, { waitUntil: 'load' });
      // (the presenter draws on its own frame, one behind the state the HUD host writes)
      await page.waitForFunction(() => window.__mojTalk && window.__mojTalk.state.talk.more && (document.getElementById('moj-mana-talk')?.textContent || '').includes('▼'), { timeout: 30000 });
      const line = await page.evaluate(() => ({
        name: document.querySelector('#moj-mana-talk .mana-heading')?.textContent,
        words: document.querySelector('#moj-mana-talk')?.textContent,
        box: getComputedStyle(document.querySelector('.moj-scene-box')).display,
        hud: getComputedStyle(document.getElementById('moj-mana-hud')).visibility,
      }));
      expect(line).toMatchObject({ name: 'Mayor Orlo', box: 'none', hud: 'hidden' });
      expect(line.words).toContain('The road is shut.');
      expect(line.words).toContain('▼');
      await page.keyboard.press('Space');
      await page.waitForFunction(() => window.__mojTalk.state.talk.text === 'Will you wait?' && document.querySelectorAll('#moj-mana-talk .mana-each > *').length === 2, { timeout: 10000 });
      // (TALK_SHOT=<png>: the box with a choice up, for the eyes)
      if (process.env.TALK_SHOT) await page.screenshot({ path: process.env.TALK_SHOT });
      const rows = await page.$$('#moj-mana-talk .mana-each > *');
      expect(rows.length).toBe(2);
      await rows[1].click();
      await page.waitForFunction(() => !window.__mojScenes.on(), { timeout: 10000 });
      const vars = await page.evaluate(() => window.__mojBus.state.vars);
      expect(vars['flag-climbed']).toBeTruthy();
      expect(vars['flag-waited']).toBeFalsy();
      expect(await page.evaluate(() => getComputedStyle(document.getElementById('moj-mana-hud')).visibility)).toBe('visible');
    } finally { await page.close(); }
  }, 120000);
});
