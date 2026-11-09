// A cinematic staged on a level's page (an e2e suite: a real browser, skipped when none is installed). The play shell's
// flow asks a level to play a scene (game-init params.__stage); the level plays it once it is up and says when it ends
// (game-scene-end). Hosted, the level's scenes wait for the shell's params: a scene on the level's start starts after
// them, and scenes heard together play one after another. A scene the level does not have is said at once; an
// unskippable one keeps its time through Esc.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { CONTRACT_VERSION, MSG_READY, MSG_INIT, MSG_SCENE_END } from './level-contract.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const ORIGIN = 'http://stage.test';
let browser = null, levelHtml = '';
// a stand-in shell: frames the level, answers its ready with params after `delay` ms, and keeps what the level said
const shell = `<!doctype html><body style="margin:0"><iframe id="f" style="width:640px;height:360px;border:0"></iframe><script>
window.__said = [];
addEventListener('message', (e) => {
  if (!e.data || !e.data.moj) return;
  __said.push(e.data);
  if (e.data.moj === '${MSG_READY}') setTimeout(() => document.getElementById('f').contentWindow.postMessage({ moj: '${MSG_INIT}', contractVersion: ${CONTRACT_VERSION}, params: window.__params || {}, seed: 1 }, '*'), window.__delay || 0);
});
</script></body>`;

beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  const { payload } = await resolveWorldScene({ ref: 'vale', title: null, manifest: { kind: 'stage', geocube: 'island-noon', trail: {},
    play: { scenes: [
      { id: 'hello', when: { start: true }, beats: [{ wait: 0.2 }] },
      { id: 'opening', when: { on: 'never-heard' }, beats: [{ wait: 0.3 }] },
      { id: 'long', when: { on: 'never-heard' }, beats: [{ wait: 4 }] },
    ] },
    game: { levelRef: 'vale', produces: { events: [] }, presets: { default: {} } } } });
  levelHtml = emitThreeWorld({ ...payload, inline: true, hud: false });
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 120000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

async function host(params, delay = 0) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (rq) => {
    const u = new URL(rq.url());
    if (u.pathname === '/') rq.respond({ contentType: 'text/html', body: shell });
    else if (u.pathname === '/levels/vale.html') rq.respond({ contentType: 'text/html', body: levelHtml });
    else rq.respond({ status: 404, body: '' });
  });
  await page.evaluateOnNewDocument((p, d) => { if (window === window.top) { window.__params = p; window.__delay = d; } }, params, delay);
  await page.goto(`${ORIGIN}/`);
  await page.evaluate(() => { document.getElementById('f').src = '/levels/vale.html'; });
  const level = async () => { for (;;) { const f = page.frames().find((x) => x.url().endsWith('/levels/vale.html')); if (f) return f; await new Promise((r) => setTimeout(r, 50)); } };
  const said = () => page.evaluate(() => window.__said);
  const ended = (scene, timeout = 20000) => page.waitForFunction((m, s) => window.__said.some((x) => x.moj === m && x.scene === s), { timeout }, MSG_SCENE_END, scene);
  return { page, level, said, ended };
}
const log = (frame) => frame.evaluate(() => window.__mojBus.state.log.map((x) => x && x.type).filter((t) => /^scene-end:/.test(t)));

describe('a cinematic staged on a level\'s page', () => {
  it('waits for the shell\'s params, plays the start scene, then the staged one, and says when the staged one ends', async () => {
    if (!browser) return;
    const H = await host({ __stage: { scene: 'opening' } }, 1200);
    const f = await H.level();
    await f.waitForFunction(() => window.__mojScenes, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600));
    expect(await log(f)).toEqual([]);                                  // no params yet: nothing has played
    await H.ended('opening');
    expect(await log(f)).toEqual(['scene-end:hello', 'scene-end:opening']);   // one after another, the start scene first
    const end = (await H.said()).find((x) => x.moj === MSG_SCENE_END);
    expect(end).toEqual({ moj: MSG_SCENE_END, scene: 'opening' });
    await H.page.close();
  }, 120000);

  it('a scene the level does not have is said at once, so the flow never waits on it', async () => {
    if (!browser) return;
    const H = await host({ __stage: { scene: 'nowhere' } });
    await H.ended('nowhere');
    expect((await H.said()).find((x) => x.moj === MSG_SCENE_END)).toMatchObject({ scene: 'nowhere', missing: true });
    await H.page.close();
  }, 120000);

  it('Esc skips a staged scene, unless it is unskippable', async () => {
    if (!browser) return;
    const esc = (f) => f.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })));
    const playing = (f) => f.waitForFunction(() => window.__mojStage && window.__mojStage.on, { timeout: 30000 });
    const free = await host({ __stage: { scene: 'long' } });
    const ff = await free.level();
    await playing(ff);
    await esc(ff);
    await free.ended('long', 2000);
    await free.page.close();
    const held = await host({ __stage: { scene: 'long', skip: false } });
    const hf = await held.level();
    await playing(hf);
    await esc(hf);
    await new Promise((r) => setTimeout(r, 1500));
    expect((await held.said()).some((x) => x.moj === MSG_SCENE_END)).toBe(false);
    // it keeps its time, then ends: its 4 s are the page's scene clock, which steps at most 0.05 s a frame, so on a
    // slow runner's software WebGL (under 20 frames a second) they take longer than 4 s of the wall's
    await held.ended('long', 60000);
    await held.page.close();
  }, 120000);
});
