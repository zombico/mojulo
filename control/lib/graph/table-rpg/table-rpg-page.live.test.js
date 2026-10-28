// The table page in a real browser (an e2e suite: skipped when none is installed): the game the page plays is the game
// Node plays, line for line; the moves are offered as buttons; the command list kept in the browser replays on reload.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tableRpgPageHtml } from './table-rpg-page.js';
import { readModule, playScript } from './table-rpg-module.js';
import { SUNKEN_CHAPEL } from './fixtures/sunken-chapel.js';
import { resolveChromium, launchChromium } from '../scene/chromium.js';

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

const MOVES = ['travel standing-stones', 'travel barrow-hill', 'enter', 'go nave', 'attack ghoul', 'roll 3d6', 'ask is it safe likely'];

describe('the table page: the kernel played in a browser', () => {
  it('plays the game Node plays, offers the moves, and replays the kept moves on reload', async () => {
    if (!browser) return;
    const { K, module } = readModule(SUNKEN_CHAPEL);
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // a page served from an origin, so the browser keeps its moves
    await page.setRequestInterception(true);
    const html = tableRpgPageHtml(module, { title: K.title });
    page.on('request', (r) => r.respond({ status: 200, contentType: 'text/html', body: html }));
    await page.goto('http://table.test/');
    const said = [];
    for (const m of MOVES) said.push(...await page.evaluate((t) => window.__mojTable.act(t), m));
    const node = playScript(K, MOVES).lines.filter((l) => !l.startsWith('> '));
    expect(said).toEqual(node.slice(node.length - said.length));
    const buttons = await page.$$eval('#moves button', (bs) => bs.map((b) => b.textContent));
    expect(buttons.length).toBeGreaterThan(0);
    const log = await page.$eval('#log', (l) => l.textContent);
    await page.reload();
    expect(await page.$eval('#log', (l) => l.textContent)).toBe(log);
    expect(errors).toEqual([]);
  }, 60000);
});
