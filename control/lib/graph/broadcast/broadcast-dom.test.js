// The table's broadcast: a board game is shown in its own furniture by default (the `table` package built of the page's
// materials: the board's wood or the card table's felt, the light inlay, brass), a recipe may still ask for a TV look,
// the CSS carries the package (mixed case on the table, capitals on the TV), and the client, run in a DOM, seats the
// players, pops a score that rose, raises a call, and at the end puts up the result with its medals.
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { tableBroadcastData, broadcastDomCss, broadcastDomClient, TABLE_LOOKS, END_WORDS } from './broadcast-dom.js';
import { colorRamp, contrast } from './broadcast-package.js';

const PLAYERS = [{ id: 'white', colour: '#f3ede2' }, { id: 'black', colour: '#2a2420' }];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function page(BC) {
  const dom = new JSDOM(`<!doctype html><html><head><style>${broadcastDomCss(BC)}</style></head><body><main></main></body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const tv = dom.window.eval(`(${broadcastDomClient.toString()})(${JSON.stringify(BC)})`);
  return { doc: dom.window.document, tv, dom };
}

describe('the table\'s broadcast data', () => {
  it('is the game\'s own furniture by default: its material, its inlay, its kits; a TV look only when asked', () => {
    const wood = tableBroadcastData(PLAYERS);
    expect(wood.package).toBe('table');
    expect(wood.card.glass).toEqual([colorRamp(TABLE_LOOKS.wood.surface).hi, colorRamp(TABLE_LOOKS.wood.surface).lo]);
    expect(wood.glassInk).toBe(TABLE_LOOKS.wood.inlay);   // ivory on the wood
    expect(contrast(wood.glassInk, wood.card.glass[1])).toBeGreaterThanOrEqual(4.5);
    expect(wood.colors.map((c) => c.base)).toEqual(['#f3ede2', '#2a2420']);
    expect(wood.colors[1].key).toBe(true);   // the black side keylined on the dark wood
    expect(wood.ends).toBe(END_WORDS);
    expect(tableBroadcastData(PLAYERS, undefined, undefined, TABLE_LOOKS.felt).card.inlay).toBe(TABLE_LOOKS.felt.inlay);
    expect(tableBroadcastData(PLAYERS, 'network').package).toBe('network');
    expect(() => tableBroadcastData(PLAYERS, 'tv')).toThrow(/tabletop: broadcast package 'tv'/);
  });
  it('writes the package as CSS: mixed case and grain on the table, capitals on the TV, every kit a class', () => {
    const table = broadcastDomCss(tableBroadcastData(PLAYERS)), tv = broadcastDomCss(tableBroadcastData(PLAYERS, 'stadium'));
    expect(table).not.toMatch(/text-transform:uppercase/);
    expect(table).toMatch(/repeating-linear-gradient/);
    expect(tv).toMatch(/text-transform:uppercase/);
    for (const css of [table, tv]) { expect(css).toMatch(/\.tv-c0\{/); expect(css).toMatch(/\.tv-c1\{/); expect(css).toMatch(/prefers-reduced-motion/); }
  });
});

describe('the table\'s broadcast client', () => {
  it('seats the players, lights the one to play, and pops a score that rose', () => {
    const { doc, tv } = page(tableBroadcastData(PLAYERS));
    tv.frame({ seats: [{ name: 'You', color: 0, score: 0, live: true }, { name: 'black', color: 1, score: 0 }], tab: 'Your move' });
    expect([...doc.querySelectorAll('.tv-seat .tv-name')].map((e) => e.textContent)).toEqual(['You', 'black']);
    expect(doc.querySelector('.tv-seat.live .tv-name').textContent).toBe('You');
    tv.frame({ seats: [{ name: 'You', color: 0, score: 3 }, { name: 'black', color: 1, score: 0, live: true }], tab: 'Thinking…' });
    expect(doc.querySelector('.tv-seat .tv-score').classList.contains('tv-pop')).toBe(true);
    expect(doc.querySelector('.tv-gain').textContent).toBe('+3');
    expect(doc.querySelector('.tv-tab').textContent).toBe('Thinking…');
  });
  it('raises a call, and at the end its word and then the result with the medals', async () => {
    const { doc, tv } = page({ ...tableBroadcastData(PLAYERS), card: { ...tableBroadcastData(PLAYERS).card, hold: 6, in: 3, out: 3 } });
    tv.call({ text: 'Check', sub: 'black to answer', tone: 'warn' });
    tv.call({ text: 'Your move', tone: 'neutral' });   // lighter: it waits
    expect(doc.querySelector('.tv-plate').textContent).toBe('Check');
    tv.table({ players: PLAYERS, me: 0, scores: [12, 7], live: -1, over: { winner: 0, reason: 'mate' }, again() {} });
    expect(doc.querySelector('.tv-plate').textContent).toBe('You win');   // the decisive word takes the plate
    expect(doc.querySelector('.tv-sub').textContent).toBe(END_WORDS.mate);
    await sleep(1500);
    expect(doc.querySelector('.tv-result').hidden).toBe(false);
    expect([...doc.querySelectorAll('.tv-row .tv-name')].map((e) => e.textContent)).toEqual(['You', 'black']);
    expect(doc.querySelector('.tv-row .tv-medal').classList.contains('tv-m1')).toBe(true);
    tv.clear();
    expect(doc.querySelector('.tv-result').hidden).toBe(true);
  });
});
