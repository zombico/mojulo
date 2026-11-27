// @vitest-environment jsdom
// THE GAME'S SCREENS (game-screens.js): the OPENING holds the level while the world comes up and the shaders are built,
// then waits for the player; pressed, the chapter's card and the level started under it. The RESULTS say the end as a
// screen in the level's look: its word, its name, what it kept, Play again standalone.
import { describe, expect, it } from 'vitest';
import { openingScript, resultsScript, SCREENS } from './game-screens.js';
import { gameChannelScript } from './game.js';

function page(game) {
  document.body.innerHTML = ''; document.head.innerHTML = '';
  for (const k of ['__mojScreens', '__mojCtrl', '__formReady', '__mojMenuOpen']) delete window[k];
  let frames = [];
  const raf = (f) => { frames.push(f); };
  const api = new Function('window', 'document', 'requestAnimationFrame', '__GAME', `${resultsScript()}${openingScript()}\nreturn { __mojOpening, __mojResults };`)(window, document, raf, game);
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { const fs = frames; frames = []; fs.forEach((f) => f()); } };
  return { api, tick };
}
const GAME = { title: 'Terraformers: Warlords of Mars', name: 'The Survey', noun: 'Mission', look: { ink: '#e9edee', panel: '#0d1114', line: '#5d6a70', accent: '#9fd2d6', accent2: '#e3c98a', harm: '#e0634f' },
  opening: { kicker: 'Terraformers', title: 'Warlords of Mars', chapter: { label: 'Chapter 1', name: 'The Survey' } } };

describe('the opening', () => {
  it('holds the level while the world comes up and its shaders are built, then waits for the player', () => {
    const P = page(GAME);
    let started = 0;
    P.api.__mojOpening(() => { started++; });
    P.tick(5);
    expect(window.__mojScreens.opening).toBe('loading');
    expect(window.__mojMenuOpen).toBe(true);                                   // (the pilot's keys held)
    window.__mojCtrl = { world: {} }; window.__formReady = true;
    P.tick(SCREENS.warm + 2);
    expect(window.__mojScreens.opening).toBe('ready');
    expect(document.querySelector('.moj-sc .press')).toBeTruthy();
    expect(started).toBe(0);                                                    // (nothing begins until it is pressed)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(started).toBe(1);
    expect(window.__mojScreens.opening).toBe('card');
    expect(document.querySelector('.moj-sc.card .kick').textContent).toBe('Chapter 1');
    expect(document.querySelector('.moj-sc.card .title').textContent).toBe('The Survey');
    expect(window.__mojMenuOpen).toBe(false);
  });
});

describe('the results', () => {
  it('say the end in the level\'s look: its word, its name, what it kept, Play again on its own', () => {
    const P = page(GAME);
    const el = P.api.__mojResults({ result: 'success', stats: { kept: [{ label: 'Tasks met', value: 17 }, { label: 'Time', value: 412, unit: 's' }] } }, { hosted: false });
    expect(el.querySelector('.word').textContent).toBe('Mission complete');
    expect(el.querySelector('.kick').textContent).toBe(GAME.title);
    expect([...el.querySelectorAll('.row')].map((r) => r.textContent)).toEqual(['Tasks met17', 'Time412s']);
    expect(el.style.getPropertyValue('--sc-accent')).toBe(GAME.look.accent);
    expect(el.querySelector('button.again')).toBeTruthy();
    const F = page({}).api.__mojResults({ result: 'fail' }, { hosted: true });
    expect(F.querySelector('.word').textContent).toBe('Level failed');            // (a level that names no noun)
    expect(F.querySelector('button')).toBeNull();                                 // (hosted: the shell's flow goes on)
  });

  it('a game channel with no opening carries none of it; one with one holds its start for it', () => {
    expect(gameChannelScript({ levelRef: 'x', presets: { default: {} } })).not.toContain('__mojOpening');
    expect(gameChannelScript({ levelRef: 'x', presets: { default: {} }, opening: { title: 'T' } })).toContain('__mojOpening(fallback)');
  });
});
