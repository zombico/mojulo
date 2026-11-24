// THE WARDROBE-PLAY SPIKE: does a party RPG's wardrobe (gameworld/wardrobe.js) show on the page with its REAL bodies?
// Composes the round with `battles.wardrobe`, makes the steps one level stands on as design_game's run makes them (the
// casting, the hero and its equipped figure, each cast member, each look), stores a level, and plays its page in
// headless Chromium: what each member wears as it loads, an armour put on and taken off on the map, and a fight begun
// with the party in what it wears. The folk and the foes are stood in (their making is not this spike's). Writes
// report.json and a shot per step into the directory it is given.
//   node scripts/spikes/wardrobe-play/run.mjs <out dir> [town|wilds]
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { register } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const OUT = process.argv[2] ?? '.', WHERE = process.argv[3] ?? 'wilds';
mkdirSync(OUT, { recursive: true });
const { composeGameworld, runSteps } = await import('../../../lib/graph/gameworld/index.js');
const { createSketchHandler } = await import('../../../lib/mcp/tools/sketches.js');
const { createCharacterHandler } = await import('../../../lib/mcp/tools/create-character.js');
const { mintSolidHandler } = await import('../../../lib/mcp/tools/mint-solid.js');
const { updateSketchHandler } = await import('../../../lib/mcp/tools/sketches.js');
const { heroMintArgs } = await import('../../../lib/mcp/tools/hero-mint.js');
const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');
const report = { made: {}, page: {} }, nap = (ms) => new Promise((r) => setTimeout(r, ms)), t0 = Date.now();

const W = composeGameworld({ prompt: 'a jrpg where we storm the citadel to save the princess', seed: 3 });
W.battles = { ...W.battles, wardrobe: true };
const S = runSteps(W, { ref: 'wp' });
// (the steps a member's figure stands on, made as design_game's run makes them: realize in design-game.js)
const need = S.filter((s) => s.key === 'casting' || /^hero(-equipped)?$/.test(s.key) || /^cast-/.test(s.key) || /-look-/.test(s.key));
for (const st of need) {
  const t = Date.now(), { key, ref, order } = st;
  try {
    if (key === 'casting') await createSketchHandler({ ...order, ref });
    else if (order.egocube) await createCharacterHandler({ egocube: order.egocube, member: order.member, title: order.title, ...(order.spec ? { spec: order.spec } : {}), ref });
    else { await mintSolidHandler({ ...heroMintArgs(order.mint), ref }); if (order.motion) await updateSketchHandler({ ref, patch: order.motion, note: 'spike: motion' }); }
    report.made[key] = { ok: true, ms: Date.now() - t };
  } catch (e) { report.made[key] = { ok: false, why: e.message.split('\n')[0] }; }
  console.log('made', key, report.made[key].ok ? `${report.made[key].ms} ms` : report.made[key].why);
}

// THE LEVEL: the town (the hub's first stage) or the wilds (the first block with a pack)
const lvKey = WHERE === 'town' ? `level-${W.hub}-0` : S.find((s) => s.key.startsWith('level-') && s.order.manifest?.play?.rpg?.encounters?.length)?.key;
const M = structuredClone(S.find((s) => s.key === lvKey).order.manifest);
const LIB = { forward: 'Walk_Loop', idle: 'Idle_Loop', walk: 'Walk_Loop', turn: 'Walk_Loop', strafe: 'Walk_Loop', leap: 'Jump_Loop' };
// (every figure whose body was not made here stood in: the folk and the foes)
let stood = 0;
for (const [k, f] of Object.entries(M.figures ?? {})) if (f && f.heroRef && !SketchRepository.getByRef(f.heroRef)) { M.figures[k] = { hero: { cast: stood++ % 2 ? 'male' : 'female' }, library: 'quaternius-ual', clips: LIB }; }
for (const e of M.entities ?? []) if (/^foe-/.test(e.id) && e.rule?.collideHeight < 1.5) e.body = { ...(e.body ?? {}), scale: Math.round((e.rule.collideHeight / 1.8) * 1000) / 1000 };
report.level = { key: lvKey, stoodIn: stood, looks: Object.fromEntries((M.entities ?? []).filter((e) => e.looks).map((e) => [e.id, e.looks.by])) };
console.log('level', JSON.stringify(report.level));
const { payload } = await resolveWorldScene({ ref: `wp_${WHERE}`, title: WHERE, manifest: M });
const html = emitThreeWorld({ ...payload, inline: true, hud: false });
report.page.bytes = html.length;
// (what the looks cost the page: the same level with none)
{ const bare = { ...M, entities: M.entities.map(({ looks: _l, ...e }) => e), figures: Object.fromEntries(Object.entries(M.figures).filter(([k]) => !/-look-/.test(k))) };
  const { payload: P0 } = await resolveWorldScene({ ref: `wp_${WHERE}_bare`, title: WHERE, manifest: bare });
  report.page.bytesWithoutLooks = emitThreeWorld({ ...P0, inline: true, hud: false }).length; }
console.log('bytes', report.page.bytes, 'without looks', report.page.bytesWithoutLooks);

const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setContent(html, { waitUntil: 'load' });
await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojRpg, { timeout: 300000 });
// (every member in the party: their flags carried in, as a level after the town would have them)
const PM = Array.isArray(M.play?.party) ? M.play.party : M.play?.party?.members ?? [];
const joins = PM.map((m) => m.joins).filter(Boolean);
// (the flag carried wakes the member on the map, playscape/ui/party.js; the RPG party takes it in on rpg-join:<member>)
const ids = PM.map((m) => m.who);
await page.evaluate((js, ids) => { const B = window.__mojBus, ev = [];
  for (const j of js) { B.state.vars[`flag-${j}`] = 1; ev.push({ type: `flag-carried:${j}` }); }
  for (const id of ids) ev.push({ type: `rpg-join:${id}` });
  B.bus.processEvents(B.state, ev); }, joins, ids);
await nap(4000);
const worn = () => page.evaluate(() => { const w = window.__mojCtrl.world, R = window.__mojRpg.R; return Object.fromEntries(Object.keys(R.m).map((id) => [id, { armor: R.m[id].gear.armor ?? null, figure: w.byId[id]?.body?.figure ?? null, joined: !!R.joined[id] || (window.__mojRpg.R.b ? window.__mojRpg.R.b.ids.includes(id) : null), awake: w.byId[id] ? !w.byId[id].dormant : null }])); });
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); };
report.page.loaded = await worn(); await shot('1-loaded');
// on the map: each member's armour off, then each member's first look on
const firstLook = Object.fromEntries(Object.entries(report.level.looks).map(([id, by]) => [id, Object.keys(by).at(-1)]));
await page.evaluate(() => { for (const m of Object.values(window.__mojRpg.R.m)) delete m.gear.armor; }); await nap(1500);
report.page.off = await worn(); await shot('2-off');
await page.evaluate((L) => { for (const [id, it] of Object.entries(L)) if (window.__mojRpg.R.m[id]) window.__mojRpg.R.m[id].gear.armor = it; }, firstLook); await nap(1500);
report.page.on = await worn(); await shot('3-on');
// a fight: the pilot stood at the first pack
const enc = M.play?.rpg?.encounters?.[0];
if (enc?.at) {
  await page.evaluate((a) => { const w = window.__mojCtrl.world, me = w.byId[w.pilotId]; me.transform.pos[0] = a[0]; me.transform.pos[1] = a[1]; me.transform.pos[2] += 2; if (me.vel) me.vel[2] = 0; }, enc.at);
  try { await page.waitForFunction(() => window.__mojRpg.state().mode === 'battle', { timeout: 30000 }); await nap(4000); report.page.battle = await worn(); report.page.fighting = await page.evaluate(() => window.__mojRpg.R.b.ids); await shot('4-battle'); }
  catch (e) { report.page.battle = `no battle: ${e.message.split('\n')[0]}`; }
}
report.page.errors = errors.slice(0, 10);
report.ms = Date.now() - t0;
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.page, null, 1));
await browser.close(); process.exit(0);
