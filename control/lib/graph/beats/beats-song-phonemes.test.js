import { describe, expect, it } from 'vitest';

import { romanizeKata, KANA_CV } from './beats-song-phonemes.js';

const shape = (moras) => moras.map((m) => (m.geminate ? 'Q' : '') + m.cons + ':' + m.vowel + (m.coda ? '/' + m.coda : '')).join(' ');

describe('KANA_CV table', () => {
  it('maps the 50-on grid and the irregular rows', () => {
    expect(KANA_CV['カ']).toEqual({ cons: 'k', vowel: 'ア' });
    expect(KANA_CV['サ']).toEqual({ cons: 's', vowel: 'ア' });
    expect(KANA_CV['シ']).toEqual({ cons: 'sh', vowel: 'イ' });   // irregular
    expect(KANA_CV['チ']).toEqual({ cons: 'ch', vowel: 'イ' });
    expect(KANA_CV['ツ']).toEqual({ cons: 'ts', vowel: 'ウ' });
    expect(KANA_CV['フ']).toEqual({ cons: 'f', vowel: 'ウ' });
    expect(KANA_CV['ア']).toEqual({ cons: '', vowel: 'ア' });
  });
});

describe('romanizeKata', () => {
  it('articulates the consonant at every mora, not just the front', () => {
    // star → スタ + sustained: s-u, t-a, then held a's
    const m = romanizeKata('スタアア');
    expect(m[0]).toMatchObject({ cons: 's', vowel: 'ウ' });
    expect(m[1]).toMatchObject({ cons: 't', vowel: 'ア' });
    expect(m.slice(2).every((x) => x.cons === '' && x.vowel === 'ア')).toBe(true);
  });

  it('turns ン into a coda on the previous mora', () => {
    expect(shape(romanizeKata('トゥイン'))).toBe('t:ウ :イ/n');   // twin
  });

  it('merges a small vowel onto the previous mora', () => {
    expect(romanizeKata('トゥ')).toEqual([{ cons: 't', vowel: 'ウ', coda: null, geminate: false }]);
  });

  it('palatalizes with a yōon', () => {
    const m = romanizeKata('キャ');
    expect(m[0]).toMatchObject({ cons: 'ky', vowel: 'ア' });
  });

  it('drops the chōonpu and flags a sokuon as geminate', () => {
    expect(romanizeKata('アー')).toHaveLength(1);
    const m = romanizeKata('アッタ');
    expect(m[m.length - 1].geminate).toBe(true);
  });

  it('never returns empty', () => {
    expect(romanizeKata('')).toHaveLength(1);
    expect(romanizeKata('ー')).toHaveLength(1);
  });

  it('handles a full diphthong word (dia → da-i-ya)', () => {
    expect(shape(romanizeKata('ダイヤ'))).toBe('d:ア :イ y:ア');
  });
});
