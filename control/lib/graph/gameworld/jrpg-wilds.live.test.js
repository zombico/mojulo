// THE JRPG STARTER'S WILDS on the World page (a real browser, skipped when none is installed): a party RPG composed from
// words (compose.js) is a mandala round its town, and its second ring's wilds are the world map's blocks walked out
// from it (world-map.js wildsLevel), a block a page, a pack on each block's way past the first. Walked up to, the second
// block's pack is met as a battle. The foes' bodies are inline here (no run makes them), so the wilds are the composer's and the
// steps', and nothing else.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { composeGameworld, runSteps } from './index.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

let browser = null, html = '', M = null;
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => {
  const W = composeGameworld({ prompt: 'a medieval fantasy jrpg: a fortified town with a castle, a field with monsters, a dungeon with a boss' });
  const wid = W.megaworld.rings[1].find((id) => W.levels[id].glyphs);
  // (the second block's page, the first with a pack: the block the town opens on has none)
  M = structuredClone(runSteps(W, { ref: 'gj' }).find((s) => s.key === `level-${wid}-1`).order.manifest);
  // (each body inline: the run's minted bodies stood in for, alternately cast, on the library's clips)
  const LIB = { forward: 'Walk_Loop', idle: 'Idle_Loop', walk: 'Walk_Loop', turn: 'Walk_Loop', strafe: 'Walk_Loop', leap: 'Jump_Loop' };
  Object.entries(M.figures ?? {}).forEach(([k, f], i) => { if (f && f.heroRef) M.figures[k] = { hero: { cast: i % 2 ? 'male' : 'female' }, library: 'quaternius-ual', clips: LIB }; });
  // (a foe stood in at its own height: a person's body scaled to the beast's, a slime's 0.7 m, not a giant)
  for (const e of M.entities ?? []) if (/^foe-/.test(e.id) && e.rule?.collideHeight < 1.5) e.body = { ...(e.body ?? {}), scale: Math.round((e.rule.collideHeight / 1.8) * 1000) / 1000 };
  const { payload } = await resolveWorldScene({ ref: 'sk_jrpg_wilds', title: 'wilds', manifest: M });
  // (as the game's shell loads a level: ?hud=0, the dev chrome off)
  html = emitThreeWorld({ ...payload, inline: true, hud: false });
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 900000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the JRPG starter\'s wilds on the page', () => {
  it('built: the block\'s own page, its pack met by walking up to it', () => {
    expect(M).toMatchObject({ kind: 'map', level: { zone: 'B' } });
    expect(M.play.rpg.encounters.length).toBeGreaterThan(0);
    expect(M.play.rpg.encounters.every((e) => Array.isArray(e.at))).toBe(true);
  });

  it('in Chrome: the block\'s page plays, walking up to its pack starts a battle, each member picks beside their own bar and acts at once', async () => {
    if (!browser) return;
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    try {
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojRpg, { timeout: 120000 });
      expect(await page.evaluate(() => window.__mojRpg.state().mode)).not.toBe('battle');
      // (the party stood at the pack, a little over the ground and let fall: the fight is met by coming up to it)
      await page.evaluate((a) => { const W = window.__mojCtrl.world, me = W.byId[W.pilotId]; me.transform.pos[0] = a[0]; me.transform.pos[1] = a[1]; me.transform.pos[2] += 2; if (me.vel) me.vel[2] = 0; }, M.play.rpg.encounters[0].at);
      await page.waitForFunction(() => window.__mojRpg.state().mode === 'battle', { timeout: 30000 });
      // the member whose turn it is picks with the window beside their own bar, held inside the screen
      await page.waitForFunction(() => window.__mojRpg.state().phase === 'command' && document.querySelector('.moj-rpg .mana-anchor[data-key="acmd"]'), { timeout: 60000 });
      await nap(300);
      const at = await page.evaluate(() => {
        const m = window.__mojRpg.state().member, box = (q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
        return { m, bar: box('.moj-rpg .mana-anchor[data-key="a' + m + '"]'), win: box('.moj-rpg .mana-anchor[data-key="acmd"]'), H: innerHeight, W: innerWidth, dev: getComputedStyle(document.querySelector('.hud')).display };
      });
      expect(at.dev).toBe('none');
      // (on the player's turn only the one picking has its bar up: the rest of the cast is seen)
      const heads = () => [...document.querySelectorAll('.moj-rpg .mana-anchor')].filter((a) => a.querySelector('.mana-bar')).map((a) => a.getAttribute('data-key')).filter((k) => /^a(f\d|hero$|party-)/.test(k || ''));
      const up = await page.evaluate(`(${heads})()`);
      expect(up).toEqual(['a' + at.m]);
      const fighters = await page.evaluate(() => window.__mojRpg.R.b.ids.length + window.__mojRpg.R.b.foes.length);
      expect(at.bar).toBeTruthy();
      expect(at.win.l >= at.bar.r - 1 || at.win.r <= at.bar.l + 1).toBe(true);
      expect(at.win.b).toBeLessThanOrEqual(at.H);
      expect(at.win.t).toBeGreaterThanOrEqual(0);
      // (JRPG_WILDS_SHOT=<png>: the battle on the wilds' map, for the eyes)
      if (process.env.JRPG_WILDS_SHOT) await page.screenshot({ path: process.env.JRPG_WILDS_SHOT });
      // picked, the window goes and the blow plays: one member's turn, then the next one's (the timeline, one at a time)
      // THE STEP (rpg-channel.js stepping): the one picking stands out of the line toward the foes
      const stepOf = (id) => window.__mojCtrl.world.byId[id] && window.__mojCtrl.world.byId[id].stepOff;
      await page.waitForFunction(`(() => { const S = (${stepOf})(${JSON.stringify(at.m)}); return S && Math.abs(Math.hypot(S.b[0], S.b[1]) - 0.9) < 0.01; })()`, { timeout: 15000 });
      await page.evaluate(() => window.__mojRpg.act('accept'));
      await page.waitForFunction(() => window.__mojRpg.state().screen === 'rpg-target', { timeout: 15000 });
      // (aiming: the target in focus has its bar up beside the one picking's, no other)
      await page.waitForFunction(`(() => (${heads})().filter((k) => /^af\\d/.test(k)).length === 1)()`, { timeout: 15000 });
      // (the page's own log of what is up, read between its frames: software GL draws a frame slower than a turn plays)
      await page.evaluate(`(() => { const heads = ${heads}; window.__seen = []; window.__seenI = setInterval(() => { window.__seen.push([window.__mojRpg.state().phase, !!document.querySelector('.moj-rpg .mana-screen:not([data-leaving]) .mana-anchor[data-key="acmd"]'), heads().length]); }, 15); window.__mojRpg.act('accept'); })()`);
      await page.waitForFunction(() => window.__seen.some(([p]) => p === 'play') && ['command', 'end'].includes(window.__mojRpg.state().phase), { timeout: 60000 });
      const seen = await page.evaluate(() => { clearInterval(window.__seenI); return window.__seen; });
      const playing = seen.filter(([p]) => p === 'play');
      // (the window gone while the blow plays, the one acting seen whole: its screen closed, its exit left to play out)
      expect(playing.every(([, win]) => !win)).toBe(true);
      // (and the bars down while it plays, but for one whose numbers just moved: the struck foe's, for a moment)
      expect(Math.max(...playing.map(([, , n]) => n))).toBeLessThan(fighters);
      expect(playing.some(([, , n]) => n > 0)).toBe(true);
      // (the one who attacked ran up to its foe, further than its step out, and stood back in its line after)
      // (software GL draws a frame slower than a beat plays, so the page's own record of whom it ran up to is read)
      expect(await page.evaluate((m) => { const W = window.__mojCtrl.world, ran = W.byId[m].ranAt; return !!ran && /^foe-/.test(ran) && ran !== m; }, at.m)).toBe(true);
      expect(await page.evaluate(`(() => { const S = (${stepOf})(${JSON.stringify(at.m)}); return S ? Math.hypot(S.b[0], S.b[1]) : 0; })()`)).toBeLessThan(1);
      expect(await page.evaluate(() => window.__mojRpg.state().phase === 'end' || !!window.__mojRpg.state().member)).toBe(true);
    } finally { await page.close(); }
  }, 240000);
});
