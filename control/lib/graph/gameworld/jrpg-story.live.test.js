// THE JRPG STARTER'S STORY on the World page (a real browser, skipped when none is installed): a party RPG composed from
// words is written its story (round-story.js) and it plays. The opening, staged on the town's page as the play shell
// stages it (params.__stage), says its lines in the talk box, the hero's name over them; on the citadel's page (a
// building: story.js binds to its places) the core's line plays as it begins, and the ending, staged, says its lines.
// A moment reached at the town's way out holds the level's end until its line is closed (scene/channels/game.js). The
// story-play spike (control/scripts/spikes/story-play/) is where this was found and what it was found with.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { composeGameworld, runSteps } from './index.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

let browser = null, W = null, S = null;
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const LIB = { forward: 'Walk_Loop', idle: 'Idle_Loop', walk: 'Walk_Loop', turn: 'Walk_Loop', strafe: 'Walk_Loop', leap: 'Jump_Loop' };
// a stage's page, its bodies inline (no run makes them), as the town's live test stands them
async function pageOf(key) {
  const M = structuredClone(S.find((s) => s.key === key).order.manifest);
  Object.entries(M.figures ?? {}).forEach(([k, f], i) => { if (f && f.heroRef) M.figures[k] = { hero: { cast: i % 2 ? 'male' : 'female' }, library: 'quaternius-ual', clips: LIB, ...(f.walker ? { walker: true } : {}) }; });
  const { payload } = await resolveWorldScene({ ref: `sk_${key}`, title: key, manifest: M });
  return { M, html: emitThreeWorld({ ...payload, inline: true }) };
}
beforeAll(async () => {
  W = composeGameworld({ prompt: 'a jrpg where we storm the citadel to save the princess', seed: 3 });
  // (the town's way out a moment too: reached there, the level's end waits for its line)
  W.story = [...W.story, { id: 'gate-words', where: { level: W.hub, place: 'exit' }, when: { reach: 4 }, once: true, beats: [{ line: { who: 'hero', say: 'The road out of town.' } }] }];
  S = runSteps(W, { ref: 'js' });
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 900000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

async function open(html) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojTalk && window.__mojScenes, { timeout: 180000 });
  return page;
}
const talking = (page) => page.waitForFunction(() => window.__mojTalk.state.talk.show && window.__mojTalk.state.talk.text.length > 0, { timeout: 60000 }).then(() => page.evaluate(() => ({ text: window.__mojTalk.state.talk.text, name: document.querySelector('#moj-mana-talk .mana-heading')?.textContent ?? null })));
const skip = async (page) => { await page.keyboard.down('Escape'); await nap(400); await page.keyboard.up('Escape'); await page.waitForFunction(() => !window.__mojScenes.on(), { timeout: 20000 }); };
const stage = (page, scene) => page.evaluate((s) => { window.__mojStage = { scene: s, skip: true, t: 0, on: false, asked: 0 }; }, scene);

describe('the JRPG starter\'s story on the page', () => {
  it('composed: its opening staged on the town\'s page, its ending on the citadel\'s', () => {
    const flow = S.find((s) => s.key === 'game').order.flow.steps, core = W.megaworld.rings.at(-1)[0];
    expect(Object.values(flow).find((s) => s.scene === 'round-opening')).toMatchObject({ stage: `js-level-${W.hub}-0` });
    expect(Object.values(flow).find((s) => s.scene === 'round-ending')).toMatchObject({ stage: `js-level-${core}-0` });
  });

  it('in Chrome: the town\'s opening says its lines, the hero over them; a moment at the way out holds the level\'s end', async () => {
    if (!browser) return;
    const { M, html } = await pageOf(`level-${W.hub}-0`), page = await open(html);
    try {
      await stage(page, 'round-opening');
      const said = await talking(page), first = W.story[0].beats[0].line.say;
      expect(said.name).toBe('Hero');
      expect(first.startsWith(said.text)).toBe(true);
      await skip(page);
      // (stood at the way out: the moment's line comes up, and the level does not end under it)
      const sc = M.play.scenes.find((x) => x.id === 'gate-words');
      // (and the hero called by the name the player gave: the game channel puts a named roster's names here)
      await page.evaluate(() => { window.__mojNames = { hero: 'Ada' }; });
      await page.evaluate((a) => { const C = window.__mojCtrl.world, me = C.byId[C.pilotId]; me.transform.pos[0] = a[0]; me.transform.pos[1] = a[1]; }, sc.when.enter.at);
      expect((await talking(page)).name).toBe('Ada');
      await nap(2500);
      expect(await page.evaluate(() => !!(window.__mojGame && window.__mojGame.envelope))).toBe(false);
      await skip(page);
      await page.waitForFunction(() => !!(window.__mojGame && window.__mojGame.envelope), { timeout: 20000 });
    } finally { await page.close(); }
  }, 900000);

  it('in Chrome: the citadel\'s line as it begins, and its ending staged there', async () => {
    if (!browser) return;
    const core = W.megaworld.rings.at(-1)[0], { html } = await pageOf(`level-${core}-0`), page = await open(html);
    try {
      const begun = await talking(page);
      expect(W.story.find((m) => m.id === 'round-core').beats[0].line.say.startsWith(begun.text)).toBe(true);
      await skip(page);
      await stage(page, 'round-ending');
      const ended = await talking(page);
      expect(W.story.find((m) => m.id === 'round-ending').beats[0].line.say.startsWith(ended.text)).toBe(true);
    } finally { await page.close(); }
  }, 900000);
});
