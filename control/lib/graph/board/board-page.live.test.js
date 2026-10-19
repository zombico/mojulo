// The board on the World page (an e2e suite: a real browser, skipped when none is installed): a battle the minds fight
// in the page ends where the same battle ends in Node, step for step; and the player's turn is the menu's: Move, Act
// (the attack, the skills, the bag), Wait, an aimed act's forecast, the turn passing on.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { assembleBoardScene } from './board-scene.js';
import { buildBoard, boardStart, boardApply, boardLegal, boardParse } from './board-kernel.js';
import { boardMindPlan } from './board-mind.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { rpgInit, rpgSave, rpgLoad, rpgStatsOf } from '../playscape/rpg/kernel.js';
import { boardCarryDraw } from './board-carry.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';
import { readGameworld } from '../gameworld/world.js';
import { HALDEN_REACH } from '../gameworld/examples.js';
import { rtsRoster } from './board-rts-tech.js';
import { rtsLooks } from './board-rts-look.js';
import { RTS_UNITS, RTS_BUILDINGS } from './board-rts.js';

const K = buildBoard();
const fight = (players, party = ['B1', 'C1', 'D1'], foes = ['B8', 'D8', 'F8']) => ({ board: { seed: 'fft-1', relief: 0.4, cols: 8, rows: 8 }, battle: { seed: 'fft-1', players,
  party: [{ id: 'ayla', class: 'fighter', at: party[0] }, { id: 'bram', class: 'mage', at: party[1], level: 2, skills: ['blizzard'] }, { id: 'cass', class: 'cleric', at: party[2] }],
  foes: [{ id: 'g1', foe: 'goblin', at: foes[0] }, { id: 'w1', foe: 'wolf', at: foes[1] }, { id: 's1', foe: 'shaman', at: foes[2] }] } });
let browser = null;
async function open(manifest) {
  const page = await browser.newPage();
  await page.setContent(emitThreeWorld({ ...assembleBoardScene(manifest), inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojBoard && window.__mojBoard.state, { timeout: 20000 });
  return page;
}
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the board on the World page', () => {
  it('lets the minds fight a battle in the page to the end the same battle reaches in Node', async () => {
    if (!browser) return;
    const page = await open(fight([]));
    const out = await page.evaluate(() => { const b = window.__mojBoard; for (let k = 0; k < 20000 && !b.result; k++) b.run(0.1); return { result: b.result, S: b.state() }; });
    // the same battle in Node: each turn the mind's plan, planned again where a step stopped being legal
    const { board: { B, battle } } = assembleBoardScene(fight([]));
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    let S = boardStart(B, battle.cfg, battle.units), plan = [];
    while (!S.over) {
      if (!plan.length || !boardLegal(B, battle.cfg, S).some((a) => same(a, plan[0]))) plan = boardMindPlan(B, battle.cfg, S, K);
      const a = plan.shift(), who = S.turn.who;
      S = boardApply(B, battle.cfg, S, a).S;
      if (!S.turn || S.turn.who !== who) plan = [];
    }
    expect(out.result).toEqual({ winner: S.over.winner, reason: 'fallen', turns: S.n });
    expect(out.S).toEqual(S);
    await page.close();
  }, 120000);

  it('deploys the party where the player puts it before the first turn, and shows the spoils of a win', async () => {
    if (!browser) return;
    const page = await open({ board: { seed: 'flat', relief: 0, cols: 6, rows: 6 }, battle: { deploy: ['A1:C1'],
      party: [{ id: 'ayla', class: 'fighter', level: 9 }, { id: 'bram', class: 'mage', level: 9 }], foes: [{ id: 'g', foe: 'goblin', at: 'B3' }] } });
    expect(await page.evaluate(() => window.__mojBoard.mode)).toBe('deploy');
    // Ayla to C1 (the cursor starts on her own spot, A1; two steps east), then Bram stays where he stands
    await page.evaluate(() => { const b = window.__mojBoard; b.moveCursor(2); });
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    const placed = await page.evaluate(() => { const S = window.__mojBoard.state(); return [S.u.ayla.at, S.u.bram.at, window.__mojBoard.mode]; });
    expect(placed.slice(0, 2)).toEqual([2, 1]);
    expect(placed[2]).not.toBe('deploy');
    // the party fights it out by the mind's choices on its turns (the page's own auto)
    const end = await page.evaluate(() => {
      const b = window.__mojBoard;
      for (let k = 0; k < 4000 && !b.result; k++) {
        b.run(0.1);
        if (b.mode === 'menu') b.auto();
      }
      return { result: b.result, text: document.body.innerText };
    });
    expect(end.result.winner).toBeTruthy();
    if (end.result.winner === 'party') expect(end.text).toMatch(/Victory\n7 xp · 1 class points · 8 gold/);
  }, 120000);

  it('fights a game\'s level: the party as the store has it, the spoils back to the store, the level won on the board', async () => {
    if (!browser) return;
    const rcfg = readRpg({ rpg: { party: [{ id: 'ayla', class: 'fighter' }] } }), R = rpgInit(rcfg), saved = rpgSave(rcfg, R);
    saved.ayla.lv = 7; saved.ayla.xp = 300;
    const roster = { ayla: { name: 'Ayla', level: 7, stats: saved.ayla } };
    const L7 = rpgInit(rcfg); rpgLoad(rcfg, L7, roster, {});
    const { payload } = await resolveWorldScene({ ref: 'lvl', title: null, manifest: { kind: 'stage', geocube: 'island-noon', trail: {},
      board: { cols: 8, rows: 8, battle: { figures: false, deploy: ['A1:D2'], party: [{ id: 'ayla', class: 'fighter' }], foes: [{ id: 'g', foe: 'goblin', at: 'C5' }] } },
      game: { levelRef: 'lvl', mechanics: [{ kind: 'board' }, { kind: 'party', slice: 'party' }, { kind: 'bag', slice: 'bag' }], presets: { default: { party: { roster }, bag: { items: { potion: 3 } } } } } } });
    const page = await browser.newPage();
    await page.setContent(emitThreeWorld({ ...payload, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojBoard && window.__mojBoard.mode !== 'wait', { timeout: 20000 });
    const start = await page.evaluate(() => { const S = window.__mojBoard.state(); return { hp: S.u.ayla.hpMax, atk: S.u.ayla.atk, bag: S.bag.party }; });
    const S7 = rpgStatsOf(rcfg, L7, 'ayla');
    expect(start).toEqual({ hp: S7.hp, atk: S7.atk, bag: { potion: 3 } });
    const end = await page.evaluate(() => {
      const b = window.__mojBoard;
      for (let k = 0; k < 6000 && !b.result; k++) { if (b.mode === 'deploy') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' })); else if (b.mode === 'menu') b.auto(); b.run(0.1); }
      // the bus drains on the page's frame: give it a few
      return new Promise((done) => setTimeout(() => done({ result: b.result, events: window.__mojGame.events, envelope: window.__mojGame.envelope }), 600));
    });
    expect(end.result.winner).toBe('party');
    const xp = end.events.find((e) => e.type === 'setStat' && e.id === 'ayla' && e.stat === 'xp');
    expect(xp).toEqual({ type: 'setStat', slice: 'party', id: 'ayla', stat: 'xp', value: 300 + 7 });
    expect(end.envelope && end.envelope.result).toBe('success');
    await page.close();
  }, 180000);

  it('meets the pack a drawn battle draws for the party as the store has it, the others never standing', async () => {
    if (!browser) return;
    const rcfg = readRpg({ rpg: { party: [{ id: 'ayla', class: 'fighter' }] } }), saved = rpgSave(rcfg, rpgInit(rcfg));
    saved.ayla.lv = 3; saved.ayla.xp = 40;
    const roster = { ayla: { name: 'Ayla', level: 3, stats: saved.ayla } };
    const draw = [['slime'], ['wolf', 'bat'], ['goblin', 'spider', 'slime'], ['skeleton', 'wolf']];
    const { payload } = await resolveWorldScene({ ref: 'wilds', title: null, manifest: { kind: 'board', board: { seed: 'wilds', cols: 8, rows: 8, relief: 0.3 },
      battle: { figures: false, seed: 'wilds', deploy: 'near', party: [{ id: 'ayla', class: 'fighter' }], draw },
      game: { levelRef: 'wilds', mechanics: [{ kind: 'board' }, { kind: 'party', slice: 'party' }], presets: { default: { party: { roster } } } } } });
    const t = boardCarryDraw(payload.board.battle.rpg, { ayla: { stats: saved.ayla } }, draw.length, 'wilds');
    const page = await browser.newPage();
    await page.setContent(emitThreeWorld({ ...payload, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojBoard && window.__mojBoard.mode !== 'wait', { timeout: 20000 });
    const got = await page.evaluate(() => { const b = window.__mojBoard, S = b.state(); return { drawn: b.drawn, foes: S.order.filter((id) => S.u[id].side === 'foe').filter((id) => S.u[id].hp > 0) }; });
    expect(got).toEqual({ drawn: t, foes: draw[t].map((_, k) => `foe-${t + 1}-${k + 1}`) });
    await page.close();
  }, 120000);

  it('holds the battle for its story slots: a scene before the first turn, one after the win before the level ends', async () => {
    if (!browser) return;
    const line = (say) => [{ line: { who: 'ayla', say } }];
    const { payload } = await resolveWorldScene({ ref: 'told', title: null, manifest: { kind: 'board', board: { seed: 'flat', relief: 0, cols: 6, rows: 6 },
      battle: { figures: false, party: [{ id: 'ayla', class: 'fighter', at: 'C2', bonus: { atk: 99, hp: 99, spd: 50 } }], foes: [{ id: 's', foe: 'slime', at: 'C4' }] },
      play: { scenes: [{ id: 'intro', when: { on: 'slot:before' }, beats: [{ do: { emit: 'fx:quake:ayla' } }, ...line('Hold the line.')] }, { id: 'outro', when: { on: 'slot:after' }, beats: line('It is done.') }] },
      game: { levelRef: 'told', mechanics: [{ kind: 'board' }] } } });
    expect(payload.board.slots).toEqual(['before', 'after']);
    const page = await browser.newPage();
    await page.setContent(emitThreeWorld({ ...payload, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojBoard && window.__mojScenes && window.__mojScenes.on(), { timeout: 20000 });
    // the scene's own effect, by the bus: a quake on the speaker, the map shaking
    expect(await page.evaluate(() => window.__mojBoard.fx.playing + window.__mojBoard.camera.shakes.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => ({ mode: window.__mojBoard.mode, slot: window.__mojBoard.slot, who: window.__mojScenes.view().line && window.__mojScenes.view().line.who }))).toEqual({ mode: 'scene', slot: 'before', who: 'ayla' });
    // the line read (a click types it out, the next goes on), the scene over: the battle begins
    await page.waitForFunction(() => { if (window.__mojScenes.on()) window.__mojScenes.next(); return window.__mojBoard.mode !== 'scene'; }, { polling: 200, timeout: 10000 });
    await page.evaluate(() => { const b = window.__mojBoard; for (let k = 0; k < 400 && !b.result; k++) { if (b.mode === 'menu') b.auto(); b.run(0.1); } });
    await page.waitForFunction(() => window.__mojBoard.slot === 'after' && window.__mojScenes.on(), { timeout: 10000 });
    // the level has not heard the win while the after scene plays
    expect(await page.evaluate(() => window.__mojGame.envelope || null)).toBeNull();
    await page.waitForFunction(() => { if (window.__mojScenes.on()) window.__mojScenes.next(); return window.__mojGame.envelope; }, { polling: 200, timeout: 10000 });
    expect(await page.evaluate(() => window.__mojGame.envelope.result)).toBe('success');
    await page.close();
  }, 120000);

  it('travels an epoch\'s map: the roads the cleared dots open, the party walked there, the map left by the dot\'s exit', async () => {
    if (!browser) return;
    const dots = [{ id: 'gate', name: 'Old Gate', ref: 'lv-gate' }, { id: 'fields', kind: 'skirmish', ref: 'lv-fields', gate: 'gate' }, { id: 'mill', ref: 'lv-mill', gate: 'gate' }, { id: 'keep', ref: 'lv-keep', gate: 'mill' }];
    const { payload } = await resolveWorldScene({ ref: 'map', title: null, manifest: { kind: 'board', board: { seed: 'epoch-1', relief: 0.45, cols: 16, rows: 12 },
      map: { dots, roads: [['gate', 'fields'], ['gate', 'mill'], ['mill', 'keep']] },
      game: { levelRef: 'map', mechanics: [{ kind: 'map', slice: 'campaign', dots: dots.map((d) => d.id) }], presets: { default: { campaign: { completed: { 'lv-gate': 'success' } }, arrive: 'lv-gate' } } } } });
    expect(payload.game.on['map-go:mill']).toEqual({ end: 'success', exit: 'mill' });
    const page = await browser.newPage();
    await page.setContent(emitThreeWorld({ ...payload, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojBoard && window.__mojBoard.map && window.__mojBoard.map.at, { timeout: 20000 });
    const before = await page.evaluate(() => window.__mojBoard.map);
    expect(before.at).toBe('gate');
    expect(before.dots).toEqual([{ id: 'gate', state: 'done' }, { id: 'fields', state: 'open' }, { id: 'mill', state: 'open' }, { id: 'keep', state: 'locked' }]);
    expect(await page.evaluate(() => { window.__mojBoard.goTo('keep'); return window.__mojBoard.map.gone; })).toBe(null);
    await page.evaluate(() => window.__mojBoard.goTo('mill'));
    await page.waitForFunction(() => window.__mojGame.envelope, { timeout: 30000 });
    const end = await page.evaluate(() => ({ map: window.__mojBoard.map, envelope: window.__mojGame.envelope }));
    expect(end.map).toMatchObject({ at: 'mill', gone: 'mill' });
    expect(end.envelope).toMatchObject({ result: 'success', exit: 'mill' });
    await page.close();
  }, 120000);

  it('tells a scene on the map: the camera cut to the speaker, the words over them, the figure gesturing, a portrait beside', async () => {
    if (!browser) return;
    const { payload } = await resolveWorldScene({ ref: 'told', title: null, manifest: { kind: 'board', board: { seed: 'flat', relief: 0, cols: 8, rows: 8 }, talk: { portrait: true },
      battle: { party: [{ id: 'ayla', class: 'fighter', at: 'C2' }], foes: [{ id: 'g', foe: 'goblin', at: 'F7' }] },
      play: { scenes: [{ id: 'intro', when: { on: 'slot:before' }, names: { ayla: 'Ayla' }, beats: [{ shot: { frame: 'close', on: ['ayla'] } }, { line: { who: 'ayla', say: 'Hold the line.' } }] }] },
      game: { levelRef: 'told', mechanics: [{ kind: 'board' }] } } });
    expect(payload.board.talk).toEqual({ portrait: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1120, height: 780 });
    await page.setContent(emitThreeWorld({ ...payload, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojBoard && window.__mojBoard.talk.talking === 'ayla' && window.__mojBoard.talk.portrait > 2, { timeout: 60000 });
    const seen = await page.evaluate(() => {
      const b = window.__mojBoard, S = b.state(), at = b.board.spots[S.u.ayla.at], box = document.querySelector('.moj-scene-box'), r = box.getBoundingClientRect();
      const e = window.__mojCtrl.world.entities.find((x) => x.id === 'board-ayla');
      // the portrait: drawn, not blank
      const cv = [...document.querySelectorAll('canvas')].find((c) => c.width === 336), g = document.createElement('canvas'); g.width = 336; g.height = 336;
      const x = g.getContext('2d'); x.drawImage(cv, 0, 0); const px = x.getImageData(0, 0, 336, 336).data; let lit = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 0) lit++;
      return { shot: b.talk.shot, near: e ? Math.hypot(b.talk.shot[0] - e.transform.pos[0], b.talk.shot[1] - e.transform.pos[1]) : null, h: at.h, bubble: box.classList.contains('moj-board-bubble'), boxTop: r.top, gesture: e && e.moving && e.locomotion, lit };
    });
    expect(seen.bubble).toBe(true);
    expect(seen.boxTop).toBeLessThan(780 - 200);   // over the speaker, not along the bottom
    expect(seen.gesture).toBe('talk');
    expect(seen.lit).toBeGreaterThan(336 * 336 * 0.2);
    expect(seen.near).toBeLessThan(0.05);   // the camera cut to the speaker
    if (process.env.MOJULO_BOARD_SHOTS) await page.screenshot({ path: `${process.env.MOJULO_BOARD_SHOTS}/talk.png` });
    await page.waitForFunction(() => { if (window.__mojScenes.on()) window.__mojScenes.next(); return window.__mojBoard.mode !== 'scene'; }, { polling: 200, timeout: 10000 });
    const after = await page.evaluate(() => ({ shot: window.__mojBoard.talk.shot, bubble: document.querySelector('.moj-scene-box').classList.contains('moj-board-bubble') }));
    expect(after).toEqual({ shot: null, bubble: false });
    await page.close();
  }, 180000);

  it('plays each act\'s effect on the map, its numbers waiting on the hit, every piece gone and the world as it was after', async () => {
    if (!browser) return;
    const page = await open(fight([]));
    // the minds fight on the page's own clock: an act's effect stands in the world while it plays
    await page.waitForFunction(() => { const f = window.__mojBoard.fx; return f && f.playing > 0 && f.pieces > 0; }, { timeout: 30000, polling: 20 });
    expect(await page.evaluate(() => window.__mojBoard.fx.waiting)).toBe(true);
    await page.waitForFunction(() => window.__mojBoard.result, { timeout: 120000 });
    await page.waitForFunction(() => window.__mojBoard.fx.playing === 0, { timeout: 10000 });
    expect(await page.evaluate(() => window.__mojBoard.fx)).toEqual({ playing: 0, pieces: 0, waiting: false, dim: 1 });
    await page.close();
  }, 180000);

  it('summons on the map: the being risen, the world dimmed, the camera orbiting; then the world as it was, the view on its quarter', async () => {
    if (!browser) return;
    const page = await open(fight(['party']));
    for (const being of ['inferno', 'glacier', 'tempest', 'colossus', 'wyrm']) {
      const out = await page.evaluate((b) => window.__mojBoard.playFx(b, 'g1'), being);
      expect(out.land).toBeLessThan(out.dur);
      await page.waitForFunction(() => window.__mojBoard.fx.pieces > 1 && window.__mojBoard.camera.spin !== 0 && window.__mojBoard.fx.dim < 0.6, { timeout: 5000 });
      expect(await page.evaluate(() => !!window.__mojBoard.camera.shot), being).toBe(true);
      if (process.env.MOJULO_BOARD_SHOTS) { await new Promise((r) => setTimeout(r, (out.land - 0.6) * 1000)); await page.screenshot({ path: `${process.env.MOJULO_BOARD_SHOTS}/summon-${being}.png` }); }
      await page.waitForFunction(() => window.__mojBoard.fx.playing === 0, { timeout: 15000 });
      await page.waitForFunction(() => window.__mojBoard.camera.yaw === window.__mojBoard.camera.yawTo, { timeout: 5000 });
      const after = await page.evaluate(() => { const C = window.__mojBoard.camera, q = (C.yaw - Math.PI / 4) / (Math.PI / 2); return { fx: window.__mojBoard.fx, shot: C.shot, spin: C.spin, onQuarter: Math.abs(q - Math.round(q)) < 1e-6 }; });
      expect(after, being).toEqual({ fx: { playing: 0, pieces: 0, waiting: false, dim: 1 }, shot: null, spin: 0, onQuarter: true });
    }
    await page.close();
  }, 240000);

  it('a summoner\'s turn: the summon played on the map, its numbers landing with its strike, the battle as the kernel says', async () => {
    if (!browser) return;
    const M = { board: { seed: 'flat', relief: 0, cols: 8, rows: 8 }, battle: { seed: 'sum', players: ['party'], party: [{ id: 'sela', class: 'summoner', at: 'C2', bonus: { spd: 60 } }], foes: [{ id: 'g', foe: 'goblin', at: 'C5' }, { id: 'h', foe: 'goblin', at: 'D5' }] } };
    const P = assembleBoardScene(M), at = boardParse(P.board.B, 'C5');
    const page = await open(M);
    await page.waitForFunction(() => window.__mojBoard.mode === 'menu', { timeout: 20000 });
    const hp0 = await page.evaluate(() => window.__mojBoard.state().u.g.hp);
    expect(await page.evaluate((a) => window.__mojBoard.act({ kind: 'act', skill: 'inferno', at: a }), at)).toBe(true);
    // the being stands before the numbers do: the state has moved on, the floats wait for the strike
    const mid = await page.evaluate(() => ({ fx: window.__mojBoard.fx, hp: window.__mojBoard.state().u.g.hp }));
    expect(mid.fx.waiting).toBe(true);
    expect(mid.hp).toBeLessThan(hp0);
    await page.waitForFunction(() => !window.__mojBoard.fx.waiting && window.__mojBoard.fx.playing === 0, { timeout: 15000 });
    await page.close();
  }, 120000);

  it('defends on the board: towers built where the road allows, the waves walked and shot, the level won (or lost)', async () => {
    if (!browser) return;
    const M = (td) => ({ kind: 'board', board: { seed: 'td', relief: 0.2, cols: 8, rows: 10 }, td, game: { levelRef: 'td', mechanics: [{ kind: 'board' }] } });
    const { payload } = await resolveWorldScene({ ref: 'td', title: null, manifest: M({ waves: 2, first: 2 }) });
    expect(payload.board.td.waves.length).toBe(2);
    const page = await browser.newPage();
    await page.setViewport({ width: 1120, height: 780 });
    await page.setContent(emitThreeWorld({ ...payload, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojBoard && window.__mojBoard.td, { timeout: 20000 });
    // a tower where the road stays open; none where it would shut
    const built = await page.evaluate(() => {
      const td = window.__mojBoard.td, legal = td.legal(), B = window.__mojBoard.board;
      const mid = legal.filter((i) => Math.floor(i / B.cols) === 4 || Math.floor(i / B.cols) === 6).slice(0, 3);
      return mid.map((i, k) => td.place(i, ['arrow', 'frost', 'arrow'][k]));
    });
    expect(built).toEqual([true, true, true]);
    expect(await page.evaluate(() => window.__mojBoard.td.place(window.__mojBoard.td.state().towers ? Number(Object.keys(window.__mojBoard.td.state().towers)[0]) : 0))).toMatch(/cannot stand there/);
    // the waves on the page's own clock: foes walking, towers shooting
    await page.waitForFunction(() => window.__mojBoard.td.state().foes.length > 0 && window.__mojBoard.fx.playing > 0, { timeout: 20000 });
    if (process.env.MOJULO_BOARD_SHOTS) await page.screenshot({ path: `${process.env.MOJULO_BOARD_SHOTS}/td.png` });
    await page.evaluate(() => { const td = window.__mojBoard.td; for (let k = 0; k < 4000 && !td.result; k++) td.run(0.1); });
    await page.waitForFunction(() => window.__mojGame && window.__mojGame.envelope, { timeout: 10000 });
    expect(await page.evaluate(() => ({ result: window.__mojBoard.td.result, end: window.__mojGame.envelope.result }))).toEqual({ result: { won: true }, end: 'success' });
    await page.close();
    // standing by: overrun, the level failed
    const lost = await resolveWorldScene({ ref: 'td', title: null, manifest: M({ waves: [{ foes: { runner: 4 } }], lives: 2, first: 0 }) });
    const p2 = await browser.newPage();
    await p2.setContent(emitThreeWorld({ ...lost.payload, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await p2.waitForFunction(() => window.__mojBoard && window.__mojBoard.td, { timeout: 20000 });
    await p2.evaluate(() => { const td = window.__mojBoard.td; for (let k = 0; k < 4000 && !td.result; k++) td.run(0.1); });
    await p2.waitForFunction(() => window.__mojGame && window.__mojGame.envelope, { timeout: 10000 });
    expect(await p2.evaluate(() => window.__mojGame.envelope.result)).toBe('fail');
    await p2.close();
  }, 180000);

  it('plays a skirmish: units boxed and ordered by the mouse, workers mining, a barracks trained from, the enemy base taken', async () => {
    if (!browser) return;
    const { payload } = await resolveWorldScene({ ref: 'rts', title: null, manifest: { kind: 'board', board: { seed: 'rts', relief: 0.1, cols: 9, rows: 12 },
      rts: { army: 4, gold: 300, enemy: { gold: 0, workers: 0, army: 0 }, ai: { workers: 0, wave: 30 } }, game: { levelRef: 'rts', mechanics: [{ kind: 'board' }] } } });
    expect(payload.board.camera).toMatchObject({ edge: true, rotate: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1120, height: 780 });
    await page.setContent(emitThreeWorld({ ...payload, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojBoard && window.__mojBoard.rts, { timeout: 20000 });
    // a box dragged over the whole view: every unit of the player's, none of the enemy's
    await page.mouse.move(4, 4); await page.mouse.down(); await page.mouse.move(600, 400, { steps: 4 }); await page.mouse.move(1116, 776, { steps: 4 }); await page.mouse.up();
    const boxed = await page.evaluate(() => { const r = window.__mojBoard.rts, S = r.state(); return { sel: r.selected.units.length, mine: S.units.filter((u) => u.side === 'player').length }; });
    expect(boxed.sel).toBe(boxed.mine);
    // a right-click on the ground: the selection walks there
    await page.mouse.click(560, 470, { button: 'right' });
    expect(await page.evaluate(() => { const r = window.__mojBoard.rts, S = r.state(); return [...new Set(S.units.filter((u) => r.selected.units.includes(u.id)).map((u) => u.order.kind))]; })).toEqual(['move']);
    // the workers to a node: the purse fills (the army home first: left in the middle, the enemy's base is in its sight,
    // and an idle army fights what it sees)
    const out = await page.evaluate(() => {
      const r = window.__mojBoard.rts, S0 = r.state(), home = S0.buildings.find((b) => b.side === 'player').at;
      r.select(S0.units.filter((u) => u.side === 'player' && u.kind !== 'worker').map((u) => u.id));
      r.order({ kind: 'move', to: home + 9 });
      const S = r.state(), gold0 = S.gold.player;
      r.select(S.units.filter((u) => u.side === 'player' && u.kind === 'worker').map((u) => u.id));
      const node = S.nodes.find((n) => Math.floor(n.at / 9) < 6).at, how = r.command(node);
      for (let k = 0; k < 300; k++) r.run(0.1);
      // a barracks a few steps off the base, raised, then a soldier from it
      r.arm('build');
      const base = S.buildings.find((b) => b.side === 'player').at, spot = [base + 2 * 9 + 2, base + 2 * 9 - 2, base + 3 * 9].find((i) => window.__mojBoard.board.spots[i]);
      const built = r.armedClick(spot);
      for (let k = 0; k < 220; k++) r.run(0.1);
      const bar = r.state().buildings.find((b) => b.side === 'player' && b.kind === 'barracks');
      r.selectBuilding(bar.id);
      const trained = r.trainAt(0);
      for (let k = 0; k < 120; k++) r.run(0.1);
      return { how, mined: r.state().gold.player > gold0 - 150, built, trained, soldiers: r.state().units.filter((u) => u.side === 'player' && u.kind === 'soldier').length};
    });
    expect(out).toMatchObject({ how: 'gather', mined: true, built: 'built', trained: true });
    expect(out.soldiers).toBeGreaterThanOrEqual(3);
    // the army attack-moves on the enemy's base, and takes it
    await page.evaluate(() => {
      const r = window.__mojBoard.rts, S = r.state();
      r.select(S.units.filter((u) => u.side === 'player' && u.kind !== 'worker').map((u) => u.id));
      r.arm('amove');
      r.armedClick(S.buildings.find((b) => b.side === 'enemy' && b.kind === 'base').at);
      for (let k = 0; k < 3000 && !r.result; k++) r.run(0.1);
    });
    if (process.env.MOJULO_BOARD_SHOTS) await page.screenshot({ path: `${process.env.MOJULO_BOARD_SHOTS}/rts.png` });
    await page.waitForFunction(() => window.__mojGame && window.__mojGame.envelope, { timeout: 10000 });
    expect(await page.evaluate(() => ({ result: window.__mojBoard.rts.result, end: window.__mojGame.envelope.result }))).toEqual({ result: { won: true }, end: 'success' });
    await page.close();
  }, 180000);

  it('plays a skirmish between two civilizations, each drawn as its technology crafted it, the player climbing its ladder', async () => {
    if (!browser) return;
    const G = readGameworld(HALDEN_REACH), side = (cid) => { const r = rtsRoster(G, cid); return { ...r, looks: rtsLooks(G, cid, r, { kit: HALDEN_REACH.style.kit }) }; };
    const { payload } = await resolveWorldScene({ ref: 'civ', title: null, manifest: { kind: 'board', board: { seed: 'civ', relief: 0.1, cols: 9, rows: 14 },
      rts: { gold: 2000, army: 2, enemy: { gold: 0, workers: 0, army: 2 }, ai: { workers: 0, wave: 30 } }, game: { levelRef: 'civ', mechanics: [{ kind: 'board' }] } } });
    payload.board.rts = { ...payload.board.rts, sides: { player: side('survey-corps'), enemy: side('dome-growers') } };
    const page = await browser.newPage();
    await page.setViewport({ width: 1120, height: 780 });
    await page.setContent(emitThreeWorld({ ...payload, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojBoard && window.__mojBoard.rts, { timeout: 20000 });
    const out = await page.evaluate(() => {
      const r = window.__mojBoard.rts, B = window.__mojBoard.board, S0 = r.state(), base = S0.buildings.find((b) => b.side === 'player').at;
      const go = (s) => { for (let k = 0; k * 0.1 < s; k++) r.run(0.1); };
      // built by the workers sent to it: until nothing of the player's is still going up
      const up = () => { for (let k = 0; k < 2000 && r.state().buildings.some((b) => b.side === 'player' && b.raising > 0); k++) r.run(0.1); };
      // raise what it raises: a spot a few steps off the base that will take it
      const raise = (kind) => { r.arm('build', kind); for (const d of [2 * B.cols + 2, 2 * B.cols - 2, 3 * B.cols, 3 * B.cols + 3, 3 * B.cols - 3, 4 * B.cols + 1]) { if (!B.spots[base + d]) continue; const m = r.armedClick(base + d); if (m === 'built') return m; r.arm('build', kind); } return 'nowhere'; };
      const built = [raise('barracks')]; up();
      built.push(raise('mast')); up();
      const tooSoon = (() => { r.arm('build', 'works'); return r.armedClick(base + 4 * B.cols - 2); })();
      r.selectBuilding(r.state().buildings.find((b) => b.kind === 'mast' && b.side === 'player').id);
      const step = r.researchNext(); go(31);
      built.push(raise('works')); up();
      r.selectBuilding(r.state().buildings.find((b) => b.kind === 'works' && b.side === 'player').id);
      const trained = r.trainAt(2); go(20);
      const S = r.state(), looks = r.looks(), drawn = (kind, side = 'player') => S.units.concat(S.buildings).filter((x) => x.side === side && x.kind === kind).map((x) => looks[x.id]);
      // a fighter without a weapon: the cargo helicopter, the army right-clicked onto it, carried, and unloaded
      // (flight first: the tree's branch that opens what flies)
      r.selectBuilding(r.state().buildings.find((b) => b.kind === 'mast' && b.side === 'player').id); const flight = r.researchStep('flight'); go(31);
      r.selectBuilding(r.state().buildings.find((b) => b.kind === 'works' && b.side === 'player').id);
      const lifts = r.trainAt(3); go(20);
      const lifter = r.state().units.find((u) => u.kind === 'lifter'), army = r.state().units.filter((u) => u.side === 'player' && ['carbine', 'shield'].includes(u.kind)).map((u) => u.id);
      r.select(army); const boarded = r.command(lifter.at); go(8);
      const aboard = (r.state().units.find((u) => u.id === lifter.id).cargo || []).length;
      r.select([lifter.id]); r.order({ kind: 'unload' }); go(1);
      const out = r.state().units.filter((u) => army.includes(u.id) && !u.inside).length;
      // the base grows into its fort (G), the machines known
      const home = r.state().buildings.find((b) => b.side === 'player' && b.kind === 'base').id;
      r.selectBuilding(home); const grows = r.upgradeSel(); go(41);
      const fort = r.state().buildings.find((b) => b.id === home).kind;
      return { built, tooSoon, step, trained, flight, lifts, boarded, aboard, out, grows, fort, n: army.length, tier: S.known.player.tier2, skimmer: drawn('skimmer'), hauler: drawn('hauler'), mast: drawn('mast'), base: drawn('base'), lance: drawn('lance', 'enemy'), carbine: drawn('carbine') };
    });
    expect(out).toMatchObject({ built: ['built', 'built', 'built'], step: 'tier2', trained: true, tier: true, lifts: true, boarded: 'board', grows: true, fort: 'fort', flight: 'flight' });
    expect([out.aboard, out.out]).toEqual([Math.min(out.n, 4), out.n]);
    expect(out.tooSoon).toMatch(/needs Machines researched first/);
    // what it crafted is drawn as crafted (coloured meshes); what it did not (the plain base) as before
    expect(out.skimmer.length).toBe(1);
    for (const k of ['skimmer', 'hauler', 'mast', 'carbine', 'lance']) expect(out[k].every((n) => n >= 1)).toBe(true);
    expect(out.base).toEqual([0]);
    if (process.env.MOJULO_BOARD_SHOTS) {
      await page.screenshot({ path: `${process.env.MOJULO_BOARD_SHOTS}/rts-civ.png` });
      for (let k = 0; k < 3; k++) await page.keyboard.press('KeyZ');
      await page.evaluate(() => { for (let k = 0; k < 10; k++) window.__mojBoard.rts.run(0.1); });
      await page.screenshot({ path: `${process.env.MOJULO_BOARD_SHOTS}/rts-civ-near.png` });
    }
    await page.close();
  }, 180000);

  it('shows what is on whom: a stun\'s mark, a shield cast with F, a cloaked foe unseen until an eye comes near', async () => {
    if (!browser) return;
    const units = { ...RTS_UNITS,
      zap: { name: 'Zapper', role: 'ranged', hp: 200, atk: 2, range: 4, rate: 0.5, speed: 1.8, cost: 70, time: 12, onHit: { status: 'stun', time: 1.5, every: 2 }, abilities: { shield: { shield: 40, time: 8, cooldown: 20 } } },
      eye: { name: 'Eye', role: 'scout', hp: 300, atk: 0, range: 0, rate: 1, speed: 2, cost: 60, time: 10, detects: 5 },
      ghost: { name: 'Ghost', role: 'ranged', hp: 300, atk: 1, range: 4, rate: 1.2, speed: 1.8, cost: 90, time: 12, cloak: true } };
    const side = (army) => ({ units, buildings: RTS_BUILDINGS, worker: 'worker', base: 'base', army, builds: ['barracks'] });
    const { payload } = await resolveWorldScene({ ref: 'fx', title: null, manifest: { kind: 'board', board: { seed: 'fx', relief: 0, cols: 6, rows: 12 },
      rts: { workers: 0, army: 2, enemy: { workers: 0, army: 2 }, ai: { workers: 0, wave: 30 } }, game: { levelRef: 'fx', mechanics: [{ kind: 'board' }] } } });
    payload.board.rts = { ...payload.board.rts, sides: { player: side(['zap', 'eye']), enemy: side(['soldier', 'ghost']) } };
    const page = await browser.newPage();
    await page.setViewport({ width: 1120, height: 780 });
    await page.setContent(emitThreeWorld({ ...payload, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojBoard && window.__mojBoard.rts, { timeout: 20000 });
    const out = await page.evaluate(() => {
      const r = window.__mojBoard.rts, S = r.state(), ghost = S.units.find((u) => u.kind === 'ghost').id, soldier = S.units.find((u) => u.kind === 'soldier').id;
      const zap = S.units.find((u) => u.kind === 'zap').id, eye = S.units.find((u) => u.kind === 'eye').id, foeBase = S.buildings.find((b) => b.side === 'enemy').at;
      const unseen = !r.marks(ghost).visible;
      // the zapper casts its shield, then the two walk on the enemy's base: the soldier stunned on the way, the ghost seen once the eye is near
      r.select([zap]); const cast = r.castSel(); const shield = r.marks(zap).marks.includes('shield');
      r.select([zap, eye]); r.order({ kind: 'amove', to: foeBase });
      let stunned = false, seen = false;
      for (let k = 0; k < 400 && !(stunned && seen); k++) { r.run(0.1); const m = r.marks(soldier); if (m && m.marks.includes('stun')) stunned = true; const g = r.marks(ghost); if (g && g.visible) seen = true; }
      return { unseen, cast, shield, stunned, seen };
    });
    expect(out).toEqual({ unseen: true, cast: 1, shield: true, stunned: true, seen: true });
    if (process.env.MOJULO_BOARD_SHOTS) await page.screenshot({ path: `${process.env.MOJULO_BOARD_SHOTS}/rts-fx.png` });
    await page.close();
  }, 180000);

  it('opens an epoch\'s map on its begin slot: the party waits on the scene before it may set out', async () => {
    if (!browser) return;
    const dots = [{ id: 'gate', ref: 'lv-gate' }, { id: 'keep', ref: 'lv-keep', gate: 'gate' }];
    const { payload } = await resolveWorldScene({ ref: 'map', title: null, manifest: { kind: 'board', board: { seed: 'epoch-1', relief: 0.3, cols: 10, rows: 8 }, map: { dots },
      play: { scenes: [{ id: 'dawn', when: { on: 'slot:begin' }, beats: [{ line: { who: 'narrator', say: 'The first age.' } }] }] },
      game: { levelRef: 'map', mechanics: [{ kind: 'map', slice: 'campaign', dots: dots.map((d) => d.id) }] } } });
    expect(payload.board.slots).toEqual(['begin']);
    const page = await browser.newPage();
    await page.setContent(emitThreeWorld({ ...payload, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojBoard && window.__mojBoard.slot === 'begin' && window.__mojScenes.on(), { timeout: 20000 });
    expect(await page.evaluate(() => window.__mojBoard.goTo('gate'))).toBe(false);
    await page.waitForFunction(() => { if (window.__mojScenes.on()) window.__mojScenes.next(); return window.__mojBoard.mode === 'map'; }, { polling: 200, timeout: 10000 });
    expect(await page.evaluate(() => window.__mojBoard.goTo('gate'))).toBe(true);
    await page.close();
  }, 120000);

  it('plays the player\'s turn by the menu: move, act with a forecast, wait and face, and the turn passes on', async () => {
    if (!browser) return;
    const page = await open(fight(['party'], ['C4', 'D4', 'E4'], ['C6', 'D7', 'F7']));
    const turn = () => page.evaluate(() => { const b = window.__mojBoard; for (let k = 0; k < 400 && b.mode === 'cpu'; k++) b.run(0.1); const S = b.state(); return { mode: b.mode, who: S.turn && S.turn.who, menu: b.menu, hud: b.hud }; });
    let t = await turn();
    expect(t.mode).toBe('menu');
    expect(t.menu.map((x) => x.label)).toEqual(['Move', 'Act', 'Wait']);
    const who = t.who;
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');   // Act
    t = await turn();
    expect(t.menu[0].label).toBe('Attack');
    expect(t.menu.at(-1).label).toMatch(/^Potion {2}×2$/);
    const k = t.menu.findIndex((x) => x.ok);
    for (let j = t.menu.findIndex((x) => x.ok); j < k; j++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');                                           // aim the first act that can land
    t = await turn();
    expect(t.mode).toBe('aim');
    expect(t.hud).toMatch(/→ ~\d+ {2}\d+%/);
    await page.keyboard.press('Enter');                                           // act
    t = await turn();
    expect(t.menu.find((x) => x.label === 'Act').ok).toBe(false);
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');   // Wait (Move, or Wait when it cannot)
    if ((await turn()).mode === 'move') { await page.keyboard.press('Escape'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); }
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');  // face, and end
    t = await turn();
    expect(t.who).not.toBe(who);
    await page.close();
  }, 120000);
});
