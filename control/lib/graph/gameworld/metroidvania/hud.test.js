// The box's HUD and pause (hud.js): a metroidvania read as the castle games read, on mana-ui. The concepts: the spec is
// one the runtime reads; every cell of the box is a room on its map, the rooms squared and inside it; what the box holds
// (its relics by kind, its bosses by name) rides the feed; the game's look re-keyed with its box's theme; heard in its
// look's sounds; a game with no look keeps the page's own HUD.
import { describe, it, expect } from 'vitest';
import { manaUi } from '../../../mana-ui/index.js';
import { boxHud, boxHudSpec, BOX_LOOKS } from './hud.js';
import { boxOf } from './scene.js';
import { vampireSonata, vampireSonataGame } from './vampire-sonata.js';
import { BOX_THEME_IDS } from './themes.js';
import { THEME_CARDS } from '../../playscape/ui/theme-cards/loader.js';
import { readGameworld } from '../world.js';
import { gameStages, stageLevelOrder } from '../levels.js';

const M = (words) => ({ kind: 'geocube', show: 'metroidvania', metroidvania: words, stature: 1.69 });
const order = (W) => { const [st] = gameStages(W); return stageLevelOrder(W, st, { heroRef: 'h', heroStature: 1.69, ref: 'l' }).args.manifest; };

describe('the box\'s HUD and pause', () => {
  it('is a spec the runtime reads: the vitals, the moments, what is held, and the pause; the minimap and the boss\'s bar the page\'s own', () => {
    expect(() => manaUi.readSpec(boxHudSpec())).not.toThrow();
    const S = JSON.stringify(boxHudSpec()), hud = JSON.stringify(boxHudSpec().hud);
    for (const b of ['bx.hp', 'bx.mp', 'bx.moments', 'bx.shapes', 'bx.relics']) expect(S).toContain(b);
    expect(boxHudSpec().screens.pause).toBeDefined();
    // (drawn once: the explored map's corner and the boss's bar across the foot are the page's, explored-view.js and
    // held-gates-view.js; the pause keeps its map)
    expect(hud).not.toContain('bx.bossOn');
    expect(hud).not.toContain('"use":"map"');
    expect(JSON.stringify(boxHudSpec().screens.pause)).toContain('"use":"map"');
  });

  it('lays every room of the box on its map, squared, and carries what the box holds', () => {
    const B = boxOf(M(vampireSonata())), H = boxHud({ theme: 'nocturne', layout: B.layout, screen: B.greybox.screen, held: B.held, bossHp: 6 }), F = H.feed.box;
    expect(F.cells.every((k) => k >= 0)).toBe(true);
    expect(new Set(F.cells).size).toBe(B.layout.rooms.length);
    for (const R of F.rooms) { expect(R.x).toBeGreaterThanOrEqual(0); expect(R.y).toBeGreaterThanOrEqual(0); expect(R.x + R.w).toBeLessThanOrEqual(1 + 1e-6); expect(R.y + R.h).toBeLessThanOrEqual(1 + 1e-6); }
    expect(F.relics.map((x) => x.kind)).toEqual(expect.arrayContaining(['power', 'key']));
    expect(F.bosses.every((b) => !/falls/.test(b.name))).toBe(true);
    expect(F.rooms.filter((R) => R.save).length).toBe(B.held.saves.length);
  });

  it('wears its box theme\'s card and is heard in its sounds; with no look, none of it', () => {
    for (const id of BOX_THEME_IDS) expect(THEME_CARDS[BOX_LOOKS[id]], id).toBeDefined();
    const m = order(readGameworld(vampireSonataGame({ heroRef: 'h' })));
    expect(m.manaHud.feed.box).toBeDefined();
    expect(m.manaHud.sounds.set).toBe('crypt');
    // (a frost castle's HUD in the frost card)
    const G = vampireSonataGame({ heroRef: 'h' }); G.levels.castle.metroidvania.theme = 'castle-frost';
    expect(order(readGameworld(G)).manaHud.theme.tokens.accent).toBe(THEME_CARDS['nocturne-frost'].tokens.accent);
    const bare = vampireSonataGame({ heroRef: 'h' }); delete bare.ui;
    expect(order(readGameworld(bare)).manaHud).toBeUndefined();
  });
});
