import { describe, it, expect } from 'vitest';
import { manaUi, withIdioms, readTheme, titleLetters, lettersCss, IDIOMS } from './index.js';

// A TITLE THAT PERFORMS: a display's words entering letter by letter (the text's `letters`), in the way a look says (its
// `title`), on a sheet only the surfaces that draw letters lay; a title screen's menu as words with no window behind.
// Each on the smallest spec that shows it.
const host = (state = {}) => ({ read: (p) => manaUi.readPath(state, p), act: () => {} });
const view = (node, state) => manaUi.runtime({ start: 'a', screens: { a: { use: 'screen', children: [node] } } }, host(state)).view();
const viewOf = (spec, state) => manaUi.runtime(withIdioms(spec), host(state)).view();

describe('letters', () => {
  it('a display entering by letters is a span a letter, numbered, read aloud whole', () => {
    const html = view({ use: 'text', props: { value: 'Go On', role: 'display', letters: 'slam' } });
    expect(html).toContain('data-letters="slam"');
    expect(html).toContain('aria-label="Go On"');
    expect((html.match(/class="mana-letter"/g) || []).length).toBe(5);
    expect(html).toContain('style="--n:4"');
  });

  it('a text that says none is drawn as it always was', () => {
    const plain = view({ use: 'text', props: { value: 'Go On', role: 'display' } });
    expect(view({ use: 'text', props: { value: 'Go On', role: 'display', letters: 'none' } })).toBe(plain);
    expect(plain).not.toContain('mana-letter');
    expect(() => manaUi.readNode({ use: 'text', props: { value: 'x', letters: 'spin' } })).toThrow(/one of: none, rise, slam, wipe, track/);
  });

  it('its sheet: an entrance a kind, a fade for a calm reader', () => {
    const css = lettersCss('.x');
    for (const k of ['rise', 'slam', 'wipe', 'track']) expect(css).toContain(`.x [data-letters=${k}] .mana-letter{animation-name:mana-letter-${k}}`);
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{\.x \[data-letters\] \.mana-letter\{animation-name:mana-letter-fade/);
    expect(css).toContain('.x[data-motion=reduced] [data-letters] .mana-letter{animation-name:mana-letter-fade');
  });
});

describe('a look\'s title', () => {
  it('is said, or left out of the theme read', () => {
    expect('title' in readTheme('modern')).toBe(false);
    expect(readTheme({ from: 'modern', title: 'wipe' }).title).toBe('wipe');
    expect(readTheme({ from: { from: 'modern', title: 'wipe' } }).title).toBe('wipe');
    expect(() => readTheme({ title: 'spin' })).toThrow(/theme.title is one of: still, rise, slam, wipe, track/);
  });
  it('a look that says none rises; still is at once', () => {
    expect(titleLetters('modern')).toBe('rise');
    expect(titleLetters({ from: 'modern', title: 'track' })).toBe('track');
    expect(titleLetters({ from: 'modern', title: 'still' })).toBe('none');
  });
});

describe('the title screen', () => {
  const items = [{ label: 'Start', then: { emit: 'go' } }];
  const spec = (props) => ({ start: 't', screens: { t: { use: 'title-screen', props: { title: 'Sky', subtitle: 'go', version: 'v1', items, ...props } } } });
  it('keeps its window by default, and gives it up when bare', () => {
    const windowed = viewOf(spec({}));
    const bare = viewOf(spec({ bare: true }));
    expect(windowed).toContain('data-variant="ghost"');
    expect((windowed.match(/data-variant="ghost"/g) || []).length).toBeGreaterThan((bare.match(/data-variant="ghost"/g) || []).length);
    expect(bare).toContain('Start');
  });
  it('its name enters by letters when asked', () => {
    expect(viewOf(spec({ letters: 'rise' }))).toContain('data-letters="rise"');
    expect(viewOf(spec({}))).not.toContain('data-letters');
    expect(IDIOMS['title-screen'].params).toEqual(expect.arrayContaining(['letters', 'bare']));
  });
});
