// The play shell's pause is the seat's that opened it (an e2e suite: a real browser, skipped when none is installed;
// docs/local-multiplayer-principles.md): a level with seats tells the shell who sits where (game-seats); a pad's start
// opens the pause, the panel names that pad's seat in its colour, another pad's start leaves it open, and the same pad's
// start closes it.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitPlayShell } from './play-shell.js';
import { normalizeGameManifest } from './game-manifest.js';
import { normalizeLevelContract, CONTRACT_VERSION, MSG_READY, MSG_INIT, MSG_SEATS } from './level-contract.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const ORIGIN = 'http://game.test';
const GAME = normalizeGameManifest({ kind: 'game', title: 'Duo', shell: 'play', store: { slices: [{ name: 'campaign', kind: 'progression' }] }, levels: [{ ref: 'duo', title: 'Duo' }] });
const LEVELS = [{ ref: 'duo', contract: normalizeLevelContract({ levelRef: 'duo', consumes: [{ slice: 'campaign' }], produces: { events: [] } }) }];
// a level that never ends, with two seats: P1 on pad 1, P2 on pad 0
const SEATS = [{ n: 1, label: 'P1', color: '#e5483b', controller: 'pad:1', away: false }, { n: 2, label: 'P2', color: '#3b7be5', controller: 'pad:0', away: false }];
const level = `<!doctype html><script>
addEventListener('message', (e) => {
  if (!e.data || e.data.moj !== '${MSG_INIT}') return;
  parent.postMessage({ moj: '${MSG_SEATS}', seats: ${JSON.stringify(SEATS)} }, '*');
  parent.__inited = true;
});
parent.postMessage({ moj: '${MSG_READY}', contractVersion: ${CONTRACT_VERSION} }, '*');
</script>`;

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the pause is the seat\'s that opened it', () => {
  it('pad 0 (P2) opens it and names its seat; pad 1\'s start leaves it open; pad 0\'s start closes it', async () => {
    if (!browser) return;
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (rq) => {
      const u = new URL(rq.url());
      if (u.pathname === '/') rq.respond({ contentType: 'text/html', body: emitPlayShell(GAME, LEVELS, { startLevel: 'duo' }) });
      else if (u.pathname === '/levels/duo.html') rq.respond({ contentType: 'text/html', body: level });
      else rq.respond({ status: 404, body: '' });
    });
    await page.evaluateOnNewDocument(() => {
      const mk = (i) => ({ index: i, id: 'stub pad ' + i, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
      window.__pads = [mk(0), mk(1)];
      navigator.getGamepads = () => window.__pads;
    });
    await page.goto(`${ORIGIN}/`);
    await page.waitForFunction(() => window.__inited === true, { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 300));
    const start = async (i) => {
      await page.evaluate((i) => { window.__pads[i].buttons[9] = { pressed: true, value: 1 }; }, i);
      await new Promise((r) => setTimeout(r, 120));
      await page.evaluate((i) => { window.__pads[i].buttons[9] = { pressed: false, value: 0 }; }, i);
      await new Promise((r) => setTimeout(r, 120));
    };
    const pause = () => page.evaluate(() => { const p = document.getElementById('pause'), h = p.querySelector('h2'); return { open: p.style.display === 'flex', title: h ? h.textContent : null, color: h ? h.style.color : null }; });

    await start(0);
    expect(await pause()).toEqual({ open: true, title: 'paused · P2', color: 'rgb(59, 123, 229)' });
    await start(1);                       // another seat's start: still P2's pause
    expect((await pause()).open).toBe(true);
    await start(0);                       // its own start closes it
    expect((await pause()).open).toBe(false);
    await start(1);                       // and now P1 may open its own
    expect(await pause()).toMatchObject({ open: true, title: 'paused · P1' });
    await page.close();
  }, 60000);
});
