#!/usr/bin/env node
// brawler turns — THE STARTER'S LEVELS STITCHED BY THE GAME'S TURN (game/turn.js; docs/game-flow.md "A level step is a
// turn"). A quick brawl of three TEST STREETS (blockouts: one straight, one that rises, one that drifts), two fighters
// to choose from, is designed, made, exported and played through its shell in headless Chrome. What it answers: does
// the shell ask the set-up before each street (how hard, once; who plays, each time), does the street play who was
// picked at the tier picked, does each street play its arrive scene as play starts and its leave scene once it is won,
// and does the street's end reach the results and the next street, to the last.
//   node control/scripts/spikes/brawler/turns.mjs [--out dir] [--town] [--composed] [--gun]
//   --sentence '<a few words>': THE STREET'S DESIGN DOOR (gameworld/brawl-cast.js): a game composed from a sentence ("a
//   run and gun through a factory"), its level a street of stops and a boss, its crowd the game's own cast, played on the
//   same street runtime: its seats, its lives, its end
//   --gun: the same streets played as a RUN & GUN (brawl/brawl-play.js): the gunner's kit, the starting gun asked, the
//   play type's own waves and things (none are written here), the rounds fired and the gun read back from each street
//   --town: the dressed town street as the third · --composed: a COMPOSED world (not the quick path): a hero from the
//   game book, a crew from its bestiary, two street levels on places of their own (gameworld/brawl-cast.js `ground`), made by design_game's run
import { register as registerLoader } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
const { values: opt } = parseArgs({ options: { out: { type: 'string', default: path.join(os.tmpdir(), 'brawler-turns') }, town: { type: 'boolean', default: false }, composed: { type: 'boolean', default: false }, gun: { type: 'boolean', default: false }, sentence: { type: 'string' } } });
const out = path.resolve(opt.out); await fs.mkdir(out, { recursive: true });
process.chdir(CONTROL);
registerLoader(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
process.env.SQLITE_PATH = ':memory:'; process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1'; process.env.MOJULO_OUTCOMES_DIR = out; process.env.MOJULO_DATA_DIR = out;
const { designGameHandler } = await import('@/lib/mcp/tools/design-game.js');
const { exportGameHandler } = await import('@/lib/mcp/tools/export-game.js');
const { SketchRepository } = await import('@/lib/db/repositories/sketches.js');
const { launchChromium, resolveChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium.js');
const body = (r) => r?.structuredContent ?? r, t0 = Date.now(), at = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;
const log = [], say = (k, v) => { log.push([k, v]); console.log(JSON.stringify([k, at(), v]).slice(0, 600)); };
// the test streets: short, one held screen and the boss's, a thug or two (a masher's)
const screens = [{ length: 22 }, { length: 20, gate: true }, { length: 20, boss: true }];
const boss = { recipe: { id: 'boss', name: 'Test Boss', archetype: 'grappler' }, plays: ['chain'], hp: 120 };
const waves = [{ screen: 1, crowd: [{ type: 'thug', n: 2 }] }, { screen: 2, crowd: [{ type: 'thug', n: 1 }] }];
const streets = [
  { id: 'straight', name: 'Straight', level: { kind: 'greybox', preset: 'street', belt: { screens } }, waves },
  { id: 'rising', name: 'Rising', level: { kind: 'greybox', preset: 'street', belt: { screens, rise: [[0, 0], [20, 0], [24, 1.4], [62, 1.4]] } }, waves },
  opt.town ? { id: 'drifting', name: 'Drifting', level: { kind: 'town', screens, drift: [[0, 0], [20, 0], [34, 8], [62, 8]] }, waves }
    : { id: 'drifting', name: 'Drifting', level: { kind: 'greybox', preset: 'street', belt: { screens, drift: [[0, 0], [20, 0], [34, 8], [62, 8]] } }, waves },
];
const roster = [{ archetype: 'hero', style: 'all-rounder' }, { archetype: 'explorer', style: 'rushdown' }];
// (--composed: the world written as a game book's: its hero, its bestiary's crew, its levels streets)
const { MEADOWMARK_HERO } = await import('@/lib/graph/gameworld/examples.js');
const { FOE_CLASSES } = await import('@/lib/graph/foes/index.js');
// (a street level's ground is a place without its screens: the street's stops are its screens)
const groundOf = (L) => { const { screens: _s, belt, ...rest } = L; if (!belt) return rest; const { screens: _b, ...b } = belt; return { ...rest, ...(Object.keys(b).length ? { belt: b } : {}) }; };
const composedWorld = { id: 'dockside', name: 'Dockside', mode: 'autonomous', style: MEADOWMARK_HERO.style, civilizations: MEADOWMARK_HERO.civilizations, characters: MEADOWMARK_HERO.characters,
  foes: { punk: { class: Object.keys(FOE_CLASSES)[0], skin: { people: 'human', dress: { faction: 'punks' } } } },
  levels: { dock: { name: 'Dock Road', street: { ground: groundOf(streets[0].level), open: 22, stops: [{ wave: { grunt: 2 }, length: 20 }], boss: { foe: 'grunt', hp: 200, length: 20 } } }, yard: { name: 'The Yard', street: { ground: groundOf(streets[2].level), open: 22, stops: [{ wave: { grunt: 2 }, length: 20 }], boss: { foe: 'grunt', hp: 200, length: 20 } } } },
  links: [{ from: 'dock', to: 'yard', kind: 'gate' }] };
// (--gun: each street says nothing of what holds it: the run & gun's own waves and things are laid)
if (opt.gun) for (const s of streets) delete s.waves;
if (opt.gun) for (const L of Object.values(composedWorld.levels)) L.street.guns = true;
if (opt.composed) streets.splice(0, streets.length, { id: 'dock' }, { id: 'yard' });
let D = body(await designGameHandler(opt.sentence ? { compose: { prompt: opt.sentence, levels: 1 }, ref: 't' } : opt.composed ? { world: composedWorld, ref: 't' } : { quick: { goal: 'brawl', ...(opt.gun ? { play: 'gun' } : {}), roster, streets, crowd: { faction: 'punks', size: 1 }, world: { id: 'turns', name: 'Turns' } }, ref: 't' }));
say('design_game', { ok: D.ok, error: D.error, next: (D.next ?? []).map((n) => n.step) });
for (let k = 0; k < 8 && D.ok && (D.next ?? []).some((n) => n.step === 'run'); k++) { D = body(await designGameHandler({ ref: 't', run: true })); say('run', { ok: D.ok, error: D.error, made: Object.keys(D.made ?? {}).length }); }
const gameRef = SketchRepository.list({ limit: 80 }).map((x) => x.ref).find((r) => /game$/.test(r)), G = gameRef ? SketchRepository.getByRef(gameRef).manifest : null;
say('game', G && { levels: G.levels.map((l) => l.title), asks: Object.values(G.flow?.steps ?? {}).filter((s) => s.kind === 'level').map((s) => (s.picks ?? []).map((p) => `${p.id}${p.keep === 'game' ? ' (once)' : ''}`)) });
if (!G) process.exit(1);
if (opt.sentence) streets.splice(0, streets.length, ...G.levels.map((l, i) => ({ id: `s${i}` })));
const ex = body(await exportGameHandler({ ref: gameRef })), dir = path.join(out, gameRef);
say('export_game', { ok: ex.ok, error: ex.error });
const types = { '.html': 'text/html', '.json': 'application/json', '.wav': 'audio/wav', '.png': 'image/png', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = http.createServer(async (req, res) => { try { const f = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname)); const b = await fs.readFile(f); res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: CHROMIUM_WEBGL_ARGS });
const page = await browser.newPage(); await page.setViewport({ width: 1120, height: 630 });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 300))); page.on('console', (m) => { if (m.type() === 'error' && !/AudioContext|404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
await page.goto(`http://127.0.0.1:${server.address().port}/game.html`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const words = async () => (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 220)));
const frameOf = async () => { for (const f of page.frames()) if (f !== page.mainFrame() && await f.evaluate(() => !!(window.__mojBrawl && window.__mojBrawl.room)).catch(() => false)) return f; return null; };
// the walk through the shell: each screen it shows said once; a pick answered (the second fighter on the second
// street, so the pick is seen to change who plays); a street in play felled to its end
const seen = [], played = [], scenes = [], fired = [], guns = [], design = [];
let last = '', shots = 0, idle = 0;
for (let step = 0; step < 400 && played.length < streets.length + 0 && idle < 40; step++) {
  const F = await frameOf(), text = await words();
  const live = F ? await F.evaluate(() => { const B = window.__mojBrawl; return { lives: B.read.lives || null, seats: B.seats, hud: document.querySelector('.mana-root') ? document.querySelector('.mana-root').innerText.replace(/\s+/g, ' ').slice(0, 120) : '', over: B.over, session: B.session, name: B.read.name, cleared: B.read.cleared, of: B.read.of, scene: B.scene, gun: B.read.gun || null, tally: B.tally, things: (B.room.s.things || []).map((t) => t.kind + ':' + t.what) }; }).catch(() => null) : null;
  // (a scene playing on the street: said once, a still taken, and let play: the fight is held under it)
  if (live && live.scene) {
    const k = `${played.length + (live.over ? 0 : 1)}:${live.scene.id}`;
    if (!scenes.includes(k)) { scenes.push(k); say('scene', { street: played.length + (live.over ? 0 : 1), id: live.scene.id, shows: live.scene.shows }); await wait(600); await page.screenshot({ path: path.join(out, `scene-${scenes.length}.png`) }); }
    await wait(300); idle = 0; continue;
  }
  if (live && !live.over && !/Choose|LOADING|Loading|CLEARED|results|Results/i.test(text)) {
    // in play: say who plays and how hard once, then fell the street as it comes
    const key = `play ${played.length + 1}`;
    // (the player sits down at the street with a button, as a person does: attack, once)
    if (last !== key) { last = key; if (opt.sentence || opt.composed) design.push({ lives: live.lives, seats: live.seats, hud: live.hud }); say(key, { plays: live.name, session: live.session, ...(opt.sentence || opt.composed ? { lives: live.lives, seats: live.seats, hud: live.hud } : {}), ...(opt.gun ? { gun: live.gun, things: live.things } : {}) }); await page.keyboard.press('KeyK'); await wait(300); await page.screenshot({ path: path.join(out, `play-${played.length + 1}.png`) }); }
    // (a run & gun: the trigger held as it walks, so its rounds are seen to fly and be counted)
    if (opt.gun) { await page.keyboard.down('KeyK'); await page.keyboard.down('KeyD'); await wait(900); await page.keyboard.up('KeyD'); await page.keyboard.up('KeyK'); if (!fired[played.length]) await page.screenshot({ path: path.join(out, `fire-${played.length + 1}.png`) }); fired[played.length] = (await F.evaluate(() => window.__mojBrawl.tally).catch(() => null))?.fired ?? fired[played.length] ?? 0; guns[played.length] = live.gun?.name ?? null; }
    await F.evaluate(() => { const B = window.__mojBrawl; for (const b of B.room.s.bodies) if (b.side !== 'player' && !b.gone && !b.ko) { b.ko = 1; b.hp = 0; b.st = 'ko'; b.sf = 0; } });
    await page.keyboard.down('KeyD'); await wait(700); await page.keyboard.up('KeyD');
    const end = await F.evaluate(() => window.__mojBrawl.over).catch(() => null);
    if (end) { for (let w = 0; w < 30 && await F.evaluate(() => !!window.__mojBrawl.scene).catch(() => false); w++) { const sc = await F.evaluate(() => window.__mojBrawl.scene).catch(() => null); const k = `${played.length + 1}:${sc ? sc.id : '?'}`; if (sc && !scenes.includes(k)) { scenes.push(k); say('scene', { street: played.length + 1, id: sc.id, shows: sc.shows }); await page.screenshot({ path: path.join(out, `scene-${scenes.length}.png`) }); } await wait(300); }
      played.push({ street: played.length + 1, over: end, cleared: `${live.cleared}/${live.of}`, session: live.session }); say('street end', played[played.length - 1]); await wait(2500); }
    idle = 0; continue;
  }
  if (text !== last) {
    last = text; seen.push(text); say('screen', text); idle = 0;
    if (shots < 14) await page.screenshot({ path: path.join(out, `shell-${String(++shots).padStart(2, '0')}.png`) });
    // (the fighter asked before the second street: the second one)
    if (/Choose your fighter/i.test(text) && played.length === 1) { await page.keyboard.press('ArrowDown'); await wait(300); }
    if (/Choose your gun/i.test(text) && played.length === 1) { await page.keyboard.press('ArrowDown'); await wait(300); }
    if (/LOADING/i.test(text)) { await wait(400); continue; }
    await wait(500); await page.keyboard.press('Enter'); await wait(1200);
  } else { idle++; await wait(400); if (idle % 10 === 9 && !/LOADING/i.test(text)) await page.keyboard.press('Enter'); }
}
await wait(1500); say('shell at the end', await words()); await page.screenshot({ path: path.join(out, 'end.png') });
// the proof, said plainly
const asks = (re) => seen.filter((t) => re.test(t)).length;
const proof = {
  streetsPlayed: played.length, of: streets.length,
  difficultyAsked: asks(/Choose a difficulty/i), fighterAsked: asks(/Choose your fighter/i),
  whoPlayed: played.map((p) => p.session.players[0]), tier: played.map((p) => p.session.difficulty),
  everyStreetWon: played.every((p) => p.over === 'won'),
  scenes,
  ...(opt.gun ? { gunAsked: asks(/Choose your gun/i), guns, fired } : {}),
};
say('proof', proof); say('errors', errs.slice(0, 6));
await fs.writeFile(path.join(out, 'turns.json'), JSON.stringify({ log, proof, errs }, null, 1));
await browser.close(); server.close();
if (opt.sentence || opt.composed) { const ok = proof.streetsPlayed === streets.length && proof.everyStreetWon && design.every((d) => d.lives && d.lives.of >= 1 && /1P/.test(d.hud)) && (!opt.composed || streets.every((_, i) => scenes.includes(`${i + 1}:arrive`) && scenes.includes(`${i + 1}:leave`))) && (!opt.gun || streets.every((_, i) => fired[i] > 0)) && !errs.length; say('design door', { ok, design }); process.exit(ok ? 0 : 1); }
process.exit(proof.streetsPlayed === streets.length && proof.difficultyAsked === 1 && (opt.composed ? proof.fighterAsked === 0 : proof.fighterAsked === streets.length && proof.whoPlayed[1] !== proof.whoPlayed[0]) && proof.tier.every(Boolean) && proof.everyStreetWon && streets.every((_, i) => scenes.includes(`${i + 1}:arrive`) && scenes.includes(`${i + 1}:leave`)) && (!opt.gun || (proof.gunAsked === streets.length && guns[1] !== guns[0] && streets.every((_, i) => fired[i] > 0))) ? 0 : 1);
