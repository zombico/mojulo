// The board on the World page (an e2e suite: a real browser, skipped when none is installed): a battle the minds fight
// in the page ends where the same battle ends in Node, step for step; and the player's turn is the menu's: Move, Act
// (the attack, the skills, the bag), Wait, an aimed act's forecast, the turn passing on.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { assembleBoardScene } from './board-scene.js';
import { buildBoard, boardStart, boardApply, boardLegal } from './board-kernel.js';
import { boardMindPlan } from './board-mind.js';
import { emitThreeWorld } from '../scene/scene-three.js';
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
