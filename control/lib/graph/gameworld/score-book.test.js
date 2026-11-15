import { describe, it, expect } from 'vitest';
import { scoreBook, scoreBookHtml } from './score-book.js';
import { composeGameworld } from './index.js';

// The score book (score-book.js): the game's cue sheet read and heard.
const world = () => composeGameworld({ prompt: 'a haunted forest with relics to collect, a boss at the end', seed: 1 });

describe('the score book', () => {
  it('lists every request with its cue, each one playable; the direction said once; the same world, the same book', () => {
    const w = { ...world(), music: {} }, B = scoreBook(w, { ref: 'gw' });
    expect(B.on).toBe(true);
    expect(B.direction.voice.key).toBeTruthy();
    for (const r of B.rows.filter((x) => x.mood)) { expect(r.plays, r.id).toBe(true); expect(B.cues[r.id].kind, r.id).toBe('beats-composition'); }
    expect(new Set(B.rows.map((r) => r.by))).toEqual(new Set(['flow', 'levels', 'foes', 'build']));
    expect(scoreBook(w, { ref: 'gw' })).toEqual(B);
    // a silence is a row with no cue
    const L = Object.keys(w.levels)[0], quiet = scoreBook({ ...w, music: { cues: { [`level:${L}`]: false } } }, { ref: 'gw' });
    expect(quiet.rows.find((r) => r.id === `level:${L}`)).toMatchObject({ mood: null, plays: false });
  });

  it('a game with no `music` is told so and shown the sheet it would have; the page is self-contained and its script parses', () => {
    expect(scoreBookHtml(world(), { ref: 'gw' })).toContain('has no <code>music</code> yet');
    const html = scoreBookHtml({ ...world(), music: {} }, { ref: 'gw' });
    expect(html).not.toContain('has no <code>music</code> yet');
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
    const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
    expect(() => new Function(js)).not.toThrow();
  });
});
