// A LEVEL'S HUD GRAMMAR: asked for by the genre's row, filled from the level's own mechanics, drawn by mana-ui.
import { describe, it, expect } from 'vitest';
import { levelGrammar, mapPlaces, HEART_HITS } from './hud-grammar.js';
import { composeGameworld } from './compose.js';
import { readGameworld } from './world.js';
import { inputMap } from './input-map.js';
import { readHudGrammar, hudGrammarSpec, hudGrammarScript } from '../scene/channels/hud-grammar.js';
import { manaUi } from '../../mana-ui/kernel.js';
import { guideScript } from '../scene/channels/guide.js';
import { rowInventory, bagStart, ITEM_KEYS } from './inventory.js';
import { interfaceLook } from '../playscape/ui/interface-look.js';
import { readTheme } from '../../mana-ui/theme.js';

const G = readGameworld(composeGameworld({ prompt: 'an anime action rpg like zelda', name: 'Artesia' }));
const MECH = [{ kind: 'fail-on-death', startHp: 20, hits: 2, bar: true }, { kind: 'reach-exit', at: [70, -36, 2], radius: 2.5, holds: { who: 'foe-*', count: 3 } }, { kind: 'collect', into: 'bag', pickups: [{ item: 'healing draught', at: [1, 2, 0] }] }];

describe('a level\'s HUD grammar drawn as a game\'s', () => {
  it('what is held at the top right and never what the body does; the map a scope; the stamina and the lock over the world', () => {
    const g = levelGrammar(G, MECH), spec = hudGrammarSpec(g), C = spec.hud.children;
    expect(() => manaUi.readSpec(spec)).not.toThrow();
    // (the stamina ring and the lock on the anchors, the hearts alone at the top left, what is held at the top right, the
    // radar at the bottom right; nothing at the foot's middle)
    expect(C.filter((c) => c.use === 'anchors')).toHaveLength(2);
    expect(C.filter((c) => c.use === 'region').map((c) => c.props.at)).toEqual(['top-left', 'top', 'top-right', 'bottom-right']);
    expect(JSON.stringify(C.find((c) => c.props && c.props.at === 'bottom-right'))).toContain('"scope":true');
    const js = hudGrammarScript(g);
    expect(js).toContain('"body":["guard","sprint","lock"]');
    expect(js).toContain('.moj-c-lock');
    // (the hearts by quarters: a hit takes part of a heart)
    expect(js).toContain('Math.ceil((hp / cfg.hearts.per) * 4) / 4');
    const rt = manaUi.runtime(spec, { read: (p) => manaUi.readPath({ hud: { hearts: 3.25, heartsMax: 5, slots: [], ring: [], lock: [], moments: [] } }, p) });
    expect(rt.view()).toContain('♥♥♥<span class="mana-pip-part" style="--f:0.25"><b>♥</b>♡</span>♡');
  });
});

describe('a level\'s HUD grammar', () => {
  it('is the genre row\'s: hearts of two hits each, the kit\'s weapon and sidearm on the input map\'s controls, what it collects, its goal', () => {
    const g = levelGrammar(G, MECH);
    expect(g.hearts).toEqual({ var: 'hp', per: 2 * HEART_HITS, max: 5 });
    const M = Object.fromEntries(inputMap({ moveset: true, sidearm: 'bow' }).map((r) => [r.id, r]));
    // (what it holds, then what the body does: each an icon on its control, so no reminder text is needed)
    expect(g.slots.map((s) => s.id)).toEqual(['weapon', 'sidearm', 'item:healing draught', 'guard', 'sprint', 'lock']);
    expect(g.slots.find((s) => s.id === 'sprint')).toMatchObject({ icon: 'dash', keys: 'F' });
    expect(g.slots[0]).toMatchObject({ keys: M.light.keys, pad: M.light.pad });
    expect(g.slots[1]).toMatchObject({ name: 'Bow', keys: M.special.keys, pad: M.special.pad });
    expect(g.goal).toEqual([70, -36]);
    expect(g.objective).toMatch(/foes/);
    expect(readHudGrammar(g)).toBeTruthy();
  });
  it('is none for a world with no row, or a level whose hero has no health', () => {
    expect(levelGrammar({ intent: { from: 'no-such-genre' } }, MECH)).toBe(null);
    expect(levelGrammar(G, [{ kind: 'reach-exit', at: [0, 0, 0] }])).toBe(null);
  });
  it('draws on mana-ui: a spec the kernel reads, a slot\'s count the var of the HUD row it names; a bad word is refused', () => {
    const g = levelGrammar(G, MECH);
    expect(() => manaUi.readSpec(hudGrammarSpec(g))).not.toThrow();
    const js = hudGrammarScript(g, [{ var: '__held_1', label: 'healing draught' }]);
    expect(js).toContain('"var":"__held_1"');
    expect(js).not.toContain('"label":"healing draught"');
    expect(() => readHudGrammar({ hearts: { var: 'hp', per: 0, max: 5 }, slots: [] })).toThrow(/hearts/);
    expect(readHudGrammar(null)).toBe(null);
  });
  it('names the places of a planned map on its page, each its segment\'s square: a card on coming into one', () => {
    const level = { grid: { tile: 24, plan: { size: 3, rows: ['A B C', '. E D'], key: { A: { name: 'the village' }, B: { name: 'the meadow road' }, E: {} } } } };
    const all = mapPlaces(level);
    expect(all.map((p) => p.name)).toEqual(['The village', 'The meadow road']);
    expect(all[0].box).toEqual([0, -72, 72, 0]);
    expect(all[1].box).toEqual([72, -72, 144, 0]);
    expect(mapPlaces(level, ['B', 'C']).map((p) => p.name)).toEqual(['The meadow road']);
    expect(mapPlaces({})).toEqual([]);
    const g = levelGrammar(G, MECH, { places: all });
    expect(readHudGrammar(g).places).toHaveLength(2);
    expect(() => readHudGrammar({ ...g, places: [{ name: 'x' }] })).toThrow(/places/);
  });
  it('carries the game\'s items: the quick item its slot on its key, counted by the bag\'s own var; the bag on its key, carried level to level', () => {
    const inv = rowInventory(G, MECH);
    expect(Object.keys(inv.play.items)).toEqual(['healing draught']);
    const use = inv.play.items['healing draught'].use;
    // (two hearts of hp on the level's health, never past its full)
    expect(use[0]).toEqual({ add: 'hp', by: 2 * 2 * HEART_HITS, max: 20 });
    expect(inv.play.menus).toEqual([{ id: 'bag', kind: 'inventory', title: 'Bag' }]);
    expect(inv.play.cues.map((c) => c.id)).toEqual(['open-bag', 'quick-item']);
    expect(inv.inputs.map((i) => i.key)).toEqual([ITEM_KEYS.bag, ITEM_KEYS.quick]);
    expect(inv.mechanics).toEqual([{ kind: 'bag', slice: 'bag' }]);
    expect(rowInventory(G, [...MECH, { kind: 'bag', slice: 'bag' }]).mechanics).toEqual([]);
    expect(inv.quick).toMatchObject({ item: 'healing draught', var: 'held:bag:healing-draught', key: 'X', icon: 'potion' });
    expect(bagStart(G)).toEqual({ 'healing draught': 1 });
    const g = levelGrammar(G, MECH, { quick: inv.quick });
    expect(g.slots.find((s) => s.id === 'item')).toMatchObject({ keys: 'X', var: 'held:bag:healing-draught', icon: 'potion' });
    expect(rowInventory({ intent: { from: 'no-such-genre' } }, MECH)).toBe(null);
    expect(bagStart({ intent: { from: 'no-such-genre' } })).toBe(null);
  });
  it('is drawn in the game\'s look where it is given one: its theme\'s sheet, the hearts in its accent, each slot its icon', () => {
    const theme = interfaceLook(G).theme;
    const js = hudGrammarScript(levelGrammar(G, MECH, { quick: rowInventory(G, MECH).quick, theme }));
    expect(js).toContain(readTheme(theme).tokens.accent);
    expect(js).toContain('data:image/svg+xml');
    expect(js).not.toContain('"theme":');
    expect(() => readHudGrammar({ ...levelGrammar(G, MECH), theme: { frame: 'no-such-frame' } })).toThrow(/theme/);
  });
  it('takes what the level says from its guide: the guide gives its one thing as data and keeps its own line down', () => {
    const page = guideScript({ steps: [{ at: [0, 0, 0], radius: 3, say: 'On to the gate' }] });
    expect(page).toContain('view: () => V');
    expect(page).toContain('window.__mojHudGrammar');
    const js = hudGrammarScript(levelGrammar(G, MECH));
    expect(js).toContain('__mojGuide.view');
    // (the parts it stands in for are hidden beside it)
    for (const c of ['.moj-w-legend', '.moj-c-radar', '.moj-c-gauge', '.moj-hud-top-left', '.hud,.hint']) expect(js).toContain(c);
  });
});
