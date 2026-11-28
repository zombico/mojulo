// A LEVEL'S SCREENS on its contract (levels.js withScreens; scene/channels/game-screens.js): its results' names (the
// game's, the level's), a frame operation's noun (Mission), the look they are painted in (the world's interface theme),
// and a level's `opening` (its title screen and its chapter's card), read and refused as a level setting.
import { describe, expect, it } from 'vitest';
import { warlordsOfMarsStart } from './warlords-of-mars.js';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { readTheme } from '../../mana-ui/theme.js';

const W = (more = {}) => { const w = { id: 'wom', name: 'Terraformers: Warlords of Mars', ...warlordsOfMarsStart({}).world }; const id = Object.keys(w.levels).find((k) => w.levels[k].airspace?.frame); w.levels = { ...w.levels, [id]: { ...w.levels[id], ...more } }; return { w, id }; };
const gameOf = (w, id) => { const G = readGameworld(w), st = gameStages(w).find((s) => s.level === id); return stageLevelOrder(G, st, { ref: 'lv' }).args.manifest.game; };

describe('a level\'s screens', () => {
  it('its results say the game, the level and, for a frame\'s operation, a Mission, in the world\'s look', () => {
    const { w, id } = W();
    w.ui = { theme: 'terminal' };
    const g = gameOf(w, id);
    expect(g.title).toBe('Terraformers: Warlords of Mars');
    expect(g.noun).toBe('Mission');
    expect(g.look.accent).toBe(readTheme('terminal').tokens.accent);
    expect(g.opening).toBeUndefined();
  });

  it('a level\'s opening: its title screen and its chapter\'s card (the chapter named for the level unless it says), and one it cannot read refused', () => {
    const { w, id } = W({ opening: { kicker: 'Terraformers', title: 'Warlords of Mars', chapter: { label: 'Chapter 1' } } });
    const g = gameOf(w, id);
    expect(g.opening).toEqual({ title: 'Warlords of Mars', kicker: 'Terraformers', chapter: { label: 'Chapter 1', name: g.name } });
    expect(() => readGameworld(W({ opening: { banner: 'x' } }).w)).toThrow(/opening is \{ title\?/);
  });
});
