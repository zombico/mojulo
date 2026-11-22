// THE IMMERSIVE UI (immersive-ui.js): a stylish action game's screens draw no box; the letters carry the look, in light
// rims and shadows of the theme's own accents. Laid only where a game's `ui` says so: none ⇒ not a byte.
import { describe, it, expect } from 'vitest';
import { immersiveCss, LETTER_RIM, letterRimFilter } from './immersive-ui.js';
import { readShellUi, shellManaCss } from './play-shell-mana.js';
import { manaHudScript } from '../scene/channels/mana-hud.js';
import { levelHud } from './hud-mana.js';

describe('the immersive UI', () => {
  it('no box: a window, a banner and a region on no plate and in no frame, the choice marked by its arrow alone', () => {
    const css = immersiveCss('#mana');
    expect(css).toMatch(/#mana :is\(\.mana-window,\.mana-banner,\.mana-region\)\{background:transparent!important;border-color:transparent!important/);
    expect(css).toContain('.mana-layers{display:none!important}');
    expect(css).toContain('#mana [data-st=focus]{background:transparent!important}');
    // (a rank is its letter: no plate, no caption beside it)
    expect(css).toMatch(/\.mana-badge\[data-variant=stamp\]\{background:transparent!important;border:0!important/);
  });
  it('the letters carry the look: a rim and a shadow in the theme\'s accents, light, before the dark that keeps them read', () => {
    for (const rim of [LETTER_RIM, letterRimFilter()]) {
      expect(rim).toContain('var(--mana-accent2)');
      expect(rim).toContain('var(--mana-accent) 65%,#fff');
      expect(rim.indexOf('var(--mana-accent2)')).toBeLessThan(rim.indexOf('rgba(0,0,0'));
    }
  });
  it('is laid by a game\'s ui.immersive and on a HUD that carries the style meter; none ⇒ not a byte', () => {
    expect(readShellUi({ theme: 'console', immersive: true })).toEqual([]);
    expect(readShellUi({ theme: 'console', immersive: 'yes' }).join(' ')).toContain('immersive');
    const plain = shellManaCss({ theme: 'console' }), own = shellManaCss({ theme: 'console', immersive: true });
    expect(own.startsWith(plain)).toBe(true);
    expect(own.slice(plain.length)).toBe(immersiveCss('#mana'));
    const rows = [{ var: 'score', label: 'Score' }];
    expect(manaHudScript(levelHud('console', { style: true }), { rows })).toContain('var(--mana-accent) 65%,#fff');
    expect(manaHudScript(levelHud('console'), { rows })).not.toContain('65%,#fff');
  });
});
