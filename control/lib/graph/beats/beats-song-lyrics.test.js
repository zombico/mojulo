import { describe, expect, it } from 'vitest';

import {
  transliterate,
  ruleTransliterate,
  applyReplacers,
  elongateKata,
  authorSyllable,
  authorScore,
  vowelKana,
  DEFAULT_REPLACERS,
} from './beats-song-lyrics.js';

describe('transliterate', () => {
  it('uses the curated override table for known syllables', () => {
    expect(transliterate('twin')).toBe('トゥイン');
    expect(transliterate('star')).toBe('スタ');      // スター → スタ via replacer
    expect(transliterate('Twin')).toBe('トゥイン');  // case-insensitive
  });

  it('falls back to the per-letter rule for unlisted syllables', () => {
    expect(transliterate('bop', { raw: true })).toBe(ruleTransliterate('bop'));
    expect(ruleTransliterate('bop')).toBe('ブオプ');
    expect(transliterate('bop')).toBe('ブオッ');      // replacers clip the final プ → ッ
    expect(ruleTransliterate('')).toBe('ア');         // never empty
  });

  it('raw mode bypasses the replacer polish (for A/B)', () => {
    expect(transliterate('star', { raw: true })).toBe('スター');
    expect(transliterate('star')).toBe('スタ');
  });
});

describe('applyReplacers', () => {
  it('v → b', () => {
    expect(applyReplacers('バヴ')).toBe('バブ');
  });

  it('clips a final voiceless stop-epenthesis to one sokuon', () => {
    expect(applyReplacers('ワット')).toBe('ワッ');   // what
    expect(applyReplacers('ライク')).toBe('ライッ');  // like
  });

  it('is a no-op with an empty replacer list', () => {
    expect(applyReplacers('バヴ', [])).toBe('バヴ');
  });
});

describe('elongateKata', () => {
  it('leaves short notes untouched', () => {
    expect(elongateKata('ア', 0.5)).toBe('ア');
  });

  it('sustains an open nucleus by repeating the vowel kana, never ー', () => {
    const held = elongateKata('スタ', 2.0);
    expect(held.startsWith('スタ')).toBe(true);
    expect(held).toContain('ア');
    expect(held).not.toContain('ー');
    expect(held.length).toBeGreaterThan('スタ'.length);
  });

  it('holds the nucleus of a diphthong and keeps the glide last', () => {
    const held = elongateKata('ハイ', 2.0);   // high
    expect(held.endsWith('イ')).toBe(true);    // glide stays at the very end
    expect(held[0]).toBe('ハ');
    expect(held).toContain('ア');              // nucleus (ハ→ア) repeated, not "hayu"
    expect(held).not.toContain('ー');
  });

  it('strips a trailing chōonpu before elongating', () => {
    const held = elongateKata('ソー', 2.0);    // so
    expect(held).not.toContain('ー');
    expect(held.startsWith('ソ')).toBe(true);
  });

  it('elongates more for longer notes (near-linear mora count)', () => {
    const short = elongateKata('ア', 1.0);
    const long = elongateKata('ア', 2.2);
    expect(long.length).toBeGreaterThan(short.length);
  });
});

describe('vowelKana', () => {
  it('resolves consonant-vowel kana to their vowel', () => {
    expect(vowelKana('カ')).toBe('ア');
    expect(vowelKana('キ')).toBe('イ');
    expect(vowelKana('ク')).toBe('ウ');
    expect(vowelKana('?')).toBe('ア');   // default
  });
});

describe('authorSyllable', () => {
  it('composes transliterate → replacers → elongate', () => {
    expect(authorSyllable('star', 0.5)).toBe('スタ');           // short: no elongation
    const held = authorSyllable('star', 2.0);
    expect(held.startsWith('スタ')).toBe(true);
    expect(held.length).toBeGreaterThan('スタ'.length);
  });
});

describe('authorScore', () => {
  it('produces one render instruction per event with duration from tempo', () => {
    const score = authorScore(
      [['Twin', 'C4', 1], ['star', 'G4', 2]],
      120,   // 0.5 s/beat
    );
    expect(score).toHaveLength(2);
    expect(score[0]).toMatchObject({ syllable: 'Twin', note: 'C4', beats: 1, durSec: 0.5, kata: 'トゥイン' });
    expect(score[1].durSec).toBe(1.0);
    expect(score[1].kata.startsWith('スタ')).toBe(true);   // held over 2 beats
  });

  it('is deterministic — same score in, same katakana out', () => {
    const events = [['How', 'F4', 1], ['are', 'C4', 2]];
    expect(authorScore(events, 108)).toEqual(authorScore(events, 108));
  });
});

describe('DEFAULT_REPLACERS shape', () => {
  it('is an ordered list of [from, to] pairs', () => {
    for (const entry of DEFAULT_REPLACERS) {
      expect(entry).toHaveLength(2);
      expect(['string', 'object']).toContain(typeof entry[0]);
      expect(typeof entry[1]).toBe('string');
    }
  });
});
