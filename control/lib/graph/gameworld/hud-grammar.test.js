// A LEVEL'S HUD GRAMMAR: asked for by the genre's row, filled from the level's own mechanics, drawn by mana-ui.
import { describe, it, expect } from 'vitest';
import { levelGrammar, HEART_HITS } from './hud-grammar.js';
import { composeGameworld } from './compose.js';
import { readGameworld } from './world.js';
import { inputMap } from './input-map.js';
import { readHudGrammar, hudGrammarSpec, hudGrammarScript } from '../scene/channels/hud-grammar.js';
import { manaUi } from '../../mana-ui/kernel.js';

const G = readGameworld(composeGameworld({ prompt: 'an anime action rpg like zelda', name: 'Artesia' }));
const MECH = [{ kind: 'fail-on-death', startHp: 20, hits: 2, bar: true }, { kind: 'reach-exit', at: [70, -36, 2], radius: 2.5, holds: { who: 'foe-*', count: 3 } }, { kind: 'collect', into: 'bag', pickups: [{ item: 'healing draught', at: [1, 2, 0] }] }];

describe('a level\'s HUD grammar', () => {
  it('is the genre row\'s: hearts of two hits each, the kit\'s weapon and sidearm on the input map\'s controls, what it collects, its goal', () => {
    const g = levelGrammar(G, MECH);
    expect(g.hearts).toEqual({ var: 'hp', per: 2 * HEART_HITS, max: 5 });
    const M = Object.fromEntries(inputMap({ moveset: true, sidearm: 'bow' }).map((r) => [r.id, r]));
    expect(g.slots.map((s) => s.id)).toEqual(['weapon', 'sidearm', 'item:healing draught']);
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
});
