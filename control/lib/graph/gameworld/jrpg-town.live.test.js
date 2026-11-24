// THE JRPG STARTER'S TOWN on the World page (a real browser, skipped when none is installed): a party RPG composed from
// words (compose.js) lays its town at the centre, and the town's level plays. Walked up to and talked to, a townsperson
// says their lines in the talk box (folk-cast.js, `talk: 'box'`): their name over it, their own body drawn live in its
// face. The innkeeper (the inn's trade, era/town-trades.js) opens the inn. The priest follows the story (folk/pages.js):
// before the core's key is held they say where it is kept, with it that the way is open. The town's save point asks, and
// yes takes its way out to the town itself. The bodies are inline here (no run makes
// them), so the town is the composer's and the steps', and nothing else.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { composeGameworld, runSteps } from './index.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

let browser = null, html = '', M = null, doors = [];
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => {
  const W = composeGameworld({ prompt: 'a medieval fantasy jrpg: a fortified town with a castle, a field with monsters, a dungeon with a boss' });
  // (a townsfolk each lot's first, so the shop, the inn and the temple are kept: the priest who follows the story with them)
  W.characters = { ...W.characters, folk: { ...W.characters.folk, cap: 8 } };
  const town = runSteps(W, { ref: 'gj' }).find((s) => s.key === `level-${W.hub}-0`);
  M = structuredClone(town.order.manifest);
  // (each body inline: the run's minted bodies stood in for, alternately cast, on the library's clips)
  const LIB = { forward: 'Walk_Loop', idle: 'Idle_Loop', walk: 'Walk_Loop', turn: 'Walk_Loop', strafe: 'Walk_Loop', leap: 'Jump_Loop' };
  Object.entries(M.figures).forEach(([k, f], i) => { if (f && f.heroRef) M.figures[k] = { hero: { cast: i % 2 ? 'male' : 'female' }, library: 'quaternius-ual', clips: LIB, ...(f.walker ? { walker: true } : {}) }; });
  const { payload } = await resolveWorldScene({ ref: 'sk_jrpg_town', title: 'town', manifest: M });
  // (the houses' doors: standing on one's zone walks in through it)
  doors = (payload.anchors ?? []).filter((x) => x.door && x.door.at && x.door.half).map((x) => x.door);
  html = emitThreeWorld({ ...payload, inline: true });
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  // (a wait counted in frames can outlast the protocol's default 180 s on one evaluate where a frame takes a second)
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS, protocolTimeout: 900000 });
}, 900000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

// the talk zones of the town: each person's use cue, and what it does (one who potters is talked to only while at their
// place, `if`: the test talks to one who keeps it, a service's own)
const zones = () => (M.play.cues ?? []).filter((c) => c.when?.use && /^folk-[a-z0-9]+-talk$/.test(c.id));

describe('the JRPG starter\'s town on the page', () => {
  it('built: the talk box hosted, a scene for each townsperson who talks, the shop and the inn kept by its people', () => {
    expect(html).toContain('moj-mana-talk');
    const talks = zones().filter((c) => /^folk-say:/.test(c.then?.emit ?? ''));
    expect(talks.length).toBeGreaterThan(0);
    for (const c of talks) expect(M.play.scenes.some((x) => x.when.on === c.then.emit)).toBe(true);
    expect(zones().map((c) => c.then?.emit)).toEqual(expect.arrayContaining(['rpg-shop:merchant', 'rpg-shop:innkeeper']));
  });

  it('in Chrome: a townsperson walked up to says their lines in the talk box, their face drawn; the innkeeper opens the inn', async () => {
    if (!browser) return;
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    // stand the pilot at a zone, and press the interact key (held a frame: the runtime reads it once a frame); stood a
    // little over the feet of the one it talks to and let fall, so on ground higher than where it was it lands on it
    // rather than inside it (a teleport the walk never makes: walking, the pilot follows the ground)
    // (a wait counted in the page's frames, not in seconds: the runtime steps once a frame, and a runner drawing a heavy
    // town in software under load draws a frame a second or slower, so a wait in seconds fails on a slow runner)
    const withinFrames = (fn, n, arg) => page.evaluate((src, k, a) => new Promise((ok, no) => {
      const f = new Function(`return (${src})`)(); let i = 0;
      const tick = () => { let v = false; try { v = f(a); } catch { /* not yet */ } if (v) ok(true); else if (++i > k) no(new Error(`not within ${k} frames`)); else requestAnimationFrame(tick); };
      tick();
    }), fn.toString(), n, arg);
    // (a key held until the page has seen what it does, as E is held below: a fixed hold can fall between two frames)
    const pressUntil = async (key, fn) => { await page.keyboard.down(key); try { await withinFrames(fn, 60); } finally { await page.keyboard.up(key); } };
    const useAt = async (at, id, who) => {
      // (a spot in its reach and clear of every door's zone, with room to spare: standing on one walks in through it)
      const clear = ([x, y]) => doors.every((d) => Math.abs(x - d.at[0]) > d.half[0] + 1 || Math.abs(y - d.at[1]) > d.half[1] + 1);
      const spots = [];
      for (const r of [0.9, 1.2, 0.6]) for (let k = 0; k < 16; k++) spots.push([at[0] + r * Math.cos((k * Math.PI) / 8), at[1] + r * Math.sin((k * Math.PI) / 8)]);
      const spot = spots.find(clear) ?? spots[0];
      await page.evaluate((a, w) => { const W = window.__mojCtrl.world, me = W.byId[W.pilotId], f = w && W.byId[w]; me.transform.pos[0] = a[0]; me.transform.pos[1] = a[1]; if (f) { me.transform.pos[2] = f.transform.pos[2] + 0.4; if (me.vel) me.vel[2] = 0; } }, spot, who ?? null);
      await withinFrames((z) => window.__mojReach === z, 60, id);
      // (E held until the bus says the cue fired: the runtime reads it once a frame, and software GL under a heavy town
      // draws a frame a second or slower, so a fixed hold can fall between two frames)
      await page.keyboard.down('KeyE');
      try { await withinFrames((t) => (window.__mojBus.state.log || []).some((x) => x && x.type === t), 60, id.replace(/^cue-/, 'cue:')); }
      finally { await page.keyboard.up('KeyE'); }
    };
    try {
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojTalk && window.__mojRpg, { timeout: 120000 });
      // (one with one page of talk: the priest's pages are their own step, below)
      const paged = (e) => M.play.scenes.some((x) => x.when.on === e && /-p\d$/.test(x.id));
      const say = zones().find((c) => /^folk-say:/.test(c.then?.emit ?? '') && !c.if && !paged(c.then.emit)), who = say.then.emit.slice('folk-say:'.length);
      const scene = M.play.scenes.find((x) => x.when.on === say.then.emit);
      await useAt(say.when.use.at, `cue-${say.id}`, say.id.replace(/-talk$/, ''));
      await page.waitForFunction(() => window.__mojTalk.state.talk.show && window.__mojTalk.state.talk.text.length > 0, { timeout: 20000 });
      const line = await page.evaluate(() => ({ name: document.querySelector('#moj-mana-talk .mana-heading')?.textContent, state: window.__mojTalk.state.talk }));
      expect(line.name).toBe(scene.names[who]);
      expect(scene.beats[0].line.say.startsWith(line.state.text)).toBe(true);
      // their face: their own figure drawn live in the box
      await page.waitForFunction(() => window.__mojTalk.face && window.__mojTalk.face.drawn() > 2, { timeout: 15000 });
      expect(await page.evaluate(() => getComputedStyle(window.__mojTalk.face.canvas).display)).toBe('block');
      // (JRPG_SHOT=<png>: the town's talk, for the eyes)
      if (process.env.JRPG_SHOT) await page.screenshot({ path: process.env.JRPG_SHOT });
      // skipped to its end, the box goes; the innkeeper's use opens the inn (the shop's Stay)
      await pressUntil('Escape', () => !window.__mojScenes.on());
      const inn = zones().find((c) => c.then?.emit === 'rpg-shop:innkeeper');
      await useAt(inn.when.use.at, `cue-${inn.id}`, inn.id.replace(/-talk$/, ''));
      await withinFrames(() => window.__mojRpg.state().mode === 'shop', 60);
      expect(await page.evaluate(() => window.__mojRpg.state().shop.id)).toBe('innkeeper');
      // THE PRIEST FOLLOWS THE STORY (folk/pages.js): spoken to before the core's key is held, they say where it is kept;
      // with it in the bag, that the way is open (a page each, the first whose if holds)
      await pressUntil('Escape', () => !window.__mojRpg.state().mode);
      const pages = M.play.scenes.filter((x) => /-p\d$/.test(x.id)), on = pages[0].when.on, pid = on.slice('folk-say:'.length);
      const priest = (M.play.cues ?? []).filter((c) => c.when?.use && c.then?.emit === on).sort((a, b) => !!a.if - !!b.if)[0];
      const said = async () => {
        await useAt(priest.when.use.at, `cue-${priest.id}`, pid);
        await withinFrames(() => window.__mojTalk.state.talk.show && window.__mojTalk.state.talk.text.length > 0, 60);
        const t = await page.evaluate(() => window.__mojTalk.state.talk.text);
        // (the shop that opens, seen on its own frame: the rite opens on the frame the talk ends, and on a slow runner the
        // Escape held to skip the talk is still down the frame after, which closes it before a later look would see it)
        await page.evaluate(() => {
          window.__sawShop = null;
          if (window.__shopWatch) return;
          window.__shopWatch = true;
          const look = () => { const st = window.__mojRpg.state(); if (st.mode === 'shop' && !window.__sawShop) window.__sawShop = st.shop.id; requestAnimationFrame(look); };
          requestAnimationFrame(look);
        });
        await pressUntil('Escape', () => !window.__mojScenes.on());
        // (the priest keeps the temple: their page said, its rite opens as the talk ends; closed again)
        await withinFrames(() => !!window.__sawShop, 60);
        expect(await page.evaluate(() => window.__sawShop)).toBe('temple');
        await pressUntil('Escape', () => !window.__mojRpg.state().mode);
        return t;
      };
      const sealed = pages.find((x) => x.if.some((c) => c.ne === 1)).beats[0].line.say, open = pages.find((x) => x.if.some((c) => c.has)).beats[0].line.say;
      expect(sealed.startsWith(await said())).toBe(true);
      await page.evaluate((k) => { window.__mojBus.state.vars[k] = 1; }, `has-${pages.find((x) => x.if.some((c) => c.has)).if[0].has}`);
      expect(open.startsWith(await said())).toBe(true);
      // THE SAVE POINT (a megaworld's saves, levels.js stageWays `savePoint`): pressed, it asks; yes takes the save way,
      // the session stepping out to this same map (the shell writes the store and loads it again, arrived at beside it)
      const sp = M.play.cues.find((c) => c.id === 'save-point');
      expect(M.game.mechanics).toContainEqual(expect.objectContaining({ kind: 'reach-exit', exit: 'save', by: 'save-here' }));
      // (stood at the save point's own height, a little over it, and let fall: it stands where the party comes in)
      const spAt = M.game.mechanics.find((x) => x.exit === 'save').at;
      await page.evaluate((z) => { const W = window.__mojCtrl.world, me = W.byId[W.pilotId]; me.transform.pos[2] = z + 0.4; if (me.vel) me.vel[2] = 0; }, spAt[2]);
      await useAt(sp.when.use.at, 'cue-save-point', null);
      await page.waitForFunction(() => window.__mojBus.state.vars['ui-menu-save-point'] === 1, { timeout: 15000 });
      await page.keyboard.down('Enter'); await nap(300); await page.keyboard.up('Enter');
      await page.waitForFunction(() => (window.__mojBus.state.log || []).some((x) => x && x.type === 'goal:reached:save'), { timeout: 15000 });
    } finally { await page.close(); }
  }, 600000);
});
