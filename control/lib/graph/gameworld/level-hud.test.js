import { describe, it, expect } from 'vitest';
import { readGameworld, MEADOWMARK_HERO } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { readTheme } from '../../mana-ui/index.js';

// ONE HUD: a world whose screens are the game UI runtime's (its `ui`) has its levels' rows drawn there too, by the
// page's HUD host (scene/channels/mana-hud.js), in the same look. A world that says no `ui` lays its levels as before.
const order = (extra) => {
  const W = { ...MEADOWMARK_HERO, ...extra }, G = readGameworld(W), s = gameStages(W)[0];
  return stageLevelOrder(G, s, { ref: 'lv', heroRef: 'gw-hero' }).args.manifest;
};

describe('a level\'s HUD on the game UI runtime', () => {
  it('a world with a ui: its level asks for the host over its own rows, in a theme that reads', () => {
    const M = order({ ui: {} });
    expect(M.manaHud.rows).toBe('events');
    expect(() => readTheme(M.manaHud.theme)).not.toThrow();
  });
  it('a world without: not a key', () => { expect(order({}).manaHud).toBeUndefined(); });
});
