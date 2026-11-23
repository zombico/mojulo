// THE STORY-PLAY SPIKE: does a composed party RPG's talk and its story (an opening, a moment reached, an ending) play on
// the page? Composes the round, writes it a small story, reports what binds, then plays the town's page in headless
// Chromium: the opening staged as the shell stages it (params.__stage), the reached moment walked into, a townsperson
// talked to. Writes report.json and a shot per step into the directory it is given.
//   node scripts/spikes/story-play/run.mjs <out dir>
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { register } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const OUT = process.argv[2] ?? '.';
mkdirSync(OUT, { recursive: true });
const { composeGameworld, runSteps, readGameworld } = await import('../../../lib/graph/gameworld/index.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');
const report = { story: {}, page: {} }, nap = (ms) => new Promise((r) => setTimeout(r, ms));
const line = (say) => ({ line: { who: 'hero', say } });

const W = composeGameworld({ prompt: 'a jrpg where we storm the citadel to save the princess', seed: 3 });
const hub = W.hub, core = W.megaworld.rings.at(-1)[0];
W.story = [
  { id: 'opening', where: { level: hub }, when: { slot: 'opening' }, beats: [line('They say the citadel took the princess at midwinter.'), line('Nobody who went after her came back.')] },
  { id: 'gate-words', where: { level: hub, place: 'exit' }, when: { reach: 4 }, once: true, beats: [line('The road out of town. The citadel is that way.')] },
  { id: 'ending', where: { level: core }, when: { slot: 'ending' }, beats: [line('It is over. She is free.')] },
];
try { readGameworld(W); report.story.read = 'ok'; } catch (e) { report.story.read = e.message; }
const S = runSteps(W, { ref: 'sp' }), game = S.find((s) => s.key === 'game').order;
report.story.flow = Object.fromEntries(Object.entries(game.flow.steps).filter(([, s]) => s.kind === 'cutscene' || s.kind === 'cinematic').map(([k, s]) => [k, s]));
report.story.bound = {};
for (const s of S.filter((x) => x.key.startsWith('level-'))) for (const sc of s.order.manifest.play?.scenes ?? []) if (['opening', 'gate-words', 'ending'].includes(sc.id)) report.story.bound[sc.id] = { stage: s.key, when: sc.when };
for (const id of ['opening', 'gate-words', 'ending']) if (!report.story.bound[id]) report.story.bound[id] = 'UNPLACED';
console.log(JSON.stringify(report.story, null, 1));

// THE TOWN'S PAGE (its bodies inline, as the town's live test stands them)
const town = S.find((s) => s.key === `level-${hub}-0`), M = structuredClone(town.order.manifest);
const LIB = { forward: 'Walk_Loop', idle: 'Idle_Loop', walk: 'Walk_Loop', turn: 'Walk_Loop', strafe: 'Walk_Loop', leap: 'Jump_Loop' };
Object.entries(M.figures).forEach(([k, f], i) => { if (f && f.heroRef) M.figures[k] = { hero: { cast: i % 2 ? 'male' : 'female' }, library: 'quaternius-ual', clips: LIB, ...(f.walker ? { walker: true } : {}) }; });
const { payload } = await resolveWorldScene({ ref: 'sp_town', title: 'town', manifest: M });
const html = emitThreeWorld({ ...payload, inline: true });
let browser;
try { browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS }); } catch (e) { report.page.error = 'no chromium: ' + e.message; }
if (browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const talk = () => page.evaluate(() => ({ show: window.__mojTalk?.state.talk.show, text: window.__mojTalk?.state.talk.text, name: document.querySelector('#moj-mana-talk .mana-heading')?.textContent ?? null, scene: window.__mojScenes?.view()?.id ?? null }));
  let shotName = null;
  const skip = async () => { await nap(1500); if (shotName) await page.screenshot({ path: `${OUT}/${shotName}.png` }).catch(() => {}); await page.keyboard.down('Escape'); await nap(400); await page.keyboard.up('Escape'); await page.waitForFunction(() => !window.__mojScenes.on(), { timeout: 15000 }).catch(() => {}); };
  const step = async (name, fn) => { shotName = name; const t0 = Date.now(); try { report.page[name] = { ...(await fn()), ms: Date.now() - t0 }; } catch (e) { report.page[name] = { error: e.message.split('\n')[0], ms: Date.now() - t0, talk: await talk().catch(() => null) }; } console.log(name, JSON.stringify(report.page[name])); };
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojTalk && window.__mojScenes, { timeout: 180000 });
  report.page.scenes = await page.evaluate(() => Object.keys(window).filter((k) => k.startsWith('__moj')).sort());
  // 1 · the OPENING staged as the shell stages it: its lines in the talk box, the hero's name over them
  await step('opening', async () => {
    await page.evaluate(() => { window.__mojStage = { scene: 'opening', skip: true, t: 0, on: false, asked: 0 }; });
    await page.waitForFunction(() => window.__mojTalk.state.talk.show && window.__mojTalk.state.talk.text.length > 0, { timeout: 30000 });
    const t = await talk(); await skip(); return t;
  });
  // 2 · the moment REACHED: the pilot stood at the town's way out
  await step('reached', async () => {
    const sc = M.play.scenes.find((x) => x.id === 'gate-words'), at = sc?.when?.near?.at ?? sc?.when?.enter?.at ?? sc?.when?.reach?.at ?? null;
    if (!sc) throw new Error('gate-words not on the town page');
    report.page.reachWhen = sc.when;
    const spot = at ?? (M.play.cues ?? []).find((c) => c.when?.enter)?.when.enter.at;
    await page.evaluate((a) => { const C = window.__mojCtrl.world, me = C.byId[C.pilotId]; if (a) { me.transform.pos[0] = a[0]; me.transform.pos[1] = a[1]; } }, spot);
    await page.waitForFunction(() => window.__mojTalk.state.talk.show && window.__mojTalk.state.talk.text.length > 0, { timeout: 30000 });
    const t = await talk(); await skip(); return t;
  });
  // 3 · a townsperson TALKED TO: their scene fired on its event, as their use cue fires it
  await step('talk', async () => {
    const sc = M.play.scenes.find((x) => /^talk-folk-/.test(x.id) && !/-p\d$/.test(x.id));
    // (the event its use cue emits, put on the page's bus as the cue puts it)
    const q = await page.evaluate((t) => { const B = window.__mojBus; B.bus.processEvents(B.state, [{ type: t }]); return 'processed'; }, sc.when.on);
    report.page.talkQueue = q;
    await page.waitForFunction(() => window.__mojTalk.state.talk.show && window.__mojTalk.state.talk.text.length > 0, { timeout: 30000 });
    const t = await talk(); await skip(); return { ...t, expected: sc.beats[0].line.say };
  });
  await browser.close();
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log('wrote', `${OUT}/report.json`);
process.exit(0);
