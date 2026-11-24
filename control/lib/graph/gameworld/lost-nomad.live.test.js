// Lost Nomad's template movie played end to end (the e2e tier: it launches a browser, and passes saying nothing when none
// is installed). Each level of the reel ordered from the template world as a run would mint it, on the World page, played
// by a bot on the page's own frames: it sprints down the line, jumps at the kind's gap, answers each prompt on its window's
// middle, and the level is won as its line ends (the bus's pieceDone). No page error. The machine gate's: whether it
// plays as an action movie is the operator's to say.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { levelManifestHtml } from './practice-room-page.js';
import { lostNomadWorld } from './lost-nomad.js';
import { readGameworld } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { PIECE_DONE } from './stunt-room.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

// where each kind's line meets its gap (metres along it): the bot's jump
const GAPS = { 'rooftop-run': [17], collapse: [45.2], climb: [19.2, 39.4] };

async function playLevel(manifest, ref, jumps) {
  const html = await levelManifestHtml(manifest, ref);
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.world && window.__mojCtrl.world.chase && window.__mojBus), { timeout: 120000 });
  await page.evaluate((jumps) => {
    const C = window.__mojCtrl, W = C.world, h = W.byId[W.pilotId];
    const code = { forward: 'KeyW', boost: 'KeyF', jump: 'Space', act: 'KeyE' };
    const key = (k, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: code[k], key: code[k], bubbles: true }));
    const out = window.__bot = { done: false, z0: h.transform.pos[2], minZ: h.transform.pos[2] };
    let n = 0, jumpN = 0, actDown = false, mash = 0;
    key('forward', true); key('boost', true);
    (function frame() {
      n++;
      out.minZ = Math.min(out.minZ, h.transform.pos[2]);
      if (W.chase.done.length || n > 60 * 70) { key('forward', false); key('boost', false); setTimeout(() => { out.done = true; }, 400); return; }
      requestAnimationFrame(frame);
      if (W.chase.on && !jumpN && (h.ledge ? !h.ledge.leap && !h.ledge.pull : jumps.some((j) => W.chase.s > j - 0.6 && W.chase.s < j + 0.3) && h.grounded !== false)) { key('jump', true); jumpN = n; }
      if (jumpN && n - jumpN > 3) { key('jump', false); if (n - jumpN > 30) jumpN = 0; }
      const U = W.prompt && W.prompt.up, mid = U ? U.opens + (U.closes - U.opens) / 2 : 0;
      const want = !!U && (U.kind === 'mash' ? U.t >= U.opens && !actDown : U.t >= mid && U.t < mid + 0.1);
      if (want !== actDown) { key('act', want); actDown = want; }
    })();
  }, jumps);
  await page.waitForFunction(() => window.__bot && window.__bot.done, { timeout: 160000 }).catch(() => {});
  const got = await page.evaluate((v) => ({ z0: window.__bot.z0, minZ: window.__bot.minZ, results: window.__mojCtrl.world.prompt.results, chaseDone: window.__mojCtrl.world.chase.done.slice(), won: window.__mojBus.state.vars[v] }), PIECE_DONE);
  await page.close();
  return { got, errors };
}

describe('the template movie, played', () => {
  const W = lostNomadWorld(), G = readGameworld(W), stages = gameStages(W);
  for (const [i, st] of stages.entries()) {
    it(`${i + 1}. ${st.label}: played to its end and won`, async () => {
      if (!browser) return;
      // (ordered with no hero made, so the star is laid; his body then swapped for the plain stand-in: the realistic body slows
      // a headless page to a few frames, and the bot's mash counts frames)
      const O = stageLevelOrder(G, st, { ref: `lv_${i}` }), M = O.args.manifest;
      expect(M.figures.hero.hero.face).toEqual({ seed: 1116, ethnicity: 'levantine', age: 34 });
      const manifest = { ...M, figures: { ...M.figures, hero: { ...M.figures.hero, hero: { cast: 'male' } } } };
      const { got, errors } = await playLevel(manifest, `lost-nomad-${st.level}`, GAPS[st.stunt.kind]);
      expect(errors).toEqual([]);
      expect(Object.values(got.results).every((r) => r === 'hit'), JSON.stringify(got.results)).toBe(true);
      expect(got.chaseDone).toEqual([st.level]);
      expect(got.won).toBe(1);
      expect(got.minZ, 'never run from the street under the course').toBeGreaterThan(got.z0 - 3.5);
    }, 240000);
  }
});
