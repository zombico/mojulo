import { describe, it, expect } from 'vitest';
import { soundBook, soundBookHtml } from './sound-book.js';
import { composeGameworld } from './index.js';
import { quickWorld } from './quick.js';
import { BASIC_ARSENAL } from './combos.js';

// The sound book (sound-book.js): the game's sound sheet read and heard. One case per kind of row.
const world = () => composeGameworld({ prompt: 'a haunted forest with relics to collect', seed: 1 });

describe('the sound book', () => {
  it('lists what the game plays: the hero, its arsenal, its foes, its events, each level\'s ground and bed; every row has its sound', () => {
    const w = { ...world(), sound: {}, arsenal: structuredClone(BASIC_ARSENAL), foes: { alpha: { class: 'brute', skin: { species: 'wolf' } } } };
    const B = soundBook(w);
    expect(B.on).toBe(true);
    const groups = new Set(B.rows.map((r) => r.group));
    for (const g of ['The hero', 'The arsenal', 'The foes', 'The game\'s events']) expect(groups.has(g), g).toBe(true);
    // (one ground a game: the hero's step says it, and no ground rows repeat it)
    expect(groups.has('The ground')).toBe(false);
    for (const r of B.rows) expect(r.kind === 'held' ? B.held[r.id] : B.cues[r.id], `${r.group} / ${r.what}`).toBeTruthy();
    expect(B.rows.find((r) => r.what === 'alpha attacks').word).toBe('snarl');
    expect(B.levels.length).toBeGreaterThan(0);
    expect(B.levels.every((L) => L.step === 'step-grass' && L.bed)).toBe(true);
    // the same world, the same book
    expect(soundBook(w)).toEqual(B);
  });

  it('a quick shooter\'s guns and a ride\'s engine (a held voice); a game on no sheet is told so and shown the sheet it would have', () => {
    const shooter = soundBook({ ...quickWorld({ id: 'qs', quick: { goal: 'shoot', arms: ['shotgun'] } }), sound: {} });
    expect(shooter.rows.filter((r) => r.group === 'The guns').map((r) => r.what)).toEqual(['shotgun: shot', 'shotgun: reload', 'shotgun: round landing', 'shotgun: draw']);
    const racer = soundBook({ ...quickWorld({ id: 'qr', quick: { goal: 'race', ride: 'coupe' } }), sound: {} });
    expect(racer.rows.find((r) => r.group === 'The ride')).toMatchObject({ word: 'car-engine', kind: 'held' });
    const off = world();
    expect(soundBook(off).on).toBe(false);
    expect(soundBook(off).rows.length).toBeGreaterThan(0);
    expect(soundBookHtml(off)).toContain('on no sound sheet yet');
    expect(soundBookHtml({ ...off, sound: {} })).not.toContain('on no sound sheet yet');
  });

  it('the page is self-contained and its script parses', () => {
    const html = soundBookHtml({ ...world(), sound: {} });
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
    const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
    expect(() => new Function(js)).not.toThrow();
  });
});
