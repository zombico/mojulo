import { describe, it, expect } from 'vitest';
import { readTheme, gameHudCss, THEME_IDS } from '../../mana-ui/theme.js';
import { WORLDMAP_SAMPLE, worldmapGame } from './worldmap-bed.js';
import { readGameworld } from './world.js';
import { emitPlayShell } from '../game/play-shell.js';
import { normalizeGameManifest } from '../game/game-manifest.js';
import { normalizeLevelContract } from '../game/level-contract.js';
import { guideScript } from '../scene/channels/guide.js';

// THE HUD'S LOOK: a world names a mana-ui theme for its HUD (`hud`); the adventure look's HUD sits on the scene itself
// (no cards, words outlined, slim framed meters, no numbers), its level badge left to the status page, its shell's menu
// button left to Esc under a mouse; and the guide shows one thing at a time.
describe('the adventure look', () => {
  it('is mana-ui\'s, its HUD bare; a panel look adds no sheet', () => {
    expect(THEME_IDS).toContain('adventure');
    expect(readTheme('adventure')).toMatchObject({ hud: 'bare', corner: 'cut' });
    expect(readTheme('modern').hud).toBe('panel');
    expect(gameHudCss('modern')).toBe('');
    const css = gameHudCss('adventure');
    for (const want of ['.moj-w{background:none!important', '.moj-w-bar .moj-val{display:none}', '.moj-c-hp{', '.moj-c-gauge']) expect(css).toContain(want);
    expect(() => readTheme({ from: 'modern', hud: 'glass' })).toThrow(/theme.hud is one of: panel, bare/);
  });

  it('is the world\'s word: its levels\' events wear it with no level badge, its game tells its shell', () => {
    expect(() => readGameworld({ ...WORLDMAP_SAMPLE, hud: 'glossy' })).toThrow(/hud is the look its HUD wears, a mana-ui theme: .*adventure/);
    const M = worldmapGame({ ...WORLDMAP_SAMPLE, hud: 'adventure' }, { ref: 'wm' });
    for (const l of M.levels) {
      expect(l.manifest.events.look).toBe('adventure');
      expect((l.manifest.play?.parts ?? []).some((p) => p.part === 'readout' && p.id === 'level')).toBe(false);
    }
    expect(M.game.hud).toBe('adventure');
    const shell = (hud) => emitPlayShell(normalizeGameManifest({ kind: 'game', title: 't', shell: 'play', store: { slices: [{ name: 'campaign', kind: 'progression' }] }, levels: [{ ref: 'a', title: 'a' }], ...(hud ? { hud } : {}) }), [{ ref: 'a', contract: normalizeLevelContract({ levelRef: 'a', produces: { events: [] } }) }]);
    expect(shell('adventure')).toContain('@media (hover:hover) and (pointer:fine){#pauseBtn{display:none!important}}');
    expect(shell(null)).not.toContain('pointer:fine');
  });
});

describe('the guide, one thing at a time', () => {
  it('draws one slot, and chooses what it holds: a line said, the opening, a held way, the lesson at hand, the way on', () => {
    const js = guideScript({ intro: 'x', introKeys: ['mouse  look around'], steps: [{ id: 'a', say: 'go', at: [0, 0, 0], radius: 6, keys: ['click  strike'], says: 'hi' }], held: [[1, 2, 3]] });
    expect(js.match(/document\.createElement\('div'\)/g)).toHaveLength(1);
    expect(js.indexOf("put('say'")).toBeLessThan(js.indexOf("put('intro'"));
    expect(js.indexOf("put('intro'")).toBeLessThan(js.indexOf("put('held'"));
    expect(js.indexOf("put('held'")).toBeLessThan(js.lastIndexOf("put('keys'"));
    expect(js.lastIndexOf("put('keys'")).toBeLessThan(js.lastIndexOf("put('way'"));
    expect(() => new Function(js.replace(/\bTHREE\b|\bscene\b|\bwrap\b|\bcamera\b/g, 'undefined'))).not.toThrow();
  });
});
