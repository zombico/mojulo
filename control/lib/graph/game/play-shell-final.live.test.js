// The play shell's end (an e2e suite: a real browser, skipped when none is installed): a map game with a final level
// travels by its exits until that level is first won, then stops there and says the game is complete, the store
// holding every level it cleared.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitPlayShell } from './play-shell.js';
import { normalizeGameManifest, validateGameManifest } from './game-manifest.js';
import { normalizeLevelContract, CONTRACT_VERSION, MSG_READY, MSG_INIT, MSG_OUTCOME } from './level-contract.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const ORIGIN = 'http://game.test';
const GAME = normalizeGameManifest({
  kind: 'game', title: 'Epochs', shell: 'play', final: 'keep',
  store: { slices: [{ name: 'campaign', kind: 'progression' }] },
  levels: [
    { ref: 'map', title: 'The map', exits: [{ id: 'gate', to: 'gate' }, { id: 'keep', to: 'keep', gate: { completed: 'gate' } }] },
    { ref: 'gate', exits: [{ id: 'map', to: 'map' }] },
    { ref: 'keep', exits: [{ id: 'map', to: 'map' }] },
  ],
});
const LEVELS = GAME.levels.map((l) => ({ ref: l.ref, contract: normalizeLevelContract({ levelRef: l.ref, consumes: [{ slice: 'campaign' }], produces: { events: [] } }) }));
// a level that is won the moment it starts, left by the exit the test has queued for it
const level = (ref) => `<!doctype html><script>
addEventListener('message', (e) => {
  if (!e.data || e.data.moj !== '${MSG_INIT}') return;
  parent.__seen.push('${ref}');
  const exit = parent.__plan.shift();
  parent.postMessage({ moj: '${MSG_OUTCOME}', envelope: { contractVersion: ${CONTRACT_VERSION}, levelRef: '${ref}', result: 'success', events: [], ...(exit ? { exit } : {}) } }, '*');
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

describe('the play shell\'s final level', () => {
  it('travels by the exits until the final level is first won, then ends there: the game complete, not back on the map', async () => {
    if (!browser) return;
    expect(validateGameManifest(GAME)).toEqual({ ok: true, errors: [] });
    const html = emitPlayShell(GAME, LEVELS, { startLevel: 'map' });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (rq) => {
      const u = new URL(rq.url()), m = /^\/levels\/(.+)\.html$/.exec(u.pathname);
      if (u.pathname === '/') rq.respond({ contentType: 'text/html', body: html });
      else if (m) rq.respond({ contentType: 'text/html', body: level(m[1]) });
      else rq.respond({ status: 404, body: '' });
    });
    await page.evaluateOnNewDocument(() => { window.__seen = []; window.__plan = ['gate', 'map', 'keep', 'map']; });
    await page.goto(`${ORIGIN}/`);
    await page.waitForFunction(() => /the game is complete/.test(document.getElementById('app').textContent), { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 400));
    const seen = await page.evaluate(() => window.__seen);
    expect(seen).toEqual(['map', 'gate', 'map', 'keep']);
    await page.close();
  }, 60000);
});
