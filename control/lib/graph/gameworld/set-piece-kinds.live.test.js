// Set-piece kinds played (the e2e tier: it launches a browser, and passes saying nothing when none is installed). A bot on
// the page's own frames sprints down the line, jumps at the kind's gap and answers each prompt on its window's middle: the
// collapse's tower comes down as the hero passes and the line runs to its end; the climb is climbed (a jump at the face to its
// first stone, jump tapped on each hold to leap to the next, over its lip) and run to its end. On the plain stand-in; no page error. The machine gate's: whether it reads as a film is the
// operator's to play.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { stuntLevelHtml } from './practice-room-page.js';
import { layKind } from './set-piece-kinds.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

async function play(kind, jumps) {
  const { html } = await stuntLevelHtml({ id: 'lost-nomad-test', name: 'Lost Nomad', feel: 'lost-nomad' }, { kind }, { cast: 'stand-in' });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.world && window.__mojCtrl.world.chase), { timeout: 120000 });
  await page.evaluate((jumps) => {
    const C = window.__mojCtrl, W = C.world, h = W.byId[W.pilotId];
    const code = { forward: 'KeyW', boost: 'KeyF', jump: 'Space', act: 'KeyE' };
    const key = (k, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: code[k], key: code[k], bubbles: true }));
    const out = window.__bot = { done: false, maxZ: h.transform.pos[2], minZ: h.transform.pos[2], broken: 0, s: 0, x0: h.transform.pos[0], x: 0 };
    let n = 0, jumpN = 0, actDown = false;
    key('forward', true); key('boost', true);
    (function frame() {
      n++;
      if (h.ledge) out.held = (out.held || 0) + 1;
      out.minZ = Math.min(out.minZ, h.transform.pos[2]); out.x = h.transform.pos[0];
      out.s = Math.max(out.s, W.chase.s); out.maxZ = Math.max(out.maxZ, h.transform.pos[2]);
      out.broken = (W.breakables || []).filter((b) => b.broken || b.gone || b.hp <= 0).length;
      if (W.chase.done.length || n > 60 * 60) { key('forward', false); key('boost', false); out.done = true; return; }
      requestAnimationFrame(frame);
      if (W.chase.on && !jumpN && (h.ledge ? !h.ledge.leap && !h.ledge.pull : jumps.some((j) => W.chase.s > j - 0.6 && W.chase.s < j + 0.3) && h.grounded !== false)) { key('jump', true); jumpN = n; }
      if (jumpN && n - jumpN > 3) { key('jump', false); if (n - jumpN > 30) jumpN = 0; }
      const U = W.prompt && W.prompt.up;
      // (a press on its window's middle; a mash pressed every other frame from its opening)
      const mid = U ? U.opens + (U.closes - U.opens) / 2 : 0;
      const want = !!U && (U.kind === 'mash' ? U.t >= U.opens && !actDown : U.t >= mid && U.t < mid + 0.1);
      if (want !== actDown) { key('act', want); actDown = want; }
    })();
  }, jumps);
  await page.waitForFunction(() => window.__bot && window.__bot.done, { timeout: 150000 }).catch(() => {});
  const got = await page.evaluate(() => ({ ...window.__bot, results: window.__mojCtrl.world.prompt.results, chaseDone: window.__mojCtrl.world.chase.done.slice(), breakables: (window.__mojCtrl.world.breakables || []).length }));
  await page.close();
  return { got, errors };
}

describe('set-piece kinds, played', () => {
  it('the collapse: the tower comes down as the hero passes, the far roof reached', async () => {
    if (!browser) return;
    const { got, errors } = await play('collapse', [45.2]);
    expect(errors).toEqual([]);
    expect(got.breakables).toBeGreaterThan(0);
    expect(got.broken).toBeGreaterThan(0);
    expect(got.results['collapse-grab']).toBe('hit');
    expect(got.chaseDone).toEqual(['collapse']);
  }, 240000);

  it('the climb: up the face by its holds and over its lip, the reach across, the line run to its end', async () => {
    if (!browser) return;
    const { got, errors } = await play('climb', [19.2, 39.4]);
    expect(errors).toEqual([]);
    expect(got.held).toBeGreaterThan(30);     // (hung from the holds, not walked up)
    expect(got.maxZ).toBeGreaterThan(10.5);   // over the face's top (11 m)
    expect(got.results['climb-reach']).toBe('hit');
    expect(got.chaseDone).toEqual(['climb']);
  }, 240000);

  // a moving kind: the convoy drives on down the road while the hero runs its roofs to the front, never down on the road
  for (const kind of ['truck-top', 'train-roof']) {
    it(`the ${kind}: run along the moving roofs to the front, every prompt answered, never down on the road`, async () => {
      if (!browser) return;
      const K = layKind(kind), { got, errors } = await play(kind, K.jumps);
      expect(errors).toEqual([]);
      expect(Object.values(got.results).length).toBe(K.setPiece.prompts.length);
      expect(Object.values(got.results).every((r) => r === 'hit'), JSON.stringify(got.results)).toBe(true);
      expect(got.chaseDone).toEqual([kind]);
      expect(got.minZ).toBeGreaterThan(K.setPiece.z - 2.5);
      // (carried: the hero ends far further down the road than the line is long)
      expect(got.x - got.x0).toBeGreaterThan(K.setPiece.line[1][0] * 1.5);
    }, 240000);
  }
});
