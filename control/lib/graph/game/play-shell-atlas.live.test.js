// The play shell's atlas (an e2e suite: a real browser, skipped when none is installed): a megaworld's current map. Leaving
// a map by a way completes nothing; the map loaded is kept in the store, so a reload resumes there, arrived at by the way it
// was come in by; what was gathered rides to the next map, by a way or by a door.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitPlayShell } from './play-shell.js';
import { normalizeGameManifest, validateGameManifest } from './game-manifest.js';
import { normalizeLevelContract, CONTRACT_VERSION, MSG_READY, MSG_INIT, MSG_OUTCOME, MSG_DOOR } from './level-contract.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const ORIGIN = 'http://game.test';
const GAME = normalizeGameManifest({
  kind: 'game', title: 'The Mandala', shell: 'play',
  store: { slices: [{ name: 'campaign', kind: 'progression' }, { name: 'bag', kind: 'inventory' }, { name: 'atlas', kind: 'flags' }] },
  atlas: { slice: 'atlas', shape: 'mandala', rings: [['town'], ['woods'], ['core']] },
  links: [{ from: { ref: 'woods', door: 'hut' }, to: { ref: 'core', door: 'hut' } }],
  levels: [
    { ref: 'town', title: 'Town', exits: [{ id: 'on', to: 'woods' }] },
    { ref: 'woods', title: 'Woods', exits: [{ id: 'back', to: 'town' }, { id: 'on', to: 'core', gate: { has: 'seal', slice: 'bag' } }] },
    { ref: 'core', title: 'Core', exits: [{ id: 'back', to: 'woods' }] },
  ],
});
const LEVELS = GAME.levels.map((l) => ({ ref: l.ref, contract: normalizeLevelContract({ levelRef: l.ref, consumes: [{ slice: 'bag' }], produces: { events: [{ type: 'grant', slice: 'bag' }] } }) }));
// a level that does what the test queued for it the moment it starts, each seeing the params it was handed
const level = (ref) => `<!doctype html><script>
addEventListener('message', (e) => {
  if (!e.data || e.data.moj !== '${MSG_INIT}') return;
  parent.__seen.push({ ref: '${ref}', arrive: e.data.params.arrive || null, seal: (e.data.params.bag && e.data.params.bag.items.seal) || 0 });
  const go = parent.__plan.shift();
  if (!go) return;
  const envelope = { contractVersion: ${CONTRACT_VERSION}, levelRef: '${ref}', events: go.grant ? [{ type: 'grant', slice: 'bag', item: go.grant, count: 1 }] : [] };
  if (go.door) parent.postMessage({ moj: '${MSG_DOOR}', levelRef: '${ref}', door: go.door, envelope: { ...envelope, result: 'transit' } }, '*');
  else parent.postMessage({ moj: '${MSG_OUTCOME}', envelope: { ...envelope, result: 'success', exit: go.exit } }, '*');
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

async function open(plan, { startLevel = 'town' } = {}) {
  const page = await browser.newPage();
  page.__html = emitPlayShell(GAME, LEVELS, startLevel ? { startLevel } : {});
  await page.setRequestInterception(true);
  page.on('request', (rq) => {
    const u = new URL(rq.url()), m = /^\/levels\/(.+)\.html$/.exec(u.pathname);
    if (u.pathname === '/') rq.respond({ contentType: 'text/html', body: page.__html });
    else if (m) rq.respond({ contentType: 'text/html', body: level(m[1]) });
    else rq.respond({ status: 404, body: '' });
  });
  // (the plan outlives a reload: what is left of it, in the session)
  await page.evaluateOnNewDocument((p) => {
    if (window !== window.top) return;
    window.__seen = [];
    // (each test its own save: pages of one browser share the store)
    if (sessionStorage.getItem('plan') === null) { localStorage.clear(); sessionStorage.setItem('plan', JSON.stringify(p)); }
    window.__plan = { shift() { const q = JSON.parse(sessionStorage.getItem('plan')), x = q.shift(); sessionStorage.setItem('plan', JSON.stringify(q)); return x; } };
  }, plan);
  await page.goto(`${ORIGIN}/`);
  return page;
}
const saved = (page) => page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('moj-play:')); return k ? JSON.parse(localStorage.getItem(k)).storeState : null; });
const seen = (page, n) => page.waitForFunction((m) => window.__seen.length >= m, { timeout: 20000 }, n);

describe('the play shell\'s atlas', () => {
  it('travels without completing, keeps where the player is, and resumes there', async () => {
    if (!browser) return;
    expect(validateGameManifest(GAME).errors.filter((e) => /atlas/.test(e))).toEqual([]);
    const page = await open([{ exit: 'on', grant: 'seal' }, { exit: 'on' }, null]);
    await seen(page, 3);
    await new Promise((r) => setTimeout(r, 300));
    expect(await page.evaluate(() => window.__seen)).toEqual([
      { ref: 'town', arrive: null, seal: 0 }, { ref: 'woods', arrive: 'town', seal: 1 }, { ref: 'core', arrive: 'woods', seal: 1 },
    ]);
    const S = await saved(page);
    expect(S.atlas.flags).toMatchObject({ at: 'core', from: 'woods', 'been:town': true, 'been:woods': true, 'been:core': true });
    // (leaving by a way completes nothing)
    expect(S.campaign.completed).toEqual({});
    await page.close();
  }, 60000);

  it('draws the travel screen: the zones on their rings, a zone not found a mark, a touch resuming as it was come in by', async () => {
    if (!browser) return;
    const page = await open([{ exit: 'on' }, null]);
    await seen(page, 2);
    await new Promise((r) => setTimeout(r, 300));
    // (reloaded with no start level: home is the atlas)
    page.__html = emitPlayShell(GAME, LEVELS, {});
    await page.goto(`${ORIGIN}/`);
    await page.waitForSelector('svg.atlas', { timeout: 20000 });
    const read = await page.evaluate(() => ({ labels: [...document.querySelectorAll('svg.atlas text')].map((t) => t.textContent), rings: document.querySelectorAll('svg.atlas > circle').length, app: document.getElementById('app').textContent }));
    expect(read.labels).toEqual(['Town', 'Woods', '?']);
    expect(read.rings).toBe(2);
    expect(read.app).toContain('you are here');
    await page.evaluate(() => document.querySelector('svg.atlas g[aria-label="Woods"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await seen(page, 1);
    expect(await page.evaluate(() => window.__seen)).toEqual([{ ref: 'woods', arrive: 'town', seal: 0 }]);
    await page.close();
  }, 60000);

  it('takes what the session gathered through a door: the store as the door left it', async () => {
    if (!browser) return;
    const page = await open([{ exit: 'on' }, { door: 'hut', grant: 'seal' }, null]);
    await seen(page, 3);
    await new Promise((r) => setTimeout(r, 300));
    const S = await page.evaluate(() => window.__seen);
    expect(S.map((x) => x.ref)).toEqual(['town', 'woods', 'core']);
    expect(S[2].seal).toBe(1);
    await page.close();
  }, 60000);
});
