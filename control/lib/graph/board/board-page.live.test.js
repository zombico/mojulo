// The board on the World page (an e2e suite: a real browser, skipped when none is installed): a battle the minds fight
// in the page ends where the same battle ends in Node, step for step; and the player's turn is the menu's: Move, Act
// (the attack, the skills, the bag), Wait, an aimed act's forecast, the turn passing on.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { assembleBoardScene } from './board-scene.js';
import { buildBoard, boardStart, boardApply, boardLegal } from './board-kernel.js';
import { boardMindPlan } from './board-mind.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { rpgInit, rpgSave, rpgLoad, rpgStatsOf } from '../playscape/rpg/kernel.js';
import { boardCarryDraw } from './board-carry.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

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
