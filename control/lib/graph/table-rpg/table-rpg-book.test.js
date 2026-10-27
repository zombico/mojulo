import { describe, it, expect } from 'vitest';
import { tableRpgBook } from './table-rpg-book.js';
import { roomNumbers, dungeonMapSvg, worldMapSvg, rankLayout } from './table-rpg-maps.js';
import { readModule } from './table-rpg-module.js';
import { tableTape } from './table-rpg-kernel.js';
import { BOOK_FORMATS, BOOK_STYLES } from '../book/book-style.js';
import { SUNKEN_CHAPEL } from './fixtures/sunken-chapel.js';

const read = (extra = {}) => readModule({ ...SUNKEN_CHAPEL, ...extra }).K;

describe('the maps: the dungeon as a numbered flowchart, the world as a point-crawl', () => {
  it('ranks by distance from the start, each rank ordered by its neighbours before it', () => {
    const { at, ranks } = rankLayout(['a', 'b', 'c', 'd', 'e'], [['a', 'b'], ['a', 'c'], ['c', 'd']], 'a');
    expect(ranks).toEqual([['a'], ['b', 'c'], ['d'], ['e']]);
    expect(at.d[1]).toBe(2);
    expect(at.e[1]).toBe(3);   // unreached: a last rank of its own
  });

  it('every room drawn once with the key\'s number, every link drawn and marked by its kind', () => {
    const K = read(), D = K.D.chapel, svg = dungeonMapSvg(K, 'chapel'), num = roomNumbers(D);
    for (const id of Object.keys(D.rooms)) {
      expect(svg.match(new RegExp(`id="room-${id}"`, 'g'))).toHaveLength(1);
      expect(svg).toMatch(new RegExp(`id="room-${id}">.*?>${num[id]}</text>`));
    }
    const links = D.links;
    expect((svg.match(/class="link /g) ?? []).length).toBe(links.length);
    for (const kind of new Set(links.map((l) => l.kind ?? 'open'))) expect(svg).toContain(`class="link ${kind}"`);
    expect(svg).toMatch(/class="link secret"[^>]*stroke-dasharray/);
    expect(dungeonMapSvg(K, 'chapel')).toBe(svg);
    expect(() => dungeonMapSvg(K, 'tower')).toThrow(/no dungeon 'tower'/);
  });

  it('the world: a mark for every place, a road for every route with its days, the start marked', () => {
    const K = read(), svg = worldMapSvg(K);
    for (const id of Object.keys(K.places)) expect(svg).toContain(`id="place-${id}"`);
    expect((svg.match(/class="road"/g) ?? []).length).toBe(SUNKEN_CHAPEL.world.routes.length);
    expect(svg).toContain('1 day');
    expect(svg).toContain('>start<');
  });
});

describe('the game book: the module set by the press', () => {
  it('is pure: the same module and style, the same page', () => {
    const K = read();
    expect(tableRpgBook(K).html).toBe(tableRpgBook(K).html);
  });

  it('keys every room by the number its map gives it, every place by a letter, every foe as a stat block', () => {
    const K = read(), { html } = tableRpgBook(K), num = roomNumbers(K.D.chapel);
    for (const [id, n] of Object.entries(num)) expect(html).toContain(`<span class="n">${n}</span> ${K.D.chapel.rooms[id].name.replace(/^./, (c) => c.toUpperCase())}</h3>`);
    expect(html).toContain('<span class="n">A</span> Millbrook');
    for (const F of Object.values(SUNKEN_CHAPEL.foes)) expect(html).toContain(`<h4>${F.name}</h4>`);
    expect(html).toContain('locked to 7, the Crypt (the iron key; or forced: a hard might check)');
    expect(html).toContain('<b class="label">On first entering</b>');
  });

  it('a sheet a page for each member as rolled, and the dice tape of the seed', () => {
    const K = read(), { html } = tableRpgBook(K);
    expect((html.match(/<section class="page">/g) ?? []).length).toBe(K.party.length);
    for (const p of K.party) expect(html).toContain(`<h3>${p.name}</h3>`);
    expect(html).toContain(tableTape(K.seed, 20, 20).map((v) => String(v).padStart(2)).join(' '));
    expect(tableRpgBook(K, { tape: 0 }).html).not.toContain('id="tape"');
  });

  it('the card speaks through the book: its rules, its numbers, its attribution when it carries one', () => {
    const bands = tableRpgBook(read({ system: 'bands' })).html;
    expect(bands).toContain('2d6 plus a stat');
    expect(bands).toMatch(/harm track/);
    expect(bands).toContain('□□□□□□');   // a short fixed track is boxes to tick
    const own = tableRpgBook(read({ system: { ...readModule(SUNKEN_CHAPEL).K.sys, name: 'house', attribution: 'Rules by the table.' } })).html;
    expect(own).toContain('Rules: the house card. Rules by the table.');
  });

  it('a one-sheet format keeps what the table needs in play; every other format the whole book', () => {
    const K = read();
    const onePage = Object.keys(BOOK_STYLES).find((s) => BOOK_FORMATS[BOOK_STYLES[s].format].onePage);
    const sheet = tableRpgBook(K, { style: onePage }).html;
    for (const id of ['title', 'dungeon-chapel', 'foes', 'tables']) expect(sheet).toContain(`id="${id}"`);
    for (const id of ['running', 'world', 'party', 'tape']) expect(sheet).not.toContain(`id="${id}"`);
    const whole = tableRpgBook(K, { style: 'zine' }).html;
    for (const id of ['title', 'running', 'world', 'dungeon-chapel', 'foes', 'tables', 'party', 'tape', 'colophon']) expect(whole).toContain(`id="${id}"`);
  });

  it('says the style\'s advice, and refuses a style it does not know', () => {
    expect(tableRpgBook(read(), { style: 'screen' }).findings[0].text).toMatch(/screen look/);
    expect(() => tableRpgBook(read(), { style: 'glossy' })).toThrow(/no style 'glossy'/);
  });
});
