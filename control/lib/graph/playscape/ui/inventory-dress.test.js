/**
 * The inventory's dress: the guide's closed words for a grid view, read and taught, drawn as CSS from words only,
 * absent ⇒ nothing added, carried from the guide to the page, and asked of an approved guide without a reroll.
 */
import { describe, it, expect } from 'vitest';
import { DRESS_DIALS, INVENTORY_LOOKS, LOOK_IDS, readDress, cleanDress, inventoryCss } from './inventory-dress.js';
import { resolvePlayUi, lowerPlay, UI_ITEMS } from './direction.js';
import { uiBoardHtml } from './board-html.js';
import { eventsChannelScript } from '../../scene/channels/events.js';

const seeded = () => 4242;
const bag = { menus: [{ id: 'bag', kind: 'inventory', title: 'Bag' }], items: { tonic: { use: [{ add: 'hp', by: 5 }] }, sword: { equip: { slot: 'hand' } } } };
const WORLD = (play, extra = {}) => ({ kind: 'controllable', title: 'Test', ...extra, play });
const settle = (u) => ({ ...u, status: Object.fromEntries(UI_ITEMS.map((k) => [k, 'approved'])) });

// the sweeps over every look, flavor and word are in inventory-dress.deep.test.js
describe('the words', () => {
  it('a look, a look with words over it, and the flavor\'s look read', () => {
    expect(readDress('satchel')).toEqual({ look: 'satchel', ...Object.fromEntries(DRESS_DIALS.map((d) => [d, INVENTORY_LOOKS.satchel[d]])) });
    expect(readDress({ look: 'loadout', shape: 'hex' })).toMatchObject({ look: 'loadout', tile: 'compact', shape: 'hex' });
    expect(readDress({ card: 'below' })).toMatchObject({ look: 'classic', card: 'below' });
    expect(readDress('flavor', 'cozy').look).toBe('satchel');
  });
  it('a wrong word teaches the set', () => {
    expect(() => readDress('cosy')).toThrow(/look is one of: classic/);
    expect(() => readDress({ shape: 'oval' })).toThrow(/shape is one of: square, rounded/);
    expect(() => readDress({ colour: 'red' })).toThrow(/no such word/);
    expect(() => readDress('flavor')).toThrow(/no border flavor/);
    expect(() => readDress(3)).toThrow(/is a look/);
  });
});

describe('the dom backend', () => {
  it('classic adds nothing: the page\'s own grid is the classic look', () => {
    expect(inventoryCss(readDress('classic'))).toBe('');
    expect(inventoryCss(undefined)).toBe('');
  });
  it('a look off the classic one draws a sheet, every rule under the scope', () => {
    const look = LOOK_IDS.find((l) => l !== 'classic' && INVENTORY_LOOKS[l].backdrop !== 'none');
    const css = inventoryCss(readDress(look), '.st');
    expect(css).not.toBe('');
    expect(css.split('}').filter(Boolean).every((r) => r.trim().startsWith('.st'))).toBe(true);
  });
  it('a hand-poked dress keeps known words only: no author string reaches the sheet', () => {
    const css = inventoryCss({ tile: 'large', shape: 'red;}body{display:none', kinds: 'accent' });
    expect(css).not.toMatch(/display:none/);
    expect(css).toMatch(/--moj-tile:58px/);
    expect(cleanDress({ backdrop: 'blur', nope: 1 })).toEqual({ ...cleanDress(null), backdrop: 'blur' });
  });
});

describe('the guide carries it', () => {
  it('absent: the guide, its sources and the page are as they were', () => {
    const u = resolvePlayUi(WORLD({ ...bag, ui: 'propose' }), seeded).play.ui;
    expect(u.guide.inventory).toBeUndefined();
    expect(u.guide.sources.inventory).toBeUndefined();
    expect(lowerPlay(WORLD({ ...bag, ui: settle(u) })).register.inventory).toBeUndefined();
  });
  it('asked: on the guide with its source, and on the page once settled', () => {
    const u = resolvePlayUi(WORLD({ ...bag, ui: { border: 'covert', inventory: 'flavor' } }), seeded).play.ui;
    expect(u.guide.inventory.look).toBe('loadout');
    expect(u.guide.sources.inventory).toBe('operator');
    const ev = lowerPlay(WORLD({ ...bag, ui: settle(u) }));
    expect(ev.register.inventory).toEqual(u.guide.inventory);
    const page = eventsChannelScript(ev);
    expect(page).toContain(JSON.stringify(inventoryCss(u.guide.inventory)).slice(1, 60));
  });
  it('the hints dress it when the operator does not', () => {
    const u = resolvePlayUi(WORLD({ ...bag, ui: 'propose' }, { play_hints: { inventory: 'tactical' } }), seeded).play.ui;
    expect(u.guide.inventory.look).toBe('tactical');
    expect(u.guide.sources.inventory).toBe('hints');
  });
  it('a page without menus draws no dress, even when the guide has one', () => {
    const u = resolvePlayUi(WORLD({ parts: [], ui: { inventory: 'satchel' } }), seeded).play.ui;
    const ev = lowerPlay(WORLD({ parts: [{ part: 'banner', bind: { on: 'won' }, text: 'Won' }], ui: settle(u) }));
    expect(eventsChannelScript(ev)).not.toContain('--moj-tile:58px');
  });
  it('asked of an approved guide: the dress alone is redrawn and the guide is proposed again', () => {
    const u = settle(resolvePlayUi(WORLD({ ...bag, ui: 'propose' }, { tone: 'isekai' }), seeded).play.ui);
    const next = resolvePlayUi(WORLD({ ...bag, ui: { ...u, ask: { ...u.ask, inventory: { look: 'satchel', badge: 'none' } } } }, { tone: 'isekai' }), () => 7).play.ui;
    expect(next.guide.tokens).toEqual(u.guide.tokens);
    expect(next.guide.register).toBe(u.guide.register);
    expect(next.guide.inventory).toMatchObject({ look: 'satchel', badge: 'none' });
    expect(next.status.guide).toBe('proposed');
    expect(next.status.motion).toBe('approved');
    // asked again unchanged: nothing moves
    const again = resolvePlayUi(WORLD({ ...bag, ui: settle(next) }, { tone: 'isekai' }), () => 9).play.ui;
    expect(again.guide).toEqual(next.guide);
  });
});

describe('the board', () => {
  it('draws the grid view in every look, the worn one marked', () => {
    const u = resolvePlayUi(WORLD({ ...bag, ui: { inventory: 'armory' } }), seeded).play.ui;
    const html = uiBoardHtml(WORLD({ ...bag, ui: u }));
    expect(html).toContain('data-piece="ui:dress:bag"');
    expect((html.match(/<figure class="dress/g) || []).length).toBe(LOOK_IDS.length);
    expect(html).toMatch(/class="dress worn"[^]*?<b>armory<\/b>/);
  });
});
